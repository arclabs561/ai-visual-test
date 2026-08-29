/**
 * Ensemble Judging
 * 
 * Implements multiple LLM judges with consensus voting.
 * Research shows ensemble judging improves accuracy and reduces bias.
 * 
 * Supports:
 * - Multiple judges (different providers or prompts)
 * - Weighted voting
 * - Consensus calculation
 * - Disagreement analysis
 */

import { VLLMJudge } from '#judge';
import { detectBias, detectPositionBias } from './bias-detector.js';

export type VotingMethod = 'weighted_average' | 'majority' | 'consensus' | 'optimal';

/** The minimal judge protocol used by an ensemble. */
export interface JudgeLike {
  provider?: string;
  judgeScreenshot(imagePath: string, prompt: string, context?: Record<string, unknown>): Promise<JudgeResponse>;
}

/** A provider response before ensemble normalization. */
export interface JudgeResponse {
  score: number | null;
  assessment?: string | null | undefined;
  issues?: string[] | undefined;
  reasoning?: string | null | undefined;
  provider?: string | undefined;
  error?: string | null | undefined;
  [key: string]: unknown;
}

/** A provider response annotated with its stable ensemble position. */
export interface IndividualJudgment extends JudgeResponse {
  judgeIndex: number;
  issues: string[];
  raw: JudgeResponse;
}

export interface EnsembleJudgeOptions {
  judges?: JudgeLike[];
  votingMethod?: VotingMethod;
  weights?: number[] | null;
  /** Operator-supplied measured accuracies, not calibrated by this package. */
  judgeAccuracies?: number[] | null;
  minAgreement?: number;
  enableBiasDetection?: boolean;
}

export interface Availability {
  totalJudges: number;
  availableJudges: number;
  unavailableJudges: number;
  failures: Array<{ judgeIndex: number; provider?: string | undefined; reason: string }>;
}

export type Agreement =
  | { score: 0; type: 'all_failed' }
  | { score: 1; type: 'single_judge' }
  | {
    score: number;
    scoreAgreement: number;
    assessmentAgreement: number;
    mean: number;
    stdDev: number;
    scores: number[];
  };

export interface Disagreement {
  hasDisagreement: boolean;
  type?: 'all_failed' | 'insufficient_scores';
  scoreRange: number | null;
  assessmentDisagreement: boolean;
  uniqueAssessments: string[];
  maxScore: number | null;
  minScore: number | null;
}

export interface EnsembleResult {
  score: number | null;
  assessment: string;
  issues: string[];
  reasoning: string;
  confidence: number;
  availability: Availability;
  agreement: Agreement;
  disagreement: Disagreement;
  individualJudgments: IndividualJudgment[];
  judgeCount: number;
  votingMethod: VotingMethod;
  type?: 'no_effective_weight';
  biasDetection?: { individual: unknown[]; position: unknown };
}

type AggregateResult = Omit<EnsembleResult, 'agreement' | 'disagreement' | 'individualJudgments' | 'judgeCount' | 'votingMethod'>;

const DEFAULT_ASSESSMENT = (score: number) => (
  score >= 7 ? 'pass' : score >= 5 ? 'needs-improvement' : 'fail'
);

const isValidJudgment = (result: IndividualJudgment): result is IndividualJudgment & { score: number } => (
  !result?.error && Number.isFinite(result?.score)
);

const normalizeRejectionReason = (error: unknown): string => {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  if (error && typeof error === 'object' && 'message' in error
    && typeof error.message === 'string' && error.message.trim()) return error.message;
  return 'unknown_rejection';
};

/**
 * Ensemble Judge Class
 * 
 * Manages multiple judges and aggregates their results.
 * 
 * @class EnsembleJudge
 */
export class EnsembleJudge {
  judges: JudgeLike[];
  votingMethod: VotingMethod;
  judgeAccuracies: number[] | null;
  weights: number[];
  minAgreement: number;
  enableBiasDetection: boolean;
  normalizedWeights: number[];

  /**
   * @param {EnsembleJudgeOptions} [options={}] - Ensemble configuration
   */
  constructor(options: EnsembleJudgeOptions = {}) {
    const {
      judges = [],
      votingMethod = 'weighted_average', // 'weighted_average', 'majority', 'consensus', 'optimal'
      weights = null, // Array of weights for each judge
      judgeAccuracies = null, // Array of accuracy scores (0-1) for optimal weighting
      minAgreement = 0.7, // Minimum agreement for consensus
      enableBiasDetection = true
    } = options;
    
    if (!Array.isArray(judges)) {
      throw new TypeError('judges must be an array');
    }

    this.judges = judges.length > 0 ? judges : [new VLLMJudge() as unknown as JudgeLike];
    this.votingMethod = votingMethod;
    this.judgeAccuracies = judgeAccuracies; // For optimal weighting (arXiv:2510.01499)
    this.weights = weights ?? this.judges.map(() => 1.0);
    this.minAgreement = minAgreement;
    this.enableBiasDetection = enableBiasDetection;

    // Reject a bad explicit configuration even when optimal weighting will later
    // replace it; silently accepting it makes configuration mistakes invisible.
    if (weights !== null) this.validateWeights(weights);
    
    // Calculate weights based on method
    if (votingMethod === 'optimal' && this.judgeAccuracies !== null && this.judgeAccuracies !== undefined) {
      this.validateAccuracies(this.judgeAccuracies);
      this.weights = this.calculateOptimalWeights(this.judgeAccuracies);
    }

    this.validateWeights(this.weights);

    // Scale first so finite, very large weights cannot overflow their sum.
    const maxWeight = Math.max(...this.weights);
    const scaledWeights = this.weights.map(weight => weight / maxWeight);
    const scaledWeightSum = scaledWeights.reduce((sum, weight) => sum + weight, 0);
    this.normalizedWeights = scaledWeights.map(weight => weight / scaledWeightSum);
  }

  validateWeights(weights: number[]): void {
    if (!Array.isArray(weights) || weights.length !== this.judges.length) {
      throw new RangeError(`weights must contain one finite nonnegative value for each of ${this.judges.length} judges`);
    }
    if (weights.some(weight => !Number.isFinite(weight) || weight < 0) || !weights.some(weight => weight > 0)) {
      throw new RangeError('weights must contain finite nonnegative values with at least one positive value');
    }
  }

  validateAccuracies(accuracies: number[]): void {
    if (!Array.isArray(accuracies) || accuracies.length !== this.judges.length) {
      throw new RangeError(`judgeAccuracies must contain one value for each of ${this.judges.length} judges`);
    }
    if (accuracies.some(accuracy => !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 1)) {
      throw new RangeError('judgeAccuracies must contain finite values between 0 and 1');
    }
  }

  validResults(results: IndividualJudgment[]): Array<IndividualJudgment & { score: number }> {
    return results.filter(isValidJudgment);
  }

  availability(results: IndividualJudgment[]): Availability {
    const available = this.validResults(results);
    const unavailable = results.filter(result => !isValidJudgment(result));
    return {
      totalJudges: results.length,
      availableJudges: available.length,
      unavailableJudges: unavailable.length,
      failures: unavailable.map(result => ({
        judgeIndex: result.judgeIndex,
        provider: result.provider,
        reason: result.error || 'invalid_score'
      }))
    };
  }
  
  /**
   * Calculate optimal weights using inverse generalized sigmoid function
   * Research: arXiv:2510.01499 - ω_i = σ_K^{-1}(x_i) where σ_K(x) = e^x/(K-1+e^x)
   * 
   * CORRECTED: Uses generalized sigmoid σ_K(x) for N models, not standard logistic σ(x)
   * For K=2 models, this reduces to standard logistic. For K>2, the formula differs.
   * 
   * @param {number[]} accuracies - Array of accuracy scores (0-1) for each judge
   * @returns {number[]} Optimal weights
   */
  calculateOptimalWeights(accuracies: number[]): number[] {
    const K = accuracies.length; // Number of models
    
    // Edge case: single judge gets weight 1.0
    if (K === 1) {
      return [1.0];
    }
    
    // Handle edge cases: p=0 → -∞, p=1 → +∞, so clamp to [0.001, 0.999]
    const clamped = accuracies.map(a => Math.max(0.001, Math.min(0.999, a)));
    
    // CORRECT formula: σ_K^{-1}(x) = ln(x(K-1) / (1-x))
    // This is the inverse of σ_K(x) = e^x/(K-1+e^x)
    const inverseSigmoid = clamped.map(p => {
      if (p <= 0 || p >= 1) return 0; // Safety check
      const numerator = p * (K - 1);
      const denominator = 1 - p;
      if (denominator <= 0 || numerator <= 0) return 0; // Safety check (handles K=1 case)
      const ratio = numerator / denominator;
      if (ratio <= 0) return 0; // Safety check for ln(0) or ln(negative)
      return Math.log(ratio);
    });
    
    // Normalize to positive weights (shift by min to make all positive, preserve ratios)
    const min = Math.min(...inverseSigmoid);
    const shifted = inverseSigmoid.map(w => {
      const shiftedValue = w - min + 1;
      // Ensure positive weight (clamp to minimum 0.001 to avoid zero weights)
      return Math.max(0.001, shiftedValue);
    });
    
    return shifted;
  }
  
  /**
   * Evaluate screenshot with ensemble of judges
   * 
   * @param {string} imagePath - Path to screenshot file
   * @param {string} prompt - Evaluation prompt
   * @param {import('#public-contract').ValidationContext} [context={}] - Validation context
   * @returns {Promise<EnsembleResult>} Ensemble evaluation result
   */
  async evaluate(
    imagePath: string,
    prompt: string,
    context: Record<string, unknown> = {},
  ): Promise<EnsembleResult> {
    // Run all judges in parallel
    const judgments = await Promise.all(
      this.judges.map((judge, index) => 
        judge.judgeScreenshot(imagePath, prompt, {
          ...context,
          judgeIndex: index,
          judgeCount: this.judges.length
        }).catch((error): JudgeResponse => ({
          error: normalizeRejectionReason(error),
          judgeIndex: index,
          score: null,
          provider: judge.provider,
        }))
      )
    );
    
    // Extract scores and results
    const results: IndividualJudgment[] = judgments.map((judgment, index) => ({
      judgeIndex: index,
      score: judgment.score,
      assessment: judgment.assessment,
      issues: judgment.issues || [],
      reasoning: judgment.reasoning,
      provider: judgment.provider,
      error: judgment.error,
      raw: judgment
    }));
    
    // Aggregate results
    const aggregated = this.aggregateResults(results);
    
    // Detect biases if enabled
    if (this.enableBiasDetection) {
      aggregated.biasDetection = {
        individual: results.map(r => detectBias(r.reasoning || '')),
        position: detectPositionBias(this.validResults(results))
      };
    }
    
    // Calculate agreement
    const agreement = this.calculateAgreement(results);
    const disagreement = this.analyzeDisagreement(results);
    
    return {
      ...aggregated,
      agreement,
      disagreement,
      individualJudgments: results,
      judgeCount: this.judges.length,
      votingMethod: this.votingMethod
    };
  }
  
  /**
   * Aggregate results based on voting method
   */
  aggregateResults(results: IndividualJudgment[]): AggregateResult {
    const validResults = this.validResults(results);
    const availability = this.availability(results);
    
    if (validResults.length === 0) {
      return {
        score: null,
        assessment: 'error',
        issues: ['All judges failed'],
        reasoning: 'No valid judge scores were available',
        confidence: 0,
        availability
      };
    }

    let aggregate: Omit<AggregateResult, 'availability'>;
    switch (this.votingMethod) {
      case 'weighted_average':
      case 'optimal':
        aggregate = this.weightedAverage(validResults);
        break;
      case 'majority':
        aggregate = this.majorityVote(validResults);
        break;
      case 'consensus':
        aggregate = this.consensusVote(validResults);
        break;
      default:
        aggregate = this.weightedAverage(validResults);
    }
    return { ...aggregate, availability };
  }
  
  /**
   * Weighted average voting
   */
  weightedAverage(results: IndividualJudgment[]): Omit<AggregateResult, 'availability'> {
    const validResults = this.validResults(results);
    if (validResults.length === 0) return this.aggregateResults([]);

    const scores = validResults.map(r => ({
      score: r.score,
      weight: Number.isFinite(this.normalizedWeights[r.judgeIndex])
        ? this.normalizedWeights[r.judgeIndex] ?? (1.0 / validResults.length)
        : 1.0 / validResults.length
    }));
    
    const weightedSum = scores.reduce((sum, s) => sum + (s.score * s.weight), 0);
    const totalWeight = scores.reduce((sum, s) => sum + s.weight, 0);
    if (totalWeight === 0) {
      return {
        type: 'no_effective_weight',
        score: null,
        assessment: 'error',
        issues: ['No available judge has an effective weight'],
        reasoning: 'The available judge results all have configured weight zero',
        confidence: 0
      };
    }
    const avgScore = weightedSum / totalWeight;
    
    // Aggregate issues (union)
    const allIssues = new Set<string>();
    validResults.forEach(r => {
      if (r.issues) r.issues.forEach(issue => allIssues.add(issue));
    });
    
    // Aggregate reasoning
    const reasoning = validResults
      .map((r, i) => `Judge ${i + 1} (${r.provider}): ${r.reasoning || 'No reasoning'}`)
      .join('\n\n');
    
    // Determine assessment
    const assessment = DEFAULT_ASSESSMENT(avgScore);
    
    return {
      score: Math.round(avgScore * 10) / 10, // Round to 1 decimal
      assessment,
      issues: Array.from(allIssues),
      reasoning: `Ensemble judgment (weighted average):\n${reasoning}`,
      confidence: this.calculateConfidence(validResults, avgScore)
    };
  }
  
  /**
   * Majority vote
   */
  majorityVote(results: IndividualJudgment[]): Omit<AggregateResult, 'availability'> {
    const validResults = this.validResults(results);
    if (validResults.length === 0) return this.aggregateResults([]);

    const assessments = validResults.map(r => r.assessment || DEFAULT_ASSESSMENT(r.score));
    const assessmentCounts: Record<string, number> = Object.create(null) as Record<string, number>;
    assessments.forEach(a => {
      assessmentCounts[a] = (assessmentCounts[a] || 0) + 1;
    });
    
    const highestCount = Math.max(...Object.values(assessmentCounts));
    const tiedAssessments = Object.keys(assessmentCounts)
      .filter(assessment => assessmentCounts[assessment] === highestCount);
    // A tie is resolved by the higher mean score, then by code-unit label order. Both rules
    // are independent of the judges' response order.
    const majorityAssessment = tiedAssessments.sort((left, right) => {
      const mean = (assessment: string) => {
        const scores = validResults
          .filter((result, index) => assessments[index] === assessment)
          .map(result => result.score);
        return scores.reduce((sum, score) => sum + score, 0) / scores.length;
      };
      const meanDifference = mean(right) - mean(left);
      if (meanDifference !== 0) return meanDifference;
      return left === right ? 0 : left < right ? -1 : 1;
    })[0] ?? 'error';
    
    // Average score of majority
    const majorityResults = validResults.filter((r, i) => assessments[i] === majorityAssessment);
    const avgScore = majorityResults.reduce((sum, r) => sum + r.score, 0) / majorityResults.length;
    
    return {
      score: Math.round(avgScore * 10) / 10,
      assessment: majorityAssessment,
      issues: Array.from(new Set(majorityResults.flatMap(r => r.issues || []))),
      reasoning: `Majority vote: ${majorityAssessment} (${assessmentCounts[majorityAssessment]}/${validResults.length} judges)${tiedAssessments.length > 1 ? '; tie resolved by mean score then assessment label code units' : ''}`,
      confidence: (assessmentCounts[majorityAssessment] ?? 0) / validResults.length
    };
  }
  
  /**
   * Consensus vote (requires high agreement)
   */
  consensusVote(results: IndividualJudgment[]): Omit<AggregateResult, 'availability'> {
    const agreement = this.calculateAgreement(results);
    const avg = this.weightedAverage(results);

    if (avg.type === 'no_effective_weight') return avg;
    
    if (agreement.score < this.minAgreement) {
      // No consensus - return weighted average with low confidence
      return {
        ...avg,
        assessment: 'no-consensus',
        confidence: agreement.score,
        reasoning: `No consensus reached (agreement: ${(agreement.score * 100).toFixed(0)}%). ${avg.reasoning}`
      };
    }
    
    // Consensus reached - return weighted average
    return avg;
  }
  
  /**
   * Calculate agreement between judges
   */
  calculateAgreement(results: IndividualJudgment[]): Agreement {
    const validResults = this.validResults(results);
    if (validResults.length === 0) {
      return { score: 0, type: 'all_failed' };
    }
    if (validResults.length === 1) {
      return { score: 1.0, type: 'single_judge' };
    }
    
    const scores = validResults.map(r => r.score);
    
    // Calculate variance
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);
    
    // Agreement is inverse of normalized standard deviation
    // Max std dev for 0-10 scale is ~5, so normalize
    const normalizedStdDev = stdDev / 5;
    const agreement = Math.max(0, 1 - normalizedStdDev);
    
    // Check assessment agreement
    const assessments = validResults.map(r => r.assessment || DEFAULT_ASSESSMENT(r.score));
    const uniqueAssessments = new Set(assessments);
    const assessmentAgreement = uniqueAssessments.size === 1 ? 1.0 : 0.5;
    
    return {
      score: (agreement + assessmentAgreement) / 2,
      scoreAgreement: agreement,
      assessmentAgreement,
      mean,
      stdDev,
      scores
    };
  }
  
  /**
   * Analyze disagreement between judges
   */
  analyzeDisagreement(results: IndividualJudgment[]): Disagreement {
    const validResults = this.validResults(results);
    if (validResults.length === 0) {
      return {
        hasDisagreement: false,
        type: 'all_failed',
        scoreRange: null,
        assessmentDisagreement: false,
        uniqueAssessments: [],
        maxScore: null,
        minScore: null
      };
    }
    if (validResults.length === 1) {
      return {
        hasDisagreement: false,
        type: 'insufficient_scores',
        scoreRange: null,
        assessmentDisagreement: false,
        uniqueAssessments: [(validResults[0]?.assessment) || DEFAULT_ASSESSMENT(validResults[0]?.score ?? 0)],
        maxScore: validResults[0]?.score ?? null,
        minScore: validResults[0]?.score ?? null
      };
    }

    const scores = validResults.map(r => r.score);
    const assessments = validResults.map(r => r.assessment || DEFAULT_ASSESSMENT(r.score));
    
    const scoreRange = Math.max(...scores) - Math.min(...scores);
    const uniqueAssessments = new Set(assessments);
    
    return {
      hasDisagreement: scoreRange > 2 || uniqueAssessments.size > 1,
      scoreRange,
      assessmentDisagreement: uniqueAssessments.size > 1,
      uniqueAssessments: Array.from(uniqueAssessments),
      maxScore: Math.max(...scores),
      minScore: Math.min(...scores)
    };
  }
  
  /**
   * Calculate confidence in aggregated result
   */
  calculateConfidence(results: IndividualJudgment[], _avgScore: number): number {
    const agreement = this.calculateAgreement(results);
    const disagreement = this.analyzeDisagreement(results);
    
    // Confidence based on agreement and number of judges
    const agreementConfidence = agreement.score;
    const judgeCountConfidence = Math.min(1.0, results.length / 3); // More judges = more confidence
    const disagreementPenalty = disagreement.hasDisagreement ? 0.2 : 0;
    
    return Math.max(0, Math.min(1.0, (agreementConfidence * 0.7 + judgeCountConfidence * 0.3) - disagreementPenalty));
  }
}

/**
 * Create an ensemble judge with multiple providers
 * 
 * @param {string[]} [providers=['gemini', 'openai']] - Array of provider names
 * @param {EnsembleJudgeOptions} [options={}] - Ensemble configuration
 * @returns {EnsembleJudge} Configured ensemble judge
 */
export function createEnsembleJudge(
  providers: string[] = ['gemini', 'openai'],
  options: Omit<EnsembleJudgeOptions, 'judges'> = {},
): EnsembleJudge {
  const judges = providers.map(provider => {
    const judge = new VLLMJudge({ provider });
    return judge as unknown as JudgeLike;
  });
  
  return new EnsembleJudge({
    ...options,
    judges
  });
}
