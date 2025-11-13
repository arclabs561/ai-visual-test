#!/usr/bin/env node
/**
 * Test Interactive Annotation
 * 
 * Simulates the annotation process to test the workflow.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { createAnnotationTasks, processAnnotationTask } from './collect-human-annotations.mjs';

async function testAnnotation() {
  console.log('🧪 Testing Human Annotation Workflow\n');
  
  // Check if dataset exists
  const datasetPath = join(process.cwd(), 'evaluation', 'datasets', 'real-dataset.json');
  if (!existsSync(datasetPath)) {
    console.log('❌ Dataset not found:', datasetPath);
    return;
  }
  
  // Create tasks
  console.log('📝 Creating annotation tasks...');
  const tasks = createAnnotationTasks(datasetPath, 'test-annotator');
  console.log(`✅ Created ${tasks.length} tasks\n`);
  
  if (tasks.length === 0) {
    console.log('ℹ️  All samples already annotated');
    return;
  }
  
  // Show first task
  const firstTask = tasks[0];
  console.log('📋 First Task Ready for Annotation:');
  console.log(`   ID: ${firstTask.id}`);
  console.log(`   Sample: ${firstTask.sampleName}`);
  console.log(`   Category: ${firstTask.category}`);
  if (firstTask.url) console.log(`   URL: ${firstTask.url}`);
  console.log('');
  
  console.log('💡 To annotate this task, run:');
  console.log(`   node evaluation/utils/collect-human-annotations.mjs annotate ${firstTask.id}`);
  console.log('');
  console.log('Or use the interactive menu:');
  console.log('   npm run annotate:full');
  console.log('   (Then choose option 3 and enter the task ID)');
  console.log('');
  console.log('Or use quick start:');
  console.log('   npm run annotate');
  console.log('   (This will guide you through the process)');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  testAnnotation().catch(error => {
    console.error('Error:', error.message);
    process.exit(1);
  });
}

export { testAnnotation };

