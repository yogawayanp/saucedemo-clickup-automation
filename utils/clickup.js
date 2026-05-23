const fs = require('fs');
const path = require('path');
require('dotenv').config();

const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN;
const CLICKUP_LIST_ID = process.env.CLICKUP_LIST_ID;

// Validate that required env variables are present
function validateEnv() {
  if (!CLICKUP_API_TOKEN) {
    throw new Error('CLICKUP_API_TOKEN is missing from environment variables (.env)');
  }
  if (!CLICKUP_LIST_ID) {
    throw new Error('CLICKUP_LIST_ID is missing from environment variables (.env)');
  }
}

/**
 * Creates a defect task in ClickUp.
 * @param {Object} bugDetails
 * @returns {Promise<string>} Created Task ID
 */
async function createDefectTask(bugDetails) {
  validateEnv();

  const url = `https://api.clickup.com/api/v2/list/${CLICKUP_LIST_ID}/task`;
  
  // Format the description as requested
  const description = `Bug ID: ${bugDetails.id}
Title: ${bugDetails.title}
Module: ${bugDetails.module}
Severity: ${bugDetails.severity}
Priority: ${bugDetails.priority}
Environment: ${bugDetails.environment}

Steps to Reproduce:
${bugDetails.steps.map((step, idx) => `${idx + 1}. ${step}`).join('\n')}

Expected Result:
${bugDetails.expected}

Actual Result:
${bugDetails.actual}

Observed Behavior:
${bugDetails.observed}`;

  const requestBody = {
    name: `[${bugDetails.id}] ${bugDetails.title}`,
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
      const errText = await response.text();
      // Handle error clearly without exposing the secret token in logs
      throw new Error(`ClickUp API Error (Status ${response.status}): ${errText}`);
    }

    const data = await response.json();
    return data.id;
  } catch (error) {
    // Make sure we never expose tokens in error messages or logs
    const safeMessage = error.message.replace(new RegExp(CLICKUP_API_TOKEN, 'g'), '***REDACTED***');
    throw new Error(`Failed to create ClickUp task: ${safeMessage}`);
  }
}

/**
 * Uploads a screenshot as an attachment to a ClickUp task.
 * @param {string} taskId
 * @param {string} filePath
 */
async function uploadAttachment(taskId, filePath) {
  validateEnv();

  if (!fs.existsSync(filePath)) {
    throw new Error(`Attachment file not found at: ${filePath}`);
  }

  const url = `https://api.clickup.com/api/v2/task/${taskId}/attachment`;
  
  try {
    const fileBuffer = fs.readFileSync(filePath);
    // Create a Blob from the file buffer
    const fileBlob = new Blob([fileBuffer], { type: 'image/png' });
    
    // Create native FormData and append the file
    const formData = new FormData();
    formData.append('attachment', fileBlob, path.basename(filePath));

    // Native fetch automatically sets the multipart/form-data headers with correct boundary
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': CLICKUP_API_TOKEN
        // Note: Do NOT set Content-Type header when sending native FormData, fetch will do it automatically
      },
      body: formData
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`ClickUp API Error (Status ${response.status}): ${errText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    const safeMessage = error.message.replace(new RegExp(CLICKUP_API_TOKEN, 'g'), '***REDACTED***');
    throw new Error(`Failed to upload attachment to ClickUp task: ${safeMessage}`);
  }
}

module.exports = {
  createDefectTask,
  uploadAttachment
};
