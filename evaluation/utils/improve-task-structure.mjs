#!/usr/bin/env node
/**
 * Improve Task Structure
 * 
 * Makes annotation tasks more useful by:
 * - Adding proper categories
 * - Including all relevant context
 * - Making prompts clearer
 * - Adding helpful hints
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * Infer category from URL or name
 */
function inferCategory(sample) {
  if (sample.category) return sample.category;
  
  const url = (sample.url || '').toLowerCase();
  const name = (sample.name || '').toLowerCase();
  
  if (url.includes('github') || name.includes('github')) return 'developer-tools';
  if (url.includes('mozilla') || url.includes('mdn') || name.includes('mdn')) return 'documentation';
  if (url.includes('w3.org') || url.includes('w3c') || name.includes('w3c')) return 'standards';
  if (url.includes('example')) return 'minimal';
  if (url.includes('shop') || url.includes('store') || url.includes('buy')) return 'e-commerce';
  if (url.includes('blog') || url.includes('article')) return 'blog';
  if (url.includes('news')) return 'news';
  
  return 'general';
}

/**
 * Create better prompt based on category
 */
function createBetterPrompt(sample, category) {
  const basePrompt = `Evaluate this ${category} webpage screenshot.`;
  
  const considerations = [
    'Visual design and aesthetics',
    'Accessibility and usability',
    'Layout and information hierarchy',
    'User experience'
  ];
  
  // Add category-specific considerations
  if (category === 'documentation') {
    considerations.push('Clarity of information presentation', 'Search and navigation');
  } else if (category === 'developer-tools') {
    considerations.push('Developer experience', 'Code readability');
  } else if (category === 'standards') {
    considerations.push('Accessibility compliance', 'WCAG adherence');
  } else if (category === 'e-commerce') {
    considerations.push('Product presentation', 'Checkout flow');
  }
  
  considerations.push('Any issues or problems');
  
  return `${basePrompt}\n\nConsider:\n${considerations.map(c => `- ${c}`).join('\n')}`;
}

/**
 * Improve existing tasks
 */
function improveTasks() {
  const pendingDir = join(process.cwd(), 'evaluation', 'datasets', 'human-annotations', 'pending');
  if (!existsSync(pendingDir)) {
    console.log('No pending tasks to improve');
    return;
  }
  
  const files = readdirSync(pendingDir).filter(f => f.endsWith('.json'));
  let improved = 0;
  
  for (const file of files) {
    const taskPath = join(pendingDir, file);
    const task = JSON.parse(readFileSync(taskPath, 'utf-8'));
    
    // Improve category
    if (!task.category || task.category === 'undefined') {
      task.category = inferCategory(task);
    }
    
    // Improve prompt
    task.prompt = createBetterPrompt(task, task.category);
    
    // Add helpful context
    if (!task.context) {
      task.context = {
        sampleName: task.sampleName,
        url: task.url,
        category: task.category,
        expectedScore: task.expectedScore,
        knownGood: task.knownGood || [],
        knownBad: task.knownBad || []
      };
    }
    
    writeFileSync(taskPath, JSON.stringify(task, null, 2));
    improved++;
  }
  
  console.log(`✅ Improved ${improved} tasks`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  improveTasks();
}

export { inferCategory, createBetterPrompt, improveTasks };

