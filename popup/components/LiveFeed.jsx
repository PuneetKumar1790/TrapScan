import { useEffect, useMemo, useRef, useState } from "react";
import { generateDemoFeed, simulateLiveFeed } from "../../utils/storage.js";
import { getCategoryMeta, getRiskLevel } from "../../config/patterns.js";

function relativeTime(timestamp) {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.max(1, Math.round(diff / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.round(hrs / 24)} d ago`;
}

const COUNTRY_FLAGS = { US: "🇺🇸", CN: "🇨🇳", RU: "🇷🇺", IN: "🇮🇳", BR: "🇧🇷", DE: "🇩🇪" };

export default function LiveFeed() {
  const [events, setEvents] = useState(() => generateDemoFeed());
  const [stats, setStats] = useState({ scansToday: 847, trapsFound: 23, domainsFlagged: 12 });
  const listRef = useRef(null);

  useEffect(() => {
    const stop = simulateLiveFeed((event) => {
      setEvents((prev) => [event, ...prev].slice(0, 25));
      setStats((prev) => ({
        scansToday: prev.scansToday + 1,
        trapsFound: prev.trapsFound + (event.riskScore >= 7 ? 1 : 0),
        domainsFlagged: Math.max(prev.domainsFlagged, 12)
      }));
    });
    return () => stop?.();
  }, []);

  useEffect(() => {
    const node = listRef.current;
    if (node) node.scrollTop = 0;
  }, [events]);

  useEffect(() => {
    const timer = setInterval(() => {
      setStats((prev) => ({
        scansToday: prev.scansToday + 1,
        trapsFound: prev.trapsFound + (Math.random() > 0.85 ? 1 : 0),
        domainsFlagged: prev.domainsFlagged + (Math.random() > 0.9 ? 1 : 0)
      }));
    }, 12000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="ts-feed-panel">
      <div className="ts-feed-header">
        <div>
          <div className="ts-feed-title"><span className="ts-live-dot"></span> Community Threat Intelligence</div>
          <div className="ts-muted">Live synthetic feed for demo purposes</div>
        </div>
        <span className="ts-live-status">live</span>
      </div>

      <div className="ts-live-list" ref={listRef}>
        {events.map((event, idx) => {
          const meta = getCategoryMeta(event.category);
          const risk = getRiskLevel(event.riskScore);
          return (
            <div key={event.id} className={`ts-live-row ${idx === 0 ? "ts-live-new" : ""}`}>
              <div className="ts-live-top">
                <div className="ts-live-left">
                  <div className="ts-live-domain">{event.domain}</div>
                  <div className="ts-live-meta">{relativeTime(event.timestamp)}</div>
                </div>
                <div className="ts-live-right">
                  <span className="ts-country">{COUNTRY_FLAGS[event.country] || "🌐"}</span>
                  <span className="ts-score-badge" style={{ background: `${risk.color}22`, color: risk.color, borderColor: `${risk.color}55` }}>
                    {event.riskScore}/10
                  </span>
                </div>
              </div>
              <div className="ts-pill-row">
                <span className="ts-category-pill" style={{ background: `${meta.color}18`, color: meta.color, borderColor: `${meta.color}35` }}>{meta.label}</span>
                <span className="ts-vector-pill">{event.attackVector}</span>
              </div>
              <div className="ts-live-summary">{event.summary}</div>
            </div>
          );
        })}
      </div>

      <div className="ts-stats-bar">
        <span>{stats.scansToday} scans today</span>
        <span>·</span>
        <span>{stats.trapsFound} traps found</span>
        <span>·</span>
        <span>{stats.domainsFlagged} domains flagged</span>
      </div>
    </div>
  );
}
