#!/usr/bin/env node
/**
 * Run All Dataset Integrations
 * 
 * Orchestrates integration of all research datasets.
 */

import { spawn } from 'child_process';
import { join } from 'path';

/**
 * Run a command
 */
function runCommand(command, args = []) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      stdio: 'inherit',
      shell: true
    });
    
    proc.on('close', (code) => {
      resolve({ success: code === 0, code });
    });
    
    proc.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Main function
 */
async function main() {
  console.log('🔄 Running All Dataset Integrations');
  console.log('='.repeat(70));
  console.log();

  const integrations = [
    {
      name: 'ScreenAI Integration',
      command: 'node',
      args: ['evaluation/utils/integrate-research-datasets.mjs'],
      required: false
    },
    {
      name: 'MultiUI Integration',
      command: 'node',
      args: ['evaluation/utils/integrate-multiui-dataset.mjs'],
      required: false
    },
    {
      name: 'A11YN Integration',
      command: 'node',
      args: ['evaluation/utils/integrate-a11yn-dataset.mjs'],
      required: false
    },
    {
      name: 'Dataset Summary',
      command: 'node',
      args: ['evaluation/utils/create-dataset-summary.mjs'],
      required: true
    }
  ];

  const results = [];

  for (const integration of integrations) {
    console.log(`📊 ${integration.name}`);
    console.log('-'.repeat(70));
    
    try {
      const result = await runCommand(integration.command, integration.args);
      results.push({
        name: integration.name,
        success: result.success,
        required: integration.required
      });
      
      if (result.success) {
        console.log(`✅ ${integration.name} completed`);
      } else {
        console.log(`⚠️  ${integration.name} completed with warnings`);
      }
    } catch (error) {
      console.error(`❌ ${integration.name} failed: ${error.message}`);
      results.push({
        name: integration.name,
        success: false,
        error: error.message,
        required: integration.required
      });
    }
    
    console.log();
  }

  console.log('='.repeat(70));
  console.log('📊 Integration Summary');
  console.log('-'.repeat(70));
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  console.log();
  
  results.forEach(result => {
    const icon = result.success ? '✅' : '❌';
    console.log(`   ${icon} ${result.name}`);
    if (result.error) {
      console.log(`      Error: ${result.error}`);
    }
  });
  
  console.log();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main as runAllIntegrations };

