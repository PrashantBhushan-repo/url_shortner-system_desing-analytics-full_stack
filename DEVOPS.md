# DevOps checklist and steps

This file documents the basic DevOps setup applied to the repository and the manual steps you need to perform before pushing to GitHub.

Files added:
- `.gitignore` — ignore local secrets, node_modules, build outputs
- `backend/.dockerignore`, `frontend/.dockerignore` — speed up Docker builds
- `.github/workflows/ci.yml` — CI: lint, test, build backend and frontend
- `.github/workflows/docker-build.yml` — builds and pushes Docker images to GHCR
- `.github/workflows/deploy-k8s.yml` — deploys `infrastructure/kubernetes` manifests to a cluster
- `.github/dependabot.yml` — weekly dependency updates

Required GitHub secrets (set in repository Settings → Secrets → Actions):
- `KUBE_CONFIG` — full kubeconfig YAML (if using deploy workflow)
- `GHCR_TOKEN` or use default `GITHUB_TOKEN` (ensure package: write permission enabled for `GITHUB_TOKEN`)

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
