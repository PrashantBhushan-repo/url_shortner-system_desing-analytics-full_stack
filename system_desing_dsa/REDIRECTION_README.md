# 🔗 SnapURL Redirection & Shortening Architecture

This document provides a complete technical reference for the core URL shortening and low-latency redirect engine implemented in SnapURL.

---

## 🏗️ Core Engine Architecture

SnapURL separates the write path (Shortening) from the read path (Redirecting) to maximize throughput and ensure sub-millisecond response loops.

```
       [ SHORTENING LOOP - WRITE PATH ]
           (Optimized for validation)
  ┌─────────────────┐
  │   React Client  │
  └────────┬────────┘
           │ POST /api/urls
           ▼
  ┌─────────────────┐
  │ Express Gateway │◄─── Validates Plan Limits in Redis
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │  PostgreSQL DB  │
  └─────────────────┘


       [ REDIRECTION LOOP - READ PATH ]
         (Optimized for low-latency)
  ┌─────────────────┐
  │  Link Visitor   │
  └────────┬────────┘
           │ HTTP GET /r/:shortCode
           ▼
  ┌─────────────────┐
  │ Express Router  │
  └──────┬─────┬────┘
         │     │
   (Hit) │     │ (Miss) [O(1)]
   [<1ms]▼     ▼ [~20ms]
    ┌───────┐ ┌─────────────┐
    │ Redis │ │ PostgreSQL  │
    └───────┘ └──────┬──────┘
                     │ (Updates cache)
                     ▼
             ┌──────────────┐
             │ Redis Cache  │
             └──────────────┘
```

---

## 🔄 Lifecycle Flows

### 1. Shortening Workflow (Write Loop)
1. **Creation Request**: The React client dispatches a `POST /api/urls` payload containing the target `longUrl`, optional `customAlias`, `expiresAt`, `password` protection, and `customDomainId`.
2. **Gating Checks**: The `validateUrlGating` service validates request parameters against the user's active billing plan (cached in Redis):
   * Verifies if the user is allowed to use custom aliases.
   * Checks if link expirations are supported in their tier.
   * Confirms password protection access.
3. **Password Hashing**: If a password is set, the system hashes it using **bcrypt** (salt rounds = 10) before saving.
4. **Collision Resolution Engine (Base62 Generation)**:
   * If a `customAlias` is selected, the system checks database uniqueness.
   * If auto-generating, it creates a random short code (Base62 character set: `a-z`, `A-Z`, `0-9`).
   * **Collision Retries**: If PostgreSQL throws a unique constraint violation error (code `23505`), the backend catches the error, discards the code, and loops to generate a new short code (retries up to 5 times).
5. **Database Storage**: Writes the Url record to the database and returns a `201 Created` payload.

### 2. Redirect Workflow (Read Loop)
1. **Visitor Hit**: A browser requests `/r/:shortCode`.
2. **Cache-First Target Resolution**:
   * Checks the Redis key `url:redirect:shortCode`.
   * **Cache Hit**: Returns target mapping instantly.
   * **Cache Miss**: Queries PostgreSQL using Prisma. Saves the mapping to Redis for future hits, then proceeds.
3. **Password Guard Checks**:
   * If `passwordHash` exists, the gateway inspects the request query params for `?password=value`.
   * **Password Match**: Verifies using `bcrypt.compare()`.
   * **Password Mismatch**: Redirects the user to the frontend password gateway route `/p/:shortCode` with error queries.
4. **Proxy IP Extraction (Load Balancer Bypass)**:
   * To identify visitor locations accurately behind reverse proxies (like Cloudflare, Nginx, or AWS load balancers), the server parses IP headers in order of priority:
     `X-Forwarded-For` (splits lists) ➔ `X-Real-IP` ➔ `CF-Connecting-IP` ➔ TCP socket stream.
5. **Visitor Tracking Hook**:
   * Inspects the browser cookie jar for a `visitor_id`.
   * If missing, it creates a unique `UUID` and sets a **1-year HTTP-only cookie** (`visitor_id`) to track returning browsers.
6. **Telemetry Enqueueing**: Launches an asynchronous queue job using `addClickJob()` to pass IP, User-Agent, Referrer, and visitor IDs to BullMQ.
7. **Redirect response**: Returns a `302 Found` header redirect pointing to the target `longUrl`.

---

## 📊 Redirection Data Flow Matrix

| Action | Sender | Description | Receiver | Data Payload | Storage Operations |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Shorten** | React Client | User submits long target link. | Express API | `{ longUrl, customAlias, password }` | None |
| **Gating** | Express API | Validates user quota limits. | Redis / DB | `HGET limits:userId` | Check user tier permissions. |
| **Write URL** | Express API | Generates code & inserts row. | PostgreSQL | Short code, long URL, hash | `INSERT INTO "Url"` |
| **Client Hit** | Browser | Visitor clicks short link. | Express Router | HTTP GET `/r/shortCode` | None |
| **Get Target** | Express Router | Reads redirect location map. | Redis Cache | `GET url:redirect:shortCode` | Read cached target (Fallback to DB on miss). |
| **Enqueue** | Express Router | Submits click telemetry job. | Redis Queue | Click payload data | `LPUSH bull:clickQueue:wait` |
| **Redirect** | Express Router | Redirects browser to destination. | Browser | HTTP 302 Location | None |
| **Update URL** | React Client | User updates target destination. | Express API | `{ longUrl: newTarget }` | `UPDATE "Url"` in PostgreSQL; `DEL url:redirect:shortCode` in Redis (Invalidates cache). |

---

## 🔒 Security Parameter Configurations

### 1. Collision Resolution Algorithm (Base62)
To generate short codes, the system uses a Base62 algorithm generating a 6-character code.
* Total combinations: \(62^6 = 56,800,235,584\) (56.8 Billion unique URLs).
* **Self-Healing Loop**: If a rare collision occurs, the database throws unique index violations, and the service retries up to 5 times.

### 2. Cache Invalidation Patterns
* Target mapping caches are written to Redis with a specific expiration.
* **On Update/Delete**: When a user changes the target URL or deactivates a shortcode in their dashboard, the backend triggers:
  ```javascript
  await invalidateCache(shortCode); // DEL url:redirect:shortCode
  ```
  This guarantees that subsequent clicks instantly load the new destination.
