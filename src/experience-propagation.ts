/** Visibility into how captured experience context moves through a run. */
import { log, warn } from './logger.mjs';
export type PropagationLogLevel = 'debug' | 'info' | 'warn';
export interface PropagationContext { renderedCode?: { html?: string; criticalCSS?: unknown; domStructure?: unknown } | undefined; screenshot?: unknown; state?: unknown; pageState?: unknown; gameState?: unknown; [key: string]: unknown; }
export interface PropagationEntry { stage: string; timestamp: number; hasRenderedCode: boolean; hasHTML: boolean; hasCSS: boolean; hasDOM: boolean; htmlLength: number; hasScreenshot: boolean; hasState: boolean; description: string; }
export interface PropagationTrackerOptions { enabled?: boolean; logLevel?: PropagationLogLevel; }
export interface PropagationSummary { path: PropagationEntry[]; stages: string[]; hasRenderedCodeAtAllStages: boolean; hasHTMLAtAllStages: boolean; hasCSSAtAllStages: boolean; htmlLengthProgression: number[]; }
export class ExperiencePropagationTracker {
  enabled: boolean; logLevel: PropagationLogLevel; propagationPath: PropagationEntry[];
  constructor(options: PropagationTrackerOptions = {}) { this.enabled = options.enabled !== false; this.logLevel = options.logLevel ?? 'info'; this.propagationPath = []; }
  track(stage: string, context: PropagationContext, description = ''): PropagationEntry | undefined {
    if (!this.enabled) return undefined;
    const renderedCode = context.renderedCode;
    const entry: PropagationEntry = { stage, timestamp: Date.now(), hasRenderedCode: Boolean(renderedCode), hasHTML: Boolean(renderedCode?.html), hasCSS: Boolean(renderedCode?.criticalCSS), hasDOM: Boolean(renderedCode?.domStructure), htmlLength: renderedCode?.html?.length ?? 0, hasScreenshot: Boolean(context.screenshot), hasState: Boolean(context.state ?? context.pageState ?? context.gameState), description };
    this.propagationPath.push(entry);
    if (this.logLevel === 'debug' || this.logLevel === 'info') log(`[Experience Propagation] ${stage}:`, { renderedCode: entry.hasRenderedCode ? '✓' : '✗', html: entry.hasHTML ? `✓ (${entry.htmlLength} chars)` : '✗', css: entry.hasCSS ? '✓' : '✗', dom: entry.hasDOM ? '✓' : '✗', screenshot: entry.hasScreenshot ? '✓' : '✗', state: entry.hasState ? '✓' : '✗', description });
    const previous = this.propagationPath.at(-2);
    if (previous) { if (previous.hasRenderedCode && !entry.hasRenderedCode) warn(`[Experience Propagation] WARNING: RenderedCode lost at stage '${stage}'`); if (previous.hasHTML && !entry.hasHTML) warn(`[Experience Propagation] WARNING: HTML lost at stage '${stage}'`); if (previous.hasCSS && !entry.hasCSS) warn(`[Experience Propagation] WARNING: CSS lost at stage '${stage}'`); }
    return entry;
  }
  getSummary(): PropagationSummary { return { path: this.propagationPath, stages: this.propagationPath.map(entry => entry.stage), hasRenderedCodeAtAllStages: this.propagationPath.every(entry => entry.hasRenderedCode), hasHTMLAtAllStages: this.propagationPath.every(entry => entry.hasHTML), hasCSSAtAllStages: this.propagationPath.every(entry => entry.hasCSS), htmlLengthProgression: this.propagationPath.map(entry => entry.htmlLength) }; }
  reset(): void { this.propagationPath = []; }
}
let globalTracker: ExperiencePropagationTracker | null = null;
export function getPropagationTracker(options: PropagationTrackerOptions = {}): ExperiencePropagationTracker { globalTracker ??= new ExperiencePropagationTracker(options); if (options.enabled !== undefined) globalTracker.enabled = options.enabled; if (options.logLevel !== undefined) globalTracker.logLevel = options.logLevel; return globalTracker; }
export function trackPropagation(stage: string, context: PropagationContext, description = ''): PropagationEntry | undefined { return getPropagationTracker().track(stage, context, description); }
