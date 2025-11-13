#!/usr/bin/env node
/**
 * Collect Diverse Webpages Using Web Search
 * 
 * Uses web search to discover diverse webpages for ground truth collection.
 * Searches for different types of websites and collects samples.
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { chromium } from 'playwright';

const DATASET_DIR = join(process.cwd(), 'evaluation', 'datasets', 'diverse');
const SCREENSHOTS_DIR = join(DATASET_DIR, 'screenshots');

if (!existsSync(DATASET_DIR)) {
  mkdirSync(DATASET_DIR, { recursive: true });
}
if (!existsSync(SCREENSHOTS_DIR)) {
  mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

/**
 * Search queries for diverse webpage types
 */
const SEARCH_QUERIES = [
  { type: 'e-commerce', query: 'best online stores 2024', expectedScore: { min: 6, max: 9 } },
  { type: 'blog', query: 'best tech blogs 2024', expectedScore: { min: 7, max: 9 } },
  { type: 'portfolio', query: 'best portfolio websites designers', expectedScore: { min: 7, max: 10 } },
  { type: 'documentation', query: 'best developer documentation sites', expectedScore: { min: 8, max: 10 } },
  { type: 'news', query: 'best news websites design', expectedScore: { min: 6, max: 9 } },
  { type: 'landing-page', query: 'best landing page examples', expectedScore: { min: 7, max: 10 } }
];

/**
 * Capture screenshot and metadata
 */
async function captureWebpage(browser, url, outputPath) {
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    await page.screenshot({ path: outputPath, fullPage: false, type: 'png' });
    
    const metadata = await page.evaluate(() => {
      return {
        title: document.title,
        url: window.location.href,
        viewport: { width: window.innerWidth, height: window.innerHeight },
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
 * Collect diverse webpages
 * 
 * Note: This is a template - actual web search integration would use MCP tools
 */
async function collectDiverseWebpages() {
  console.log('🌐 Collecting Diverse Webpages for Ground Truth\n');
  
  // This would use MCP web search tools in practice
  // For now, we'll use a curated list
  const curatedUrls = [
    { name: 'Stripe', url: 'https://stripe.com', type: 'landing-page', expectedScore: { min: 8, max: 10 } },
    { name: 'Vercel', url: 'https://vercel.com', type: 'landing-page', expectedScore: { min: 8, max: 10 } },
    { name: 'Linear', url: 'https://linear.app', type: 'landing-page', expectedScore: { min: 8, max: 10 } },
    { name: 'Figma', url: 'https://www.figma.com', type: 'landing-page', expectedScore: { min: 7, max: 9 } },
    { name: 'Notion', url: 'https://www.notion.so', type: 'landing-page', expectedScore: { min: 7, max: 9 } },
    { name: 'Tailwind CSS', url: 'https://tailwindcss.com', type: 'documentation', expectedScore: { min: 8, max: 10 } },
    { name: 'Svelte', url: 'https://svelte.dev', type: 'documentation', expectedScore: { min: 8, max: 10 } },
    { name: 'Vue.js', url: 'https://vuejs.org', type: 'documentation', expectedScore: { min: 8, max: 10 } },
    { name: 'Smashing Magazine', url: 'https://www.smashingmagazine.com', type: 'blog', expectedScore: { min: 7, max: 9 } },
    { name: 'A List Apart', url: 'https://alistapart.com', type: 'blog', expectedScore: { min: 7, max: 9 } }
  ];
  
  const browser = await chromium.launch({ headless: true });
  const dataset = {
    name: 'Diverse Webpages Dataset',
    created: new Date().toISOString(),
    description: 'Diverse webpage samples collected for ground truth validation',
    version: '1.0.0',
    samples: []
  };
  
  let successCount = 0;
  let failCount = 0;
  
  for (const item of curatedUrls) {
    try {
      console.log(`📸 Capturing: ${item.name} (${item.type})...`);
      
      const sampleId = `${item.type}-${item.name.toLowerCase().replace(/\s+/g, '-')}`;
      const screenshotPath = join(SCREENSHOTS_DIR, `${sampleId}.png`);
      
      const metadata = await captureWebpage(browser, item.url, screenshotPath);
      
      const sample = {
        id: sampleId,
        name: item.name,
        url: item.url,
        category: item.type,
        screenshot: screenshotPath,
        groundTruth: {
          expectedScore: item.expectedScore,
          expectedIssues: [],
          knownGood: [],
          knownBad: [],
          annotations: {
            accessibility: 'unknown',
            contrast: 'unknown',
            navigation: 'unknown',
            layout: 'unknown',
            performance: 'unknown'
          },
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
      console.log(`  ✅ Captured: ${item.name}`);
    } catch (error) {
      console.error(`  ❌ Failed: ${item.name} - ${error.message}`);
      failCount++;
    }
  }
  
  await browser.close();
  
  // Save dataset
  const datasetPath = join(DATASET_DIR, 'diverse-dataset.json');
  writeFileSync(datasetPath, JSON.stringify(dataset, null, 2));
  
  console.log(`\n✅ Dataset collection complete!`);
  console.log(`   Success: ${successCount} samples`);
  console.log(`   Failed: ${failCount} samples`);
  console.log(`   Total: ${dataset.samples.length} samples`);
  console.log(`   Saved: ${datasetPath}`);
  
  return dataset;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  collectDiverseWebpages().catch(error => {
    console.error('❌ Dataset collection failed:', error);
    process.exit(1);
  });
}

export { collectDiverseWebpages };

