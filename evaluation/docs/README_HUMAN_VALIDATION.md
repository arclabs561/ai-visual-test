# Human Validation Demonstration

## Quick Start

Run the demonstration to see the human validation system in action:

```bash
node evaluation/human-validation/demo-human-validation.mjs
```

## What It Demonstrates

1. **Initialization**: Shows how to set up human validation
2. **Automatic Collection**: VLLM judgments are collected automatically during evaluations
3. **Smart Sampling**: System requests human validation for interesting cases (edge scores, high uncertainty, etc.)
4. **Calibration**: Automatic calibration when enough data is collected
5. **Bias Correction**: Calibrated scores are applied to future evaluations

## Expected Output

The demo will:
- Capture screenshots from test websites
- Run VLLM evaluations (with automatic human validation collection)
- Show calibration status
- Demonstrate how calibration improves accuracy

## Customization

Edit `evaluation/human-validation/demo-human-validation.mjs` to:
- Change test websites
- Modify the human validator function
- Adjust smart sampling settings
- Test different calibration scenarios

## Integration

The human validation system is automatically integrated into:
- `validateScreenshot()` - All evaluations
- `BatchOptimizer` - Batched evaluations
- `TemporalBatchOptimizer` - Temporal evaluations
- `experiencePageAsPersona()` - Persona-based evaluations

Just enable it with `enableHumanValidation: true` in the context options.

