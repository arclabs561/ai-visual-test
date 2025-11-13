#!/usr/bin/env node
/**
 * Demo Annotation - Shows the annotation process
 * 
 * This demonstrates what the annotation workflow looks like
 * without requiring actual interactive input.
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { createAnnotationTasks } from './collect-human-annotations.mjs';

async function demoAnnotation() {
  console.log('👋 Human Annotation System - Demo\n');
  console.log('This shows you what the annotation process looks like.\n');
  console.log('─'.repeat(60));
  
  // Check dataset
  const datasetPath = join(process.cwd(), 'evaluation', 'datasets', 'real-dataset.json');
  if (!existsSync(datasetPath)) {
    console.log('❌ Dataset not found. Creating a sample...\n');
    console.log('💡 To use this system, you need a dataset at:');
    console.log(`   ${datasetPath}\n`);
    return;
  }
  
  const dataset = JSON.parse(readFileSync(datasetPath, 'utf-8'));
  console.log(`📊 Dataset: ${dataset.name || 'Real-World Screenshot Dataset'}`);
  console.log(`   Samples: ${dataset.samples?.length || 0}\n`);
  
  // Check existing annotations
  const completedDir = join(process.cwd(), 'evaluation', 'datasets', 'human-annotations', 'completed');
  let existingAnnotations = 0;
  if (existsSync(completedDir)) {
    existingAnnotations = readdirSync(completedDir).filter(f => f.endsWith('.json')).length;
  }
  
  console.log(`✅ Existing annotations: ${existingAnnotations}`);
  
  // Create tasks
  console.log('\n📝 Creating annotation tasks...');
  const tasks = createAnnotationTasks(datasetPath, 'demo-annotator');
  console.log(`✅ Created ${tasks.length} new tasks\n`);
  
  if (tasks.length === 0) {
    console.log('🎉 All samples already annotated!');
    return;
  }
  
  // Show what annotation looks like
  const sampleTask = tasks[0];
  console.log('─'.repeat(60));
  console.log('📋 EXAMPLE: What You\'ll See When Annotating\n');
  console.log(`Task: ${sampleTask.sampleName}`);
  console.log(`Category: ${sampleTask.category}`);
  if (sampleTask.url) console.log(`URL: ${sampleTask.url}`);
  if (sampleTask.expectedScore) {
    console.log(`Expected Score Range: ${sampleTask.expectedScore.min}-${sampleTask.expectedScore.max}`);
  }
  console.log('');
  console.log('When you run the annotation, you\'ll be asked:');
  console.log('');
  console.log('📊 Score (0-10): [you enter a number]');
  console.log('');
  console.log('🐛 Issues (Enter after each, empty to finish):');
  console.log('   Issue: [you list problems]');
  console.log('   Issue: [another issue]');
  console.log('   Issue: [empty line to finish]');
  console.log('');
  console.log('💭 Reasoning (Enter twice to finish):');
  console.log('   [you explain your score]');
  console.log('   [more details]');
  console.log('   [empty line]');
  console.log('   [empty line to finish]');
  console.log('');
  console.log('─'.repeat(60));
  console.log('\n🚀 Ready to Start?\n');
  console.log('Run this command:');
  console.log('   npm run annotate');
  console.log('');
  console.log('Or for the full menu:');
  console.log('   npm run annotate:full');
  console.log('');
  console.log(`You have ${tasks.length} task${tasks.length > 1 ? 's' : ''} ready to annotate!`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  demoAnnotation().catch(error => {
    console.error('Error:', error.message);
    process.exit(1);
  });
}

export { demoAnnotation };

