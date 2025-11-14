// Hookwise configuration for ai-visual-test
// Uses groups/presets system (similar to ESLint extends)
//
// This repo has experienced patterns of:
// - Analysis/summary documents (*_SUMMARY.md, *_REPORT.md, COMPLETION_*, etc.)
// - Ground truth/annotation docs (GROUND_TRUTH_*, HUMAN_GROUND_TRUTH_*, ANNOTATION_*)
// - Validation framework docs (VALIDATION_FRAMEWORK_*)
// - Security reviews (SECURITY_*, NPM_PACKAGE_SECURITY_*)
// - Publishing guides (PUBLISH_* - these should stay in root)
//
// Critical needs for this repo (ai-visual-test - Visual Testing with VLLM):
// 1. Security: Secret detection (API keys, tokens) - CRITICAL for npm package
// 2. Documentation bloat: Analysis docs accumulate in root - needs aggressive archiving
// 3. Commit quality: Good commits needed for CHANGELOG generation
// 4. Breaking changes: Must catch breaking changes for version bumps
// 5. Test quality: Property-based and e2e tests need quality enforcement
// 6. Visual testing focus: Ensure VLLM calls are cached, API usage is optimized
// 7. Performance: Slow tests are integration/e2e with real API calls - acceptable but monitor

export default {
  // Extend groups/presets (like ESLint extends)
  // Groups: security, quality, docs, strict, minimal
  // Presets: standard, production, library, prototype
  extends: ['security', 'quality', 'strict'],
  
  // Commit message validation - CRITICAL for changelog generation
  commitMessage: {
    enabled: true,
    blocking: true,
    tier: 'advanced',
    minScore: 7,
    timeout: 10000,
    // Enhanced for this repo's needs:
    requireBody: ['feat', 'fix', 'refactor', 'perf'],  // Require body for significant changes
    requireBreakingChangeFooter: true,  // Must have BREAKING CHANGE: footer for breaking changes
    encourageIssueLinking: true,  // Encourage linking to issues/PRs
    validateScope: true,  // Scope should match changed files/directories
    // Custom validation for this repo:
    // - feat/fix should have clear description for changelog
    // - Breaking changes must be explicit
    // - Version bumps should be documented
  },
  
  // Code quality overrides - tuned for this repo
  codeQuality: {
    enabled: true,
    blocking: true,
    checks: {
      consoleLog: {
        enabled: true,
        severity: 'warning',  // warning | error
        exclude: [
          '*.test.*', 
          'test/**', 
          'evaluation/**', 
          'scripts/**',
          'src/logger.mjs',  // Logger module is allowed
        ],
      },
      todos: {
        enabled: true,
        severity: 'warning',
        requireContext: true,  // TODOs must have context
        // Special handling for this repo:
        // - TODOs in evaluation/ are allowed (research in progress)
        // - TODOs in docs/ are allowed (documentation todos)
        exclude: ['*.test.*', 'test/**', 'evaluation/**', 'docs/**'],
      },
      testAntiPatterns: {
        enabled: true,
        severity: 'error',
        // This repo uses property-based testing (fast-check)
        // Ensure test quality is maintained
      },
      // Additional checks if hookwise supports them:
      unusedImports: {
        enabled: true,
        severity: 'warning',
        exclude: ['*.test.*', 'test/**', 'evaluation/**'],
      },
      deadCode: {
        enabled: true,
        severity: 'warning',
        exclude: ['*.test.*', 'test/**', 'evaluation/**'],
      },
      complexity: {
        enabled: true,
        severity: 'warning',
        maxComplexity: 15,  // Warn on high complexity
        exclude: ['*.test.*', 'test/**'],
      },
      testPerformance: {
        enabled: true,
        severity: 'warning',
        slowTestThreshold: 1000,  // Warn on tests >1s
        verySlowTestThreshold: 5000,  // Error on tests >5s
        maxSlowTests: 20,  // Warn if more than 20 slow tests
        // Test performance analysis integrated into hookwise
        // Run with: npm run check:test-performance or npm run garden
      },
    },
  },
  
  // Documentation bloat detection - AGGRESSIVE for this repo
  documentation: {
    enabled: true,
    blocking: true,  // Changed to blocking - this repo has severe doc bloat issues
    maxRootFiles: 6,  // Reduced from 10 - only essential docs in root
    maxFileSize: 50 * 1024,  // 50KB max - large docs should be split or archived
    archiveAgeDays: 30,  // Archive files older than 30 days (reduced from 90)
    similarityThreshold: 0.25,  // Lower threshold - catch more redundant docs
    enableLLMAnalysis: true,  // Use LLM to detect redundant content
    
    // Custom archive patterns - comprehensive for this repo's patterns
    archivePatterns: [
      // Analysis/summary patterns (very common in this repo)
      { pattern: /^COMPLETION_/i, reason: 'Completion summaries are temporary analysis docs', priority: 'high' },
      { pattern: /^COMPREHENSIVE_/i, reason: 'Comprehensive summaries are temporary analysis docs', priority: 'high' },
      { pattern: /^IMPROVEMENTS?_/i, reason: 'Improvement summaries are temporary analysis docs', priority: 'high' },
      { pattern: /_SUMMARY\.md$/i, reason: 'Summary documents should be archived', priority: 'high' },
      { pattern: /_REPORT\.md$/i, reason: 'Report documents should be archived', priority: 'high' },
      { pattern: /_ANALYSIS\.md$/i, reason: 'Analysis documents should be archived', priority: 'high' },
      { pattern: /^DEEP_/i, reason: 'Deep analysis documents should be archived', priority: 'high' },
      { pattern: /^FINAL_/i, reason: 'Final summaries should be archived', priority: 'high' },
      { pattern: /^VALIDATION_FRAMEWORK_/i, reason: 'Validation framework reports should be archived', priority: 'high' },
      { pattern: /^TEST_/i, reason: 'Test-related docs should be archived', priority: 'medium' },
      { pattern: /^CRITICAL_/i, reason: 'Critical review docs should be archived', priority: 'high' },
      { pattern: /^E2E_/i, reason: 'E2E analysis docs should be archived', priority: 'medium' },
      { pattern: /^EVALUATION_/i, reason: 'Evaluation analysis docs should be archived', priority: 'medium' },
      
      // Ground truth/annotation patterns
      { pattern: /^GROUND_TRUTH_/i, reason: 'Ground truth docs should be archived', priority: 'high' },
      { pattern: /^HUMAN_GROUND_TRUTH_/i, reason: 'Human ground truth docs should be archived', priority: 'high' },
      { pattern: /^ANNOTATION_/i, reason: 'Annotation guides should be archived', priority: 'high' },
      { pattern: /^ENHANCED_ANNOTATION_/i, reason: 'Enhanced annotation docs should be archived', priority: 'high' },
      
      // Security review patterns
      { pattern: /^SECURITY_RED_TEAM_REVIEW/i, reason: 'Security review reports should be archived', priority: 'high' },
      { pattern: /^NPM_PACKAGE_SECURITY/i, reason: 'NPM security assessments should be archived', priority: 'medium' },
      
      // Inventory/quick start patterns
      { pattern: /_INVENTORY\.md$/i, reason: 'Inventory documents should be archived', priority: 'medium' },
      { pattern: /_QUICK_START\.md$/i, reason: 'Quick start guides should be archived', priority: 'medium' },
      
      // Review and recommendation patterns
      { pattern: /_REVIEW\.md$/i, reason: 'Review documents should be archived', priority: 'high' },
      { pattern: /_RECOMMENDATIONS?\.md$/i, reason: 'Recommendation documents should be archived', priority: 'high' },
      { pattern: /_FINDINGS\.md$/i, reason: 'Findings documents should be archived', priority: 'high' },
      { pattern: /_AUDIT\.md$/i, reason: 'Audit documents should be archived', priority: 'high' },
    ],
    
    // Files that should stay in root even if they match patterns
    essentialFiles: [
      'README.md',
      'CHANGELOG.md',
      'CONTRIBUTING.md',
      'DEPLOYMENT.md',
      'SECURITY.md',
      'LICENSE',
    ],
  },
  
  // Security overrides - CRITICAL for this npm package
  security: {
    enabled: true,
    blocking: true,
    checks: {
      secrets: {
        enabled: true,
        severity: 'error',  // CRITICAL - secrets must not be committed
        // Integrate with scripts/detect-secrets.mjs
        // Patterns: API keys, tokens, passwords, private keys
        exclude: [
          '*.test.*',  // Test files may have fake secrets
          'test/**',
          '.secretsignore',  // Ignore file itself
          'scripts/detect-secrets.mjs',  // The detection script
        ],
      },
      vulnerabilities: {
        enabled: true,
        severity: 'error',
        // Check for known vulnerability patterns
        // - eval() usage
        // - dangerous file operations
        // - insecure dependencies
      },
      dependencies: {
        enabled: true,
        severity: 'warning',
        // Check for outdated dependencies
        // - npm audit issues
        // - Known vulnerabilities
      },
      inputValidation: {
        enabled: true,
        severity: 'warning',
        // Check for missing input validation
        // - File path validation
        // - User input sanitization
        // - Size limits
      },
    },
  },
  
  // Ignore patterns (like .eslintignore)
  ignore: [
    'node_modules/**',
    'dist/**',
    'build/**',
    '.next/**',
    'archive/**',  // Don't check archived files
    'docs-generated/**',  // Generated docs
    'test-results/**',  // Test results
    'evaluation/results/**',  // Evaluation results
    'evaluation/cache/**',  // Evaluation cache
    '.husky/**',  // Git hooks
    '*.log',  // Log files
  ],
  
  // Custom prompts - tailored for this repo
  prompts: {
    'commit-message': {
      // Custom prompt for commit message validation
      // Emphasizes:
      // - Clear descriptions for changelog generation
      // - Breaking change detection
      // - Issue/PR linking
      // - Scope validation
      system: `You are validating commit messages for ai-visual-test, an npm package for visual testing.

Requirements:
1. Must follow conventional commits format: type(scope): description
2. Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
3. Breaking changes MUST include "BREAKING CHANGE:" footer
4. Descriptions should be clear for CHANGELOG generation
5. Encourage linking to issues/PRs when relevant
6. Scope should match changed files/directories

Rate the commit message quality (0-10) and provide specific feedback.`,
    },
  },
  
  // Custom rules - repo-specific validation
  rules: {
    'conventional-commits': {
      enabled: true,
      // Enforce conventional commits format
      // You already have scripts/validate-commit-msg.mjs
      // This integrates with hookwise
    },
    'breaking-change': {
      enabled: true,
      // Require BREAKING CHANGE: footer for breaking changes
      // Check if version should be bumped
      // Validate breaking change description
    },
    'changelog-ready': {
      enabled: true,
      // Ensure commits are ready for changelog generation
      // - Clear descriptions
      // - Proper categorization
      // - Breaking changes documented
    },
    'secret-detection': {
      enabled: true,
      // Integrate with scripts/detect-secrets.mjs
      // Run secret detection as part of hookwise
      // Block commits with detected secrets
    },
    'test-performance': {
      enabled: true,
      // Test performance analysis integrated into hookwise
      // Analyzes test execution times and identifies slow tests
      // Run with: npm run check:test-performance or npm run garden
    },
  },
};
