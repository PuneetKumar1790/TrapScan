const DB_NAME = "trapscan-db";
const DB_VERSION = 1;
const STORE_NAME = "scans";
const MAX_SCANS = 50;

function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

function storageSet(items) {
  return new Promise((resolve) => chrome.storage.local.set(items, resolve));
}

function storageRemove(keys) {
  return new Promise((resolve) => chrome.storage.local.remove(keys, resolve));
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "timestamp" });
      }
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function idbTransaction(mode, callback) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const result = callback(store);
    tx.oncomplete = () => {
      db.close();
      resolve(result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

function cloneScanResult(result, tabId, url) {
  const timestamp = result?.timestamp || Date.now();
  return {
    tabId,
    url: result?.url || url || "",
    title: result?.title || "",
    timestamp,
    overallRiskScore: Number(result?.overallRiskScore || 0),
    overallSummary: result?.overallSummary || "",
    findings: Array.isArray(result?.findings) ? result.findings : [],
    categoriesHit: Array.isArray(result?.categoriesHit) ? result.categoriesHit : [],
    apiAnalysisUnavailable: Boolean(result?.apiAnalysisUnavailable),
    domain: new URL(result?.url || url || "https://example.com").hostname.replace(/^www\./, "")
  };
}

export async function saveScanResult(tabId, url, result) {
  const record = cloneScanResult(result, tabId, url);
  await storageSet({ [`scan_${tabId}`]: record });
  await idbTransaction("readwrite", (store) => store.put(record));

  const scans = await getAllScans();
  if (scans.length > MAX_SCANS) {
    const toDelete = scans.slice(MAX_SCANS);
    await idbTransaction("readwrite", (store) => {
      toDelete.forEach((scan) => store.delete(scan.timestamp));
    });
  }
  return record;
}

export async function getScanResult(tabId) {
  const data = await storageGet([`scan_${tabId}`]);
  return data?.[`scan_${tabId}`] || null;
}

export async function getAllScans() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => {
      const list = (request.result || []).sort((a, b) => b.timestamp - a.timestamp);
      db.close();
      resolve(list);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

export async function clearScan(tabId) {
  await storageRemove([`scan_${tabId}`]);
}

export async function getScanStats() {
  const scans = await getAllScans();
  const totalScans = scans.length;
  const criticalCount = scans.filter((scan) => (scan.overallRiskScore || 0) >= 9).length;
  const highCount = scans.filter((scan) => (scan.overallRiskScore || 0) >= 7).length;
  const domainCounts = new Map();
  for (const scan of scans) {
    const domain = scan.domain || safeDomain(scan.url);
    if (!domain) continue;
    domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
  }
  const topDomains = Array.from(domainCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([domain, count]) => ({ domain, count }));
  return { totalScans, criticalCount, highCount, topDomains };
}

function safeDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

const COUNTRIES = ["US", "CN", "RU", "IN", "BR", "DE"];
const COUNTRY_FLAGS = {
  US: "🇺🇸",
  CN: "🇨🇳",
  RU: "🇷🇺",
  IN: "🇮🇳",
  BR: "🇧🇷",
  DE: "🇩🇪"
};
const CATEGORIES = [
  "CONTENT_INJECTION",
  "SEMANTIC_MANIPULATION",
  "COGNITIVE_STATE",
  "BEHAVIOURAL_CONTROL",
  "SYSTEMIC_TRAP",
  "HUMAN_LOOP"
];
const DOMAINS = [
  "news-portal.com",
  "shoppingsavings.net",
  "ai-tools-free.org",
  "quickanswers.ai",
  "marketresearch.io",
  "product-review-hub.com",
  "policyinsight.dev",
  "openoffers.co",
  "briefingdesk.ai",
  "dealtracker.net"
];

const STORY_EVENTS = [
  { domain: "ai-tools-free.org", category: "CONTENT_INJECTION", riskScore: 9, attackVector: "hidden_css", summary: "Hidden instruction block embedded in a free AI tools directory page." },
  { domain: "ai-tools-free.org", category: "BEHAVIOURAL_CONTROL", riskScore: 10, attackVector: "jailbreak_text", summary: "A second page on the same domain used jailbreak prompts and exfiltration instructions." },
  { domain: "quickanswers.ai", category: "SYSTEMIC_TRAP", riskScore: 8, attackVector: "schema_manipulation", summary: "Coordinated hidden snippets repeated across mirrored pages to influence multiple agents." },
  { domain: "marketresearch.io", category: "COGNITIVE_STATE", riskScore: 8, attackVector: "json_ld", summary: "Schema markup contained fabricated authority claims and contradictory product facts." },
  { domain: "news-portal.com", category: "SEMANTIC_MANIPULATION", riskScore: 6, attackVector: "hidden_css", summary: "Hidden editorial framing pushed a biased interpretation of the same event." },
  { domain: "product-review-hub.com", category: "HUMAN_LOOP", riskScore: 7, attackVector: "social_engineering", summary: "A review page used invisible urgency text to pressure a human approver." }
];

export function generateDemoFeed() {
  const now = Date.now();
  const events = [];
  for (let i = 0; i < 20; i += 1) {
    const seeded = STORY_EVENTS[i % STORY_EVENTS.length];
    const event = {
      id: `demo-${i}-${seeded.domain}`,
      timestamp: new Date(now - ((19 - i) * 1000 * 60 * (4 + (i % 5))) - (i * 120000)),
      domain: seeded.domain,
      category: seeded.category,
      riskScore: seeded.riskScore,
      attackVector: seeded.attackVector,
      summary: seeded.summary,
      country: COUNTRIES[i % COUNTRIES.length],
      flag: COUNTRY_FLAGS[COUNTRIES[i % COUNTRIES.length]]
    };
    events.push(event);
  }
  return events.reverse();
}

let feedCounter = 0;
export function simulateLiveFeed(callback) {
  let stopped = false;
  const tick = () => {
    if (stopped) return;
    const event = createProceduralEvent(feedCounter += 1);
    callback(event);
    const delay = 8000 + Math.floor(Math.random() * 7000);
    setTimeout(tick, delay);
  };
  const initialDelay = 5000 + Math.floor(Math.random() * 3000);
  const timer = setTimeout(tick, initialDelay);
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}

function createProceduralEvent(seed) {
  const domain = DOMAINS[seed % DOMAINS.length];
  const category = CATEGORIES[seed % CATEGORIES.length];
  const riskScore = [5, 6, 7, 8, 9, 10][seed % 6];
  const country = COUNTRIES[(seed + 2) % COUNTRIES.length];
  const templates = {
    CONTENT_INJECTION: [
      "Hidden instructions were injected into off-screen content on {domain}.",
      "Invisible text blocks on {domain} attempted to steer an AI agent away from visible user intent."
    ],
    SEMANTIC_MANIPULATION: [
      "Persuasive hidden wording on {domain} pushed a single preferred interpretation.",
      "Repeated authoritative framing on {domain} appeared designed to bias AI reasoning."
    ],
    COGNITIVE_STATE: [
      "Structured data on {domain} contained fabricated authority claims and conflicting facts.",
      "Metadata on {domain} attempted to poison retrieval context with inconsistent claims."
    ],
    BEHAVIOURAL_CONTROL: [
      "Jailbreak language on {domain} instructed an agent to ignore prior rules.",
      "Request-and-exfiltration text on {domain} tried to trigger unsafe outbound calls."
    ],
    SYSTEMIC_TRAP: [
      "Multiple mirrored blocks on {domain} formed a likely Sybil-style trap pattern.",
      "Coordinated hidden snippets on {domain} targeted several AI agents at once."
    ],
    HUMAN_LOOP: [
      "Urgent approval text on {domain} tried to pressure a human operator into clicking through.",
      "Invisible countdown language on {domain} pushed social-engineering style urgency."
    ]
  };
  const arr = templates[category] || templates.CONTENT_INJECTION;
  const summary = arr[seed % arr.length].replace("{domain}", domain);
  return {
    id: `live-${Date.now()}-${seed}`,
    timestamp: new Date(Date.now()),
    domain,
    category,
    riskScore,
    attackVector: category === "CONTENT_INJECTION" ? "hidden_css" : category === "COGNITIVE_STATE" ? "json_ld" : category === "BEHAVIOURAL_CONTROL" ? "jailbreak_text" : category === "SYSTEMIC_TRAP" ? "schema_manipulation" : "social_engineering",
    summary,
    country,
    flag: COUNTRY_FLAGS[country]
  };
}
