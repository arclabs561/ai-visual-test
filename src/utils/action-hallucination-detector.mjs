/**
 * Action Hallucination Detection
 * 
 * Verifies that actions can actually be executed before claiming success.
 * Simple element existence/visibility checks prevent claiming clicks on non-existent buttons.
 * 
 * Research Context:
 * - Hallucination rate <15% is often cited as critical for browser automation agents
 * - Agents often claim actions completed when elements don't exist
 * - Need to verify action execution actually succeeded
 * 
 * Implementation:
 * - Pre-action verification (check before clicking) is simpler and more effective
 * - Element existence/visibility/enabled checks are sufficient
 * - Complex algorithms add latency without clear benefit
 * 
 * See docs/research/IMPLEMENTATION_VS_RESEARCH.md for detailed research context.
 * 
 * @module action-hallucination-detector
 */

/**
 * Detect hallucination in action claims
 * 
 * @param {Object} action - Action that was claimed to be executed
 * @param {import('playwright').Page} page - Playwright page to verify
 * @param {Object} [options] - Detection options
 * @returns {Promise<Object>} Detection result
 */
export async function detectActionHallucination(action, page, options = {}) {
  if (!page) {
    return {
      hasHallucination: false,
      reason: 'No page available for verification',
      confidence: 0.5
    };
  }
  
  try {
    switch (action.type) {
      case 'click':
        return await detectClickHallucination(action, page, options);
      case 'keyboard':
        return await detectKeyboardHallucination(action, page, options);
      case 'type':
        return await detectTypeHallucination(action, page, options);
      case 'navigate':
        return await detectNavigateHallucination(action, page, options);
      default:
        return {
          hasHallucination: false,
          reason: 'Action type not verifiable',
          confidence: 0.5
        };
    }
  } catch (error) {
    return {
      hasHallucination: false,
      reason: `Verification error: ${error.message}`,
      confidence: 0.3,
      error: error.message
    };
  }
}

/**
 * Detect hallucination in click actions
 */
async function detectClickHallucination(action, page, options) {
  if (!action.selector) {
    return {
      hasHallucination: true,
      reason: 'Click action missing selector',
      confidence: 0.9
    };
  }
  
  try {
    // Check if element exists
    const exists = await page.locator(action.selector).count() > 0;
    
    if (!exists) {
      return {
        hasHallucination: true,
        reason: `Element with selector "${action.selector}" does not exist`,
        confidence: 0.95,
        elementExists: false
      };
    }
    
    // Check if element is visible
    const isVisible = await page.locator(action.selector).isVisible().catch(() => false);
    
    if (!isVisible) {
      return {
        hasHallucination: true,
        reason: `Element with selector "${action.selector}" exists but is not visible`,
        confidence: 0.85,
        elementExists: true,
        elementVisible: false
      };
    }
    
    // Check if element is enabled
    const isEnabled = await page.locator(action.selector).isEnabled().catch(() => true);
    
    if (!isEnabled) {
      return {
        hasHallucination: true,
        reason: `Element with selector "${action.selector}" is disabled`,
        confidence: 0.8,
        elementExists: true,
        elementVisible: true,
        elementEnabled: false
      };
    }
    
    return {
      hasHallucination: false,
      reason: 'Element exists, visible, and enabled',
      confidence: 0.9,
      elementExists: true,
      elementVisible: true,
      elementEnabled: true
    };
  } catch (error) {
    return {
      hasHallucination: true,
      reason: `Error verifying click action: ${error.message}`,
      confidence: 0.7,
      error: error.message
    };
  }
}

/**
 * Detect hallucination in keyboard actions
 */
async function detectKeyboardHallucination(action, page, options) {
  // Keyboard actions are harder to verify (no element to check)
  // But we can check if the page is interactive
  try {
    const isInteractive = await page.evaluate(() => {
      return document.readyState === 'complete' && 
             !document.hidden;
    });
    
    if (!isInteractive) {
      return {
        hasHallucination: true,
        reason: 'Page is not interactive (not ready or hidden)',
        confidence: 0.8,
        pageInteractive: false
      };
    }
    
    return {
      hasHallucination: false,
      reason: 'Page is interactive, keyboard action likely succeeded',
      confidence: 0.6, // Lower confidence (can't directly verify keyboard input)
      pageInteractive: true
    };
  } catch (error) {
    return {
      hasHallucination: false,
      reason: `Could not verify keyboard action: ${error.message}`,
      confidence: 0.5,
      error: error.message
    };
  }
}

/**
 * Detect hallucination in type actions
 */
async function detectTypeHallucination(action, page, options) {
  if (!action.selector) {
    return {
      hasHallucination: true,
      reason: 'Type action missing selector',
      confidence: 0.9
    };
  }
  
  try {
    // Check if input element exists
    const exists = await page.locator(action.selector).count() > 0;
    
    if (!exists) {
      return {
        hasHallucination: true,
        reason: `Input element with selector "${action.selector}" does not exist`,
        confidence: 0.95,
        elementExists: false
      };
    }
    
    // Check if value was actually entered
    if (action.value) {
      const actualValue = await page.locator(action.selector).inputValue().catch(() => null);
      
      if (actualValue !== action.value) {
        return {
          hasHallucination: true,
          reason: `Value mismatch: expected "${action.value}", got "${actualValue}"`,
          confidence: 0.9,
          elementExists: true,
          valueMatch: false,
          expectedValue: action.value,
          actualValue
        };
      }
    }
    
    return {
      hasHallucination: false,
      reason: 'Input element exists and value matches',
      confidence: 0.9,
      elementExists: true,
      valueMatch: true
    };
  } catch (error) {
    return {
      hasHallucination: true,
      reason: `Error verifying type action: ${error.message}`,
      confidence: 0.7,
      error: error.message
    };
  }
}

/**
 * Detect hallucination in navigate actions
 */
async function detectNavigateHallucination(action, page, options) {
  if (!action.url) {
    return {
      hasHallucination: true,
      reason: 'Navigate action missing URL',
      confidence: 0.9
    };
  }
  
  try {
    const currentUrl = page.url();
    const expectedUrl = action.url;
    
    // Check if URL matches (allowing for query params, hash)
    const urlMatches = currentUrl.includes(expectedUrl) || 
                       expectedUrl.includes(currentUrl);
    
    if (!urlMatches) {
      return {
        hasHallucination: true,
        reason: `URL mismatch: expected "${expectedUrl}", got "${currentUrl}"`,
        confidence: 0.9,
        urlMatch: false,
        expectedUrl,
        actualUrl: currentUrl
      };
    }
    
    return {
      hasHallucination: false,
      reason: 'URL matches expected navigation target',
      confidence: 0.9,
      urlMatch: true
    };
  } catch (error) {
    return {
      hasHallucination: false,
      reason: `Could not verify navigation: ${error.message}`,
      confidence: 0.5,
      error: error.message
    };
  }
}

/**
 * Batch detect action hallucinations
 */
export async function batchDetectActionHallucinations(actions, page, options = {}) {
  const results = await Promise.all(
    actions.map(action => detectActionHallucination(action, page, options))
  );
  
  const total = results.length;
  const hallucinationCount = results.filter(r => r.hasHallucination).length;
  const hallucinationRate = hallucinationCount / total;
  
  return {
    total,
    hallucinationCount,
    hallucinationRate,
    results,
    recommendation: hallucinationRate < 0.15
      ? 'Hallucination rate meets target (<15%)'
      : `Hallucination rate ${(hallucinationRate * 100).toFixed(1)}% exceeds target. Review action execution logic.`
  };
}

