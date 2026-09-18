import { useEffect, useMemo, useState } from "react";
import { getCategoryMeta, getRiskLevel } from "../../config/patterns.js";

const isExtensionContext = globalThis.location?.protocol === "chrome-extension:";

function sendMessage(message) {
  if (!isExtensionContext || !chrome?.runtime?.sendMessage) return Promise.resolve(null);
  return new Promise((resolve) => chrome.runtime.sendMessage(message, resolve));
}

function relativeTime(timestamp) {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.max(1, Math.round(diff / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.round(hrs / 24)} d ago`;
}

function domainDisplay(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url || "";
  }
}

export default function ReplayFeed() {
  const [scans, setScans] = useState([]);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    sendMessage({ type: "GET_ALL_SCANS" }).then((result) => setScans(Array.isArray(result) ? result.slice(0, 10) : []));
  }, []);

  const count = scans.length;

  return (
    <div className="ts-feed-panel">
      <div className="ts-feed-header">
        <div>
          <div className="ts-feed-title">Recent Scans</div>
          <div className="ts-muted">Last 10 scans from local history</div>
        </div>
        <span className="ts-count-badge">{count}</span>
      </div>
      <div className="ts-replay-list">
        {scans.map((scan) => {
          const risk = getRiskLevel(scan.overallRiskScore || 0);
          return (
            <button key={scan.timestamp} className="ts-replay-item" onClick={() => setOpen(open === scan.timestamp ? null : scan.timestamp)}>
              <div className="ts-replay-top">
                <img className="ts-favicon" src={`https://www.google.com/s2/favicons?domain=${domainDisplay(scan.url)}`} alt="favicon" />
                <div className="ts-replay-main">
                  <div className="ts-replay-domain">{domainDisplay(scan.url).slice(0, 30)}</div>
                  <div className="ts-replay-meta">{relativeTime(scan.timestamp)}</div>
                </div>
                <span className="ts-score-badge" style={{ background: `${risk.color}22`, color: risk.color, borderColor: `${risk.color}55` }}>
                  {Math.round(scan.overallRiskScore || 0)}/10
                </span>
              </div>
              <div className="ts-pill-row">
                {(scan.categoriesHit || []).map((category) => {
                  const meta = getCategoryMeta(category);
                  return (
                    <span key={category} className="ts-category-pill" style={{ background: `${meta.color}18`, color: meta.color, borderColor: `${meta.color}35` }}>
                      {meta.label}
                    </span>
                  );
                })}
              </div>
              {open === scan.timestamp && (
                <div className="ts-replay-expand">
                  <div><strong>Summary:</strong> {scan.overallSummary}</div>
                  <div><strong>Title:</strong> {scan.title || "Unknown"}</div>
                  <div><strong>URL:</strong> {scan.url}</div>
                  <div><strong>Findings:</strong></div>
                  <div className="ts-mini-list">
                    {(scan.findings || []).map((finding, idx) => (
                      <div key={idx} className="ts-mini-item">
                        <span className="ts-mini-index">{idx + 1}</span>
                        <span>{finding.category}: {finding.explanation || finding.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </button>
          );
        })}
        {!scans.length && <div className="ts-empty">No scans yet. Open a page and TrapScan will start logging events.</div>}
      </div>
    </div>
  );
}
