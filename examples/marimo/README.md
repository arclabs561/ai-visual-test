# Marimo Notebook Examples for ai-browser-test

These notebooks demonstrate how to use `ai-browser-test` in interactive Python notebooks using [marimo](https://marimo.io).

## Prerequisites

1. **Install marimo:**
   ```bash
   pip install marimo
   ```

2. **Install Node.js dependencies:**
   ```bash
   npm install ai-browser-test
   ```

3. **Set up API keys:**
   ```bash
   export GEMINI_API_KEY="your-key-here"
   # or
   export OPENAI_API_KEY="your-key-here"
   ```

## Running the Notebooks

### Option 1: Using marimo edit

```bash
marimo edit examples/marimo/basic_validation.py
```

### Option 2: Using sandbox mode (recommended)

```bash
marimo edit --sandbox examples/marimo/basic_validation.py
```

This automatically installs dependencies in an isolated environment.

## Available Notebooks

### 1. `basic_validation.py`
Basic screenshot validation example:
- Load and display screenshots
- Validate using VLLM
- Display results with scores and issues

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

## Notes

⚠️ **Important:** These notebooks are conceptual examples. In practice, you would need to:

1. **Call Node.js from Python:**
   - Use `subprocess` to run Node.js scripts
   - Or use a proper bridge like `nodejs-python-bridge`
   - Or use the Vercel API endpoint instead

2. **For Playwright integration:**
   - The multi-modal and persona examples require Playwright
   - You would need to install `@playwright/test` in your Node.js environment
   - Or use the Python Playwright library and adapt the examples

3. **Alternative approach:**
   - Deploy the Vercel API endpoint
   - Call it via HTTP from Python
   - This is the most language-agnostic approach

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

- ✅ Works without Playwright (for screenshot validation)
- ✅ Can be used from any language via API or subprocess
- ✅ Zero runtime dependencies (except Node.js)

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

