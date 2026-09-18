import { getCategoryMeta, getRiskLevel } from "../../config/patterns.js";

export default function ScoreBadge({ score = 0, category }) {
  const level = getRiskLevel(score);
  const cat = category ? getCategoryMeta(category) : null;
  return (
    <span
      className="ts-score-badge"
      style={{
        background: cat ? `${cat.color}22` : undefined,
        color: cat ? cat.color : level.color,
        borderColor: cat ? `${cat.color}44` : level.color
      }}
    >
      {Math.round(score)}/10
    </span>
  );
}
