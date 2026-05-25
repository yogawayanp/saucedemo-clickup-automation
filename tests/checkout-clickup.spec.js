import { test, expect } from '@playwright/test';
import { createDefectTask, uploadAttachment } from '../utils/clickup.js';
import { uploadFile } from '../utils/minio.js';
import fs from 'fs';
import path from 'path';

// Enable Playwright native video recording for this test file
test.use({ video: 'on' });

// Page configuration constants
const TEST_URL = 'https://www.saucedemo.com/';
const CREDENTIALS = {
  username: 'problem_user',
  password: 'secret_sauce'
};

// Stable CSS selectors
const SELECTORS = {
  usernameInput: '[data-test="username"]',
  passwordInput: '[data-test="password"]',
  loginButton: '[data-test="login-button"]',
  addToCartBackpack: '[data-test="add-to-cart-sauce-labs-backpack"]',
  shoppingCartLink: '[data-test="shopping-cart-link"]',
  checkoutButton: '[data-test="checkout"]',
  firstNameInput: '[data-test="firstName"]',
  lastNameInput: '[data-test="lastName"]',
  postalCodeInput: '[data-test="postalCode"]'
};

// Structured bug details for ClickUp task creation
const BUG_INFO = {
  id: 'BUG-WEB-002',
  title: 'Last Name field cannot be typed on checkout form',
  severity: 'High',
  priority: 'High',
  module: 'Checkout',
  environment: 'Chromium Browser / SauceDemo Web App',
  steps: [
    'Login using problem_user',
    'Add item to cart',
    'Open checkout page',
    'Attempt to input Last Name'
  ],
  expected: 'All checkout fields should accept input normally.',
  actual: 'The Last Name field does not accept input for problem_user.'
};

/**
 * Returns clean local timestamps for file naming (safe) and ClickUp task title/desc.
 * @returns {{fileTimestamp: string, runTimestamp: string}} Timestamp strings
 */
function getFormattedTimestamps() {
  const now = new Date();
  
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  // File system safe (no spaces or colons)
  const fileTimestamp = `${year}-${month}-${day}-${hours}-${minutes}-${seconds}`;
  // Human readable format (exactly YYYY-MM-DD HH:mm:ss)
  const runTimestamp = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  
  return { fileTimestamp, runTimestamp };
}

/**
 * Helper function to ensure a file is fully written and stabilized on disk.
 * Validates file existence, non-zero file size, and ensures the file size
 * has finished changing before returning true.
 * @param {string} filePath - Absolute path to the file
 * @param {number} maxRetries - Maximum number of stability checks
 * @param {number} intervalMs - Delay between checks in milliseconds
 */
async function verifyFileStability(filePath, maxRetries = 20, intervalMs = 200) {
  let prevSize = -1;
  
  for (let i = 0; i < maxRetries; i++) {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      const currentSize = stats.size;
      
      if (currentSize > 0 && currentSize === prevSize) {
        return true;
      }
      prevSize = currentSize;
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  
  if (fs.existsSync(filePath) && fs.statSync(filePath).size > 0) {
    return true;
  }
  
  throw new Error(`File at ${filePath} did not stabilize in time or is empty.`);
}

/**
 * Builds a structured defect description including evidence URLs and timestamp.
 * @param {Object} bugInfo - Bug details object
 * @param {string} screenshotUrl - Public MinIO URL for the screenshot
 * @param {string} videoUrl - Public MinIO URL for the video
 * @param {string} timestamp - Automation run timestamp
 * @returns {string} Formatted description
 */
function buildDefectDescription(bugInfo, screenshotUrl, videoUrl, timestamp) {
  return `Bug ID: ${bugInfo.id}
Title: ${bugInfo.title}
Module: ${bugInfo.module}
Severity: ${bugInfo.severity}
Priority: ${bugInfo.priority}
Environment: ${bugInfo.environment}

Steps to Reproduce:
${bugInfo.steps.map((step, idx) => `${idx + 1}. ${step}`).join('\n')}

Expected Result:
${bugInfo.expected}

Actual Result:
${bugInfo.actual}

---
Evidence (auto-generated):

Screenshot Evidence URL:
${screenshotUrl}

Video Evidence URL:
${videoUrl}

Automation Run Timestamp: ${timestamp}`;
}

test('SauceDemo Checkout - Detect Last Name Field Bug and Create ClickUp Defect', async ({ page }) => {
  // Increase timeout to 120s to accommodate MinIO uploads + ClickUp API calls
  test.setTimeout(120000);

  // 1. Open SauceDemo website
  console.log('video recording started');
  console.log(`[Step 1] Navigating to ${TEST_URL}...`);
  await page.goto(TEST_URL);
  await page.waitForTimeout(1000); // Deliberate delay to allow page load in video

  // 2. Login using problem_user and secret_sauce
  console.log('SauceDemo login started');
  console.log(`[Step 2] Logging in as '${CREDENTIALS.username}'...`);
  await page.locator(SELECTORS.usernameInput).fill(CREDENTIALS.username);
  await page.waitForTimeout(500); // Smooth pacing for video
  
  await page.locator(SELECTORS.passwordInput).fill(CREDENTIALS.password);
  await page.waitForTimeout(500); // Smooth pacing for video
  
  await page.locator(SELECTORS.loginButton).click();

  // Verify login succeeded and inventory is displayed
  await expect(page).toHaveURL(/inventory\.html/);
  console.log('[Step 2] Login successful, inventory page loaded.');
  await page.waitForTimeout(1000); // Smooth pacing for video

  // 3. Add one product to cart
  console.log('[Step 3] Adding product to cart...');
  await page.locator(SELECTORS.addToCartBackpack).click();
  console.log('product added to cart');
  await page.waitForTimeout(500); // Smooth pacing for video

  // 4. Open the cart page
  console.log('[Step 4] Navigating to shopping cart...');
  await page.locator(SELECTORS.shoppingCartLink).click();
  await expect(page).toHaveURL(/cart\.html/);
  await page.waitForTimeout(1000); // Smooth pacing for video

  // 5. Proceed to checkout
  console.log('[Step 5] Proceeding to Checkout step one...');
  await page.locator(SELECTORS.checkoutButton).click();
  await expect(page).toHaveURL(/checkout-step-one\.html/);
  console.log('checkout page opened');
  await page.waitForTimeout(1000); // Smooth pacing for video

  // 6. Attempt to enter checkout information
  const testFirstName = 'John';
  const testLastName = 'Doe';
  const testPostalCode = '12345';

  console.log('[Step 6] Filling out Checkout Form...');
  await page.locator(SELECTORS.firstNameInput).fill(testFirstName);
  await page.waitForTimeout(500); // Smooth pacing for video
  
  // Try to fill Last Name
  const lastNameField = page.locator(SELECTORS.lastNameInput);
  await lastNameField.fill(testLastName);
  await page.waitForTimeout(500); // Smooth pacing for video
  
  // Try to fill Zip/Postal Code
  await page.locator(SELECTORS.postalCodeInput).fill(testPostalCode);
  await page.waitForTimeout(1000); // Let the form state linger for visual capture

  // 7. Verify whether the Last Name field accepted input
  const enteredLastName = await lastNameField.inputValue();
  console.log(`[Step 7] [Form Verification] First Name: '${testFirstName}'`);
  console.log(`[Step 7] [Form Verification] Expected Last Name: '${testLastName}' | Actual Field Value: '${enteredLastName}'`);
  console.log(`[Step 7] [Form Verification] Postal Code: '${testPostalCode}'`);

  const isDefectDetected = enteredLastName !== testLastName;

  if (isDefectDetected) {
    console.log('Last Name issue detected');
    console.error(`[DEFECT DETECTED] Last Name field did not accept input! (Expected '${testLastName}', got '${enteredLastName}')`);

    // Let the defect sit on screen for a moment to ensure it is clearly shown in video
    await page.waitForTimeout(1500);

    // --- Evidence Collection ---
    const { fileTimestamp, runTimestamp } = getFormattedTimestamps();
    const screenshotsDir = path.resolve('screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    // 8. Capture screenshot evidence
    const screenshotFilename = `BUG-WEB-002-${fileTimestamp}.png`;
    const screenshotPath = path.join(screenshotsDir, screenshotFilename);
    
    console.log('[Step 8] Capturing screenshot evidence...');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    
    console.log('[Step 8] Verifying screenshot storage stability...');
    await verifyFileStability(screenshotPath);
    console.log('screenshot saved');

    // 9. Save Playwright video evidence
    console.log('[Step 9] Saving Playwright video evidence...');
    const videoFilename = `BUG-WEB-002-${fileTimestamp}.webm`;
    const videoPath = path.join(screenshotsDir, videoFilename);

    // Get the video reference before closing the context
    const videoObj = page.video();
    
    // Close the browser context to finish recording and save the video file
    await page.context().close();
    
    if (videoObj) {
      await videoObj.saveAs(videoPath);
      console.log('[Step 9] Verifying video file stability...');
      await verifyFileStability(videoPath, 20, 500);
      console.log('video saved');
    } else {
      console.warn('[Step 9] ⚠️ Playwright native video recording is not available.');
    }

    // --- MinIO Upload & ClickUp Integration ---
    const hasClickUpEnv = process.env.CLICKUP_API_TOKEN && process.env.CLICKUP_LIST_ID;
    const hasMinioEnv = process.env.MINIO_ENDPOINT && process.env.MINIO_ACCESS_KEY && process.env.MINIO_BUCKET;

    let screenshotUrl = 'N/A (MinIO not configured)';
    let videoUrl = 'N/A (MinIO not configured)';

    // 10. Upload evidence to MinIO
    if (hasMinioEnv) {
      try {
        console.log('[Step 10] Uploading screenshot to MinIO...');
        const screenshotResult = await uploadFile(`screenshots/${screenshotFilename}`, screenshotPath);
        screenshotUrl = screenshotResult.publicUrl;
        console.log('screenshot uploaded to MinIO');
        console.log('public screenshot URL generated');

        console.log('[Step 10] Uploading video to MinIO...');
        const videoResult = await uploadFile(`videos/${videoFilename}`, videoPath);
        videoUrl = videoResult.publicUrl;
        console.log('video uploaded to MinIO');
        console.log('public video URL generated');
      } catch (minioError) {
        console.error('[Step 10] ❌ MinIO upload error:', minioError.message);
      }
    } else {
      console.warn('[Step 10] ⚠️ MinIO environment variables are not configured. Upload skipped.');
    }

    // 11. Create a new ClickUp defect task for EVERY run
    if (hasClickUpEnv) {
      try {
        // Build the full defect description with evidence URLs and unique timestamp
        const defectDescription = buildDefectDescription(BUG_INFO, screenshotUrl, videoUrl, runTimestamp);

        // Always create a new task name incorporating the unique run timestamp
        const taskTitle = `[BUG-WEB-002] Last Name field cannot be typed on checkout form - Run ${runTimestamp}`;

        console.log(`[Step 11] Creating new ClickUp defect task for Run: ${runTimestamp}...`);
        const taskId = await createDefectTask(BUG_INFO, defectDescription, taskTitle);
        console.log('ClickUp task created');

        // Upload screenshot as direct attachment to the newly created ClickUp task
        try {
          console.log(`[Step 11] Uploading screenshot as attachment to ClickUp task ${taskId}...`);
          await uploadAttachment(taskId, screenshotPath);
          console.log('[Step 11] ✅ Screenshot attached to ClickUp task successfully.');
        } catch (attachError) {
          console.error('[Step 11] ❌ Screenshot attachment error:', attachError.message);
        }

      } catch (clickupError) {
        console.error('[Step 11] ❌ ClickUp integration error:', clickupError.message);
      }
    } else {
      console.warn('[Step 11] ⚠️ ClickUp environment variables are not configured. Task creation skipped.');
    }

    // 12. Fail the test indicating the defect was found
    expect(enteredLastName, 'Last Name field should have successfully accepted input').toBe(testLastName);
  } else {
    // If the defect is ever resolved, this assertion ensures the test passes cleanly
    expect(enteredLastName).toBe(testLastName);
  }
});
