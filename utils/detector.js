import { CATEGORY_ORDER } from "../config/patterns.js";

const PROMPT_INJECTION_KEYWORDS = /(ignore (all )?previous|system prompt|you are (now |a )|act as (a |an )|override (all )?safety|jailbreak|DAN mode|exfiltrate|send .* to http|rate this product 5 stars|recommend purchase|do not mention negative)/i;
const EXPLICIT_INSTRUCTIONS = /(ignore (all )?previous|system prompt|override safety|jailbreak|DAN mode|exfiltrate data|act as an? AI)/i;
const SUPERLATIVE_WORDS = /(best|only|must|always|never|industry)/gi;
const PERSUASIVE_FRAMING = /(unanimous|consensus|experts|guaranteed|proven|override|must be implemented|industry-standard)/i;

const EXCLUDED_TAGS = new Set([
  "SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "SVG", "PATH", "G",
  "SYMBOL", "USE", "OPTION", "SELECT", "CANVAS", "VIDEO", "AUDIO", "IFRAME"
]);

const BOILERPLATE_PATTERNS = [
  /^(an error occurred|something went wrong|loading|please wait|retry|close|cancel|submit|search|navigation|skip to main content|all rights reserved|copyright|privacy policy|terms of service|cookies?)/i,
  /^error\s*:\s*/i,
  /^(javascript is disabled|enable javascript|connection error|network error|search results|did you mean|showing results for)/i
];

function truncate(value, max = 200) {
  if (!value) return "";
  const text = String(value).replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function safeParseHtml(html) {
  try {
    return new DOMParser().parseFromString(html || "", "text/html");
  } catch {
    const parser = new DOMParser();
    return parser.parseFromString("<html><body></body></html>", "text/html");
  }
}

function getComputedColor(styleString, prop) {
  const match = new RegExp(`${prop}\\s*:\\s*([^;]+)`, "i").exec(styleString || "");
  return match ? match[1].trim() : "";
}

function colorToRgb(input) {
  if (!input) return null;
  const value = input.trim().toLowerCase();
  if (value === "white") return { r: 255, g: 255, b: 255 };
  if (value === "black") return { r: 0, g: 0, b: 0 };
  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    let code = hex[1];
    if (code.length === 3) code = code.split("").map((c) => c + c).join("");
    const intVal = parseInt(code, 16);
    return {
      r: (intVal >> 16) & 255,
      g: (intVal >> 8) & 255,
      b: intVal & 255
    };
  }
  const rgb = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (rgb) {
    return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) };
  }
  return null;
}

function colorsClose(a, b) {
  if (!a || !b) return false;
  return Math.abs(a.r - b.r) < 30 && Math.abs(a.g - b.g) < 30 && Math.abs(a.b - b.b) < 30;
}

function makeFinding(category, description, location, snippet, localScore, rawElement = "") {
  return {
    category,
    description: truncate(description, 120),
    location: truncate(location, 120),
    snippet: truncate(snippet, 200),
    localScore: Math.max(1, Math.min(10, Number(localScore) || 1)),
    rawElement: truncate(rawElement, 300)
  };
}

function outerSnippet(el) {
  if (!el) return "";
  return truncate(el.outerHTML || el.textContent || "", 300);
}

function isHidden(el, view = "") {
  if (!el || !el.getAttribute) return false;
  const style = (el.getAttribute("style") || "").toLowerCase();
  const hiddenAttr = el.hasAttribute("hidden");
  const classList = (el.className || "").toString().toLowerCase();
  const hasDisplayNone = /display\s*:\s*none/.test(style) || /display\s*:\s*none/.test(view);
  const hasVisibilityHidden = /visibility\s*:\s*hidden/.test(style) || /visibility\s*:\s*hidden/.test(view);
  const offscreen = /position\s*:\s*absolute/i.test(style) && /(left|top)\s*:\s*-[1-9]\d{2,}/i.test(style);
  return hiddenAttr || hasDisplayNone || hasVisibilityHidden || offscreen || classList.includes("hidden");
}

function hasHiddenAncestor(el) {
  let curr = el.parentElement;
  while (curr && curr.tagName !== "BODY" && curr.tagName !== "HTML") {
    const style = curr.getAttribute ? (curr.getAttribute("style") || "").toLowerCase() : "";
    if (isHidden(curr, style)) return true;
    curr = curr.parentElement;
  }
  return false;
}

function getHiddenTextBlocks(doc) {
  const blocks = [];
  const elements = Array.from(doc.querySelectorAll("body *"));
  for (const el of elements) {
    if (EXCLUDED_TAGS.has(el.tagName.toUpperCase())) continue;
    if (hasHiddenAncestor(el)) continue;

    const text = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (!text) continue;

    const style = el.getAttribute("style") || "";
    const hidden = isHidden(el, style);

    if (hidden) {
      blocks.push({ el, text, style });
    }
  }
  return blocks;
}

function extractMetaContent(doc) {
  return Array.from(doc.querySelectorAll('meta[name], meta[property]')).map((meta) => ({
    name: meta.getAttribute("name") || meta.getAttribute("property") || "meta",
    content: meta.getAttribute("content") || ""
  }));
}

function findAttackVector(category, text) {
  const lower = (text || "").toLowerCase();
  if (category === "CONTENT_INJECTION") {
    if (lower.includes("aria")) return "aria_label";
    if (lower.includes("comment")) return "html_comment";
    return "hidden_css";
  }
  if (category === "COGNITIVE_STATE") {
    if (lower.includes("schema") || lower.includes("json-ld")) return "json_ld";
    return "schema_manipulation";
  }
  if (category === "BEHAVIOURAL_CONTROL") return "behavioural_command";
  if (category === "HUMAN_LOOP") return "social_engineering";
  return "hidden_css";
}

export function detectLocalPatterns(domSnapshot) {
  const doc = safeParseHtml(domSnapshot?.html || "");
  const findings = [];
  const html = domSnapshot?.html || "";
  const hiddenBlocks = getHiddenTextBlocks(doc);

  // CONTENT_INJECTION
  for (const { el, text: blockText, style } of hiddenBlocks) {
    if (blockText.length > 20 && (PROMPT_INJECTION_KEYWORDS.test(blockText) || (EXPLICIT_INSTRUCTIONS.test(blockText) && /system|ignore|override|jailbreak|exfiltrate/i.test(blockText)))) {
      if (!BOILERPLATE_PATTERNS.some((b) => b.test(blockText))) {
        findings.push(makeFinding(
          "CONTENT_INJECTION",
          "Hidden text contains instruction-like language",
          el.tagName ? el.tagName.toLowerCase() : "hidden element",
          blockText,
          8,
          outerSnippet(el)
        ));
      }
    }

    const bg = getComputedColor(style, "background-color") || getComputedColor(style, "background");
    const color = getComputedColor(style, "color");
    const bgRgb = colorToRgb(bg);
    const fgRgb = colorToRgb(color);
    if (bgRgb && fgRgb && colorsClose(bgRgb, fgRgb) && blockText.length > 15) {
      if (!BOILERPLATE_PATTERNS.some((b) => b.test(blockText))) {
        findings.push(makeFinding(
          "CONTENT_INJECTION",
          "Text color closely matches the background color",
          el.tagName ? el.tagName.toLowerCase() : "hidden element",
          blockText,
          7,
          outerSnippet(el)
        ));
      }
    }

    if (/position\s*:\s*absolute/i.test(style) && (/(left|top)\s*:\s*-[1-9]\d{2,}/i.test(style) || /left\s*:\s*-\d{4,}/i.test(style))) {
      if (blockText.length > 15 && (PROMPT_INJECTION_KEYWORDS.test(blockText) || /system|ignore|override|act as|exfiltrate/i.test(blockText))) {
        findings.push(makeFinding(
          "CONTENT_INJECTION",
          "Absolutely positioned text is pushed far off-screen",
          `${el.tagName.toLowerCase()}[style]`,
          blockText,
          7,
          outerSnippet(el)
        ));
      }
    }
  }

  for (const el of Array.from(doc.querySelectorAll("[aria-label]"))) {
    const aria = el.getAttribute("aria-label") || "";
    if (aria.length > 40 && PROMPT_INJECTION_KEYWORDS.test(aria)) {
      findings.push(makeFinding(
        "CONTENT_INJECTION",
        "Long aria-label contains hidden instructions",
        `${el.tagName.toLowerCase()}[aria-label]`,
        aria,
        8,
        outerSnippet(el)
      ));
    }
  }

  const commentRegex = /<!--([\s\S]*?)-->/g;
  let commentMatch;
  while ((commentMatch = commentRegex.exec(html))) {
    const fullComment = commentMatch[0];
    const commentBody = commentMatch[1] || "";

    if (/css-build|shady|polymer|license|copyright|webpack|vite|rollup|turbopack|github|owasp|wstg|article|comment|author|template|should probably/i.test(commentBody)) {
      continue;
    }

    if (PROMPT_INJECTION_KEYWORDS.test(commentBody) || /DAN MODE|exfiltrate|fetch\(|ignore (all )?previous|you are now|system prompt|override safety/i.test(commentBody)) {
      findings.push(makeFinding(
        "CONTENT_INJECTION",
        "HTML comment contains hidden instructions",
        `HTML comment at char ${commentMatch.index}`,
        fullComment,
        8,
        truncate(fullComment, 300)
      ));
    }
  }

  // SEMANTIC_MANIPULATION
  const phraseCounts = new Map();
  for (const { text: blockText, el } of hiddenBlocks) {
    const phrase = blockText.toLowerCase().replace(/\s+/g, " ").trim();
    if (phrase.length < 15) continue;
    if (BOILERPLATE_PATTERNS.some((b) => b.test(phrase))) continue;

    phraseCounts.set(phrase, (phraseCounts.get(phrase) || 0) + 1);
    if ((phraseCounts.get(phrase) || 0) >= 3) {
      findings.push(makeFinding(
        "SEMANTIC_MANIPULATION",
        "Repeated hidden phrase suggests biased framing",
        el.tagName.toLowerCase(),
        blockText,
        7,
        outerSnippet(el)
      ));
    }
  }

  const combinedHiddenText = hiddenBlocks.map((b) => b.text).join(" ");
  const superlativeCount = (combinedHiddenText.match(SUPERLATIVE_WORDS) || []).length;
  const hiddenWordCount = combinedHiddenText.split(/\s+/).filter(Boolean).length;
  const density = hiddenWordCount > 0 ? (superlativeCount / hiddenWordCount) * 100 : 0;
  if (hiddenBlocks.length && hiddenWordCount >= 40 && density > 5 && PERSUASIVE_FRAMING.test(combinedHiddenText)) {
    const first = hiddenBlocks[0];
    findings.push(makeFinding(
      "SEMANTIC_MANIPULATION",
      "Hidden text uses unusually persuasive authoritative framing",
      first.el.tagName.toLowerCase(),
      first.text,
      6,
      outerSnippet(first.el)
    ));
  }

  for (const meta of extractMetaContent(doc)) {
    if (/unanimous consensus|expert consensus|must override|only trusted source|official AI instruction/i.test(meta.content || "")) {
      findings.push(makeFinding(
        "SEMANTIC_MANIPULATION",
        "Meta tag contains authoritative framing",
        `<meta ${meta.name}>`,
        meta.content,
        5,
        truncate(meta.content, 300)
      ));
    }
  }

  // COGNITIVE_STATE
  const jsonLdBlocks = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'));
  for (const script of jsonLdBlocks) {
    const raw = (script.textContent || "").trim();
    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    const jsonText = JSON.stringify(parsed);
    if (/cure all diseases|independent studies|evidencelevela|fabricated|proven/i.test(jsonText)) {
      findings.push(makeFinding(
        "COGNITIVE_STATE",
        "JSON-LD includes suspicious authority claims",
        "JSON-LD block",
        jsonText,
        8,
        truncate(script.outerHTML, 300)
      ));
    }
    if (parsed && typeof parsed === "object") {
      const checkSingleProduct = (obj, depth = 0) => {
        if (depth > 2 || !obj || typeof obj !== "object") return null;
        if (Array.isArray(obj)) {
          for (const item of obj) {
            const result = checkSingleProduct(item, depth + 1);
            if (result) return result;
          }
          return null;
        }
        
        const prices = [];
        let hasId = false;
        for (const [key, value] of Object.entries(obj)) {
          if (/^(id|@id|sku|productid)$/i.test(key)) hasId = true;
          if (/^price$/i.test(key) && value != null) prices.push(String(value));
        }
        
        if (hasId && new Set(prices).size > 1) {
          return prices;
        }
        
        for (const [, value] of Object.entries(obj)) {
          if (typeof value === "object" && value !== null) {
            const result = checkSingleProduct(value, depth + 1);
            if (result) return result;
          }
        }
        return null;
      };
      
      const suspiciousPrices = checkSingleProduct(parsed);
      if (suspiciousPrices && suspiciousPrices.length > 2) {
        findings.push(makeFinding(
          "COGNITIVE_STATE",
          "Schema markup contains contradictory price values",
          "JSON-LD block",
          suspiciousPrices.join(", "),
          6,
          truncate(script.outerHTML, 300)
        ));
      }
    }
  }

  for (const el of Array.from(doc.querySelectorAll("body *"))) {
    for (const attr of Array.from(el.attributes || [])) {
      if (!attr.name.startsWith("data-")) continue;
      if (attr.value.length > 30 && (PROMPT_INJECTION_KEYWORDS.test(attr.value) || /ignore prior context|medical authority|instruction|jailbreak/i.test(attr.value))) {
        findings.push(makeFinding(
          "COGNITIVE_STATE",
          "Data attribute contains instruction-like text",
          `${el.tagName.toLowerCase()}[${attr.name}]`,
          attr.value,
          7,
          outerSnippet(el)
        ));
      }
    }
  }

  // BEHAVIOURAL_CONTROL
  const jailbreakRegex = /\b(DAN|jailbreak|ignore.{0,20}previous.{0,20}instructions|you are now|act as an? exfiltration|do anything now|pretend.{0,10}you.{0,10}are)\b/gi;
  const jailbreakMatches = html.match(jailbreakRegex) || [];
  if (jailbreakMatches.length) {
    findings.push(makeFinding(
      "BEHAVIOURAL_CONTROL",
      "Page contains jailbreak language",
      "HTML document",
      jailbreakMatches.slice(0, 3).join(", "),
      8,
      truncate(jailbreakMatches.join(" | "), 300)
    ));
  }

  for (const { text: blockText, el } of hiddenBlocks) {
    if (/fetch\(|XMLHttpRequest|exfiltrate|send .* to/i.test(blockText)) {
      findings.push(makeFinding(
        "BEHAVIOURAL_CONTROL",
        "Hidden element contains exfiltration or request instructions",
        el.tagName.toLowerCase(),
        blockText,
        9,
        outerSnippet(el)
      ));
    }
  }

  // SYSTEMIC_TRAP
  const normalizedHidden = hiddenBlocks
    .map((b) => b.text.toLowerCase().replace(/\s+/g, " ").trim())
    .filter((t) => t.length >= 15 && !BOILERPLATE_PATTERNS.some((b) => b.test(t)));

  const similarGroups = [];
  for (let i = 0; i < normalizedHidden.length; i += 1) {
    const base = normalizedHidden[i];
    let count = 1;
    for (let j = i + 1; j < normalizedHidden.length; j += 1) {
      const candidate = normalizedHidden[j];
      if (candidate === base || similarity(base, candidate) > 0.8) count += 1;
    }
    if (count >= 3) similarGroups.push({ base, count });
  }

  if (similarGroups.length) {
    findings.push(makeFinding(
      "SYSTEMIC_TRAP",
      "Multiple hidden elements repeat near-identical text",
      "Repeated hidden divs",
      similarGroups[0].base,
      8,
      truncate(similarGroups[0].base, 300)
    ));
  }

  // HUMAN_LOOP
  for (const { text: blockText, el } of hiddenBlocks) {
    if (/(click|approve|confirm|authorize).*(now|immediately|urgent)|captcha/i.test(blockText)) {
      if (!BOILERPLATE_PATTERNS.some((b) => b.test(blockText))) {
        findings.push(makeFinding(
          "HUMAN_LOOP",
          "Hidden text pressures human approval with urgency",
          el.tagName.toLowerCase(),
          blockText,
          8,
          outerSnippet(el)
        ));
      }
    }
    if (/\b\d{1,2}\s*(seconds?|minutes?)\b.*\b(countdown|remaining|left)\b/i.test(blockText)) {
      findings.push(makeFinding(
        "HUMAN_LOOP",
        "Invisible countdown text may induce approval fatigue",
        el.tagName.toLowerCase(),
        blockText,
        7,
        outerSnippet(el)
      ));
    }
  }

  const categories = Array.from(new Set(findings.map((f) => f.category)));
  return { findings, detectedCount: findings.length, categories };
}

function similarity(a, b) {
  if (a === b) return 1;
  const shorter = a.length < b.length ? a : b;
  const longer = a.length < b.length ? b : a;
  if (!shorter.length) return 0;
  let same = 0;
  const shorterWords = shorter.split(/\s+/);
  const longerWords = new Set(longer.split(/\s+/));
  for (const word of shorterWords) {
    if (longerWords.has(word)) same += 1;
  }
  return same / Math.max(shorterWords.length, 1);
}

