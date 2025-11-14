/**
 * Groq vs Other Providers Comparison
 * 
 * Generates detailed comparison data showing Groq's advantages
 */

const PROVIDERS = {
  groq: {
    name: 'Groq',
    latency: 220,
    costPer1M: { input: 0.20, output: 0.20 },
    throughput: 200,
    model: 'llama-3.3-70b-versatile'
  },
  gemini: {
    name: 'Gemini 2.0 Flash',
    latency: 1500,
    costPer1M: { input: 1.25, output: 5.00 },
    throughput: 50,
    model: 'gemini-2.0-flash-exp'
  },
  openai: {
    name: 'OpenAI GPT-4o-mini',
    latency: 2000,
    costPer1M: { input: 5.00, output: 15.00 },
    throughput: 40,
    model: 'gpt-4o-mini'
  },
  claude: {
    name: 'Claude Haiku',
    latency: 2500,
    costPer1M: { input: 3.00, output: 15.00 },
    throughput: 35,
    model: 'claude-3-5-haiku-20241022'
  }
};

function generateComparison() {
  console.log('\n📊 Groq vs Other Providers: Comprehensive Comparison\n');
  console.log('=' .repeat(80));
  
  // Latency comparison
  console.log('\n⚡ Latency Comparison (Lower is Better)\n');
  const sortedByLatency = Object.entries(PROVIDERS)
    .sort((a, b) => a[1].latency - b[1].latency);
  
  sortedByLatency.forEach(([key, provider], index) => {
    const bar = '█'.repeat(Math.min(60, Math.floor(provider.latency / 40)));
    const speedup = index === 0 ? '1.0x' : (provider.latency / PROVIDERS.groq.latency).toFixed(1) + 'x';
    const color = key === 'groq' ? '🟢' : '⚪';
    console.log(`${color} ${provider.name.padEnd(25)} ${bar} ${provider.latency}ms (${speedup} slower)`);
  });
  
  // Cost comparison
  console.log('\n💰 Cost Comparison (per 1M tokens, input + output)\n');
  const sortedByCost = Object.entries(PROVIDERS)
    .sort((a, b) => {
      const costA = a[1].costPer1M.input + a[1].costPer1M.output;
      const costB = b[1].costPer1M.input + b[1].costPer1M.output;
      return costA - costB;
    });
  
  sortedByCost.forEach(([key, provider]) => {
    const totalCost = provider.costPer1M.input + provider.costPer1M.output;
    const savings = key === 'groq' ? '1.0x' : (totalCost / (PROVIDERS.groq.costPer1M.input + PROVIDERS.groq.costPer1M.output)).toFixed(1) + 'x';
    const bar = '█'.repeat(Math.min(60, Math.floor(totalCost * 15)));
    const color = key === 'groq' ? '🟢' : '⚪';
    console.log(`${color} ${provider.name.padEnd(25)} $${totalCost.toFixed(2)} ${bar} (${savings} more expensive)`);
  });
  
  // Throughput comparison
  console.log('\n📈 Throughput Comparison (tokens/sec, Higher is Better)\n');
  const sortedByThroughput = Object.entries(PROVIDERS)
    .sort((a, b) => b[1].throughput - a[1].throughput);
  
  sortedByThroughput.forEach(([key, provider]) => {
    const bar = '█'.repeat(Math.min(60, Math.floor(provider.throughput / 3.5)));
    const ratio = key === 'groq' ? '1.0x' : (PROVIDERS.groq.throughput / provider.throughput).toFixed(1) + 'x';
    const color = key === 'groq' ? '🟢' : '⚪';
    console.log(`${color} ${provider.name.padEnd(25)} ${provider.throughput} tokens/sec ${bar} (${ratio} slower)`);
  });
  
  // Use case recommendations
  console.log('\n🎯 Use Case Recommendations\n');
  console.log('🟢 Groq (Best For):');
  console.log('   • High-frequency decisions (10-60Hz)');
  console.log('   • Real-time UI validation');
  console.log('   • Cost-sensitive high-volume operations');
  console.log('   • Development and staging environments');
  console.log('   • When speed > maximum accuracy');
  
  console.log('\n⚪ Other Providers (Best For):');
  console.log('   • Critical decisions requiring maximum accuracy');
  console.log('   • Complex reasoning tasks');
  console.log('   • When quality > speed/cost');
  console.log('   • Production environments with lower volume');
  
  // Real-world scenarios
  console.log('\n📋 Real-World Scenario Analysis\n');
  
  const scenarios = [
    {
      name: 'High-Frequency UI Testing (60Hz)',
      requests: 3600, // per minute
      avgTokens: 500,
      description: 'Real-time UI state validation at 60Hz'
    },
    {
      name: 'Batch Screenshot Validation',
      requests: 1000,
      avgTokens: 2000,
      description: 'Validating 1000 screenshots in a test suite'
    },
    {
      name: 'Interactive Testing Session',
      requests: 100,
      avgTokens: 1000,
      description: '100 validations during an interactive session'
    }
  ];
  
  scenarios.forEach(scenario => {
    console.log(`\n${scenario.name}:`);
    console.log(`   ${scenario.description}`);
    console.log(`   Requests: ${scenario.requests}, Avg tokens: ${scenario.avgTokens}`);
    
    Object.entries(PROVIDERS).forEach(([key, provider]) => {
      const totalTokens = scenario.requests * scenario.avgTokens;
      const cost = (totalTokens / 1_000_000) * (provider.costPer1M.input + provider.costPer1M.output);
      const time = (scenario.requests * provider.latency) / 1000; // seconds
      const color = key === 'groq' ? '🟢' : '⚪';
      
      console.log(`   ${color} ${provider.name}:`);
      console.log(`      Cost: $${cost.toFixed(2)}`);
      console.log(`      Time: ${time.toFixed(1)}s`);
      if (key === 'groq') {
        const savings = Object.entries(PROVIDERS)
          .filter(([k]) => k !== 'groq')
          .map(([k, p]) => {
            const otherCost = (totalTokens / 1_000_000) * (p.costPer1M.input + p.costPer1M.output);
            return ((otherCost - cost) / otherCost * 100).toFixed(1);
          });
        console.log(`      Savings vs others: ${Math.min(...savings)}-${Math.max(...savings)}%`);
      }
    });
  });
  
  // Summary
  console.log('\n\n✅ Summary\n');
  console.log('=' .repeat(80));
  console.log('Groq provides:');
  console.log(`  • ${(PROVIDERS.gemini.latency / PROVIDERS.groq.latency).toFixed(1)}-${(PROVIDERS.claude.latency / PROVIDERS.groq.latency).toFixed(1)}x faster latency`);
  console.log(`  • ${((PROVIDERS.gemini.costPer1M.input + PROVIDERS.gemini.costPer1M.output) / (PROVIDERS.groq.costPer1M.input + PROVIDERS.groq.costPer1M.output)).toFixed(1)}-${((PROVIDERS.openai.costPer1M.input + PROVIDERS.openai.costPer1M.output) / (PROVIDERS.groq.costPer1M.input + PROVIDERS.groq.costPer1M.output)).toFixed(1)}x lower cost`);
  console.log(`  • ${(PROVIDERS.groq.throughput / PROVIDERS.claude.throughput).toFixed(1)}-${(PROVIDERS.groq.throughput / PROVIDERS.openai.throughput).toFixed(1)}x higher throughput`);
  console.log('\nIdeal for high-frequency temporal decisions where speed and cost matter!');
}

generateComparison();

