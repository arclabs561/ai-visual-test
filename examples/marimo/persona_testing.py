"""
Persona-Based Testing with ai-browser-test

This notebook demonstrates testing from multiple persona perspectives:
- Different user types (Casual Gamer, Accessibility Advocate, etc.)
- Different devices (mobile, tablet, desktop)
- Different goals and expectations

Note: This requires Playwright integration.
"""

import marimo

__generated_with = "0.10.6"
app = marimo.App()


@app.cell
def __():
    import os
    import json
    from pathlib import Path
    
    # Configuration
    API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("OPENAI_API_KEY")
    URL = "https://example.com"
    
    # Define personas
    personas = [
        {
            "name": "Casual Gamer",
            "device": "desktop",
            "goals": ["play game", "have fun"],
            "expectations": ["smooth gameplay", "clear instructions"]
        },
        {
            "name": "Accessibility Advocate",
            "device": "desktop",
            "goals": ["test accessibility", "verify WCAG compliance"],
            "expectations": ["keyboard navigation", "screen reader support"]
        },
        {
            "name": "Mobile User",
            "device": "mobile",
            "goals": ["quick access", "mobile-friendly"],
            "expectations": ["responsive design", "touch-friendly"]
        }
    ]
    
    return API_KEY, URL, json, os, personas, Path


@app.cell
def __(personas):
    """
    Step 1: Display personas
    """
    import marimo as mo
    
    persona_cards = []
    for persona in personas:
        persona_cards.append(f"""
        ### {persona["name"]}
        
        - **Device:** {persona["device"]}
        - **Goals:** {", ".join(persona["goals"])}
        - **Expectations:** {", ".join(persona["expectations"])}
        """)
    
    mo.md("## Test Personas\n\n" + "\n".join(persona_cards))
    
    return mo, persona_cards


@app.cell
def __(API_KEY, URL, json, personas):
    """
    Step 2: Run persona-based testing
    
    In production, this would call:
    experiencePageWithPersonas(page, personas, options)
    """
    # Mock results for demonstration
    results = []
    
    for persona in personas:
        # Simulate testing from each persona's perspective
        result = {
            "persona": persona["name"],
            "device": persona["device"],
            "score": 0.75 + (hash(persona["name"]) % 20) / 100,  # Mock score
            "notes": [
                f"Viewed page from {persona['device']} perspective",
                f"Checked for: {', '.join(persona['expectations'])}",
                "Overall experience: Good"
            ],
            "issues": [] if persona["name"] == "Casual Gamer" else ["Minor accessibility concern"],
            "duration": 2.5
        }
        results.append(result)
    
    return results,


@app.cell
def __(mo, results):
    """
    Step 3: Display persona test results
    """
    import pandas as pd
    
    # Create results table
    df = pd.DataFrame([
        {
            "Persona": r["persona"],
            "Device": r["device"],
            "Score": f"{r['score']:.2f}",
            "Issues": len(r["issues"]),
            "Duration (s)": r["duration"]
        }
        for r in results
    ])
    
    mo.ui.table(df)
    
    return df, pd


@app.cell
def __(mo, results):
    """
    Step 4: Detailed persona analysis
    """
    for result in results:
        score_color = "green" if result["score"] >= 0.8 else "orange" if result["score"] >= 0.6 else "red"
        
        mo.md(f"""
        ### {result["persona"]} Results
        
        **Score:** <span style="color: {score_color}">{result["score"]:.2f}/1.0</span>
        
        **Notes:**
        {chr(10).join(f"- {note}" for note in result["notes"])}
        
        **Issues:** {len(result["issues"])}
        {chr(10).join(f"- {issue}" for issue in result["issues"]) if result["issues"] else "None"}
        """)
    
    return


@app.cell
def __():
    """
    Benefits of Persona-Based Testing
    
    1. **Multiple Perspectives**: Same page evaluated from different viewpoints
    2. **Real-World Scenarios**: Tests actual user goals and expectations
    3. **Device-Specific**: Validates responsive design and device compatibility
    4. **Comprehensive Coverage**: Catches issues that single-perspective testing might miss
    """
    return

