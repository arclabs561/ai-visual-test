/**
 * Natural Language Spec Error Analysis Framework
 * 
 * Categorizes failures, tracks patterns, provides actionable feedback,
 * and measures spec quality based on real-world BDD patterns.
 * 
 * Based on research findings:
 * - BDD adoption patterns (27% of projects use BDD)
 * - Common failure categories (maintenance, brittleness, trust)
 * - Best practices (scenario independence, domain language, living documentation)
 */

import { parseSpec, executeSpec, validateSpec } from '../../src/natural-language-specs.mjs';
import { writeFileSync } from 'fs';
import { join } from 'path';

/**
 * Error categories based on real-world BDD failure patterns
 */
export const ERROR_CATEGORIES = {
  // Parsing errors
  PARSING_FAILURE: 'parsing_failure',
  CONTEXT_EXTRACTION_FAILURE: 'context_extraction_failure',
  AMBIGUOUS_SPEC: 'ambiguous_spec',
  
  // Structure errors
  MISSING_STRUCTURE: 'missing_structure',
  INVALID_GIVEN_WHEN_THEN: 'invalid_given_when_then',
  DEPENDENT_SCENARIOS: 'dependent_scenarios',
  
  // Execution errors
  INTERFACE_MAPPING_FAILURE: 'interface_mapping_failure',
  EXECUTION_ERROR: 'execution_error',
  TIMEOUT: 'timeout',
  
  // Quality errors
  POOR_DOMAIN_LANGUAGE: 'poor_domain_language',
  TECHNICAL_LANGUAGE: 'technical_language',
  OVERLY_COMPLEX: 'overly_complex',
  MISSING_CONTEXT: 'missing_context',
  
  // Validation errors
  VALIDATION_FAILURE: 'validation_failure',
  SCORE_OUT_OF_RANGE: 'score_out_of_range',
  ISSUES_NOT_DETECTED: 'issues_not_detected',
  
  // Maintenance errors
  BRITTLE_SPEC: 'brittle_spec',
  HARDCODED_VALUES: 'hardcoded_values',
  UNMAINTAINABLE: 'unmaintainable'
};

/**
 * Analyze spec execution errors
 */
export function analyzeSpecError(spec, error, result = null) {
  const analysis = {
    spec: typeof spec === 'string' ? spec : (spec.spec || spec.text || ''),
    error: error?.message || String(error),
    category: null,
    severity: 'medium',
    patterns: [],
    recommendations: [],
    qualityScore: null
  };
  
  // Categorize error
  if (error?.message) {
    const errorMsg = error.message.toLowerCase();
    
    if (errorMsg.includes('parse') || errorMsg.includes('parsing')) {
      analysis.category = ERROR_CATEGORIES.PARSING_FAILURE;
      analysis.severity = 'high';
      analysis.recommendations.push('Check spec syntax - ensure proper Given/When/Then structure');
      analysis.recommendations.push('Verify spec text is valid and complete');
    } else if (errorMsg.includes('context') || errorMsg.includes('extract')) {
      analysis.category = ERROR_CATEGORIES.CONTEXT_EXTRACTION_FAILURE;
      analysis.severity = 'medium';
      analysis.recommendations.push('Add explicit context (URL, viewport, device) to spec');
      analysis.recommendations.push('Use clear context format: "Context: url=..., viewport=..."');
    } else if (errorMsg.includes('timeout')) {
      analysis.category = ERROR_CATEGORIES.TIMEOUT;
      analysis.severity = 'medium';
      analysis.recommendations.push('Reduce spec complexity or increase timeout');
      analysis.recommendations.push('Break complex scenarios into smaller, independent scenarios');
    } else if (errorMsg.includes('interface') || errorMsg.includes('mapping')) {
      analysis.category = ERROR_CATEGORIES.INTERFACE_MAPPING_FAILURE;
      analysis.severity = 'high';
      analysis.recommendations.push('Add keywords to spec: game, accessible, state, screenshot, experience');
      analysis.recommendations.push('Use clear validation keywords in spec text');
    } else {
      analysis.category = ERROR_CATEGORIES.EXECUTION_ERROR;
      analysis.severity = 'high';
    }
  }
  
  // Analyze spec quality
  const qualityAnalysis = analyzeSpecQuality(analysis.spec);
  analysis.qualityScore = qualityAnalysis.score;
  analysis.patterns.push(...qualityAnalysis.patterns);
  analysis.recommendations.push(...qualityAnalysis.recommendations);
  
  // Analyze result if available
  if (result) {
    const resultAnalysis = analyzeResult(result);
    analysis.patterns.push(...resultAnalysis.patterns);
    analysis.recommendations.push(...resultAnalysis.recommendations);
    
    if (result.success === false) {
      analysis.category = analysis.category || ERROR_CATEGORIES.VALIDATION_FAILURE;
    }
  }
  
  return analysis;
}

/**
 * Analyze spec quality based on BDD best practices
 */
export function analyzeSpecQuality(spec) {
  const analysis = {
    score: 100,
    patterns: [],
    recommendations: []
  };
  
  if (!spec || typeof spec !== 'string') {
    return { score: 0, patterns: ['invalid_spec'], recommendations: ['Spec must be a non-empty string'] };
  }
  
  const lines = spec.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const lower = spec.toLowerCase();
  
  // Check structure (Given/When/Then)
  const hasGiven = lines.some(l => l.toLowerCase().startsWith('given'));
  const hasWhen = lines.some(l => l.toLowerCase().startsWith('when'));
  const hasThen = lines.some(l => l.toLowerCase().startsWith('then'));
  
  if (!hasGiven && !hasWhen && !hasThen) {
    analysis.score -= 20;
    analysis.patterns.push(ERROR_CATEGORIES.MISSING_STRUCTURE);
    analysis.recommendations.push('Use Given/When/Then structure for better parsing');
  } else if (!hasGiven || !hasWhen || !hasThen) {
    analysis.score -= 10;
    analysis.patterns.push(ERROR_CATEGORIES.INVALID_GIVEN_WHEN_THEN);
    analysis.recommendations.push('Ensure spec has all three: Given (precondition), When (action), Then (expected result)');
  }
  
  // Check for domain language vs technical language
  const technicalTerms = ['api', 'endpoint', 'json', 'http', 'status code', 'dom', 'css', 'selector'];
  const hasTechnicalTerms = technicalTerms.some(term => lower.includes(term));
  
  if (hasTechnicalTerms) {
    analysis.score -= 15;
    analysis.patterns.push(ERROR_CATEGORIES.TECHNICAL_LANGUAGE);
    analysis.recommendations.push('Use domain language instead of technical terms - describe behavior, not implementation');
  }
  
  // Check for hardcoded values
  const hardcodedPatterns = [
    /\d{2,}/g, // Numbers (could be hardcoded)
    /exactly\s+\d+/i, // "exactly 42"
    /should\s+be\s+\d+/i // "should be 42"
  ];
  
  const hasHardcoded = hardcodedPatterns.some(pattern => pattern.test(spec));
  if (hasHardcoded && spec.match(/\d{2,}/g)?.length > 3) {
    analysis.score -= 10;
    analysis.patterns.push(ERROR_CATEGORIES.HARDCODED_VALUES);
    analysis.recommendations.push('Avoid hardcoded values - use descriptive language instead');
  }
  
  // Check for complexity (too many steps)
  const stepCount = lines.filter(l => 
    l.toLowerCase().startsWith('given') ||
    l.toLowerCase().startsWith('when') ||
    l.toLowerCase().startsWith('then') ||
    l.toLowerCase().startsWith('and') ||
    l.toLowerCase().startsWith('but')
  ).length;
  
  if (stepCount > 10) {
    analysis.score -= 15;
    analysis.patterns.push(ERROR_CATEGORIES.OVERLY_COMPLEX);
    analysis.recommendations.push('Break complex scenarios into smaller, focused scenarios');
    analysis.recommendations.push('Each scenario should test one specific behavior');
  }
  
  // Check for context
  const hasUrl = /(?:visit|open|navigate to|goto)\s+[^\s]+/i.test(spec) || spec.includes('http');
  const hasViewport = /viewport|screen|resolution/i.test(spec);
  const hasDevice = /device|desktop|mobile|tablet/i.test(spec);
  
  if (!hasUrl && !hasViewport && !hasDevice) {
    analysis.score -= 10;
    analysis.patterns.push(ERROR_CATEGORIES.MISSING_CONTEXT);
    analysis.recommendations.push('Include context in spec: URL, viewport, device, or pass in options');
  }
  
  // Check for scenario independence (look for dependencies)
  const dependencyKeywords = ['after', 'before', 'previous', 'next', 'then do', 'after that'];
  const hasDependencies = dependencyKeywords.some(keyword => lower.includes(keyword));
  
  if (hasDependencies) {
    analysis.score -= 15;
    analysis.patterns.push(ERROR_CATEGORIES.DEPENDENT_SCENARIOS);
    analysis.recommendations.push('Make scenarios independent - each should be executable in isolation');
  }
  
  // Check for domain language quality
  const domainKeywords = ['user', 'customer', 'visitor', 'player', 'game', 'form', 'page', 'button'];
  const hasDomainKeywords = domainKeywords.some(keyword => lower.includes(keyword));
  
  if (!hasDomainKeywords && lines.length > 3) {
    analysis.score -= 5;
    analysis.patterns.push(ERROR_CATEGORIES.POOR_DOMAIN_LANGUAGE);
    analysis.recommendations.push('Use domain language that business stakeholders understand');
  }
  
  // Ensure score is in valid range
  analysis.score = Math.max(0, Math.min(100, analysis.score));
  
  return analysis;
}

/**
 * Analyze execution result
 */
export function analyzeResult(result) {
  const analysis = {
    patterns: [],
    recommendations: []
  };
  
  if (!result) return analysis;
  
  // Check success rate
  if (result.results) {
    const successRate = result.results.filter(r => r.success).length / result.results.length;
    
    if (successRate < 0.5) {
      analysis.patterns.push('low_success_rate');
      analysis.recommendations.push('Review spec - low success rate indicates spec issues');
    }
  }
  
  // Check extracted context
  if (result.extractedContext) {
    const contextKeys = Object.keys(result.extractedContext);
    if (contextKeys.length === 0) {
      analysis.patterns.push(ERROR_CATEGORIES.MISSING_CONTEXT);
      analysis.recommendations.push('Add context to spec for better extraction');
    }
  }
  
  // Check validation warnings
  if (result.spec?.warnings) {
    analysis.patterns.push('validation_warnings');
    analysis.recommendations.push('Address validation warnings before execution');
  }
  
  return analysis;
}

/**
 * Categorize failures by pattern
 */
export function categorizeFailures(analyses) {
  const categories = {};
  
  for (const analysis of analyses) {
    const category = analysis.category || 'unknown';
    if (!categories[category]) {
      categories[category] = {
        count: 0,
        severity: analysis.severity || 'medium',
        examples: [],
        commonRecommendations: []
      };
    }
    
    categories[category].count++;
    if (categories[category].examples.length < 5) {
      categories[category].examples.push({
        spec: analysis.spec.substring(0, 100),
        error: analysis.error,
        recommendations: analysis.recommendations.slice(0, 3)
      });
    }
    
    // Collect common recommendations
    for (const rec of analysis.recommendations) {
      const existing = categories[category].commonRecommendations.find(r => r.text === rec);
      if (existing) {
        existing.count++;
      } else {
        categories[category].commonRecommendations.push({ text: rec, count: 1 });
      }
    }
  }
  
  // Sort recommendations by frequency
  for (const category of Object.values(categories)) {
    category.commonRecommendations.sort((a, b) => b.count - a.count);
  }
  
  return categories;
}

/**
 * Generate error analysis report
 */
export async function generateErrorAnalysisReport(specs, results = []) {
  const analyses = [];
  
  // Analyze each spec
  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i];
    const result = results[i] || null;
    const error = result?.error || null;
    
    try {
      // Validate spec first
      const validation = validateSpec(typeof spec === 'string' ? spec : (spec.spec || spec.text || ''));
      
      if (!validation.valid || validation.errors.length > 0) {
        analyses.push(analyzeSpecError(spec, { message: validation.errors.join(', ') }, null));
      } else {
        analyses.push(analyzeSpecError(spec, error, result));
      }
    } catch (err) {
      analyses.push(analyzeSpecError(spec, err, result));
    }
  }
  
  // Categorize failures
  const categories = categorizeFailures(analyses);
  
  // Calculate statistics
  const stats = {
    total: analyses.length,
    withErrors: analyses.filter(a => a.category).length,
    averageQualityScore: analyses.reduce((sum, a) => sum + (a.qualityScore || 0), 0) / analyses.length,
    qualityDistribution: {
      excellent: analyses.filter(a => (a.qualityScore || 0) >= 90).length,
      good: analyses.filter(a => (a.qualityScore || 0) >= 70 && (a.qualityScore || 0) < 90).length,
      fair: analyses.filter(a => (a.qualityScore || 0) >= 50 && (a.qualityScore || 0) < 70).length,
      poor: analyses.filter(a => (a.qualityScore || 0) < 50).length
    }
  };
  
  const report = {
    timestamp: new Date().toISOString(),
    summary: stats,
    categories,
    analyses,
    recommendations: generateOverallRecommendations(categories, stats)
  };
  
  return report;
}

/**
 * Generate overall recommendations
 */
function generateOverallRecommendations(categories, stats) {
  const recommendations = [];
  
  // Quality recommendations
  if (stats.qualityDistribution.poor > stats.total * 0.2) {
    recommendations.push({
      priority: 'high',
      category: 'spec_quality',
      message: `${stats.qualityDistribution.poor} specs have poor quality scores - focus on improving spec structure and domain language`
    });
  }
  
  // Category-specific recommendations
  const topCategories = Object.entries(categories)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 3);
  
  for (const [category, data] of topCategories) {
    if (data.count > stats.total * 0.1) {
      recommendations.push({
        priority: data.severity === 'high' ? 'high' : 'medium',
        category: category,
        message: `${data.count} failures in ${category} - ${data.commonRecommendations[0]?.text || 'Review spec patterns'}`
      });
    }
  }
  
  return recommendations;
}

/**
 * Run error analysis on spec dataset
 */
export async function runErrorAnalysis(specs, options = {}) {
  const { saveReport = true, outputPath = null } = options;
  
  console.log('🔬 Running Error Analysis on Natural Language Specs\n');
  console.log(`Analyzing ${specs.length} specs...\n`);
  
  // Execute specs and collect results
  const results = [];
  for (const spec of specs) {
    try {
      // For analysis, we just parse and validate - don't need full execution
      const parsed = await parseSpec(typeof spec === 'string' ? spec : (spec.spec || spec.text || ''));
      const validation = validateSpec(typeof spec === 'string' ? spec : (spec.spec || spec.text || ''));
      
      results.push({
        parsed,
        validation,
        success: validation.valid,
        error: validation.errors.length > 0 ? validation.errors.join(', ') : null
      });
    } catch (error) {
      results.push({
        parsed: null,
        validation: null,
        success: false,
        error: error.message
      });
    }
  }
  
  // Generate report
  const report = await generateErrorAnalysisReport(specs, results);
  
  // Print summary
  console.log('📊 Error Analysis Summary\n');
  console.log(`Total Specs: ${report.summary.total}`);
  console.log(`With Errors: ${report.summary.withErrors}`);
  console.log(`Average Quality Score: ${report.summary.averageQualityScore.toFixed(1)}/100\n`);
  
  console.log('Quality Distribution:');
  console.log(`  Excellent (90+): ${report.summary.qualityDistribution.excellent}`);
  console.log(`  Good (70-89): ${report.summary.qualityDistribution.good}`);
  console.log(`  Fair (50-69): ${report.summary.qualityDistribution.fair}`);
  console.log(`  Poor (<50): ${report.summary.qualityDistribution.poor}\n`);
  
  console.log('Top Failure Categories:');
  const topCategories = Object.entries(report.categories)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5);
  
  for (const [category, data] of topCategories) {
    console.log(`  ${category}: ${data.count} (${data.severity})`);
  }
  
  console.log('\n📋 Recommendations:');
  for (const rec of report.recommendations.slice(0, 5)) {
    console.log(`  [${rec.priority.toUpperCase()}] ${rec.message}`);
  }
  
  // Save report
  if (saveReport) {
    const finalPath = outputPath || join(process.cwd(), 'evaluation', 'results', `spec-error-analysis-${Date.now()}.json`);
    writeFileSync(finalPath, JSON.stringify(report, null, 2));
    console.log(`\n✅ Report saved to: ${finalPath}`);
  }
  
  return report;
}

