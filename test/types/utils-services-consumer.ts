import {
  BatchOptimizer,
  CostTracker,
  DEFAULT_RUBRIC,
  buildRubricPrompt,
  calculateCostComparison,
  extractStructuredData,
  initErrorHandlers,
  optimizeCost,
  selectModelTier,
  selectModelTierAndProvider,
  selectProvider,
  validateStartup,
  validateStartupSoft,
} from '@arclabs561/ai-visual-test/utils';

const optimizer = new BatchOptimizer({ maxConcurrency: 2, requestTimeout: 500 });
const batch = optimizer.batchValidate('fixture.png', 'Inspect the page');
void batch;
optimizer.clearCache();
optimizer.getCacheStats().activeRequests satisfies number;
optimizer.getPerformanceMetrics().queue.timeoutRate satisfies number;

const tracker = new CostTracker({ storageKey: 'type-consumer', maxHistory: 10 });
tracker.recordCost({ provider: 'gemini', cost: 0, inputTokens: 1, outputTokens: 2 });
tracker.getStats().average satisfies number;
tracker.getBudgetStatus().hasBudgets satisfies boolean;

const extracted = extractStructuredData(
  '{"score": 8}',
  { score: { type: 'number', required: true } },
  { fallback: 'json' },
);
void extracted;

selectModelTier({ frequency: 'high' }) satisfies 'fast' | 'balanced' | 'best';
selectProvider({ quality: 'best' }) satisfies 'gemini' | 'openai' | 'claude' | 'groq';
selectModelTierAndProvider({ costSensitive: true }).reason satisfies string;

validateStartupSoft({ provider: 'gemini' }).warnings satisfies string[];
validateStartup({ provider: 'gemini', strict: true }).valid satisfies boolean;

buildRubricPrompt(DEFAULT_RUBRIC, true) satisfies string;
calculateCostComparison({ modelTier: 'balanced' }).recommendation.reason satisfies string;
optimizeCost({ budget: 0.01 }).withinBudget satisfies boolean | null;

initErrorHandlers satisfies () => void;
