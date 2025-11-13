#!/usr/bin/env node
/**
 * Comprehensive Ground Truth Dataset Collection
 * 
 * Collects diverse webpage samples for ground truth validation.
 * Uses MCP web tools to discover and capture real websites.
 * 
 * Creates a comprehensive dataset with:
 * - Diverse webpage types (e-commerce, docs, games, blogs, etc.)
 * - Screenshots
 * - Metadata
 * - Placeholder for human annotations
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { chromium } from 'playwright';

const DATASET_DIR = join(process.cwd(), 'evaluation', 'datasets', 'comprehensive');
const SCREENSHOTS_DIR = join(DATASET_DIR, 'screenshots');

if (!existsSync(DATASET_DIR)) {
  mkdirSync(DATASET_DIR, { recursive: true });
}
if (!existsSync(SCREENSHOTS_DIR)) {
  mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

/**
 * Diverse webpage categories to collect
 */
const WEBPAGE_CATEGORIES = [
  {
    category: 'e-commerce',
    examples: [
      { name: 'Amazon Product Page', url: 'https://www.amazon.com/dp/B08N5WRWNW' },
      { name: 'Etsy Shop', url: 'https://www.etsy.com' },
      { name: 'Shopify Store', url: 'https://www.shopify.com' }
    ],
    expectedScoreRange: { min: 6, max: 9 },
    knownGood: ['product images', 'clear pricing', 'add to cart'],
    knownBad: ['cluttered layouts', 'popups']
  },
  {
    category: 'documentation',
    examples: [
      { name: 'MDN Web Docs', url: 'https://developer.mozilla.org/en-US/docs/Web' },
      { name: 'React Docs', url: 'https://react.dev' },
      { name: 'Next.js Docs', url: 'https://nextjs.org/docs' }
    ],
    expectedScoreRange: { min: 8, max: 10 },
    knownGood: ['clear navigation', 'search', 'code examples'],
    knownBad: []
  },
  {
    category: 'blog',
    examples: [
      { name: 'Medium Article', url: 'https://medium.com' },
      { name: 'Dev.to', url: 'https://dev.to' },
      { name: 'CSS-Tricks', url: 'https://css-tricks.com' }
    ],
    expectedScoreRange: { min: 7, max: 9 },
    knownGood: ['readable typography', 'good contrast'],
    knownBad: ['ads', 'popups']
  },
  {
    category: 'portfolio',
    examples: [
      { name: 'Personal Portfolio', url: 'https://www.awwwards.com' },
      { name: 'Design Portfolio', url: 'https://dribbble.com' }
    ],
    expectedScoreRange: { min: 7, max: 10 },
    knownGood: ['visual appeal', 'creative design'],
    knownBad: ['accessibility issues']
  },
  {
    category: 'landing-page',
    examples: [
      { name: 'Stripe', url: 'https://stripe.com' },
      { name: 'Vercel', url: 'https://vercel.com' },
      { name: 'GitHub', url: 'https://github.com' }
    ],
    expectedScoreRange: { min: 7, max: 10 },
    knownGood: ['clear CTA', 'good visual hierarchy'],
    knownBad: []
  },
  {
    category: 'accessibility-reference',
    examples: [
      { name: 'W3C', url: 'https://www.w3.org' },
      { name: 'WebAIM', url: 'https://webaim.org' },
      { name: 'A11y Project', url: 'https://www.a11yproject.com' }
    ],
    expectedScoreRange: { min: 8, max: 10 },
    knownGood: ['WCAG compliant', 'excellent accessibility'],
    knownBad: []
  },
  {
    category: 'news',
    examples: [
      { name: 'BBC News', url: 'https://www.bbc.com/news' },
      { name: 'The Guardian', url: 'https://www.theguardian.com' }
    ],
    expectedScoreRange: { min: 6, max: 9 },
    knownGood: ['readable content'],
    knownBad: ['ads', 'popups', 'cluttered']
  },
  {
    category: 'game',
    examples: [
      { name: 'Itch.io', url: 'https://itch.io' },
      { name: 'Game Jolt', url: 'https://gamejolt.com' }
    ],
    expectedScoreRange: { min: 6, max: 9 },
    knownGood: ['game listings', 'visual appeal'],
    knownBad: ['accessibility issues']
  }
];

/**
 * Capture screenshot of a webpage
 */
async function captureScreenshot(browser, url, outputPath, viewport = { width: 1280, height: 720 }) {
  const page = await browser.newPage();
  try {
    await page.setViewportSize(viewport);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000); // Wait for animations/loads
    
    await page.screenshot({ path: outputPath, fullPage: false, type: 'png' });
    
    // Extract metadata
    const metadata = await page.evaluate(() => {
      return {
        title: document.title,
        url: window.location.href,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        hasImages: document.images.length > 0,
        hasForms: document.forms.length > 0,
        hasLinks: document.links.length > 0,
        textLength: document.body?.textContent?.length || 0
      };
    });
    
    await page.close();
    return metadata;
  } catch (error) {
    await page.close();
    throw error;
  }
}

/**
 * Collect comprehensive dataset
 */
async function collectComprehensiveDataset() {
  console.log('🌐 Collecting Comprehensive Ground Truth Dataset\n');
  
  const browser = await chromium.launch({ headless: true });
  const dataset = {
    name: 'Comprehensive Ground Truth Dataset',
    created: new Date().toISOString(),
    description: 'Diverse webpage samples for ground truth validation',
    version: '1.0.0',
    samples: []
  };
  
  let successCount = 0;
  let failCount = 0;
  
  for (const category of WEBPAGE_CATEGORIES) {
    console.log(`\n📁 Category: ${category.category}`);
    
    for (const example of category.examples) {
      try {
        console.log(`  📸 Capturing: ${example.name}...`);
        
        const sampleId = `${category.category}-${example.name.toLowerCase().replace(/\s+/g, '-')}`;
        const screenshotPath = join(SCREENSHOTS_DIR, `${sampleId}.png`);
        
        const metadata = await captureScreenshot(browser, example.url, screenshotPath);
        
        const sample = {
          id: sampleId,
          name: example.name,
          url: example.url,
          category: category.category,
          screenshot: screenshotPath,
          groundTruth: {
            expectedScore: category.expectedScoreRange,
            expectedIssues: [],
            knownGood: category.knownGood,
            knownBad: category.knownBad,
            annotations: {
              accessibility: 'unknown',
              contrast: 'unknown',
              navigation: 'unknown',
              layout: 'unknown',
              performance: 'unknown'
            },
            // Placeholder for human annotations
            humanAnnotations: {
              humanScore: null,
              humanIssues: null,
              humanReasoning: null,
              annotatorId: null,
              timestamp: null
            }
          },
          metadata: {
            ...metadata,
            device: 'desktop',
            timestamp: new Date().toISOString()
          }
        };
        
        dataset.samples.push(sample);
        successCount++;
        console.log(`  ✅ Captured: ${example.name}`);
      } catch (error) {
        console.error(`  ❌ Failed: ${example.name} - ${error.message}`);
        failCount++;
      }
    }
  }
  
  await browser.close();
  
  // Save dataset
  const datasetPath = join(DATASET_DIR, 'comprehensive-dataset.json');
  writeFileSync(datasetPath, JSON.stringify(dataset, null, 2));
  
  console.log(`\n✅ Dataset collection complete!`);
  console.log(`   Success: ${successCount} samples`);
  console.log(`   Failed: ${failCount} samples`);
  console.log(`   Total: ${dataset.samples.length} samples`);
  console.log(`   Saved: ${datasetPath}`);
  
  return dataset;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  collectComprehensiveDataset().catch(error => {
    console.error('❌ Dataset collection failed:', error);
    process.exit(1);
  });
}

export { collectComprehensiveDataset, WEBPAGE_CATEGORIES };

