import { readFileSync } from 'node:fs';
import { warn, log } from './logger.js';

/**
 * Check consistency between screenshot and HTML/CSS
 * 
 * @param {Object} options - Consistency check options
 * @param {string} [options.screenshot] - Screenshot path
 * @param {Object} [options.renderedCode] - Rendered code (HTML/CSS/DOM)
 * @param {Object} [options.gameState] - Game state
 * @param {Object} [options.pageState] - Page state
 * @param {boolean} [options.strict=false] - Strict mode (warn on all inconsistencies)
 * @param {(image: Uint8Array, renderedCode: Object) => boolean} [options.compareVisual] Synchronous image/DOM comparison.
 * @returns {Object} Consistency check result
 */
export function checkCrossModalConsistency(options = {}) {
  const {
    screenshot,
    renderedCode,
    gameState,
    pageState,
    strict = false
  } = options;

  const issues = [];
  const warnings = [];
  const checks = {
    hasScreenshot: !!screenshot,
    hasRenderedCode: !!renderedCode,
    hasHTML: !!renderedCode?.html,
    hasCSS: !!renderedCode?.criticalCSS,
    hasDOM: !!renderedCode?.domStructure,
    hasGameState: !!gameState,
    hasPageState: !!pageState
  };

  let verified = false;
  if (!screenshot && !renderedCode) {
    issues.push('Missing both screenshot and rendered code');
  }
  if (screenshot && renderedCode?.html && typeof options.compareVisual === 'function') {
    try {
      const image = readFileSync(screenshot);
      if (image.length === 0) throw new Error('empty screenshot');
      const match = options.compareVisual(image, renderedCode);
      if (typeof match !== 'boolean') throw new Error('comparison must return a boolean');
      verified = true;
      if (!match) issues.push('Screenshot disagrees with rendered code');
    } catch {
      issues.push('Could not complete the screenshot comparison');
    }
  }

  // Check 2: HTML structure vs visual expectations
  if (renderedCode?.html && renderedCode?.domStructure) {
    // Check if key elements exist in DOM but might not be visible
    const domElements = Object.keys(renderedCode.domStructure);
    if (domElements.length === 0) {
      warnings.push('DOM structure is empty - may indicate missing elements');
    }

    // Check for hidden elements that should be visible
    if (renderedCode.domStructure.prideParade && !renderedCode.domStructure.prideParade.exists) {
      warnings.push('Pride parade element missing from DOM structure');
    }
  }

  // Check 3: CSS positioning vs visual layout
  if (renderedCode?.criticalCSS) {
    const cssElements = Object.keys(renderedCode.criticalCSS);
    
    // Check for positioning issues
    for (const [selector, styles] of Object.entries(renderedCode.criticalCSS)) {
      if (styles.position === 'absolute' && (styles.top === 'auto' || styles.left === 'auto')) {
        warnings.push(`Element '${selector}' has absolute positioning but auto top/left - may cause layout issues`);
      }
      
      if (styles.display === 'none' && selector.includes('game')) {
        warnings.push(`Game element '${selector}' has display:none - may not be visible`);
      }
      
      if (styles.visibility === 'hidden' && selector.includes('game')) {
        warnings.push(`Game element '${selector}' has visibility:hidden - may not be visible`);
      }
    }
  }

  // Check 4: Game state vs visual display
  if (gameState && renderedCode?.domStructure) {
    // Check if game state indicates active game but DOM doesn't show game elements
    if (gameState.gameActive && !renderedCode.domStructure.game) {
      warnings.push('Game state indicates active game but game elements not found in DOM');
    }

    // Check score consistency (if score is in game state and visible in DOM)
    if (gameState.score !== undefined) {
      // This would require VLLM to extract score from screenshot
      // For now, just note that we should check this
      if (strict) {
        warnings.push('Game state has score - should verify it matches visual display');
      }
    }
  }

  // Check 5: Page state vs rendered code
  if (pageState && renderedCode?.html) {
    // Check if page title matches
    if (pageState.title && !renderedCode.html.includes(pageState.title)) {
      warnings.push(`Page title '${pageState.title}' not found in HTML`);
    }
  }

  // Calculate consistency score
  const issueCount = issues.length;
  const warningCount = warnings.length;
  const maxIssues = 5; // Normalize to 0-1 scale
  const consistencyScore = Math.max(0, 1 - (issueCount / maxIssues) - (warningCount / (maxIssues * 2)));

  const structuralPass = warningCount === 0 || !strict;
  const isConsistent = verified && issueCount === 0 && structuralPass;

  // Log warnings if any
  if (warnings.length > 0) {
    log(`[Cross-Modal Consistency] ${warnings.length} warning(s):`, warnings);
  }

  if (issues.length > 0) {
    warn(`[Cross-Modal Consistency] ${issues.length} issue(s):`, issues);
  }

  return {
    isConsistent,
    issues,
    warnings,
    checks,
    status: verified ? (isConsistent ? 'consistent' : 'inconsistent') : 'unverified',
    score: verified ? (isConsistent ? consistencyScore : 0) : null,
    structuralScore: Math.max(0, 1 - warningCount / (maxIssues * 2)),
    summary: !verified ? 'Visual consistency unverified'
      : isConsistent ? 'Screenshot comparison passed' : 'Screenshot comparison failed'
  };
}

/**
 * Validate experience consistency (convenience function)
 * 
 * @param {Object} experience - Experience object from experiencePageAsPersona
 * @param {Object} [options={}] - Validation options
 * @param {(image: Uint8Array, renderedCode: Object) => boolean} [options.compareVisual] Synchronous image/DOM comparison.
 * @returns {Object} Consistency check result
 */
export function validateExperienceConsistency(experience, options = {}) {
  return checkCrossModalConsistency({
    screenshot: experience.screenshots?.[0]?.path,
    renderedCode: experience.renderedCode,
    gameState: experience.pageState?.gameState || experience.gameState,
    pageState: experience.pageState,
    ...options
  });
}
