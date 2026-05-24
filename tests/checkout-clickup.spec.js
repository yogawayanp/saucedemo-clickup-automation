import { test, expect } from '@playwright/test';
import { createDefectTask, uploadAttachment } from '../utils/clickup.js';
import fs from 'fs';
import path from 'path';

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
  environment: 'Chromium Browser / SauceDemo',
  steps: [
    'Login using problem_user',
    'Add item to cart',
    'Open checkout page',
    'Attempt to input Last Name'
  ],
  expected: 'Last Name field accepts input normally.',
  actual: 'Last Name field does not accept input.'
};

/**
 * Formats the current date and time into local YYYY-MM-DD-HH-mm-ss.
 * @returns {string} Formatted local timestamp
 */
function getLocalTimestamp() {
  const now = new Date();
  
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day}-${hours}-${minutes}-${seconds}`;
}

/**
 * Helper function to ensure a file is fully written and stabilized on disk.
 * Validates file existence, non-zero file size, and ensures the file size
 * has finished changing before returning true.
 * @param {string} filePath - Absolute path to the file
 * @param {number} maxRetries - Maximum number of stability checks
 * @param {number} intervalMs - Delay between checks in milliseconds
 */
async function verifyFileStability(filePath, maxRetries = 10, intervalMs = 200) {
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

test('SauceDemo Checkout - Detect Last Name Field Bug and Create ClickUp Defect', async ({ page }) => {
  // 1. Open SauceDemo website
  console.log(`Navigating to ${TEST_URL}...`);
  await page.goto(TEST_URL);

  // 2. Login using problem_user and secret_sauce
  console.log(`Logging in as '${CREDENTIALS.username}'...`);
  await page.locator(SELECTORS.usernameInput).fill(CREDENTIALS.username);
  await page.locator(SELECTORS.passwordInput).fill(CREDENTIALS.password);
  await page.locator(SELECTORS.loginButton).click();

  // Verify login succeeded and inventory is displayed
  await expect(page).toHaveURL(/inventory\.html/);
  console.log('Login successful, inventory page loaded.');

  // 3. Add one product to cart
  console.log('Adding product to cart...');
  await page.locator(SELECTORS.addToCartBackpack).click();

  // 4. Open the cart page
  console.log('Navigating to shopping cart...');
  await page.locator(SELECTORS.shoppingCartLink).click();
  await expect(page).toHaveURL(/cart\.html/);

  // 5. Proceed to checkout
  console.log('Proceeding to Checkout step one...');
  await page.locator(SELECTORS.checkoutButton).click();
  await expect(page).toHaveURL(/checkout-step-one\.html/);

  // 6. Attempt to enter checkout information
  const testFirstName = 'John';
  const testLastName = 'Doe';
  const testPostalCode = '12345';

  console.log('Filling out Checkout Form...');
  await page.locator(SELECTORS.firstNameInput).fill(testFirstName);
  
  // Try to fill Last Name
  const lastNameField = page.locator(SELECTORS.lastNameInput);
  await lastNameField.fill(testLastName);
  
  // Try to fill Zip/Postal Code
  await page.locator(SELECTORS.postalCodeInput).fill(testPostalCode);

  // 7. Verify whether the Last Name field accepted input
  const enteredLastName = await lastNameField.inputValue();
  console.log(`[Form Verification] First Name: '${testFirstName}'`);
  console.log(`[Form Verification] Expected Last Name: '${testLastName}' | Actual Field Value: '${enteredLastName}'`);
  console.log(`[Form Verification] Postal Code: '${testPostalCode}'`);

  const isDefectDetected = enteredLastName !== testLastName;

  if (isDefectDetected) {
    console.error(`DEFECT DETECTED: Last Name field did not accept input! (Expected '${testLastName}', got '${enteredLastName}')`);

    // 8. Capture screenshot evidence automatically with dynamic timestamp filename
    const screenshotsDir = path.resolve('screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
    
    const timestamp = getLocalTimestamp();
    const screenshotFilename = `BUG-WEB-002-${timestamp}.png`;
    const screenshotPath = path.join(screenshotsDir, screenshotFilename);
    
    console.log('Capturing screenshot evidence...');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    
    // Verify screenshot file is fully saved and stable on disk
    console.log(`Verifying screenshot storage stability: ${screenshotPath}`);
    await verifyFileStability(screenshotPath);
    console.log('Screenshot storage verified and stabilized successfully.');

    // 9. Automatically create ClickUp task and upload attachment
    if (process.env.CLICKUP_API_TOKEN && process.env.CLICKUP_LIST_ID) {
      try {
        console.log('Reporting defect to ClickUp API...');
        const taskId = await createDefectTask(BUG_INFO);
        console.log(`ClickUp defect task created successfully. Task ID: ${taskId}`);

        console.log(`Uploading screenshot to ClickUp task ${taskId} as evidence...`);
        await uploadAttachment(taskId, screenshotPath);
        console.log('Screenshot uploaded and attached to ClickUp task successfully.');
      } catch (clickupError) {
        console.error('An error occurred during ClickUp integration:', clickupError.message);
      }
    } else {
      console.warn('ClickUp environment variables are not fully configured in .env. Task creation skipped.');
    }

    // 10. Fail the test indicating the defect was found
    expect(enteredLastName, 'Last Name field should have successfully accepted input').toBe(testLastName);
  } else {
    // If the defect is ever resolved, this assertion ensures the test passes cleanly
    expect(enteredLastName).toBe(testLastName);
  }
});
