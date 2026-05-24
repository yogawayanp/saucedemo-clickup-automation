# SauceDemo ClickUp & MinIO Automation Workflow

This repository contains an automated end-to-end testing workflow using Playwright, ClickUp API integration, and local MinIO evidence storage.

## Features
- **Playwright Test Suite**: Automates browser scenarios on the [SauceDemo](https://www.saucedemo.com/) website.
- **Defect Detection**: Automatically detects bugs (e.g. `BUG-WEB-002` - Last Name field cannot be typed) and captures screenshot and native video evidence.
- **MinIO Evidence Storage**: Uploads screenshot and video files directly to local MinIO bucket (`qa-evidence`) and generates secure presigned URLs valid for 7 days.
- **ClickUp Integration**: Creates or updates defect tasks in ClickUp, embeds presigned evidence URLs in the description, and attaches screenshots directly.
- **Duplicate Prevention**: Checks if the defect task with the specified Bug ID already exists before creating a new task, updating the existing task description instead of creating duplicates.

## Configuration (.env)

Create a `.env` file in the root directory. This file is ignored by Git.

```env
# ClickUp API configuration
CLICKUP_API_TOKEN=your_clickup_personal_api_token
CLICKUP_LIST_ID=your_clickup_list_id

# MinIO evidence storage configuration
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=admin
MINIO_SECRET_KEY=password123
MINIO_BUCKET=qa-evidence
```

## Setup & Run

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Run Playwright test**:
   ```bash
   npx playwright test tests/checkout-clickup.spec.js --project=chromium
   ```
