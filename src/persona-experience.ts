import { trackPropagation, type PropagationSummary } from './experience-propagation.js';
import type { RenderedCode } from './multi-modal.js';
import type { AggregatedTemporalNotes, TemporalNote } from './temporal-core.js';
import type { MultiScaleAggregation, TemporalRecord } from './temporal-multi-scale.js';
import { warn } from './logger.js';

export interface Viewport { width: number; height: number; }
export interface PersonaInput { name: string; device?: string; goals?: string[]; [key: string]: unknown; }
export interface PersonaPage {
  setViewportSize?(viewport: Viewport): Promise<void>;
  goto(url: string, options: { waitUntil: 'domcontentloaded' }): Promise<unknown>;
  screenshot(options: { path: string; fullPage?: boolean }): Promise<unknown>;
  waitForTimeout(timeout: number): Promise<void>;
  viewportSize(): Viewport | null | Promise<Viewport | null>;
  evaluate<Result>(pageFunction: (argument?: unknown) => Result, argument?: unknown): Promise<Result>;
  locator(selector: string): object;
}
export interface PersonaExperienceTrace { addEvent(name: string, data: Record<string, unknown>): void; addScreenshot(path: string, description: string): void; addStateSnapshot(state: Record<string, unknown>, name: string): void; getSummary(): PropagationSummary | Record<string, unknown>; }
export interface PersonaExperienceOptions { viewport?: Viewport; device?: string; darkMode?: boolean; timeScale?: 'human' | 'mechanical'; captureScreenshots?: boolean; captureState?: boolean; captureCode?: boolean; notes?: PersonaNote[]; trace?: PersonaExperienceTrace | null; url?: string; baseURL?: string; [key: string]: unknown; }
export interface PersonaNote { step?: string; persona?: string; goal?: string; observation?: string; pageState?: Record<string, unknown> | null; renderedCode?: { html?: string; criticalCSS?: unknown; domStructure?: unknown } | null; timestamp?: number; elapsed?: number; [key: string]: unknown; }
export interface PersonaScreenshot { path: string; timestamp: number; elapsed: number; step: string; description?: string; }
export interface CrossModalConsistency { isConsistent: boolean; issues: string[]; [key: string]: unknown; }
export interface PersonaExperienceResult { persona: string; device: string; viewport: Viewport | null; notes: PersonaNote[]; screenshots: PersonaScreenshot[]; renderedCode: RenderedCode | null; pageState: Record<string, unknown> | null; duration: number; timeScale: 'human' | 'mechanical'; aggregated: AggregatedTemporalNotes | null; aggregatedMultiScale: MultiScaleAggregation | { scales: Record<string, never>; summary: string; coherence: Record<string, never> } | null; trace: PropagationSummary | Record<string, unknown> | null; consistency: CrossModalConsistency | null; }
const deviceViewports: Record<string, Viewport> = { mobile: { width: 375, height: 667 }, tablet: { width: 768, height: 1024 }, desktop: { width: 1280, height: 720 } };
function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
function supportsRenderedCode(page: PersonaPage): page is PersonaPage & { content(): Promise<string>; url(): string } { return 'content' in page && typeof (page as unknown as { content?: unknown }).content === 'function' && 'url' in page && typeof (page as unknown as { url?: unknown }).url === 'function'; }
async function capturePageState(page: PersonaPage): Promise<Record<string, unknown>> { return page.evaluate(() => ({ title: document.title, h1: document.querySelector('h1')?.textContent ?? '', description: document.querySelector('meta[name="description"]')?.getAttribute('content') ?? '', viewport: { width: window.innerWidth, height: window.innerHeight }, darkMode: document.documentElement.classList.contains('dark') || window.matchMedia('(prefers-color-scheme: dark)').matches })); }
type InteractionLocator = { first?: () => { isVisible?: () => Promise<boolean>; click?: () => Promise<void>; fill?: (value: string) => Promise<void> } };
async function simulatePersonaInteraction(page: PersonaPage, goal: string): Promise<void> { const lower = goal.toLowerCase(); const locator = page.locator(lower.includes('type') || lower.includes('input') ? 'input[type="text"]' : 'button') as InteractionLocator; const target = locator.first?.(); if ((lower.includes('click') || lower.includes('button')) && target?.isVisible && target.click && await target.isVisible()) await target.click(); else if ((lower.includes('type') || lower.includes('input')) && target?.isVisible && target.fill && await target.isVisible()) await target.fill('Test'); else if (lower.includes('scroll') || lower.includes('read')) await page.evaluate(() => window.scrollBy(0, window.innerHeight)); }
async function humanTimeScale(action: 'page-load' | 'reading' | 'interaction', options: { minTime: number; maxTime: number; timeScale: 'human' | 'mechanical'; contentLength?: number; interactionType?: string; persona?: PersonaInput | null; attentionLevel?: string }): Promise<number> { if (options.timeScale === 'mechanical') return 500; try { const temporal = await import('#temporal-multi-scale') as unknown as { humanPerceptionTime(action: string, context: Record<string, unknown>): number }; const perceptionAction = action === 'page-load' ? 'reading' : action; const perceptionTime = temporal.humanPerceptionTime(perceptionAction, { persona: options.persona ?? null, attentionLevel: options.attentionLevel ?? 'normal', actionComplexity: options.interactionType === 'think' ? 'complex' : 'normal', contentLength: options.contentLength ?? 0 }); return Math.max(options.minTime || 0, Math.min(options.maxTime || Infinity, perceptionTime)); } catch { if (action === 'page-load') return Math.random() * (options.maxTime - options.minTime) + options.minTime; if (action === 'reading') return Math.max(options.minTime, Math.min(options.maxTime, ((options.contentLength ?? 0) / 5 / 250) * 60_000)); return ({ click: 500, type: 1000, scroll: 800, read: 2000, think: 1500 }[options.interactionType ?? ''] ?? options.minTime); } }
export async function experiencePageAsPersona(page: PersonaPage, persona: PersonaInput, options: PersonaExperienceOptions = {}): Promise<PersonaExperienceResult> {
  const viewport = options.viewport ?? { width: 1280, height: 720 };
  const device = options.device ?? 'desktop';
  const timeScale = options.timeScale ?? 'human';
  const captureScreenshots = options.captureScreenshots ?? true;
  const captureState = options.captureState ?? true;
  const captureCode = options.captureCode ?? true;
  const trace = options.trace ?? null;
  const notes = [...(options.notes ?? [])];
  const screenshots: PersonaScreenshot[] = [];
  const start = Date.now();
  trace?.addEvent('experience-start', { persona: persona.name, viewport, device, timeScale });
  const selectedDevice = persona.device ?? device;
  if (page.setViewportSize) await page.setViewportSize(deviceViewports[selectedDevice] ?? viewport);
  await page.goto(options.url ?? options.baseURL ?? 'about:blank', { waitUntil: 'domcontentloaded' });
  const capture = async (step: string, description: string): Promise<string | null> => {
    if (!captureScreenshots) return null;
    const timestamp = Date.now();
    const path = `test-results/persona-${persona.name.toLowerCase().replace(/\s+/g, '-')}-${step}-${timestamp}.png`;
    try { await page.screenshot({ path, fullPage: true }); screenshots.push({ path, timestamp, elapsed: timestamp - start, step, description }); trace?.addScreenshot(path, description || step); return path; } catch { return null; }
  };
  const pageLoadScreenshot = await capture('page-load', 'Page loaded');
  await page.waitForTimeout(await humanTimeScale('page-load', { minTime: 1000, maxTime: 5000, timeScale }));
  await capture('after-initial-read', 'After initial reading time');
  let renderedCode: RenderedCode | null = null;
  if (captureCode && supportsRenderedCode(page)) { const module = await import('./multi-modal.js'); renderedCode = await module.extractRenderedCode(page as unknown as import('./multi-modal.js').MultiModalPage); trackPropagation('capture', { renderedCode }, 'Captured HTML/CSS from page'); }
  let pageState: Record<string, unknown> | null = captureState ? await capturePageState(page) : null;
  const initial: PersonaNote = { step: 'initial_experience', persona: persona.name, device: persona.device ?? device, viewport: await page.viewportSize(), observation: `Arrived at page - ${typeof pageState?.title === 'string' ? pageState.title : 'unknown'}`, pageState, renderedCode: renderedCode ? { html: renderedCode.html.substring(0, 2000), criticalCSS: renderedCode.criticalCSS, domStructure: renderedCode.domStructure } : null, timestamp: Date.now(), elapsed: Date.now() - start };
  notes.push(initial);
  trackPropagation('notes', { renderedCode: initial.renderedCode ?? undefined, pageState }, 'Added HTML/CSS to experience notes');
  let consistency: CrossModalConsistency | null = null;
  const checkConsistency = (await import('./cross-modal-consistency.mjs') as unknown as { checkCrossModalConsistency(input: Record<string, unknown>): CrossModalConsistency }).checkCrossModalConsistency;
  if (captureScreenshots && renderedCode) { consistency = checkConsistency({ screenshot: pageLoadScreenshot, renderedCode, pageState }); if (!consistency.isConsistent && consistency.issues.length > 0) warn(`[Experience] Cross-modal consistency issues: ${consistency.issues.join(', ')}`); }
  trace?.addEvent('observation', { step: 'initial_experience', observation: initial.observation ?? '', pageState: initial.pageState, renderedCode: initial.renderedCode });
  if (pageState) trace?.addStateSnapshot(pageState, 'initial_experience');
  trace?.addEvent('observation', { step: 'before-reading', observation: 'About to read/scan page content' });
  await capture('before-reading', 'Before reading/scanning');
  await page.waitForTimeout(await humanTimeScale('reading', { minTime: 2000, maxTime: 10_000, timeScale, contentLength: typeof pageState?.h1 === 'string' ? pageState.h1.length : 0 }));
  trace?.addEvent('observation', { step: 'after-reading', observation: 'Finished reading/scanning page content' });
  await capture('after-reading', 'After reading/scanning');
  for (const goal of persona.goals ?? []) {
    trace?.addEvent('interaction', { step: `before-${goal}`, goal, observation: `Preparing to ${goal}` });
    await capture(`before-${goal}`, `Before ${goal}`);
    const interactionTime = await humanTimeScale('interaction', { minTime: 500, maxTime: 3000, timeScale, interactionType: goal });
    await simulatePersonaInteraction(page, goal);
    trace?.addEvent('interaction', { step: `during-${goal}`, goal, observation: `Performing ${goal}` });
    await capture(`during-${goal}`, `During ${goal}`);
    await page.waitForTimeout(interactionTime);
    trace?.addEvent('interaction', { step: `after-${goal}`, goal, observation: `Completed ${goal}` });
    await capture(`after-${goal}`, `After ${goal}`);
    if (captureState) pageState = await page.evaluate(() => ({ title: document.title, viewport: { width: window.innerWidth, height: window.innerHeight }, activeElement: document.activeElement?.tagName ?? null }));
    const interaction: PersonaNote = { step: `interaction_${goal}`, persona: persona.name, goal, observation: `Attempted to ${goal}`, pageState, timestamp: Date.now(), elapsed: Date.now() - start };
    notes.push(interaction);
    trace?.addEvent('interaction', { step: `interaction_${goal}`, goal, observation: interaction.observation ?? '', pageState: interaction.pageState });
    if (pageState) trace?.addStateSnapshot(pageState, `after-${goal}`);
  }
  await capture('final-state', 'Final state');
  trace?.addEvent('experience-end', { duration: Date.now() - start, noteCount: notes.length, screenshotCount: screenshots.length });
  trackPropagation('experience-complete', { renderedCode: renderedCode ?? undefined, pageState, screenshot: screenshots[0]?.path ?? null }, 'Experience complete');
  if (captureScreenshots && renderedCode && screenshots.length > 0) consistency = checkConsistency({ screenshot: screenshots.at(-1)?.path ?? null, renderedCode, pageState });
  let aggregated: AggregatedTemporalNotes | null = null;
  let aggregatedMultiScale: PersonaExperienceResult['aggregatedMultiScale'] = null;
  if (notes.length > 0) {
    try {
      const temporal = await import('#temporal-core') as unknown as { aggregateTemporalNotes(notes: TemporalNote[], options: { windowSize: number; decayFactor: number }): Promise<AggregatedTemporalNotes> };
      const multi = await import('#temporal-multi-scale') as unknown as { aggregateMultiScale(notes: TemporalRecord[], options: { attentionWeights: boolean }): MultiScaleAggregation };
      aggregated = await temporal.aggregateTemporalNotes(notes, { windowSize: 10_000, decayFactor: 0.9 });
      try { aggregatedMultiScale = multi.aggregateMultiScale(notes as TemporalRecord[], { attentionWeights: true }); if (!aggregatedMultiScale.scales) aggregatedMultiScale.scales = {}; if (!aggregatedMultiScale.coherence) aggregatedMultiScale.coherence = {}; } catch (error) { warn(`[Experience] Multi-scale aggregation failed: ${errorMessage(error)}`); aggregatedMultiScale = { scales: {}, summary: 'Multi-scale aggregation failed', coherence: {} }; }
      trackPropagation('temporal-aggregation', { windows: aggregated.windows.length, coherence: aggregated.coherence, scales: Object.keys(aggregatedMultiScale.scales) }, 'Aggregated temporal notes automatically');
    } catch (error) { warn(`[Experience] Temporal aggregation failed: ${errorMessage(error)}`); }
  }
  return { persona: persona.name, device: persona.device ?? device, viewport: await page.viewportSize(), notes, aggregated, aggregatedMultiScale, screenshots, renderedCode, pageState, duration: Date.now() - start, timeScale, trace: trace?.getSummary() ?? null, consistency };
}
export async function experiencePageWithPersonas(page: PersonaPage, personas: PersonaInput[], options: PersonaExperienceOptions = {}): Promise<PersonaExperienceResult[]> { const experiences: PersonaExperienceResult[] = []; for (const persona of personas) experiences.push(await experiencePageAsPersona(page, persona, options)); return experiences; }
