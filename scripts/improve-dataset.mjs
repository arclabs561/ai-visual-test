/**
 * Improve Dataset Based on Goals
 * 
 * Expands the evaluation dataset to cover:
 * 1. Semantic validation scenarios (good + bad examples)
 * 2. Dynamic content handling
 * 3. Design principle validation
 * 4. Temporal testing scenarios
 * 5. State validation
 * 6. Accessibility validation
 * 7. Edge cases (errors, empty, loading)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Playwright is optional peer dependency
let chromium = null;
try {
  const playwright = await import('playwright');
  chromium = playwright.chromium;
} catch (error) {
  console.error('⚠️  Playwright not installed. Install with: npm install @playwright/test');
  console.error('   This script requires Playwright to capture screenshots.');
  process.exit(1);
}

const DATASET_FILE = join(__dirname, '..', 'evaluation', 'datasets', 'real-dataset.json');
const SCREENSHOTS_DIR = join(__dirname, '..', 'evaluation', 'datasets', 'screenshots');

// Ensure directories exist
[SCREENSHOTS_DIR].forEach(dir => {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
});

// Load existing dataset
let dataset = null;
try {
  const content = readFileSync(DATASET_FILE, 'utf-8');
  dataset = JSON.parse(content);
} catch (error) {
  dataset = {
    name: 'Real-World Screenshot Dataset',
    created: new Date().toISOString(),
    description: 'Screenshots captured from real websites with ground truth annotations',
    samples: []
  };
}

/**
 * Capture screenshot from URL
 */
async function captureScreenshot(url, outputPath, viewport = { width: 1280, height: 720 }, waitTime = 2000) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.setViewportSize(viewport);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(waitTime); // Wait for dynamic content
    
    await page.screenshot({ path: outputPath, fullPage: false });
    return true;
  } catch (error) {
    console.error(`Failed to capture ${url}: ${error.message}`);
    return false;
  } finally {
    await browser.close();
  }
}

/**
 * New samples to add based on goals
 */
const NEW_SAMPLES = [
  // Bad Examples (Known Issues)
  {
    id: 'low-contrast-example',
    name: 'Low Contrast Example',
    url: 'https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html',
    description: 'Example page that may have contrast issues for testing',
    expectedScore: { min: 3, max: 6 },
    expectedIssues: ['contrast', 'accessibility'],
    knownGood: [],
    knownBad: ['low contrast', 'accessibility issues'],
    category: 'accessibility-bad',
    viewport: { width: 1280, height: 720 },
    device: 'desktop'
  },
  {
    id: 'craigslist-homepage',
    name: 'Craigslist Homepage',
    url: 'https://www.craigslist.org',
    description: 'Older design patterns, basic accessibility',
    expectedScore: { min: 3, max: 6 },
    expectedIssues: ['outdated patterns', 'basic accessibility'],
    knownGood: [],
    knownBad: ['outdated design', 'limited accessibility'],
    category: 'design-outdated',
    viewport: { width: 1280, height: 720 },
    device: 'desktop'
  },
  
  // Mobile Views
  {
    id: 'github-mobile',
    name: 'GitHub Homepage (Mobile)',
    url: 'https://github.com',
    description: 'GitHub on mobile viewport',
    expectedScore: { min: 7, max: 10 },
    expectedIssues: [],
    knownGood: ['responsive design', 'mobile-friendly'],
    knownBad: [],
    category: 'mobile',
    viewport: { width: 375, height: 667 },
    device: 'mobile'
  },
  {
    id: 'mdn-mobile',
    name: 'MDN Web Docs (Mobile)',
    url: 'https://developer.mozilla.org',
    description: 'MDN on mobile viewport',
    expectedScore: { min: 8, max: 10 },
    expectedIssues: [],
    knownGood: ['responsive', 'mobile-accessible'],
    knownBad: [],
    category: 'mobile',
    viewport: { width: 375, height: 667 },
    device: 'mobile'
  },
  
  // Design Principles
  {
    id: 'brutalist-example',
    name: 'Brutalist Design Example',
    url: 'https://brutalistwebsites.com',
    description: 'Brutalist design with high contrast requirements',
    expectedScore: { min: 5, max: 9 },
    expectedIssues: [],
    knownGood: ['high contrast', 'bold design'],
    knownBad: ['may lack subtlety'],
    category: 'design-brutalist',
    viewport: { width: 1280, height: 720 },
    device: 'desktop'
  },
  {
    id: 'minimal-example',
    name: 'Minimal Design Example',
    url: 'https://minimal.gallery',
    description: 'Minimal design principles',
    expectedScore: { min: 6, max: 9 },
    expectedIssues: [],
    knownGood: ['clean', 'minimal', 'focused'],
    knownBad: [],
    category: 'design-minimal',
    viewport: { width: 1280, height: 720 },
    device: 'desktop'
  },
  
  // Dynamic Content
  {
    id: 'hackernews',
    name: 'Hacker News',
    url: 'https://news.ycombinator.com',
    description: 'Dynamic feed with timestamps and user data',
    expectedScore: { min: 6, max: 8 },
    expectedIssues: [],
    knownGood: ['functional', 'readable'],
    knownBad: ['basic design'],
    category: 'dynamic-content',
    viewport: { width: 1280, height: 720 },
    device: 'desktop'
  },
  {
    id: 'reddit-homepage',
    name: 'Reddit Homepage',
    url: 'https://www.reddit.com',
    description: 'Dynamic feed with real-time updates',
    expectedScore: { min: 6, max: 8 },
    expectedIssues: [],
    knownGood: ['dynamic content', 'feed-based'],
    knownBad: ['can be cluttered'],
    category: 'dynamic-content',
    viewport: { width: 1280, height: 720 },
    device: 'desktop'
  },
  
  // Form/State Validation
  {
    id: 'github-signup',
    name: 'GitHub Signup Form',
    url: 'https://github.com/signup',
    description: 'Form validation and state testing',
    expectedScore: { min: 7, max: 10 },
    expectedIssues: [],
    knownGood: ['clear form', 'good validation'],
    knownBad: [],
    category: 'form-state',
    viewport: { width: 1280, height: 720 },
    device: 'desktop'
  },
  
  // Error States
  {
    id: 'github-404',
    name: 'GitHub 404 Page',
    url: 'https://github.com/this-does-not-exist-12345',
    description: 'Error state page',
    expectedScore: { min: 6, max: 9 },
    expectedIssues: [],
    knownGood: ['helpful error message', 'clear navigation'],
    knownBad: [],
    category: 'error-state',
    viewport: { width: 1280, height: 720 },
    device: 'desktop'
  },
  
  // Complex Layouts
  {
    id: 'wikipedia-article',
    name: 'Wikipedia Article',
    url: 'https://en.wikipedia.org/wiki/Web_accessibility',
    description: 'Complex layout with navigation, content, sidebars',
    expectedScore: { min: 7, max: 9 },
    expectedIssues: [],
    knownGood: ['complex layout', 'good structure'],
    knownBad: ['can be overwhelming'],
    category: 'complex-layout',
    viewport: { width: 1280, height: 720 },
    device: 'desktop'
  }
];

async function improveDataset() {
  console.log('\n📊 Improving Dataset Based on Goals\n');
  console.log('=' .repeat(80));
  console.log(`Current samples: ${dataset.samples.length}`);
  console.log(`New samples to add: ${NEW_SAMPLES.length}\n`);
  
  const browser = await chromium.launch({ headless: true });
  const added = [];
  const failed = [];
  
  for (const sample of NEW_SAMPLES) {
    // Check if already exists
    const exists = dataset.samples.some(s => s.id === sample.id);
    if (exists) {
      console.log(`⏭️  ${sample.id}: Already exists, skipping`);
      continue;
    }
    
    const screenshotPath = join(SCREENSHOTS_DIR, `${sample.id}.png`);
    
    console.log(`📸 Capturing ${sample.name} (${sample.url})...`);
    
    const success = await captureScreenshot(
      sample.url,
      screenshotPath,
      sample.viewport,
      3000 // Wait 3s for dynamic content
    );
    
    if (success && existsSync(screenshotPath)) {
      const newSample = {
        id: sample.id,
        name: sample.name,
        url: sample.url,
        screenshot: screenshotPath,
        groundTruth: {
          expectedScore: sample.expectedScore,
          expectedIssues: sample.expectedIssues,
          knownGood: sample.knownGood,
          knownBad: sample.knownBad,
          annotations: {
            accessibility: 'unknown',
            contrast: 'unknown',
            navigation: 'unknown',
            category: sample.category
          }
        },
        metadata: {
          viewport: sample.viewport,
          device: sample.device,
          timestamp: new Date().toISOString(),
          category: sample.category
        }
      };
      
      dataset.samples.push(newSample);
      added.push(sample.id);
      console.log(`  ✅ Added: ${sample.id}`);
    } else {
      failed.push({ id: sample.id, reason: 'Screenshot capture failed' });
      console.log(`  ❌ Failed: ${sample.id}`);
    }
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  await browser.close();
  
  // Update dataset
  dataset.updated = new Date().toISOString();
  dataset.description = `${dataset.description} - Expanded to cover semantic validation, dynamic content, design principles, mobile views, error states, and complex layouts`;
  
  writeFileSync(DATASET_FILE, JSON.stringify(dataset, null, 2));
  
  console.log('\n\n📊 Summary\n');
  console.log('=' .repeat(80));
  console.log(`Added: ${added.length} samples`);
  console.log(`Failed: ${failed.length} samples`);
  console.log(`Total samples: ${dataset.samples.length}`);
  
  if (added.length > 0) {
    console.log('\n✅ Added samples:');
    added.forEach(id => console.log(`  - ${id}`));
  }
  
  if (failed.length > 0) {
    console.log('\n❌ Failed samples:');
    failed.forEach(({ id, reason }) => console.log(`  - ${id}: ${reason}`));
  }
  
  // Categorize samples
  console.log('\n📁 Dataset Categories:\n');
  const categories = {};
  dataset.samples.forEach(s => {
    const cat = s.metadata?.category || s.groundTruth?.annotations?.category || 'uncategorized';
    categories[cat] = (categories[cat] || 0) + 1;
  });
  
  Object.entries(categories).forEach(([cat, count]) => {
    console.log(`  ${cat.padEnd(20)}: ${count} samples`);
  });
  
  console.log(`\n✅ Dataset saved to: ${DATASET_FILE}`);
}

improveDataset().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});

