# check-reviewer-no-commit

A GitHub App built with [Probot](https://github.com/probot/probot) that enforces a simple rule:

> **A person who committed to a pull request cannot also approve it.**

This prevents self-approvals and ensures meaningful code review by requiring that approvals only come from non-committers.

## How it works

On every PR event (push, review submitted/dismissed), the app:

1. Fetches all **committers** on the PR branch
2. Fetches all current **approvals** on the PR
3. Creates a **Check Run** (`review-integrity`) that:
   - **Fails** if any current approver is also a committer
   - **Passes** otherwise

### Scenarios

| Scenario | Result |
|----------|--------|
| User A commits, User B approves | Pass |
| User A commits, User A approves | Fail |
| User A commits, User B approves, then User B commits | Fail (B is now a committer) |
| User A and B commit, User C approves | Pass |

## Setup

### Option A: Standalone Probot server (recommended)

1. [Register a GitHub App](https://probot.github.io/docs/development/#configuring-a-github-app) with the permissions/events listed in `app.yml`
2. Copy `.env.example` to `.env` and fill in `APP_ID`, `WEBHOOK_SECRET`, and `PRIVATE_KEY_PATH`
3. Install and run:

```bash
npm install
npm run build
npm start
```

4. For local development with webhook forwarding:

```bash
npx smee -u https://smee.io/YOUR_CHANNEL -t http://localhost:3000/api/github/webhooks
npm run dev
```

### Option A.1: Docker

Build and run the same Probot server as a container:

```bash
# Build
docker build -t check-reviewer-no-commit .

# Run
docker run -d \
  -p 3000:3000 \
  -e APP_ID=123456 \
  -e WEBHOOK_SECRET=your-secret \
  -e PRIVATE_KEY="$(cat your-app.private-key.pem)" \
  --name check-reviewer-no-commit \
  check-reviewer-no-commit
```

### Option A.2: Helm (Kubernetes)

A Helm chart is provided in `helm/check-reviewer-no-commit/`.

**Quick install with inline credentials:**

```bash
helm install check-reviewer-no-commit ./helm/check-reviewer-no-commit \
  --set app.appId=123456 \
  --set app.webhookSecret=your-secret \
  --set-file app.privateKey=your-app.private-key.pem
```

**Using an existing Kubernetes secret:**

```bash
# Create the secret yourself
kubectl create secret generic my-github-app \
  --from-literal=APP_ID=123456 \
  --from-literal=WEBHOOK_SECRET=your-secret \
  --from-file=PRIVATE_KEY=your-app.private-key.pem

# Install the chart referencing it
helm install check-reviewer-no-commit ./helm/check-reviewer-no-commit \
  --set app.existingSecret=my-github-app
```

**With ingress (e.g. nginx + cert-manager):**

```bash
helm install check-reviewer-no-commit ./helm/check-reviewer-no-commit \
  --set app.existingSecret=my-github-app \
  --set ingress.enabled=true \
  --set ingress.className=nginx \
  --set ingress.hosts[0].host=check-reviewer.example.com \
  --set ingress.hosts[0].paths[0].path=/ \
  --set ingress.hosts[0].paths[0].pathType=Prefix \
  --set ingress.tls[0].secretName=check-reviewer-tls \
  --set ingress.tls[0].hosts[0]=check-reviewer.example.com \
  --set ingress.annotations."cert-manager\.io/cluster-issuer"=letsencrypt-prod
```

Use the ingress host URL + `/api/github/webhooks` as the **Webhook URL** in your GitHub App settings.

See `helm/check-reviewer-no-commit/values.yaml` for all configurable values.

### Option B: GitHub Actions

If you prefer not to run a server, the included `.github/workflows/review-integrity.yml` runs the same logic as a GitHub Actions workflow.

1. Copy this repo (or just the workflow + source) into your target repository
2. The workflow triggers on `pull_request` and `pull_request_review` events
3. No additional secrets needed — it uses `GITHUB_TOKEN`

### Making the check mandatory

In your repository settings:

1. Go to **Settings → Branches → Branch protection rules**
2. Edit the rule for your default branch (e.g. `main`)
3. Enable **Require status checks to pass before merging**
4. Search for and add `review-integrity`

## Permissions required

| Permission | Access | Reason |
|------------|--------|--------|
| Checks | Write | Create and update check runs |
| Pull requests | Read | List reviews |
| Contents | Read | List commits |
| Metadata | Read | Required by GitHub |

## Events subscribed

- `pull_request` (opened, reopened, synchronize)
- `pull_request_review` (submitted, edited, dismissed)
- `check_suite` (requested, rerequested)
- `check_run` (rerequested)

## License

ISC
