# Use Case Nuances and Edge Cases: Critical Considerations

## Executive Summary

This document synthesizes research findings on critical nuances, edge cases, and subtleties that must be considered when implementing, testing, and evaluating the use cases in `@arclabs561/ai-visual-test`. These insights come from academic research, industry best practices, and real-world testing scenarios.

## Critical VLLM Limitations Affecting All Use Cases

### 1. The Memorization vs. Visual Analysis Problem

**Finding**: VLMs achieve only 58.57% accuracy on basic visual tasks that humans perform at 100% accuracy. More critically, when counterfactual images contradict training data, accuracy drops to 17.05%—revealing that VLMs default to memorized knowledge rather than performing actual visual analysis.

**Impact on Implementation**:
- **Counterfactual Testing Required**: Include test cases where visual properties contradict canonical training examples (e.g., a dog with 5 legs, circles that don't touch when they appear to)
- **Bias Alignment Metrics**: Track whether errors align with training biases (75.70% of errors are bias-aligned rather than random)
- **Memorization Detection**: Test whether models count visible elements or retrieve memorized associations

**Impact on Tests**:
```javascript
// Example: Test for memorization vs. visual analysis
test('VLLM counts visible elements, not memorized properties', async () => {
  // Create counterfactual image: 5-legged dog
  const counterfactualImage = createCounterfactualImage({
    object: 'dog',
    property: 'legs',
    value: 5, // Contradicts training data
    expectedMemorized: 4
  });
  
  const result = await validateScreenshot(counterfactualImage, 
    'How many legs does this animal have?');
  
  // Should count visible legs (5), not memorized (4)
  assert.strictEqual(result.extractedValue, 5, 
    'VLLM should count visible elements, not retrieve memorized knowledge');
});
```

**Impact on Evaluation Datasets**:
- Include counterfactual variants where object properties contradict training data
- Stratify dataset by bias-aligned vs. random errors
- Test low-level visual primitives (counting, spatial relationships) separately from high-level reasoning

### 2. Low-Level Visual Deficits Masking High-Level Abilities

**Finding**: VLMs exhibit widespread deficits in low- and mid-level visual abilities while excelling at high-level object recognition. A model can solve college-level visual reasoning tasks while failing basic spatial relationships.

**Impact on Implementation**:
- **Stratified Testing**: Test low-level (geometric primitives, counting, orientation), mid-level (texture, continuity), and high-level (object recognition) capabilities separately
- **Cannot Infer Low-Level from High-Level**: Performance on object recognition benchmarks cannot predict low-level spatial reasoning capabilities

**Impact on Tests**:
```javascript
// Example: Stratified visual capability testing
test('low-level visual primitives', async () => {
  const tests = [
    { type: 'counting', image: 'circles.png', expected: 5 },
    { type: 'spatial', image: 'touching-circles.png', expected: true },
    { type: 'orientation', image: 'rotated-shape.png', expected: '45deg' }
  ];
  
  for (const testCase of tests) {
    const result = await validateScreenshot(testCase.image, 
      `Evaluate ${testCase.type} capability`);
    assert.ok(result.score >= 8, 
      `${testCase.type} capability must be validated separately`);
  }
});
```

**Impact on Evaluation Datasets**:
- Include explicit low-level visual tasks (counting intersections, determining if circles touch, identifying circled letters)
- Separate datasets for low/mid/high-level capabilities
- Do not assume high-level performance predicts low-level capabilities

### 3. Confirmation Bias and Question-Aware Processing

**Finding**: VLMs use "late fusion" architectures where visual features are extracted before seeing the question, preventing question-aware visual attention. In-context learning can actually degrade performance on optical illusions.

**Impact on Implementation**:
- **Question-Aware Testing**: Test whether models can direct visual attention toward question-relevant regions
- **ICL Validation**: Empirically test whether few-shot examples improve or degrade performance on your specific domain
- **Spatial Relationship Testing**: Explicitly test spatial relationships between query and image content

**Impact on Tests**:
```javascript
// Example: Test question-aware visual processing
test('question-aware visual attention', async () => {
  const image = 'complex-scene.png'; // Contains multiple objects
  const queries = [
    'What color is the car?', // Should focus on car
    'How many people are visible?', // Should count people
    'Is the text readable?' // Should focus on text
  ];
  
  for (const query of queries) {
    const result = await validateScreenshot(image, query);
    // Verify that reasoning mentions the relevant object
    assert.ok(result.reasoning.includes(query.split(' ')[2]), 
      'Model should focus on question-relevant regions');
  }
});
```

### 4. Object Hallucination and Semantic Grounding

**Finding**: Instruction-tuned VLMs with moderate instruction-following data may result in object hallucination (generating objects inconsistent with images). Multi-turn reasoning can mitigate this.

**Impact on Implementation**:
- **Hallucination Detection**: Test for objects described but not visible in images
- **Multi-Turn Reasoning**: Use multi-turn evaluation frameworks to reduce hallucination
- **Semantic Grounding Validation**: Verify that language references match visual entities

**Impact on Tests**:
```javascript
// Example: Test for object hallucination
test('no object hallucination', async () => {
  const image = 'empty-room.png'; // No objects present
  const result = await validateScreenshot(image, 
    'Describe all objects in this image');
  
  // Should not hallucinate objects
  const mentionedObjects = extractObjects(result.reasoning);
  assert.strictEqual(mentionedObjects.length, 0, 
    'Should not describe objects not present in image');
});
```

## Accessibility Testing Nuances

### 1. Automated Tools Find Only 20-30% of Issues

**Finding**: Automated accessibility testing tools cannot comprehensively test all WCAG success criteria because many guidelines are inherently subjective and require human evaluation.

**Impact on Implementation**:
- **Hybrid Approach Required**: Combine automated checks (fast, code-level) with VLLM semantic evaluation (comprehensive, contextual)
- **Context Assessment**: VLLM can evaluate whether alt text meaningfully describes images, not just whether alt attributes exist
- **Workflow Validation**: Test whether users can actually complete tasks, not just whether technical requirements are met

**Impact on Tests**:
```javascript
// Example: Hybrid accessibility testing
test('accessibility: hybrid automated + VLLM', async () => {
  // Fast programmatic checks
  const programmatic = await validateAccessibilitySmart(page, {
    minContrast: 4.5,
    checkAltText: true,
    checkKeyboardNav: true
  });
  
  // VLLM semantic evaluation
  const semantic = await validateScreenshot(screenshotPath,
    'Evaluate WCAG 2.1 AA compliance. Check: contrast ratios, ' +
    'keyboard navigation, alt text meaningfulness, semantic HTML structure.',
    { testType: 'accessibility-critical' }
  );
  
  // Combine results
  assert.ok(programmatic.passed && semantic.score >= 8,
    'Both automated and semantic checks must pass');
});
```

**Impact on Evaluation Datasets**:
- Include examples where automated tools pass but semantic evaluation fails
- Test complex interactions (form validation flows, error handling)
- Include assistive technology behavior scenarios

### 2. Context and Semantic Meaning

**Finding**: Automated tools verify technical requirements (alt attributes exist) but cannot assess semantic meaning (whether alt text meaningfully describes images for users with visual impairments).

**Impact on Implementation**:
- **Semantic Alt Text Validation**: VLLM can evaluate whether alt text actually describes image content meaningfully
- **Form Usability**: Test whether forms are usable, not just whether they meet technical requirements
- **Logical Structure**: Validate heading hierarchies create logical reading order for screen readers

**Impact on Tests**:
```javascript
// Example: Semantic alt text validation
test('alt text semantic meaning', async () => {
  const images = [
    { src: 'chart.png', alt: 'chart', expected: false }, // Too generic
    { src: 'chart.png', alt: 'Sales increased 25% Q1 2024', expected: true },
    { src: 'decorative.png', alt: '', expected: true } // Decorative, empty OK
  ];
  
  for (const img of images) {
    const result = await validateScreenshot(img.src,
      `Evaluate alt text: "${img.alt}". Is it meaningful for screen reader users?`);
    assert.strictEqual(result.score >= 7, img.expected,
      `Alt text "${img.alt}" should ${img.expected ? 'pass' : 'fail'} semantic evaluation`);
  }
});
```

### 3. Dynamic Content and User Workflows

**Finding**: Automated tools struggle with dynamic content, form validation flows, error handling patterns, and multi-step processes.

**Impact on Implementation**:
- **Workflow Testing**: Test complete user workflows, not just individual pages
- **Error State Validation**: Test error messages are clearly understandable and form correction is possible
- **Keyboard Navigation**: Validate all functionality accessible through keyboard navigation

**Impact on Tests**:
```javascript
// Example: Complete workflow testing
test('accessibility: complete form workflow', async () => {
  await page.goto('/checkout');
  
  // Test each step of workflow
  const steps = [
    { action: 'fill', field: 'email', value: 'invalid-email' },
    { action: 'submit', expectedError: 'Please enter a valid email' },
    { action: 'fill', field: 'email', value: 'valid@example.com' },
    { action: 'submit', expectedState: 'payment-screen' }
  ];
  
  for (const step of steps) {
    if (step.action === 'fill') {
      await page.fill(`[name="${step.field}"]`, step.value);
    } else if (step.action === 'submit') {
      await page.keyboard.press('Enter'); // Keyboard navigation
      const screenshot = await page.screenshot();
      
      if (step.expectedError) {
        const result = await validateScreenshot(screenshot,
          `Is the error message "${step.expectedError}" clearly visible and understandable?`);
        assert.ok(result.score >= 8, 'Error messages must be accessible');
      }
    }
  }
});
```

## Game Testing Edge Cases

### 1. Boundary Value Scenarios

**Finding**: Games require systematic testing of values at boundaries: minimum/maximum player values, extreme coordinates, resource constraints, frame rate fluctuations.

**Impact on Implementation**:
- **Boundary Testing**: Test health points, ammo counts, experience thresholds at boundaries
- **Physics Boundaries**: Test extreme coordinate positions and physics calculations
- **Resource Limits**: Test inventory slots, currency maximums at limits

**Impact on Tests**:
```javascript
// Example: Boundary value testing for games
test('game: boundary value scenarios', async () => {
  const boundaries = [
    { health: 0, expected: 'game-over' },
    { health: 1, expected: 'critical' },
    { health: 100, expected: 'full' },
    { ammo: 0, expected: 'reload-required' },
    { ammo: 999, expected: 'max-capacity' }
  ];
  
  for (const boundary of boundaries) {
    await setGameState(boundary);
    const screenshot = await page.screenshot();
    
    const result = await validateScreenshot(screenshot,
      `Game state: health=${boundary.health}, ammo=${boundary.ammo}. ` +
      `Is the UI correctly reflecting ${boundary.expected} state?`);
    
    assert.ok(result.score >= 8, 
      `Boundary case ${JSON.stringify(boundary)} must be handled correctly`);
  }
});
```

### 2. Concurrent User Operations

**Finding**: Multiplayer games face edge cases where multiple players interact with shared resources, attempt simultaneous transactions, or experience conflicting state updates.

**Impact on Implementation**:
- **Shared Resource Testing**: Test concurrent operations on shared game objects
- **State Synchronization**: Validate state updates remain consistent across network
- **Conflict Resolution**: Test how conflicts are resolved (last-write-wins, merge, etc.)

**Impact on Tests**:
```javascript
// Example: Concurrent operations testing
test('game: concurrent user operations', async () => {
  // Simulate two players interacting with same object
  const [player1, player2] = await createMultiplayerSession();
  
  // Both players attempt to pick up same item simultaneously
  await Promise.all([
    player1.page.click('[data-item="treasure"]'),
    player2.page.click('[data-item="treasure"]')
  ]);
  
  // Validate only one player gets item
  const screenshots = await Promise.all([
    player1.page.screenshot(),
    player2.page.screenshot()
  ]);
  
  const results = await Promise.all(screenshots.map(screenshot =>
    validateScreenshot(screenshot,
      'Did this player successfully pick up the treasure? Only one player should have it.')
  ));
  
  // Exactly one player should have treasure
  const playersWithTreasure = results.filter(r => r.extractedValue === true).length;
  assert.strictEqual(playersWithTreasure, 1,
    'Concurrent operations must be handled correctly');
});
```

### 3. Performance Under Extreme Conditions

**Finding**: Games must be tested under extreme conditions: high concurrent users, complex in-game scenarios, frame rate stability, memory usage.

**Impact on Implementation**:
- **Stress Testing**: Test under high concurrent user loads
- **Frame Rate Stability**: Validate frame rate remains stable under load
- **Memory Leaks**: Test for memory usage growth over extended play sessions

**Impact on Tests**:
```javascript
// Example: Performance testing
test('game: performance under extreme conditions', async () => {
  // Simulate high load
  await simulateHighLoad({ concurrentUsers: 100, duration: 60000 });
  
  // Capture gameplay at 60 FPS
  const frames = await captureTemporalScreenshots(page, {
    fps: 60,
    duration: 10000 // 10 seconds
  });
  
  // Validate frame rate stability
  const frameIntervals = frames.map((f, i) => 
    i > 0 ? f.timestamp - frames[i-1].timestamp : 0
  );
  const avgInterval = frameIntervals.reduce((a, b) => a + b) / frameIntervals.length;
  const expectedInterval = 1000 / 60; // ~16.67ms for 60 FPS
  
  assert.ok(Math.abs(avgInterval - expectedInterval) < 5,
    'Frame rate must remain stable under load');
  
  // Validate gameplay quality doesn't degrade
  for (const frame of frames) {
    const result = await validateScreenshot(frame.path,
      'Is the game playable? Check for lag, stuttering, or visual glitches.');
    assert.ok(result.score >= 7,
      'Gameplay quality must not degrade under load');
  }
});
```

## Temporal Testing Considerations

### 1. Temporal Order and Cross-Validation

**Finding**: Time series data requires maintaining temporal order in train-test splits. Rolling window validation and time series cross-validation are essential.

**Impact on Implementation**:
- **Temporal Order Preservation**: Maintain temporal order when splitting datasets
- **Rolling Window Validation**: Use moving window approach for temporal sequences
- **Temporal Coherence**: Validate that temporal notes maintain coherence over time

**Impact on Tests**:
```javascript
// Example: Temporal order validation
test('temporal: order preservation', async () => {
  const gameplaySequence = await captureTemporalScreenshots(page, {
    fps: 2,
    duration: 10000
  });
  
  // Validate temporal order
  for (let i = 1; i < gameplaySequence.length; i++) {
    assert.ok(gameplaySequence[i].timestamp > gameplaySequence[i-1].timestamp,
      'Temporal sequence must maintain order');
  }
  
  // Validate temporal coherence
  const aggregated = aggregateTemporalNotes(gameplaySequence.map(f => ({
    timestamp: f.timestamp,
    score: f.evaluation.score,
    observation: f.evaluation.reasoning
  })));
  
  assert.ok(aggregated.coherence >= 0.7,
    'Temporal sequence must maintain coherence');
});
```

### 2. Multi-Scale Temporal Analysis

**Finding**: Different time scales reveal different patterns. Immediate reactions (100ms), quick assessments (1s), detailed evaluation (10s), comprehensive review (60s).

**Impact on Implementation**:
- **Multi-Scale Aggregation**: Aggregate temporal notes at multiple time scales
- **Scale-Specific Validation**: Different validation criteria for different time scales
- **Attention-Based Weighting**: Weight recent observations more heavily

**Impact on Tests**:
```javascript
// Example: Multi-scale temporal analysis
test('temporal: multi-scale aggregation', async () => {
  const temporalNotes = generateTemporalNotes({
    duration: 60000, // 60 seconds
    frequency: 10 // 10 notes per second
  });
  
  const multiScale = aggregateMultiScale(temporalNotes, {
    timeScales: {
      immediate: 100,   // 0.1s - instant reactions
      short: 1000,       // 1s - quick assessments
      medium: 10000,     // 10s - detailed evaluation
      long: 60000       // 60s - comprehensive review
    }
  });
  
  // Validate each scale provides meaningful insights
  assert.ok(multiScale.immediate.windows.length > 0,
    'Immediate scale should capture instant reactions');
  assert.ok(multiScale.short.windows.length > 0,
    'Short scale should capture quick assessments');
  assert.ok(multiScale.medium.windows.length > 0,
    'Medium scale should capture detailed evaluation');
  assert.ok(multiScale.long.windows.length > 0,
    'Long scale should capture comprehensive review');
});
```

## Evaluation Dataset Requirements

### 1. Prevent Non-Visual Answering

**Finding**: Standard benchmarks can be partially solved without visual analysis. Questions that can be answered through world knowledge alone obscure actual visual deficits.

**Impact on Dataset Design**:
- **Baseline Testing**: Test performance when images are removed or corrupted
- **Visual Discriminative Power**: If accuracy doesn't drop substantially when images are removed, the benchmark lacks visual discriminative power
- **Counterfactual Variants**: Include counterfactual images where properties contradict training data

**Impact on Evaluation**:
```javascript
// Example: Baseline testing for visual discriminative power
test('evaluation: visual discriminative power', async () => {
  const testCases = [
    { image: 'normal.png', prompt: 'What is this?' },
    { image: 'corrupted.png', prompt: 'What is this?' }, // Corrupted image
    { image: null, prompt: 'What is this?' } // No image
  ];
  
  const results = await Promise.all(testCases.map(tc =>
    validateScreenshot(tc.image, tc.prompt)
  ));
  
  // Accuracy should drop significantly without visual input
  const normalAccuracy = results[0].score;
  const corruptedAccuracy = results[1].score;
  const noImageAccuracy = results[2].score;
  
  assert.ok(noImageAccuracy < normalAccuracy * 0.5,
    'Benchmark must require visual input - accuracy should drop without images');
  assert.ok(corruptedAccuracy < normalAccuracy * 0.7,
    'Corrupted images should reduce accuracy');
});
```

### 2. Stratified Capability Testing

**Finding**: Performance on high-level tasks cannot predict low-level capabilities. Datasets must explicitly test low-level visual primitives.

**Impact on Dataset Design**:
- **Stratified Datasets**: Separate datasets for low/mid/high-level capabilities
- **Primitive Testing**: Explicit tests for counting, spatial relationships, orientation
- **No Assumptions**: Do not assume high-level performance predicts low-level capabilities

**Impact on Evaluation**:
```javascript
// Example: Stratified capability evaluation
test('evaluation: stratified capabilities', async () => {
  const capabilities = {
    low: [
      { task: 'counting', image: 'circles.png', expected: 5 },
      { task: 'spatial', image: 'touching-circles.png', expected: true },
      { task: 'orientation', image: 'rotated-shape.png', expected: '45deg' }
    ],
    mid: [
      { task: 'texture', image: 'texture.png', expected: 'rough' },
      { task: 'continuity', image: 'continuous-line.png', expected: true }
    ],
    high: [
      { task: 'object-recognition', image: 'scene.png', expected: 'car' },
      { task: 'scene-understanding', image: 'scene.png', expected: 'parking-lot' }
    ]
  };
  
  for (const [level, tests] of Object.entries(capabilities)) {
    const results = await Promise.all(tests.map(t =>
      validateScreenshot(t.image, `Evaluate ${t.task} capability`)
    ));
    
    const accuracy = results.filter((r, i) => 
      r.extractedValue === tests[i].expected
    ).length / results.length;
    
    console.log(`${level}-level capability accuracy: ${accuracy}`);
    
    // Each level must be evaluated independently
    assert.ok(accuracy >= 0.7,
      `${level}-level capabilities must be validated separately`);
  }
});
```

### 3. Edge Case Coverage

**Finding**: Test datasets must reflect real-world diversity: representative samples, edge cases, adversarial examples, out-of-distribution data.

**Impact on Dataset Design**:
- **Representative Samples**: Data that mirrors actual use
- **Edge Cases**: Rare or extreme inputs that break assumptions
- **Adversarial Examples**: Intentionally tricky inputs to test robustness
- **Out-of-Distribution**: Unseen scenarios to check generalization

**Impact on Evaluation**:
```javascript
// Example: Edge case coverage
test('evaluation: edge case coverage', async () => {
  const edgeCases = [
    { type: 'extreme-values', image: 'max-health.png', description: 'Maximum health' },
    { type: 'unusual-layout', image: 'overlapping-ui.png', description: 'Overlapping UI elements' },
    { type: 'corrupted-visual', image: 'glitch.png', description: 'Visual glitches' },
    { type: 'adversarial', image: 'adversarial-pattern.png', description: 'Adversarial patterns' }
  ];
  
  for (const edgeCase of edgeCases) {
    const result = await validateScreenshot(edgeCase.image,
      `Evaluate this ${edgeCase.description} scenario. Is the UI still functional?`);
    
    // Edge cases should be handled gracefully
    assert.ok(result.score >= 5,
      `Edge case ${edgeCase.type} must be handled (score >= 5)`);
    
    // Should detect issues but not crash
    assert.ok(result.issues.length >= 0,
      `Edge case ${edgeCase.type} should report issues if present`);
  }
});
```

## Implementation Recommendations

### 1. Test for Memorization vs. Visual Analysis

**Action Items**:
- Include counterfactual test cases in all use cases
- Track bias-aligned vs. random errors
- Test low-level visual primitives separately

### 2. Hybrid Testing Approaches

**Action Items**:
- Combine automated checks with VLLM evaluation
- Use programmatic validation for fast feedback
- Use VLLM for semantic and contextual evaluation

### 3. Stratified Evaluation

**Action Items**:
- Separate low/mid/high-level capability testing
- Do not assume high-level performance predicts low-level
- Test visual discriminative power of benchmarks

### 4. Temporal Order and Coherence

**Action Items**:
- Maintain temporal order in datasets
- Use multi-scale temporal aggregation
- Validate temporal coherence

### 5. Edge Case Coverage

**Action Items**:
- Include boundary value scenarios
- Test concurrent operations
- Validate performance under extreme conditions
- Test adversarial and out-of-distribution examples

## Testing Strategy Summary

### For Each Use Case:

1. **Baseline Testing**: Verify visual discriminative power
2. **Stratified Testing**: Test low/mid/high-level capabilities separately
3. **Counterfactual Testing**: Test memorization vs. visual analysis
4. **Edge Case Testing**: Boundary values, concurrent operations, extreme conditions
5. **Temporal Testing**: Order preservation, coherence, multi-scale analysis
6. **Hybrid Testing**: Combine automated + VLLM evaluation
7. **Workflow Testing**: Complete user workflows, not just individual pages

### For Evaluation Datasets:

1. **Prevent Non-Visual Answering**: Test baseline without images
2. **Stratified Capabilities**: Separate low/mid/high-level datasets
3. **Edge Case Coverage**: Representative, edge cases, adversarial, out-of-distribution
4. **Counterfactual Variants**: Test memorization detection
5. **Temporal Sequences**: Maintain order, test coherence

## Sources

- VLLM Visual Limitations: Perplexity research on vision language model failures
- Accessibility Testing Nuances: Perplexity research on automated vs. manual accessibility testing
- Game Testing Edge Cases: Perplexity research on game QA methodologies
- Temporal Testing: Tavily search on time series validation
- Playwright Best Practices: Context7 Playwright documentation
- Academic Papers: arXiv papers on VLLM evaluation, visual testing, game testing

