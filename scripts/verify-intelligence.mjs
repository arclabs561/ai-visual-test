/**
 * Intelligence Verification Script
 * 
 * Bridges the gap between "code works" and "AI works".
 * Generates real visual bugs (HTML/CSS) and verifies if the AI detects them.
 * 
 * USAGE: node scripts/verify-intelligence.mjs
 */

import { chromium } from 'playwright';
import { validateScreenshot } from '../src/index.js';
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'fs';
import { join } from 'path';
import { loadEnv } from '../src/load-env.mjs';

loadEnv();

const OUT_DIR = join(process.cwd(), 'temp/intelligence-check');
if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

const TEST_CASES = [
  {
    name: 'low-contrast',
    html: `
      <html>
        <body style="background: #222; color: #444; font-family: sans-serif; padding: 20px;">
          <h1>Low Contrast Test</h1>
          <p>This text has a contrast ratio of ~2.4:1, which fails WCAG AA.</p>
          <button style="background: #333; color: #555; border: none; padding: 10px;">Unreadable Button</button>
        </body>
      </html>
    `,
    expectedKeywords: ['contrast', 'readability', 'legibility', 'low', 'text']
  },
  {
    name: 'overlap',
    html: `
      <html>
        <body style="font-family: sans-serif; padding: 20px;">
          <h1>Layout Overlap Test</h1>
          <div style="position: relative; height: 100px;">
            <div style="position: absolute; top: 10px; left: 10px; background: rgba(255,0,0,0.5); width: 200px; padding: 10px;">
              Foreground Content
            </div>
            <div style="position: absolute; top: 20px; left: 30px; background: rgba(0,0,255,0.5); width: 200px; padding: 10px;">
              Overlapping Content
            </div>
          </div>
          <p>The blue box overlaps the red box, making text hard to read.</p>
        </body>
      </html>
    `,
    expectedKeywords: ['overlap', 'obscure', 'cover', 'layout', 'stacking']
  },
  {
    name: 'misalignment',
    html: `
      <html>
        <body style="font-family: sans-serif; padding: 20px;">
          <h1>Misalignment Test</h1>
          <div style="display: flex; align-items: flex-start; gap: 10px; border: 1px solid #ccc; padding: 10px; width: 200px;">
            <span style="font-size: 24px;">⚠️</span>
            <span style="font-size: 14px; margin-top: 0;">Warning: Icon is not vertically centered with text.</span>
          </div>
        </body>
      </html>
    `,
    expectedKeywords: ['align', 'center', 'vertical', 'misaligned', 'icon']
  }
];

async function run() {
  console.log('🧠 Verifying AI Intelligence on Synthetic Bugs...\n');

  if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY && !process.env.GROQ_API_KEY) {
    console.log('⚠️  No API keys found. Skipping intelligence check.');
    return;
  }

  const browser = await chromium.launch();
  const results = [];

  try {
    for (const testCase of TEST_CASES) {
      const page = await browser.newPage();
      await page.setContent(testCase.html);
      
      const screenshotPath = join(OUT_DIR, `${testCase.name}.png`);
      await page.screenshot({ path: screenshotPath });
      await page.close();

      console.log(`🔍 Analyzing ${testCase.name}...`);
      const result = await validateScreenshot(screenshotPath, 'Identify visual bugs and accessibility issues.');
      
      const issues = (result.issues || []).join(' ').toLowerCase();
      const reasoning = (result.reasoning || '').toLowerCase();
      const fullText = `${issues} ${reasoning}`;
      
      const matches = testCase.expectedKeywords.filter(keyword => fullText.includes(keyword));
      const passed = matches.length > 0;

      results.push({
        name: testCase.name,
        passed,
        score: result.score,
        matches: matches,
        foundIssues: result.issues
      });

      if (passed) {
        console.log(`✅ PASS: Detected ${testCase.name} issues (${matches.join(', ')})`);
      } else {
        console.log(`❌ FAIL: Did not detect ${testCase.name} issues.`);
        console.log(`   AI Reasoning: ${result.reasoning?.substring(0, 100)}...`);
      }
    }
  } catch (error) {
    console.error('❌ Error running intelligence check:', error);
  } finally {
    await browser.close();
    // Cleanup
    if (existsSync(OUT_DIR)) {
      // Uncomment to keep screenshots for debugging
      // rmSync(OUT_DIR, { recursive: true, force: true });
    }
  }

  console.log('\n=== Intelligence Report ===');
  const passedCount = results.filter(r => r.passed).length;
  console.log(`Success Rate: ${passedCount}/${results.length}`);
  
  if (passedCount === results.length) {
    console.log('🚀 The AI is accurately detecting visual bugs!');
  } else {
    console.log('⚠️  The AI missed some bugs. Check prompts or model quality.');
  }
}

run();

