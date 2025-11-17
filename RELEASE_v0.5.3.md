# Release v0.5.3

## Features

### High-Frequency Validation Support
- Added comprehensive tests for `LatencyAwareBatchOptimizer` (bypass batching, adaptive batch size)
- Added tests for `selectModelTier()` (high-frequency, critical, cost-sensitive selection)
- Added tests for `selectProvider()` (ultra-fast, large context, best quality selection)
- Added performance validation tests for <100ms latency claims

### Documentation Improvements
- Updated README to emphasize 60Hz real-time validation use case (generic, not downstream-specific)
- Added complete example for 60Hz game validation
- All examples now use generic terminology

### Repository Agnosticism
- Archived 3 Queeraoke-specific docs to `archive/queeraoke-docs/`
- Generalized Queeraoke references in 10+ active documentation files
- All primary docs now use generic "interactive games" terminology

### Bug Fixes
- Fixed WCAG dataset tests to gracefully skip when dataset missing
- Fixed workflow failures due to missing dataset files

## Test Results
- 639 pass, 0 fail, 13 skip
- All new high-frequency feature tests passing
- All performance validation tests passing

## Breaking Changes
None

## Migration Guide
No migration needed. This is a patch release with tests and documentation improvements.
