#!/usr/bin/env node
/**
 * Start Human Annotation Workflow
 * 
 * Simple entry point for humans to start annotating.
 * This is the main script a human should run to begin annotation.
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { createInterface } from 'readline';
import { createAnnotationTasks, processAnnotationTask, listPendingTasks, integrateAnnotations } from './collect-human-annotations.mjs';
import { batchAnnotate, loadVLLMJudgments } from './enhanced-annotation-workflow.mjs';
import { validateAnnotationQuality } from './validate-annotation-quality.mjs';

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt) => new Promise((resolve) => {
  rl.question(prompt, resolve);
});

/**
 * Main menu
 */
async function showMenu() {
  console.log('\n📋 Human Annotation Workflow\n');
  console.log('1. Start annotating (create tasks from dataset)');
  console.log('2. List pending tasks');
  console.log('3. Annotate a specific task');
  console.log('4. Batch annotate (multiple tasks)');
  console.log('5. Validate annotation quality');
  console.log('6. Integrate annotations into dataset');
  console.log('7. Show statistics');
  console.log('8. Exit\n');
  
  const choice = await question('Choose an option (1-8): ');
  return choice.trim();
}

/**
 * Start annotation workflow
 */
async function startAnnotation() {
  console.log('\n🚀 Starting Human Annotation Workflow\n');
  
  // Find available datasets
  const datasetsDir = join(process.cwd(), 'evaluation', 'datasets');
  const datasets = [];
  
  if (existsSync(datasetsDir)) {
    const files = readdirSync(datasetsDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const path = join(datasetsDir, file);
      try {
        const dataset = JSON.parse(readFileSync(path, 'utf-8'));
        if (dataset.samples && Array.isArray(dataset.samples)) {
          datasets.push({ name: file, path, count: dataset.samples.length });
        }
      } catch (e) {
        // Skip invalid files
      }
    }
  }
  
  if (datasets.length === 0) {
    console.log('❌ No datasets found. Please create a dataset first.');
    return;
  }
  
  console.log('Available datasets:');
  datasets.forEach((d, i) => {
    console.log(`  ${i + 1}. ${d.name} (${d.count} samples)`);
  });
  
  const datasetChoice = await question(`\nSelect dataset (1-${datasets.length}): `);
  const datasetIndex = parseInt(datasetChoice) - 1;
  
  if (datasetIndex < 0 || datasetIndex >= datasets.length) {
    console.log('❌ Invalid choice');
    return;
  }
  
  const selectedDataset = datasets[datasetIndex];
  const annotatorId = await question('Enter your annotator ID (e.g., your-name): ') || 'annotator-1';
  
  console.log(`\n📝 Creating annotation tasks from ${selectedDataset.name}...`);
  const tasks = createAnnotationTasks(selectedDataset.path, annotatorId);
  
  console.log(`✅ Created ${tasks.length} annotation tasks`);
  console.log(`\n💡 Next steps:`);
  console.log(`   - Run option 2 to list pending tasks`);
  console.log(`   - Run option 3 to annotate a task`);
  console.log(`   - Run option 4 to batch annotate multiple tasks`);
}

/**
 * List and annotate
 */
async function listAndAnnotate() {
  const tasks = listPendingTasks();
  
  if (tasks.length === 0) {
    console.log('\n✅ No pending tasks. All done!');
    return;
  }
  
  console.log(`\n📋 Pending Tasks: ${tasks.length}\n`);
  tasks.forEach((task, i) => {
    console.log(`  ${i + 1}. ${task.id}`);
    console.log(`     Sample: ${task.sampleName}`);
    console.log(`     Category: ${task.category}`);
    console.log(`     Created: ${new Date(task.createdAt).toLocaleString()}`);
    console.log('');
  });
  
  const annotate = await question('Would you like to annotate one now? (y/n): ');
  if (annotate.toLowerCase() === 'y') {
    const taskChoice = await question(`Select task (1-${tasks.length}): `);
    const taskIndex = parseInt(taskChoice) - 1;
    
    if (taskIndex >= 0 && taskIndex < tasks.length) {
      const taskId = tasks[taskIndex].id;
      console.log(`\n📝 Annotating task: ${taskId}`);
      try {
        const annotation = await processAnnotationTask(taskId);
        console.log(`\n✅ Annotation saved!`);
        console.log(`   Score: ${annotation.humanScore}/10`);
        console.log(`   Issues: ${annotation.humanIssues.length}`);
      } catch (error) {
        console.error(`❌ Error: ${error.message}`);
      }
    }
  }
}

/**
 * Batch annotate with menu
 */
async function batchAnnotateMenu() {
  const tasks = listPendingTasks();
  
  if (tasks.length === 0) {
    console.log('\n✅ No pending tasks.');
    return;
  }
  
  console.log(`\n📋 Available Tasks: ${tasks.length}\n`);
  tasks.slice(0, 10).forEach((task, i) => {
    console.log(`  ${i + 1}. ${task.id} - ${task.sampleName}`);
  });
  if (tasks.length > 10) {
    console.log(`  ... and ${tasks.length - 10} more`);
  }
  
  const maxTasks = await question(`\nHow many tasks to annotate? (max ${tasks.length}): `);
  const max = parseInt(maxTasks) || 5;
  
  // Load VLLM judgments if available
  const vllmDir = join(process.cwd(), 'evaluation', 'human-validation');
  const vllmJudgments = loadVLLMJudgments(vllmDir);
  
  if (Object.keys(vllmJudgments).length > 0) {
    console.log(`\n🤖 Found ${Object.keys(vllmJudgments).length} VLLM judgments for comparison`);
  }
  
  const taskIds = tasks.slice(0, max).map(t => t.id);
  console.log(`\n🚀 Starting batch annotation of ${taskIds.length} tasks...\n`);
  
  const results = await batchAnnotate(taskIds, {
    vllmJudgments,
    maxPerSession: max,
    showProgress: true
  });
  
  console.log(`\n✅ Batch annotation complete!`);
  console.log(`   Completed: ${results.completed.length}`);
  console.log(`   Skipped: ${results.skipped.length}`);
  console.log(`   Failed: ${results.failed.length}`);
}

/**
 * Validate quality
 */
async function validateQuality() {
  const annotationDir = join(process.cwd(), 'evaluation', 'datasets', 'human-annotations', 'completed');
  
  if (!existsSync(annotationDir)) {
    console.log('\n❌ No annotations found. Please create some annotations first.');
    return;
  }
  
  console.log('\n🔍 Validating annotation quality...\n');
  const result = validateAnnotationQuality(annotationDir);
  
  if (result.error) {
    console.error(`❌ ${result.error}`);
    return;
  }
  
  console.log(`Total Annotations: ${result.total}`);
  console.log(`\n📋 Completeness: ${result.completeness.complete}/${result.completeness.total}`);
  console.log(`🔄 Consistency: ${result.consistency.valid ? '✅ Valid' : '⚠️  Issues found'}`);
  
  if (result.agreement.hasMultipleAnnotators) {
    console.log(`👥 Inter-Annotator Agreement:`);
    console.log(`   Good: ${result.agreement.goodAgreement}`);
    console.log(`   Moderate: ${result.agreement.moderateAgreement}`);
    console.log(`   Poor: ${result.agreement.poorAgreement}`);
  }
  
  if (result.calibration.hasCalibration) {
    console.log(`📊 Calibration Quality: ${result.calibration.quality}`);
    console.log(`   MAE: ${result.calibration.mae.toFixed(2)}`);
    console.log(`   Bias: ${result.calibration.scoreBias.toFixed(2)}`);
  }
  
  console.log(`\n💡 Recommendations:`);
  result.recommendations.forEach(rec => {
    console.log(`   - ${rec}`);
  });
}

/**
 * Show statistics
 */
function showStatistics() {
  const completedDir = join(process.cwd(), 'evaluation', 'datasets', 'human-annotations', 'completed');
  const tasksDir = join(process.cwd(), 'evaluation', 'datasets', 'human-annotations', 'tasks');
  
  let completed = 0;
  let pending = 0;
  
  if (existsSync(completedDir)) {
    completed = readdirSync(completedDir).filter(f => f.endsWith('.json')).length;
  }
  
  if (existsSync(tasksDir)) {
    pending = readdirSync(tasksDir).filter(f => f.endsWith('.json')).length;
  }
  
  console.log('\n📊 Annotation Statistics\n');
  console.log(`   Completed: ${completed}`);
  console.log(`   Pending: ${pending}`);
  console.log(`   Total: ${completed + pending}`);
  console.log(`   Progress: ${completed + pending > 0 ? ((completed / (completed + pending)) * 100).toFixed(1) : 0}%`);
}

/**
 * Main loop
 */
async function main() {
  console.log('👋 Welcome to the Human Annotation Workflow!');
  console.log('This tool helps you annotate screenshots for ground truth validation.\n');
  
  while (true) {
    const choice = await showMenu();
    
    try {
      switch (choice) {
        case '1':
          await startAnnotation();
          break;
        case '2':
          listAndAnnotate();
          break;
        case '3':
          const taskId = await question('\nEnter task ID to annotate: ');
          if (taskId) {
            await processAnnotationTask(taskId.trim());
            console.log('\n✅ Annotation saved!');
          }
          break;
        case '4':
          await batchAnnotateMenu();
          break;
        case '5':
          await validateQuality();
          break;
        case '6':
          const datasetPath = await question('\nEnter dataset path (or press Enter for default): ') || 
            join(process.cwd(), 'evaluation', 'datasets', 'real-dataset.json');
          const count = integrateAnnotations(datasetPath);
          console.log(`\n✅ Integrated ${count} annotations into dataset`);
          break;
        case '7':
          showStatistics();
          break;
        case '8':
          console.log('\n👋 Goodbye!');
          rl.close();
          process.exit(0);
        default:
          console.log('\n❌ Invalid choice. Please try again.');
      }
    } catch (error) {
      console.error(`\n❌ Error: ${error.message}`);
      if (error.stack && process.env.DEBUG) {
        console.error(error.stack);
      }
    }
    
    await question('\nPress Enter to continue...');
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main as startHumanAnnotation };

