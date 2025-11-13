#!/usr/bin/env node
/**
 * Invoke Human Annotation - Actually Ask the Human
 * 
 * This script actually prompts the human for their opinion.
 * It's the real interactive annotation workflow.
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { createInterface } from 'readline';
import { processAnnotationTask } from './collect-human-annotations.mjs';
import { batchAnnotate, loadVLLMJudgments } from './enhanced-annotation-workflow.mjs';

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt) => new Promise((resolve) => {
  rl.question(prompt, resolve);
});

import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

/**
 * Open screenshot in default viewer
 */
async function openScreenshot(screenshotPath) {
  if (!screenshotPath || !existsSync(screenshotPath)) {
    return false;
  }
  
  try {
    const platform = process.platform;
    if (platform === 'darwin') {
      await execAsync(`open "${screenshotPath}"`);
    } else if (platform === 'linux') {
      await execAsync(`xdg-open "${screenshotPath}"`);
    } else if (platform === 'win32') {
      await execAsync(`start "" "${screenshotPath}"`);
    }
    return true;
  } catch (error) {
    return false;
  }
}

async function invokeHumanAnnotation() {
  // Clear screen and show professional header
  console.clear();
  console.log('═'.repeat(80));
  console.log(' '.repeat(25) + 'WEBPAGE QUALITY ANNOTATION');
  console.log('═'.repeat(80));
  console.log('');
  console.log('INSTRUCTIONS:');
  console.log('  You will evaluate webpage screenshots on a scale of 0-10.');
  console.log('  Consider: visual design, accessibility, usability, and user experience.');
  console.log('  Provide a score, list any issues you notice, and explain your reasoning.');
  console.log('');
  console.log('─'.repeat(80));
  console.log('');
  
  // Find pending tasks
  const pendingDir = join(process.cwd(), 'evaluation', 'datasets', 'human-annotations', 'pending');
  if (!existsSync(pendingDir)) {
    console.log('❌ No pending tasks found. Creating tasks first...');
    const { createAnnotationTasks } = await import('./collect-human-annotations.mjs');
    const datasetPath = join(process.cwd(), 'evaluation', 'datasets', 'real-dataset.json');
    const tasks = createAnnotationTasks(datasetPath, 'human-annotator');
    if (tasks.length === 0) {
      console.log('✅ All samples already annotated!');
      rl.close();
      return;
    }
    console.log(`✅ Created ${tasks.length} tasks\n`);
  }
  
  const files = readdirSync(pendingDir).filter(f => f.endsWith('.json'));
  if (files.length === 0) {
    console.log('✅ No pending tasks. All done!');
    rl.close();
    return;
  }
  
  // Load tasks
  const tasks = files.map(f => {
    const task = JSON.parse(readFileSync(join(pendingDir, f), 'utf-8'));
    return { ...task, filename: f };
  }).filter(t => t.status === 'pending');
  
  if (tasks.length === 0) {
    console.log('✅ No pending tasks. All done!');
    rl.close();
    return;
  }
  
  console.log(`📋 Found ${tasks.length} tasks ready for YOUR annotation\n`);
  
  // Show first few tasks
  tasks.slice(0, 5).forEach((task, i) => {
    console.log(`${i + 1}. ${task.sampleName}`);
    if (task.url) console.log(`   URL: ${task.url}`);
    if (task.expectedScore) {
      console.log(`   Expected: ${task.expectedScore.min}-${task.expectedScore.max}`);
    }
    console.log(`   Task ID: ${task.id}`);
    console.log('');
  });
  
  if (tasks.length > 5) {
    console.log(`   ... and ${tasks.length - 5} more\n`);
  }
  
  // Ask which task to annotate
  const taskChoice = await question(`Which task would you like to annotate? (1-${Math.min(tasks.length, 5)}) or enter task ID: `);
  
  let selectedTask;
  const taskIndex = parseInt(taskChoice) - 1;
  if (taskIndex >= 0 && taskIndex < tasks.length) {
    selectedTask = tasks[taskIndex];
  } else {
    // Try to find by ID
    selectedTask = tasks.find(t => t.id === taskChoice.trim());
    if (!selectedTask) {
      console.log('❌ Task not found');
      rl.close();
      return;
    }
  }
  
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`📋 Annotating: ${selectedTask.sampleName}`);
  console.log(`${'─'.repeat(60)}\n`);
  
  if (selectedTask.category && selectedTask.category !== 'undefined') {
    console.log(`📁 Category: ${selectedTask.category}`);
  }
  if (selectedTask.url) {
    console.log(`🔗 URL: ${selectedTask.url}`);
    console.log(`   (You can visit this URL to see the actual page)`);
  }
  if (selectedTask.screenshot) {
    const screenshotPath = selectedTask.screenshot.replace(process.cwd(), '.');
    console.log(`📸 Screenshot: ${screenshotPath}`);
  }
  if (selectedTask.expectedScore) {
    console.log(`📊 Expected Score Range: ${selectedTask.expectedScore.min}-${selectedTask.expectedScore.max}`);
    console.log(`   (This is just a guideline - use your own judgment)`);
  }
  if (selectedTask.knownGood && selectedTask.knownGood.length > 0) {
    console.log(`\n✅ Known Good Features:`);
    selectedTask.knownGood.forEach(feature => {
      console.log(`   • ${feature}`);
    });
  }
  if (selectedTask.knownBad && selectedTask.knownBad.length > 0) {
    console.log(`\n❌ Known Bad Features:`);
    selectedTask.knownBad.forEach(feature => {
      console.log(`   • ${feature}`);
    });
  }
  
  if (selectedTask.prompt) {
    console.log(`\n📝 Evaluation Prompt:`);
    console.log(`   ${selectedTask.prompt.split('\n').slice(0, 2).join('\n   ')}`);
  }
  
  console.log('');
  
  // Load VLLM judgment if available
  const vllmDir = join(process.cwd(), 'evaluation', 'human-validation');
  const vllmJudgments = loadVLLMJudgments(vllmDir);
  const vllmJudgment = Object.values(vllmJudgments).find(v => 
    v.screenshot === selectedTask.screenshot || 
    v.url === selectedTask.url
  );
  
  // Show VLLM judgment if available (for comparison, not to bias)
  if (vllmJudgment) {
    console.log('REFERENCE (AI EVALUATION - FOR COMPARISON ONLY):');
    console.log(`  AI Score:    ${vllmJudgment.vllmScore || vllmJudgment.score}/10`);
    if (vllmJudgment.vllmIssues?.length > 0) {
      console.log(`  AI Issues:   ${vllmJudgment.vllmIssues.join(', ')}`);
    }
    console.log(`  Note:        This is for comparison only. Use your own judgment.`);
    console.log('');
    console.log('─'.repeat(80));
    console.log('');
  }
  
  // NOW ASK THE HUMAN - Professional format
  console.log('YOUR EVALUATION');
  console.log('─'.repeat(80));
  console.log('');
  
  // Score with clear instructions
  console.log('SCORE (0-10):');
  console.log('  Based on the rubric above, rate the OVERALL quality of this webpage.');
  console.log('  Consider all four dimensions: Visual Design, Accessibility, Information Architecture, UX');
  console.log('');
  console.log('  Quick Reference:');
  console.log('    0-3: Poor    - Major issues, unusable');
  console.log('    4-6: Fair    - Functional but needs improvement');
  console.log('    7-8: Good    - Minor issues, well-designed');
  console.log('    9-10: Excellent - Outstanding, highly usable');
  console.log('');
  let humanScore;
  while (true) {
    const scoreInput = await question('Enter overall score (0-10): ');
    humanScore = parseFloat(scoreInput);
    if (!isNaN(humanScore) && humanScore >= 0 && humanScore <= 10) {
      // Optional: Ask for breakdown
      const wantBreakdown = await question('  Would you like to provide scores for each dimension? (y/n): ');
      if (wantBreakdown.toLowerCase() === 'y') {
        console.log('');
        console.log('  Dimension Scores (optional, press Enter to skip):');
        const visualScore = await question('    Visual Design (0-10): ');
        const accessibilityScore = await question('    Accessibility (0-10): ');
        const infoArchScore = await question('    Information Architecture (0-10): ');
        const uxScore = await question('    User Experience (0-10): ');
        // Store these if provided (could add to annotation object)
      }
      break;
    }
    console.log('  ERROR: Please enter a number between 0 and 10');
  }
  console.log('');
  
  // Issues with clear instructions
  console.log('ISSUES:');
  console.log('  List specific problems, bugs, or concerns you noticed while reviewing the screenshot.');
  console.log('  Be specific: e.g., "Low contrast in header text (WCAG violation)" not just "bad contrast"');
  console.log('  Consider:');
  console.log('    • Accessibility issues (contrast, keyboard nav, screen reader support)');
  console.log('    • Usability problems (confusing navigation, unclear CTAs)');
  console.log('    • Design flaws (cluttered layout, poor spacing, inconsistent styling)');
  console.log('    • Functional issues (broken elements, missing features)');
  console.log('');
  console.log('  Press Enter after each issue. Press Enter on an empty line when done.');
  console.log('');
  const humanIssues = [];
  let issueNum = 1;
  while (true) {
    const issue = await question(`Issue ${issueNum} (or press Enter to finish): `);
    if (!issue.trim()) break;
    humanIssues.push(issue.trim());
    issueNum++;
  }
  if (humanIssues.length === 0) {
    const noIssues = await question('  No issues? Type "none" to confirm, or list issues: ');
    if (noIssues.toLowerCase() === 'none') {
      humanIssues.push('No issues found');
    } else if (noIssues.trim()) {
      humanIssues.push(noIssues.trim());
    }
  }
  console.log('');
  
  // Reasoning with clear instructions
  console.log('REASONING:');
  console.log('  Explain your score in detail. This helps validate your judgment.');
  console.log('');
  console.log('  Please address:');
  console.log('    1. What stood out (positive or negative)?');
  console.log('    2. What worked well?');
  console.log('    3. What needs improvement?');
  console.log('    4. How did each dimension (Visual, Accessibility, IA, UX) contribute to your score?');
  console.log('');
  console.log('  Example: "The design is clean and modern with good use of whitespace.');
  console.log('           Navigation is clear and accessible. However, text contrast in the');
  console.log('           header is below WCAG AA standards. Overall, it\'s a well-designed');
  console.log('           page with minor accessibility issues."');
  console.log('');
  console.log('  Press Enter twice (empty line) when finished.');
  console.log('');
  const reasoningLines = [];
  let emptyCount = 0;
  while (emptyCount < 2) {
    const line = await question('  ');
    if (!line.trim()) {
      emptyCount++;
    } else {
      emptyCount = 0;
      reasoningLines.push(line);
    }
  }
  const humanReasoning = reasoningLines.join('\n').trim();
  
  if (!humanReasoning || humanReasoning.length < 50) {
    console.log('');
    console.log('  WARNING: Reasoning seems brief. Please provide more detail.');
    console.log('  Minimum 50 characters recommended for quality validation.');
    const moreReason = await question('  Add more detail (or press Enter to continue): ');
    if (moreReason.trim()) {
      reasoningLines.push(moreReason.trim());
    }
  }
  
  // Show summary for confirmation
  console.log('');
  console.log('─'.repeat(80));
  console.log('ANNOTATION SUMMARY');
  console.log('─'.repeat(80));
  console.log('');
  console.log(`Score:      ${humanScore}/10`);
  console.log(`Issues:     ${humanIssues.length} issue${humanIssues.length !== 1 ? 's' : ''} identified`);
  if (humanIssues.length > 0) {
    humanIssues.forEach((issue, i) => {
      console.log(`            ${i + 1}. ${issue}`);
    });
  }
  console.log(`Reasoning:  ${humanReasoning.length} characters`);
  if (humanReasoning.length > 0) {
    const preview = humanReasoning.split('\n')[0].substring(0, 70);
    console.log(`            "${preview}${humanReasoning.length > 70 ? '...' : ''}"`);
  }
  console.log('');
  
  if (vllmJudgment) {
    const scoreDiff = humanScore - (vllmJudgment.vllmScore || vllmJudgment.score);
    console.log('COMPARISON WITH AI:');
    console.log(`  Your Score:    ${humanScore}/10`);
    console.log(`  AI Score:       ${vllmJudgment.vllmScore || vllmJudgment.score}/10`);
    console.log(`  Difference:    ${scoreDiff > 0 ? '+' : ''}${scoreDiff.toFixed(1)} point${Math.abs(scoreDiff) !== 1 ? 's' : ''}`);
    console.log('');
  }
  
  console.log('─'.repeat(80));
  const confirm = await question('\nSave this annotation? (y/n): ');
  
  if (confirm.toLowerCase() === 'y' || confirm.toLowerCase() === 'yes') {
    // Save annotation
    const annotation = {
      id: selectedTask.id,
      sampleId: selectedTask.sampleId,
      screenshot: selectedTask.screenshot,
      url: selectedTask.url,
      category: selectedTask.category,
      prompt: selectedTask.prompt,
      humanScore,
      humanIssues,
      humanReasoning: reasoningLines.join('\n').trim(),
      annotatorId: selectedTask.annotatorId,
      timestamp: new Date().toISOString(),
      expectedScore: selectedTask.expectedScore,
      difference: selectedTask.expectedScore 
        ? humanScore - ((selectedTask.expectedScore.min + selectedTask.expectedScore.max) / 2)
        : null
    };
    
    const completedDir = join(process.cwd(), 'evaluation', 'datasets', 'human-annotations', 'completed');
    const { mkdirSync, writeFileSync } = await import('fs');
    if (!existsSync(completedDir)) {
      mkdirSync(completedDir, { recursive: true });
    }
    
    const annotationPath = join(completedDir, `${annotation.id}.json`);
    writeFileSync(annotationPath, JSON.stringify(annotation, null, 2));
    
    // Mark task as completed
    selectedTask.status = 'completed';
    const taskPath = join(pendingDir, selectedTask.filename);
    writeFileSync(taskPath, JSON.stringify(selectedTask, null, 2));
    
    console.log('');
    console.log('═'.repeat(80));
    console.log('ANNOTATION SAVED SUCCESSFULLY');
    console.log('═'.repeat(80));
    console.log('');
    console.log(`Task:        ${selectedTask.sampleName}`);
    console.log(`Annotation:  ${annotationPath}`);
    console.log(`Score:       ${humanScore}/10`);
    console.log(`Issues:      ${humanIssues.length}`);
    console.log('');
    console.log('NEXT STEPS:');
    console.log('  1. Run "npm run annotate" again to annotate more tasks');
    console.log('  2. Run "node evaluation/utils/collect-human-annotations.mjs integrate" to integrate annotations');
    console.log('  3. Run "npm run validate:annotations" to validate quality');
    console.log('');
  } else {
    console.log('');
    console.log('ANNOTATION CANCELLED');
    console.log('Your responses were not saved.');
    console.log('');
  }
  
  rl.close();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  invokeHumanAnnotation().catch(error => {
    console.error('Error:', error.message);
    rl.close();
    process.exit(1);
  });
}

export { invokeHumanAnnotation };

