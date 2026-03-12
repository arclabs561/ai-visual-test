/**
 * Known VLM Limitations
 *
 * Documents empirically observed blind spots of Vision Language Models
 * when used as visual test judges. Based on:
 * - VLM Visual Bug Detection in HTML5 Canvas (arXiv:2501.09236)
 * - Web Accessibility Audit with MLLMs (arXiv:2511.03471)
 * - WebAccessVL (arXiv:2602.03850)
 *
 * Provides programmatic access so callers can decide when to use
 * hybrid validators (programmatic + VLM) vs VLM-only.
 */

/**
 * Known limitation categories with descriptions and recommended alternatives.
 */
export const VLM_LIMITATIONS = {
  subtleSpatialShifts: {
    description: 'VLMs struggle with layout shifts under ~5px. Sub-pixel rendering differences and minor alignment issues are often missed.',
    severity: 'high',
    recommendation: 'Use validateElementPosition() or pixel-diff tools for precise layout assertions.',
    vlmAccuracy: 'low'
  },

  elementOverlap: {
    description: 'Partially overlapping elements are often not detected, especially when the overlap is small or involves transparent regions.',
    severity: 'medium',
    recommendation: 'Use validateStateProgrammatic() with bounding-box checks for overlap detection.',
    vlmAccuracy: 'low'
  },

  keyboardNavigation: {
    description: 'VLMs cannot assess keyboard navigability from a static screenshot. Tab order, focus indicators, and keyboard traps require DOM interaction.',
    severity: 'high',
    recommendation: 'Use checkKeyboardNavigation() which tests actual DOM focus behavior.',
    vlmAccuracy: 'none'
  },

  screenReaderOrder: {
    description: 'Reading order for assistive technology cannot be determined from visual appearance alone. Requires DOM/ARIA analysis.',
    severity: 'high',
    recommendation: 'Use validateAccessibilityHybrid() which combines programmatic ARIA checks with VLM visual assessment.',
    vlmAccuracy: 'none'
  },

  colorContrastPrecision: {
    description: 'VLMs can detect obviously poor contrast but cannot reliably compute exact contrast ratios to WCAG thresholds (4.5:1, 3:1).',
    severity: 'medium',
    recommendation: 'Use checkElementContrast() or checkAllTextContrast() for WCAG-precise contrast validation.',
    vlmAccuracy: 'medium'
  },

  dynamicContent: {
    description: 'Single-screenshot evaluation misses animation timing, transition smoothness, and loading state sequences.',
    severity: 'medium',
    recommendation: 'Use captureTemporalScreenshots() or captureAdaptiveTemporalScreenshots() to capture UI across time.',
    vlmAccuracy: 'low'
  },

  textContent: {
    description: 'VLMs may misread small text, especially at low resolution or with unusual fonts. OCR accuracy decreases below ~12px rendered text.',
    severity: 'low',
    recommendation: 'Increase screenshot resolution or provide HTML context via multiModalValidation().',
    vlmAccuracy: 'medium'
  },

  interactiveState: {
    description: 'Hover states, active states, and focus indicators are not visible in static screenshots unless captured at that exact moment.',
    severity: 'medium',
    recommendation: 'Use validateStateHybrid() with explicit state assertions, or capture screenshots during interaction.',
    vlmAccuracy: 'low'
  }
};

/**
 * Get limitations relevant to a given test type
 *
 * @param {'accessibility' | 'layout' | 'visual' | 'interaction' | 'general'} testType
 * @returns {Array<{ key: string, description: string, severity: string, recommendation: string, vlmAccuracy: string }>}
 */
export function getLimitationsForTestType(testType) {
  const relevanceMap = {
    accessibility: ['keyboardNavigation', 'screenReaderOrder', 'colorContrastPrecision'],
    layout: ['subtleSpatialShifts', 'elementOverlap'],
    visual: ['colorContrastPrecision', 'textContent', 'dynamicContent'],
    interaction: ['keyboardNavigation', 'interactiveState', 'dynamicContent'],
    general: Object.keys(VLM_LIMITATIONS)
  };

  const keys = relevanceMap[testType] || relevanceMap.general;
  return keys.map(key => ({ key, ...VLM_LIMITATIONS[key] }));
}

/**
 * Check if a test type should use hybrid validation
 *
 * Returns true if the test type has known VLM blind spots where
 * hybrid validators would improve accuracy.
 *
 * @param {'accessibility' | 'layout' | 'visual' | 'interaction' | 'general'} testType
 * @returns {boolean}
 */
export function shouldUseHybridValidation(testType) {
  const highSeverityTypes = ['accessibility', 'layout', 'interaction'];
  return highSeverityTypes.includes(testType);
}
