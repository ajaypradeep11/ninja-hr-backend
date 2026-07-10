# Backend auto-deploy (Cloud Run)

`deploy.yml` builds the Docker image and deploys to Cloud Run on every push to
`main`. Authentication is keyless via **Workload Identity Federation** — there
are **no GitHub secrets** to manage.

## One-time GCP setup

Run once (needs Owner / IAM-admin on the `ninjahr` project). Safe to re-run —
the `create` steps error harmlessly if the resource already exists.

```bash
# 1. Workload Identity pool + GitHub OIDC provider (restricted to this GitHub org)
gcloud iam workload-identity-pools create github-pool \
  --location=global --project=ninjahr --display-name="GitHub Actions"

gcloud iam workload-identity-pools providers create-oidc github-provider \
  --location=global --workload-identity-pool=github-pool --project=ninjahr \
  --display-name="GitHub OIDC" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" \
  --attribute-condition="assertion.repository_owner=='ajaypradeep11'"

# 2. Deploy service account
gcloud iam service-accounts create github-deployer \
  --project=ninjahr --display-name="GitHub Actions deployer"

# 3. Let ONLY this repo impersonate the deploy SA
gcloud iam service-accounts add-iam-policy-binding \
  github-deployer@ninjahr.iam.gserviceaccount.com --project=ninjahr \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/1004736454481/locations/global/workloadIdentityPools/github-pool/attribute.repository/ajaypradeep11/ninja-hr-backend"

# 4. Deploy permissions
gcloud projects add-iam-policy-binding ninjahr \
  --member="serviceAccount:github-deployer@ninjahr.iam.gserviceaccount.com" \
  --role=roles/run.admin --condition=None
gcloud projects add-iam-policy-binding ninjahr \
  --member="serviceAccount:github-deployer@ninjahr.iam.gserviceaccount.com" \
  --role=roles/artifactregistry.writer --condition=None

# 5. Allow deploying the service to run AS its runtime SA
gcloud iam service-accounts add-iam-policy-binding \
  1004736454481-compute@developer.gserviceaccount.com --project=ninjahr \
  --role=roles/iam.serviceAccountUser \
  --member="serviceAccount:github-deployer@ninjahr.iam.gserviceaccount.com"
```

After this runs once, every push to `main` deploys automatically. Trigger a
manual run any time from the Actions tab (`workflow_dispatch`).

## Frontend

The frontend deploys via **Firebase App Hosting**, not this workflow. Connect
the App Hosting backend `ninja-hr-frontend` to this GitHub repo + `main`
(Firebase Console → App Hosting → backend → Connect to GitHub) so pushes roll
out automatically.
