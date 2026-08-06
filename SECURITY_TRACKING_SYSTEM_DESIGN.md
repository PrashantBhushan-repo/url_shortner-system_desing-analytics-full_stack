# 🏛️ SnapURL Security, Live Tracking & Worker Engines Reference

This document covers the system designs, data structures, algorithms (DSA), and workflows for three core pillars of the SnapURL ecosystem: **Security Hardening Systems**, **Live Telemetry Tracking (WebSockets)**, and the **Background Health Checking Engine**.

---

## 1. Live Click Tracking & WebSocket Clustering

To support real-time dashboards that stream live click analytics without overloading backend API threads, SnapURL implements a **Decoupled WebSocket Pub/Sub Architecture**.

```
             ┌────────────────────────────────────────────────────────┐
             │                🛑 REDIS PUB/SUB SYSTEM                 │
             │                                                        │
             │   Worker publishes to channel: `ws:url:45`             │
             │                                                        │
             │            ┌──────────────────────────────┐            │
             │            │  Redis Pattern Subscription  │            │
             │            │  (Subscribes to `ws:url:*`)  │            │
             │            └──────────────┬───────────────┘            │
             └───────────────────────────┼────────────────────────────┘
                                         │ Broadcasts payload
                                         ▼
                    ┌────────────────────────────────────────┐
                    │      🔌 Node.js WebSocket Cluster      │
                    │   (Socket.io with Redis Adapter)       │
                    └──────┬──────────────────────────┬──────┘
                           │                          │
              Sends to     │                          │ Sends to
              Room: `url:45`                          │ Room: `url:45`
                           ▼                          ▼
                    ┌────────────┐             ┌────────────┐
                    │ Server Node│             │ Server Node│
                    │   Instance │             │   Instance │
                    └─────┬──────┘             └─────┬──────┘
                          │ (WebSocket connection)   │
                          ▼                          ▼
                  ┌──────────────┐           ┌──────────────┐
                  │ Owner Dash A │           │ Owner Dash B │
                  └──────────────┘           └──────────────┘
```

### System Design Architecture:
1. **WebSocket Decoupling**: Background workers write telemetry data to PostgreSQL. Once committed, they publish a small live payload (Country, Device, Timestamp) to the Redis channel `ws:url:${urlId}`.
2. **Headless Pattern Subscriptions**: The WebSocket server subscribes to `ws:url:*` (`redisSub.psubscribe()`). When an event is caught, it maps the channel name to a room ID and publishes only to clients joined to `url:${urlId}`.
3. **Horizontal Clustering (Redis Adapter)**: If the backend scales to multiple containers, Socket.io uses a Redis Adapter (`pubClient` and `subClient` duplicate connections) to sync rooms across instances, ensuring users receive updates regardless of which container they are connected to.

### DSA in WebSockets:
* **Hash Map Lookups**: Sockets are tracked in-memory using an `O(1)` Hash Map indexing socket IDs to socket objects.
* **Sets for Multicasting**: Rooms are represented in memory as Sets containing socket connections. Joining a room runs in `O(1)` time via `Set.add()`, and broadcasting runs in `O(M)` where `M` is the number of active dashboard views in the room.

---

## 2. Platform Security Hardening Subsystems

### A. Forced Administrative Password Rotations
To secure system provisioning, administrative accounts can be restricted using a forced password rotation protocol:
* **Model Flag**: The `User` model contains a `must_change_password` Boolean flag (defaulting to `true` for fresh setups).
* **Gateway Gating**: During sign-in, if the flag is active, the auth token is withheld, and the API returns a forced rotation payload containing a temporary signature: `{ mustChangePassword: true, changePasswordToken }`.
* **Frontend Interceptor**: The React app blocks dashboard entry, rendering the credential rotation panel. The user must submit a strong credential to unlock session generation.

### B. Route Obscurity (Information Leakage Mitigation)
* When validating resource ownership (e.g., checking if a user owns a shortened URL), the middleware checks ownership boundaries:
  ```javascript
  if (url.user_id !== req.user.id && req.user.role !== "ADMIN") {
      return next(new AppError("Url not found", 404)); // Return 404 instead of 403
  }
  ```
* **Design Purpose**: Returning a `404 Not Found` instead of `403 Forbidden` prevents attackers from using ID scanning techniques to harvest valid URL database keys.

### C. Admin Console Step-Up Security
* Sensitive administrative commands require Step-Up Verification where the admin re-enters their password.
* The `requireStepUpConfirmation` middleware hashes the input and compares it against the admin's database hash via `bcrypt.compare()` before allowing access to billing overrides or user suspensions.

---

## 3. Background URL Health Checking Engine

To ensure shortened links do not point to broken or hijacked landing pages, SnapURL runs a periodic, non-blocking **Url Health Checker**.

### System Design Workflow:
1. **Cron Scheduling**: A BullMQ Queue registers a repeating cron job:
   ```javascript
   queue.add("health-check", {}, { repeat: { every: 6 * 60 * 60 * 1000 } }); // Runs every 6 hours
   ```
2. **Non-Blocking Telemetry Sweep**:
   * The background worker wakes up, fetches all URLs in the database, and queries them.
   * **Self-Healing Failure Logic**: The checker runs a `HEAD` request to avoid downloading massive HTML payloads (saving bandwidth). If the endpoint returns a status `< 500` or completes under a **4-second abort signal timeout**, it is marked as `is_alive = true`, and `health_check_failures` is reset to `0`.
   * If the request times out or returns a `5xx` error, `health_check_failures` increments.
3. **Database Write**: Updates the `is_alive`, `health_check_failures`, and `last_checked_at` fields in PostgreSQL.

---

## 📂 Codebase File Mapping

*   **WebSocket Initialization & Auth**: [socket.js](file:///c:/Users/prash/OneDrive/Desktop/url_shortner/backend/src/config/socket.js) — Manages connections, token verification, room joins, and Redis adapter hooks.
*   **Health Checks & Webhook Workers**: [index.js](file:///c:/Users/prash/OneDrive/Desktop/url_shortner/backend/src/worker/index.js) — Contains the `processHealthChecks` worker loop and the Redis channel publish hooks (`ws:url:*`).
*   **Security Middlewares**: [auth.middleware.js](file:///c:/Users/prash/OneDrive/Desktop/url_shortner/backend/src/middlewares/auth.middleware.js) — Implements ownership protection, step-up verifications, and role authorizations.
