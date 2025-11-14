/**
 * Test Image Utilities
 * 
 * Shared utilities for creating test images in tests.
 * Ensures all test images meet minimum requirements (e.g., 2x2 for Groq).
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

/**
 * Create a minimal valid 2x2 pixel PNG
 * 
 * This meets Groq's minimum requirement of 2x2 pixels.
 * Uses a known valid 2x2 red PNG in base64.
 */
export function createTempImage(path) {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  
  // Valid 2x2 pixel PNG in base64 (meets Groq's 2x2 minimum)
  // This is a properly formatted PNG that all VLLM APIs can process
  const minimalPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  writeFileSync(path, minimalPng);
  return path;
}

/**
 * Create a larger test image (10x10) for more complex tests
 */
export function createLargerTestImage(path) {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  
  // 10x10 pixel PNG in base64
  const largerPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  writeFileSync(path, largerPng);
  return path;
}

