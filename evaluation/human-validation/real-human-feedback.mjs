#!/usr/bin/env node
/**
 * Real Human Feedback Collection
 * 
 * A more practical human feedback system that:
 * 1. Opens screenshots in your default image viewer/browser
 * 2. Shows VLLM judgment alongside
 * 3. Collects human feedback interactively
 * 4. Uses native OS tools for better UX
 * 
 * Usage:
 *   node evaluation/human-validation/real-human-feedback.mjs
 */

import { readFileSync, readdirSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createInterface } from 'readline';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getHumanValidationManager } from '../../src/human-validation-manager.mjs';
import { collectHumanJudgment, VALIDATION_DIR } from './human-validation.mjs';

const execAsync = promisify(exec);

/**
 * Open screenshot in default viewer
 */
async function openScreenshot(screenshotPath) {
  if (!existsSync(screenshotPath)) {
    console.log(`⚠️  Screenshot not found: ${screenshotPath}`);
    return false;
  }

  const platform = process.platform;
  let command;

  try {
    if (platform === 'darwin') {
      // macOS
      command = `open "${screenshotPath}"`;
    } else if (platform === 'win32') {
      // Windows
      command = `start "" "${screenshotPath}"`;
    } else {
      // Linux
      command = `xdg-open "${screenshotPath}"`;
    }

    await execAsync(command);
    return true;
  } catch (error) {
    console.log(`⚠️  Could not open screenshot automatically: ${error.message}`);
    console.log(`   Please open manually: ${screenshotPath}`);
    return false;
  }
}

/**
 * Load temporal context for a judgment
 */
function loadTemporalContext(vllmJudgment) {
  // Try to find related screenshots/events in the same session
  const context = vllmJudgment.context || {};
  const sessionId = context.sessionId || context.testType;
  
  // Look for related judgments in the same session
  const relatedJudgments = [];
  const validationDir = join(process.cwd(), 'evaluation', 'human-validation');
  
  if (existsSync(validationDir)) {
    const files = readdirSync(validationDir);
    const vllmFiles = files.filter(f => f.startsWith('vllm-judgments-') && f.endsWith('.json'));
    
    for (const file of vllmFiles) {
      try {
        const content = JSON.parse(readFileSync(join(validationDir, file), 'utf-8'));
        if (content.judgments && Array.isArray(content.judgments)) {
          for (const judgment of content.judgments) {
            // Same session/context
            if (judgment.id !== vllmJudgment.id && 
                judgment.context?.testType === context.testType &&
                judgment.context?.sessionId === context.sessionId) {
              relatedJudgments.push(judgment);
            }
          }
        }
      } catch (error) {
        // Skip invalid files
      }
    }
  }
  
  // Sort by timestamp
  relatedJudgments.sort((a, b) => {
    const timeA = new Date(a.timestamp || 0).getTime();
    const timeB = new Date(b.timestamp || 0).getTime();
    return timeA - timeB;
  });
  
  return {
    sessionId,
    stage: context.stage || context.step || 'unknown',
    interaction: context.interaction || null,
    persona: context.persona || null,
    viewport: context.viewport || null,
    relatedScreenshots: relatedJudgments.slice(0, 5), // Show up to 5 related
    positionInSequence: relatedJudgments.findIndex(j => j.id === vllmJudgment.id) + 1,
    totalInSequence: relatedJudgments.length + 1
  };
}

/**
 * Create a simple HTML viewer for screenshot + VLLM judgment with temporal context
 */
function createHTMLViewer(vllmJudgment, outputPath) {
  const screenshotPath = vllmJudgment.screenshot;
  const screenshotExists = existsSync(screenshotPath);
  const temporalContext = loadTemporalContext(vllmJudgment);
  
  // Convert screenshot to base64 if it exists
  let screenshotData = '';
  if (screenshotExists) {
    try {
      const imageBuffer = readFileSync(screenshotPath);
      const imageBase64 = imageBuffer.toString('base64');
      const ext = screenshotPath.split('.').pop().toLowerCase();
      screenshotData = `data:image/${ext === 'png' ? 'png' : 'jpeg'};base64,${imageBase64}`;
    } catch (error) {
      // Fallback to file path
      screenshotData = `file://${screenshotPath}`;
    }
  }
  
  // Load related screenshots
  const relatedScreenshots = temporalContext.relatedScreenshots.map(j => {
    const path = j.screenshot;
    if (existsSync(path)) {
      try {
        const imageBuffer = readFileSync(path);
        const imageBase64 = imageBuffer.toString('base64');
        const ext = path.split('.').pop().toLowerCase();
        return {
          id: j.id,
          data: `data:image/${ext === 'png' ? 'png' : 'jpeg'};base64,${imageBase64}`,
          score: j.vllmScore,
          timestamp: j.timestamp
        };
      } catch (error) {
        return null;
      }
    }
    return null;
  }).filter(Boolean);

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
      max-width: 1600px;
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
    .context-info {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 10px;
      margin-top: 15px;
      font-size: 0.9em;
    }
    .context-item {
      background: #3a3a3a;
      padding: 8px 12px;
      border-radius: 4px;
    }
    .context-label {
      color: #888;
      font-size: 0.85em;
    }
    .context-value {
      color: #4a9eff;
      font-weight: 500;
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
    .temporal-context {
      background: #2a2a2a;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .temporal-context h3 {
      color: #4a9eff;
      margin-bottom: 15px;
    }
    .related-screenshots {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 15px;
      margin-top: 15px;
    }
    .related-screenshot {
      background: #3a3a3a;
      padding: 10px;
      border-radius: 8px;
      text-align: center;
      border: 2px solid transparent;
      transition: border-color 0.2s;
    }
    .related-screenshot:hover {
      border-color: #4a9eff;
    }
    .related-screenshot img {
      width: 100%;
      height: auto;
      border-radius: 4px;
      margin-bottom: 8px;
    }
    .related-screenshot .score {
      font-size: 18px;
      color: #4a9eff;
      margin: 5px 0;
    }
    .related-screenshot .timestamp {
      font-size: 0.75em;
      color: #888;
    }
    .sequence-indicator {
      background: #3a3a3a;
      padding: 10px;
      border-radius: 4px;
      margin-top: 10px;
      text-align: center;
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
    .evidence-section {
      background: #2a2a2a;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .evidence-section h3 {
      color: #4a9eff;
      margin-bottom: 15px;
    }
    .evidence-item {
      background: #3a3a3a;
      padding: 12px;
      margin: 8px 0;
      border-radius: 4px;
      border-left: 3px solid #4a9eff;
    }
    .evidence-label {
      color: #888;
      font-size: 0.85em;
      margin-bottom: 4px;
    }
    .evidence-value {
      color: #e0e0e0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>👤 Human Validation Request</h1>
      <p>Judgment ID: <code>${vllmJudgment.id}</code></p>
      <div class="context-info">
        <div class="context-item">
          <div class="context-label">Test Type</div>
          <div class="context-value">${vllmJudgment.context?.testType || 'unknown'}</div>
        </div>
        ${temporalContext.stage !== 'unknown' ? `
        <div class="context-item">
          <div class="context-label">Stage/Step</div>
          <div class="context-value">${temporalContext.stage}</div>
        </div>
        ` : ''}
        ${temporalContext.interaction ? `
        <div class="context-item">
          <div class="context-label">Interaction</div>
          <div class="context-value">${temporalContext.interaction}</div>
        </div>
        ` : ''}
        ${temporalContext.persona ? `
        <div class="context-item">
          <div class="context-label">Persona</div>
          <div class="context-value">${temporalContext.persona}</div>
        </div>
        ` : ''}
        ${temporalContext.viewport ? `
        <div class="context-item">
          <div class="context-label">Viewport</div>
          <div class="context-value">${temporalContext.viewport.width}×${temporalContext.viewport.height}</div>
        </div>
        ` : ''}
        ${temporalContext.totalInSequence > 1 ? `
        <div class="context-item">
          <div class="context-label">Position in Sequence</div>
          <div class="context-value">${temporalContext.positionInSequence || '?'} of ${temporalContext.totalInSequence}</div>
        </div>
        ` : ''}
      </div>
    </div>
    
    ${temporalContext.totalInSequence > 1 && relatedScreenshots.length > 0 ? `
    <div class="temporal-context">
      <h3>⏱️ Temporal Context - Related Screenshots in Sequence</h3>
      <div class="related-screenshots">
        ${relatedScreenshots.map((screenshot, idx) => `
          <div class="related-screenshot">
            <img src="${screenshot.data}" alt="Related screenshot ${idx + 1}">
            <div class="score">${screenshot.score}/10</div>
            <div class="timestamp">${new Date(screenshot.timestamp).toLocaleTimeString()}</div>
          </div>
        `).join('')}
      </div>
      <div class="sequence-indicator">
        This screenshot is part of a sequence. Review related screenshots above for temporal context.
      </div>
    </div>
    ` : ''}
    
    <div class="evidence-section">
      <h3>🔍 What Part of the Experience is Being Evaluated?</h3>
      <div class="evidence-item">
        <div class="evidence-label">Screenshot Evidence</div>
        <div class="evidence-value">${screenshotPath}</div>
      </div>
      <div class="evidence-item">
        <div class="evidence-label">Evaluation Prompt</div>
        <div class="evidence-value">${vllmJudgment.prompt}</div>
      </div>
      ${temporalContext.stage !== 'unknown' ? `
      <div class="evidence-item">
        <div class="evidence-label">Experience Stage</div>
        <div class="evidence-value">${temporalContext.stage}</div>
      </div>
      ` : ''}
      ${temporalContext.interaction ? `
      <div class="evidence-item">
        <div class="evidence-label">User Interaction</div>
        <div class="evidence-value">${temporalContext.interaction}</div>
      </div>
      ` : ''}
    </div>
    
    <div class="grid">
      <div class="panel screenshot-container">
        <h2>📸 Current Screenshot</h2>
        ${screenshotExists ? `<img src="${screenshotData}" alt="Screenshot">` : '<p>⚠️ Screenshot not found</p>'}
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
      <p>💡 Review the screenshot, temporal context, and VLLM judgment above.</p>
      <p>Then return to the terminal to provide your feedback (including freeform notes).</p>
      <p>This page will remain open for reference.</p>
    </div>
  </div>
</body>
</html>`;

  writeFileSync(outputPath, html);
  return outputPath;
}

/**
 * Open HTML viewer in browser
 */
async function openHTMLViewer(htmlPath) {
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
    return true;
  } catch (error) {
    console.log(`⚠️  Could not open HTML viewer: ${error.message}`);
    return false;
  }
}

/**
 * Create readline interface
 */
function createRLI() {
  return createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

/**
 * Prompt user for input
 */
function question(rl, prompt) {
  return new Promise(resolve => {
    rl.question(prompt, resolve);
  });
}

/**
 * Collect human judgment with real UI
 */
async function collectHumanJudgmentReal(vllmJudgment) {
  const rl = createRLI();
  
  try {
    console.log('\n' + '='.repeat(70));
    console.log('👤 Human Validation Request');
    console.log('='.repeat(70));
    
    // Create HTML viewer
    const htmlPath = join(process.cwd(), 'evaluation', 'validation-viewer.html');
    const htmlDir = join(process.cwd(), 'evaluation');
    if (!existsSync(htmlDir)) {
      const { mkdirSync } = await import('fs');
      mkdirSync(htmlDir, { recursive: true });
    }
    
    createHTMLViewer(vllmJudgment, htmlPath);
    console.log('\n📄 Opening HTML viewer with screenshot and VLLM judgment...');
    await openHTMLViewer(htmlPath);
    
    // Also try to open screenshot directly
    console.log('📸 Opening screenshot in default viewer...');
    await openScreenshot(vllmJudgment.screenshot);
    
    // Give user time to view
    console.log('\n⏳ Take a moment to review the screenshot and VLLM judgment...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Display VLLM judgment summary
    console.log('\n🤖 VLLM Judgment Summary:');
    console.log(`   Score: ${vllmJudgment.vllmScore}/10`);
    console.log(`   Issues: ${vllmJudgment.vllmIssues.join(', ') || 'None'}`);
    console.log(`   Reasoning: ${vllmJudgment.vllmReasoning.substring(0, 150)}...`);
    console.log(`   Test: ${vllmJudgment.context?.testType || 'unknown'}`);
    
    // Collect human score
    console.log('\n📝 Please provide your judgment:\n');
    
    let humanScore;
    while (true) {
      const scoreInput = await question(rl, '   Your Score (0-10): ');
      humanScore = parseInt(scoreInput, 10);
      if (!isNaN(humanScore) && humanScore >= 0 && humanScore <= 10) {
        break;
      }
      console.log('   ⚠️  Please enter a number between 0 and 10');
    }
    
    // Collect issues
    console.log('\n   Issues you found (comma-separated, or press Enter for none):');
    const issuesInput = await question(rl, '   ');
    const humanIssues = issuesInput.trim() 
      ? issuesInput.split(',').map(i => i.trim()).filter(i => i)
      : [];
    
    // Collect reasoning
    console.log('\n   Your reasoning (optional, press Enter to skip):');
    const humanReasoning = await question(rl, '   ') || `Human evaluation: ${humanScore}/10`;
    
    // Interactive explanation (late interaction)
    console.log('\n   💬 Interactive Explanation (optional):');
    console.log('   Ask the VLLM to explain its judgment. Type your question or press Enter to skip.');
    const explanationQuestion = await question(rl, '   Question: ');
    
    let explanation = null;
    if (explanationQuestion.trim()) {
      try {
        console.log('   🤔 Getting explanation from VLLM...');
        const { getExplanationManager } = await import('../../src/explanation-manager.mjs');
        const explanationManager = getExplanationManager();
        explanation = await explanationManager.explainJudgment(vllmJudgment, explanationQuestion.trim());
        console.log(`\n   💡 VLLM Explanation:`);
        console.log(`   ${explanation.answer.split('\n').join('\n   ')}`);
      } catch (error) {
        console.log(`   ⚠️  Could not get explanation: ${error.message}`);
      }
    }
    
    // Collect freeform notes
    console.log('\n   Freeform Notes (optional, press Enter to skip):');
    console.log('   💡 Add any additional observations, temporal context, or detailed feedback:');
    const freeformNotes = await question(rl, '   ') || '';
    
    // Optional: evaluator ID
    console.log('\n   Your ID (optional, for tracking):');
    const evaluatorId = await question(rl, '   ') || 'human-reviewer';
    
    // Show temporal context if available
    const temporalContext = loadTemporalContext(vllmJudgment);
    if (temporalContext.totalInSequence > 1) {
      console.log(`\n   ⏱️  Temporal Context: This is screenshot ${temporalContext.positionInSequence || '?'} of ${temporalContext.totalInSequence} in the sequence`);
      if (temporalContext.stage !== 'unknown') {
        console.log(`   📍 Stage: ${temporalContext.stage}`);
      }
    }
    
    const humanJudgment = {
      id: vllmJudgment.id,
      screenshot: vllmJudgment.screenshot,
      prompt: vllmJudgment.prompt,
      humanScore,
      humanIssues,
      humanReasoning,
      freeformNotes: freeformNotes.trim() || null,
      explanation: explanation ? {
        question: explanation.question,
        answer: explanation.answer,
        timestamp: explanation.timestamp
      } : null,
      temporalContext: temporalContext.totalInSequence > 1 ? {
        positionInSequence: temporalContext.positionInSequence,
        totalInSequence: temporalContext.totalInSequence,
        stage: temporalContext.stage,
        interaction: temporalContext.interaction
      } : null,
      timestamp: new Date().toISOString(),
      evaluatorId
    };
    
    // Save human judgment
    collectHumanJudgment(humanJudgment);
    
    console.log('\n✅ Human judgment saved!');
    console.log(`   Your score: ${humanScore}/10`);
    console.log(`   VLLM score: ${vllmJudgment.vllmScore}/10`);
    const diff = Math.abs(humanScore - vllmJudgment.vllmScore);
    console.log(`   Difference: ${diff} point${diff !== 1 ? 's' : ''}`);
    if (diff > 2) {
      console.log(`   ⚠️  Significant difference - this will help calibrate the system`);
    }
    console.log();
    
    return humanJudgment;
  } finally {
    rl.close();
  }
}

/**
 * Load pending VLLM judgments
 */
function loadPendingVLLMJudgments() {
  const manager = getHumanValidationManager();
  const vllmJudgments = manager.vllmJudgments || [];
  
  // Also load from disk
  if (existsSync(VALIDATION_DIR)) {
    const files = readdirSync(VALIDATION_DIR);
    const vllmFiles = files.filter(f => f.startsWith('vllm-judgments-') && f.endsWith('.json'));
    for (const file of vllmFiles) {
      try {
        const content = JSON.parse(readFileSync(join(VALIDATION_DIR, file), 'utf-8'));
        if (content.judgments && Array.isArray(content.judgments)) {
          vllmJudgments.push(...content.judgments);
        }
      } catch (error) {
        // Skip invalid files
      }
    }
  }
  
  // Check which ones already have human judgments
  const humanJudgmentFiles = existsSync(VALIDATION_DIR)
    ? readdirSync(VALIDATION_DIR).filter(f => f.startsWith('human-') && f.endsWith('.json'))
    : [];
  
  const humanJudgmentIds = new Set(
    humanJudgmentFiles.map(f => f.replace('human-', '').replace('.json', ''))
  );
  
  // Return VLLM judgments that don't have human judgments yet
  return vllmJudgments.filter(j => !humanJudgmentIds.has(j.id));
}

/**
 * Main human feedback collection loop
 */
async function collectRealHumanFeedback() {
  console.log('👤 Real Human Feedback Collection\n');
  console.log('='.repeat(70));
  console.log('This tool opens screenshots and VLLM judgments for you to review.');
  console.log('Your feedback will be used to calibrate the VLLM system.\n');
  
  const pending = loadPendingVLLMJudgments();
  
  if (pending.length === 0) {
    console.log('✅ No pending validations found.');
    console.log('   Run some evaluations with human validation enabled first.\n');
    return;
  }
  
  console.log(`📊 Found ${pending.length} pending VLLM judgment${pending.length !== 1 ? 's' : ''}\n`);
  console.log('You can:');
  console.log('  - Review all pending judgments');
  console.log('  - Review specific judgment by number');
  console.log('  - Skip to calibration\n');
  
  const rl = createRLI();
  
  try {
    const mode = await question(rl, 'Review mode (all/specific/skip): ');
    
    if (mode === 'skip') {
      console.log('\n⏭️  Skipping to calibration...');
      const manager = getHumanValidationManager();
      const result = await manager.calibrate();
      if (result.success) {
        console.log(`✅ Calibrated with ${result.sampleSize} judgments`);
      } else {
        console.log(`⚠️  ${result.message}`);
      }
      return;
    }
    
    let judgmentsToReview = [];
    
    if (mode === 'all') {
      judgmentsToReview = pending;
      console.log(`\n📋 Reviewing all ${pending.length} pending judgment${pending.length !== 1 ? 's' : ''}\n`);
    } else if (mode === 'specific') {
      console.log('\nAvailable judgments:');
      pending.forEach((j, i) => {
        console.log(`   ${i + 1}. ID: ${j.id.substring(0, 20)}..., Score: ${j.vllmScore}/10, Test: ${j.context?.testType || 'unknown'}`);
      });
      
      const selection = await question(rl, '\nEnter judgment number: ');
      const index = parseInt(selection, 10) - 1;
      if (index >= 0 && index < pending.length) {
        judgmentsToReview = [pending[index]];
      } else {
        console.log('❌ Invalid selection');
        return;
      }
    } else {
      console.log('❌ Invalid mode');
      return;
    }
    
    // Review each judgment
    for (let i = 0; i < judgmentsToReview.length; i++) {
      const judgment = judgmentsToReview[i];
      console.log(`\n[${i + 1}/${judgmentsToReview.length}] Reviewing judgment: ${judgment.id.substring(0, 20)}...`);
      
      const continueReview = await question(rl, 'Review this judgment? (y/n/q to quit): ');
      if (continueReview.toLowerCase() === 'q') {
        console.log('\n⏭️  Quitting review...');
        break;
      }
      if (continueReview.toLowerCase() !== 'y') {
        console.log('⏭️  Skipping...');
        continue;
      }
      
      await collectHumanJudgmentReal(judgment);
    }
    
    // Offer calibration
    console.log('\n📊 Review complete!');
    const calibrate = await question(rl, 'Run calibration now? (y/n): ');
    if (calibrate.toLowerCase() === 'y') {
      const manager = getHumanValidationManager();
      const result = await manager.calibrate();
      if (result.success) {
        console.log(`\n✅ Calibration successful!`);
        console.log(`   Sample size: ${result.sampleSize}`);
        console.log(`   Correlation: ${result.calibration.agreement.pearson.toFixed(3)}`);
        console.log(`   Kappa: ${result.calibration.agreement.kappa.toFixed(3)}`);
        console.log(`   MAE: ${result.calibration.agreement.mae.toFixed(3)}`);
      } else {
        console.log(`\n⚠️  ${result.message}`);
      }
    }
    
  } finally {
    rl.close();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  collectRealHumanFeedback().catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
}

export { collectRealHumanFeedback, collectHumanJudgmentReal };

