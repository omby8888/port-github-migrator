/**
 * Utility functions for the migration tool
 */

import { Logger } from './logger';
import { PortApiClient } from './port-client';

/**
 * Delay execution for a specified number of milliseconds
 */
export async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a promise-based function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  initialDelayMs: number = 1000,
  backoffMultiplier: number = 2
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxAttempts) {
        const delayMs = initialDelayMs * Math.pow(backoffMultiplier, attempt - 1);
        Logger.log(`⏳ Retrying in ${delayMs}ms... (Attempt ${attempt}/${maxAttempts})`);
        await delay(delayMs);
      }
    }
  }

  throw lastError || new Error('Max retry attempts exceeded');
}

/**
 * Format bytes to human-readable format
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Format duration in milliseconds to human-readable format
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitize string for logging
 */
export function sanitizeForLogging(value: string, maxLength: number = 50): string {
  if (value.length <= maxLength) {
    return value;
  }
  return value.substring(0, maxLength) + '...';
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T;
  }

  if (obj instanceof Array) {
    const clonedArr: unknown[] = [];
    for (const item of obj) {
      clonedArr.push(deepClone(item));
    }
    return clonedArr as unknown as T;
  }

  if (obj instanceof Object) {
    const clonedObj: Record<string, unknown> = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone((obj as Record<string, unknown>)[key]);
      }
    }
    return clonedObj as unknown as T;
  }

  return obj;
}

/**
 * Construct the new datasource ID from integration version and installation ID
 */
export async function getNewDatasourceId(
  client: PortApiClient,
  newInstallationId: string
): Promise<string> {
  const version = await client.getIntegrationVersion(newInstallationId);
  return `port-ocean/github-ocean/${version}/${newInstallationId}/exporter`;
}
