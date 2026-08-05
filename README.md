# 🔗 SnapURL — Enterprise-Grade SaaS URL Shortener & Real-Time Analytics

[![Node.js](https://img.shields.io/badge/Node.js-v20+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-v18-20232A?logo=react&logoColor=61DAFB)](https://react.dev/)
[![Docker](https://img.shields.io/badge/Docker-Supported-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-Orchestrated-326CE5?logo=kubernetes&logoColor=white)](https://kubernetes.io/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Redis](https://img.shields.io/badge/Redis-Cache-DC382D?logo=redis&logoColor=white)](https://redis.io/)

SnapURL is a modern, high-performance, enterprise-ready Software-as-a-Service (SaaS) URL shortener designed to support low-latency link redirection, real-time geolocation analytics, multi-tenant team workspaces, custom domains, and integrated subscription billing. 

Built with scalability, security, and developer experience in mind, this project represents an industry-standard implementation of a distributed, microservices-style full-stack application.

---

## 🏗️ System Architecture

SnapURL uses a decoupled, event-driven architecture designed to keep the redirect event loop highly optimized while offloading heavy processes (like telemetry, logging, and notifications) to background queues.

```mermaid
graph TD
    User([🌐 Web Client / User])
    Ingress[🛰️ Nginx Ingress Controller]
    Frontend[🎨 Vite React Frontend / Nginx]
    Backend[⚡ Express.js API Cluster]
    Redis[🛑 Redis Cache & Rate Limiting]
    Queue[(🪵 BullMQ Message Queue)]
    Worker[⚙️ Background Queue Worker]
    Postgres[(🐘 PostgreSQL Database / Prisma)]
    GeoIP[🌍 Geolocation & UA Parsers]
    Razorpay[💳 Razorpay Payment Gateway]

    User -->|Access UI| Ingress
    User -->|Click Shortlink| Ingress
    Ingress -->|Route UI Requests| Frontend
    Ingress -->|Route API & Redirects| Backend

    Backend -->|1. Cache Lookup / Fast Redirect| Redis
    Backend -->|2. Log Click Event asynchronously| Queue
    Backend -->|Write / Fetch Relational Data| Postgres
    
    Queue -->|Process Clicks| Worker
    Worker -->|Fetch metadata| GeoIP
    Worker -->|Aggregate & Batch Save| Postgres
    Worker -->|Broadcast UI Changes| Redis

    Backend -->|Webhooks & Billing| Razorpay
```

---

## ⚡ Technical Highlights & Rationale

*   **Sub-Millisecond Redirect Routing:** Redirect requests (`/r/:shortCode`) bypass complex database operations. The API checks **Redis** first. If cached, it issues a `302 Redirect` immediately; if not, it queries PostgreSQL, caches the result, and redirects.
*   **Asynchronous Click Telemetry (BullMQ):** Instead of stalling requests during write operations, every link click pushes an event to a **Redis-backed BullMQ queue**. Dedicated **Worker Processes** consume these jobs, perform IP Geolocation (`geoip-lite`) and User-Agent parsing (`ua-parser-js`), and batch-save analytics.
*   **Real-Time Data Streaming:** Real-time dashboards are powered by **Socket.io** utilizing a **Redis Adapter**, enabling horizontal scaling of WebSocket connections across multiple backend containers.
*   **Multi-Tenant Teams & Custom Domains:** Complete multi-user collaboration workflow including organization ownership, role management (`OWNER`, `ADMIN`, `MEMBER`), invitations, and support for mapping custom CNAMES.
*   **Secure Authentication & Identity Verification:** Enterprise-grade security containing rotated **JWT sessions** inside HTTP-only cookies, password hashing with **Bcrypt**, One-Time Password **2FA (TOTP)** verification, schema validation via **Zod**, and automated **Audit Logging**.
*   **Commercial SaaS Core:** Full integration with **Razorpay Subscriptions**, webhook idempotency handlers, custom coupon/redemption workflows, and fine-grained feature toggles linked to active subscription plans.

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React, Vite, ES6 modules | Single-Page Application (SPA) dashboard & widgets |
| **Backend** | Node.js, Express.js | Core API and lightning-fast redirect controllers |
| **Database** | PostgreSQL | Relational transactional database (users, teams, URLs, logs) |
| **ORM** | Prisma | Type-safe schema definitions, database migrations, and queries |
| **Caching / Broker** | Redis | Caching, session management, rate-limiting, and queues |
| **Background Queues** | BullMQ | Distributed background jobs and task runner |
| **Payments** | Razorpay SDK & Webhooks | Multi-tier billing, checkouts, and subscription lifecycle |
| **Containerization** | Docker, Docker-compose | Virtualization and environment parity |
| **Orchestration** | Kubernetes, Kustomize | Scalable cluster deployments with ingress routers |
| **CI/CD** | GitHub Actions | Automated linting, docker building (GHCR), and cloud delivery |

---

## 🗄️ Database Schema Overview

SnapURL uses a relational schema optimized with indexes for query speeds. Click records are structured for fast aggregations, and subscriptions bind features directly to users.

*   `User` & `RefreshToken`: Manages multi-device login sessions, TOTP/2FA settings (`twoFactorSecret`), role configurations, and billing credentials.
*   `Url` & `Click`: Links short codes to target destinations. Relies on indexes for `short_code` lookup speed. Contains extensive browser/device/geographic telemetry fields.
*   `UrlStatsHourly` & `UrlStatsDaily`: Aggregated tables updated asynchronously to prevent heavy analytical query overhead on the live click log.
*   `Plan` & `PlanLimit`: Decouples business pricing from functional limits (e.g., maximum links allowed, webhooks permitted, custom domain authorization).
*   `Team` & `TeamMember`: Manages tenant workspaces and shared link configuration access.
*   `Payment` & `WebhookEvent`: Supports idempotent processing of transactions and billing webhooks (preventing double captures/activations).

---

## 🚀 Local Quickstart (Docker Compose)

The easiest way to spin up the entire application ecosystem locally is using Docker Compose.

### Prerequisites
- [Docker & Docker Compose](https://www.docker.com/get-started/)
- Node.js v20 (optional, for local development outside Docker)

### Steps

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/your-username/snapurl.git
   cd snapurl
   ```

2. **Configure Environment Variables:**
   Create a `.env` file in the `./backend/` directory using `./backend/.env.example` as a template. Make sure to define:
   ```env
   PORT=5000
   DATABASE_URL="postgresql://postgres:postgres_password@postgres:5432/url_shortener?schema=public"
   REDIS_URL="redis://redis:6379"
   JWT_SECRET="generate-a-secure-secret-key"
   CLIENT_URL="http://localhost:5173"
   ```

3. **Spin up Services:**
   Run the following command to start PostgreSQL, Redis, the Express Backend API, the background worker, and the React Frontend:
   ```bash
   docker-compose up --build
   ```

4. **Verify Database Seeding:**
   The database container runs migrations and seats initial plans automatically during startup.
   - Frontend runs on: `http://localhost:5173`
   - Backend API runs on: `http://localhost:5000`

---

## ☸️ Production Deployment (Kubernetes)

SnapURL is configured for Kubernetes deployments via **Kustomize**. Complete deployment manifests are stored inside the `infrastructure/kubernetes` directory.

### Manifest Configurations Includes:
- **`namespace.yaml`:** Isolated environment resource context (`snapurl`).
- **`postgres-deployment.yaml` & `postgres-service.yaml`:** State persistence configuration via PVCs.
- **`redis-deployment.yaml` & `redis-service.yaml`:** Internal headless service config for caching and job queuing.
- **`backend-deployment.yaml` & `worker-deployment.yaml`:** Clustered REST API configurations with dynamic Prisma migration `initContainers` and independent task workers.
- **`frontend-deployment.yaml`:** Serves the built Vite assets using a high-performance Nginx container.
- **`ingress.yaml`:** Ingress controller rule mappings for `snapurl.local` and API routing.

### To Deploy Manually:
```bash
# 1. Select your Kubernetes context
kubectl config current-context

# 2. Bind secrets securely in your cluster namespace
kubectl create secret generic snapurl-secrets -n snapurl \
  --from-literal=DB_PASSWORD="your-secure-password" \
  --from-literal=DATABASE_URL="postgresql://postgres:your-secure-password@postgres-service:5432/url_shortener?schema=public" \
  --from-literal=REDIS_URL="redis://redis-service:6379" \
  --from-literal=JWT_SECRET="your-jwt-signing-secret"

# 3. Apply manifests using Kustomization
kubectl apply -k infrastructure/kubernetes/
```

---

## 🛠️ CI/CD Workflow (GitHub Actions)

SnapURL uses continuous integration and delivery pipelines defined in `.github/workflows/`:
1.  **Continuous Integration (`ci-cd.yml`):** Automatically triggers on pushes to `main`. It lints both directories, executes unit checks, builds optimized production Docker images, and pushes them to GitHub Container Registry (GHCR) with standard hash tags.
2.  **Continuous Deployment (`deploy-k8s.yml`):** Connects to the host target, updates the deployment manifest image hashes, creates namespace structures, updates environment configurations, and does rolling upgrades with zero-downtime.

---

## 🔗 Key API Endpoints (Core List)

| Method | Route | Auth | Description |
| :--- | :--- | :--- | :--- |
| **GET** | `/health` | None | API Service Status check |
| **GET** | `/r/:shortCode` | None | Quick Redirection Service (Cached) |
| **POST** | `/api/auth/register` | None | User Account creation |
| **POST** | `/api/auth/login` | None | Credentials authentication |
| **POST** | `/api/urls` | Active | Shorten a single destination URL (Rate Limited) |
| **POST** | `/api/urls/bulk` | Active | Create bulk shortened URLs (Enterprise feature) |
| **GET** | `/api/urls/:shortCode/qr` | Active | Generate/fetch dynamic URL QR Code |
| **GET** | `/api/analytics/dashboard`| Active | Fetch click stats aggregated daily/hourly |
| **POST** | `/api/payments/webhook` | Webhook | Razorpay Instant Payment IPN Handler |

---

## 📄 License
This project is licensed under the ISC License. See the [LICENSE](LICENSE) file for details.
