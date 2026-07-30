# DevOps checklist and steps

This file documents the basic DevOps setup applied to the repository and the manual steps you need to perform before pushing to GitHub.

Files added:
- `.gitignore` — ignore local secrets, node_modules, build outputs
- `backend/.dockerignore`, `frontend/.dockerignore` — speed up Docker builds
- `.github/workflows/ci-cd.yml` — combined CI and Docker image build/push pipeline
- `.github/workflows/deploy-k8s.yml` — Kubernetes deployment pipeline using rendered manifest images
- `.github/dependabot.yml` — weekly dependency updates

Required GitHub secrets (set in repository Settings → Secrets → Actions):
- `EC2_SSH_KEY` — Private SSH key for the EC2 deployment target
- `EC2_HOST` — Public IP / Hostname of the EC2 instance
- `EC2_USER` — Username for the EC2 instance (e.g. ubuntu)
- `DOCKER_USERNAME` — Docker Hub username
- `DOCKER_PASSWORD` — Docker Hub password / access token
- **Application Environment Secrets** (dynamically applied to Kubernetes):
  - `DB_PASSWORD` — Password for the PostgreSQL database
  - `DATABASE_URL` — Full connection URL for PostgreSQL (referencing `postgres-service`)
  - `REDIS_URL` — Full connection URL for Redis (referencing `redis-service`)
  - `JWT_SECRET` — JWT secret signing key
  - `SMTP_USER` — SMTP email username
  - `SMTP_PASS` — SMTP email password
  - `RAZORPAY_KEY_ID` — Razorpay Key ID
  - `RAZORPAY_KEY_SECRET` — Razorpay Key Secret
  - `RAZORPAY_WEBHOOK_SECRET` — Razorpay Webhook Secret (can be empty)
  - `ADMIN_SEED_EMAIL` — Email for provisioning the default Admin user
  - `ADMIN_SEED_PASSWORD` — Password for provisioning the default Admin user
  - `ADMIN_SEED_NAME` — Name for provisioning the default Admin user

Quick setup steps before pushing:
1. Verify no local secrets are tracked. If an `.env` was previously committed, stop tracking it:
```bash
git rm --cached .env
git commit -m "chore: stop tracking .env"
```
2. Create required GitHub secrets (example using `gh`):
```bash
gh secret set KUBE_CONFIG --body "$(cat ~/.kube/config)"
```
3. Push the repo and open the Actions tab to review runs:
```bash
git add .
git commit -m "chore(ci): add workflows and devops docs"
git push origin main
```

Notes:
- These workflows are templates — adjust scripts and node versions to match your project.
- The deploy workflow expects your manifests to either reference the built image tags or use the `IMAGE_BACKEND/IMAGE_FRONTEND` placeholders.
- For GHCR pushes, you may need to grant `GITHUB_TOKEN` `packages: write` permission in repository settings.
