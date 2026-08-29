/** Bias detection helpers for LLM-as-a-judge results. */

export type BiasType = 'verbosity' | 'length' | 'formatting' | 'authority';
export type BiasSeverity = 'none' | 'low' | 'medium' | 'high';
export interface BiasEvidence { [key: string]: unknown }
export interface DetectedBias { type: BiasType; score: number; evidence?: BiasEvidence }
export interface BiasDetection { hasBias: boolean; biases: DetectedBias[]; severity: BiasSeverity; recommendations: string[] }
export interface BiasDetectionOptions { checkVerbosity?: boolean; checkLength?: boolean; checkFormatting?: boolean; checkPosition?: boolean; checkAuthority?: boolean }
export interface PositionJudgment { score: number | null }
export interface PositionBiasOptions {
  calculateMetrics?: boolean;
  swappedJudgments?: PositionJudgment[] | null;
  qualityGap?: number | null;
  judgeModel?: string | null;
  taskMetadata?: Record<string, unknown>;
}
export interface PositionBiasResult {
  detected: boolean;
  firstBias?: boolean;
  lastBias?: boolean;
  reason?: string;
  evidence?: { firstScore: number; lastScore: number; avgMiddle: number; allScores: number[] };
  qualityGap?: { value: number | null; severity: 'unknown' | 'low' | 'medium' | 'high'; isEquivocal: boolean; note: string };
  factors?: { judgeModel: string; taskMetadata: Record<string, unknown>; note: string };
  positionConsistency?: number;
  preferenceFairness?: { firstPositionPreference: number; lastPositionPreference: number };
  metrics?: { positionConsistency: number; preferenceFairness: { firstPositionPreference: number; lastPositionPreference: number }; note: string };
  invalidScoreCount?: number;
}

function asText(judgment: string | Record<string, unknown>): string {
  return typeof judgment === 'string' ? judgment : JSON.stringify(judgment);
}
function repeatedPhrases(text: string): Array<{ phrase: string; count: number }> {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  const counts = new Map<string, number>();
  for (let index = 0; index <= words.length - 3; index += 1) {
    const phrase = words.slice(index, index + 3).join(' ');
    counts.set(phrase, (counts.get(phrase) ?? 0) + 1);
  }
  return [...counts].filter(([, count]) => count > 2).map(([phrase, count]) => ({ phrase, count }))
    .sort((left, right) => right.count - left.count).slice(0, 5);
}
function verbosity(text: string): DetectedBias | null {
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const avgWordLength = wordCount === 0 ? 0 : words.reduce((sum, word) => sum + word.length, 0) / wordCount;
  const fillerCount = ['very', 'really', 'quite', 'rather', 'somewhat', 'extremely'].reduce((count, word) => count + (text.match(new RegExp(`\\b${word}\\b`, 'gi')) ?? []).length, 0);
  const phrases = repeatedPhrases(text);
  if (!(wordCount > 500 || fillerCount > 10 || phrases.length > 3)) return null;
  return { type: 'verbosity', score: Math.min(1, wordCount / 1000 + fillerCount / 20 + phrases.length / 5), evidence: { wordCount, fillerCount, repetitivePhrases: phrases.slice(0, 3), avgWordLength } };
}
function length(text: string): DetectedBias | null {
  const mentionsLength = /length|size|long|short|brief|extensive/i.test(text);
  return mentionsLength && text.length > 200 ? { type: 'length', score: 0.7, evidence: { length: text.length, mentionsLength } } : null;
}
function formatting(text: string): DetectedBias | null {
  const hasMarkdown = /#{1,6}\s|^\*\s|^-\s|^\d+\.\s/m.test(text);
  const hasLists = (text.match(/^\s*[-*]\s/gm) ?? []).length > 3;
  const hasHeaders = (text.match(/^#{1,6}\s/gm) ?? []).length > 2;
  const mentionsFormatting = /format|structure|organized|well-formatted|markdown/i.test(text);
  return mentionsFormatting && (hasMarkdown || hasLists || hasHeaders) ? { type: 'formatting', score: 0.6, evidence: { hasMarkdown, hasLists, hasHeaders, mentionsFormatting } } : null;
}
function authority(text: string): DetectedBias | null {
  const count = ['according to', 'research shows', 'studies indicate', 'experts say', 'it is well-known', 'commonly accepted', 'standard practice', 'best practice', 'industry standard', 'widely recognized']
    .reduce((total, phrase) => total + (text.match(new RegExp(phrase, 'gi')) ?? []).length, 0);
  return count > 2 ? { type: 'authority', score: Math.min(1, count / 5), evidence: { authorityPhrasesFound: count } } : null;
}
function recommendations(biases: DetectedBias[]): string[] {
  const messages: Record<BiasType, string> = {
    verbosity: 'Judge may be favoring verbose responses. Focus evaluation on content quality, not length.',
    length: 'Judge may be biased by response length. Use rubric to focus on substantive content.',
    formatting: 'Judge may be favoring well-formatted responses. Evaluate content regardless of formatting.',
    authority: 'Judge may be biased by authoritative language. Focus on factual correctness, not tone.'
  };
  return biases.length ? biases.map((bias) => messages[bias.type]) : ['No significant biases detected. Consider using ensemble judging for high-stakes evaluations.'];
}
export function detectBias(judgment: string | Record<string, unknown>, options: BiasDetectionOptions = {}): BiasDetection {
  const text = asText(judgment);
  const candidates = [
    options.checkVerbosity !== false ? verbosity(text) : null,
    options.checkLength !== false ? length(text) : null,
    options.checkFormatting !== false ? formatting(text) : null,
    options.checkAuthority !== false ? authority(text) : null,
  ].filter((bias): bias is DetectedBias => bias !== null);
  const average = candidates.length === 0 ? 0 : candidates.reduce((sum, bias) => sum + bias.score, 0) / candidates.length;
  const severity: BiasSeverity = candidates.length === 0 ? 'none' : average >= 0.7 ? 'high' : average >= 0.4 ? 'medium' : 'low';
  return { hasBias: candidates.length > 0, biases: candidates, severity, recommendations: recommendations(candidates) };
}
function validateQualityGap(value: number | null): void {
  if (value !== null && (!Number.isFinite(value) || value < 0 || value > 1)) throw new RangeError('qualityGap must be a finite value between 0 and 1');
}
function finiteScores(judgments: PositionJudgment[]): { scores: number[]; invalidScoreCount: number } {
  let invalidScoreCount = 0;
  const scores = judgments.flatMap(({ score }) => {
    if (score === null) return [];
    if (!Number.isFinite(score)) { invalidScoreCount += 1; return []; }
    return [score];
  });
  return { scores, invalidScoreCount };
}
export function detectPositionBias(judgments: PositionJudgment[], options: PositionBiasOptions = {}): PositionBiasResult {
  if (!Array.isArray(judgments)) throw new TypeError('judgments must be an array');
  const { calculateMetrics = false, swappedJudgments = null, qualityGap = null, judgeModel = null, taskMetadata = {} } = options;
  validateQualityGap(qualityGap);
  if (judgments.length < 2) return { detected: false, reason: 'Need at least 2 judgments to detect position bias' };
  const extracted = finiteScores(judgments);
  if (extracted.invalidScoreCount > 0) return { detected: false, reason: 'Judgments include non-finite scores', invalidScoreCount: extracted.invalidScoreCount };
  const { scores } = extracted;
  if (scores.length < 2) return { detected: false, reason: 'Not enough scores to detect position bias' };
  const firstScore = scores[0]!;
  const lastScore = scores.at(-1)!;
  const middle = scores.slice(1, -1);
  const avgMiddle = middle.length ? middle.reduce((sum, score) => sum + score, 0) / middle.length : (firstScore + lastScore) / 2;
  const estimatedQualityGap = qualityGap ?? (0.5 - Math.abs((Math.max(...scores) - Math.min(...scores)) / 10 - 0.5));
  const isEquivocal = Math.abs(estimatedQualityGap - 0.5) < 0.1;
  const result: PositionBiasResult = {
    detected: Math.abs(firstScore - avgMiddle) > 2 || Math.abs(lastScore - avgMiddle) > 2,
    firstBias: Math.abs(firstScore - avgMiddle) > 2,
    lastBias: Math.abs(lastScore - avgMiddle) > 2,
    evidence: { firstScore, lastScore, avgMiddle, allScores: scores },
    qualityGap: { value: estimatedQualityGap, severity: isEquivocal ? 'high' : estimatedQualityGap < 0.2 ? 'low' : 'medium', isEquivocal, note: isEquivocal ? 'Equivocal case (quality gap ≈0.5) - maximum position bias risk per arXiv:2406.07791' : 'Quality gap analysis per research findings' },
    factors: { judgeModel: judgeModel || 'unknown', taskMetadata, note: 'Judge-level and task-level factors influence bias per research' }
  };
  if (calculateMetrics && swappedJudgments?.length === judgments.length) {
    const swapped = finiteScores(swappedJudgments);
    if (swapped.invalidScoreCount === 0 && swapped.scores.length === scores.length) {
      const consistency = scores.filter((score, index) => Math.abs(score - swapped.scores[swapped.scores.length - 1 - index]!) <= 1).length / scores.length;
      const fairness = { firstPositionPreference: scores.slice(1).filter((score) => score < firstScore).length / (scores.length - 1), lastPositionPreference: scores.slice(0, -1).filter((score) => score < lastScore).length / (scores.length - 1) };
      result.positionConsistency = consistency; result.preferenceFairness = fairness;
      result.metrics = { positionConsistency: consistency, preferenceFairness: fairness, note: 'Repetition Stability (RS) requires multiple runs - calculate externally' };
    }
  }
  return result;
}
