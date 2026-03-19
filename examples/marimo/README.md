# Marimo Notebook Examples for ai-visual-test

These notebooks demonstrate how to use `ai-visual-test` in interactive Python notebooks using [marimo](https://marimo.io).

Notebooks match the current API signatures and return types.

Includes:
- Pydantic models (`models.py`) for type-safe validation of API responses
- Pydantic Settings (`config.py`) for configuration management with `.env` support
- `uv` support (`pyproject.toml`) for dependency management

## Prerequisites

1. **Install Python dependencies using uv (recommended):**
   ```bash
   # Install uv if not already installed
   curl -LsSf https://astral.sh/uv/install.sh | sh
   
   # Navigate to examples/marimo directory
   cd examples/marimo
   
   # Install dependencies
   uv sync
   ```

   Or using pip:
   ```bash
   cd examples/marimo
   pip install marimo pydantic pydantic-settings pillow pandas
   ```

2. **Install Node.js dependencies:**
   ```bash
   npm install ai-visual-test
   # For multi-modal and persona examples, also install Playwright:
   npm install @playwright/test
   # Or use the standalone playwright package:
   npm install playwright
   ```

3. **Set up API keys:**
   
   Create a `.env` file in `examples/marimo/`:
   ```bash
   GEMINI_API_KEY=your-key-here
   # or
   OPENAI_API_KEY=your-key-here
   ```
   
   Or export environment variables:
   ```bash
   export GEMINI_API_KEY="your-key-here"
   export OPENAI_API_KEY="your-key-here"
   ```
   
   The notebooks use Pydantic Settings which automatically loads from `.env` files.

## Running the Notebooks

### Option 1: Using uv (recommended)

```bash
cd examples/marimo
uv run marimo edit basic_validation.py
```

### Option 2: Using marimo directly

```bash
marimo edit examples/marimo/basic_validation.py
```

### Option 3: Using sandbox mode

```bash
marimo edit --sandbox examples/marimo/basic_validation.py
```

This automatically installs dependencies in an isolated environment.

## Available Notebooks

### 1. `basic_validation.py`
Basic screenshot validation example:
- Load and display screenshots
- Validate using VLLM (primary API: `validateScreenshot`)
- Display results with scores, issues, uncertainty, and confidence
- Uncertainty reduction enabled

### 2. `multi_modal_validation.py`
Multi-modal validation combining:
- Screenshots (visual)
- HTML structure
- CSS styles
- Rendered code

### 3. `persona_testing.py`
Persona-based testing from multiple perspectives:
- Different user types
- Different devices
- Different goals and expectations
- Uses `experiencePageAsPersona` (updated API)
- Automatic temporal aggregation

### 4. `comprehensive_apis.py`
Demonstration of all available APIs:
- `validateScreenshot` (primary API)
- `testGameplay` (gameplay testing)
- `testBrowserExperience` (browser experience)
- `validateWithGoals` (goals-based validation)
- `experiencePageAsPersona` (persona testing)
- Temporal aggregation functions
- Uncertainty reduction features

## Notes

**Note:** These notebooks demonstrate calling the Node.js package from Python. Key points:

1. **Function Signatures:**
   - `validateScreenshot(imagePath, prompt, context)` - **Primary API** for screenshot validation
     - Returns `ValidationResult` with `score` (0-10), `issues[]`, `assessment`, `reasoning`, `provider`, `cached`, `estimatedCost`, `responseTime`, `uncertainty`, `confidence`
     - Context options: `testType`, `viewport`, `useCache`, `timeout`, `useRubric`, `enableUncertaintyReduction`, `enableHallucinationCheck`, `adaptiveSelfConsistency`
   - `testGameplay(page, options)` - **New convenience function** for gameplay testing
     - Options: `goal`, `stages`, `captureTemporal`, `captureState`
     - Returns gameplay experience with temporal aggregation
   - `testBrowserExperience(page, options)` - **New convenience function** for browser experience testing
     - Options: `url`, `stages`, `goals`, `captureTemporal`, `captureCode`
     - Returns browser experience across multiple stages
   - `validateWithGoals(imagePath, options)` - **New convenience function** for goals-based validation
     - Options: `goal` (string, object, array, or function), `testType`
     - Supports variable goals for flexible evaluation
   - `experiencePageAsPersona(page, persona, options)` - **Updated API** for persona-based testing
     - `persona` structure: `{ name: string, goals: string[], concerns: string[], focus: string[] }`
     - Options: `url`, `testType`, `captureCode`, `captureTemporal`, `duration`
     - **Automatically performs temporal aggregation** (returns `aggregated` and `aggregatedMultiScale`)
   - `aggregateTemporalNotes(notes, options)` - Standard temporal aggregation
   - `aggregateMultiScale(notes, options)` - Multi-scale temporal aggregation
   - `shouldUseSelfConsistency(context, partialResult)` - Adaptive self-consistency decision

2. **Return Types:**
   - `validateScreenshot` returns `ValidationResult` with:
     - `score`: number | null (0-10 scale, not 0-1)
     - `issues`: string[] (always present, may be empty)
     - `assessment`: string | null
     - `reasoning`: string
     - `provider`: string
     - `cached`: boolean
     - `estimatedCost`: { totalCost, inputCost, outputCost, inputTokens, outputTokens } | null
     - `responseTime`: number (milliseconds)
     - `enabled`: boolean (false if API key missing)
     - `uncertainty`: number | null (0-1, higher = more uncertain)
     - `confidence`: number | null (0-1, higher = more confident)
     - `selfConsistencyRecommended`: boolean | null
   - `testGameplay` returns object with: `result` (ValidationResult), `stages`, `aggregated`, `aggregatedMultiScale`
   - `testBrowserExperience` returns object with: `stages`, `averageScore`, `aggregated`, `aggregatedMultiScale`
   - `validateWithGoals` returns object with: `result` (ValidationResult), `goal`, `aggregated` (if temporal notes provided)
   - `experiencePageAsPersona` returns `PersonaExperienceResult` with: `persona`, `notes`, `screenshots`, `renderedCode`, `evaluation` (ValidationResult), `aggregated`, `aggregatedMultiScale`

3. **For Playwright integration:**
   - The multi-modal and persona examples require Playwright
   - Install `@playwright/test` or `playwright` as a peer dependency
   - The package uses `"type": "module"` so use ES6 imports in Node.js scripts

4. **Configuration (Optional):**
   - Use `createConfig()` to customize provider, caching, and debug settings
   - Example: `createConfig({ provider: 'gemini', cacheEnabled: true, verbose: true })`
   - If not configured, auto-detects from environment variables

5. **Common testType values:**
   - `'homepage'`, `'payment-screen'`, `'game-ui'`, `'general'`, `'unit-test'`
   - Used for caching and cost tracking

6. **Alternative approaches:**
   - Deploy the Vercel API endpoint and call it via HTTP from Python
   - Use a proper bridge like `nodejs-python-bridge` or `py-node`
   - Use Python's Playwright library and adapt the examples

## Language-Agnostic Usage

The package can be used from any language by:

1. **Using the Vercel API:**
   ```python
   import requests
   
   response = requests.post(
       "https://your-app.vercel.app/api/validate",
       json={
           "image": base64_image,
           "prompt": "Evaluate this screenshot...",
           "context": {"testType": "payment-screen"}
       }
   )
   result = response.json()
   ```

2. **Calling Node.js via subprocess:**
   ```python
   import subprocess
   import json
   
   result = subprocess.run(
       ["node", "validate.mjs"],
       input=json.dumps({"image": base64_image, "prompt": "..."}),
       capture_output=True,
       text=True
   )
   ```

3. **Using a bridge library:**
   - `nodejs-python-bridge`
   - `py-node`
   - Custom FFI bindings

## Standalone Package Usage

The core validation functionality (`validateScreenshot`, `VLLMJudge`) is **standalone** and doesn't require Playwright:

- Works without Playwright (for screenshot validation)
- Can be used from any language via API or subprocess
- Single runtime dependency (`async-mutex`)

Playwright is only required for:
- Multi-modal validation (extracting HTML/CSS)
- Persona-based testing (browser automation)
- Temporal screenshots (capturing over time)

## Next Steps

1. Try the basic validation notebook
2. Experiment with different prompts
3. Test with your own screenshots
4. Explore multi-modal validation
5. Try persona-based testing

For more examples, see the main [README.md](../../README.md).

