#!/usr/bin/env node
/**
 * CLI wrapper for evaluate.mjs
 * 
 * Usage:
 *   node evaluation/runners/evaluate-cli.mjs [options]
 * 
 * Options:
 *   --dataset <name>     Dataset name (webui, screenai, wcag, real) or path to JSON
 *   --limit <number>    Maximum number of samples to evaluate
 *   --provider <name>   VLLM provider (gemini, openai)
 *   --prompt <text>     Custom evaluation prompt
 *   --output <file>     Output file path
 *   --help              Show this help
 * 
 * Examples:
 *   # Quick test with real dataset (4 samples)
 *   node evaluation/runners/evaluate-cli.mjs --dataset real --limit 2
 * 
 *   # Evaluate WebUI dataset (100 samples)
 *   node evaluation/runners/evaluate-cli.mjs --dataset webui --limit 100
 * 
 *   # Full evaluation with all WebUI samples
 *   node evaluation/runners/evaluate-cli.mjs --dataset webui
 * 
 *   # Use JSON file (legacy)
 *   node evaluation/runners/evaluate-cli.mjs --dataset real-dataset.json
 */

import { runEvaluation } from './evaluate.mjs';

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    dataset: 'real',
    limit: null,
    provider: null,
    prompt: null,
    outputFile: null,
    useCache: true
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--help' || arg === '-h') {
      console.log(`
🔬 Evaluation Runner CLI

Usage:
  node evaluation/runners/evaluate-cli.mjs [options]

Options:
  --dataset <name>     Dataset name (webui, screenai, wcag, real) or path to JSON
  --limit <number>     Maximum number of samples to evaluate
  --provider <name>    VLLM provider (gemini, openai)
  --prompt <text>      Custom evaluation prompt
  --output <file>     Output file path
  --no-cache          Disable caching (force fresh API calls)
  --help               Show this help

Examples:
  # Quick test with real dataset (4 samples)
  node evaluation/runners/evaluate-cli.mjs --dataset real --limit 2

  # Evaluate WebUI dataset (100 samples)
  node evaluation/runners/evaluate-cli.mjs --dataset webui --limit 100

  # Full evaluation with all WebUI samples
  node evaluation/runners/evaluate-cli.mjs --dataset webui

  # Use JSON file (legacy)
  node evaluation/runners/evaluate-cli.mjs --dataset real-dataset.json

Available Datasets:
  - webui: WebUI-7K dataset (~7000 samples)
  - screenai: ScreenAI dataset (annotation + QA)
  - wcag: WCAG test cases from W3C
  - real: Hand-crafted real-world dataset (4 samples)
`);
      process.exit(0);
    } else if (arg === '--dataset' || arg === '-d') {
      options.dataset = args[++i];
    } else if (arg === '--limit' || arg === '-l') {
      const limit = parseInt(args[++i], 10);
      if (isNaN(limit) || limit < 1) {
        console.error(`❌ Invalid limit: ${args[i]}. Must be a positive number.`);
        process.exit(1);
      }
      options.limit = limit;
    } else if (arg === '--provider' || arg === '-p') {
      options.provider = args[++i];
    } else if (arg === '--prompt') {
      options.prompt = args[++i];
    } else if (arg === '--no-cache') {
      options.useCache = false;
    } else {
      console.error(`❌ Unknown option: ${arg}`);
      console.error(`   Use --help for usage information`);
      process.exit(1);
    }
  }

  return options;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const options = parseArgs();
  runEvaluation(options).catch(error => {
    console.error('❌ Evaluation failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  });
}

