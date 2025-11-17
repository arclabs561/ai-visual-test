#!/usr/bin/env node
/**
 * Issue Filtering and Normalization
 * 
 * Filters and normalizes detected issues to reduce false positives.
 * Based on analysis showing ~22.8 issues per sample vs 0-2 ground truth.
 */

/**
 * Normalize issue text for comparison
 */
export function normalizeIssue(issue) {
  if (!issue || typeof issue !== 'string') return '';
  
  // Remove markdown formatting
  let normalized = issue
    .replace(/\*\*?/g, '')  // Bold/italic
    .replace(/#{1,6}\s*/g, '')  // Headers
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')  // Links
    .replace(/`([^`]+)`/g, '$1')  // Code
    .toLowerCase()
    .trim();
  
  // Remove score patterns (e.g., "Overall Score: 7/10", "8/10", "Score: 7")
  normalized = normalized.replace(/\b(overall\s*)?score\s*:?\s*\d+\s*\/\s*\d+\b/gi, '');
  normalized = normalized.replace(/\b\d+\s*\/\s*\d+\b/g, '');  // Any X/Y pattern
  normalized = normalized.replace(/\bscore\s*:?\s*\d+\b/gi, '');
  
  // Remove section headers (e.g., "*Visual Design: 8/10**")
  normalized = normalized.replace(/^\s*\*?\s*[a-z\s]+:\s*\d+\s*\/\s*\d+\s*\*?\s*$/i, '');
  
  // Remove excessive punctuation
  normalized = normalized.replace(/[!?]{2,}/g, '');
  
  // Normalize whitespace
  normalized = normalized.replace(/\s+/g, ' ');
  
  return normalized;
}

/**
 * Extract key accessibility/design terms from issue
 */
export function extractIssueTerms(issue) {
  const normalized = normalizeIssue(issue);
  const words = normalized.split(/\s+/).filter(w => w.length > 2);
  
  // Important terms for accessibility/design
  const importantTerms = [
    'contrast', 'color', 'wcag', 'accessibility', 'alt', 'text', 'image',
    'keyboard', 'navigation', 'screen', 'reader', 'aria', 'semantic',
    'html', 'design', 'layout', 'typography', 'readability', 'focus',
    'button', 'link', 'form', 'label', 'heading', 'structure', 'hierarchy'
  ];
  
  return words.filter(w => 
    importantTerms.some(term => w.includes(term) || term.includes(w))
  );
}

/**
 * Check if issue is likely a false positive
 * 
 * Filters out:
 * - Generic/vague issues without specific terms
 * - Duplicate issues (similar content)
 * - Issues that are too verbose (likely hallucination)
 * - Issues with low information content
 */
export function isLikelyFalsePositive(issue, allIssues = []) {
  const normalized = normalizeIssue(issue);
  
  // Filter out score-only lines (e.g., "*Overall Score: 7/10**")
  if (/^\s*\*?\s*(overall\s*)?score\s*:?\s*\d+\s*\/\s*\d+\s*\*?\s*$/i.test(issue.trim())) {
    return true;
  }
  
  // Filter out section headers with scores (e.g., "*Visual Design: 8/10**", "*Visual Design and Aesthetics: 8/10**")
  // More aggressive: match any text followed by colon and score pattern
  if (/^\s*\*{0,2}\s*[a-z\s&()]+:\s*\d+\s*\/\s*\d+\s*\*{0,2}\s*$/i.test(issue.trim())) {
    return true;
  }
  
  // Filter out markdown-formatted section headers (e.g., "**Color Contrast:**", "*Specific Issues:**")
  if (/^\s*\*{1,2}[a-z\s&()]+:\*{0,2}\s*$/i.test(issue.trim())) {
    return true;
  }
  
  // Filter out recommendation headers (e.g., "*Recommendations:**")
  if (/^\s*\*{0,2}\s*(recommendations?|suggestions?|improvements?|actions?)\s*:\*{0,2}\s*$/i.test(issue.trim())) {
    return true;
  }
  
  // Too short or too long (likely noise or hallucination)
  if (normalized.length < 10 || normalized.length > 500) {
    return true;
  }
  
  // No accessibility/design terms (likely generic)
  const terms = extractIssueTerms(issue);
  if (terms.length === 0) {
    // Allow if it's very specific (contains specific patterns)
    const specificPatterns = [
      /contrast ratio/i,
      /wcag [\d.]+/i,
      /aria-[a-z-]+/i,
      /alt\s*=\s*["']/i,
      /keyboard.*navigation/i,
      /screen reader/i,
      /focus.*visible/i
    ];
    if (!specificPatterns.some(pattern => pattern.test(issue))) {
      return true;
    }
  }
  
  // Check for duplicate/similar issues
  // Use more aggressive similarity threshold based on research: 0.7-0.8 is optimal
  // Lower threshold (0.7) catches more duplicates but may be too aggressive
  // Higher threshold (0.85) misses some duplicates
  // Research suggests 0.75-0.8 is optimal balance
  const SIMILARITY_THRESHOLD = 0.75;
  
  for (const other of allIssues) {
    if (other === issue) continue;
    const otherNormalized = normalizeIssue(other);
    
    // Very similar (likely duplicate)
    if (normalized === otherNormalized) {
      return true;
    }
    
    // High overlap (likely same issue phrased differently)
    // Research: Jaccard similarity > 0.75 indicates likely duplicate
    const similarity = calculateSimilarity(normalized, otherNormalized);
    if (similarity > SIMILARITY_THRESHOLD) {
      return true;
    }
  }
  
  // Generic phrases that don't add value (only filter if no specific terms)
  const genericPhrases = [
    'may need improvement',
    'could be better',
    'might benefit',
    'consider improving',
    'should be reviewed',
    'needs attention',
    'potential issue',
    'may have issues'
  ];
  
  // Only filter if it's ONLY generic (no specific terms) AND matches generic phrase exactly
  if (terms.length === 0 && genericPhrases.some(phrase => normalized === phrase || normalized.includes(phrase))) {
    return true;
  }
  
  return false;
}

/**
 * Calculate similarity between two texts (Jaccard similarity)
 */
function calculateSimilarity(text1, text2) {
  const words1 = new Set(text1.split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(text2.split(/\s+/).filter(w => w.length > 2));
  
  if (words1.size === 0 || words2.size === 0) return 0;
  
  const intersection = [...words1].filter(w => words2.has(w)).length;
  const union = words1.size + words2.size - intersection;
  
  return union > 0 ? intersection / union : 0;
}

/**
 * Filter and normalize issues
 * 
 * @param {string[]} issues - Raw detected issues
 * @returns {string[]} Filtered and normalized issues
 */
export function filterIssues(issues) {
  if (!Array.isArray(issues) || issues.length === 0) {
    return [];
  }
  
  // Normalize all issues first
  const normalized = issues.map(normalizeIssue).filter(i => i.length > 0);
  
  // Filter false positives
  const filtered = [];
  for (const issue of issues) {
    if (!isLikelyFalsePositive(issue, issues)) {
      filtered.push(issue); // Keep original, not normalized
    }
  }
  
  // Remove duplicates (keep first occurrence)
  const seen = new Set();
  const deduplicated = [];
  for (const issue of filtered) {
    const normalized = normalizeIssue(issue);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      deduplicated.push(issue);
    }
  }
  
  return deduplicated;
}

/**
 * Group similar issues together
 * 
 * @param {string[]} issues - Issues to group
 * @returns {Object} Grouped issues by category
 */
export function groupIssues(issues) {
  const groups = {
    contrast: [],
    accessibility: [],
    navigation: [],
    structure: [],
    design: [],
    other: []
  };
  
  for (const issue of issues) {
    const normalized = normalizeIssue(issue);
    const terms = extractIssueTerms(issue);
    
    if (normalized.includes('contrast') || normalized.includes('color')) {
      groups.contrast.push(issue);
    } else if (normalized.includes('accessibility') || normalized.includes('wcag') || 
               normalized.includes('aria') || normalized.includes('screen reader')) {
      groups.accessibility.push(issue);
    } else if (normalized.includes('navigation') || normalized.includes('keyboard') || 
               normalized.includes('focus')) {
      groups.navigation.push(issue);
    } else if (normalized.includes('structure') || normalized.includes('heading') || 
               normalized.includes('hierarchy') || normalized.includes('semantic')) {
      groups.structure.push(issue);
    } else if (normalized.includes('design') || normalized.includes('layout') || 
               normalized.includes('typography') || normalized.includes('readability')) {
      groups.design.push(issue);
    } else {
      groups.other.push(issue);
    }
  }
  
  return groups;
}

