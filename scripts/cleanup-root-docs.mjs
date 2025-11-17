#!/usr/bin/env node
/**
 * Cleanup Root Documentation
 * 
 * Archives temporary/status markdown files from root to archive/ directory.
 * Keeps only essential documentation files in root.
 */

import { existsSync, mkdirSync, renameSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

// Essential files to keep in root
const ESSENTIAL_FILES = [
  'README.md',
  'CHANGELOG.md',
  'CONTRIBUTING.md',
  'DEPLOYMENT.md',
  'SECURITY.md',
  'LICENSE',
  'openmemory.md'
];

// Temporary/status files to archive
const TEMP_FILES = [
  'ANALYSIS_REPORT.md',
  'COMMIT_PLAN.md',
  'COMPREHENSIVE_REVIEW.md',
  'COMPREHENSIVE_VALIDATION_REPORT.md',
  'E2E_VERIFICATION_REPORT.md',
  'FINAL_VALIDATION_REPORT.md',
  'HOOKWISE_USAGE_REVIEW.md',
  'OBFUSCATION_AND_CLEANUP_COMPLETE.md',
  'OBFUSCATION_VERSION_SUMMARY.md',
  'PUBLISH_CHECKLIST.md',
  'PUBLISH_REVIEW.md',
  'RELEASE_v0.5.3.md',
  'UPDATE_DEPRECATION_GUIDE.md',
  'VALIDATION_ISSUES.md',
  'WORK_COMPLETED.md',
  'SECURITY_REVIEW_FIXES.md'
];

// Security reports to archive (historical)
const SECURITY_REPORTS = [
  'SECURITY_ADVANCED_ANALYSIS.md',
  'SECURITY_AUDIT_REPORT.md',
  'SECURITY_DEEP_DIVE_REPORT.md',
  'SECURITY_FIXES_COMPLETE.md',
  'SECURITY_FIXES.md',
  'SECURITY_LOCKDOWN_COMPLETE.md',
  'SECURITY_RED_TEAM_REPORT_2025.md'
];

// Create archive directories
const today = new Date().toISOString().split('T')[0];
const statusArchiveDir = join(ROOT_DIR, 'archive', `status-docs-${today}`);
const securityArchiveDir = join(ROOT_DIR, 'archive', `security-reports-${today}`);

function archiveFiles(files, archiveDir, category) {
  if (!existsSync(archiveDir)) {
    mkdirSync(archiveDir, { recursive: true });
  }

  let archived = 0;
  for (const file of files) {
    const source = join(ROOT_DIR, file);
    if (existsSync(source)) {
      const dest = join(archiveDir, file);
      try {
        renameSync(source, dest);
        console.log(`   ✓ Archived: ${file}`);
        archived++;
      } catch (error) {
        console.warn(`   ⚠️  Failed to archive ${file}: ${error.message}`);
      }
    }
  }

  if (archived > 0) {
    console.log(`\n   📦 Archived ${archived} ${category} files to: ${archiveDir}\n`);
  } else {
    console.log(`\n   ℹ️  No ${category} files to archive\n`);
  }

  return archived;
}

function main() {
  console.log('🧹 Cleaning up root documentation...\n');

  // Archive temporary/status files
  console.log('📋 Archiving temporary/status files...');
  const statusCount = archiveFiles(TEMP_FILES, statusArchiveDir, 'status');

  // Archive security reports
  console.log('🔒 Archiving security reports...');
  const securityCount = archiveFiles(SECURITY_REPORTS, securityArchiveDir, 'security');

  const total = statusCount + securityCount;

  if (total > 0) {
    console.log(`✅ Cleanup complete! Archived ${total} files total.\n`);
    console.log('📁 Archive locations:');
    if (statusCount > 0) {
      console.log(`   - ${statusArchiveDir}`);
    }
    if (securityCount > 0) {
      console.log(`   - ${securityArchiveDir}`);
    }
    console.log('\n💡 Essential files remain in root:');
    ESSENTIAL_FILES.forEach(file => {
      if (existsSync(join(ROOT_DIR, file))) {
        console.log(`   ✓ ${file}`);
      }
    });
  } else {
    console.log('✅ No files to archive. Root is already clean!\n');
  }
}

main().catch(error => {
  console.error('❌ Cleanup failed:', error);
  process.exit(1);
});

