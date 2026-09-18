import { getRiskLevel } from "../config/patterns.js";

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString();
}

function gaugeStyle(score) {
  const percent = Math.max(0, Math.min(100, (Number(score) || 0) * 10));
  return `background: conic-gradient(#EF9F27 0% ${percent}%, rgba(255,255,255,0.06) ${percent}% 100%);`;
}

function recommendationFor(score) {
  const level = getRiskLevel(score);
  if (level.label === "Safe") return "No threats detected. This page appears safe for AI agent interaction.";
  if (level.label === "Low Risk" || level.label === "Suspicious") return "Exercise caution. Avoid using AI assistants to interact with this page's forms or links.";
  return "Do not allow AI agents to interact with this page. Contains likely adversarial content targeting AI systems.";
}

export function generateReport(scanResult) {
  const score = Number(scanResult?.overallRiskScore || 0);
  const level = getRiskLevel(score);
  const findings = Array.isArray(scanResult?.findings) ? scanResult.findings : [];
  const categories = Array.isArray(scanResult?.categoriesHit) ? scanResult.categoriesHit.join(", ") : "None";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>TrapScan Report</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #0b0b0d;
      color: #f4f4f5;
      padding: 32px;
    }
    .page {
      max-width: 980px;
      margin: 0 auto;
      background: #121214;
      border: 1px solid #26262a;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 24px 80px rgba(0,0,0,.45);
    }
    .header {
      padding: 28px 32px;
      background: linear-gradient(135deg, rgba(239,159,39,.16), rgba(239,159,39,.03));
      border-bottom: 1px solid #26262a;
    }
    .brand { display:flex; align-items:center; justify-content:space-between; gap:16px; }
    .logo { font-size: 28px; font-weight: 800; color: #ef9f27; letter-spacing: .3px; }
    .meta { color: #9ca3af; font-size: 13px; line-height: 1.6; }
    .section { padding: 28px 32px; border-top: 1px solid #1f1f22; }
    .section h2 { margin: 0 0 16px; font-size: 18px; }
    .summary-grid { display:grid; grid-template-columns: 220px 1fr; gap: 24px; align-items:center; }
    .gauge {
      width: 180px; height: 180px; border-radius: 50%; margin: 0 auto;
      ${gaugeStyle(score)} position: relative; display:flex; align-items:center; justify-content:center;
    }
    .gauge::after {
      content: ""; position: absolute; inset: 18px; border-radius: 50%; background: #121214; border: 1px solid #2a2a2e;
    }
    .gauge-inner {
      position: relative; z-index: 1; text-align: center;
    }
    .gauge-score { font-size: 42px; font-weight: 900; line-height: 1; }
    .gauge-label { font-size: 12px; color: #a3a3a3; margin-top: 6px; text-transform: uppercase; letter-spacing: .12em; }
    .pill { display:inline-flex; align-items:center; gap:6px; padding: 6px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; background: rgba(255,255,255,.06); color: #fff; }
    .pill.green { background: rgba(99,153,34,.18); color: #bdf37b; }
    .pill.yellow { background: rgba(239,159,39,.16); color: #ffd494; }
    .pill.red { background: rgba(224,75,74,.16); color: #ffb2b1; }
    .summary-text { color: #d6d6d8; line-height: 1.7; margin: 16px 0 0; }
    .finding { margin-top: 14px; padding: 16px; background: #17171b; border: 1px solid #27272a; border-radius: 16px; }
    .finding-top { display:flex; justify-content:space-between; align-items:flex-start; gap: 16px; }
    .finding-title { font-weight: 700; margin-bottom: 8px; }
    .finding-grid { display:grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; }
    .field { background: #0f0f12; border: 1px solid #2a2a2f; border-radius: 12px; padding: 12px; }
    .field label { display:block; color: #a3a3a3; font-size: 11px; text-transform: uppercase; letter-spacing: .12em; margin-bottom: 8px; }
    pre {
      margin: 0; white-space: pre-wrap; word-break: break-word;
      background: #0b0b0d; border-left: 3px solid #ef9f27; padding: 12px; border-radius: 10px;
      color: #ffdca8;
      font-size: 12px;
    }
    .footer {
      padding: 20px 32px 28px; color: #9ca3af; font-size: 12px; text-align: center; border-top: 1px solid #1f1f22;
    }
    .recommendation { padding: 14px 16px; border-radius: 14px; background: rgba(239,159,39,.12); border: 1px solid rgba(239,159,39,.18); color: #ffe6ba; }
    @media print { body { background: #fff; color: #111; } .page { box-shadow:none; } }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="brand">
        <div>
          <div class="logo">TrapScan</div>
          <div class="meta">Generated by TrapScan · Based on AI Agent Traps research (Franklin et al., 2025)</div>
        </div>
        <div class="meta">
          <div><strong>Report time:</strong> ${escapeHtml(formatDate(scanResult?.timestamp || Date.now()))}</div>
          <div><strong>URL:</strong> ${escapeHtml(scanResult?.url || "")}</div>
        </div>
      </div>
    </div>

    <div class="section">
      <h2>Executive Summary</h2>
      <div class="summary-grid">
        <div class="gauge">
          <div class="gauge-inner">
            <div class="gauge-score">${score}</div>
            <div class="gauge-label">/ 10</div>
          </div>
        </div>
        <div>
          <div class="pill ${level.badge}">${escapeHtml(level.label)}</div>
          <div class="summary-text">${escapeHtml(scanResult?.overallSummary || "")}</div>
          <div style="margin-top:14px; color:#a3a3a3; font-size:13px;">Categories hit: ${escapeHtml(categories)}</div>
        </div>
      </div>
    </div>

    <div class="section">
      <h2>Threat Breakdown</h2>
      ${findings.length ? findings.map((finding, index) => `
        <div class="finding">
          <div class="finding-top">
            <div>
              <div class="finding-title">Finding ${index + 1} · ${escapeHtml(finding.category || "Unknown")}</div>
              <div style="color:#9ca3af;">${escapeHtml(finding.explanation || "")}</div>
            </div>
            <div class="pill ${getRiskLevel(finding.riskScore || 0).badge}">${escapeHtml(String(finding.riskScore || 0))}/10</div>
          </div>
          <div class="finding-grid">
            <div class="field"><label>Potential damage</label><div>${escapeHtml(finding.potentialDamage || "")}</div></div>
            <div class="field"><label>Attack vector</label><div>${escapeHtml(finding.attackVector || "")}</div></div>
          </div>
          <div style="margin-top:12px;" class="field">
            <label>Suspicious snippet</label>
            <pre>${escapeHtml(finding.snippet || "")}</pre>
          </div>
        </div>
      `).join("") : `<div class="finding"><div class="recommendation">No confirmed findings were available for this scan.</div></div>`}
    </div>

    <div class="section">
      <h2>Recommendation</h2>
      <div class="recommendation">${escapeHtml(recommendationFor(score))}</div>
    </div>

    <div class="footer">
      Generated by TrapScan · Based on AI Agent Traps research (Franklin et al., 2025)
    </div>
  </div>
</body>
</html>`;
}
