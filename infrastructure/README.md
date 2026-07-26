# SnapURL DevOps & Kubernetes Infrastructure

This directory contains the Kubernetes manifests and orchestration configuration for deploying SnapURL in a production or local cluster environment.

## Directory Structure

```
infrastructure/
├── kubernetes/
│   ├── namespace.yaml             # Dedicated namespace 'snapurl'
│   ├── configmap.yaml             # Non-sensitive app config variables
│   ├── secrets.yaml               # Database credentials, API secrets, JWT key
│   ├── postgres-pvc.yaml          # PostgreSQL persistent volume claim
│   ├── postgres-deployment.yaml   # PostgreSQL DB pod definition
│   ├── postgres-service.yaml      # Internal headless service for PostgreSQL
│   ├── redis-deployment.yaml      # Redis cache/rate-limiter pod
│   ├── redis-service.yaml         # Internal service for Redis
│   ├── backend-deployment.yaml    # Node/Express API with DB migration initContainer
│   ├── backend-service.yaml       # Internal service for backend API
│   ├── worker-deployment.yaml     # Queue consumer worker service
│   ├── frontend-deployment.yaml   # Vite React application served by Nginx
│   ├── frontend-service.yaml      # Internal service for frontend Nginx
│   ├── ingress.yaml               # Ingress routing rules for domains
│   └── kustomization.yaml         # Orchestration file to apply all resources
└── README.md                      # This documentation
```

---

## 1. Setup Container Registry & Build Images

First, replace the placeholder registry `ghcr.io/your-username` in the following files with your container registry path (e.g. Docker Hub `username/` or GHCR `ghcr.io/username/`):
- `kubernetes/backend-deployment.yaml`
- `kubernetes/worker-deployment.yaml`
- `kubernetes/frontend-deployment.yaml`

### CI/CD (GitHub Actions)
The CI/CD pipeline in `.github/workflows/ci-cd.yml` automatically triggers on push to the `main` branch. It will lint, build, and push your images to GitHub Container Registry (GHCR).

### Manual Build & Push
To build and push manually:

```bash
# Build & Push Backend/Worker Image
docker build -t <registry>/snapurl-backend:latest ./backend
docker push <registry>/snapurl-backend:latest

# Build & Push Frontend Image
# Note: Pass the external API endpoint VITE_API_URL so frontend can contact backend
docker build -t <registry>/snapurl-frontend:latest --build-arg VITE_API_URL=http://api.snapurl.local/api ./frontend
docker push <registry>/snapurl-frontend:latest
```

---

## 2. Cluster Deployment (using Kustomize)

Ensure you are logged into your Kubernetes context (`kubectl config current-context`).

### Step A: Apply Config & Secret
Open `kubernetes/secrets.yaml` and configure your API keys (Razorpay, SMTP, etc.).
Then apply the manifests with:

```bash
# Apply all resources defined in Kustomization (namespace, configs, databases, deployments, ingress)
kubectl apply -k infrastructure/kubernetes/
```

### Step B: Check Pod Status
Verify all components start up successfully:

```bash
# Monitor deployment status in snapurl namespace
kubectl get pods -n snapurl -w
```

*Note: The `backend` container will wait for the `db-migration-and-seed` initContainer to finish running Prisma migrations and seeding before the API becomes ready.*

---

## 3. Exposing & Accessing the App (Local Testing)

The ingress is configured to route traffic to:
1. **Frontend**: `http://snapurl.local`
2. **Backend API**: `http://api.snapurl.local`

To access these domains locally:

### Step A: Update Hosts File
Add the following line to your machine's hosts file (`C:\Windows\System32\drivers\etc\hosts` on Windows or `/etc/hosts` on macOS/Linux):

```text
127.0.0.1   snapurl.local api.snapurl.local
```
*(Replace `127.0.0.1` with the IP of your cluster ingress controller if running on a remote cluster, or minikube IP).*

### Step B: Enable Ingress Controller
If using **Minikube**, enable the ingress addon:
```bash
minikube addons enable ingress
# Start tunnel if on macOS/Windows:
minikube tunnel
```
If using **Docker Desktop**, install the Nginx Ingress controller:
```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/cloud/deploy.yaml
```

Now you can visit `http://snapurl.local` in your browser to interact with the URL Shortener!
