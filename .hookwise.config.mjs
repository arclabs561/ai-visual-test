// Hookwise configuration for ai-visual-test
// Optimized for npm package with research features, security focus, and documentation management
//
// Note: Hookwise loads .env from repository root automatically
// API keys should be in {repo-root}/.env (GEMINI_API_KEY, OPENAI_API_KEY, etc.)

export default {
  // Extend essential groups
  extends: ['security', 'quality', 'docs'],
  
  // Commit message validation - optimized for changelog generation and npm releases
  commitMessage: {
    enabled: true,
    blocking: true,
    tier: 'simple', // Fast tier for pre-commit (use 'advanced' for thorough analysis if needed)
    minScore: 7, // Higher threshold for npm package quality (0-10 scale)
    timeout: 10000, // 10s timeout (sufficient for simple tier)
    agentic: false, // Disabled for speed (enable for deep analysis if needed)
    // Note: requireBody and requireBreakingChangeFooter are handled by LLM analysis
    // The LLM will check for these requirements when scoring commit messages
  },
  
  // Code quality - optimized for npm package standards
  codeQuality: {
    enabled: true,
    blocking: true,
    checks: {
      consoleLog: {
        enabled: true,
        severity: 'warning', // Warning, not error (logger.mjs is intentional)
        exclude: [
          '*.test.*',
          'test/**',
          'evaluation/**',
          'scripts/**',
          'src/logger.mjs', // Intentional logger
          'src/session-cost-tracker.mjs', // Cost tracking needs console output
        ],
      },
      todos: {
        enabled: true,
        severity: 'warning', // Allow TODOs but require context
        requireContext: true, // Must explain why TODO exists
        exclude: [
          '*.test.*',
          'test/**',
          'evaluation/**',
          'docs/**',
          'archive/**', // Archived docs can have TODOs
        ],
      },
      testAntiPatterns: {
        enabled: true,
        severity: 'error', // Block test anti-patterns (critical for quality)
        // No exclusions - all tests should follow best practices
      },
    },
  },
  
  // Documentation bloat - aggressive for research-heavy repo
  documentation: {
    enabled: true,
    blocking: true,
    maxRootFiles: 6, // Strict limit (README, CHANGELOG, CONTRIBUTING, DEPLOYMENT, SECURITY, openmemory)
    archiveAgeDays: 30, // Archive docs older than 30 days
    archivePatterns: [
      // High priority patterns (should always be archived)
      { pattern: /^COMPLETION_/i, reason: 'Completion summaries are temporary', priority: 'high' },
      { pattern: /^FINAL_/i, reason: 'Final summaries should be archived', priority: 'high' },
      { pattern: /^CRITICAL_/i, reason: 'Critical review docs should be archived', priority: 'high' },
      { pattern: /^DEEP_/i, reason: 'Deep analysis documents should be archived', priority: 'high' },
      { pattern: /^MCP_/i, reason: 'MCP review docs should be archived', priority: 'high' },
      { pattern: /^COMMIT_/i, reason: 'Commit planning docs should be archived', priority: 'high' },
      { pattern: /^GIT_/i, reason: 'Git status docs should be archived', priority: 'high' },
      { pattern: /^REPOSITORY_/i, reason: 'Repository status docs should be archived', priority: 'high' },
      
      // Suffix patterns
      { pattern: /_SUMMARY\.md$/i, reason: 'Summary documents should be archived', priority: 'high' },
      { pattern: /_REPORT\.md$/i, reason: 'Report documents should be archived', priority: 'high' },
      { pattern: /_ANALYSIS\.md$/i, reason: 'Analysis documents should be archived', priority: 'high' },
      { pattern: /_PLAN\.md$/i, reason: 'Planning documents should be archived', priority: 'high' },
      { pattern: /_STATUS\.md$/i, reason: 'Status documents should be archived', priority: 'high' },
      { pattern: /_REVIEW\.md$/i, reason: 'Review documents should be archived', priority: 'high' },
      { pattern: /_FIXES\.md$/i, reason: 'Fix documentation should be archived', priority: 'high' },
      { pattern: /_COMPLETE\.md$/i, reason: 'Completion docs should be archived', priority: 'high' },
      { pattern: /^SESSION_/i, reason: 'Session summaries should be archived', priority: 'high' },
      
      // Research-specific patterns
      { pattern: /^RESEARCH_/i, reason: 'Research notes should be in docs/research/', priority: 'medium' },
      { pattern: /^EVALUATION_/i, reason: 'Evaluation docs should be in evaluation/docs/', priority: 'medium' },
    ],
    essentialFiles: [
      'README.md',
      'CHANGELOG.md',
      'CONTRIBUTING.md',
      'DEPLOYMENT.md',
      'SECURITY.md',
      'LICENSE',
      'openmemory.md', // Project memory file - should stay in root
    ],
  },
  
  // Security - critical for npm package
  security: {
    enabled: true,
    blocking: true, // Security issues must block commits
    checks: {
      secrets: {
        enabled: true,
        severity: 'error', // Critical - secrets in code are dangerous
        exclude: [
          '*.test.*',
          'test/**',
          '.secretsignore',
          '.env.example', // Example files are okay
        ],
      },
    },
  },
  
  // Ignore patterns - comprehensive for this project structure
  ignore: [
    // Build and dependencies
    'node_modules/**',
    'dist/**',
    'build/**',
    
    // Archives and generated content
    'archive/**',
    'docs-generated/**',
    'test-results/**',
    
    // Evaluation outputs (large, generated)
    'evaluation/results/**',
    'evaluation/cache/**',
    'evaluation/datasets/**', // Datasets are large and shouldn't be checked
    
    // Git and tooling
    '.husky/**',
    '.git/**',
    
    // Logs and temporary files
    '*.log',
    '*.tmp',
    'temp-*/**',
    
    // Package files
    'package-lock.json',
    'tsconfig.json',
    'typedoc.json',
  ],
};
