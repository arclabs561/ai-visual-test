# Changelog

All notable changes to ai-browser-test will be documented in this file.

## [0.2.0] - 2025-11-11

### Added
- **Temporal Batch Optimization**
  - `TemporalBatchOptimizer` - Batch optimizer with temporal dependency awareness
  - `LatencyAwareBatchOptimizer` - Dynamic latency-aware batching for real-time applications
  - Temporal constants: `TIME_SCALES`, `MULTI_SCALE_WINDOWS`, `READING_SPEEDS`, `ATTENTION_MULTIPLIERS`
  - Temporal context utilities: `createTemporalContext`, `mergeTemporalContext`, `extractTemporalContext`
  - Temporal decision-making: `aggregateMultiScale`, `SequentialDecisionContext`, `humanPerceptionTime`
  - Temporal error types: `TemporalError`, `PerceptionTimeError`, `SequentialContextError`, `MultiScaleError`, `TemporalBatchError`

- **Bias Detection and Mitigation**
  - `detectBias` and `detectPositionBias` - Detect bias in VLLM judgments
  - `applyBiasMitigation`, `mitigateBias`, `mitigatePositionBias` - Bias mitigation utilities
  - `comparePair` and `rankBatch` - Pair comparison and batch ranking for fair evaluation

- **Ensemble and Advanced Judging**
  - `EnsembleJudge` and `createEnsembleJudge` - Multi-provider ensemble judging with weighted aggregation
  - `DEFAULT_RUBRIC`, `buildRubricPrompt`, `getRubricForTestType` - Rubric system for structured evaluation

- **Logger Utility**
  - `src/logger.mjs` - Conditional logging utility with debug mode support
  - Logger exports: `enableDebug`, `disableDebug`, `isDebugEnabled`, `warn`, `log`, `error`
  - Logger sub-path export: `ai-browser-test/logger`

- **Type Guards and Validation**
  - Comprehensive type guards: `isObject`, `isString`, `isNumber`, `isArray`, `isFunction`, `isPromise`
  - Validation type guards: `isValidationResult`, `isValidationContext`, `isPersona`, `isTemporalNote`
  - Assertion utilities: `assertObject`, `assertString`, `assertNonEmptyString`, `assertNumber`, `assertArray`, `assertFunction`
  - Utility functions: `pick`, `getProperty`

- **Evaluation System**
  - Comprehensive evaluation system with dataset loaders and metrics
  - Real-world evaluation with annotation datasets
  - Expert evaluation scenarios and challenging website tests
  - Interactive experience evaluation
  - Data-driven analysis tools
  - Performance benchmarking utilities
  - Validation scripts for evaluation components

- **Documentation**
  - Deep arXiv research comparison and analysis
  - Standalone and language-agnostic usage guide
  - Test summary and marimo.io example notebooks
  - Expert evaluation guide
  - Real-world application documentation
  - Consolidated evaluation documentation

### Changed
- Replaced all `console.log/warn` statements with logger utility across all source files
- Enhanced `buildPrompt` to automatically include context information (testType, viewport, gameState)
- Updated CI to check for console statements (not just console.log)
- CI now fails if console statements found (except in logger.mjs)
- Improved error handling with silent fallbacks for optional operations
- Better separation of concerns with dedicated logger module
- Enhanced core modules with improved type safety and validation

### Fixed
- Fixed duplicate export of `TemporalBatchOptimizer` in `src/index.mjs`
- Fixed failing test: `buildPrompt` now includes context in prompt output
- Fixed missing `ValidationError` import in `judge.mjs`
- All 192 tests now passing (0 failures)

### Removed
- Archived 28+ temporary documentation files to `archive/temp-docs-20251111/`
- Removed documentation bloat: `FINAL_*`, `COMPLETE_*`, `SUMMARY_*`, `REVIEW_*`, `ANALYSIS_*` files
- Net reduction: ~3,000 lines of documentation

### Code Quality
- All source files now use logger utility instead of direct console calls
- Comprehensive test coverage with 192 passing tests
- Improved type safety with extensive type guards
- Better error handling and validation throughout

## [0.1.2] - 2025-01-27

### Security
- Enhanced pre-commit hook with comprehensive secret detection
- Added obfuscation detection (base64, hex, string concatenation)
- Detect secrets in decode functions (atob, Buffer.from)
- Added credential variable pattern matching
- Detect secrets in comments
- Added entropy analysis for decoded values
- Red team tested against 10+ bypass techniques
- Security rating: 8.5/10 - production ready

### Added
- `scripts/detect-secrets.mjs` - Advanced secret detection script
- `.secretsignore.example` - Template for secret detection exclusions
- `SECURITY_RED_TEAM_REPORT.md` - Comprehensive security analysis
- Git history scanning option (`--scan-history` flag)
- Support for `.secretsignore` configuration file

### Fixed
- Fixed test failures in `judge.test.mjs` (buildPrompt context)
- Fixed test failures in `load-env.test.mjs` (basePath handling)
- Improved `buildPrompt` to include context information
- Fixed `loadEnv` to respect basePath parameter

## [0.1.1] - 2025-01-27

### Changed
- Renamed package from `ai-screenshot-test` to `ai-browser-test`
- Updated description to reflect browser/Playwright integration and multi-modal validation
- Added persona-based experience testing with human-interpreted time scales
- Updated keywords to better reflect capabilities
- Renamed directory to match npm package name (`ai-browser-test`)
- Updated git remote to `arclabs561/ai-browser-test`
- Fixed all temporal test edge cases (null safety)

### Added
- `experiencePageAsPersona()` - Test page experience from persona perspective
- `experiencePageWithPersonas()` - Test page experience with multiple personas
- Human-interpreted time scales (reading time, interaction time) vs mechanical fps
- Comprehensive test suite (116 tests passing)

## [0.1.0] - 2025-01-27

### Added
- Initial release of VLLM Testing package
- Core validation functions (`validateScreenshot`, `VLLMJudge`)
- Multi-modal validation (`extractRenderedCode`, `multiPerspectiveEvaluation`)
- Temporal aggregation (`aggregateTemporalNotes`, `formatNotesForPrompt`)
- Score tracking (`ScoreTracker`)
- Batch optimization (`BatchOptimizer`)
- Feedback aggregation (`aggregateFeedback`, `generateRecommendations`)
- Context compression (`compressContext`, `compressStateHistory`)
- Structured data extraction (`extractStructuredData`)
- Core VLLM judge functionality (`VLLMJudge`, `validateScreenshot`)
- Configuration system with multi-provider support (Gemini, OpenAI, Claude)
- File-based caching for VLLM responses
- Multi-modal validation utilities
- Temporal aggregation for time-series analysis
- Environment variable loader (`load-env.mjs`)
- Example test file demonstrating usage
- Vercel serverless API for remote validation
- Health check endpoint
- Standalone web interface

### Changed
- Refactored from monolithic implementation into modular package
- Extracted temporal aggregation into `temporal.mjs`
- Extracted caching into `cache.mjs`
- Extracted multi-modal validation into `multi-modal.mjs`
- Centralized configuration in `config.mjs`
- Renamed package for general-purpose use (removed application-specific naming)

### Removed
- Project-specific references
- Application-specific naming removed

### Migration
- Package is now standalone and general-purpose
- Can be used in any project requiring visual testing with AI validation
- Vercel API allows remote validation without local installation

