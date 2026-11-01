/**
 * Local file storage for attachments
 * Saves files to %APPDATA%/AccountabilityWatch/attachments/ on Windows
 * or similar local app data folder on other OS
 * Supports test isolation via ACCOUNTABILITY_ATTACHMENTS_DIR environment variable
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { existsSync } from 'node:fs';

/**
 * Get attachment storage directory
 * Windows: %APPDATA%/AccountabilityWatch/attachments
 * macOS: ~/Library/Application Support/AccountabilityWatch/attachments
 * Linux: ~/.local/share/accountability-watch/attachments
 * Test: ACCOUNTABILITY_ATTACHMENTS_DIR env var if set
 */
export function getAttachmentDir() {
  // Support test isolation
  if (process.env.ACCOUNTABILITY_ATTACHMENTS_DIR) {
    const testDir = process.env.ACCOUNTABILITY_ATTACHMENTS_DIR;
    return { baseDir: dirname(testDir), attachmentDir: testDir };
  }
  
  const isWindows = process.platform === 'win32';
  const isMac = process.platform === 'darwin';
  
  const appData = isWindows
    ? process.env.APPDATA || join(homedir(), 'AppData/Roaming')
    : isMac
      ? join(homedir(), 'Library/Application Support')
      : join(homedir(), '.local/share');
  
  const baseDir = join(appData, 'AccountabilityWatch');
  const attachmentDir = join(baseDir, 'attachments');
  
  return { baseDir, attachmentDir };
}

/**
 * Ensure attachment directory exists
 */
export async function ensureAttachmentDirExists() {
  const { attachmentDir } = getAttachmentDir();
  try {
    if (!existsSync(attachmentDir)) {
      await mkdir(attachmentDir, { recursive: true });
      console.log(`📁 Created attachment directory: ${attachmentDir}`);
    }
    return attachmentDir;
  } catch (err) {
    console.error('❌ Failed to create attachment directory:', err);
    throw new Error(`Cannot create attachment directory: ${err.message}`);
  }
}

/**
 * Save file to local storage
 * @param {string} reportId - Report ID for folder organization
 * @param {File} file - File object from form
 * @returns {Promise<{storagePath: string, success: boolean, error?: string}>}
 */
export async function saveFile(reportId, file) {
  try {
    const attachmentDir = await ensureAttachmentDirExists();
    
    // Validate
    if (!file || !file.arrayBuffer || !file.name) {
      return {
        success: false,
        error: 'Invalid file object',
      };
    }
    
    // Size limit: 25 MB
    if (file.size > 25 * 1024 * 1024) {
      return {
        success: false,
        error: 'File exceeds 25 MB limit',
      };
    }
    
    // Create sanitized filename
    const sanitized = file.name
      .replace(/[^\w.\-]/g, '_')
      .replace(/^\.+/, ''); // Remove leading dots
    
    // Organize by report ID then timestamp
    const timestamp = Date.now();
    const reportDir = join(attachmentDir, reportId);
    const fileName = `${timestamp}_${sanitized}`;
    const filePath = join(reportDir, fileName);
    
    // Ensure report directory exists
    await mkdir(reportDir, { recursive: true });
    
    // Read file buffer
    const buffer = await file.arrayBuffer();
    
    // Write file
    await writeFile(filePath, Buffer.from(buffer));
    
    // Return relative storage path for database
    // Use forward slashes for consistency
    const storagePath = `${reportId}/${fileName}`;
    
    return {
      success: true,
      storagePath,
      fullPath: filePath,
    };
  } catch (err) {
    console.error('❌ File save error:', err);
    return {
      success: false,
      error: err.message || 'Unknown error saving file',
    };
  }
}

/**
 * Get full path for a stored file
 * @param {string} storagePath - Storage path from database
 * @returns {string} Full file system path
 */
export function getFileFullPath(storagePath) {
  const { attachmentDir } = getAttachmentDir();
  return join(attachmentDir, storagePath);
}

/**
 * Check if a file exists in storage
 * @param {string} storagePath - Storage path from database
 * @returns {boolean}
 */
export function fileExists(storagePath) {
  const fullPath = getFileFullPath(storagePath);
  return existsSync(fullPath);
}
