#!/usr/bin/env node
/**
 * Documentation Consolidation Script
 * 
 * Helps identify and organize documentation files for consolidation.
 * Moves historical/duplicate docs to archive while preserving git history.
 */

import { readdir, stat, readFile } from 'fs/promises';
import { join, basename } from 'path';
import { existsSync, mkdirSync } from 'fs';

const DOCS_DIR = 'docs';
const ARCHIVE_DIR = 'archive';
const DATE_PREFIX = new Date().toISOString().split('T')[0].replace(/-/g, '-');

// Patterns for files to archive
const ARCHIVE_PATTERNS = {
  status: [
    '*_COMPLETE.md',
    '*_STATUS.md',
    '*_SUMMARY.md',
    '*_FINAL*.md',
    'IMPLEMENTATION_*.md',
    'INTEGRATION_*.md',
    'SUCCESS_CRITERIA_*.md',
    'COMPLETION_*.md',
    'HARMONIZATION_*.md',
    'POLISH_*.md',
    'FIXES_*.md',
    'CHANGES_*.md'
  ],
  review: [
    '*_REVIEW*.md',
    '*_CRITIQUE*.md',
    '*_ANALYSIS*.md',
    'COMPREHENSIVE_*.md',
    'DEEP_*.md',
    'ULTIMATE_*.md',
    'SCRUTINY_*.md'
  ],
  progress: [
    '*_PROGRESS*.md',
    '*_PLAN*.md',
    'NEXT_STEPS*.md',
    'CURRENT_GOALS*.md',
    'REFINED_*.md',
    'REFINEMENT_*.md'
  ]
};

// Files to keep (essential, current)
const KEEP_FILES = [
  'README.md',
  'GETTING_STARTED.md',
  'ARCHITECTURE.md',
  'INDEX.md',
  'DOCUMENTATION_CONSOLIDATION_PLAN.md', // Keep the plan itself
  'api/API_ESSENTIALS.md',
  'api/PRIMARY_API.md',
  'research/HOW_AND_WHY_RESEARCH_WORKS.md',
  'CACHE_ARCHITECTURE_DEEP_DIVE.md' // Keep detailed cache docs
];

// Directories to keep entirely (don't archive anything in these)
const KEEP_DIRECTORIES = [
  'api',
  'features',
  'research',
  'usage',
  'human-validation',
  'temporal',
  'misc',
  'analysis' // Keep analysis directory
];

async function getAllMarkdownFiles(dir, baseDir = dir) {
  const files = [];
  const entries = await readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relativePath = fullPath.replace(baseDir + '/', '');
    
    if (entry.isDirectory()) {
      // Skip certain directories
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
        continue;
      }
      const subFiles = await getAllMarkdownFiles(fullPath, baseDir);
      files.push(...subFiles);
    } else if (entry.name.endsWith('.md')) {
      files.push(relativePath);
    }
  }
  
  return files;
}

function shouldArchive(filename) {
  // Check if in keep list
  if (KEEP_FILES.some(keep => filename.includes(keep))) {
    return false;
  }
  
  // Check if in a keep directory
  if (KEEP_DIRECTORIES.some(dir => filename.startsWith(dir + '/'))) {
    return false;
  }
  
  // Check patterns
  for (const [category, patterns] of Object.entries(ARCHIVE_PATTERNS)) {
    for (const pattern of patterns) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      if (regex.test(filename)) {
        return { archive: true, category };
      }
    }
  }
  
  return false;
}

async function analyzeDocs() {
  console.log('Analyzing documentation files...\n');
  
  const files = await getAllMarkdownFiles(DOCS_DIR);
  const archiveCandidates = [];
  const keepFiles = [];
  
  for (const file of files) {
    const result = shouldArchive(file);
    if (result) {
      archiveCandidates.push({ file, category: result.category });
    } else {
      keepFiles.push(file);
    }
  }
  
  console.log(`Total markdown files: ${files.length}`);
  console.log(`Files to keep: ${keepFiles.length}`);
  console.log(`Files to archive: ${archiveCandidates.length}\n`);
  
  // Group by category
  const byCategory = {};
  for (const { file, category } of archiveCandidates) {
    if (!byCategory[category]) {
      byCategory[category] = [];
    }
    byCategory[category].push(file);
  }
  
  console.log('Archive candidates by category:');
  for (const [category, files] of Object.entries(byCategory)) {
    console.log(`\n${category}: ${files.length} files`);
    files.slice(0, 5).forEach(f => console.log(`  - ${f}`));
    if (files.length > 5) {
      console.log(`  ... and ${files.length - 5} more`);
    }
  }
  
  return { archiveCandidates, keepFiles };
}

async function createArchiveStructure() {
  const archivePath = join(ARCHIVE_DIR, `docs-consolidation-${DATE_PREFIX}`);
  
  if (!existsSync(archivePath)) {
    mkdirSync(archivePath, { recursive: true });
    console.log(`Created archive directory: ${archivePath}`);
  }
  
  return archivePath;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No files will be moved\n');
  }
  
  const { archiveCandidates, keepFiles } = await analyzeDocs();
  
  if (dryRun) {
    console.log('\n📋 Summary:');
    console.log(`   Files to keep: ${keepFiles.length}`);
    console.log(`   Files to archive: ${archiveCandidates.length}`);
    console.log('\n⚠️  Run without --dry-run to actually move files');
    return;
  }
  
  const archivePath = await createArchiveStructure();
  
  console.log(`\n📦 Moving files to ${archivePath}...`);
  
  // Group by category for organization
  const byCategory = {};
  for (const { file, category } of archiveCandidates) {
    if (!byCategory[category]) {
      byCategory[category] = [];
    }
    byCategory[category].push(file);
  }
  
  let moved = 0;
  
  for (const [category, files] of Object.entries(byCategory)) {
    const categoryDir = join(archivePath, category);
    if (!existsSync(categoryDir)) {
      mkdirSync(categoryDir, { recursive: true });
    }
    
    for (const file of files) {
      const src = join(DOCS_DIR, file);
      const dest = join(categoryDir, basename(file));
      
      if (!existsSync(src)) {
        console.log(`⚠️  Source not found: ${src}`);
        continue;
      }
      
      if (existsSync(dest)) {
        console.log(`⚠️  Destination exists: ${dest}, skipping`);
        continue;
      }
      
      try {
        const { rename } = await import('fs/promises');
        await rename(src, dest);
        console.log(`Moved: ${file} → ${category}/${basename(file)}`);
        moved++;
      } catch (error) {
        console.error(`❌ Failed to move ${file}: ${error.message}`);
      }
    }
  }
  
  console.log(`\n✅ Consolidation complete:`);
  console.log(`   Moved: ${moved} files`);
  console.log(`   Kept: ${keepFiles.length} files`);
}

main().catch(console.error);

