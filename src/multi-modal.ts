/** Multi-modal validation over screenshots, rendered code, state, and personas. */

import { ValidationError } from '#errors';
import { warn } from './logger.mjs';
import { captureTemporalScreenshots } from '#temporal-capture';
import type {
  Page as TemporalPage,
  TemporalCaptureOptions,
  TemporalScreenshot,
} from '#temporal-capture';
import type {
  Persona,
  PerspectiveEvaluation,
  ValidationContext,
  ValidationResult,
} from '#public-contract';

export { captureTemporalScreenshots } from '#temporal-capture';
export type { TemporalCaptureOptions, TemporalScreenshot } from '#temporal-capture';

export interface Viewport {
  width: number;
  height: number;
}

/** The structural browser surface needed to extract source and rendered state. */
export interface MultiModalPage extends TemporalPage {
  content(): Promise<string>;
  evaluate<Result, Argument>(
    pageFunction: (argument: Argument) => Result,
    argument: Argument,
  ): Promise<Awaited<Result>>;
  evaluate<Result>(pageFunction: () => Result): Promise<Awaited<Result>>;
  url(): string;
  viewportSize(): Viewport | null | Promise<Viewport | null>;
}

export interface RenderedStylesheetRule {
  selectorText: string | undefined;
  cssText: string;
  style: Record<string, string> | null;
}

export interface RenderedStylesheet {
  href: string | null;
  rules: RenderedStylesheetRule[];
}

export interface InaccessibleStylesheet {
  href: string | null;
  error: 'Cross-origin or inaccessible';
}

export interface RenderedElement {
  selector: string;
  tagName: string;
  id: string;
  className: string;
  textContent: string;
  attributes: Record<string, string>;
  boundingRect: DOMRect;
  computedStyles: {
    display: string;
    visibility: string;
    position: string;
  };
}

export interface DOMStructure extends Record<string, unknown> {
  body: {
    tagName: string | undefined;
    children: number;
    textContent: string;
    attributes: Record<string, string>;
  };
  head: {
    title: string;
    meta: Array<{ name: string | null; content: string | null }>;
    links: Array<{ href: string; rel: string }>;
  };
  mainElements: RenderedElement[];
}

/** A stable, serializable representation of the page's source and computed state. */
export interface RenderedCode {
  html: string;
  stylesheets: Array<RenderedStylesheet | InaccessibleStylesheet>;
  criticalCSS: Record<string, Record<string, string>>;
  domStructure: DOMStructure;
  timestamp: number;
  url: string;
  viewport: Viewport;
}

export interface RenderedCodeOptions {
  selectors?: string[] | null;
  htmlLimit?: number;
  includeAllCSS?: boolean;
}

type ValidationFunction = (
  path: string,
  prompt: string,
  context: ValidationContext,
) => Promise<ValidationResult>;

export interface MultiModalValidationOptions {
  fps?: number;
  duration?: number;
  captureCode?: boolean;
  captureState?: boolean;
  multiPerspective?: boolean;
}

export interface MultiModalValidationResult {
  screenshotPath: string;
  renderedCode: RenderedCode | null;
  gameState: Record<string, unknown>;
  temporalScreenshots: TemporalScreenshot[];
  perspectives: PerspectiveEvaluation[];
  codeValidation: Record<string, boolean>;
  aggregatedScore: number | null;
  aggregatedIssues: string[];
  timestamp: number;
}

function isMultiModalPage(page: unknown): page is MultiModalPage {
  const candidate = page as Partial<MultiModalPage> | null;
  if (!candidate) return false;
  return typeof candidate.content === 'function'
    && typeof candidate.evaluate === 'function'
    && typeof candidate.screenshot === 'function'
    && typeof candidate.url === 'function'
    && typeof candidate.viewportSize === 'function';
}

/** Extract rendered HTML, CSS, and DOM structure for dual-view validation. */
export async function extractRenderedCode(
  page: MultiModalPage,
  options: RenderedCodeOptions = {},
): Promise<RenderedCode> {
  if (!isMultiModalPage(page)) {
    throw new ValidationError('extractRenderedCode requires a Playwright Page object', {
      received: typeof page,
      hasEvaluate: typeof (page as Partial<MultiModalPage> | null)?.evaluate === 'function',
    });
  }

  const { selectors = null, htmlLimit = 10_000 } = options;
  const html = await page.content();
  const stylesheets = await page.evaluate(() => {
    const sheets: Array<RenderedStylesheet | InaccessibleStylesheet> = [];
    for (const sheet of document.styleSheets) {
      try {
        const rules: RenderedStylesheetRule[] = [];
        for (const rule of sheet.cssRules ?? []) {
          const styledRule = rule as CSSRule & {
            selectorText?: string;
            style?: CSSStyleDeclaration;
          };
          const style = styledRule.style
            ? Object.fromEntries(Array.from(styledRule.style).map(property => [property, styledRule.style?.getPropertyValue(property) ?? '']))
            : null;
          rules.push({
            selectorText: styledRule.selectorText,
            cssText: rule.cssText,
            style,
          });
        }
        sheets.push({ href: sheet.href, rules: rules.slice(0, 100) });
      } catch {
        sheets.push({ href: sheet.href, error: 'Cross-origin or inaccessible' });
      }
    }
    return sheets;
  });
  const criticalCSS = await page.evaluate((customSelectors: string[] | null) => {
    const styles: Record<string, Record<string, string>> = {};
    const selectorsToCheck = customSelectors ?? [
      'body', 'main', 'header', 'footer', '[role="main"]', '[role="banner"]',
      '[role="contentinfo"]', 'button', 'a', 'input', 'form', '#app', '#root',
      '.container', '.main-content',
    ];
    for (const selector of selectorsToCheck) {
      try {
        const element = document.querySelector(selector);
        if (!element) continue;
        const computed = window.getComputedStyle(element);
        styles[selector] = {
          position: computed.position, top: computed.top, bottom: computed.bottom,
          left: computed.left, right: computed.right, width: computed.width, height: computed.height,
          backgroundColor: computed.backgroundColor, color: computed.color, display: computed.display,
          visibility: computed.visibility, zIndex: computed.zIndex, transform: computed.transform,
          opacity: computed.opacity, fontSize: computed.fontSize, fontFamily: computed.fontFamily,
          lineHeight: computed.lineHeight, margin: computed.margin, padding: computed.padding,
          border: computed.border, borderRadius: computed.borderRadius, boxShadow: computed.boxShadow,
          overflow: computed.overflow, textAlign: computed.textAlign,
        };
      } catch {
        // A caller-selected selector may be invalid; omit it from the snapshot.
      }
    }
    return styles;
  }, selectors);
  const domStructure = await page.evaluate(() => {
    const attributes = (element: Element | null): Record<string, string> => Object.fromEntries(
      Array.from(element?.attributes ?? []).map(attribute => [attribute.name, attribute.value]),
    );
    const structure: DOMStructure = {
      body: {
        tagName: document.body?.tagName,
        children: document.body?.children.length ?? 0,
        textContent: document.body?.textContent?.substring(0, 500) ?? '',
        attributes: attributes(document.body),
      },
      head: {
        title: document.title,
        meta: Array.from(document.querySelectorAll('meta')).map(meta => ({
          name: meta.getAttribute('name') ?? meta.getAttribute('property'),
          content: meta.getAttribute('content'),
        })),
        links: Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')).map(link => ({
          href: link.href,
          rel: link.rel,
        })),
      },
      mainElements: [],
    };
    const keySelectors = [
      'main', '[role="main"]', '#app', '#root', 'header', '[role="banner"]',
      'footer', '[role="contentinfo"]', 'nav', '[role="navigation"]', 'article',
      '[role="article"]', 'section',
    ];
    for (const selector of keySelectors) {
      try {
        const element = document.querySelector<HTMLElement>(selector);
        if (!element) continue;
        const computed = window.getComputedStyle(element);
        structure.mainElements.push({
          selector,
          tagName: element.tagName,
          id: element.id,
          className: element.className,
          textContent: element.textContent?.substring(0, 200) ?? '',
          attributes: attributes(element),
          boundingRect: element.getBoundingClientRect(),
          computedStyles: {
            display: computed.display,
            visibility: computed.visibility,
            position: computed.position,
          },
        });
      } catch {
        // A browser may reject a selector; other selected elements remain useful.
      }
    }
    return structure;
  });

  const viewport = await page.viewportSize() ?? { width: 0, height: 0 };
  return {
    html: html.substring(0, htmlLimit),
    stylesheets,
    criticalCSS,
    domStructure,
    timestamp: Date.now(),
    url: page.url(),
    viewport,
  };
}

const DEFAULT_PERSONAS: Persona[] = [
  { name: 'Brutalist Designer', perspective: 'I evaluate based on brutalist design principles. Function over decoration. High contrast. Minimal UI.', focus: ['brutalist', 'contrast', 'minimalism', 'function'] },
  { name: 'Accessibility Advocate', perspective: 'I evaluate based on accessibility standards. WCAG compliance. Keyboard navigation. Screen reader support.', focus: ['accessibility', 'wcag', 'keyboard', 'screen-reader'] },
  { name: 'Queer Community Member', perspective: 'I evaluate based on queer community values. Inclusivity. Representation. Safe space.', focus: ['inclusivity', 'representation', 'community', 'values'] },
  { name: 'Game Designer', perspective: 'I evaluate based on game design principles. Game feel. Mechanics. Balance.', focus: ['game-feel', 'mechanics', 'balance', 'polish'] },
  { name: 'Product Purpose Validator', perspective: 'I evaluate based on product purpose alignment. Primary purpose clarity. Easter egg appropriateness.', focus: ['purpose', 'clarity', 'easter-egg', 'alignment'] },
];

function buildPersonaPrompt(
  persona: Persona,
  renderedCode: RenderedCode | null,
  gameState: Record<string, unknown>,
): string {
  return `PERSONA PERSPECTIVE: ${persona.name}
${persona.perspective}

FOCUS AREAS: ${persona.focus.join(', ')}

RENDERED CODE ANALYSIS (DOM STRUCTURE):
${JSON.stringify(renderedCode?.domStructure ?? null, null, 2)}

CSS VALIDATION (COMPUTED STYLES):
${JSON.stringify(renderedCode?.criticalCSS ?? null, null, 2)}

GAME STATE (IF APPLICABLE):
${JSON.stringify(gameState, null, 2)}

EVALUATION TASK:
Evaluate this state from your persona's perspective. Consider:
1. Visual appearance (from screenshot)
2. Code correctness (from rendered code - check positioning, structure, styles)
3. State consistency (does visual match code and game state?)
4. Principles alignment (does it match design principles and product purpose?)

Provide evaluation from your persona's perspective.`;
}

/** Evaluate one screenshot from every supplied persona perspective. */
export async function multiPerspectiveEvaluation(
  validateFn: ValidationFunction,
  screenshotPath: string,
  renderedCode: RenderedCode | null,
  gameState: Record<string, unknown> = {},
  personas: Persona[] | null = null,
): Promise<PerspectiveEvaluation[]> {
  if (typeof validateFn !== 'function') {
    throw new ValidationError('multiPerspectiveEvaluation requires a validate function', { received: typeof validateFn });
  }
  const evaluations = await Promise.all((personas ?? DEFAULT_PERSONAS).map(async persona => {
    const context: ValidationContext = {
      gameState,
      renderedCode,
      persona: persona.name,
      perspective: persona.perspective,
      focus: persona.focus,
      ...gameState,
    };
    if (typeof persona.goal === 'string') context.goal = persona.goal;
    try {
      const evaluation = await validateFn(screenshotPath, buildPersonaPrompt(persona, renderedCode, gameState), context);
      return { persona: persona.name, perspective: persona.perspective, focus: persona.focus, evaluation };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warn(`[Multi-Modal] Perspective ${persona.name} failed: ${message}`);
      return null;
    }
  }));
  return evaluations.filter((evaluation): evaluation is PerspectiveEvaluation => evaluation !== null);
}

function hasStringProperty(value: unknown, property: string): value is Record<string, string> {
  return typeof value === 'object' && value !== null && typeof (value as Record<string, unknown>)[property] === 'string';
}

function hasBooleanProperty(value: unknown, property: string): value is Record<string, boolean> {
  return typeof value === 'object' && value !== null && typeof (value as Record<string, unknown>)[property] === 'boolean';
}

function stringProperty(value: unknown, property: string): string | null {
  return hasStringProperty(value, property) ? value[property] ?? null : null;
}

function booleanProperty(value: unknown, property: string): boolean {
  return hasBooleanProperty(value, property) && value[property] === true;
}

/** Capture all available modalities and return their combined validation outcome. */
export async function multiModalValidation(
  validateFn: ValidationFunction,
  page: MultiModalPage,
  testName: string,
  options: MultiModalValidationOptions = {},
): Promise<MultiModalValidationResult> {
  if (typeof validateFn !== 'function') {
    throw new ValidationError('multiModalValidation requires a validate function', { received: typeof validateFn });
  }
  if (!isMultiModalPage(page)) {
    throw new ValidationError('multiModalValidation requires a Playwright Page object', {
      received: typeof page,
      hasScreenshot: typeof (page as Partial<MultiModalPage> | null)?.screenshot === 'function',
    });
  }
  const { fps = 2, duration = 2_000, captureCode = true, captureState = true, multiPerspective = true } = options;
  const screenshotPath = `test-results/multimodal-${testName}-${Date.now()}.png`;
  await page.screenshot({ path: screenshotPath, type: 'png' });
  const renderedCode = captureCode ? await extractRenderedCode(page) : null;
  const gameState = captureState
    ? await page.evaluate(() => (window as Window & { gameState?: Record<string, unknown> }).gameState ?? {
      gameActive: false, bricks: [], ball: null, paddle: null,
    })
    : {};
  const temporalScreenshots = fps > 0 ? await captureTemporalScreenshots(page, fps, duration) : [];
  const perspectives = multiPerspective
    ? await multiPerspectiveEvaluation(validateFn, screenshotPath, renderedCode, gameState)
    : [];
  const structure = renderedCode?.domStructure;
  const prideParade = structure?.prideParade;
  const footer = structure?.footer;
  const paymentCode = structure?.paymentCode;
  const prideTop = stringProperty(prideParade, 'computedTop');
  const footerBottom = stringProperty(footer, 'computedBottom');
  const flagCount = Number(stringProperty(prideParade, 'flagRowCount') ?? 0);
  const codeValidation: Record<string, boolean> = renderedCode ? {
    prideParadePosition: prideTop === '0px' || prideTop?.startsWith('calc') === true,
    prideParadeFlagCount: flagCount >= 15,
    flagsDynamicallyGenerated: flagCount >= 15,
    footerPosition: footerBottom === '0px' || footerBottom?.startsWith('calc') === true,
    footerStripeDynamicallyGenerated: booleanProperty(footer, 'hasStripe'),
    paymentCodeVisible: booleanProperty(paymentCode, 'visible'),
  } : {};
  const aggregatedScore = perspectives.length > 0
    ? perspectives.reduce((sum, perspective) => sum + (perspective.evaluation.score ?? 0), 0) / perspectives.length
    : null;
  const aggregatedIssues = perspectives.length > 0
    ? [...new Set(perspectives.flatMap(perspective => perspective.evaluation.issues))]
    : [];
  return {
    screenshotPath, renderedCode, gameState, temporalScreenshots, perspectives, codeValidation,
    aggregatedScore, aggregatedIssues, timestamp: Date.now(),
  };
}
