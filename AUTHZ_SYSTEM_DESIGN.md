# 🏛️ SnapURL Authorization System Design Reference

This document covers the high-level system design concepts, data access choices, security mitigations, and performance optimizations implemented for the authorization engine of SnapURL.

---

## 1. Low-Latency Authorization Cache Architecture

In a distributed web application, checking permissions on every single API request (e.g., checking if a user is suspended or banned) can create a massive database bottleneck.

```
                    ┌────────────────────────┐
                    │      Incoming API      │
                    │      Request (JWT)     │
                    └───────────┬────────────┘
                                │
                                ▼
                    ┌────────────────────────┐
                    │   authMiddleware.js    │
                    └───────────┬────────────┘
                                │
                    ┌───────────┴───────────┐
                    │  Read Cache: Redis    │ ◄─── Latency < 1ms
                    │  "status:userId"      │
                    └───────────┬───────────┘
                                │
                    ┌───────────┼───────────┐
       [Cache Hit]  │           │           │ [Cache Miss]
     ┌──────────────┘           │           └──────────────┐
     ▼                          ▼                          ▼
Status = ACTIVE?       Status = SUSPENDED?        PostgreSQL Lookup ◄─── Latency ~20ms
     │                          │                  (SELECT status...)
     ▼                          ▼                          │
[Route Execution]       [403 Forbidden]                    │
                                                           ▼
                                                   Write Cache to Redis
                                                   (TTL = 300 seconds)
```

### Key Design Decisions:
1. **Caching Status on the Edge**: Since user status (Active, Suspended, Banned) changes infrequently but is read on every single request, it is cached in Redis (`status:<userId>`) with a **5-minute expiration (TTL = 300s)**.
2. **Deterministic Invalidation Pattern (Write-Through/Delete)**: When an administrator changes a user's status:
   * The system updates the PostgreSQL table.
   * The backend instantly calls `invalidateUserStatusCache(userId)` which deletes the Redis key.
   * The next request from that user forces a database read, loading the new suspended/banned status instantly and preventing unauthorized requests.

---

## 2. Mitigation of ID Enumeration (Information Leakage)

A common vulnerability in resource authorization is returning a `403 Forbidden` when a user attempts to access an ID they do not own. This allows an attacker to crawl URL IDs (e.g., `/api/urls/1`, `/api/urls/2`) and map out which IDs exist in the system based on whether they receive a `403 Forbidden` (exists, but no access) or a `404 Not Found` (does not exist).

### System Design Defense:
* **The "Hiding" Pattern**: In the `requireOwnership` middleware, if a database lookup reveals that the resource belongs to another user, the server returns a `404 Not Found` rather than a `403 Forbidden`.
* **Impact**: To an attacker, the resource appears to not exist, completely neutralizing ID harvesting attacks.

---

## 3. Synchronous vs. Asynchronous Operations for Audit Logging

When an administrative action is executed, it is wrapped by the `auditAdminAction` middleware. 

### Why Audit Logs are Written Synchronously:
Unlike URL click metrics which are written asynchronously using Redis queues (BullMQ) to maintain sub-millisecond response rates, admin audit logs are written **synchronously** to PostgreSQL:
1. **Critical Traceability**: Administrative actions are low-volume but carry high compliance weight (e.g., deleting user accounts, updating subscription parameters). If the background queue fails, audit logs could be lost. Writing them inline with the transaction guarantees consistency.
2. **Transaction Integrity**: If the administrative database write succeeds, the audit log record is committed in the same database lifecycle.

---

## 4. Multi-Tenant Relationship Optimization (Composite Indexing)

To support team workspaces where users share link redirects, invitation validations and permission lookups must be highly optimized.

### Schema Join Design:
The relationship between users and teams is mapped via the `TeamMember` model:

```prisma
model TeamMember {
  id         String       @id @default(uuid())
  team_id    String
  user_id    String
  role       TeamRole     @default(MEMBER)
  status     InviteStatus @default(PENDING)
  
  @@unique([team_id, user_id])
  @@index([user_id])
}
```

### System Performance Rationales:
* **Composite Constraint (`@@unique([team_id, user_id])`)**: Under the hood, PostgreSQL creates a composite unique index on these two columns. During authorization checks, calling `SELECT * WHERE team_id = X AND user_id = Y` runs in `O(1)` lookup complexity.
* **Covering Index (`@@index([user_id])`)**: Speeds up list actions when the client requests "Show all teams this user belongs to".

---

## 5. Security Step-Up Boundary Pattern

For high-sensitivity endpoints (such as deleting an account or editing API security credentials), standard session validation is not enough. An attacker who steals a session cookie or gets access to an open computer could completely compromise the account.

### System Implementation:
* **Boundary Guard**: The backend exposes a `requireStepUpConfirmation` middleware.
* **Mechanism**: The API client must include the user's plaintext password in the request payload. The middleware verifies this password using `bcrypt.compare()` against the database record before letting the request reach the execution controller.
* **Grace Window Policy**: The step-up state is not cached in a session; it must be verified at the exact moment of the sensitive execution transaction to maintain absolute boundary defense.
