import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN;
const CLICKUP_LIST_ID = process.env.CLICKUP_LIST_ID;

/**
 * Validates that the required ClickUp environment variables are set.
 * Throws a safe error if any required variables are missing.
 */
function validateEnv() {
  if (!CLICKUP_API_TOKEN) {
    throw new Error('Required CLICKUP_API_TOKEN environment variable is missing.');
  }
  if (!CLICKUP_LIST_ID) {
    throw new Error('Required CLICKUP_LIST_ID environment variable is missing.');
  }
}

/**
 * Masks sensitive API tokens and IDs in error messages to prevent leakage.
 * @param {string} message - Original error message
 * @returns {string} Safe masked message
 */
function maskSecrets(message) {
  let safeMessage = message;
  if (CLICKUP_API_TOKEN) {
    safeMessage = safeMessage.replace(new RegExp(CLICKUP_API_TOKEN, 'g'), '***REDACTED_API_TOKEN***');
  }
  if (CLICKUP_LIST_ID) {
    safeMessage = safeMessage.replace(new RegExp(CLICKUP_LIST_ID, 'g'), '***REDACTED_LIST_ID***');
  }
  return safeMessage;
}

/**
 * Creates a defect task in ClickUp.
 * @param {Object} bugDetails
 * @param {string} bugDetails.id - Defect ID (e.g. BUG-WEB-002)
 * @param {string} bugDetails.title - Summary title of the defect
 * @param {string} bugDetails.severity - Severity level (e.g. High)
 * @param {string} bugDetails.priority - Priority level (e.g. High)
 * @param {string} bugDetails.environment - Test environment info
 * @param {string[]} bugDetails.steps - Steps to reproduce the bug
 * @param {string} bugDetails.expected - The expected outcome
 * @param {string} bugDetails.actual - The actual outcome
 * @returns {Promise<string>} The created ClickUp Task ID
 */
export async function createDefectTask(bugDetails) {
  validateEnv();

  const url = `https://api.clickup.com/api/v2/list/${CLICKUP_LIST_ID}/task`;

  // Format the defect description precisely as required
  const description = `${bugDetails.id} - ${bugDetails.title}

Severity: ${bugDetails.severity}
Priority: ${bugDetails.priority}
Environment: ${bugDetails.environment}

Steps to Reproduce:
${bugDetails.steps.map((step, idx) => `${idx + 1}. ${step}`).join('\n')}

Expected Result:
${bugDetails.expected}

Actual Result:
${bugDetails.actual}`;

  const requestBody = {
    name: `${bugDetails.id} - ${bugDetails.title}`,
    description: description,
    status: 'to do',
    priority: 2 // 2 corresponds to "High" priority in ClickUp
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': CLICKUP_API_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ClickUp API Error (Status ${response.status}): ${errorText}`);
    }

    const data = await response.json();
    if (!data || !data.id) {
      throw new Error('ClickUp task response did not contain a valid ID.');
    }
    return data.id;
  } catch (error) {
    throw new Error(`Failed to create ClickUp task: ${maskSecrets(error.message)}`);
  }
}

/**
 * Uploads a screenshot as an attachment to an existing ClickUp task.
 * @param {string} taskId - ClickUp Task ID
 * @param {string} filePath - Absolute path to the screenshot image file
 * @returns {Promise<Object>} API JSON response
 */
export async function uploadAttachment(taskId, filePath) {
  validateEnv();

  if (!fs.existsSync(filePath)) {
    throw new Error(`Attachment file not found at path: ${filePath}`);
  }

  const url = `https://api.clickup.com/api/v2/task/${taskId}/attachment`;

  try {
    const fileBuffer = fs.readFileSync(filePath);
    const fileBlob = new Blob([fileBuffer], { type: 'image/png' });
    
    const formData = new FormData();
    formData.append('attachment', fileBlob, path.basename(filePath));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': CLICKUP_API_TOKEN
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ClickUp API Error (Status ${response.status}): ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    throw new Error(`Failed to upload attachment to ClickUp task ${taskId}: ${maskSecrets(error.message)}`);
  }
}
