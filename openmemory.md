# OpenMemory: arclabs561/ai-visual-test

## Overview
AI-powered visual testing framework that uses Vision Language Models (VLMs) like Gemini, OpenAI, and Anthropic to understand screenshots semantically rather than pixel-diffing. Features high-frequency validation, latency-aware optimization, and cost reduction strategies. See `test/performance/optimization-claims-validation.test.mjs` for validation of optimization claims.

## Architecture
- **Core**: Node.js ES Modules (`.mjs`).
- **Validation Engine**: Semantic analysis via VLMs (`validateScreenshot`, `SmartValidator`). Supports multi-modal inputs (screenshots + code).
- **Optimization**: `LatencyAwareBatchOptimizer` for high-frequency testing; `ModelTierSelector` and `CostOptimization` for budget management.
- **Temporal Analysis**: `TemporalDecisionManager` and `TemporalValidation` for analyzing animations and game states over time.
- **Integration**: Designed to work with Playwright for browser automation.

## Key Components
- **Judge (`src/judge.mjs`)**: Central VLLM interaction layer. Handles security (path validation, magic bytes), API calls (with retries/backoff), and result normalization.
- **Temporal Decision Manager (`src/temporal-decision-manager.mjs`)**: Implements "Efficient Sequential Decision Making" (arXiv:2406.12125). Uses warm-start + adaptive decay to reduce LLM calls.
- **Hybrid Validator (`src/validators/hybrid-validator.mjs`)**: PROVE pattern implementation. Runs programmatic checks (accessibility, state) first, then feeds results to LLM as ground truth.
- **Optimization**: `LatencyAwareBatchOptimizer` uses deadline-based scheduling. `ModelTierSelector` auto-routes requests based on requirements.

## Research Integration
- **arXiv:2406.12125**: Efficient Sequential Decision Making (adapted for decision timing).
- **arXiv:2406.07791**: Position bias and quality gaps in LLM-as-judge.
- **arXiv:2407.01085**: Length bias mitigation (AdapAlpaca).
- **arXiv:2412.05579**: Explicit rubrics for reliability.
- **arXiv:2510.01499**: Ensemble judging with optimal weighting.

## Patterns
- **Module System**: Pure ES Modules (`.mjs`).
- **Configuration**: Environment-based (`.env`) with programmatic overrides.
- **Build**: Selective obfuscation of proprietary algorithms (temporal logic, cost opt) during build.
- **Testing**: Extensive test suite (unit, integration, e2e, performance, security) using Node.js test runner and Playwright.
- **Type Safety**: JSDoc with TypeScript definitions (`index.d.ts`).

## User Defined Namespaces
- core
- optimization
- temporal
- testing
- docs
