import { useId, useState } from "react";
import { cx } from "../lib/util";

export function Sparkline({
  data,
  tone = "ink",
  className,
}: {
  data: number[];
  tone?: "ink" | "lime";
  className?: string;
}) {
  if (data.length === 0) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const span = max - min || 1;
  const points = data
    .map((value, index) => {
      const x = (index / Math.max(1, data.length - 1)) * 100;
      const y = 96 - ((value - min) / span) * 88;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg
      className={cx("sparkline", `sparkline--${tone}`, className)}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline points={points} fill="none" vectorEffect="non-scaling-stroke" strokeWidth={1.8} />
    </svg>
  );
}

export function AreaChart({
  data,
  labels,
  formatValue,
  tone = "lime",
  height = 240,
}: {
  data: number[];
  labels: string[];
  formatValue: (value: number) => string;
  tone?: "lime" | "ink";
  height?: number;
}) {
  const gradientId = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...data, 1);
  const min = 0;
  const span = max - min || 1;

  const coords = data.map((value, index) => ({
    x: (index / Math.max(1, data.length - 1)) * 100,
    y: 100 - ((value - min) / span) * 88 - 4,
  }));

  const line = coords.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
  const area = `0,100 ${line} 100,100`;
  const active = hover !== null ? coords[hover] : null;

  return (
    <div className="chart" style={{ height }}>
      <svg
        className={cx("chart__svg", `chart__svg--${tone}`)}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        role="img"
        aria-label="Performance over time"
        onPointerMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const ratio = (event.clientX - rect.left) / rect.width;
          setHover(Math.round(ratio * (data.length - 1)));
        }}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={tone === "lime" ? "#bdea4a" : "#39465c"} stopOpacity="0.55" />
            <stop offset="70%" stopColor={tone === "lime" ? "#d8f78a" : "#8c98ab"} stopOpacity="0.12" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((ratio) => (
          <line
            key={ratio}
            x1="0"
            y1={ratio * 100}
            x2="100"
            y2={ratio * 100}
            className="chart__grid"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <polygon points={area} fill={`url(#${gradientId})`} />
        <polyline
          points={line}
          className="chart__line"
          fill="none"
          vectorEffect="non-scaling-stroke"
          strokeWidth={1.8}
        />
        {active ? (
          <>
            <line
              x1={active.x}
              y1="0"
              x2={active.x}
              y2="100"
              className="chart__crosshair"
              vectorEffect="non-scaling-stroke"
            />
            <circle cx={active.x} cy={active.y} r="1.5" className="chart__dot" vectorEffect="non-scaling-stroke" />
          </>
        ) : null}
      </svg>
      {active && hover !== null ? (
        <div
          className="chart__tip"
          style={{ left: `${Math.min(88, Math.max(6, active.x))}%`, top: `${Math.max(2, active.y)}%` }}
        >
          <span className="chart__tip-label">{labels[hover]}</span>
          <span className="chart__tip-value">{formatValue(data[hover])}</span>
        </div>
      ) : null}
      <div className="chart__axis">
        {labels
          .filter((_, index) => index % Math.max(1, Math.ceil(data.length / 6)) === 0)
          .map((label, index) => (
            <span key={`${label}-${index}`}>{label}</span>
          ))}
      </div>
    </div>
  );
}

export function ChatSpikes({
  data,
  peaks,
  height = 104,
}: {
  data: number[];
  peaks: Array<{ at: number; label: string }>;
  height?: number;
}) {
  const max = Math.max(...data, 1);
  return (
    <div className="spikes" style={{ height }}>
      {data.map((value, index) => {
        const peak = peaks.find((item) => Math.abs(item.at - index) <= 2);
        return (
          <span
            key={index}
            className={cx("spikes__bar", peak && "spikes__bar--peak")}
            style={{ height: `${Math.max(6, (value / max) * 100)}%` }}
            title={peak ? `${peak.label} · ${value} msgs/10s` : `${value} msgs/10s`}
          />
        );
      })}
    </div>
  );
}
