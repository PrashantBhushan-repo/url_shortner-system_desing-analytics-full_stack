# 🏛️ SnapURL Authentication System Design Reference

This document covers high-level system design considerations, scaling strategies, and security design patterns implemented for the SnapURL authentication system.

---

## 1. Hybrid Session Storage Design (Scale & Performance)

To support low-latency URL redirection along with secure user authentication, the system splits data across memory and disk:

```
                  ┌──────────────────────┐
                  │   Client Request     │
                  └──────────┬───────────┘
                             │ (Bearer JWT)
                             ▼
                  ┌──────────────────────┐
                  │ Express API Gateway  │
                  └──────┬────────────┬──┘
                         │            │
             (Cache Hit) │            │ (Cache Miss)
             [ < 1ms ]   ▼            ▼ [ ~10-50ms ]
                  ┌──────────┐    ┌─────────────┐
                  │  Redis   │    │ PostgreSQL  │
                  │ (Memory) │    │   (Disk)    │
                  └──────────┘    └─────────────┘
```

### Redis Cache (Memory Layer)
* **Purpose**: Caches active user statuses (e.g., checks if a user is `SUSPENDED` or `BANNED`).
* **Design Rationale**: Reduces database query load. REDIS reads take `< 1ms` compared to SQL queries which take `10ms–50ms`.
* **Eviction Policy**: Configured with `volatile-lru` (Least Recently Used with expiration set) to automatically discard inactive user statuses when memory limit is reached.
* **Key Design**: `status:<userId>` with a Time-To-Live (TTL) of **5 minutes** (300s). This limits the window of inconsistency if an administrator bans a user.

### PostgreSQL (Disk Layer)
* **Purpose**: Permanent persistent storage for `User` records and `RefreshToken` sessions.
* **Design Rationale**: Ensures sessions persist even if Redis restarts. PostgreSQL provides ACID transactions, ensuring registration and password changes are atomic.

---

## 2. Database Indexing Optimization

To prevent auth lookups from slowing down at scale (millions of users/sessions), indexes are placed on columns queried during authorization checkups.

### Table Schema Indexes
1. **User Table**:
   * `email` has a `UNIQUE` index. This allows `O(1)` or `O(log N)` lookup times during login rather than a full table scan.
2. **RefreshToken Table**:
   * `tokenHash` has a search index (`@@index([tokenHash])`). Since every `/refresh` and `/logout` action matches the hash, indexing this column ensures rapid validation.
   * `userId` has an index to speed up revoking all sessions for a compromised user account.

---

## 3. Dealing with Concurrency (Refresh Token Race Conditions)

In Single-Page Applications (React), concurrent API requests are common. If three API requests occur simultaneously while the Access Token is expired, all three might attempt to hit `/refresh` at the exact same moment.

```
Request 1 ───────► /api/auth/refresh ──────► (Saves Token B, Deletes Token A) ───► Success
Request 2 ───────► /api/auth/refresh ──────► (Token A Already Deleted!) ─────────► 401 Unauthorized (Crash)
```

### System Design Mitigation (Token Leeway Window)
To prevent users from being logged out randomly due to concurrent requests, the system design follows a **Token Reuse Leeway** strategy:
1. When a Refresh Token is rotated, instead of deleting it instantly, it is marked as `rotated` with a **10-second grace period**.
2. Within those 10 seconds, if another request arrives with the old Refresh Token, the server allows the request and returns the newly generated Access Token.
3. After 10 seconds, the old Refresh Token is permanently invalidated.

---

## 4. Distributed Scaling & Token Revocation

Stateless JWT tokens are highly scalable because servers do not need to query a database to verify them. However, they cannot be revoked before their expiration time.

### Invalidation Design Strategies:
1. **Short Lifespans**: Access Tokens are limited to **15 minutes**.
2. **User Token Versioning (`tokenVersion`)**: 
   * The `User` table has a `tokenVersion` counter column (default: `0`).
   * The signed JWT payload contains this version: `{ userId: "123", tokenVersion: 3 }`.
   * **Instant Revocation Action**: When a user changes their password or clicks "Log out of all devices", the backend increments their `tokenVersion` in PostgreSQL and updates the cache.
   * On subsequent requests, the middleware compares the JWT's `tokenVersion` against the user's current version. Mismatches result in immediate revocation.

---

## 5. Security Hardening & Threat Vectors

### A. Brute-Force and Credential Stuffing Mitigation
* **System Design**: Rate limiting is applied at the API Gateway using Redis-backed `rate-limit-redis`.
* **Login Limit**: Max **5 requests per minute** per IP address on the `/api/auth/login` endpoint.
* **Refresh Limit**: Max **10 requests per minute** per IP address on `/api/auth/refresh`.

### B. Cross-Site Scripting (XSS) Token Theft
* **System Design**: Access Tokens are kept in memory (JavaScript state) rather than `localStorage`. If an attacker executes XSS, they cannot easily pull the Refresh Token because it is protected inside an `HttpOnly` cookie.

### C. Cross-Site Request Forgery (CSRF)
* **System Design**: Cookies are flagged with `SameSite=Lax`. Cross-site POST requests (malicious sites attempting to trigger actions using standard browser cookies) are blocked by the browser. Additionally, custom headers (like `Authorization`) cannot be set on cross-site requests without triggering CORS pre-flight checks.
