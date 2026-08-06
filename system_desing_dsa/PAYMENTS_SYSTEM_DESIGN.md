# 🏛️ SnapURL SaaS Billing: System Design & DSA Reference

This document details the system design principles, data structures, and algorithms (DSA) applied to implement a secure, idempotent, and highly performant subscription and coupon validation engine in SnapURL.

---

## 1. Idempotency & Concurrency: Preventing Double-Billing

In financial transaction systems, the most critical failure mode is **Double-Processing** (e.g., charging a user twice, or activating a subscription twice because a webhook event was sent twice).

```
                      Razorpay Webhook Stream
                    ┌─────────────────────────┐
                    │  Captured Event #102    │
                    └────┬───────────────┬────┘
                         │ (Delivery 1)  │ (Delivery 2 - Network Retry)
                         ▼               ▼
                    ┌─────────────────────────┐
                    │    Webhook Controller   │
                    └────┬───────────────┬────┘
                         │               │
      [Acquire Lock]     │               │ [Acquire Lock]
    (lock:102 = SUCCESS) ▼               ▼ (lock:102 = FAILED)
                    ┌──────────┐    ┌──────────┐
                    │ SQL Tx 1 │    │ Rejected │
                    └────┬─────┘    └──────────┘
                         │
                         ▼
                    ┌──────────┐
                    │ Postgres │ (Unique Constraint on event_id)
                    └──────────┘
```

### System Design Mitigations:
1. **Distributed Locks (Redis)**:
   * When a webhook is received, the backend attempts to acquire a lock in Redis using the event ID:
     ```redis
     SET lock:webhook:event_id "1" EX 10 NX
     ```
   * The `NX` parameter ensures the key is only set if it does **not** already exist. The `EX 10` parameter expires the lock in 10 seconds.
   * If a concurrent request attempts to process the same event ID, it fails to acquire the lock and exits instantly.
2. **Unique Database Constraints (PostgreSQL)**:
   * The `WebhookEvent` table enforces a `UNIQUE` constraint on the `event_id` column.
   * Inside a transaction, the server executes `INSERT INTO "WebhookEvent" (event_id)`. If two processes run concurrently, PostgreSQL's index guarantees one will fail with a unique constraint violation, rolling back the transaction.

---

## 2. DSA: Coupon Code Validation Algorithm

Checking whether a discount coupon (e.g., `50OFF`) can be applied to an order requires evaluating multiple constraints.

### The Algorithm:
```
Algorithm ValidateCoupon(couponCode, planKey, userId)
    Input: couponCode (String), planKey (String), userId (String)
    Output: Coupon object or Throw Exception
    
    1. Fetch coupon FROM Database WHERE code = UpperCase(Trim(couponCode))  --> O(1) Index Lookup
    2. If coupon is NULL then
           Throw Exception("Invalid coupon code")
    3. If coupon.is_active is FALSE then
           Throw Exception("Coupon is inactive")
    4. If CurrentTimestamp() < coupon.valid_from OR CurrentTimestamp() > coupon.valid_until then
           Throw Exception("Coupon has expired")
    5. If coupon.max_redemptions IS NOT NULL AND coupon.times_redeemed >= coupon.max_redemptions then
           Throw Exception("Redemption limit reached")
    6. If coupon.applicable_plans IS NOT EMPTY AND planKey NOT IN coupon.applicable_plans then
           Throw Exception("Coupon not applicable to this plan")  --> O(K) Search
    7. Fetch redemption FROM Database WHERE coupon_id = coupon.id AND user_id = userId
    8. If redemption IS NOT NULL then
           Throw Exception("Coupon already redeemed by user")
           
    9. Return coupon
```

### Computational Complexity:
* **Time Complexity**: `O(1)` for database index lookups. Checking `applicable_plans` takes `O(K)` time, where `K` is the number of allowed plans (usually `K < 5`).
* **Space Complexity**: `O(1)` auxiliary space.

---

## 3. System Design: Subscription Expirations & Scale Billing Runs

When a user's subscription expires, their account must be downgraded. Running `SELECT * FROM subscriptions WHERE current_period_end < NOW()` on a single database query does not scale when managing millions of users.

### The Scale Problem:
As the database table grows, full-table scans lock the system, delaying other operations.

### Scale Design Solutions:
1. **B-Tree Database Indexing**:
   * An index is placed on the `current_period_end` column. This changes the lookup time complexity of expired subscriptions from a linear search `O(N)` to a logarithmic search `O(log N)`.
2. **Redis Sorted Sets (ZSET) for Cron Scheduling**:
   * Expiring subscriptions can be pushed to a Redis Sorted Set named `expirations`.
   * **Score**: The expiration timestamp (`current_period_end` converted to epoch seconds).
   * **Value**: The user or subscription ID.
   * **The Worker Poller**: A lightweight cron task runs every minute, executing a `ZRANGEBYSCORE` command:
     ```redis
     ZRANGEBYSCORE expirations -inf <current_epoch_seconds> LIMIT 0 100
     ```
   * **Benefit**: Instantly retrieves only the subscriptions that have expired since the last sweep, processing them in small batches (paging) to prevent database deadlocks.

---

## 4. DSA: Plan Limit Enforcement Caching

To check if a user is authorized to create a new shortened URL (e.g., verifying if they have exceeded their plan's limit of 1,000 URLs), executing a SQL count query on every creation blocks performance:
```sql
SELECT COUNT(*) FROM urls WHERE user_id = userId; -- O(N) database aggregation
```

### Caching Design (Redis Hash Table):
* When a user upgrades or log in, their active limits are cached in Redis under a Hash structure:
  * **Key**: `limits:userId`
  * **Fields**: `max_urls`, `custom_domains_allowed`, `qr_allowed`.
* **Execution flow during link creation**:
  1. The API calls `HGET limits:userId max_urls` (Speed: `O(1)`, Latency: `< 1ms`).
  2. The system checks a Redis Counter tracking the user's active links: `GET url_count:userId`.
  3. If `url_count < max_urls`, the action is permitted and the database is updated.
  4. If user upgrades or changes plan, the backend calls `DEL limits:userId`, forcing the cache to reload from PostgreSQL on the next request.
