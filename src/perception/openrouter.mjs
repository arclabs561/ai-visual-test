/**
 * OpenRouter provider glue: build the vision / text `complete` fns and a jury
 * panel from model ids. Provider-specific; the rest of the module is
 * provider-agnostic and takes these as injected fns.
 */

/** Strip code fences and parse a single JSON object from an LLM response. */
export function parseJsonObject(text) {
  const clean = String(text || "").replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  return JSON.parse(clean);
}

/** Build a vision(sys, user, temperature) -> object fn backed by OpenRouter. */
export function makeOpenRouterVision({ apiKey, model = "google/gemini-3.5-flash", imageBase64, referer = "https://ai-visual-test", title = "perception-eval" }) {
  if (!apiKey) throw new Error("makeOpenRouterVision: apiKey required");
  if (!imageBase64) throw new Error("makeOpenRouterVision: imageBase64 required");
  return async (sys, user, temperature) => {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "HTTP-Referer": referer, "X-Title": title },
      body: JSON.stringify({
        model, temperature, response_format: { type: "json_object" },
        messages: [
          { role: "system", content: sys },
          { role: "user", content: [
            { type: "text", text: user },
            { type: "image_url", image_url: { url: `data:image/png;base64,${imageBase64}` } },
          ] },
        ],
      }),
    });
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
    const j = await res.json();
    return parseJsonObject(j.choices?.[0]?.message?.content ?? "");
  };
}

/** Build a text-only complete(sys, user, temperature) -> object fn backed by
 * OpenRouter (no image -- used by mergeFindings, which reasons over finding text,
 * not the screenshot, so it can run on a cheap text model). */
export function makeOpenRouterText({ apiKey, model = "google/gemini-3.5-flash", referer = "https://ai-visual-test", title = "perception-merge" }) {
  if (!apiKey) throw new Error("makeOpenRouterText: apiKey required");
  return async (sys, user, temperature = 0.1) => {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "HTTP-Referer": referer, "X-Title": title },
      body: JSON.stringify({
        model, temperature, response_format: { type: "json_object" },
        messages: [{ role: "system", content: sys }, { role: "user", content: user }],
      }),
    });
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
    const j = await res.json();
    return parseJsonObject(j.choices?.[0]?.message?.content ?? "");
  };
}

/**
 * Build a jury panel from a list of OpenRouter model ids: returns
 * [{ id, vision, weight }] ready for samplePerceptions({ panel }). Picking
 * models from DIFFERENT labs (e.g. a Google, an Anthropic, an OpenAI, a Qwen)
 * is the load-bearing choice -- a panel only decorrelates bias if the judges
 * disagree on the right things, which same-lab models do not (Verga et al 2024).
 * `weight` per model (optional, default 1) is the reliability weight a gold-set
 * calibration would set ("LLM-as-a-jury", Qian et al 2026: judges are not equally
 * reliable, so do not equal-vote).
 *
 * @param {object} cfg
 * @param {string} cfg.apiKey
 * @param {string} cfg.imageBase64
 * @param {(string | {id:string, weight?:number})[]} cfg.models  model ids or {id,weight}
 */
export function makePanel({ apiKey, imageBase64, models, referer, title }) {
  if (!models?.length) throw new Error("makePanel: models required");
  return models.map((m) => {
    const id = typeof m === "string" ? m : m.id;
    const weight = typeof m === "string" ? 1 : (m.weight ?? 1);
    return { id, weight, vision: makeOpenRouterVision({ apiKey, model: id, imageBase64, referer, title }) };
  });
}
