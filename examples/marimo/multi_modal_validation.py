"""
Multi-Modal Validation with ai-browser-test

This notebook demonstrates multi-modal validation combining:
- Screenshots (visual)
- HTML structure
- CSS styles
- Rendered code

Note: This requires Playwright integration. In practice, you would
call the Node.js package from Python.
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
    
    # Configuration
    API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("OPENAI_API_KEY")
    URL = "https://example.com"  # Change to your test URL
    
    return API_KEY, Path, URL, json, os, subprocess


@app.cell
def __(API_KEY):
    """
    Setup: Check configuration
    """
    if not API_KEY:
        print("⚠️  Warning: No API key found")
    else:
        print("✅ API key configured")
    
    print(f"🌐 Target URL: {URL}")
    
    return


@app.cell
def __(API_KEY, URL, json, subprocess):
    """
    Step 1: Capture screenshot and extract rendered code
    
    This would typically use Playwright in a real scenario.
    Here we demonstrate the concept.
    """
    # Create Node.js script for multi-modal validation
    node_script = f"""
    import {{ multiModalValidation }} from 'ai-browser-test';
    import {{ chromium }} from 'playwright';
    
    async function run() {{
        const browser = await chromium.launch();
        const page = await browser.newPage();
        
        try {{
            await page.goto('{URL}');
            
            const result = await multiModalValidation(
                async (imagePath, prompt, context) => {{
                    // This would use validateScreenshot internally
                    return {{ score: 0.85, issues: [] }};
                }},
                page,
                'homepage-test',
                {{
                    testType: 'homepage',
                    viewport: {{ width: 1280, height: 720 }}
                }}
            );
            
            console.log(JSON.stringify(result, null, 2));
        }} finally {{
            await browser.close();
        }}
    }}
    
    run().catch(console.error);
    """
    
    # In a real scenario, you would:
    # 1. Write the script to a file
    # 2. Run it with Node.js
    # 3. Parse the JSON output
    
    print("📝 Multi-modal validation script created")
    print("   (In production, this would execute and return results)")
    
    # Mock result for demonstration
    mock_result = {{
        "screenshot": {{
            "score": 0.85,
            "issues": ["Minor contrast issue"]
        }},
        "renderedCode": {{
            "html": "<html>...</html>",
            "css": "body {{ ... }}",
            "domStructure": "html > body > ..."
        }},
        "multiModal": {{
            "score": 0.88,
            "issues": [],
            "assessment": "Good overall, minor improvements needed"
        }}
    }}
    
    return mock_result, node_script


@app.cell
def __(mock_result):
    """
    Step 2: Display multi-modal results
    """
    import marimo as mo
    
    result = mock_result
    
    mo.md(f"""
    ## Multi-Modal Validation Results
    
    ### Screenshot Validation
    - **Score:** {result["screenshot"]["score"]:.2f}/1.0
    - **Issues:** {len(result["screenshot"]["issues"])}
    
    ### Rendered Code Analysis
    - **HTML:** Extracted ({len(result["renderedCode"]["html"])} chars)
    - **CSS:** Extracted ({len(result["renderedCode"]["css"])} chars)
    - **DOM Structure:** Analyzed
    
    ### Combined Multi-Modal Score
    - **Score:** {result["multiModal"]["score"]:.2f}/1.0
    - **Assessment:** {result["multiModal"]["assessment"]}
    """)
    
    return mo, result


@app.cell
def __(result):
    """
    Step 3: Detailed analysis
    """
    import marimo as mo
    
    # Display issues
    if result["screenshot"]["issues"]:
        mo.md(f"""
        ### Screenshot Issues
        
        {chr(10).join(f"- {issue}" for issue in result["screenshot"]["issues"])}
        """)
    
    # Display rendered code preview
    mo.md(f"""
    ### Rendered Code Preview
    
    **HTML Structure:**
    ```html
    {result["renderedCode"]["html"][:200]}...
    ```
    
    **CSS:**
    ```css
    {result["renderedCode"]["css"][:200]}...
    ```
    """)
    
    return mo,


@app.cell
def __():
    """
    Benefits of Multi-Modal Validation
    
    1. **Visual + Code**: Catches issues in both appearance and implementation
    2. **Context-Aware**: Understands the relationship between code and visual output
    3. **Comprehensive**: Validates accessibility, design, and code quality together
    4. **Actionable**: Provides specific feedback on what to fix
    """
    return

