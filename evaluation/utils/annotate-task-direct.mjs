#!/usr/bin/env node
/**
 * Annotate Task Directly
 * 
 * Direct annotation of a specific task with provided values.
 * Useful for testing or programmatic annotation.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { processAnnotationTask } from './collect-human-annotations.mjs';

async function annotateTaskDirect(taskId, annotation) {
  const { humanScore, humanIssues, humanReasoning } = annotation;
  
  // Validate
  if (humanScore === undefined || humanScore < 0 || humanScore > 10) {
    throw new Error('Invalid score: must be 0-10');
  }
  if (!Array.isArray(humanIssues)) {
    throw new Error('Issues must be an array');
  }
  if (!humanReasoning || humanReasoning.trim().length < 10) {
    throw new Error('Reasoning must be at least 10 characters');
  }
  
  // Load task
  const taskPath = join(process.cwd(), 'evaluation', 'datasets', 'human-annotations', 'pending', `${taskId}.json`);
  if (!existsSync(taskPath)) {
    throw new Error(`Task not found: ${taskId}`);
  }
  
  const task = JSON.parse(readFileSync(taskPath, 'utf-8'));
  
  // Create annotation
  const annotationData = {
    id: task.id,
    sampleId: task.sampleId,
    screenshot: task.screenshot,
    url: task.url,
    category: task.category,
    prompt: task.prompt,
    humanScore,
    humanIssues,
    humanReasoning,
    annotatorId: task.annotatorId,
    timestamp: new Date().toISOString(),
    expectedScore: task.expectedScore,
    difference: task.expectedScore 
      ? humanScore - ((task.expectedScore.min + task.expectedScore.max) / 2)
      : null
  };
  
  // Save annotation
  const completedDir = join(process.cwd(), 'evaluation', 'datasets', 'human-annotations', 'completed');
  if (!existsSync(completedDir)) {
    const { mkdirSync } = await import('fs');
    mkdirSync(completedDir, { recursive: true });
  }
  
  const annotationPath = join(completedDir, `${annotationData.id}.json`);
  writeFileSync(annotationPath, JSON.stringify(annotationData, null, 2));
  
  // Mark task as completed
  task.status = 'completed';
  writeFileSync(taskPath, JSON.stringify(task, null, 2));
  
  return annotationData;
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const taskId = process.argv[2];
  const score = parseFloat(process.argv[3]);
  const issues = process.argv[4] ? process.argv[4].split(',').map(i => i.trim()) : [];
  const reasoning = process.argv[5] || 'No reasoning provided';
  
  if (!taskId || isNaN(score)) {
    console.log(`
Usage: node evaluation/utils/annotate-task-direct.mjs <task-id> <score> <issues> <reasoning>

Example:
  node evaluation/utils/annotate-task-direct.mjs annotation-123 8 "good design,clear navigation" "Professional design with good navigation."
`);
    process.exit(1);
  }
  
  annotateTaskDirect(taskId, {
    humanScore: score,
    humanIssues: issues,
    humanReasoning: reasoning
  }).then(ann => {
    console.log('✅ Annotation saved!');
    console.log(`   Score: ${ann.humanScore}/10`);
    console.log(`   Issues: ${ann.humanIssues.length}`);
    console.log(`   Saved: evaluation/datasets/human-annotations/completed/${ann.id}.json`);
  }).catch(error => {
    console.error('❌ Error:', error.message);
    process.exit(1);
  });
}

export { annotateTaskDirect };

