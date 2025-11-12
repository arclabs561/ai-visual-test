#!/usr/bin/env node
/**
 * Capture Real Dataset
 * 
 * Actually captures screenshots from real websites to create a dataset
 * with ground truth annotations.
 */

import { chromium } from 'playwright';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { DATASETS_DIR } from './dataset-loaders.mjs';

const SCREENSHOTS_DIR = join(DATASETS_DIR, 'screenshots');

// Ensure directories exist
[DATASETS_DIR, SCREENSHOTS_DIR].forEach(dir => {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
});

/**
 * Capture screenshot from URL
 */
async function captureScreenshot(url, outputPath, viewport = { width: 1280, height: 720 }) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.setViewportSize(viewport);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    
    // Wait a bit for dynamic content
    await page.waitForTimeout(2000);
    
    await page.screenshot({ 
      path: outputPath, 
      fullPage: true,
      type: 'png'
    });
    
    await browser.close();
    return outputPath;
  } catch (error) {
    await browser.close();
    throw error;
  }
}

/**
 * Create real dataset with captured screenshots
 */
async function createRealDataset() {
  console.log('📸 Creating real dataset with actual screenshots...\n');
  
  const websites = [
    {
      id: 'github-homepage',
      name: 'GitHub Homepage',
      url: 'https://github.com',
      expectedScore: { min: 7, max: 10 },
      expectedIssues: [],
      knownGood: ['high contrast', 'clear navigation', 'accessible', 'keyboard navigation'],
      knownBad: [],
      viewport: { width: 1280, height: 720 }
    },
    {
      id: 'mdn-homepage',
      name: 'MDN Web Docs',
      url: 'https://developer.mozilla.org',
      expectedScore: { min: 8, max: 10 },
      expectedIssues: [],
      knownGood: ['WCAG compliant', 'excellent contrast', 'keyboard accessible', 'screen reader support'],
      knownBad: [],
      viewport: { width: 1280, height: 720 }
    },
    {
      id: 'w3c-homepage',
      name: 'W3C Homepage',
      url: 'https://www.w3.org',
      expectedScore: { min: 8, max: 10 },
      expectedIssues: [],
      knownGood: ['WCAG AAA', 'perfect accessibility', 'excellent design'],
      knownBad: [],
      viewport: { width: 1280, height: 720 }
    },
    {
      id: 'example-com',
      name: 'Example.com',
      url: 'https://example.com',
      expectedScore: { min: 5, max: 8 },
      expectedIssues: [],
      knownGood: ['simple', 'minimal'],
      knownBad: [],
      viewport: { width: 1280, height: 720 }
    }
  ];
  
  const dataset = {
    name: 'Real-World Screenshot Dataset',
    created: new Date().toISOString(),
    description: 'Screenshots captured from real websites with ground truth annotations',
    samples: []
  };
  
  for (let i = 0; i < websites.length; i++) {
    const site = websites[i];
    console.log(`[${i + 1}/${websites.length}] Capturing: ${site.name} (${site.url})`);
    
    try {
      const screenshotPath = join(SCREENSHOTS_DIR, `${site.id}.png`);
      await captureScreenshot(site.url, screenshotPath, site.viewport);
      
      dataset.samples.push({
        id: site.id,
        name: site.name,
        url: site.url,
        screenshot: screenshotPath,
        groundTruth: {
          expectedScore: site.expectedScore,
          expectedIssues: site.expectedIssues,
          knownGood: site.knownGood,
          knownBad: site.knownBad,
          annotations: {
            accessibility: site.knownGood.includes('accessible') || site.knownGood.includes('WCAG') ? 'good' : 'unknown',
            contrast: site.knownGood.includes('contrast') ? 'high' : 'unknown',
            navigation: site.knownGood.includes('navigation') ? 'clear' : 'unknown'
          }
        },
        metadata: {
          viewport: site.viewport,
          device: 'desktop',
          timestamp: new Date().toISOString()
        }
      });
      
      console.log(`   ✅ Captured: ${screenshotPath}`);
    } catch (error) {
      console.error(`   ❌ Failed: ${error.message}`);
      // Still add to dataset but mark as failed
      dataset.samples.push({
        id: site.id,
        name: site.name,
        url: site.url,
        screenshot: null,
        error: error.message,
        groundTruth: {
          expectedScore: site.expectedScore,
          expectedIssues: site.expectedIssues
        }
      });
    }
  }
  
  // Save dataset
  const outputFile = join(DATASETS_DIR, 'real-dataset.json');
  writeFileSync(outputFile, JSON.stringify(dataset, null, 2));
  
  console.log(`\n✅ Dataset created: ${outputFile}`);
  console.log(`   Samples: ${dataset.samples.length}`);
  console.log(`   Successful captures: ${dataset.samples.filter(s => s.screenshot).length}`);
  
  return dataset;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createRealDataset().catch(console.error);
}

export { createRealDataset, captureScreenshot };

