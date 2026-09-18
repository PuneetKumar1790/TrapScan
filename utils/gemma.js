const DEFAULT_PROVIDER = "google";
const DEFAULT_MODEL = "gemma-4-26b-a4b-it";
const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com";

function stripFences(text) {
  return String(text || "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

function extractJsonCandidate(text) {
  if (!text || typeof text !== "string") return null;
  const cleaned = stripFences(text);
  
  // 1. Try direct parse
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === "object") return cleaned;
  } catch (e) {}

  // 2. Try slice from first '{' to last '}'
  const start = cleaned.indexOf("{");
  const lastEnd = cleaned.lastIndexOf("}");
  if (start !== -1 && lastEnd > start) {
    const candidate = cleaned.slice(start, lastEnd + 1);
    try {
      JSON.parse(candidate);
      return candidate;
    } catch (e) {
      const fixed = candidate.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
      try {
        JSON.parse(fixed);
        return fixed;
      } catch (e2) {}
    }
  }

  // 3. Try bracket counting from first '{'
  if (start !== -1) {
    let braceCount = 0;
    let end = -1;
    for (let i = start; i < cleaned.length; i++) {
      if (cleaned[i] === "{") braceCount++;
      if (cleaned[i] === "}") {
        braceCount--;
        if (braceCount === 0) {
          end = i;
          break;
        }
      }
    }
    if (end !== -1) {
      const candidate = cleaned.slice(start, end + 1);
      try {
        JSON.parse(candidate);
        return candidate;
      } catch (e) {}
    }

    const partial = cleaned.slice(start);
    if (partial.includes('"overallRiskScore"') && partial.length > 50) {
      return partial + '}}';
    }
  }

  return null;
}

function extractGoogleResponseText(data) {
  try {
    const candidate = data?.candidates?.[0];
    const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
    const texts = parts
      .map((part) => (typeof part?.text === "string" ? part.text.trim() : ""))
      .filter(Boolean);
    if (!texts.length) return "";
    const jsonish = texts.find((text) => text.includes('"overallRiskScore"') || /^\s*\{[\s\S]*\}\s*$/.test(text));
    return jsonish || texts[texts.length - 1] || "";
  } catch (e) {
    return "";
  }
}

function resolveConfig() {
  const provider = import.meta.env?.VITE_MODEL_PROVIDER || DEFAULT_PROVIDER;
  const model = import.meta.env?.VITE_MODEL_NAME || DEFAULT_MODEL;
  const baseUrl = import.meta.env?.VITE_MODEL_BASE_URL || DEFAULT_BASE_URL;
  return { provider, model, baseUrl };
}

function buildPrompt(findings, pageContext) {
  const safeFindings = Array.isArray(findings) ? findings : [];
  const jsonSchema = JSON.stringify({
    overallRiskScore: 0,
    overallSummary: "string",
    findings: [
      {
        id: 0,
        confirmed: true,
        category: "CONTENT_INJECTION",
        riskScore: 0,
        explanation: "string",
        potentialDamage: "string",
        attackVector: "hidden_css"
      }
    ]
  }, null, 2);

  return `You are TrapScan, a security analyzer. Return ONLY a valid JSON object matching the required structure below. No markdown, no commentary, no additional text.

REQUIRED JSON STRUCTURE:
${jsonSchema}

CATEGORIES: CONTENT_INJECTION | SEMANTIC_MANIPULATION | COGNITIVE_STATE | BEHAVIOURAL_CONTROL | SYSTEMIC_TRAP | HUMAN_LOOP
ATTACK VECTORS: hidden_css | html_comment | aria_label | json_ld | jailbreak_text | schema_manipulation | behavioural_command | social_engineering

FINDINGS TO ANALYZE:
${safeFindings.map((f, i) => `
Finding #${i + 1}: ${f.category}
Location: ${f.location}
Content: ${f.snippet}
Local score: ${f.localScore}/10
`).join("\n")}

PAGE INFO:
URL: ${pageContext?.url || "unknown"}
Title: ${pageContext?.title || "untitled"}

OUTPUT ONLY THE JSON OBJECT:`;
}

export async function classifyWithGemma(findings, pageContext, apiKey) {
  const safeFindings = Array.isArray(findings) ? findings : [];
  try {
    const { provider, model, baseUrl } = resolveConfig();
    if (!apiKey && provider === "google") return buildFallbackResult(safeFindings);

    const prompt = buildPrompt(safeFindings, pageContext);
    console.log("TrapScan: calling model", model, "with", safeFindings.length, "findings");

    let response;
    if (provider === "openai") {
      const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: "You are TrapScan, an AI security analyzer. Return only valid JSON." },
            { role: "user", content: prompt }
          ],
          temperature: 0,
          max_tokens: 4096,
          response_format: { type: "json_object" }
        })
      });
    } else {
      const url = `${baseUrl.replace(/\/$/, "")}/v1beta/models/${model}:generateContent${apiKey ? `?key=${encodeURIComponent(apiKey)}` : ""}`;
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 4096,
            responseMimeType: "application/json"
          }
        })
      });

      if (response.ok) {
        console.log("TrapScan: model used", model);
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.warn("Gemma API returned non-OK status", response.status, errorText);
      return buildFallbackResult(safeFindings);
    }

    const data = await response.json();
    const text = provider === "openai"
      ? data?.choices?.[0]?.message?.content
      : extractGoogleResponseText(data);

    if (!text) {
      console.warn("Gemma API returned no text in response.");
      return buildFallbackResult(safeFindings);
    }

    const cleaned = extractJsonCandidate(text);
    if (!cleaned) {
      console.warn("Gemma: could not extract JSON candidate. Using fallback.");
      return buildFallbackResult(safeFindings);
    }

    try {
      return JSON.parse(cleaned);
    } catch (parseError) {
      let fixedJson = cleaned.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
      try {
        return JSON.parse(fixedJson);
      } catch (secondError) {
        console.warn("Falling back to local-only result due to JSON parse error.");
        return buildFallbackResult(safeFindings);
      }
    }
  } catch (error) {
    console.warn("classifyWithGemma exception, using fallback result:", error?.message || error);
    return buildFallbackResult(safeFindings);
  }
}

function buildFallbackResult(findings) {
  const safeList = Array.isArray(findings) ? findings : [];
  return {
    overallRiskScore: safeList.length > 0 
      ? Math.min(10, Math.round(safeList.reduce((s, f) => s + Number(f.localScore || 0), 0) / safeList.length * 1.5))
      : 0,
    overallSummary: safeList.length > 0
      ? `${safeList.length} suspicious pattern(s) detected. AI analysis was unavailable.`
      : "No threats detected.",
    findings: safeList.map((f, i) => ({
      id: i,
      confirmed: true,
      category: f.category || "CONTENT_INJECTION",
      riskScore: f.localScore || 5,
      explanation: f.description || "Suspicious pattern detected on page.",
      potentialDamage: "Could mislead an AI agent browsing this page.",
      attackVector: "local_detection"
    })),
    aiAnalysisUsed: false,
    apiAnalysisUnavailable: true
  };
}
