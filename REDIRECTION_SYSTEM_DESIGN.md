# 🏛️ SnapURL Redirection: System Design & DSA Reference

This document covers the mathematical models, database indexing designs, caching patterns, and algorithms (DSA) applied to implement the high-throughput URL shortening and redirection engine of SnapURL.

---

## 1. DSA: Base62 Encoding & Bijective Mapping

When shortening a URL, the system translates a database identifier or a random number into a short, URL-safe string.

### Why Base62?
* **URL Compatibility**: standard Base64 includes `+` and `/` characters. In URLs, these have special routing meanings and require encoding.
* **Character Set**: Base62 uses only alphanumeric characters: `[0-9a-zA-Z]` (10 digits, 26 lowercase letters, 26 uppercase letters).
* **Information Density**: A 6-character Base62 string can represent up to \(62^6 = 56,800,235,584\) unique combinations.

### BigInt to Base62 Conversion Algorithm:
To convert a numerical database ID into a Base62 string:
```
Algorithm EncodeBase62(number)
    Input: number (BigInt)
    Output: shortCode (String)
    
    1. Define characterSet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
    2. Initialize empty string shortCode
    
    3. If number is 0 then 
           Return "0"
           
    4. While number > 0 do
           remainder = number MOD 62
           character = characterSet[remainder]
           Prepend character to shortCode
           number = Floor(number / 62)
           
    5. Return shortCode
```
* **Time Complexity**: `O(log62(N))` where `N` is the database ID. Runs in under `0.1 microseconds`.
* **Space Complexity**: `O(1)` auxiliary space.

---

## 2. System Design: Random Generation vs. ID Conversion

There are two primary methods for allocating short codes. The system evaluates their trade-offs carefully:

| Feature | Method A: Base62 of Incremental Database ID | Method B: Crypto-Random String Generation (Implemented) |
| :--- | :--- | :--- |
| **Lookup Latency** | `O(log N)` | `O(log N)` |
| **Vulnerability** | **High** (Predictable URLs: If target is `r/A123`, the next URL is `r/A124`. Attackers can harvest the entire database). | **None** (URLs are randomized: e.g. `r/x7T9aW`, making scanning impossible). |
| **Database Collisions** | **None** (IDs are guaranteed unique by database autoincrement). | **Low** (Possibility of two random keys matching, requiring collision handling). |

### Collision Handling System Design:
To prevent random generation collisions from throwing errors to the client, the backend implements a **Looping Collision Resolver**:
1. Generates a random 6-character token.
2. Attempts to write to PostgreSQL.
3. If PostgreSQL returns error code `23505` (unique constraint violation on `idx_urls_short_code`), the transaction rolls back, the counter increments, and a new random code is generated.
4. If it fails 5 times, it returns an error (mathematical probability of 5 consecutive collisions on 56 Billion space is \(< 10^{-45}\)).

---

## 3. Database Indexing: B-Trees on Short Codes

URL redirection routes check PostgreSQL whenever there is a Redis cache miss. To prevent lookups from degrading as the database scales to millions of URLs, the system relies on **B-Tree Indexes**.

```
                           [ Root Node ]
                           /     |     \
                          /      |      \
                         v       v       v
                    [ A - M ] [ N - S ] [ T - Z ]
                    /   |   \
                       ...
                     /      \
                    v        v
                [A123]      [B999]  <-- Leaf Nodes (Points to SQL Disk Data)
```

### Rationale:
* The index is created on the `short_code` column (`@@index([short_code])` or `idx_urls_short_code`).
* PostgreSQL structures this index as a **B-Tree (Balanced Tree)**.
* **Search Complexity**: `O(log N)`. Even with 100,000,000 URLs, PostgreSQL resolves the pointer to the disk location in `3 to 4 index tree hops` (taking `< 1ms`).

---

## 4. Redirection Caching: Thundering Herd Mitigation

When a highly viral shortened link is hit by thousands of users per second, it resides in Redis cache. If that cache key expires, or is invalidated because the user updated the destination:

### The Problem (Thundering Herd / Cache Stampede):
Thousands of concurrent requests see a Redis cache miss at the exact same millisecond. They all execute fallback queries to PostgreSQL simultaneously, causing database CPU spikes and connection pool starvation.

### System Design Mitigation:
1. **Long Expirations for Active Links**: Cache keys for redirects are saved with long expiration times.
2. **Explicit Invalidation on Update**: Instead of using short expirations to handle updates, keys are deleted *only* when the user updates the URL target in the dashboard.
3. **Locking (Mutex/Single-Flight Pattern)**: During a cache miss, the server can acquire a lightweight Redis lock for that shortcode. The first request retrieves the data from PostgreSQL and writes it to Redis, while subsequent concurrent requests wait a few milliseconds and read the newly cached target from Redis directly.
