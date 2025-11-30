/**
 * Unified file writing service for the migration tool
 */

import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { Logger } from './logger';

export class FileWriter {
  private outputDir: string;

  constructor(outputDir: string = './output') {
    this.outputDir = outputDir;
    this.ensureOutputDir();
  }

  /**
   * Ensure output directory exists
   */
  private ensureOutputDir(): void {
    try {
      mkdirSync(this.outputDir, { recursive: true });
    } catch (error) {
      Logger.warn(`Warning: Could not create output directory ${this.outputDir}`);
    }
  }

  /**
   * Write JSON data to file
   */
  writeJson(filename: string, data: any, pretty: boolean = true): string {
    const filepath = `${this.outputDir}/${filename}`;
    try {
      writeFileSync(filepath, JSON.stringify(data, null, pretty ? 2 : 0));
      return filepath;
    } catch (error) {
      throw new Error(
        `Failed to write JSON file ${filename}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Write text data to file
   */
  writeText(filename: string, content: string): string {
    const filepath = `${this.outputDir}/${filename}`;
    try {
      writeFileSync(filepath, content);
      return filepath;
    } catch (error) {
      throw new Error(
        `Failed to write text file ${filename}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get full path for a file in output directory
   */
  getPath(filename: string): string {
    return `${this.outputDir}/${filename}`;
  }
}

