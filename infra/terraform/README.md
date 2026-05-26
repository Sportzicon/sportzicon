# Sportivox Terraform — GCP

Provisions every resource required to run Sportivox on GCP:

- Artifact Registry (Docker repo) for the api + web images
- Firestore Native DB with composite indexes
- Two GCS buckets (public media + private docs) with CORS + lifecycle
- Secret Manager entries for JWT secrets, OpenAI, SendGrid, admin bootstrap
- Cloud Run services for api + web with min-instance scaling, probes, env wiring
- Dedicated runtime service account with least-privilege IAM

## Prerequisites

```bash
gcloud auth application-default login
gcloud config set project <YOUR_PROJECT_ID>
```

Make sure billing is enabled on the project — none of the Cloud Run / Firestore
APIs work without it.

## First-time apply

1. Build & push the API and web images to your registry. The first build is
   chicken-and-egg: Terraform creates the registry but you can also `gcloud
   artifacts repositories create` manually if you prefer. Once the images exist,
   reference them in `terraform.tfvars`.

   ```bash
   cd infra/terraform
   cp terraform.tfvars.example terraform.tfvars
   $EDITOR terraform.tfvars
   ```

2. Plan + apply.

   ```bash
   terraform init
   terraform plan
   terraform apply
   ```

3. Capture the outputs (api_url, web_url). Update `terraform.tfvars` so
   `web_app_url` points to the real Cloud Run URL, then re-apply — this corrects
   CORS + email-link generation.

## Cost notes

- Cloud Run: scales to zero. With `min_instances_api = 0` you pay only on traffic.
  Cold starts on Node 20 typically land at ~700ms.
- Firestore: per-document pricing — Phase 1 traffic shouldn't exceed the free
  tier. The composite indexes consume storage proportional to docs indexed.
- GCS: free for the first 5GB / month in standard tier. Lifecycle rules tier
  cold content to Nearline (after 1 year) and Coldline (docs) to keep costs down.
- Secret Manager: $0.06 per active secret version per month. Negligible.

## After apply — required first steps

1. Sign in with `BOOTSTRAP_ADMIN_EMAIL` and **rotate the password immediately**.
2. Verify the admin user's email manually (Firestore console) if no email
   provider is configured yet.
3. Add your custom domain via Cloud Run domain mapping if needed.

## Tearing down

`terraform destroy` will remove every resource. Buckets with `force_destroy =
false` will block destroy if they contain objects — empty them first via
`gsutil rm -r gs://<bucket>/**` if you intend to wipe the environment.
