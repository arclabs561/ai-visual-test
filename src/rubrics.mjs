/**
 * Evaluation Rubrics
 * 
 * Provides explicit scoring rubrics for LLM-as-a-judge evaluation.
 * Research shows that explicit rubrics improve reliability by 10-20%
 * and reduce bias from superficial features.
 */

/**
 * Default scoring rubric for screenshot validation
 */
export const DEFAULT_RUBRIC = {
  score: {
    description: 'Overall quality score from 0-10',
    criteria: {
      10: 'Perfect - No issues, excellent UX, all requirements met',
      9: 'Excellent - Minor cosmetic issues, excellent UX',
      8: 'Very Good - Minor issues that don\'t affect usability',
      7: 'Good - Some issues but generally usable',
      6: 'Acceptable - Issues present but functional',
      5: 'Needs Improvement - Significant issues affecting usability',
      4: 'Poor - Major issues, difficult to use',
      3: 'Very Poor - Critical issues, barely functional',
      2: 'Bad - Severe issues, mostly broken',
      1: 'Very Bad - Almost completely broken',
      0: 'Broken - Completely non-functional'
    }
  },
  dimensions: {
    visual: {
      description: 'Visual design and aesthetics',
      criteria: [
        'Layout is clear and organized',
        'Colors are appropriate and accessible',
        'Typography is readable',
        'Spacing is consistent',
        'Visual hierarchy is clear'
      ]
    },
    functional: {
      description: 'Functional correctness',
      criteria: [
        'All interactive elements work correctly',
        'Forms submit properly',
        'Links navigate correctly',
        'Buttons trigger expected actions',
        'No broken functionality'
      ]
    },
    usability: {
      description: 'Ease of use',
      criteria: [
        'Purpose is clear',
        'Actions are obvious',
        'Feedback is provided',
        'Error messages are helpful',
        'Flow is intuitive'
      ]
    },
    accessibility: {
      description: 'Accessibility compliance',
      criteria: [
        'Keyboard navigation works',
        'Screen reader compatible',
        'Color contrast is sufficient',
        'Text is readable',
        'Interactive elements are accessible'
      ]
    }
  }
};

/**
 * Build rubric prompt section
 */
export function buildRubricPrompt(rubric = null, includeDimensions = true) {
  const rubricToUse = rubric || DEFAULT_RUBRIC;
  let prompt = `## EVALUATION RUBRIC

### Scoring Scale (0-10):
${Object.entries(rubricToUse.score.criteria)
  .sort((a, b) => parseInt(b[0]) - parseInt(a[0]))
  .map(([score, desc]) => `- ${score}: ${desc}`)
  .join('\n')}

### Evaluation Instructions:
1. Evaluate the screenshot against the criteria below
2. Consider both appearance and functional correctness
3. Base your score on substantive content, not superficial features
4. Ignore factors like response length, verbosity, or formatting style
5. Focus on actual quality: correctness, clarity, usability, and accessibility
6. Provide a score from 0-10 based on the rubric above
7. List specific issues found (if any)
8. Provide reasoning for your score`;

  if (includeDimensions && rubricToUse.dimensions) {
    prompt += `\n\n### Evaluation Dimensions:
${Object.entries(rubricToUse.dimensions)
  .map(([key, dim]) => `\n**${key.toUpperCase()}** (${dim.description}):\n${dim.criteria.map(c => `- ${c}`).join('\n')}`)
  .join('\n')}`;
  }

  prompt += `\n\n### Output Format:
Provide your evaluation as JSON:
{
  "score": <0-10 integer>,
  "assessment": "<pass|fail|needs-improvement>",
  "issues": ["<issue1>", "<issue2>", ...],
  "reasoning": "<explanation of score>",
  "strengths": ["<strength1>", "<strength2>", ...],
  "recommendations": ["<recommendation1>", ...]
}`;

  return prompt;
}

/**
 * Get rubric for specific test type
 */
export function getRubricForTestType(testType) {
  const testTypeRubrics = {
    'payment-screen': {
      ...DEFAULT_RUBRIC,
      dimensions: {
        ...DEFAULT_RUBRIC.dimensions,
        payment: {
          description: 'Payment functionality',
          criteria: [
            'Payment code is clearly visible',
            'Payment links are obvious',
            'Payment flow is trustworthy',
            'Connection to game access is clear',
            'Payment instructions are clear'
          ]
        }
      }
    },
    'gameplay': {
      ...DEFAULT_RUBRIC,
      dimensions: {
        ...DEFAULT_RUBRIC.dimensions,
        gameplay: {
          description: 'Gameplay experience',
          criteria: [
            'Game is visually engaging',
            'Controls are intuitive',
            'Feedback is clear',
            'Game is balanced',
            'Experience is fun'
          ]
        }
      }
    },
    'form': {
      ...DEFAULT_RUBRIC,
      dimensions: {
        ...DEFAULT_RUBRIC.dimensions,
        form: {
          description: 'Form usability',
          criteria: [
            'Labels are clear',
            'Placeholders are helpful',
            'Validation is clear',
            'Submit button is obvious',
            'Error messages are helpful'
          ]
        }
      }
    }
  };

  return testTypeRubrics[testType] || DEFAULT_RUBRIC;
}

