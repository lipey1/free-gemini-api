"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

type Point = { ts: number; count: number };

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function UsageChart({
  data,
  height = 160,
  label = "Requests",
  emptyHint,
}: {
  data: Point[];
  height?: number;
  label?: string;
  emptyHint?: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const width = 640;
  const padX = 8;
  const padY = 18;
  const max = Math.max(1, ...data.map((d) => d.count));
  const n = Math.max(1, data.length);
  const gap = 2;
  const barW = Math.max(2, (width - padX * 2) / n - gap);
  const total = data.reduce((s, d) => s + d.count, 0);
  const peak = data.reduce((m, d) => (d.count > m.count ? d : m), {
    ts: 0,
    count: 0,
  });

  const points = data.map((d, i) => {
    const x = padX + i * ((width - padX * 2) / n) + gap / 2;
    const h = (d.count / max) * (height - padY * 2);
    const y = height - padY - h;
    return { ...d, x, y, h, w: barW };
  });

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || prefersReducedMotion()) return;
    const bars = svg.querySelectorAll(".dash-chart-bar:not(.is-empty)");
    gsap.fromTo(
      bars,
      { scaleY: 0, transformOrigin: "50% 100%" },
      { scaleY: 1, duration: 0.55, stagger: 0.008, ease: "power2.out" },
    );
  }, [data]);

  return (
    <div className="dash-chart">
      <div className="dash-chart-head">
        <span>{label}</span>
        <span className="dash-chart-total mono">
          {total.toLocaleString()} total
          {peak.count > 0 ? ` · peak ${peak.count}` : ""}
        </span>
      </div>
      <div className="dash-chart-frame">
        <svg
          ref={svgRef}
          className="dash-chart-svg"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`${label}: ${total} requests`}
          preserveAspectRatio="none"
        >
          {[0.25, 0.5, 0.75].map((p) => (
            <line
              key={p}
              x1={padX}
              x2={width - padX}
              y1={padY + (height - padY * 2) * (1 - p)}
              y2={padY + (height - padY * 2) * (1 - p)}
              className="dash-chart-grid"
            />
          ))}
          <line
            x1={padX}
            x2={width - padX}
            y1={height - padY}
            y2={height - padY}
            className="dash-chart-axis"
          />
          {points.map((p) => (
            <rect
              key={p.ts}
              x={p.x}
              y={p.count ? p.y : height - padY - 2}
              width={p.w}
              height={p.count ? Math.max(p.h, 2) : 2}
              rx={2}
              className={p.count ? "dash-chart-bar" : "dash-chart-bar is-empty"}
            >
              <title>
                {new Date(p.ts).toLocaleString()} — {p.count}
              </title>
            </rect>
          ))}
        </svg>
        {total === 0 && emptyHint ? (
          <div className="dash-chart-empty">
            <p>{emptyHint}</p>
          </div>
        ) : null}
      </div>
      <div className="dash-chart-foot mono">
        <span>{data[0] ? formatTick(data[0].ts) : "—"}</span>
        <span>{data.length ? formatTick(data[data.length - 1].ts) : "—"}</span>
      </div>
    </div>
  );
}

function formatTick(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function RateRing({
  used,
  limit,
}: {
  used: number;
  limit: number;
}) {
  const ringRef = useRef<SVGCircleElement>(null);
  const safeLimit = Math.max(1, limit || 1);
  const pct = Math.min(100, Math.round((used / safeLimit) * 100));
  const r = 42;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  useEffect(() => {
    const el = ringRef.current;
    if (!el || prefersReducedMotion()) return;
    gsap.fromTo(
      el,
      { strokeDashoffset: c },
      { strokeDashoffset: offset, duration: 0.7, ease: "power3.out" },
    );
  }, [offset, c]);

  return (
    <div className="rate-ring" aria-label={`${used} of ${limit} requests this minute`}>
      <svg viewBox="0 0 100 100" className="rate-ring-svg">
        <circle cx="50" cy="50" r={r} className="rate-ring-track" />
        <circle
          ref={ringRef}
          cx="50"
          cy="50"
          r={r}
          className="rate-ring-value"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <div className="rate-ring-label">
        <strong>{used}</strong>
        <span>/ {limit} rpm</span>
      </div>
    </div>
  );
}
