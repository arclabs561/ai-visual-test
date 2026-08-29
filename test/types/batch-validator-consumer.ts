import { BatchOptimizer } from '../../build/src/batch-optimizer.mjs';
import { BatchValidator } from '../../build/src/validators/batch-validator.mjs';
import type { BatchValidationResult, ValidationResult } from '../../build/src/public-contract.js';

const validator = new BatchValidator({ trackCosts: false });
export const enrichedResult: Promise<BatchValidationResult> = validator.batchValidate(
  ['checkout.png'],
  'Review the checkout layout',
);

const optimizer = new BatchOptimizer();

export async function consumeVirtualBatchDispatch(): Promise<ValidationResult[] | BatchValidationResult> {
  const result = await optimizer.batchValidate('checkout.png', 'Review the checkout layout');

  if (Array.isArray(result)) {
    const score: number | null | undefined = result[0]?.score;
    void score;
  } else {
    const total: number = result.stats?.total ?? 0;
    void total;
  }

  return result;
}
