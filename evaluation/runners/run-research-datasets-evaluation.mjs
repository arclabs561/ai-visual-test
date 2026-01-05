#!/usr/bin/env node
/**
 * Evaluate Research Datasets
 * 
 * Runs evaluation on integrated research datasets.
 */

import { loadEnv } from '../../src/load-env.mjs';

// Auto-load .env for API keys
loadEnv();

import { validateScreenshot, startSession, endSession } from '../../src/index.mjs';
import { readFileSync } from 'fs';
import { join } from 'path';

const INTEGRATED_DIR = join(process.cwd(), 'evaluation', 'datasets', 'integrated');

async function evaluateResearchDatasets() {
  const sessionId = startSession('research-datasets-evaluation');
  
  try {
    // ScreenAI Screen Annotation
    const annotationPath = join(INTEGRATED_DIR, 'screenai-annotation.json');
    if (existsSync(annotationPath)) {
      const dataset = JSON.parse(readFileSync(annotationPath, 'utf8'));
      console.log(`Evaluating ${dataset.name} (${dataset.samples.length} samples)...`);
      
      // Evaluate first 10 samples
      for (const sample of dataset.samples.slice(0, 10)) {
        if (sample.screenshot && existsSync(sample.screenshot)) {
          const result = await validateScreenshot(sample.screenshot, 
            'Detect and annotate all UI elements with bounding boxes',
            { sessionId }
          );
          console.log(`Sample ${sample.id}: Score ${result.score}`);
        }
      }
    }
    
    // ScreenAI ScreenQA
    const qaPath = join(INTEGRATED_DIR, 'screenai-qa.json');
    if (existsSync(qaPath)) {
      const dataset = JSON.parse(readFileSync(qaPath, 'utf8'));
      console.log(`Evaluating ${dataset.name} (${dataset.samples.length} samples)...`);
      
      // Evaluate first 10 samples
      for (const sample of dataset.samples.slice(0, 10)) {
        if (sample.screenshot && existsSync(sample.screenshot)) {
          const result = await validateScreenshot(sample.screenshot,
            sample.question,
            { sessionId }
          );
          console.log(`Q: ${sample.question}`);
          console.log(`A: ${result.reasoning}`);
        }
      }
    }
  } finally {
    const summary = endSession(sessionId, { verbose: true });
  }
}

evaluateResearchDatasets().catch(console.error);
