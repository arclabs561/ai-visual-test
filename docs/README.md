# Documentation Index

Complete guide to all documentation in this repository, organized by topic with summaries and cross-references.

> **Main README**: See [../README.md](../README.md) for quick start, installation, and basic usage.

## Quick Navigation

- **[API & Design](#api--design)** - API structure, improvements, requirements
- **[Research & Implementation](#research--implementation)** - Research papers, integration status
- **[Features & Capabilities](#features--capabilities)** - Feature documentation
- **[Human Validation](#human-validation)** - Human feedback and validation systems
- **[Game & Temporal Systems](#game--temporal-systems)** - Gameplay and temporal evaluation
- **[Analysis & Reviews](#analysis--reviews)** - Code reviews, critical analysis
- **[Usage & Guides](#usage--guides)** - How-to guides and examples
- **[Performance & Security](#performance--security)** - Benchmarks, security reports

---

## API & Design

### [API_ESSENTIALS.md](./api/API_ESSENTIALS.md) ⭐ **START HERE**
**Summary**: Quick start guide with everything you need to know. Essential reading for new users.

**Key Topics**: Quick start, error handling, return types, goals, uncertainty reduction, best practices

**Connections**:
- → [STANDALONE_USAGE.md](./usage/STANDALONE_USAGE.md) - Detailed usage guide
- → [API_REVIEW_AND_ALIGNMENT.md](./api/API_REVIEW_AND_ALIGNMENT.md) - Deep dive
- → [API_CRITICAL_REQUIREMENTS.md](./api/API_CRITICAL_REQUIREMENTS.md) - Critical requirements

### [API_REVIEW_AND_ALIGNMENT.md](./api/API_REVIEW_AND_ALIGNMENT.md)
**Summary**: Deep dive into API structure, comparing against research findings, Playwright patterns, and real-world usage patterns. Identifies gaps and alignment opportunities.

**Key Topics**: API structure analysis, research alignment, usage patterns, design recommendations

**Connections**:
- → [API_CRITICAL_REQUIREMENTS.md](./api/API_CRITICAL_REQUIREMENTS.md) - Critical requirements
- → [RESEARCH_INTEGRATION.md](./research/RESEARCH_INTEGRATION.md) - Research basis
- → [COHESIVE_INTEGRATION.md](./api/COHESIVE_INTEGRATION.md) - Goals integration

### [API_CRITICAL_REQUIREMENTS.md](./api/API_CRITICAL_REQUIREMENTS.md)
**Summary**: Prioritized list of critical API requirements. Focuses on non-blocking behavior, data integrity, error resilience, backward compatibility, and performance.

**Key Topics**: Non-blocking validation, error handling, backward compatibility, performance requirements

**Connections**:
- → [API_REVIEW_AND_ALIGNMENT.md](./api/API_REVIEW_AND_ALIGNMENT.md) - Detailed review
- → [HUMAN_VALIDATION_INTEGRATION.md](./human-validation/HUMAN_VALIDATION_INTEGRATION.md) - Human validation requirements

---

## Research & Implementation

### [RESEARCH_INTEGRATION.md](./research/RESEARCH_INTEGRATION.md)
**Summary**: Complete tracking of research paper references and their integration status. Lists 18+ papers with implementation details, status, and next steps.

**Key Topics**: arXiv papers, implementation status, variable goals, quality assurance

**Connections**:
- → [RESEARCH_UPDATE_2025.md](./research/RESEARCH_UPDATE_2025.md) - Latest research
- → [UNCERTAINTY_REDUCTION_RESEARCH.md](./research/UNCERTAINTY_REDUCTION_RESEARCH.md) - Uncertainty reduction

### [RESEARCH_UPDATE_2025.md](./research/RESEARCH_UPDATE_2025.md)
**Summary**: Latest research findings from 2024-2025 papers on LLM-as-a-judge, web testing, and vision-language models. Includes citations and implementation recommendations.

**Key Topics**: Latest papers, research trends, implementation recommendations

**Connections**:
- → [RESEARCH_INTEGRATION.md](./research/RESEARCH_INTEGRATION.md) - Integration status

---

## Features & Capabilities

### [VARIABLE_GOALS_FOR_GAMES.md](./features/VARIABLE_GOALS_FOR_GAMES.md)
**Summary**: Design and rationale for variable goals/prompts system for games. Covers research approaches, implementation options, and usage patterns.

**Key Topics**: Goal-conditioned policies, flexible evaluation, game testing, research alignment

**Connections**:
- → [VARIABLE_GOALS_IMPLEMENTATION.md](./features/VARIABLE_GOALS_IMPLEMENTATION.md) - Implementation details
- → [GAME_PLAYING_AND_TEMPORAL_SYSTEMS.md](./temporal/GAME_PLAYING_AND_TEMPORAL_SYSTEMS.md) - Game systems
- → [RESEARCH_INTEGRATION.md](./research/RESEARCH_INTEGRATION.md) - Research basis

### [VARIABLE_GOALS_IMPLEMENTATION.md](./features/VARIABLE_GOALS_IMPLEMENTATION.md)
**Summary**: Implementation details for variable goals system. Includes code structure, quality assurance, testing, and research alignment.

**Key Topics**: Implementation details, code quality, testing, research validation

**Connections**:
- → [VARIABLE_GOALS_FOR_GAMES.md](./features/VARIABLE_GOALS_FOR_GAMES.md) - Design rationale
- → [GAME_PLAYING_AND_TEMPORAL_SYSTEMS.md](./temporal/GAME_PLAYING_AND_TEMPORAL_SYSTEMS.md) - Game systems

### [EXPERIENCE_PROPAGATION_AND_AGGREGATION.md](./features/EXPERIENCE_PROPAGATION_AND_AGGREGATION.md)
**Summary**: How experience data propagates through temporal windows and aggregates across multiple evaluations. Technical deep dive into the propagation system.

**Key Topics**: Temporal aggregation, experience propagation, cross-modal consistency, HTML/CSS preservation

**Connections**:
- → [GAME_PLAYING_AND_TEMPORAL_SYSTEMS.md](./temporal/GAME_PLAYING_AND_TEMPORAL_SYSTEMS.md) - Temporal systems
- → [IMPROVEMENTS_IMPLEMENTED.md](./misc/IMPROVEMENTS_IMPLEMENTED.md) - Recent improvements

### [BROWSER_EXPERIENCE_AND_GAMEPLAY.md](./features/BROWSER_EXPERIENCE_AND_GAMEPLAY.md)
**Summary**: Guide to browser experience testing and gameplay evaluation. Covers persona-based testing, temporal analysis, and game-specific features.

**Key Topics**: Browser testing, gameplay evaluation, persona testing, temporal analysis

**Connections**:
- → [GAME_PLAYING_AND_TEMPORAL_SYSTEMS.md](./temporal/GAME_PLAYING_AND_TEMPORAL_SYSTEMS.md) - Temporal systems
- → [VARIABLE_GOALS_FOR_GAMES.md](./features/VARIABLE_GOALS_FOR_GAMES.md) - Variable goals

---

## Human Validation

### [HUMAN_VALIDATION_INTEGRATION.md](./human-validation/HUMAN_VALIDATION_INTEGRATION.md)
**Summary**: Complete guide to human validation system integration. Covers architecture, API design, data flow, and implementation details.

**Key Topics**: Human validation architecture, API design, data collection, calibration

**Connections**:
- → [HUMAN_VALIDATION_CAPABILITIES.md](./human-validation/HUMAN_VALIDATION_CAPABILITIES.md) - Capabilities overview
- → [API_CRITICAL_REQUIREMENTS.md](./api/API_CRITICAL_REQUIREMENTS.md) - Critical requirements

### [HUMAN_VALIDATION_CAPABILITIES.md](./human-validation/HUMAN_VALIDATION_CAPABILITIES.md)
**Summary**: Overview of human validation capabilities, features, and use cases. High-level summary of what the system can do.

**Key Topics**: Capabilities overview, use cases, features

**Connections**:
- → [HUMAN_VALIDATION_INTEGRATION.md](./human-validation/HUMAN_VALIDATION_INTEGRATION.md) - Integration details
- → [HUMAN_FEEDBACK_COLLECTION.md](./human-validation/HUMAN_FEEDBACK_COLLECTION.md) - Feedback collection

### [HUMAN_FEEDBACK_COLLECTION.md](./human-validation/HUMAN_FEEDBACK_COLLECTION.md)
**Summary**: Guide to collecting human feedback for calibration. Covers workflows, data formats, and best practices.

**Key Topics**: Feedback collection, workflows, data formats, calibration

**Connections**:
- → [HUMAN_VALIDATION_INTEGRATION.md](./human-validation/HUMAN_VALIDATION_INTEGRATION.md) - Integration
- → [REAL_HUMAN_FEEDBACK.md](./human-validation/REAL_HUMAN_FEEDBACK.md) - Real examples

### [REAL_HUMAN_FEEDBACK.md](./human-validation/REAL_HUMAN_FEEDBACK.md)
**Summary**: Examples of real human feedback collected during validation. Shows actual data and patterns.

**Key Topics**: Real feedback examples, data patterns, validation results

**Connections**:
- → [HUMAN_FEEDBACK_COLLECTION.md](./human-validation/HUMAN_FEEDBACK_COLLECTION.md) - Collection guide
- → [REAL_HUMAN_FEEDBACK.md](./human-validation/REAL_HUMAN_FEEDBACK.md) - Real examples

- → [BROWSER_EXPERIENCE_AND_GAMEPLAY.md](./features/BROWSER_EXPERIENCE_AND_GAMEPLAY.md) - Browser experience

---

## Game & Temporal Systems

### [GAME_PLAYING_AND_TEMPORAL_SYSTEMS.md](./temporal/GAME_PLAYING_AND_TEMPORAL_SYSTEMS.md)
**Summary**: Comprehensive guide to gameplay and temporal evaluation systems. Covers temporal aggregation, human perception modeling, and game-specific features.

**Key Topics**: Temporal systems, gameplay evaluation, human perception, multi-scale aggregation

**Connections**:
- → [VARIABLE_GOALS_FOR_GAMES.md](./features/VARIABLE_GOALS_FOR_GAMES.md) - Variable goals
- → [EXPERIENCE_PROPAGATION_AND_AGGREGATION.md](./features/EXPERIENCE_PROPAGATION_AND_AGGREGATION.md) - Propagation
- → [RESEARCH_INTEGRATION.md](./research/RESEARCH_INTEGRATION.md) - Research basis

---

## Analysis & Reviews

### [CRITICAL_REVIEW_FRESH_EYES.md](./analysis/CRITICAL_REVIEW_FRESH_EYES.md)
**Summary**: Comprehensive code review covering architecture, implementation quality, testing, and recommendations. Identifies strengths and areas for improvement.

**Key Topics**: Code review, architecture analysis, quality assessment, recommendations

**Connections**:
- → [REPO_REVIEW_2025.md](./analysis/REPO_REVIEW_2025.md) - Repository review
- → [UNUSED_CODE_ANALYSIS.md](./analysis/UNUSED_CODE_ANALYSIS.md) - Unused code analysis
- → [IMPROVEMENTS_IMPLEMENTED.md](./misc/IMPROVEMENTS_IMPLEMENTED.md) - Implemented improvements

---

## Usage & Guides

### [STANDALONE_USAGE.md](./usage/STANDALONE_USAGE.md)
**Summary**: Guide to using the library as a standalone package. Installation, configuration, and basic usage examples.

**Key Topics**: Installation, configuration, basic usage, examples

**Connections**:
- → [BROWSER_EXPERIENCE_AND_GAMEPLAY.md](./features/BROWSER_EXPERIENCE_AND_GAMEPLAY.md) - Browser usage
- → [TROUBLESHOOTING.md](./usage/TROUBLESHOOTING.md) - Troubleshooting

### [TROUBLESHOOTING.md](./usage/TROUBLESHOOTING.md)
**Summary**: Troubleshooting guide for common issues. Error messages, solutions, and debugging tips.

**Key Topics**: Troubleshooting, error handling, debugging, common issues

**Connections**:
- → [STANDALONE_USAGE.md](./usage/STANDALONE_USAGE.md) - Usage guide
- → [API_CRITICAL_REQUIREMENTS.md](./api/API_CRITICAL_REQUIREMENTS.md) - Requirements

### [MODEL_CONFIGURATION.md](./usage/MODEL_CONFIGURATION.md)
**Summary**: Guide to configuring AI models and providers. Provider selection, API keys, and model options.

**Key Topics**: Model configuration, provider selection, API keys, options

**Connections**:
- → [STANDALONE_USAGE.md](./STANDALONE_USAGE.md) - Usage guide


---

## Performance & Security

### [PERFORMANCE_BENCHMARKS.md](./misc/PERFORMANCE_BENCHMARKS.md)
**Summary**: Performance benchmarks and metrics. Latency, cost, accuracy measurements across different configurations.

**Key Topics**: Performance metrics, benchmarks, latency, cost analysis

**Connections**:
- → [API_CRITICAL_REQUIREMENTS.md](./api/API_CRITICAL_REQUIREMENTS.md) - Performance requirements

### [SECURITY_RED_TEAM_REPORT.md](./misc/SECURITY_RED_TEAM_REPORT.md)
**Summary**: Security assessment and red team analysis. Identifies security concerns, vulnerabilities, and recommendations.

**Key Topics**: Security assessment, vulnerabilities, recommendations, best practices

**Connections**:
- → [API_CRITICAL_REQUIREMENTS.md](./api/API_CRITICAL_REQUIREMENTS.md) - Security requirements

---

## Documentation Map

```
┌─────────────────────────────────────────────────────────────┐
│                    START HERE                                │
│              [README.md in root]                             │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
┌───────▼──────┐      ┌──────────▼──────────┐
│ API & Design │      │ Research & Impl     │
│              │      │                      │
│ • API_ESSENTIALS │  │ • RESEARCH_INTEGRATION│
│ • API_REVIEW │      │ • RESEARCH_UPDATE    │
│ • API_CRITICAL│     │ • UNCERTAINTY       │
│              │      └──────────────────────┘
└───────┬──────┘
        │
        ├─────────────────────────────────────┐
        │                                   │
┌───────▼──────────┐          ┌────────────▼──────────┐
│ Features         │          │ Human Validation        │
│                  │          │                        │
│ • VARIABLE_GOALS │          │ • HUMAN_VALIDATION_    │
│ • EXPERIENCE_    │          │   INTEGRATION          │
│   PROPAGATION    │          │ • HUMAN_FEEDBACK        │
│ • BROWSER_       │          │ • REAL_FEEDBACK        │
│   EXPERIENCE     │          └────────────────────────┘
└──────────────────┘
        │
        │
┌───────▼──────────┐
│ Implementation   │
│                  │
│ • IMPROVEMENTS   │
│ • COHESIVE       │
│ • PROPAGATION    │
└──────────────────┘
```

---

## Quick Reference by Topic

### Getting Started
- [STANDALONE_USAGE.md](./STANDALONE_USAGE.md) - How to use the library
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common issues
- [MODEL_CONFIGURATION.md](./MODEL_CONFIGURATION.md) - Setup

### API Design
- [API_ESSENTIALS.md](./API_ESSENTIALS.md) ⭐ **START HERE**
- [API_CRITICAL_REQUIREMENTS.md](./API_CRITICAL_REQUIREMENTS.md) - Critical requirements
- [API_REVIEW_AND_ALIGNMENT.md](./API_REVIEW_AND_ALIGNMENT.md) - Detailed review

### Research
- [RESEARCH_INTEGRATION.md](./RESEARCH_INTEGRATION.md) - All research papers
- [RESEARCH_UPDATE_2025.md](./RESEARCH_UPDATE_2025.md) - Latest research
- [UNCERTAINTY_REDUCTION_RESEARCH.md](./UNCERTAINTY_REDUCTION_RESEARCH.md) - Uncertainty reduction

### Features
- [VARIABLE_GOALS_FOR_GAMES.md](./VARIABLE_GOALS_FOR_GAMES.md) - Variable goals
- [BROWSER_EXPERIENCE_AND_GAMEPLAY.md](./BROWSER_EXPERIENCE_AND_GAMEPLAY.md) - Browser testing
- [GAME_PLAYING_AND_TEMPORAL_SYSTEMS.md](./GAME_PLAYING_AND_TEMPORAL_SYSTEMS.md) - Temporal systems

### Human Validation
- [HUMAN_VALIDATION_INTEGRATION.md](./HUMAN_VALIDATION_INTEGRATION.md) - Integration guide
- [HUMAN_FEEDBACK_COLLECTION.md](./HUMAN_FEEDBACK_COLLECTION.md) - Feedback collection

### Implementation
- [IMPROVEMENTS_IMPLEMENTED.md](./IMPROVEMENTS_IMPLEMENTED.md) - What's implemented
- [COHESIVE_INTEGRATION.md](./COHESIVE_INTEGRATION.md) - Goals integration
- [EXPERIENCE_PROPAGATION_AND_AGGREGATION.md](./EXPERIENCE_PROPAGATION_AND_AGGREGATION.md) - Propagation

---

## Document Statistics

- **Essential Documents**: ~24 (user-facing, features, research)
- **Reference Documents**: ~10 (implementation details)
- **Archived**: Historical analysis, summaries, and status docs moved to `archive/`

**Note**: Documentation has been consolidated. Duplicate and historical docs have been archived.

---

## Contributing to Documentation

When adding new documentation:

1. Add a summary entry to this README
2. Include connections to related documents
3. Update the documentation map if adding a new category
4. Follow the existing structure and format

