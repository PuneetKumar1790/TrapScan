import { useEffect, useMemo, useState } from "react";
import ThreatCard from "./components/ThreatCard.jsx";
import LiveFeed from "./components/LiveFeed.jsx";
import ReplayFeed from "./components/ReplayFeed.jsx";
import { getRiskLevel } from "../config/patterns.js";
import { generateReport } from "../utils/reporter.js";
import logoMark from "../logo/trapscan-mark.png";

const TABS = ["Scan", "Feed", "History", "Settings"];
const isExtensionContext = globalThis.location?.protocol === "chrome-extension:";

function sendMessage(message) {
  if (!isExtensionContext || !chrome?.runtime?.sendMessage) return Promise.resolve(null);
  return new Promise((resolve) => chrome.runtime.sendMessage(message, resolve));
}

function queryActiveTab() {
  if (!isExtensionContext || !chrome?.tabs?.query) return Promise.resolve(null);
  return new Promise((resolve) => chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs?.[0] || null)));
}

function formatAgo(timestamp) {
  if (!timestamp) return "";
  const diff = Date.now() - Number(timestamp);
  const secs = Math.max(1, Math.round(diff / 1000));
  if (secs < 60) return `Scanned ${secs} seconds ago`;
  const mins = Math.round(secs / 60);
  return `Scanned ${mins} minutes ago`;
}

function truncate(value = "", max = 54) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export default function App() {
  const [tab, setTab] = useState("Scan");
  const [scan, setScan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentTabId, setCurrentTabId] = useState(null);
  const [stats, setStats] = useState({ totalScans: 0, criticalCount: 0, highCount: 0, topDomains: [] });
  const [settings, setSettings] = useState({ showOverlay: true, autoScan: true });
  const [apiKey, setApiKey] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      if (!isExtensionContext) {
        setLoading(false);
        setScan(null);
        setStats({ totalScans: 0, criticalCount: 0, highCount: 0, topDomains: [] });
        setSettings({ showOverlay: true, autoScan: false });
        return;
      }
      const active = await queryActiveTab();
      setCurrentTabId(active?.id || null);
      const result = active?.id ? await sendMessage({ type: "GET_SCAN", tabId: active.id }) : null;
      setScan(result || null);
      setLoading(false);
      const nextStats = await sendMessage({ type: "GET_STATS" });
      setStats(nextStats || stats);
      const nextSettings = await sendMessage({ type: "GET_SETTINGS" });
      setSettings(nextSettings || settings);
      chrome.storage.local.get(["GEMINI_API_KEY"], (data) => setApiKey(data.GEMINI_API_KEY || ""));
    })();
  }, []);

  async function refreshScan() {
    if (!isExtensionContext || !currentTabId) return;
    setLoading(true);
    await chrome.tabs.sendMessage(currentTabId, { type: "TRAPSCAN_FORCE_SCAN" });
    setTimeout(async () => {
      const result = await sendMessage({ type: "GET_SCAN", tabId: currentTabId });
      setScan(result || null);
      setLoading(false);
    }, 1200);
  }

  async function downloadReport() {
    if (!scan) return;
    const blob = new Blob([generateReport(scan)], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trapscan-report-${Date.now()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function saveApiKey() {
    if (!isExtensionContext) {
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      return;
    }
    if (/^\.+$/.test(apiKey)) {
      return;
    }
    await sendMessage({ type: "SET_API_KEY", apiKey });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  async function updateSetting(next) {
    const merged = { ...settings, ...next };
    setSettings(merged);
    if (!isExtensionContext) return;
    await sendMessage({ type: "SET_SETTINGS", settings: merged });
  }

  const level = useMemo(() => getRiskLevel(scan?.overallRiskScore || 0), [scan]);
  const findings = scan?.findings || [];
  const aiAnalysisUsed = scan?.aiAnalysisUsed === true;
  const aiAnalysisMissing = scan?.aiAnalysisUsed === false || scan?.apiAnalysisUnavailable === true;

  return (
    <div className="ts-app">
      <header className="ts-header">
        <div className="ts-brand-row">
          <div>
            <div className="ts-brand-title">TrapScan</div>
            <div className="ts-brand-subtitle">AI Agent Trap Detector</div>
          </div>
          <div className="ts-brand-badge">v1.0.0</div>
        </div>
        <div className="ts-tabs">
          {TABS.map((name) => (
            <button key={name} className={`ts-tab ${tab === name ? "is-active" : ""}`} onClick={() => setTab(name)}>{name}</button>
          ))}
        </div>
      </header>

      <main className="ts-main">
        {tab === "Scan" && (
          <section className="ts-panel">
            {!isExtensionContext && (
              <div className="ts-warning-banner" style={{ marginBottom: 12 }}>
                Web preview mode — extension APIs are not available on Vercel.
              </div>
            )}
            {loading && !scan ? (
              <div className="ts-loading">
                <img src={logoMark} alt="TrapScan" className="ts-shield-img" />
                <div className="ts-loading-title">Analyzing page...</div>
                <div className="ts-progress"><span /></div>
              </div>
            ) : scan ? (
              <>
                <div className="ts-scan-top">
                  <div className="ts-score-ring" style={{ borderColor: level.color }}>
                    <div className="ts-score-ring-inner">{Math.round(scan.overallRiskScore || 0)}</div>
                  </div>
                  <div className="ts-scan-meta">
                    <div className="ts-risk-label" style={{ color: level.color }}>{level.label.toUpperCase()}</div>
                    <div className="ts-url">{truncate(scan.url || "", 54)}</div>
                    <div className="ts-time">{formatAgo(scan.timestamp)}</div>
                    {aiAnalysisUsed ? (
                      <div className="ts-ai-used"><span className="ts-ai-dot" />Analyzed by Gemma 4 · Google AI Studio</div>
                    ) : scan?.apiAnalysisUnavailable ? (
                      <div className="ts-warning-banner ts-warning-ai">
                        ⚠️ AI analysis was unavailable, so TrapScan used local detection only.
                      </div>
                    ) : aiAnalysisMissing ? (
                      <div className="ts-warning-banner ts-warning-ai">
                        ⚠️ Add your Gemini API key in Settings for AI-powered analysis
                        <button className="ts-inline-link" onClick={() => setTab("Settings")}>Open Settings →</button>
                      </div>
                    ) : null}
                    <div className="ts-action-row">
                      <button className="ts-button secondary" onClick={refreshScan}>Re-scan</button>
                      <button className="ts-button" onClick={downloadReport}>Download Report</button>
                    </div>
                  </div>
                </div>

                <div className="ts-section-header">Threats Detected ({findings.length})</div>
                <div className="ts-findings-list">
                  {findings.length ? findings.map((finding, index) => <ThreatCard key={`${finding.category}-${index}`} finding={finding} index={index} />) : (
                    <div className="ts-no-threats">
                      <div className="ts-check">✓</div>
                      <div>No adversarial content detected</div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="ts-loading">
                <img src={logoMark} alt="TrapScan" className="ts-shield-img" />
                <div className="ts-loading-title">No scan available yet</div>
                <div className="ts-loading-subtitle">Open a page to trigger detection.</div>
              </div>
            )}
          </section>
        )}

        {tab === "Feed" && <LiveFeed />}
        {tab === "History" && <ReplayFeed />}

        {tab === "Settings" && (
          <section className="ts-panel ts-settings">
            <div className="ts-setting-group">
              <label>GEMMA 4 API KEY (Google AI Studio)</label>
              <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Paste your AI Studio key..." />
              <a className="ts-link ts-key-link" href="https://aistudio.google.com" target="_blank" rel="noreferrer">Get a free key at aistudio.google.com →</a>
              <div className="ts-inline-row">
                <button className="ts-button" onClick={saveApiKey}>Save</button>
                {saved && <span className="ts-saved">Saved ✓</span>}
              </div>
            </div>

            <div className="ts-setting-group">
              <div className="ts-setting-row"><span>Model: gemma-4-26b-a4b-it (Gemma 4 26B)</span></div>
              <div className="ts-toggle-row">
                <label className="ts-toggle"><input type="checkbox" checked={settings.showOverlay} onChange={(e) => updateSetting({ showOverlay: e.target.checked })} /> Show page overlay on detection</label>
                <label className="ts-toggle"><input type="checkbox" checked={settings.autoScan} onChange={(e) => updateSetting({ autoScan: e.target.checked })} /> Auto-scan on page load</label>
              </div>
            </div>

            <div className="ts-stats-card">
              <div>Total scans: {stats.totalScans}</div>
              <div>Threats found: {stats.highCount + stats.criticalCount}</div>
              <div>Critical: {stats.criticalCount}</div>
              <div className="ts-top-domains">
                {(stats.topDomains || []).map((item) => <span key={item.domain} className="ts-domain-chip">{item.domain}</span>)}
              </div>
            </div>

            <a className="ts-link" href="https://deepmind.google/discover/blog/ai-agent-traps/" target="_blank" rel="noreferrer">View research paper</a>
            <div className="ts-version">TrapScan v1.0.0 · Based on Franklin et al., 2025</div>
          </section>
        )}
      </main>
    </div>
  );
}
