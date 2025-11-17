#!/usr/bin/env node
/**
 * URL-based Evaluation Support
 * 
 * Enables evaluation of web pages via URL when screenshots are not available.
 * Uses Playwright to capture screenshots on-the-fly for evaluation.
 */

import { validateScreenshot, createConfig } from '../../src/index.mjs';
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);
const TEMP_SCREENSHOT_DIR = join(process.cwd(), 'evaluation', 'temp-screenshots');

/**
 * Check if Playwright is available
 */
export async function isPlaywrightAvailable() {
  try {
    // Try importing playwright
    await import('playwright');
    return true;
  } catch {
    try {
      await execAsync('which playwright');
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Capture screenshot from URL using Playwright
 */
async function captureScreenshotFromUrl(url, options = {}) {
  const { width = 1280, height = 720, timeout = 30000 } = options;
  
  try {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
      viewport: { width, height }
    });
    
    await page.goto(url, { waitUntil: 'networkidle', timeout });
    
    // Ensure temp directory exists
    if (!existsSync(TEMP_SCREENSHOT_DIR)) {
      mkdirSync(TEMP_SCREENSHOT_DIR, { recursive: true });
    }
    
    // Generate unique filename
    const filename = `url-${Date.now()}-${Math.random().toString(36).substring(7)}.png`;
    const screenshotPath = join(TEMP_SCREENSHOT_DIR, filename);
    
    await page.screenshot({ path: screenshotPath, fullPage: false });
    await browser.close();
    
    return screenshotPath;
  } catch (error) {
    throw new Error(`Failed to capture screenshot from URL ${url}: ${error.message}`);
  }
}

/**
 * Evaluate a sample that has a URL but no screenshot
 */
export async function evaluateUrlSample(sample, options = {}) {
  const { provider = null, prompt = null, useCache = true, cleanup = true } = options;
  
  if (!sample.url) {
    return {
      sampleId: sample.id,
      success: false,
      error: 'No URL provided for URL-based evaluation'
    };
  }
  
  // Check if Playwright is available
  const hasPlaywright = await isPlaywrightAvailable();
  if (!hasPlaywright) {
    return {
      sampleId: sample.id,
      success: false,
      error: 'Playwright not available. Install with: npm install playwright && npx playwright install chromium'
    };
  }
  
  let screenshotPath = null;
  
  try {
    // Capture screenshot from URL
    screenshotPath = await captureScreenshotFromUrl(sample.url, {
      width: sample.metadata?.viewport?.width || sample.viewport?.width || 1280,
      height: sample.metadata?.viewport?.height || sample.viewport?.height || 720,
      timeout: 30000
    });
    
    // Evaluate using the captured screenshot
    const defaultPrompt = `Evaluate this webpage for quality, accessibility, and design.
Check for:
- Visual design and aesthetics
- Functional correctness
- Usability and clarity
- Accessibility compliance (WCAG)
- Color contrast
- Keyboard navigation
- Screen reader compatibility

Provide a score from 0-10 and list any issues found.`;
    
    const result = await validateScreenshot(
      screenshotPath,
      prompt || defaultPrompt,
      {
        testType: 'evaluation',
        viewport: sample.metadata?.viewport || sample.viewport || { width: 1280, height: 720 },
        provider,
        useCache: useCache !== false
      }
    );
    
    // Import filterIssues
    const { filterIssues } = await import('./issue-filter.mjs');
    const filteredIssues = filterIssues(result.issues || []);
    
    // Clean up temporary screenshot if requested
    if (cleanup && screenshotPath && existsSync(screenshotPath)) {
      try {
        unlinkSync(screenshotPath);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    
    // Import validateAgainstGroundTruth
    const { validateAgainstGroundTruth } = await import('../runners/evaluate.mjs');
    const validation = sample.groundTruth 
      ? validateAgainstGroundTruth(result, sample.groundTruth)
      : null;
    
    return {
      sampleId: sample.id,
      success: true,
      result: {
        score: result.score,
        issues: filteredIssues,
        rawIssues: result.issues || [],
        assessment: result.assessment,
        reasoning: result.reasoning,
        url: sample.url,
        screenshotCaptured: true
      },
      groundTruth: sample.groundTruth || null,
      validation,
      metadata: {
        provider: result.provider,
        cached: result.cached,
        responseTime: result.responseTime,
        estimatedCost: result.estimatedCost,
        screenshotPath: cleanup ? null : screenshotPath,
        evaluationMethod: 'url-based'
      }
    };
  } catch (error) {
    // Clean up on error
    if (screenshotPath && existsSync(screenshotPath)) {
      try {
        unlinkSync(screenshotPath);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    
    return {
      sampleId: sample.id,
      success: false,
      error: error.message
    };
  }
}

/**
 * Check if a sample can be evaluated via URL
 */
export function canEvaluateViaUrl(sample) {
  return !!(sample.url && (!sample.screenshot || !existsSync(sample.screenshot)));
}

