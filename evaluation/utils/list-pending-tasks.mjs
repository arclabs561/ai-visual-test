#!/usr/bin/env node
/**
 * List Pending Annotation Tasks
 * 
 * Quick script to see what tasks are ready for annotation.
 */

import { listPendingTasks } from './collect-human-annotations.mjs';

const tasks = listPendingTasks();

console.log('\n📋 Pending Annotation Tasks\n');
console.log(`Total: ${tasks.length}\n`);

if (tasks.length === 0) {
  console.log('✅ No pending tasks. All done!');
  console.log('\n💡 To create new tasks, run:');
  console.log('   npm run annotate');
  console.log('   (Choose option 1: Start annotating)');
} else {
  tasks.forEach((task, i) => {
    console.log(`${i + 1}. ${task.sampleName}`);
    if (task.category && task.category !== 'undefined') {
      console.log(`   Category: ${task.category}`);
    }
    if (task.url) {
      console.log(`   URL: ${task.url}`);
    }
    if (task.expectedScore) {
      console.log(`   Expected Score: ${task.expectedScore.min}-${task.expectedScore.max}`);
    }
    if (task.knownGood && task.knownGood.length > 0) {
      console.log(`   Known Good Features: ${task.knownGood.slice(0, 3).join(', ')}${task.knownGood.length > 3 ? '...' : ''}`);
    }
    console.log(`   Task ID: ${task.id}`);
    console.log('');
  });
  
  console.log('💡 To annotate, run:');
  console.log('   npm run annotate');
  console.log('   (Choose option 3 and enter a task ID)');
  console.log('\nOr use quick start:');
  console.log('   npm run annotate');
  console.log('   (This will guide you through annotation)');
}

