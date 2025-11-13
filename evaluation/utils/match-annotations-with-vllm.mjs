#!/usr/bin/env node
/**
 * Match Human Annotations with VLLM Judgments
 * 
 * Matches human annotations with VLLM judgments for calibration.
 * Handles different matching strategies:
 * - By screenshot path
 * - By sample ID
 * - By URL
 * - By timestamp proximity
 */

import { readFileSync, existsSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { compareJudgments } from '../human-validation/human-validation.mjs';

/**
 * Match annotations with VLLM judgments
 */
function matchAnnotationsWithVLLM(annotations, vllmJudgments, options = {}) {
  const {
    matchBy = ['screenshot', 'sampleId', 'url'], // Priority order
    timeWindow = 60000, // 1 minute default
    fuzzyMatch = true
  } = options;
  
  const matches = [];
  const unmatchedAnnotations = [];
  const unmatchedVLLM = [...vllmJudgments];
  
  for (const annotation of annotations) {
    let matched = false;
    
    // Try each matching strategy in priority order
    for (const strategy of matchBy) {
      const match = findMatch(annotation, unmatchedVLLM, strategy, timeWindow, fuzzyMatch);
      
      if (match) {
        matches.push({
          annotation,
          vllmJudgment: match.vllmJudgment,
          matchStrategy: strategy,
          matchConfidence: match.confidence,
          comparison: compareJudgments(
            {
              humanScore: annotation.humanScore,
              humanIssues: annotation.humanIssues || [],
              humanReasoning: annotation.humanReasoning
            },
            {
              vllmScore: match.vllmJudgment.vllmScore || match.vllmJudgment.score,
              vllmIssues: match.vllmJudgment.vllmIssues || [],
              vllmReasoning: match.vllmJudgment.vllmReasoning || match.vllmJudgment.reasoning || ''
            }
          )
        });
        
        // Remove matched VLLM judgment
        const index = unmatchedVLLM.indexOf(match.vllmJudgment);
        if (index > -1) {
          unmatchedVLLM.splice(index, 1);
        }
        
        matched = true;
        break;
      }
    }
    
    if (!matched) {
      unmatchedAnnotations.push(annotation);
    }
  }
  
  return {
    matches,
    unmatchedAnnotations,
    unmatchedVLLM,
    matchRate: annotations.length > 0 ? (matches.length / annotations.length) * 100 : 0
  };
}

/**
 * Find match using specific strategy
 */
function findMatch(annotation, vllmJudgments, strategy, timeWindow, fuzzyMatch) {
  for (const vllm of vllmJudgments) {
    let match = false;
    let confidence = 1.0;
    
    switch (strategy) {
      case 'screenshot':
        if (annotation.screenshot && vllm.screenshot) {
          // Exact match
          if (annotation.screenshot === vllm.screenshot) {
            match = true;
            confidence = 1.0;
          } else if (fuzzyMatch) {
            // Fuzzy match: same filename
            const annFile = annotation.screenshot.split('/').pop();
            const vllmFile = vllm.screenshot.split('/').pop();
            if (annFile === vllmFile) {
              match = true;
              confidence = 0.9;
            }
          }
        }
        break;
        
      case 'sampleId':
        if (annotation.sampleId && vllm.sampleId) {
          if (annotation.sampleId === vllm.sampleId) {
            match = true;
            confidence = 1.0;
          }
        }
        break;
        
      case 'url':
        if (annotation.url && vllm.url) {
          // Normalize URLs
          const annUrl = normalizeUrl(annotation.url);
          const vllmUrl = normalizeUrl(vllm.url);
          if (annUrl === vllmUrl) {
            match = true;
            confidence = 1.0;
          } else if (fuzzyMatch && annUrl && vllmUrl) {
            // Fuzzy match: same domain
            try {
              const annDomain = new URL(annUrl).hostname;
              const vllmDomain = new URL(vllmUrl).hostname;
              if (annDomain === vllmDomain) {
                match = true;
                confidence = 0.7;
              }
            } catch (e) {
              // Invalid URL
            }
          }
        }
        break;
        
      case 'timestamp':
        if (annotation.timestamp && vllm.timestamp) {
          const annTime = new Date(annotation.timestamp).getTime();
          const vllmTime = new Date(vllm.timestamp).getTime();
          const diff = Math.abs(annTime - vllmTime);
          if (diff <= timeWindow) {
            match = true;
            confidence = 1.0 - (diff / timeWindow); // Closer = higher confidence
          }
        }
        break;
    }
    
    if (match) {
      return { vllmJudgment: vllm, confidence };
    }
  }
  
  return null;
}

/**
 * Normalize URL for matching
 */
function normalizeUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname}${u.pathname}`.toLowerCase();
  } catch (e) {
    return url.toLowerCase();
  }
}

/**
 * Load annotations from directory
 */
function loadAnnotations(annotationDir) {
  if (!existsSync(annotationDir)) {
    return [];
  }
  
  const files = readdirSync(annotationDir).filter(f => f.endsWith('.json'));
  return files.map(file => {
    try {
      return JSON.parse(readFileSync(join(annotationDir, file), 'utf-8'));
    } catch (error) {
      return null;
    }
  }).filter(Boolean);
}

/**
 * Load VLLM judgments from directory
 */
function loadVLLMJudgments(vllmDir) {
  if (!existsSync(vllmDir)) {
    return [];
  }
  
  const files = readdirSync(vllmDir).filter(f => 
    f.endsWith('.json') && (f.startsWith('vllm-') || f.includes('vllm'))
  );
  
  return files.map(file => {
    try {
      const judgment = JSON.parse(readFileSync(join(vllmDir, file), 'utf-8'));
      // Normalize format
      return {
        id: judgment.id,
        screenshot: judgment.screenshot,
        sampleId: judgment.sampleId,
        url: judgment.url,
        vllmScore: judgment.vllmScore || judgment.score,
        vllmIssues: judgment.vllmIssues || judgment.issues || [],
        vllmReasoning: judgment.vllmReasoning || judgment.reasoning || '',
        provider: judgment.provider,
        timestamp: judgment.timestamp
      };
    } catch (error) {
      return null;
    }
  }).filter(Boolean);
}

/**
 * Generate matched dataset
 */
function generateMatchedDataset(matches, outputPath) {
  const dataset = {
    name: 'Matched Human-VLLM Dataset',
    created: new Date().toISOString(),
    description: 'Human annotations matched with VLLM judgments for calibration',
    version: '1.0.0',
    matches: matches.map(m => ({
      annotationId: m.annotation.id,
      vllmJudgmentId: m.vllmJudgment.id,
      matchStrategy: m.matchStrategy,
      matchConfidence: m.matchConfidence,
      humanScore: m.annotation.humanScore,
      vllmScore: m.vllmJudgment.vllmScore,
      scoreDifference: m.comparison.scoreDifference,
      humanIssues: m.annotation.humanIssues,
      vllmIssues: m.vllmJudgment.vllmIssues,
      issueOverlap: m.comparison.issueOverlap,
      comparison: m.comparison
    })),
    stats: {
      totalMatches: matches.length,
      avgScoreDifference: matches.reduce((sum, m) => sum + Math.abs(m.comparison.scoreDifference), 0) / matches.length,
      avgIssueOverlap: matches.reduce((sum, m) => sum + (m.comparison.issueOverlap || 0), 0) / matches.length
    }
  };
  
  if (outputPath) {
    writeFileSync(outputPath, JSON.stringify(dataset, null, 2));
  }
  
  return dataset;
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const annotationDir = process.argv[2] || join(process.cwd(), 'evaluation', 'datasets', 'human-annotations', 'completed');
  const vllmDir = process.argv[3] || join(process.cwd(), 'evaluation', 'human-validation');
  const outputPath = process.argv[4] || join(process.cwd(), 'evaluation', 'datasets', 'matched-dataset.json');
  
  console.log('🔗 Matching Human Annotations with VLLM Judgments\n');
  
  const annotations = loadAnnotations(annotationDir);
  const vllmJudgments = loadVLLMJudgments(vllmDir);
  
  console.log(`   Annotations: ${annotations.length}`);
  console.log(`   VLLM Judgments: ${vllmJudgments.length}`);
  
  const result = matchAnnotationsWithVLLM(annotations, vllmJudgments, {
    matchBy: ['screenshot', 'sampleId', 'url', 'timestamp'],
    fuzzyMatch: true
  });
  
  console.log(`\n✅ Matching complete!`);
  console.log(`   Matches: ${result.matches.length}`);
  console.log(`   Match Rate: ${result.matchRate.toFixed(1)}%`);
  console.log(`   Unmatched Annotations: ${result.unmatchedAnnotations.length}`);
  console.log(`   Unmatched VLLM: ${result.unmatchedVLLM.length}`);
  
  if (result.matches.length > 0) {
    const dataset = generateMatchedDataset(result.matches, outputPath);
    console.log(`\n📊 Statistics:`);
    console.log(`   Average Score Difference: ${dataset.stats.avgScoreDifference.toFixed(2)}`);
    console.log(`   Average Issue Overlap: ${(dataset.stats.avgIssueOverlap * 100).toFixed(1)}%`);
    console.log(`\n   Saved: ${outputPath}`);
  }
}

export {
  matchAnnotationsWithVLLM,
  findMatch,
  loadAnnotations,
  loadVLLMJudgments,
  generateMatchedDataset
};

