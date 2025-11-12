#!/usr/bin/env node
/**
 * Demo: Show Human Feedback System
 * 
 * Demonstrates the real human feedback system with a sample judgment
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Sample VLLM judgment for demo
const sampleJudgment = {
  id: 'demo-showcase',
  screenshot: 'evaluation/screenshots/demo.png',
  prompt: 'Evaluate this webpage for quality, accessibility, and design',
  vllmScore: 8,
  vllmIssues: ['contrast issue', 'spacing could be improved'],
  vllmReasoning: 'Good overall design with clear hierarchy and good use of whitespace. However, there are some contrast issues that could affect accessibility, particularly for users with visual impairments. The spacing between elements is generally good but could be more consistent in some areas.',
  provider: 'gemini',
  timestamp: new Date().toISOString(),
  context: { testType: 'demo' }
};

function createHTMLViewer(vllmJudgment, outputPath) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Human Validation - ${vllmJudgment.id}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1a1a1a;
      color: #e0e0e0;
      padding: 20px;
      line-height: 1.6;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
    }
    .header {
      background: #2a2a2a;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .header h1 {
      color: #4a9eff;
      margin-bottom: 10px;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 20px;
    }
    @media (max-width: 1200px) {
      .grid { grid-template-columns: 1fr; }
    }
    .panel {
      background: #2a2a2a;
      padding: 20px;
      border-radius: 8px;
    }
    .panel h2 {
      color: #4a9eff;
      margin-bottom: 15px;
      border-bottom: 2px solid #4a9eff;
      padding-bottom: 10px;
    }
    .screenshot-container {
      text-align: center;
    }
    .screenshot-container img {
      max-width: 100%;
      height: auto;
      border: 2px solid #4a9eff;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(74, 158, 255, 0.3);
    }
    .score {
      font-size: 48px;
      font-weight: bold;
      color: #4a9eff;
      text-align: center;
      margin: 20px 0;
    }
    .issues {
      margin-top: 15px;
    }
    .issues ul {
      list-style: none;
      padding-left: 0;
    }
    .issues li {
      padding: 8px;
      margin: 5px 0;
      background: #3a3a3a;
      border-left: 3px solid #ff6b6b;
      border-radius: 4px;
    }
    .reasoning {
      margin-top: 15px;
      padding: 15px;
      background: #3a3a3a;
      border-radius: 4px;
      white-space: pre-wrap;
    }
    .info {
      margin-top: 10px;
      font-size: 0.9em;
      color: #888;
    }
    .actions {
      background: #2a2a2a;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
    }
    .actions p {
      margin-bottom: 15px;
      color: #888;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>👤 Human Validation Request</h1>
      <p>Judgment ID: <code>${vllmJudgment.id}</code></p>
      <p>Test Type: ${vllmJudgment.context?.testType || 'unknown'}</p>
    </div>
    
    <div class="grid">
      <div class="panel screenshot-container">
        <h2>📸 Screenshot</h2>
        <div style="padding: 40px; background: #3a3a3a; border-radius: 8px; margin: 20px 0;">
          <p style="color: #888; text-align: center;">[Screenshot would appear here]</p>
          <p style="color: #666; font-size: 0.9em; text-align: center; margin-top: 10px;">
            In real usage, the actual screenshot is displayed here<br>
            The system opens it in your default image viewer too
          </p>
        </div>
      </div>
      
      <div class="panel">
        <h2>🤖 VLLM Judgment</h2>
        <div class="score">${vllmJudgment.vllmScore}/10</div>
        <div class="issues">
          <strong>Issues:</strong>
          ${vllmJudgment.vllmIssues.length > 0 
            ? `<ul>${vllmJudgment.vllmIssues.map(issue => `<li>${issue}</li>`).join('')}</ul>`
            : '<p>None detected</p>'}
        </div>
        <div class="reasoning">
          <strong>Reasoning:</strong><br>
          ${vllmJudgment.vllmReasoning || 'No reasoning provided'}
        </div>
        <div class="info">
          Provider: ${vllmJudgment.provider || 'unknown'}<br>
          Timestamp: ${new Date(vllmJudgment.timestamp).toLocaleString()}
        </div>
      </div>
    </div>
    
    <div class="actions">
      <p>💡 Review the screenshot and VLLM judgment above, then return to the terminal to provide your feedback.</p>
      <p>This page will remain open for reference.</p>
    </div>
  </div>
</body>
</html>`;

  writeFileSync(outputPath, html);
  return outputPath;
}

async function showDemo() {
  console.log('👤 Real Human Feedback System - Demo\n');
  console.log('='.repeat(70));
  console.log('This demonstrates the human feedback collection system.\n');
  
  // Create HTML viewer
  const htmlPath = join(process.cwd(), 'evaluation', 'validation-viewer-demo.html');
  createHTMLViewer(sampleJudgment, htmlPath);
  console.log('✅ Created HTML viewer:', htmlPath);
  
  // Try to open it
  const platform = process.platform;
  let command;
  
  try {
    if (platform === 'darwin') {
      command = `open "${htmlPath}"`;
    } else if (platform === 'win32') {
      command = `start "" "${htmlPath}"`;
    } else {
      command = `xdg-open "${htmlPath}"`;
    }
    
    await execAsync(command);
    console.log('✅ Opened HTML viewer in your browser\n');
  } catch (error) {
    console.log('⚠️  Could not open automatically. Open manually:', htmlPath, '\n');
  }
  
  console.log('📊 Sample VLLM Judgment:');
  console.log(`   ID: ${sampleJudgment.id}`);
  console.log(`   Score: ${sampleJudgment.vllmScore}/10`);
  console.log(`   Issues: ${sampleJudgment.vllmIssues.join(', ')}`);
  console.log(`   Reasoning: ${sampleJudgment.vllmReasoning.substring(0, 100)}...\n`);
  
  console.log('💡 How it works:');
  console.log('   1. System collects VLLM judgments during evaluation');
  console.log('   2. Judgments are queued for human review');
  console.log('   3. Run: node evaluation/real-human-feedback.mjs');
  console.log('   4. System opens screenshots and HTML viewer');
  console.log('   5. You provide your score, issues, and reasoning');
  console.log('   6. System calibrates based on your feedback\n');
  
  console.log('📝 To try it with real judgments:');
  console.log('   node evaluation/real-human-feedback.mjs\n');
}

showDemo().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});

