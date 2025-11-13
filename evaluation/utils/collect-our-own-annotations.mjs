#!/usr/bin/env node
/**
 * Collect Our Own Human Annotations
 * 
 * Framework for collecting human annotations on our own samples.
 * This creates REAL human ground truth by having humans annotate screenshots.
 * 
 * Workflow:
 * 1. Create annotation tasks from dataset samples
 * 2. Humans annotate (score, issues, reasoning)
 * 3. Integrate annotations back into dataset
 * 4. Validate quality
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { createInterface } from 'readline';

const ANNOTATIONS_DIR = join(process.cwd(), 'evaluation', 'datasets', 'human-annotations');
const TASKS_DIR = join(ANNOTATIONS_DIR, 'tasks');
const COMPLETED_DIR = join(ANNOTATIONS_DIR, 'completed');

if (!existsSync(ANNOTATIONS_DIR)) {
  mkdirSync(ANNOTATIONS_DIR, { recursive: true });
}
if (!existsSync(TASKS_DIR)) {
  mkdirSync(TASKS_DIR, { recursive: true });
}
if (!existsSync(COMPLETED_DIR)) {
  mkdirSync(COMPLETED_DIR, { recursive: true });
}

/**
 * Create annotation task from sample
 */
function createTask(sample, annotatorId) {
  return {
    id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    sampleId: sample.id,
    sampleName: sample.name,
    screenshot: sample.screenshot,
    url: sample.url,
    category: sample.category,
    prompt: `Evaluate this ${sample.category} webpage. Consider:
- Visual design and aesthetics
- Accessibility and usability  
- Layout and information hierarchy
- User experience
- Any issues or problems`,
    expectedScore: sample.groundTruth?.expectedScore || null,
    knownGood: sample.groundTruth?.knownGood || [],
    knownBad: sample.groundTruth?.knownBad || [],
    annotatorId,
    status: 'pending',
    createdAt: new Date().toISOString()
  };
}

/**
 * Collect annotation interactively
 */
async function collectAnnotation(task) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const question = (prompt) => new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
  
  try {
    console.log(`\n📋 Annotating: ${task.sampleName}`);
    console.log(`   Category: ${task.category}`);
    if (task.url) console.log(`   URL: ${task.url}`);
    if (task.expectedScore) {
      console.log(`   Expected: ${task.expectedScore.min}-${task.expectedScore.max}`);
    }
    
    // Score
    let score;
    while (true) {
      const input = await question('\n📊 Score (0-10): ');
      score = parseFloat(input);
      if (!isNaN(score) && score >= 0 && score <= 10) break;
      console.log('   ⚠️  Enter 0-10');
    }
    
    // Issues
    console.log('\n🐛 Issues (Enter after each, empty to finish):');
    const issues = [];
    while (true) {
      const issue = await question('   Issue: ');
      if (!issue.trim()) break;
      issues.push(issue.trim());
    }
    
    // Reasoning
    console.log('\n💭 Reasoning (Enter twice to finish):');
    const lines = [];
    let emptyCount = 0;
    while (emptyCount < 2) {
      const line = await question('   ');
      if (!line.trim()) {
        emptyCount++;
      } else {
        emptyCount = 0;
        lines.push(line);
      }
    }
    const reasoning = lines.join('\n');
    
    return {
      id: task.id,
      sampleId: task.sampleId,
      humanScore: score,
      humanIssues: issues,
      humanReasoning: reasoning,
      annotatorId: task.annotatorId,
      timestamp: new Date().toISOString(),
      expectedScore: task.expectedScore,
      difference: task.expectedScore 
        ? score - ((task.expectedScore.min + task.expectedScore.max) / 2)
        : null
    };
  } finally {
    rl.close();
  }
}

/**
 * Create tasks from dataset
 */
function createTasks(datasetPath, annotatorId) {
  const dataset = JSON.parse(readFileSync(datasetPath, 'utf-8'));
  const tasks = [];
  
  for (const sample of dataset.samples || []) {
    // Skip if already annotated
    if (sample.groundTruth?.humanAnnotations?.humanScore !== null) {
      continue;
    }
    
    const task = createTask(sample, annotatorId);
    tasks.push(task);
    
    writeFileSync(
      join(TASKS_DIR, `${task.id}.json`),
      JSON.stringify(task, null, 2)
    );
  }
  
  return tasks;
}

/**
 * Process annotation task
 */
async function processTask(taskId) {
  const taskPath = join(TASKS_DIR, `${taskId}.json`);
  if (!existsSync(taskPath)) {
    throw new Error(`Task not found: ${taskId}`);
  }
  
  const task = JSON.parse(readFileSync(taskPath, 'utf-8'));
  const annotation = await collectAnnotation(task);
  
  // Save annotation
  writeFileSync(
    join(COMPLETED_DIR, `${annotation.id}.json`),
    JSON.stringify(annotation, null, 2)
  );
  
  // Mark task complete
  task.status = 'completed';
  writeFileSync(taskPath, JSON.stringify(task, null, 2));
  
  return annotation;
}

/**
 * Integrate annotations into dataset
 */
function integrateAnnotations(datasetPath) {
  const dataset = JSON.parse(readFileSync(datasetPath, 'utf-8'));
  const files = readdirSync(COMPLETED_DIR).filter(f => f.endsWith('.json'));
  
  let count = 0;
  for (const file of files) {
    const annotation = JSON.parse(readFileSync(join(COMPLETED_DIR, file), 'utf-8'));
    const sample = dataset.samples.find(s => s.id === annotation.sampleId);
    
    if (sample) {
      if (!sample.groundTruth.humanAnnotations) {
        sample.groundTruth.humanAnnotations = {};
      }
      sample.groundTruth.humanAnnotations = {
        humanScore: annotation.humanScore,
        humanIssues: annotation.humanIssues,
        humanReasoning: annotation.humanReasoning,
        annotatorId: annotation.annotatorId,
        timestamp: annotation.timestamp
      };
      count++;
    }
  }
  
  writeFileSync(datasetPath, JSON.stringify(dataset, null, 2));
  return count;
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const cmd = process.argv[2];
  
  if (cmd === 'create-tasks') {
    const dataset = process.argv[3] || join(process.cwd(), 'evaluation', 'datasets', 'real-dataset.json');
    const annotator = process.argv[4] || 'annotator-1';
    const tasks = createTasks(dataset, annotator);
    console.log(`✅ Created ${tasks.length} tasks`);
  } else if (cmd === 'list') {
    const files = readdirSync(TASKS_DIR).filter(f => f.endsWith('.json'));
    console.log(`\n📋 Pending Tasks: ${files.length}\n`);
    for (const file of files) {
      const task = JSON.parse(readFileSync(join(TASKS_DIR, file), 'utf-8'));
      if (task.status === 'pending') {
        console.log(`   ${task.id}: ${task.sampleName} (${task.category})`);
      }
    }
  } else if (cmd === 'annotate') {
    const taskId = process.argv[3];
    if (!taskId) {
      console.error('❌ Provide task ID');
      process.exit(1);
    }
    processTask(taskId).then(ann => {
      console.log(`\n✅ Annotation saved!`);
      console.log(`   Score: ${ann.humanScore}/10`);
      console.log(`   Issues: ${ann.humanIssues.length}`);
    });
  } else if (cmd === 'integrate') {
    const dataset = process.argv[3] || join(process.cwd(), 'evaluation', 'datasets', 'real-dataset.json');
    const count = integrateAnnotations(dataset);
    console.log(`✅ Integrated ${count} annotations`);
  } else {
    console.log(`
Human Annotation Collection

Usage:
  create-tasks [dataset] [annotator]  - Create annotation tasks
  list                                 - List pending tasks
  annotate <task-id>                   - Annotate a task
  integrate [dataset]                  - Integrate annotations
`);
  }
}

export { createTask, collectAnnotation, createTasks, processTask, integrateAnnotations };

