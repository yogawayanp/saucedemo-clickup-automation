# Playwright QA Workflow Integration

This project demonstrates a Playwright-based QA automation workflow integrated with ClickUp and MinIO. When defects are detected, they automatically trigger the creation of a ClickUp defect task populated with screenshot and video evidence URLs. Designed as a proof-of-concept QA workflow, it integrates automated browser testing, local object storage, and SaaS issue tracking to streamline defect reporting.

## Features

- **Automated SauceDemo Checkout Testing**: Validates the end-to-end checkout pipeline, verifying item additions, cart review, and checkout field forms.
- **Last Name field defect detection**: Detects input validation defects (specifically targeting the known Last Name field validation bug for `problem_user`).
- **Automatic screenshot evidence capture**: Automatically takes high-resolution screenshots immediately upon defect detection to visually document the failure point.
- **Full-flow video evidence recording**: Captures native Playwright video recordings covering the complete testing flow.
- **MinIO evidence upload**: Stores evidence files (screenshots and videos) in a dedicated local MinIO object storage bucket.
- **Public MinIO object URL generation**: Generates clean public object URLs for direct access to screenshot and video files within the public-configured MinIO bucket.
- **ClickUp defect task creation**: Programmatically communicates with the ClickUp API to generate structured defect tasks containing the test results and evidence links.
- **Evidence URL insertion into ClickUp task description**: Appends clean evidence URLs directly into the generated ClickUp defect task description for quick access.
- **Docker-based local MinIO service for evidence storage**: Runs a local MinIO service using Docker.
- **Secure configuration using `.env`**: Maintains API tokens, endpoints, and credentials securely via environment variables.

## Workflow Architecture

```text
Playwright Automation
↓
Defect Detected
↓
Screenshot + Video Evidence Captured
↓
Upload Evidence to MinIO
↓
Generate Public Object URLs
↓
Create ClickUp Defect Task
↓
Insert Evidence URLs into ClickUp Description
```

## MinIO Evidence Storage

MinIO is used as local object storage for screenshot and video evidence.
- **Docker Only for Local MinIO**: Docker is used only to run the local MinIO service.
- **Public Bucket Config**: The `qa-evidence` bucket is configured as public for local demo simplicity.
- **Clean Public URLs**: A public URL format is used for cleaner demo evidence links.

### Expected Public URL Examples:
- **Screenshot**: `http://localhost:9000/qa-evidence/screenshots/<screenshot-file-name>.png`
- **Video**: `http://localhost:9000/qa-evidence/videos/<video-file-name>.webm`

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
   Navigate to the MinIO Console at `http://localhost:9001` (login with your configured access and secret keys) and create a bucket named `qa-evidence`.

3. **Configure Public Access**:
   Configure the `qa-evidence` bucket access policy to public (read-only) in the MinIO Console to allow direct URL downloads for the evidence links.

> [!NOTE]
> For this local demo, the MinIO bucket is configured as public to generate simple evidence URLs. For production-like workflows, private buckets with presigned URLs are safer.

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
MINIO_PUBLIC_BASE_URL=http://localhost:9000
```

## Getting Started & Run

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start Docker and Run MinIO**:
   Ensure Docker is running, then run the MinIO container (see command in [MinIO Evidence Storage](#minio-evidence-storage)).

3. **Set Up MinIO Bucket**:
   Log in to the console at `http://localhost:9001`, ensure the bucket `qa-evidence` exists, and configure the bucket access policy to **public**.

4. **Configure Environment Variables**:
   Copy the example environment configuration into a `.env` file and fill in your actual credentials.

5. **Run Playwright test**:
   ```bash
   npx playwright test tests/checkout-clickup.spec.js --project=chromium
   ```

## ClickUp Task Behavior

On every execution where a defect is detected, the automation creates a new ClickUp task. Each task includes:
- **Timestamped Title**: Dynamically generated to identify the run (e.g., `[BUG-WEB-002] Last Name field cannot be typed on checkout form - Run YYYY-MM-DD HH:mm:ss`).
- **Description with Evidence Links**: The task description contains direct, clean evidence URLs for the screenshot and video stored on MinIO, allowing the QA team to immediately inspect the defect.

## Security & Best Practices

- **Never Commit Credentials**: The `.env` file contains sensitive information and should never be committed to source control (ensure it is listed in `.gitignore`).
- **Do Not Hardcode Keys**: Keep all API tokens and secrets in environment variables.
- **Local Demo Simplicity**: A public bucket is used strictly for ease of demonstration in a local or offline sandbox.
- **Production Warning**: For production deployments, do not store sensitive or real customer screenshots/videos in a public bucket. Instead, use private buckets and secure presigned URLs with short expiration periods.
