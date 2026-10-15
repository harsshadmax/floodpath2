"use client";
// Hand-built charts for the overview cards (no chart library). Every number comes from metrics.json,
// written by scripts/build_metrics.py; nothing here is computed from invented values.
import { fmtPct, t, type Lang } from "@/lib/i18n";

export type Origin = {
  id: string;
  facility: string | null;
  reachable: boolean;
  baseline_drivable: boolean;
  time_min: number | null;
  baseline_time_min: number | null;
  blocked_on_baseline: number;
};
export type ScenarioMetrics = {
  n_origins: number;
  share_of_reports: number | null;
  m1_time_increase_min: { mean: number | null; median: number | null; max: number | null; n: number };
  m2_false_route_rate: number;
  m2_flood_aware_route_share: number;
  m3_reach_any: number;
  m3_reach_by_facility: Record<string, number>;
  m4_coverage_flood_aware: number;
  m4_coverage_conventional: number;
  m4_coverage_difference: number;
  coverage_threshold_min: number;
  edge_classes: { passable: number; at_risk: number; blocked: number };
  origins: Origin[];
  robustness: { runs: number; overall: number; share_changed_at_least_once: number } | null;
  confidence_interval: {
    resamples: number;
    percentiles: [number, number];
    m1_time_increase_min: [number, number] | null;
    m3_reach_any: [number, number] | null;
    m4_coverage_flood_aware: [number, number] | null;
  };
};
export type MetricsFile = {
  population_basis?: string;
  facilities: { id: string; name: string; verification: string }[];
  excluded_facilities?: { facility_id: string; reason: string }[];
  scenarios: Record<string, ScenarioMetrics>;
  n_origins: number;
};

const SIM = ["observed", "mild", "moderate", "severe"] as const;

function Bar({ label, value, color, text }: { label: string; value: number; color: string; text?: string }) {
  return (
    <div className="fp-bar-row">
      <span className="fp-bar-label">{label}</span>
      <span className="fp-bar-track">
        <span className="fp-bar-fill" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }} />
      </span>
      <span className="fp-bar-value">{text ?? fmtPct(value)}</span>
    </div>
  );
}

/** C2: coverage within the threshold, conventional against flood-aware, for the three simulated scenarios. */
export function CoverageByScenario({ lang, metrics }: { lang: Lang; metrics: MetricsFile }) {
  const T = (k: string, p?: Record<string, string | number>) => t(lang, k, p);
  return (
    <div className="fp-chart">
      {SIM.map((s) => {
        const m = metrics.scenarios[s];
        return (
          <div key={s} className="fp-chart-group">
            <div className="fp-chart-group-title">{T("scenario." + s)}</div>
            <Bar label={T("chart.conventional")} value={m.m4_coverage_conventional} color="#9fb4c9" />
            <Bar label={T("chart.flood_aware")} value={m.m4_coverage_flood_aware} color="var(--blue)" />
          </div>
        );
      })}
      <p className="fp-chart-note">{T("chart.share_origins")}, {metrics.scenarios.mild.coverage_threshold_min} {T("unit.minutes")}</p>
    </div>
  );
}

/** C4: road segments by class for the selected scenario, as one stacked bar and a legend. */
export function EdgeClasses({ lang, m }: { lang: Lang; m: ScenarioMetrics }) {
  const T = (k: string, p?: Record<string, string | number>) => t(lang, k, p);
  const c = m.edge_classes;
  const total = c.passable + c.at_risk + c.blocked;
  const parts = [
    { key: "passable", n: c.passable, color: "#4aa3df" },
    { key: "at_risk", n: c.at_risk, color: "#e08a1e" },
    { key: "blocked", n: c.blocked, color: "#c0392b" },
  ];
  return (
    <div className="fp-chart">
      <div className="fp-stack-bar" role="img" aria-label={parts.map((p) => `${T("class." + p.key)} ${p.n}`).join(", ")}>
        {parts.map((p) => (
          <span key={p.key} style={{ width: `${(p.n / total) * 100}%`, background: p.color }} />
        ))}
      </div>
      <ul className="fp-legend">
        {parts.map((p) => (
          <li key={p.key}>
            <span className="fp-swatch" style={{ background: p.color }} />
            <span>{T("class." + p.key)}</span>
            <span className="fp-legend-n">
              {p.n.toLocaleString("en-IN")} ({fmtPct(p.n / total)})
            </span>
          </li>
        ))}
      </ul>
      <p className="fp-chart-note">{T("chart.segments", { n: total.toLocaleString("en-IN") })}</p>
    </div>
  );
}

/** C5: share of sample origins that can still reach each facility. */
export function ReachByFacility({ lang, m, metrics }: { lang: Lang; m: ScenarioMetrics; metrics: MetricsFile }) {
  const T = (k: string, params?: Record<string, string | number>) => t(lang, k, params);
  const allUnverified = metrics.facilities.every((f) => f.verification !== "phone_verified");
  return (
    <div className="fp-chart">
      {metrics.facilities.map((f) => (
        <Bar
          key={f.id}
          label={`${f.id} · ${f.name.replace(/^GCC emergency obstetric unit, /, "").replace(/ \(.*\)$/, "")}${f.verification !== "phone_verified" ? " †" : ""}`}
          value={m.m3_reach_by_facility[f.id] ?? 0}
          color="var(--blue)"
        />
      ))}
      <p className="fp-chart-note">{T("chart.share_origins")}</p>
      {allUnverified ? <p className="fp-chart-note fp-chart-note-caution">† {T("chart.facilities_unverified")}</p> : null}
      {metrics.excluded_facilities && metrics.excluded_facilities.length > 0 ? (
        <p className="fp-chart-note">
          {T("chart.facilities_excluded", {
            n: metrics.excluded_facilities.length,
            ids: metrics.excluded_facilities.map((f) => f.facility_id).join(", "),
          })}
        </p>
      ) : null}
    </div>
  );
}

/** C6: origins ranked by travel-time increase; cut-off origins first. */
export function TopOrigins({ lang, m }: { lang: Lang; m: ScenarioMetrics }) {
  const T = (k: string) => t(lang, k);
  const rows = m.origins
    .map((o) => {
      const cutOff = !o.reachable;
      const extra = o.reachable && o.time_min !== null && o.baseline_time_min !== null ? o.time_min - o.baseline_time_min : null;
      return { id: o.id, cutOff, extra, drivable: o.baseline_drivable };
    })
    .sort((a, b) => (a.cutOff === b.cutOff ? (b.extra ?? -1) - (a.extra ?? -1) : a.cutOff ? -1 : 1))
    .slice(0, 6);
  return (
    <table className="fp-table fp-table-compact">
      <thead>
        <tr>
          <th>{T("chart.origin_col")}</th>
          <th>{T("chart.extra_col")}</th>
          <th>{T("chart.status_col")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td className="fp-mono">{r.id}</td>
            <td>{r.extra === null ? "—" : r.extra.toFixed(1)}</td>
            <td>{r.cutOff ? T("chart.cut_off") : r.drivable ? T("chart.same_route") : T("chart.detour")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Small real trend line across mild, moderate, severe with a dot on the selected scenario. */
export function Spark({ values, selected }: { values: (number | null)[]; selected: number }) {
  const pts = values.map((v, i) => (v === null ? null : { x: 6 + i * 49, v }));
  const nums = values.filter((v): v is number => v !== null);
  if (nums.length < 2) return null;
  const lo = Math.min(...nums);
  const hi = Math.max(...nums);
  const y = (v: number) => (hi === lo ? 17 : 30 - ((v - lo) / (hi - lo)) * 26);
  const drawn = pts.filter((p): p is { x: number; v: number } => p !== null);
  return (
    <svg width="110" height="34" viewBox="0 0 110 34" aria-hidden="true">
      <polyline fill="none" stroke="var(--blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        points={drawn.map((p) => `${p.x},${y(p.v)}`).join(" ")} />
      {pts.map((p, i) => p && <circle key={i} cx={p.x} cy={y(p.v)} r={i === selected ? 4 : 2.5} fill={i === selected ? "var(--blue-deep)" : "var(--blue)"} />)}
    </svg>
  );
}
