#!/usr/bin/env node
/**
 * Challenging Websites for Hard Testing
 * 
 * Progressively harder websites that test:
 * - Complex layouts
 * - Subtle accessibility issues
 * - Dynamic content
 * - Challenging UI patterns
 * - Edge cases
 */

// Import interactive experience websites
import { INTERACTIVE_EXPERIENCE_WEBSITES } from './interactive-experiences.mjs';

export const CHALLENGING_WEBSITES = [
  // Level 1: Medium Difficulty - Complex layouts
  {
    id: 'complex-dashboard',
    name: 'Complex Dashboard',
    url: 'https://www.bloomberg.com',
    difficulty: 'medium',
    challenges: [
      'Complex data tables',
      'Dynamic content loading',
      'Multiple navigation levels',
      'Dense information architecture'
    ],
    expectedScore: { min: 6, max: 9 },
    focusAreas: ['data-tables', 'navigation', 'information-density']
  },
  {
    id: 'ecommerce-complex',
    name: 'Complex E-commerce',
    url: 'https://www.etsy.com',
    difficulty: 'medium',
    challenges: [
      'Multi-level navigation',
      'Dynamic product listings',
      'Complex filters',
      'Shopping cart interactions'
    ],
    expectedScore: { min: 6, max: 8 },
    focusAreas: ['navigation', 'interactive-elements', 'forms']
  },
  
  // Level 2: Hard - Subtle issues
  {
    id: 'news-complex',
    name: 'Complex News Site',
    url: 'https://www.bbc.com',
    difficulty: 'hard',
    challenges: [
      'Image carousels',
      'Dynamic content updates',
      'Complex article layouts',
      'Video embeds'
    ],
    expectedScore: { min: 7, max: 9 },
    focusAreas: ['carousels', 'dynamic-content', 'media-accessibility']
  },
  {
    id: 'portfolio-complex',
    name: 'Complex Portfolio',
    url: 'https://www.behance.net',
    difficulty: 'hard',
    challenges: [
      'Image-heavy layouts',
      'Complex image galleries',
      'Custom interactions',
      'Ambiguous link text'
    ],
    expectedScore: { min: 5, max: 8 },
    focusAreas: ['image-accessibility', 'link-clarity', 'visual-complexity']
  },
  
  // Level 3: Very Hard - Subtle accessibility issues
  {
    id: 'government-complex',
    name: 'Government Portal',
    url: 'https://www.usa.gov',
    difficulty: 'hard', // Reclassified: Government portals are often well-structured
    challenges: [
      'Complex forms',
      'Multi-step processes',
      'Legal/technical language',
      'Dense information'
    ],
    expectedScore: { min: 6, max: 9 },
    focusAreas: ['form-accessibility', 'content-clarity', 'process-navigation']
  },
  {
    id: 'academic-complex',
    name: 'Academic Portal',
    url: 'https://www.arxiv.org',
    difficulty: 'hard', // Reclassified: Text-heavy but not "very hard" for evaluation
    challenges: [
      'Complex data tables',
      'Mathematical notation',
      'Dense text content',
      'Technical terminology'
    ],
    expectedScore: { min: 5, max: 8 },
    focusAreas: ['tables', 'mathematical-content', 'readability']
  },
  {
    id: 'complex-forms',
    name: 'Complex Form Site',
    url: 'https://www.turbotax.com',
    difficulty: 'very-hard',
    challenges: [
      'Multi-step tax forms',
      'Conditional logic',
      'Complex validation',
      'Progress tracking',
      'Error handling'
    ],
    expectedScore: { min: 4, max: 7 },
    focusAreas: ['form-accessibility', 'conditional-logic', 'error-handling', 'progress-indicators']
  },
  
  // Level 4: Extreme - Known challenging patterns
  {
    id: 'social-media-complex',
    name: 'Social Media Platform',
    url: 'https://www.reddit.com',
    difficulty: 'extreme',
    challenges: [
      'Infinite scroll',
      'Dynamic comment threads',
      'User-generated content',
      'Real-time updates',
      'Complex interaction patterns'
    ],
    expectedScore: { min: 4, max: 7 },
    focusAreas: ['infinite-scroll', 'dynamic-content', 'keyboard-navigation', 'focus-management']
  },
  {
    id: 'video-platform',
    name: 'Video Platform',
    url: 'https://www.youtube.com',
    difficulty: 'extreme',
    challenges: [
      'Video player accessibility',
      'Complex controls',
      'Captions/subtitles',
      'Dynamic recommendations',
      'Overlay interactions'
    ],
    expectedScore: { min: 5, max: 8 },
    focusAreas: ['media-controls', 'captions', 'overlays', 'keyboard-shortcuts']
  },
  
  // Level 5: Expert - Subtle expert-level issues
  {
    id: 'financial-complex',
    name: 'Financial Dashboard',
    url: 'https://www.tradingview.com',
    difficulty: 'expert',
    challenges: [
      'Complex data visualizations',
      'Real-time updates',
      'Interactive charts',
      'Technical indicators',
      'Multiple timeframes'
    ],
    expectedScore: { min: 4, max: 7 },
    focusAreas: ['data-visualization', 'real-time-updates', 'interactive-charts', 'keyboard-navigation']
  },
  {
    id: 'design-tool-complex',
    name: 'Design Tool',
    url: 'https://www.figma.com',
    difficulty: 'expert',
    challenges: [
      'Complex canvas interactions',
      'Tool panels',
      'Keyboard shortcuts',
      'Custom controls',
      'Collaborative features'
    ],
    expectedScore: { min: 5, max: 8 },
    focusAreas: ['canvas-interactions', 'keyboard-shortcuts', 'custom-controls', 'focus-management']
  },
  
  // Level 6: Nightmare - Extremely challenging (reduced to 3 most challenging)
  {
    id: 'spa-complex',
    name: 'Complex SPA',
    url: 'https://www.notion.so',
    difficulty: 'expert', // Reclassified: Complex but not nightmare-level
    challenges: [
      'Single-page application',
      'Dynamic content injection',
      'Complex nested components',
      'Real-time collaboration',
      'Custom rich text editor',
      'Modal dialogs and overlays'
    ],
    expectedScore: { min: 4, max: 7 },
    focusAreas: ['spa-navigation', 'dynamic-content', 'aria-live-regions', 'focus-trapping', 'keyboard-shortcuts']
  },
  {
    id: 'ecommerce-checkout',
    name: 'E-commerce Checkout',
    url: 'https://www.amazon.com',
    difficulty: 'expert', // Reclassified: Well-tested patterns, not nightmare
    challenges: [
      'Multi-step process',
      'Dynamic form validation',
      'Real-time error feedback',
      'Conditional fields',
      'Payment integration',
      'Progress indicators'
    ],
    expectedScore: { min: 4, max: 7 },
    focusAreas: ['form-accessibility', 'error-handling', 'aria-live-regions', 'focus-management', 'progress-indicators']
  },
  {
    id: 'collaborative-tool',
    name: 'Collaborative Tool',
    url: 'https://www.miro.com',
    difficulty: 'nightmare',
    challenges: [
      'Infinite canvas',
      'Real-time collaboration',
      'Complex drag-and-drop',
      'Custom controls',
      'Zoom and pan',
      'Multi-user cursors'
    ],
    expectedScore: { min: 2, max: 6 },
    focusAreas: ['canvas-accessibility', 'keyboard-navigation', 'drag-and-drop', 'zoom-controls', 'screen-reader-support']
  },
  {
    id: 'data-visualization',
    name: 'Data Visualization Platform',
    url: 'https://www.tableau.com',
    difficulty: 'nightmare',
    challenges: [
      'Complex visualizations',
      'Interactive dashboards',
      'Custom chart controls',
      'Data filtering',
      'Export functionality',
      'Screen reader alternatives'
    ],
    expectedScore: { min: 3, max: 6 },
    focusAreas: ['visualization-accessibility', 'data-tables', 'chart-alternatives', 'keyboard-navigation', 'aria-descriptions']
  },
  {
    id: 'code-editor',
    name: 'Online Code Editor',
    url: 'https://codesandbox.io',
    difficulty: 'nightmare',
    challenges: [
      'Code syntax highlighting',
      'Auto-completion',
      'Multi-file editing',
      'Terminal integration',
      'Custom keyboard shortcuts',
      'Screen reader code navigation'
    ],
    expectedScore: { min: 2, max: 6 },
    focusAreas: ['code-accessibility', 'keyboard-shortcuts', 'screen-reader-support', 'aria-labels', 'focus-management']
  }
];

/**
 * Get all websites (challenging + interactive)
 */
export function getAllWebsites() {
  return [...CHALLENGING_WEBSITES, ...INTERACTIVE_EXPERIENCE_WEBSITES];
}

/**
 * Get websites by difficulty level
 */
export function getWebsitesByDifficulty(level) {
  return getAllWebsites().filter(w => w.difficulty === level);
}

/**
 * Get all websites sorted by difficulty (includes both challenging and interactive)
 */
export function getAllWebsitesSorted() {
  const difficultyOrder = ['medium', 'hard', 'very-hard', 'extreme', 'expert', 'nightmare'];
  return getAllWebsites().sort((a, b) => {
    return difficultyOrder.indexOf(a.difficulty) - difficultyOrder.indexOf(b.difficulty);
  });
}

/**
 * Build challenge-specific prompt
 */
export function buildChallengePrompt(website) {
  let prompt = `Evaluate this website focusing on challenging aspects:\n\n`;
  
  prompt += `**DIFFICULTY LEVEL:** ${website.difficulty.toUpperCase()}\n\n`;
  
  prompt += `**CHALLENGES TO EVALUATE:**\n`;
  website.challenges.forEach(challenge => {
    prompt += `- ${challenge}\n`;
  });
  
  prompt += `\n**FOCUS AREAS:**\n`;
  website.focusAreas.forEach(area => {
    prompt += `- ${area}\n`;
  });
  
  prompt += `\n**EVALUATION INSTRUCTIONS:**\n`;
  prompt += `- Pay special attention to subtle issues that automated tools might miss\n`;
  prompt += `- Evaluate keyboard navigation for complex interactions\n`;
  prompt += `- Check for proper ARIA labels and semantic HTML\n`;
  prompt += `- Assess focus management in dynamic content\n`;
  prompt += `- Look for accessibility issues in complex layouts\n`;
  prompt += `- Consider edge cases and unusual interaction patterns\n`;
  
  prompt += `\nProvide a detailed score (0-10) with specific issues found in these challenging areas.`;
  
  return prompt;
}

/**
 * Expected test results for validation
 */
export function getExpectedResults(website) {
  return {
    scoreRange: website.expectedScore,
    shouldDetectIssues: website.difficulty !== 'medium', // Medium difficulty sites might be clean
    focusAreas: website.focusAreas,
    minIssuesExpected: website.difficulty === 'expert' ? 2 : website.difficulty === 'extreme' ? 1 : 0
  };
}

