import { useMemo, useState } from "react";
import ScoreBadge from "./ScoreBadge.jsx";
import { getCategoryMeta } from "../../config/patterns.js";

function firstSentence(text = "") {
  const value = String(text).trim();
  const end = value.indexOf(".");
  if (end > 0) return value.slice(0, end + 1);
  return value.slice(0, 120);
}

export default function ThreatCard({ finding, index }) {
  const [expanded, setExpanded] = useState(false);
  const meta = useMemo(() => getCategoryMeta(finding.category), [finding.category]);
  return (
    <button className={`ts-threat-card ${expanded ? "is-expanded" : ""}`} onClick={() => setExpanded((v) => !v)}>
      <div className="ts-threat-top">
        <div className="ts-threat-left">
          <div className="ts-threat-badges">
            <span className="ts-category-pill" style={{ background: `${meta.color}18`, color: meta.color, borderColor: `${meta.color}35` }}>
              {meta.label}
            </span>
            <ScoreBadge score={finding.riskScore || finding.localScore || 0} category={finding.category} />
          </div>
          <div className="ts-threat-title">{firstSentence(finding.explanation || finding.description || "Suspicious content detected")}</div>
        </div>
        <span className="ts-chevron">{expanded ? "▴" : "▾"}</span>
      </div>
      {expanded && (
        <div className="ts-threat-body">
          <div className="ts-threat-section">
            <div className="ts-threat-label">Explanation</div>
            <div>{finding.explanation || finding.description}</div>
          </div>
          <div className="ts-threat-section">
            <div className="ts-threat-label">Potential damage</div>
            <div className="ts-warning">⚠ {finding.potentialDamage || "Could influence or mislead an AI agent."}</div>
          </div>
          <div className="ts-threat-section">
            <div className="ts-threat-label">Attack vector</div>
            <div>{finding.attackVector || "hidden_css"}</div>
          </div>
          <div className="ts-threat-section">
            <div className="ts-threat-label">Suspicious snippet</div>
            <pre className="ts-snippet">{finding.snippet || ""}</pre>
          </div>
        </div>
      )}
    </button>
  );
}
