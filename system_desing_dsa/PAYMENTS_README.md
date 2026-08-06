# 💳 SnapURL Billing & Subscription Architecture (Razorpay Integration)

This document outlines the system design, transactional data flows, security checks, and webhook processing mechanisms implemented for the billing and SaaS subscription engine in SnapURL.

---

## 🏗️ Architectural Overview

SnapURL implements a **dual-channel confirmation model** to guarantee subscription activation. This ensures that users are upgraded even if they close their browser mid-checkout:
1. **Primary Sync Channel (Client-Side Verification)**: Once checkout is complete, the React frontend submits the Razorpay signatures. The backend verifies this using local HMAC keys and upgrades the user instantly.
2. **Secondary Async Channel (Webhooks)**: Razorpay asynchronously pushes webhook events (e.g. `payment.captured`). The backend catches these, verifies signatures, and applies updates if the client-side call failed (ensures idempotency and resilience).

```
                      ┌──────────────────────┐
                      │  👤 Client Browser   │
                      └──────┬────────────┬──┘
                             │            │
            (Initiate Order) │            │ (Checkout Complete)
                             ▼            ▼
                      ┌──────────┐    ┌─────────────┐
                      │ Backend  │◄───┤  Razorpay   │
                      │   API    │    │   Gateway   │
                      └────┬─────┘    └──────┬──────┘
                           │                 │ (Asynchronous Webhook)
     (Updates status &     │                 │
      clears Redis cache)  ▼                 ▼
                      ┌──────────┐    ┌─────────────┐
                      │ Database │◄───┤   Webhook   │
                      │ (Prisma) │    │  Controller │
                      └──────────┘    └─────────────┘
```

---

## 🔄 Subscription Lifecycle Sequence Flow

The following sequence diagram tracks the entire transactional lifecycle of a user upgrading their plan.

```mermaid
sequenceDiagram
    autonumber
    actor User as 👤 SaaS Customer
    participant React as 🎨 React Frontend (SPA)
    participant Server as ⚡ Express Backend
    participant Redis as 🛑 Redis Cache
    participant Postgres as 🐘 PostgreSQL Database
    participant RP as 💳 Razorpay Gateway

    %% Order Provisioning Stage
    Note over User, Postgres: Phase 1: Order Provisioning & Coupon Validation
    User->>React: Select Business Plan (Monthly) + Apply Coupon "50OFF"
    React->>Server: POST /api/payments/order { planKey: "business", billingCycle: "MONTHLY", couponCode: "50OFF" }
    
    Server->>Postgres: SELECT * FROM "Coupon" WHERE code = '50OFF'
    Postgres-->>Server: Valid coupon row (discount: 50% flat/percent)
    Server->>Server: Verify redemption limits & calculate discounted amount
    
    Server->>RP: Initialize Razorpay Order (amount: Rs. 999 * 50% = 499.50)
    RP-->>Server: Return Razorpay Order ID (order_abc123)
    
    Server->>Postgres: INSERT INTO "Payment" (gateway_order_id = 'order_abc123', status = 'CREATED', amount = 49950)
    Postgres-->>Server: Confirmed saved
    Server-->>React: Return Order metadata + Razorpay public keys

    %% Payment Checkout Stage
    Note over React, RP: Phase 2: Gateway Checkout Interaction
    React->>React: Open Razorpay Checkout Modal
    React->>User: Display payment checkout window (Card/UPI/NetBanking)
    User->>RP: Complete payment verification authorization
    RP-->>React: Return Checkout proofs { razorpay_payment_id, razorpay_order_id, razorpay_signature }

    %% Signature Verification Stage
    Note over React, Redis: Phase 3: Synchronous Signature Verification
    React->>Server: POST /api/payments/verify { razorpay_order_id, razorpay_payment_id, razorpay_signature }
    Server->>Server: Generate local HMAC signature (order_id + "|" + payment_id)
    Server->>Server: Compare local signature with razorpay_signature
    
    alt Signature Matches (Valid Checkout)
        critical Upgrade Subscription Transaction
            Server->>Postgres: UPDATE "Payment" status = 'CAPTURED'
            Server->>Postgres: UPDATE old subscriptions status = 'CANCELED'
            Server->>Postgres: INSERT INTO "Subscription" (plan_id, status = 'ACTIVE', period_end)
        end
        Postgres-->>Server: Transaction Complete
        Server->>Redis: DEL limits:userId (Force reload plan constraints)
        Server->>Redis: SET payment_pending:order_abc123 = 1 EX 180 (Flag webhook bypass)
        Server-->>React: Return 200 OK (Subscription Activated!)
        React->>User: Display "Upgrade Successful!" panel
    else Mismatch Signature (Fraud Attempt)
        Server-->>React: Return 400 Bad Request
    end

    %% Webhook Fallback Stage
    Note over RP, Postgres: Phase 4: Webhook Ingestion (Async Fail-Safe Channel)
    RP->>Server: POST /api/payments/webhook (Header: X-Razorpay-Signature)
    Server->>Server: Validate Webhook Signature using secret key
    Server->>Postgres: SELECT * FROM "WebhookEvent" WHERE event_id = id
    
    alt Event Already Processed (Bypass)
        Server-->>RP: Return 200 OK (Duplicate event skipped)
    else New Event
        Server->>Postgres: INSERT INTO "WebhookEvent" (event_id, status = 'processing')
        Server->>Redis: GET payment_pending:order_abc123
        alt Key Exists (Sync Channel Already Upgraded User)
            Server->>Postgres: UPDATE "WebhookEvent" status = 'completed'
            Server-->>RP: Return 200 OK (Skip DB updates)
        else Key Missing (Client aborted/closed page before verify finished)
            critical Webhook Database Upgrade
                Server->>Postgres: UPDATE "Payment" status = 'CAPTURED'
                Server->>Postgres: INSERT INTO "Subscription" / UPDATE old Canceled
                Server->>Postgres: UPDATE "WebhookEvent" status = 'completed'
            end
            Server->>Redis: DEL limits:userId (Clear limits cache)
            Server-->>RP: Return 200 OK
        end
    end
```

---

## 📊 Stage-by-Stage Billing Data Matrix

Here is who is sending, receiving, storing, and removing data during subscription upgrades.

| Action | Sender | Description | Receiver | Data Transferred | Database / Cache Actions |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Order Create** | React Client | User requests plan upgrade checkout. | Express API | `{ planKey, billingCycle, couponCode }` | `SELECT` plan details; `SELECT` and validate discount Coupon codes. |
| **Provison Order** | Express API | Inits order in gateway. | Razorpay Gateway | `{ amount: value, currency: "INR" }` | None |
| **Save Order** | Express API | Stores transaction record. | PostgreSQL | Order ID, cost details | `INSERT INTO "Payment"` (status: `CREATED`). |
| **Checkout Response** | Razorpay Gateway | Sends payment proofs to page. | React Client | `{ paymentId, orderId, signature }` | None |
| **Verify Payment** | React Client | Submits proofs for verify check. | Express API | `{ razorpay_order_id, razorpay_payment_id, razorpay_signature }` | None |
| **Upgrade Status** | Express API | Activates subscription. | PostgreSQL | Subscription dates, payment status | `UPDATE "Payment"` to `CAPTURED`; `UPDATE` old subs to `CANCELED`; `INSERT` new active `Subscription`. |
| **Cache Reset** | Express API | Resets user plan limits. | Redis Cache | Delete plan limit keys | `DEL limits:userId`; `SET payment_pending:orderId = 1` (Expires in 3m). |
| **Webhook Notify** | Razorpay Gateway | Asynchronous event push. | Express API | Webhook payload body & headers | `INSERT INTO "WebhookEvent"` (tracks event deduplication). |

---

## 🗄️ Database Schemas & Storage Layout

### PostgreSQL Schemas
*   **Payment**: Stores transactional invoices and records.
    *   `gateway_order_id` (Unique index): Identifies transactions in checkouts.
    *   `status`: enum (`CREATED`, `AUTHORIZED`, `CAPTURED`, `FAILED`, `REFUNDED`).
*   **Subscription**: Maps features and plan rights to users.
    *   `status`: enum (`ACTIVE`, `PAST_DUE`, `CANCELED`, `EXPIRED`).
    *   `current_period_end`: Expiration timestamp.
*   **WebhookEvent**: Double-processing (idempotency) guard.
    *   `event_id` (Primary Key): Matches Razorpay webhook event ID.
    *   `processed`: Boolean status.

---

## 📂 Codebase Billing File Mapping

*   **Payment Controller**: [payments.controller.js](file:///c:/Users/prash/OneDrive/Desktop/url_shortner/backend/src/controllers/payments.controller.js) — Houses endpoints for order creations, checkout verification checks, and webhook ingestion.
*   **Subscription Controller**: [subscription.controller.js](file:///c:/Users/prash/OneDrive/Desktop/url_shortner/backend/src/controllers/subscription.controller.js) — Fetches active subscription properties for users.
*   **Limit Enforcement Service**: `planLimitService.js` (Check inside `backend/src/services/planLimitService.js`) — Reads and caches active plan limit properties in Redis.
*   **Models**: [schema.prisma](file:///c:/Users/prash/OneDrive/Desktop/url_shortner/backend/prisma/schema.prisma) — Models payment tables (`Payment`, `Subscription`, `WebhookEvent`, `Plan`, `PlanLimit`).
