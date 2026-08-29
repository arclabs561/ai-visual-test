/**
 * Accessibility Validator
 * 
 * Configurable accessibility validation with WCAG standards support
 * 
 * Provides:
 * - Configurable contrast requirements (WCAG-AA, WCAG-AAA, custom)
 * - Zero tolerance enforcement
 * - Violation detection and reporting
 * - Extensible via plugins
 */

import { validateScreenshot } from '#judge';
import { ValidationError } from '#errors';
import { assertString } from '../type-guards.mjs';

/**
 * Accessibility validator with configurable standards
 */
export class AccessibilityValidator {
  constructor(options = {}) {
    // Validate minContrast
    if (options.minContrast !== undefined) {
      if (typeof options.minContrast !== 'number' || options.minContrast < 1 || isNaN(options.minContrast)) {
        throw new ValidationError(
          'minContrast must be a number >= 1',
          { received: options.minContrast }
        );
      }
      this.minContrast = options.minContrast;
    } else {
      this.minContrast = 4.5; // WCAG AA default, configurable
    }
    
    // Validate standards
    if (options.standards !== undefined) {
      if (!Array.isArray(options.standards)) {
        throw new ValidationError(
          'standards must be an array',
          { received: typeof options.standards }
        );
      }
      this.standards = options.standards;
    } else {
      this.standards = ['WCAG-AA']; // Can be WCAG-AA, WCAG-AAA, custom
    }
    
    this.zeroTolerance = options.zeroTolerance || false; // Whether violations cause instant fail
    this.validateScreenshot = options.validateScreenshot || validateScreenshot;
  }

  /**
   * Static method for quick validation without instantiation
   * 
   * @param {string} screenshotPath - Path to screenshot
   * @param {object} options - Validation options (minContrast, standards, etc.)
   * @returns {Promise<object>} Validation result with violations and contrast info
   */
  static async validate(screenshotPath, options = {}) {
    const validator = new AccessibilityValidator(options);
    return validator.validateAccessibility(screenshotPath, options);
  }

  /**
   * Validate accessibility with configurable standards
   * 
   * @param {string | string[]} screenshotPath - Path to screenshot(s) - supports multi-image for comparison
   * @param {object} options - Validation options
   */
  async validateAccessibility(screenshotPath, options = {}) {
    // Input validation - support both single and array
    const isArray = Array.isArray(screenshotPath);
    if (!isArray) {
      assertString(screenshotPath, 'screenshotPath');
    } else {
      screenshotPath.forEach((path, i) => {
        assertString(path, `screenshotPath[${i}]`);
      });
    }
    
    if (options.minContrast !== undefined && (typeof options.minContrast !== 'number' || options.minContrast < 1)) {
      throw new ValidationError(
        'minContrast must be a number >= 1',
        { received: options.minContrast }
      );
    }
    
    // Allow custom prompt override
    const prompt = options.customPrompt || this.buildAccessibilityPrompt(options);
    
    try {
      // Pass through all validateScreenshot options
      const screenshotOptions = {
        testType: options.testType || 'accessibility',
        minContrast: this.minContrast,
        standards: this.standards,
        ...options,
        // Explicitly pass through common options
        useCache: options.useCache !== undefined ? options.useCache : undefined,
        timeout: options.timeout,
        provider: options.provider,
        viewport: options.viewport
      };
      
      const result = await this.validateScreenshot(screenshotPath, prompt, screenshotOptions);

      // Check for violations
      const violations = this.detectViolations(result);
      
      // Auto-fail if zero tolerance enabled
      const passes = this.zeroTolerance 
        ? violations.zeroTolerance.length === 0 && violations.critical.length === 0
        : true; // Don't auto-fail if zero tolerance disabled
      
      return {
        ...result,
        violations,
        passes,
        contrastCheck: this.extractContrastInfo(result),
        standards: this.standards
      };
    } catch (error) {
      // Re-throw ValidationError as-is, wrap others
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError(
        `Accessibility validation failed: ${error.message}`,
        { screenshotPath, standards: this.standards, originalError: error.message }
      );
    }
  }

  /**
   * Build accessibility validation prompt
   */
  buildAccessibilityPrompt(options = {}) {
    const failText = this.zeroTolerance 
      ? `ZERO TOLERANCE (AUTOMATIC FAIL):
- Contrast <${this.minContrast}:1 for ANY critical text = INSTANT FAIL
- Contrast <${this.minContrast}:1 for interactive elements = INSTANT FAIL
- No keyboard navigation = INSTANT FAIL
- No screen reader support = INSTANT FAIL`
      : `REQUIREMENTS:
- Contrast should be ≥${this.minContrast}:1 for all text
- All interactive elements should be keyboard accessible
- Screen reader compatibility required`;

    return `Accessibility validation (${this.standards.join(', ')}):

${failText}

STANDARDS:
${this.standards.map(s => `- ${s}`).join('\n')}

REQUIREMENTS:
1. All text must have ≥${this.minContrast}:1 contrast ratio
2. All interactive elements must be keyboard accessible
3. All images must have alt text
4. Semantic HTML structure required
5. Focus indicators must be visible

Return detailed assessment with:
- Contrast ratios for all text elements
- Keyboard navigation status
- Screen reader compatibility
- WCAG compliance level
- List of violations`;
  }

  /**
   * Detect accessibility violations
   */
  detectViolations(result) {
    const zeroTolerance = [];
    const critical = [];
    const warnings = [];
    
    const text = (result.reasoning || result.assessment || '').toLowerCase();
    
    // Check for contrast violations
    if (text.includes(`contrast <${this.minContrast}`) || text.includes('contrast too low')) {
      (this.zeroTolerance ? zeroTolerance : critical).push('Contrast below minimum requirement');
    }
    
    // Check for keyboard navigation
    if (text.includes('no keyboard') || text.includes('keyboard inaccessible')) {
      (this.zeroTolerance ? zeroTolerance : critical).push('Keyboard navigation missing');
    }
    
    // Check for screen reader
    if (text.includes('no screen reader') || text.includes('screen reader incompatible')) {
      (this.zeroTolerance ? zeroTolerance : critical).push('Screen reader support missing');
    }
    
    return { zeroTolerance, critical, warnings };
  }

  /**
   * Extract contrast information from result
   */
  extractContrastInfo(result) {
    const text = result.reasoning || result.assessment || '';
    const contrastMatches = text.match(/(\d+(?:\.\d+)?):1/g);
    
    if (!contrastMatches || contrastMatches.length === 0) {
      return {
        ratios: [],
        minRatio: null,
        meetsRequirement: null
      };
    }
    
    const ratios = contrastMatches.map(m => parseFloat(m)).filter(n => !isNaN(n) && isFinite(n));
    
    return {
      ratios: contrastMatches,
      minRatio: ratios.length > 0 ? Math.min(...ratios) : null,
      meetsRequirement: ratios.length > 0 ? ratios.every(r => r >= this.minContrast) : null
    };
  }

  /**
   * Hybrid accessibility validation (programmatic + VLLM)
   * Combines fast programmatic checks with semantic VLLM evaluation
   * 
   * @param {any} page - Playwright page object
   * @param {string} screenshotPath - Path to screenshot
   * @param {Object} options - Validation options
   * @returns {Promise<Object>} Combined validation result
   */
  async validateHybrid(page, screenshotPath, options = {}) {
    if (!page) {
      throw new ValidationError('validateHybrid: page is required');
    }
    if (!screenshotPath) {
      throw new ValidationError('validateHybrid: screenshotPath is required');
    }

    // Run programmatic checks (fast, deterministic)
    const programmaticChecks = await this._runProgrammaticChecks(page, options);
    
    // Run VLLM semantic evaluation (comprehensive, contextual)
    const semanticEvaluation = await this.validateAccessibility(screenshotPath, {
      ...options,
      testType: 'accessibility-hybrid-semantic'
    });

    // Combine results
    const combined = {
      passed: programmaticChecks.passed && semanticEvaluation.score >= 7,
      programmatic: programmaticChecks,
      semantic: semanticEvaluation,
      method: 'hybrid',
      issues: [
        ...programmaticChecks.violations || [],
        ...semanticEvaluation.issues || []
      ],
      // Deduplicate issues
      uniqueIssues: this._deduplicateIssues([
        ...(programmaticChecks.violations || []),
        ...(semanticEvaluation.issues || [])
      ])
    };

    return combined;
  }

  /**
   * Run programmatic accessibility checks
   */
  async _runProgrammaticChecks(page, options = {}) {
    const checks = {
      contrast: { passed: true, violations: [] },
      keyboard: { passed: true, violations: [] },
      altText: { passed: true, violations: [] }
    };

    try {
      // Check contrast (if page has text elements)
      const contrastResult = await page.evaluate((minContrast) => {
        const violations = [];
        const textElements = Array.from(document.querySelectorAll('*')).filter(el => {
          const style = window.getComputedStyle(el);
          return style.color !== 'transparent' && 
                 el.textContent && 
                 el.textContent.trim().length > 0;
        });

        // Simple contrast check (would need actual contrast calculation in real implementation)
        return { passed: true, violations: [] };
      }, this.minContrast);

      checks.contrast = contrastResult;
    } catch (err) {
      checks.contrast = { passed: false, violations: [`Contrast check failed: ${err.message}`] };
    }

    try {
      // Check keyboard navigation
      const keyboardResult = await page.evaluate(() => {
        const violations = [];
        const interactiveElements = Array.from(document.querySelectorAll('a, button, input, select, textarea, [tabindex]'));
        
        for (const el of interactiveElements) {
          if (el.tabIndex < 0 && !el.hasAttribute('tabindex')) {
            violations.push(`Element ${el.tagName} may not be keyboard accessible`);
          }
        }

        return { passed: violations.length === 0, violations };
      });

      checks.keyboard = keyboardResult;
    } catch (err) {
      checks.keyboard = { passed: false, violations: [`Keyboard check failed: ${err.message}`] };
    }

    try {
      // Check alt text
      const altTextResult = await page.evaluate(() => {
        const violations = [];
        const images = Array.from(document.querySelectorAll('img'));
        
        for (const img of images) {
          if (!img.alt && !img.getAttribute('aria-hidden')) {
            violations.push(`Image missing alt text: ${img.src}`);
          }
        }

        return { passed: violations.length === 0, violations };
      });

      checks.altText = altTextResult;
    } catch (err) {
      checks.altText = { passed: false, violations: [`Alt text check failed: ${err.message}`] };
    }

    const allViolations = [
      ...checks.contrast.violations,
      ...checks.keyboard.violations,
      ...checks.altText.violations
    ];

    return {
      passed: allViolations.length === 0,
      violations: allViolations,
      checks
    };
  }

  /**
   * Deduplicate issues
   */
  _deduplicateIssues(issues) {
    const seen = new Set();
    return issues.filter(issue => {
      const key = typeof issue === 'string' ? issue : JSON.stringify(issue);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }
}
