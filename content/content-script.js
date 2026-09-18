import { detectLocalPatterns } from "../utils/detector.js";

const sentUrls = new Set();
const DISMISS_KEY_PREFIX = "trapscan-overlay-dismissed:";
const STATE_KEY = "trapscan-overlay-state";
const STYLE_ID = "trapscan-styles";

function collectStylesAndInlineAttributes() {
  const pieces = [];
  document.querySelectorAll("style").forEach((style) => {
    if (style.textContent) pieces.push(style.textContent);
  });
  document.querySelectorAll("[style]").forEach((el) => {
    if ((el.textContent || "").trim().length > 0) {
      pieces.push(el.getAttribute("style") || "");
    }
  });
  return pieces.join("\n");
}

function captureDomSnapshot() {
  return {
    html: document.documentElement.outerHTML,
    styles: collectStylesAndInlineAttributes(),
    text: (document.body?.innerText || "").slice(0, 5000),
    url: window.location.href,
    title: document.title
  };
}

function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ autoScan: true, showOverlay: true }, resolve);
  });
}

async function sendScan(force = false) {
  const domSnapshot = captureDomSnapshot();
  const localResult = detectLocalPatterns(domSnapshot);
  const urlKey = domSnapshot.url;
  const settings = await getSettings();
  if (!force && !settings.autoScan && localResult.findings.length === 0) return;
  if (!force && sentUrls.has(urlKey)) return;
  sentUrls.add(urlKey);
  chrome.runtime.sendMessage({
    type: "SCAN_REQUEST",
    payload: {
      domSnapshot,
      findings: localResult.findings,
      url: domSnapshot.url,
      title: domSnapshot.title
    }
  });
}

function injectOverlay(result) {
  const score = Number(result?.overallRiskScore || 0);
  if (score < 5) return;
  chrome.storage.local.get({ showOverlay: true }, (settings) => {
    if (!settings.showOverlay) return;
    doInjectOverlay(result, score);
  });
}

function doInjectOverlay(result, score) {
  const dismissedKey = `${DISMISS_KEY_PREFIX}${window.location.href}`;
  if (sessionStorage.getItem(dismissedKey) === "1") return;

  if (document.getElementById("trapscan-overlay")) return;

  const styles = `
    #trapscan-overlay, #trapscan-overlay * { box-sizing: border-box; }
    #trapscan-overlay {
      position: fixed;
      right: 20px;
      bottom: 20px;
      z-index: 2147483647;
      width: 320px;
      border-radius: 12px;
      backdrop-filter: blur(8px);
      background: rgba(0,0,0,0.85);
      border: 1px solid rgba(255,255,255,0.1);
      color: white;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      padding: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.45);
      opacity: 0;
      transform: translateY(12px) scale(0.98);
      transition: opacity .25s ease, transform .25s ease;
    }
    #trapscan-overlay.ts-visible { opacity: 1; transform: translateY(0) scale(1); }
    #trapscan-overlay.ts-dismiss { opacity: 0; transform: translateY(16px) scale(0.98); }
    .ts-overlay-head { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom: 12px; }
    .ts-brand { display:flex; align-items:center; gap:8px; color:#EF9F27; font-weight:700; }
    .ts-close { background: transparent; color: #fff; border: 0; font-size: 22px; line-height: 1; cursor: pointer; opacity: .7; }
    .ts-title { font-size: 16px; font-weight: 800; margin: 4px 0 10px; }
    .ts-score { font-size: 34px; font-weight: 900; line-height: 1; margin-bottom: 10px; }
    .ts-pill-row { display:flex; gap:6px; flex-wrap:wrap; margin-bottom: 10px; }
    .ts-pill { padding: 4px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; background: rgba(255,255,255,0.08); }
    .ts-summary { font-size: 13px; color: #c8c8c8; line-height: 1.5; }
    .ts-fade { animation: trapscanFadeOut .3s ease forwards; }
    @keyframes trapscanFadeOut { to { opacity: 0; transform: translateY(18px) scale(0.98); } }
    .ts-live-dot { width: 8px; height: 8px; border-radius: 50%; background: #EF9F27; box-shadow: 0 0 0 0 rgba(239,159,39,.5); animation: trapscanPulse 1.8s infinite; }
    @keyframes trapscanPulse { 0% { box-shadow: 0 0 0 0 rgba(239,159,39,.45); } 70% { box-shadow: 0 0 0 10px rgba(239,159,39,0); } 100% { box-shadow: 0 0 0 0 rgba(239,159,39,0); } }
  `;
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = styles;
    document.head.appendChild(style);
  }

  const overlay = document.createElement("div");
  overlay.id = "trapscan-overlay";
  overlay.innerHTML = `
    <div class="ts-overlay-head">
      <div class="ts-brand">
        <span class="ts-live-dot"></span>
        <span>TrapScan</span>
      </div>
      <button class="ts-close" aria-label="Close">×</button>
    </div>
    <div class="ts-title">⚠️ AI Agent Trap Detected</div>
    <div class="ts-score" style="color:${score >= 9 ? "#E24B4A" : score >= 7 ? "#E24B4A" : "#EF9F27"};">${score}/10</div>
    <div class="ts-pill-row">${(result?.categoriesHit || []).map((c) => `<span class="ts-pill">${c}</span>`).join("")}</div>
    <div class="ts-summary">${escapeHtml(result?.overallSummary || "Suspicious content detected on this page.")}</div>
    ${result?.apiAnalysisUnavailable ? '<div class="ts-summary" style="margin-top:8px;color:#f3c36b;">AI analysis unavailable; local detection was used.</div>' : ""}
  `;

  overlay.querySelector(".ts-close").addEventListener("click", () => dismissOverlay(overlay, dismissedKey));
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("ts-visible"));
  setTimeout(() => dismissOverlay(overlay, dismissedKey), 8000);
}

function dismissOverlay(overlay, dismissedKey) {
  if (!overlay || overlay.dataset.dismissed === "1") return;
  overlay.dataset.dismissed = "1";
  sessionStorage.setItem(dismissedKey, "1");
  overlay.classList.add("ts-dismiss");
  setTimeout(() => overlay.remove(), 300);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "SCAN_COMPLETE") {
    injectOverlay(message.payload);
  }
  if (message?.type === "TRAPSCAN_FORCE_SCAN") {
    sendScan(true);
  }
});

sendScan(false);
