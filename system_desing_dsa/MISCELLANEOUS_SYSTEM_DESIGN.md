# 🏛️ SnapURL DevOps, CI/CD & Database Seeding System Design (Miscellaneous)

This document covers the system designs, configurations, and scripts for the miscellaneous subsystems of SnapURL: **DevOps Containerization**, **Production Orchestration (Kubernetes)**, **CI/CD Automation (GitHub Actions)**, and **Database Seeding/Migrations**.

---

## 1. DevOps & Multi-Stage Dockerization

To optimize deployment speeds and reduce container size in production clusters, SnapURL utilizes **Multi-Stage Docker Builds** for the Node.js backend.

### Dockerfile Design Decisions:
1. **Base Layer Optimization**: Uses `node:20-alpine` as the base image. The Alpine distribution reduces the base OS size from ~1GB to ~100MB, minimizing build times and the vulnerability attack surface.
2. **Multi-Stage Build Pipeline**:
   * **Stage 1 (Builder)**: Installs development dependencies, copies the Prisma schema, and generates the Prisma client client-side wrapper (`prisma generate`).
   * **Stage 2 (Runner)**: Only copies production dependencies (`dependencies` from `package.json`), compiled Prisma client sources, and source code. Development files, linters, and temporary caches are discarded, reducing the final image size by **~70%**.
3. **Caching Layer Utilization**: Steps are ordered logically. `COPY package*.json` and `RUN npm install` are run before copying the application source code. This ensures Docker caches the `node_modules` layer, avoiding package re-downloads during standard code modifications.

---

## 2. Production Orchestration: Kubernetes & Kustomize

SnapURL deploys to Kubernetes clusters using **Kustomize** to overlay configuration values across environments (Development, Staging, Production).

### Infrastructure Component Layout:
*   **Headless Services**: Used for Redis and PostgreSQL cluster connections to reduce network routing hops within the cluster network.
*   **Persistent Volumes (PVC)**: PostgreSQL uses persistent volume claims with `ReadWriteOnce` rules to ensure transactional database states survive container restarts.
*   **InitContainers for Database Sync**:
    *   The Backend API pod contains an `initContainer` running database migrations:
        ```bash
        npx prisma migrate deploy
        ```
    *   **Design Benefit**: Ensures that the database schema is automatically updated before the main application server boots, preventing runtime SQL errors.

---

## 3. CI/CD Zero-Downtime Pipeline Design

The GitHub Actions workflow implements standard CI/CD checks to enforce code quality and deploy container iterations:

```
            Developer Pushes Commit to `main`
                        │
                        ▼
            ┌──────────────────────┐
            │ GitHub Actions Run   │
            └──────────┬───────────┘
                       │
            ┌──────────┴──────────┐
            │ 1. Lint & Unit Test │
            └──────────┬──────────┘
                       │ (Pass)
                       ▼
            ┌──────────────────────┐
            │ 2. Multi-Stage Build │
            │    Docker Image      │
            └──────────┬───────────┘
                       │
                       ▼
            ┌──────────────────────┐
            │ 3. Push Image to     │
            │    GitHub Registry   │ (GHCR)
            └──────────┬───────────┘
                       │
                       ▼
            ┌──────────────────────┐
            │ 4. Rolling Upgrade   │ (Kubernetes)
            │    Zero-Downtime     │
            └──────────────────────┘
```

### Zero-Downtime Rollout Strategy (Kubernetes):
* The deployment manifests specify rolling update rules:
  ```yaml
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  ```
* **Impact**: Kubernetes boots up a new pod containing the updated code first. Only when the new pod passes its `readinessProbe` (health checks) does the cluster terminate the old pod, guaranteeing zero downtime.

---

## 4. Database Seeding & Migration Lifecycles

Database updates are managed by Prisma ORM.

### Seeding Scripts:
*   **`seed.js` (Plan & Limit Configs)**: Provisions standard pricing plans (`free`, `premium`, `business`) and maps them to their respective capacity quotas (`max_urls`, analytics retentions, domain access) in the `PlanLimit` table.
*   **`seedAdmin.js` (Administrative Bootstrapping)**:
    *   Bootstraps the default Administrator account.
    *   Forces password rotation by setting the user's `must_change_password` flag to `true`, securing the console from default credential hacks.

---

## 📂 Codebase DevOps File Map

*   **Dockerfile Configuration**: [Dockerfile](file:///c:/Users/prash/OneDrive/Desktop/url_shortner/backend/Dockerfile) — Multi-stage docker configurations for the API server.
*   **Kubernetes Manifests**: Reference files inside `infrastructure/kubernetes/` namespace configs.
*   **CI/CD Workflow Scripts**: Reference files inside `.github/workflows/` (such as `ci-cd.yml`).
*   **Database Seeding**: Reference files `seed.js` and `seedAdmin.js` inside `backend/prisma/` to review how administrative boundaries and subscription plans are seeded.
