import * as Minio from 'minio';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT;
const MINIO_PORT = parseInt(process.env.MINIO_PORT || '9000', 10);
const MINIO_USE_SSL = process.env.MINIO_USE_SSL === 'true';
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY;
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY;
const MINIO_BUCKET = process.env.MINIO_BUCKET;

/**
 * Validates that all required MinIO environment variables are set.
 * Throws a safe error if any required variables are missing.
 */
function validateMinioEnv() {
  const required = {
    MINIO_ENDPOINT,
    MINIO_PORT: process.env.MINIO_PORT,
    MINIO_ACCESS_KEY,
    MINIO_SECRET_KEY,
    MINIO_BUCKET
  };

  for (const [name, value] of Object.entries(required)) {
    if (!value) {
      throw new Error(`Required ${name} environment variable is missing.`);
    }
  }
}

/**
 * Creates and returns a configured MinIO client instance.
 * @returns {Minio.Client} Configured MinIO client
 */
function createMinioClient() {
  validateMinioEnv();

  return new Minio.Client({
    endPoint: MINIO_ENDPOINT,
    port: MINIO_PORT,
    useSSL: MINIO_USE_SSL,
    accessKey: MINIO_ACCESS_KEY,
    secretKey: MINIO_SECRET_KEY
  });
}

/**
 * Uploads a file to the configured MinIO bucket and returns a presigned URL.
 * @param {string} objectName - The object key name in the bucket (e.g., 'screenshots/BUG-WEB-002-2026-05-24.png')
 * @param {string} filePath - Absolute path to the local file to upload
 * @returns {Promise<{objectName: string, presignedUrl: string}>} Upload result with presigned URL
 */
export async function uploadFile(objectName, filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found for MinIO upload: ${filePath}`);
  }

  const fileStats = fs.statSync(filePath);
  if (fileStats.size === 0) {
    throw new Error(`File is empty, cannot upload to MinIO: ${filePath}`);
  }

  const client = createMinioClient();

  // Determine content type based on file extension
  const ext = path.extname(filePath).toLowerCase();
  const contentTypeMap = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webm': 'video/webm',
    '.mp4': 'video/mp4'
  };
  const contentType = contentTypeMap[ext] || 'application/octet-stream';

  // Upload the file
  const metaData = { 'Content-Type': contentType };
  await client.fPutObject(MINIO_BUCKET, objectName, filePath, metaData);

  // Generate a presigned URL valid for 7 days (604800 seconds)
  const presignedUrl = await client.presignedGetObject(MINIO_BUCKET, objectName, 7 * 24 * 60 * 60);

  return { objectName, presignedUrl };
}
