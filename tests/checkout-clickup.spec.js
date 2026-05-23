import { test, expect } from '@playwright/test';
import clickup from '../utils/clickup.js';
import fs from 'fs';
import path from 'path';

test('SauceDemo Checkout - Detect Last Name Field Bug and Create ClickUp Defect', async ({ page }) => {
  // 1. Open SauceDemo website
  console.log('Navigating to SauceDemo...');
  await page.goto('https://www.saucedemo.com/');

  // 2. Login using problem_user and secret_sauce
  console.log('Logging in as problem_user...');
  await page.locator('[data-test="username"]').fill('problem_user');
  await page.locator('[data-test="password"]').fill('secret_sauce');
  await page.locator('[data-test="login-button"]').click();

  // Verify successful login
  await expect(page).toHaveURL(/inventory\.html/);
  console.log('Login successful, navigated to inventory.');

  // 3. Add one product to cart (Sauce Labs Backpack)
  console.log('Adding Sauce Labs Backpack to cart...');
  await page.locator('[data-test="add-to-cart-sauce-labs-backpack"]').click();

  // 4. Open the cart page
  console.log('Navigating to Cart...');
  await page.locator('[data-test="shopping-cart-link"]').click();
  await expect(page).toHaveURL(/cart\.html/);

  // 5. Click Checkout
  console.log('Proceeding to Checkout...');
  await page.locator('[data-test="checkout"]').click();
  await expect(page).toHaveURL(/checkout-step-one\.html/);

  // 6. On checkout step one page, try to fill fields
  const firstName = 'John';
  const lastName = 'Doe';
  const postalCode = '12345';

  console.log('Filling checkout form...');
  await page.locator('[data-test="firstName"]').fill(firstName);
  
  // Try to fill Last Name
  const lastNameInput = page.locator('[data-test="lastName"]');
  await lastNameInput.fill(lastName);
  
  // Try to fill Zip/Postal Code
  await page.locator('[data-test="postalCode"]').fill(postalCode);

  // 7. Verify whether the Last Name field value was actually entered
  const enteredLastName = await lastNameInput.inputValue();
  console.log(`First Name filled: ${firstName}`);
  console.log(`Last Name filled: ${lastName}, actual value in field: "${enteredLastName}"`);
  console.log(`Zip Code filled: ${postalCode}`);

  const isDefectDetected = enteredLastName !== lastName;

  if (isDefectDetected) {
    console.error('DEFECT DETECTED: Last Name field did not accept input!');

    // 8. Capture screenshot automatically
    const screenshotsDir = path.resolve('screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
    const screenshotPath = path.join(screenshotsDir, 'BUG-WEB-002-last-name-field-issue.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Screenshot saved to: ${screenshotPath}`);

    // ClickUp Task Details
    const bugDetails = {
      id: 'BUG-WEB-002',
      title: 'Last Name field cannot be typed on checkout form',
      module: 'Checkout',
      severity: 'High',
      priority: 'High',
      environment: 'Chrome Browser, SauceDemo Web App',
      steps: [
        'Open SauceDemo.',
        'Login using problem_user.',
        'Add one product to cart.',
        'Open cart.',
        'Click Checkout.',
        'Enter First Name.',
        'Try to enter Last Name.',
        'Enter Zip/Postal Code.'
      ],
      expected: 'User should be able to enter a valid last name in the Last Name field.',
      actual: 'The Last Name field does not accept input.',
      observed: 'First Name and Zip/Postal Code fields accept input normally, but the Last Name field does not.'
    };

    // Integrate with ClickUp if environment variables are set
    if (process.env.CLICKUP_API_TOKEN && process.env.CLICKUP_LIST_ID) {
      try {
        console.log('Reporting defect to ClickUp...');
        const taskId = await clickup.createDefectTask(bugDetails);
        console.log(`ClickUp task created successfully with ID: ${taskId}`);

        console.log('Uploading screenshot to ClickUp as attachment...');
        await clickup.uploadAttachment(taskId, screenshotPath);
        console.log('Screenshot attached to ClickUp task successfully.');
      } catch (apiError) {
        console.error('Error occurred while integrating with ClickUp:', apiError.message);
      }
    } else {
      console.warn('ClickUp environment variables are not fully configured in the environment. Defect task creation skipped.');
    }

    // Fail the test indicating the defect was found
    expect(enteredLastName, 'Last Name field should accept the entered value').toBe(lastName);
  } else {
    // Assert that the last name equals what we filled (this will pass if the bug is ever fixed)
    expect(enteredLastName).toBe(lastName);
  }
});
