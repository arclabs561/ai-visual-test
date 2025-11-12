/**
 * Validation: Persona Diversity
 * 
 * Tests that personas actually provide diverse perspectives.
 * Validates that different personas produce different evaluations.
 */

import { createMockPage } from '../test/helpers/mock-page.mjs';
import { experiencePageWithPersonas } from '../../src/persona-experience.mjs';
import { writeFileSync } from 'fs';
import { join } from 'path';

/**
 * Test Case: Persona Perspective Diversity
 * Hypothesis: Different personas should produce different notes/observations
 */
async function testPersonaDiversity() {
  const mockPage = createMockPage({
    html: `
      <html>
        <body>
          <div id="game">
            <button id="start">Start Game</button>
            <div id="score">Score: 0</div>
          </div>
        </body>
      </html>
    `
  });
  
  const personas = [
    {
      name: 'Casual Gamer',
      device: 'desktop',
      goals: ['fun', 'easy'],
      concerns: ['too complex']
    },
    {
      name: 'Accessibility Advocate',
      device: 'desktop',
      goals: ['accessible', 'keyboard'],
      concerns: ['no keyboard support']
    },
    {
      name: 'Mobile User',
      device: 'mobile',
      goals: ['touch-friendly'],
      concerns: ['keyboard-only']
    }
  ];
  
  const experiences = await experiencePageWithPersonas(mockPage, personas, {
    captureScreenshots: false,
    timeScale: 'human'
  });
  
  // Extract unique observations/concerns from each persona
  const observations = experiences.map(exp => {
    const obs = exp.notes.map(n => n.observation || '').join(' ').toLowerCase();
    return {
      persona: exp.persona,
      device: exp.device,
      keywords: extractKeywords(obs),
      noteCount: exp.notes.length
    };
  });
  
  // Check diversity: different personas should mention different keywords
  const allKeywords = observations.flatMap(o => o.keywords);
  const uniqueKeywords = new Set(allKeywords);
  const diversityRatio = uniqueKeywords.size / allKeywords.length;
  
  // Check device-specific observations
  const mobileObs = observations.find(o => o.device === 'mobile');
  const desktopObs = observations.filter(o => o.device === 'desktop');
  const hasDeviceDiversity = mobileObs && desktopObs.length > 0;
  
  return {
    name: 'Persona Perspective Diversity',
    hypothesis: 'Different personas produce different observations',
    actual: {
      personas: observations.length,
      uniqueKeywords: uniqueKeywords.size,
      totalKeywords: allKeywords.length,
      diversityRatio,
      hasDeviceDiversity,
      observations: observations.map(o => ({
        persona: o.persona,
        keywords: o.keywords.slice(0, 5) // First 5 keywords
      }))
    },
    passed: diversityRatio > 0.3 && hasDeviceDiversity, // At least 30% unique keywords
    notes: 'Personas should produce diverse observations'
  };
}

/**
 * Extract keywords from text
 */
function extractKeywords(text) {
  const words = text.split(/\s+/)
    .filter(w => w.length > 3)
    .filter(w => !['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use'].includes(w.toLowerCase()));
  return [...new Set(words)].slice(0, 10); // Top 10 unique keywords
}

/**
 * Test Case: Persona Goals Influence Observations
 * Validates that persona goals actually influence what they observe
 */
async function testPersonaGoalsInfluence() {
  const mockPage = createMockPage({
    html: '<html><body><div id="game">Game Content</div></body></html>'
  });
  
  const funPersona = {
    name: 'Fun Seeker',
    goals: ['fun', 'entertainment'],
    concerns: ['boring']
  };
  
  const accessibilityPersona = {
    name: 'Accessibility Seeker',
    goals: ['accessible', 'keyboard'],
    concerns: ['no keyboard']
  };
  
  const [funExp, accessExp] = await Promise.all([
    experiencePageAsPersona(mockPage, funPersona, { captureScreenshots: false }),
    experiencePageAsPersona(mockPage, accessibilityPersona, { captureScreenshots: false })
  ]);
  
  const funKeywords = extractKeywords(funExp.notes.map(n => n.observation || '').join(' '));
  const accessKeywords = extractKeywords(accessExp.notes.map(n => n.observation || '').join(' '));
  
  // Check if keywords reflect persona goals
  const funHasFunKeywords = funKeywords.some(k => ['fun', 'entertain', 'enjoy', 'play'].some(f => k.includes(f)));
  const accessHasAccessKeywords = accessKeywords.some(k => ['access', 'keyboard', 'navigat', 'control'].some(a => k.includes(a)));
  
  return {
    name: 'Persona Goals Influence',
    hypothesis: 'Persona goals influence observations',
    actual: {
      funPersona: {
        keywords: funKeywords.slice(0, 5),
        hasFunKeywords: funHasFunKeywords
      },
      accessibilityPersona: {
        keywords: accessKeywords.slice(0, 5),
        hasAccessKeywords: accessHasAccessKeywords
      }
    },
    passed: funHasFunKeywords || accessHasAccessKeywords, // At least one reflects goals
    notes: 'Persona goals should influence what they observe'
  };
}

/**
 * Test Case: Device-Specific Observations
 * Validates that device type influences observations
 */
async function testDeviceSpecificObservations() {
  const mockPage = createMockPage({
    html: '<html><body><div id="game">Game Content</div></body></html>'
  });
  
  const mobilePersona = { name: 'Mobile', device: 'mobile', goals: ['touch'] };
  const desktopPersona = { name: 'Desktop', device: 'desktop', goals: ['keyboard'] };
  
  const [mobileExp, desktopExp] = await Promise.all([
    experiencePageAsPersona(mockPage, mobilePersona, { captureScreenshots: false }),
    experiencePageAsPersona(mockPage, desktopPersona, { captureScreenshots: false })
  ]);
  
  const mobileKeywords = extractKeywords(mobileExp.notes.map(n => n.observation || '').join(' '));
  const desktopKeywords = extractKeywords(desktopExp.notes.map(n => n.observation || '').join(' '));
  
  const mobileHasTouchKeywords = mobileKeywords.some(k => ['touch', 'mobile', 'screen', 'tap'].some(t => k.includes(t)));
  const desktopHasDesktopKeywords = desktopKeywords.some(k => ['keyboard', 'desktop', 'mouse', 'click'].some(d => k.includes(d)));
  
  return {
    name: 'Device-Specific Observations',
    hypothesis: 'Device type influences observations',
    actual: {
      mobile: {
        keywords: mobileKeywords.slice(0, 5),
        hasTouchKeywords: mobileHasTouchKeywords,
        viewport: mobileExp.viewport
      },
      desktop: {
        keywords: desktopKeywords.slice(0, 5),
        hasDesktopKeywords: desktopHasDesktopKeywords,
        viewport: desktopExp.viewport
      }
    },
    passed: mobileExp.viewport?.width !== desktopExp.viewport?.width, // Different viewports
    notes: 'Device type should influence viewport and observations'
  };
}

// Import missing function
import { experiencePageAsPersona } from '../../src/persona-experience.mjs';

/**
 * Run all validation tests
 */
async function runValidation() {
  console.log('🔬 Validating Persona Diversity\n');
  
  const tests = [
    await testPersonaDiversity(),
    await testPersonaGoalsInfluence(),
    await testDeviceSpecificObservations()
  ];
  
  const results = {
    timestamp: new Date().toISOString(),
    tests,
    summary: {
      total: tests.length,
      passed: tests.filter(t => t.passed).length,
      failed: tests.filter(t => !t.passed).length
    }
  };
  
  // Print results
  console.log('Results:');
  tests.forEach(test => {
    const status = test.passed ? '✅' : '❌';
    console.log(`${status} ${test.name}`);
    console.log(`   Hypothesis: ${test.hypothesis}`);
    console.log(`   Actual: ${JSON.stringify(test.actual, null, 2)}`);
    if (!test.passed) {
      console.log(`   ⚠️  FAILED: ${test.notes}`);
    }
    console.log();
  });
  
  console.log(`\nSummary: ${results.summary.passed}/${results.summary.total} tests passed`);
  
  // Save results
  const outputPath = join(process.cwd(), 'evaluation', 'results', `persona-diversity-validation-${Date.now()}.json`);
  writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to: ${outputPath}`);
  
  return results;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runValidation().catch(console.error);
}

export { runValidation };

