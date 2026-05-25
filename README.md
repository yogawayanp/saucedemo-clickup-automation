# SauceDemo ClickUp & MinIO Automation Workflow

This repository contains a proof-of-concept QA automation workflow integration designed to streamline defect detection, evidence management, and issue tracking. The project automates browser testing on the [SauceDemo](https://www.saucedemo.com/) website, captures robust evidence upon detecting defects, archives evidence to a MinIO object storage instance, and creates/updates tasks within the ClickUp project management system using API integrations.

## Features

- **Automated SauceDemo Checkout Testing**: Validates the end-to-end checkout pipeline, verifying item additions, cart review, and checkout field forms.
- **Automatic Defect Detection**: Detects input validation defects (specifically targeting the known Last Name field validation bug for `problem_user`).
- **Screenshot Evidence Capture**: Automatically takes high-resolution screenshots immediately upon defect detection to visually document the failure point.
- **Video Evidence Recording**: Captures standard native Playwright video recordings covering the complete testing flow.
- **MinIO Evidence Upload**: Stores evidence files (screenshots and videos) in a dedicated local MinIO object storage bucket.
- **Public URL Generation**: Generates clean public object URLs for direct access to screenshot and video files within the public-configured MinIO bucket.
- **ClickUp Defect Task Creation**: Programmatically communicates with the ClickUp API to generate structured defect tasks containing the test results and evidence links.
- **QA Workflow Automation Proof-of-Concept**: Integrates automated web testing, local object storage, and SaaS defect-tracking platforms into one cohesive, automated pipeline.

## Workflow Architecture

```text
Playwright Automation
        ↓
Defect Detection
        ↓
Screenshot + Video Evidence
        ↓
Upload Evidence to MinIO
        ↓
Generate Public URLs
        ↓
Create ClickUp Defect Task
        ↓
Insert Evidence URLs into ClickUp
```

## Docker & MinIO Setup

Docker is used only to run local MinIO object storage for evidence management.

To pull and start the local MinIO instance via Docker:

1. **Run MinIO Container**:
   Execute the following command to start MinIO with console and API services enabled:
   ```bash
   docker run -d -p 9000:9000 -p 9001:9001 --name minio \
     -e "MINIO_ROOT_USER=your_minio_access_key" \
     -e "MINIO_ROOT_PASSWORD=your_minio_secret_key" \
     minio/minio server /data --console-address ":9001"
   ```

2. **Create Bucket**:
   Navigate to the MinIO Console at `http://localhost:9001` (login with your configured access and secret keys) and create a bucket named `qa-evidence` (matching your `.env` configuration).

3. **Configure Public Access**:
   Configure the `qa-evidence` bucket access policy to public (read-only) in the MinIO Console to allow direct URL downloads for the evidence links.
   
   > [!NOTE]
   > Setting the bucket to public is suitable for local demo evidence simplicity, but using a private bucket with secure presigned URLs is recommended for production-like workflows.

## Video Evidence Management

This integration implements automated native video recording via Playwright to ensure comprehensive visual evidence of test execution:
- **Playwright Native Video Recording**: Automatically configured in the Playwright environment to capture every frame of the session.
- **Full Flow Recording**: Records the entire user journey, starting from the login process until the moment the checkout defect is detected.
- **MinIO Upload**: Once the test completes, the generated video file is renamed using standard QA patterns and programmatically uploaded to the local MinIO storage.
- **Evidence Link Insertion**: The workflow appends the clean, public video URL directly into the generated ClickUp defect task description, enabling reviewers to play back the execution flow in a single click.

## Configuration (.env)

Create a `.env` file in the root directory. This file stores local credentials and API tokens. Ensure that no actual keys or passwords are committed to Git (this file is ignored via `.gitignore`).

```env
# ClickUp API configuration
CLICKUP_API_TOKEN=your_clickup_personal_api_token
CLICKUP_LIST_ID=your_clickup_list_id

# MinIO evidence storage configuration
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=your_minio_access_key
MINIO_SECRET_KEY=your_minio_secret_key
MINIO_BUCKET=qa-evidence
```

## Getting Started & Run

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Run Playwright test**:
   ```bash
   npx playwright test tests/checkout-clickup.spec.js --project=chromium
   ```
