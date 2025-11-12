"""
Comprehensive API Examples with ai-browser-test

This notebook demonstrates ALL available APIs:
- validateScreenshot (primary API)
- testGameplay
- testBrowserExperience
- validateWithGoals
- experiencePageAsPersona
- Temporal aggregation
- Uncertainty reduction
- Goals-based validation

This is the "comprehensive meta experience" for marimo notebooks.
"""

import marimo

__generated_with = "0.10.6"
app = marimo.App()


@app.cell
def __():
    import os
    import json
    import subprocess
    from pathlib import Path
    from pydantic import ValidationError
    from models import ValidationResult, PersonaExperienceResult
    from config import AppSettings
    
    # Configuration using Pydantic Settings
    settings = AppSettings()
    API_KEY = settings.api_key
    URL = settings.test_url or "https://example.com"
    
    return API_KEY, Path, URL, ValidationError, PersonaExperienceResult, ValidationResult, json, os, settings, subprocess


@app.cell
def __(API_KEY):
    """
    Setup: Check configuration
    """
    if not API_KEY:
        print("⚠️  Warning: No API key found")
        print("   Set GEMINI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY")
    else:
        print("✅ API key configured")
    
    print(f"🌐 Target URL: {URL}")
    
    return


@app.cell
def __(API_KEY, URL, json, subprocess):
    """
    Test 1: Basic Validation (validateScreenshot - Primary API)
    
    This is the primary API for screenshot validation.
    """
    import json as py_json
    
    node_script = f"""
    import {{ validateScreenshot }} from 'ai-browser-test';
    
    async function run() {{
        // Create a test screenshot (in real usage, you'd have an actual screenshot)
        const screenshotPath = 'test-screenshot.png';
        
        const result = await validateScreenshot(
            screenshotPath,
            'Evaluate this screenshot for quality, accessibility, and design principles.',
            {{
                testType: 'general',
                enableUncertaintyReduction: true,
                enableHallucinationCheck: true,
                viewport: {{ width: 1280, height: 720 }}
            }}
        );
        
        console.log(JSON.stringify(result, null, 2));
    }}
    
    run().catch(err => {{
        console.error(JSON.stringify({{ error: err.message, stack: err.stack }}));
        process.exit(1);
    }});
    """
    
    print("📊 Test 1: Basic Validation (validateScreenshot)")
    print("   Primary API with uncertainty reduction")
    
    return node_script,


@app.cell
def __(API_KEY, URL, json, subprocess):
    """
    Test 2: Goals-Based Validation (validateWithGoals)
    
    New convenience function for goals-based validation.
    """
    import json as py_json
    
    node_script = f"""
    import {{ validateWithGoals, createGameGoal }} from 'ai-browser-test';
    import {{ chromium }} from 'playwright';
    
    async function run() {{
        const browser = await chromium.launch();
        const page = await browser.newPage();
        
        try {{
            await page.goto({py_json.dumps(URL)});
            const screenshotPath = 'test-goals.png';
            await page.screenshot({{ path: screenshotPath, fullPage: true }});
            
            // Test with different goal types
            const goals = [
                'accessibility',  // String goal
                createGameGoal('usability'),  // Game goal
                {{  // Object goal
                    description: 'Documentation clarity',
                    criteria: ['Clear examples', 'Good navigation', 'Readable code blocks']
                }}
            ];
            
            const results = [];
            for (const goal of goals) {{
                const result = await validateWithGoals(
                    screenshotPath,
                    {{
                        goal: goal,
                        testType: 'meta-documentation-goals'
                    }}
                );
                results.push(result);
            }}
            
            console.log(JSON.stringify(results, null, 2));
        }} catch (error) {{
            console.error(JSON.stringify({{ error: error.message, stack: error.stack }}));
            process.exit(1);
        }} finally {{
            await browser.close();
        }}
    }}
    
    run();
    """
    
    print("🎯 Test 2: Goals-Based Validation (validateWithGoals)")
    print("   Supports string, object, array, and function goals")
    
    return node_script,


@app.cell
def __(API_KEY, URL, json, subprocess):
    """
    Test 3: Browser Experience Testing (testBrowserExperience)
    
    New convenience function for full browser experience testing.
    """
    import json as py_json
    
    node_script = f"""
    import {{ testBrowserExperience }} from 'ai-browser-test';
    import {{ chromium }} from 'playwright';
    
    async function run() {{
        const browser = await chromium.launch();
        const page = await browser.newPage();
        
        try {{
            const result = await testBrowserExperience(page, {{
                url: {py_json.dumps(URL)},
                stages: ['initial-load', 'scroll', 'navigation', 'interaction'],
                goals: ['accessibility', 'usability', 'performance'],
                captureTemporal: true,
                captureCode: true
            }});
            
            console.log(JSON.stringify(result, null, 2));
        }} catch (error) {{
            console.error(JSON.stringify({{ error: error.message, stack: error.stack }}));
            process.exit(1);
        }} finally {{
            await browser.close();
        }}
    }}
    
    run();
    """
    
    print("🌐 Test 3: Browser Experience Testing (testBrowserExperience)")
    print("   Full browser experience across multiple stages")
    
    return node_script,


@app.cell
def __(API_KEY, URL, json, subprocess):
    """
    Test 4: Gameplay Testing (testGameplay)
    
    New convenience function for gameplay testing.
    """
    import json as py_json
    
    node_script = f"""
    import {{ testGameplay }} from 'ai-browser-test';
    import {{ chromium }} from 'playwright';
    
    async function run() {{
        const browser = await chromium.launch();
        const page = await browser.newPage();
        
        try {{
            await page.goto({py_json.dumps(URL)});
            
            const result = await testGameplay(page, {{
                goal: 'Evaluate gameplay experience, controls, and user engagement',
                stages: ['start', 'play', 'interact', 'complete'],
                captureTemporal: true,
                captureState: true
            }});
            
            console.log(JSON.stringify(result, null, 2));
        }} catch (error) {{
            console.error(JSON.stringify({{ error: error.message, stack: error.stack }}));
            process.exit(1);
        }} finally {{
            await browser.close();
        }}
    }}
    
    run();
    """
    
    print("🎮 Test 4: Gameplay Testing (testGameplay)")
    print("   Gameplay experience testing with temporal aggregation")
    
    return node_script,


@app.cell
def __(API_KEY, URL, json, subprocess):
    """
    Test 5: Persona Experience (experiencePageAsPersona)
    
    Updated API for persona-based testing with automatic temporal aggregation.
    """
    import json as py_json
    
    node_script = f"""
    import {{ experiencePageAsPersona }} from 'ai-browser-test';
    import {{ chromium }} from 'playwright';
    
    async function run() {{
        const browser = await chromium.launch();
        const page = await browser.newPage();
        
        try {{
            await page.goto({py_json.dumps(URL)});
            
            const result = await experiencePageAsPersona(
                page,
                {{
                    name: 'New Developer',
                    goals: ['understand the API quickly', 'find examples'],
                    concerns: ['complexity', 'learning curve'],
                    focus: ['quick-start', 'examples', 'simplicity']
                }},
                {{
                    url: {py_json.dumps(URL)},
                    testType: 'meta-documentation-persona',
                    captureCode: true,
                    captureTemporal: true,
                    duration: 5000  // 5 seconds
                }}
            );
            
            console.log(JSON.stringify(result, null, 2));
        }} catch (error) {{
            console.error(JSON.stringify({{ error: error.message, stack: error.stack }}));
            process.exit(1);
        }} finally {{
            await browser.close();
        }}
    }}
    
    run();
    """
    
    print("👤 Test 5: Persona Experience (experiencePageAsPersona)")
    print("   Persona-based testing with automatic temporal aggregation")
    
    return node_script,


@app.cell
def __(API_KEY, URL, json, subprocess):
    """
    Test 6: Temporal Aggregation
    
    Demonstrates temporal aggregation functions.
    """
    import json as py_json
    
    node_script = f"""
    import {{ aggregateTemporalNotes, aggregateMultiScale }} from 'ai-browser-test';
    
    // Example temporal notes (in real usage, these come from experiencePageAsPersona)
    const temporalNotes = [
        {{ elapsed: 0, score: 7.5, timestamp: Date.now() }},
        {{ elapsed: 1000, score: 8.0, timestamp: Date.now() + 1000 }},
        {{ elapsed: 2000, score: 7.8, timestamp: Date.now() + 2000 }},
        {{ elapsed: 3000, score: 8.2, timestamp: Date.now() + 3000 }},
        {{ elapsed: 4000, score: 8.5, timestamp: Date.now() + 4000 }}
    ];
    
    // Standard temporal aggregation
    const aggregated = aggregateTemporalNotes(temporalNotes, {{
        windowSize: 5000,
        decayFactor: 0.9
    }});
    
    // Multi-scale temporal aggregation
    const aggregatedMultiScale = aggregateMultiScale(temporalNotes, {{
        timeScales: {{
            immediate: 100,
            short: 1000,
            medium: 5000,
            long: 10000
        }}
    }});
    
    console.log(JSON.stringify({{
        aggregated,
        aggregatedMultiScale
    }}, null, 2));
    """
    
    print("⏱️  Test 6: Temporal Aggregation")
    print("   Standard and multi-scale temporal aggregation")
    
    return node_script,


@app.cell
def __(API_KEY, URL, json, subprocess):
    """
    Test 7: Uncertainty Reduction
    
    Demonstrates uncertainty reduction features.
    """
    import json as py_json
    
    node_script = f"""
    import {{ validateScreenshot, shouldUseSelfConsistency }} from 'ai-browser-test';
    
    async function run() {{
        const screenshotPath = 'test-uncertainty.png';
        
        // Validate with uncertainty reduction enabled
        const result = await validateScreenshot(
            screenshotPath,
            'Evaluate this screenshot.',
            {{
                enableUncertaintyReduction: true,
                enableHallucinationCheck: true,
                adaptiveSelfConsistency: true
            }}
        );
        
        // Check if self-consistency is recommended
        const selfConsistencyDecision = shouldUseSelfConsistency(
            {{
                testType: 'critical',
                importance: 'high',
                impact: 'blocks-use'
            }},
            {{
                score: result.score,
                uncertainty: result.uncertainty,
                issues: result.issues || []
            }}
        );
        
        console.log(JSON.stringify({{
            result: {{
                score: result.score,
                uncertainty: result.uncertainty,
                confidence: result.confidence,
                selfConsistencyRecommended: result.selfConsistencyRecommended
            }},
            selfConsistencyDecision
        }}, null, 2));
    }}
    
    run().catch(err => {{
        console.error(JSON.stringify({{ error: err.message, stack: err.stack }}));
        process.exit(1);
    }});
    """
    
    print("🔬 Test 7: Uncertainty Reduction")
    print("   Uncertainty estimation and adaptive self-consistency")
    
    return node_script,


@app.cell
def __():
    """
    Summary: All Available APIs
    
    ## Primary API
    - `validateScreenshot(imagePath, prompt, context)` - Core validation
    
    ## Convenience Functions
    - `testGameplay(page, options)` - Gameplay testing
    - `testBrowserExperience(page, options)` - Browser experience testing
    - `validateWithGoals(imagePath, options)` - Goals-based validation
    
    ## Persona & Experience
    - `experiencePageAsPersona(page, persona, options)` - Persona-based testing
    
    ## Temporal Aggregation
    - `aggregateTemporalNotes(notes, options)` - Standard aggregation
    - `aggregateMultiScale(notes, options)` - Multi-scale aggregation
    
    ## Uncertainty Reduction
    - `shouldUseSelfConsistency(context, partialResult)` - Adaptive self-consistency
    
    ## Goals
    - `createGameGoal(goalType)` - Create game goals
    
    All functions support:
    - Uncertainty reduction
    - Goals-based validation
    - Temporal aggregation
    - Multi-modal validation (screenshot + HTML + CSS)
    """
    return

