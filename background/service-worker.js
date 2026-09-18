import { classifyWithGemma } from "../utils/gemma.js";
import { clearScan, getAllScans, getScanResult, getScanStats, saveScanResult } from "../utils/storage.js";

const FRESH_WINDOW_MS = 60_000;
const recentByUrl = new Map();

function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

function storageSet(items) {
  return new Promise((resolve) => chrome.storage.local.set(items, resolve));
}

function badgeColorForScore(score) {
  const value = Number(score || 0);
  if (value <= 2) return "#639922";
  if (value <= 6) return "#EF9F27";
  return "#E24B4A";
}

function localOnlyScore(findings) {
  if (!findings.length) return 0;
  const avg = findings.reduce((sum, finding) => sum + Number(finding.localScore || 0), 0) / findings.length;
  return Math.min(10, Math.round(avg * 2));
}

function inferAttackVector(category) {
  switch (category) {
    case "CONTENT_INJECTION": return "hidden_css";
    case "SEMANTIC_MANIPULATION": return "hidden_css";
    case "COGNITIVE_STATE": return "json_ld";
    case "BEHAVIOURAL_CONTROL": return "behavioural_command";
    case "SYSTEMIC_TRAP": return "schema_manipulation";
    case "HUMAN_LOOP": return "social_engineering";
    default: return "hidden_css";
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "SCAN_REQUEST") {
    // MUST use this pattern for async in MV3
    (async () => {
      try {
        // Step 1: get API key first, before anything else
        const stored = await chrome.storage.local.get(
          ["GEMINI_API_KEY"]
        );
        const apiKey = stored.GEMINI_API_KEY || "";

        console.log("TrapScan SW: API key present?", apiKey.length > 10);

        const payload = message?.payload || {};
        const safeFindings = Array.isArray(payload.findings) ? payload.findings : [];
        const domSnapshot = payload.domSnapshot || {};
        const url = payload.url || "";
        const title = payload.title || "";

        const tabId = sender?.tab?.id;
        if (typeof tabId !== "number") {
          sendResponse({ success: false, error: "Missing tab id" });
          return;
        }

        const now = Date.now();
        const previous = recentByUrl.get(`${tabId}:${url}`);
        if (previous && now - previous < FRESH_WINDOW_MS) {
          const existing = await getScanResult(tabId);
          if (existing) {
            chrome.tabs.sendMessage(tabId, { type: "SCAN_COMPLETE", payload: existing });
            sendResponse({ success: true, cached: true });
            return;
          }
        }

        let result;

        // Step 2: only call AI if key exists
        let apiErrorMessage = null;
        if (apiKey && apiKey.length > 10) {
          try {
            result = await classifyWithGemma(
              safeFindings,
              {
                url,
                title,
                truncatedHTML: typeof domSnapshot.html === "string" ? domSnapshot.html.slice(0, 3000) : ""
              },
              apiKey  // pass key explicitly
            );
            if (result) result.aiAnalysisUsed = true;
          } catch (aiError) {
            console.error("TrapScan SW: AI error", aiError);
            apiErrorMessage = aiError.message;
            result = null;
          }
        }

        // Step 3: fallback to local scoring
        if (!result) {
          const avgScore = safeFindings.length > 0
            ? Math.min(10, Math.round(
                safeFindings.reduce((s, f) => s + Number(f.localScore || 0), 0)
                / safeFindings.length * 1.5
              ))
            : 0;
          result = {
            overallRiskScore: avgScore,
            overallSummary: safeFindings.length > 0
              ? `${safeFindings.length} suspicious pattern(s) detected using local analysis.`
              : "No threats detected.",
            findings: safeFindings.map((f, i) => ({
              id: i,
              confirmed: true,
              category: f.category,
              riskScore: f.localScore,
              explanation: f.description,
              potentialDamage: "Could mislead an AI agent browsing this page.",
              attackVector: "local_detection"
            })),
            aiAnalysisUsed: false,
            apiAnalysisUnavailable: Boolean(apiErrorMessage)
          };
        }

        if (apiErrorMessage && result) {
          result.apiAnalysisUnavailable = true;
        }

        // Step 4: set badge
        const score = Number(result.overallRiskScore || 0);

        let badgeColor = "#639922"; // green
        let badgeText = "✓";
        if (score >= 7) {
          badgeColor = "#EF4444";
          badgeText = String(score);
        } else if (score >= 3) {
          badgeColor = "#EAB308";
          badgeText = String(score);
        }

        await chrome.action.setBadgeText({
          text: badgeText, tabId
        });
        await chrome.action.setBadgeBackgroundColor({
          color: badgeColor, tabId
        });

        const resultFindings = Array.isArray(result.findings) ? result.findings : [];

        // Step 5: save and notify
        await saveScanResult(tabId, url, {
          url, title,
          timestamp: Date.now(),
          overallRiskScore: score,
          overallSummary: result.overallSummary,
          findings: resultFindings,
          aiAnalysisUsed: result.aiAnalysisUsed,
          categoriesHit: [...new Set(
            resultFindings.map(f => f.category).filter(Boolean)
          )]
        });

        recentByUrl.set(`${tabId}:${url}`, Date.now());

        // Step 6: send to content script
        try {
          await chrome.tabs.sendMessage(tabId, {
            type: "SCAN_COMPLETE",
            payload: { ...result, url, title }
          });
        } catch (e) {
          // content script may not be ready, ignore
        }

        sendResponse({ success: true });

      } catch (err) {
        console.error("TrapScan SW: scan error", err);
        sendResponse({ success: false, error: err.message });
      }
    })();

    return true; // CRITICAL: keeps message channel open for async
  }

  (async () => {
    try {
      switch (message?.type) {
        case "GET_SCAN": {
          const result = await getScanResult(message.tabId || sender?.tab?.id);
          sendResponse?.(result || null);
          break;
        }
        case "SET_API_KEY": {
          await storageSet({ GEMINI_API_KEY: message.apiKey || "" });
          sendResponse?.({ ok: true });
          break;
        }
        case "GET_ALL_SCANS": {
          const scans = await getAllScans();
          sendResponse?.(scans);
          break;
        }
        case "GET_STATS": {
          const stats = await getScanStats();
          sendResponse?.(stats);
          break;
        }
        case "GET_SETTINGS": {
          const settings = await storageGet(["showOverlay", "autoScan"]);
          sendResponse?.({
            showOverlay: settings.showOverlay ?? true,
            autoScan: settings.autoScan ?? true
          });
          break;
        }
        case "SET_SETTINGS": {
          await storageSet({
            showOverlay: message.settings?.showOverlay ?? true,
            autoScan: message.settings?.autoScan ?? true
          });
          sendResponse?.({ ok: true });
          break;
        }
        default:
          sendResponse?.(null);
      }
    } catch (error) {
      console.error("TrapScan message handler failed", error);
      sendResponse?.({ ok: false, error: String(error) });
    }
  })();
  return true;
});

chrome.tabs?.onUpdated?.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "complete") {
    recentByUrl.clear();
    clearScan(tabId);
  }
});
