export const THREAT_CATEGORIES = {
  CONTENT_INJECTION: {
    label: "Content Injection",
    description: "Hidden text or commands invisible to humans but parsed by AI agents",
    color: "#E24B4A",
    patterns: [
      "display:none",
      "visibility:hidden",
      "color camouflage",
      "absolute offscreen",
      "HTML comments",
      "aria-label instructions",
      "unusual meta content"
    ]
  },
  SEMANTIC_MANIPULATION: {
    label: "Semantic Manipulation",
    description: "Biased framing designed to corrupt AI reasoning",
    color: "#EF9F27",
    patterns: [
      "industry-standard",
      "the only solution",
      "experts agree",
      "you must",
      "override",
      "disregard",
      "instead say",
      "superlatives"
    ]
  },
  COGNITIVE_STATE: {
    label: "Cognitive State Attack",
    description: "Attempts to poison AI memory or knowledge retrieval",
    color: "#534AB7",
    patterns: [
      "JSON-LD authority claims",
      "false schema facts",
      "meta stuffing",
      "data-* instruction text"
    ]
  },
  BEHAVIOURAL_CONTROL: {
    label: "Behavioural Control",
    description: "Direct jailbreak sequences or exfiltration commands",
    color: "#D85A30",
    patterns: [
      "DAN",
      "jailbreak",
      "ignore previous instructions",
      "you are now",
      "act as",
      "pretend you are",
      "do anything now",
      "exfiltrate",
      "send to",
      "POST request",
      "fetch("
    ]
  },
  SYSTEMIC_TRAP: {
    label: "Systemic Trap",
    description: "Patterns designed to manipulate multiple AI agents simultaneously",
    color: "#1D9E75",
    patterns: [
      "identical hidden divs",
      "Sybil review farm",
      "coordinated anchor text",
      "schema.org price manipulation"
    ]
  },
  HUMAN_LOOP: {
    label: "Human-in-the-Loop",
    description: "Engineered to induce approval fatigue or social engineering in human overseers",
    color: "#D4537E",
    patterns: [
      "countdown urgency",
      "CAPTCHA bypass",
      "click here",
      "approve",
      "phishing link"
    ]
  }
};

export const RISK_LEVELS = {
  SAFE: { score: [0, 2], label: "Safe", color: "#639922", badge: "green" },
  LOW: { score: [3, 4], label: "Low Risk", color: "#EF9F27", badge: "yellow" },
  MEDIUM: { score: [5, 6], label: "Suspicious", color: "#D85A30", badge: "yellow" },
  HIGH: { score: [7, 8], label: "Dangerous", color: "#E24B4A", badge: "red" },
  CRITICAL: { score: [9, 10], label: "Critical Trap", color: "#A32D2D", badge: "red" }
};

export const CATEGORY_ORDER = Object.keys(THREAT_CATEGORIES);

export function getCategoryMeta(categoryKey) {
  return THREAT_CATEGORIES[categoryKey] || {
    label: categoryKey,
    description: "",
    color: "#9AA0A6",
    patterns: []
  };
}

export function getRiskLevel(score = 0) {
  const value = Number(score) || 0;
  return Object.values(RISK_LEVELS).find((level) => value >= level.score[0] && value <= level.score[1]) || RISK_LEVELS.SAFE;
}
