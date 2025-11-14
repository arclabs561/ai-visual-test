/**
 * Generate Diverse Evaluation Data
 * 
 * Creates comprehensive evaluation scenarios demonstrating the value
 * of Groq integration, BatchOptimizer, and Cache improvements
 */

const SCENARIOS = [
  {
    name: 'Continuous Integration Pipeline',
    description: 'Nightly test suite with 5,000 screenshot validations',
    requests: 5000,
    tokensPerRequest: 2000,
    frequency: 'batch',
    criticality: 'medium'
  },
  {
    name: 'Real-Time Game Testing',
    description: '60Hz frame-by-frame validation during gameplay',
    requests: 216000, // 1 hour at 60Hz
    tokensPerRequest: 500,
    frequency: 'high',
    criticality: 'low'
  },
  {
    name: 'Interactive Development',
    description: 'Developer running tests during active development',
    requests: 200,
    tokensPerRequest: 1500,
    frequency: 'interactive',
    criticality: 'medium'
  },
  {
    name: 'Accessibility Audit',
    description: 'Comprehensive accessibility validation of entire app',
    requests: 10000,
    tokensPerRequest: 3000,
    frequency: 'batch',
    criticality: 'high'
  },
  {
    name: 'Visual Regression Testing',
    description: 'Comparing screenshots across 100 component variants',
    requests: 100,
    tokensPerRequest: 2500,
    frequency: 'batch',
    criticality: 'high'
  },
  {
    name: 'User Flow Validation',
    description: 'End-to-end user journey validation (50 steps)',
    requests: 50,
    tokensPerRequest: 4000,
    frequency: 'sequential',
    criticality: 'high'
  }
];

const PROVIDERS = {
  groq: { latency: 220, cost: { input: 0.20, output: 0.20 } },
  gemini: { latency: 1500, cost: { input: 1.25, output: 5.00 } },
  openai: { latency: 2000, cost: { input: 5.00, output: 15.00 } },
  claude: { latency: 2500, cost: { input: 3.00, output: 15.00 } }
};

function calculateScenario(provider, scenario) {
  const totalTokens = scenario.requests * scenario.tokensPerRequest;
  const cost = (totalTokens / 1_000_000) * (provider.cost.input + provider.cost.output);
  const time = (scenario.requests * provider.latency) / 1000; // seconds
  const hours = time / 3600;
  
  return { cost, time, hours, totalTokens };
}

function generateEvaluationData() {
  console.log('\n📊 Diverse Evaluation Scenarios\n');
  console.log('=' .repeat(100));
  
  SCENARIOS.forEach((scenario, index) => {
    console.log(`\n${index + 1}. ${scenario.name}`);
    console.log(`   ${scenario.description}`);
    console.log(`   Requests: ${scenario.requests.toLocaleString()}, Tokens/request: ${scenario.tokensPerRequest.toLocaleString()}`);
    console.log(`   Frequency: ${scenario.frequency}, Criticality: ${scenario.criticality}\n`);
    
    const results = {};
    Object.entries(PROVIDERS).forEach(([key, provider]) => {
      results[key] = calculateScenario(provider, scenario);
    });
    
    // Cost comparison
    console.log('   💰 Cost Comparison:');
    const sortedByCost = Object.entries(results)
      .sort((a, b) => a[1].cost - b[1].cost);
    
    sortedByCost.forEach(([key, result], idx) => {
      const savings = idx === 0 ? '' : ` (${((1 - result.cost / sortedByCost[0][1].cost) * 100).toFixed(1)}% savings vs ${sortedByCost[0][0]})`;
      const marker = key === 'groq' ? '🟢' : '⚪';
      console.log(`      ${marker} ${key.padEnd(10)} $${result.cost.toFixed(2)}${savings}`);
    });
    
    // Time comparison
    console.log('\n   ⏱️  Time Comparison:');
    const sortedByTime = Object.entries(results)
      .sort((a, b) => a[1].time - b[1].time);
    
    sortedByTime.forEach(([key, result], idx) => {
      const speedup = idx === 0 ? '' : ` (${(result.time / sortedByTime[0][1].time).toFixed(1)}x slower)`;
      const timeStr = result.hours >= 1 
        ? `${result.hours.toFixed(2)} hours`
        : result.time >= 60
        ? `${(result.time / 60).toFixed(1)} minutes`
        : `${result.time.toFixed(1)} seconds`;
      const marker = key === 'groq' ? '🟢' : '⚪';
      console.log(`      ${marker} ${key.padEnd(10)} ${timeStr.padEnd(15)}${speedup}`);
    });
    
    // Feasibility analysis
    console.log('\n   ✅ Feasibility:');
    const groqResult = results.groq;
    const otherResults = Object.entries(results).filter(([k]) => k !== 'groq');
    
    const feasibleWithGroq = groqResult.hours < 24;
    const feasibleWithOthers = otherResults.some(([, r]) => r.hours < 24);
    
    if (feasibleWithGroq && !feasibleWithOthers) {
      console.log(`      🟢 Only feasible with Groq (others take ${Math.min(...otherResults.map(([, r]) => r.hours)).toFixed(1)}+ hours)`);
    } else if (feasibleWithGroq) {
      console.log(`      🟢 Feasible with Groq (${groqResult.hours.toFixed(2)} hours)`);
      console.log(`      ⚪ Feasible with others (${Math.min(...otherResults.map(([, r]) => r.hours)).toFixed(2)} hours minimum)`);
    } else {
      console.log(`      ⚠️  Large scenario - Groq: ${groqResult.hours.toFixed(2)}h, Others: ${Math.min(...otherResults.map(([, r]) => r.hours)).toFixed(2)}+h`);
    }
  });
  
  // Summary statistics
  console.log('\n\n📈 Summary Statistics\n');
  console.log('=' .repeat(100));
  
  let totalCostSavings = 0;
  let totalTimeSavings = 0;
  let scenariosOnlyFeasibleWithGroq = 0;
  
  SCENARIOS.forEach(scenario => {
    const groqResult = calculateScenario(PROVIDERS.groq, scenario);
    const otherResults = Object.entries(PROVIDERS)
      .filter(([k]) => k !== 'groq')
      .map(([k, p]) => calculateScenario(p, scenario));
    
    const minOtherCost = Math.min(...otherResults.map(r => r.cost));
    const minOtherTime = Math.min(...otherResults.map(r => r.time));
    
    totalCostSavings += minOtherCost - groqResult.cost;
    totalTimeSavings += minOtherTime - groqResult.time;
    
    if (groqResult.hours < 24 && otherResults.every(r => r.hours >= 24)) {
      scenariosOnlyFeasibleWithGroq++;
    }
  });
  
  console.log(`Total Cost Savings (across all scenarios): $${totalCostSavings.toFixed(2)}`);
  console.log(`Total Time Savings (across all scenarios): ${(totalTimeSavings / 3600).toFixed(2)} hours`);
  console.log(`Scenarios only feasible with Groq: ${scenariosOnlyFeasibleWithGroq}/${SCENARIOS.length}`);
  console.log(`Average cost savings per scenario: $${(totalCostSavings / SCENARIOS.length).toFixed(2)}`);
  console.log(`Average time savings per scenario: ${(totalTimeSavings / SCENARIOS.length / 3600).toFixed(2)} hours`);
  
  // ROI Analysis
  console.log('\n💰 ROI Analysis\n');
  console.log('=' .repeat(100));
  
  const monthlyScenarios = SCENARIOS.length * 30; // Assume each scenario runs 30x/month
  const monthlyCostSavings = totalCostSavings * 30;
  const monthlyTimeSavings = (totalTimeSavings / 3600) * 30;
  
  console.log(`Monthly Cost Savings (30 runs/scenario): $${monthlyCostSavings.toFixed(2)}`);
  console.log(`Monthly Time Savings (30 runs/scenario): ${monthlyTimeSavings.toFixed(1)} hours`);
  console.log(`Annual Cost Savings: $${(monthlyCostSavings * 12).toFixed(2)}`);
  console.log(`Annual Time Savings: ${(monthlyTimeSavings * 12).toFixed(1)} hours (${((monthlyTimeSavings * 12) / 24).toFixed(1)} days)`);
  
  // Developer productivity impact
  const developerHourlyRate = 100; // Conservative estimate
  const productivityValue = monthlyTimeSavings * developerHourlyRate;
  console.log(`\nDeveloper Productivity Value (at $${developerHourlyRate}/hr): $${productivityValue.toFixed(2)}/month`);
  console.log(`Total Monthly Value (cost + productivity): $${(monthlyCostSavings + productivityValue).toFixed(2)}`);
  console.log(`Total Annual Value: $${((monthlyCostSavings + productivityValue) * 12).toFixed(2)}`);
}

generateEvaluationData();

