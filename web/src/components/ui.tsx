"use client";
// Reusable dashboard building blocks (blueprint Section 4.13). React escapes all text, so data strings
// (facility and ward names) are safe by default (blueprint I18N-14); never use dangerouslySetInnerHTML.
import type { ReactNode } from "react";
import { CalendarIcon } from "./icons";

export type Option<T extends string> = { value: T; label: string };

export function Banner({ text }: { text: string }) {
  // Persistent simulation banner (blueprint 6.3): visible on every page, never truncated.
  return (
    <div className="fp-banner" role="note">
      {text}
    </div>
  );
}

export function Notice({ text }: { text: string }) {
  return <div className="fp-notice">{text}</div>;
}

/**
 * Pill toggles, as in the reference dashboard. "dark" pills are grey with white text (the focus
 * toggle); "light" pills are pale grey (language, scenario). The selected pill is always blue.
 * Exactly one pill is selected.
 */
export function Pills<T extends string>({
  options,
  value,
  onChange,
  label,
  variant,
}: {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  variant: "dark" | "light";
}) {
  return (
    <div className={`fp-pills fp-pills-${variant}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="fp-pill-btn"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function DatePill({ text }: { text: string }) {
  return (
    <span className="fp-date-pill">
      <CalendarIcon />
      {text}
    </span>
  );
}

export function Placeholder({ text }: { text: string }) {
  return <div className="fp-placeholder">{text}</div>;
}

export function Card({ title, caption, children, highlight }: { title: string; caption?: string; children: ReactNode; highlight?: boolean }) {
  return (
    <section className={highlight ? "fp-card fp-focus" : "fp-card"}>
      <h3 className="fp-card-title">{title}</h3>
      {caption ? <p className="fp-card-caption">{caption}</p> : null}
      {children}
    </section>
  );
}

// Decorative, flat, dashed "no data yet" line. It is NOT data and must never look like a real trend.
function EmptySparkline() {
  return (
    <svg width="110" height="34" viewBox="0 0 110 34" aria-hidden="true">
      <line x1="4" y1="17" x2="106" y2="17" stroke="#c9cfd4" strokeWidth="2" strokeDasharray="4 5" strokeLinecap="round" />
    </svg>
  );
}

/** One KPI card: label and change line on top; value and trend area below. value=null is the skeleton. */
export function KpiCard({
  label,
  value,
  delta,
  deltaTone,
  note,
  notBuilt,
  spark,
  highlight,
  icon,
}: {
  label: string;
  value: string | null;
  delta?: string;
  deltaTone?: "good" | "bad";
  note?: string;
  spark?: ReactNode;
  notBuilt: string;
  highlight?: boolean;
  icon?: ReactNode;
}) {
  return (
    <div className={highlight ? "fp-card fp-focus" : "fp-card"}>
      <div className="fp-kpi-top">
        <span className="fp-kpi-top-left">
          {icon ? <span className="fp-kpi-icon" aria-hidden="true">{icon}</span> : null}
          <span className="fp-kpi-label fp-caps">{label}</span>
        </span>
        {delta ? <span className={`fp-kpi-delta ${deltaTone ?? ""}`}>{delta}</span> : null}
      </div>
      <div className="fp-kpi-row">
        <span className="fp-kpi-value">{value ?? "—"}</span>
        {spark ?? <EmptySparkline />}
      </div>
      <div className="fp-kpi-note">{value === null ? notBuilt : note}</div>
    </div>
  );
}

export type RailItem = { id: string; label: string; icon: ReactNode };

/** Floating icon-only rail: round logo on top, groups of icons divided by a thin line. */
export function Rail({
  groups,
  active,
  onSelect,
}: {
  groups: RailItem[][];
  active: string;
  onSelect: (id: string) => void;
}) {
  return (
    <nav className="fp-rail" aria-label="Main">
      <div className="fp-logo" aria-hidden="true">
        F
      </div>
      {groups.map((group, i) => (
        <div key={i} style={{ display: "contents" }}>
          {i > 0 && <div className="fp-rail-sep" aria-hidden="true" />}
          {group.map((item) => (
            <button
              key={item.id}
              type="button"
              className="fp-rail-btn"
              title={item.label}
              aria-current={item.id === active ? "page" : undefined}
              onClick={() => onSelect(item.id)}
            >
              {item.icon}
              <span className="fp-sr-only">{item.label}</span>
            </button>
          ))}
        </div>
      ))}
    </nav>
  );
}
