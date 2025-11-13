#!/usr/bin/env node
/**
 * Quick Start Annotation
 * 
 * Simplest possible entry point for human annotation.
 * Just run this and follow the prompts.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { createInterface } from 'readline';
import { createAnnotationTasks } from './collect-human-annotations.mjs';
import { batchAnnotate, loadVLLMJudgments } from './enhanced-annotation-workflow.mjs';

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt) => new Promise((resolve) => {
  rl.question(prompt, resolve);
});

async function quickStart() {
  console.log('\n👋 Quick Start: Human Annotation\n');
  console.log('This will help you annotate screenshots for validation.\n');
  
  // Find default dataset
  const defaultDataset = join(process.cwd(), 'evaluation', 'datasets', 'real-dataset.json');
  
  if (!existsSync(defaultDataset)) {
    console.log('❌ Default dataset not found. Please create a dataset first.');
    console.log(`   Expected: ${defaultDataset}`);
    rl.close();
    return;
  }
  
  const dataset = JSON.parse(readFileSync(defaultDataset, 'utf-8'));
  const unannotated = (dataset.samples || []).filter(s => {
    const hasAnnotation = s.groundTruth?.humanAnnotations?.humanScore !== null && 
                         s.groundTruth?.humanAnnotations?.humanScore !== undefined;
    return !hasAnnotation;
  });
  
  if (unannotated.length === 0) {
    console.log('✅ All samples already annotated!');
    rl.close();
    return;
  }
  
  console.log(`Found ${unannotated.length} samples needing annotation.`);
  const annotatorId = await question('Enter your name/ID: ') || 'human-annotator';
  
  console.log(`\n📝 Creating annotation tasks...`);
  const tasks = createAnnotationTasks(defaultDataset, annotatorId);
  console.log(`✅ Created ${tasks.length} tasks\n`);
  
  // Load VLLM judgments if available
  const vllmDir = join(process.cwd(), 'evaluation', 'human-validation');
  const vllmJudgments = loadVLLMJudgments(vllmDir);
  
  if (Object.keys(vllmJudgments).length > 0) {
    console.log(`🤖 Found ${Object.keys(vllmJudgments).length} VLLM judgments for comparison\n`);
  }
  
  const howMany = await question(`How many tasks to annotate now? (1-${tasks.length}): `);
  const count = Math.min(parseInt(howMany) || 1, tasks.length);
  
  console.log(`\n🚀 Starting annotation of ${count} tasks...\n`);
  console.log('─'.repeat(60));
  
  const taskIds = tasks.slice(0, count).map(t => t.id);
  const results = await batchAnnotate(taskIds, {
    vllmJudgments,
    maxPerSession: count,
    showProgress: true
  });
  
  console.log('\n' + '─'.repeat(60));
  console.log(`\n✅ Done!`);
  console.log(`   Completed: ${results.completed.length}`);
  console.log(`   Skipped: ${results.skipped.length}`);
  console.log(`   Failed: ${results.failed.length}`);
  
  if (results.completed.length > 0) {
    console.log(`\n💡 Next steps:`);
    console.log(`   - Run again to annotate more tasks`);
    console.log(`   - Run: node evaluation/utils/collect-human-annotations.mjs integrate`);
    console.log(`   - Run: node evaluation/utils/validate-annotation-quality.mjs`);
  }
  
  rl.close();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  quickStart().catch(error => {
    console.error('Error:', error.message);
    rl.close();
    process.exit(1);
  });
}

export { quickStart };

