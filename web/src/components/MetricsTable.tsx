"use client";
// Metrics table: the five metrics for the three simulated scenarios, from metrics.json
// (scripts/build_metrics.py). Also provides the CSV used by the Export page.
import { useEffect, useState } from "react";
import { fmtPct, t, type Lang } from "@/lib/i18n";
import { getJson, toCsv } from "@/lib/download";
import type { MetricsFile } from "./Charts";

const SIM = ["observed", "mild", "moderate", "severe"] as const;
type Row = { key: string; label: string; english: string; values: (string | null)[]; raw: (number | string | null)[] };

export function useMetrics() {
  const [data, setData] = useState<MetricsFile | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    getJson<MetricsFile>("/data/metrics.json").then(setData).catch(() => setFailed(true));
  }, []);
  return { data, failed };
}

/** Rows with a translated label, an English name for the CSV, formatted and raw values per scenario. */
export function metricRows(data: MetricsFile, lang: Lang): Row[] {
  const T = (k: string, p?: Record<string, string | number>) => t(lang, k, p);
  const S = data.scenarios;
  const min = S.mild.coverage_threshold_min;
  const num = (x: number | null, d = 1) => (x === null ? null : x.toFixed(d));
  const pct = (x: number) => fmtPct(x);
  const ciText = (range: [number, number] | null, fmt: (x: number) => string) =>
    range ? `${fmt(range[0])}–${fmt(range[1])}` : null;
  const rows: Row[] = [
    { key: "m1_mean_min", label: T("metrics.m1_mean"), english: "M1 travel-time increase, mean (min)",
      raw: SIM.map((s) => S[s].m1_time_increase_min.mean), values: SIM.map((s) => num(S[s].m1_time_increase_min.mean)) },
    { key: "m1_median_min", label: T("metrics.m1_median"), english: "M1 travel-time increase, median (min)",
      raw: SIM.map((s) => S[s].m1_time_increase_min.median), values: SIM.map((s) => num(S[s].m1_time_increase_min.median)) },
    { key: "m1_max_min", label: T("metrics.m1_max"), english: "M1 travel-time increase, maximum (min)",
      raw: SIM.map((s) => S[s].m1_time_increase_min.max), values: SIM.map((s) => num(S[s].m1_time_increase_min.max)) },
    { key: "m1_origins", label: T("metrics.m1_n"), english: "M1 origins included",
      raw: SIM.map((s) => S[s].m1_time_increase_min.n), values: SIM.map((s) => String(S[s].m1_time_increase_min.n)) },
    { key: "m1_ci", label: T("metrics.m1_ci"), english: "M1 travel-time increase, 90% bootstrap range (min)",
      raw: SIM.map((s) => ciText(S[s].confidence_interval.m1_time_increase_min, (x) => x.toFixed(1))),
      values: SIM.map((s) => ciText(S[s].confidence_interval.m1_time_increase_min, (x) => x.toFixed(1))) },
    { key: "m2_false_route_rate", label: T("metrics.m2_false"), english: "M2 conventional routes crossing a blocked road (share)",
      raw: SIM.map((s) => S[s].m2_false_route_rate), values: SIM.map((s) => pct(S[s].m2_false_route_rate)) },
    { key: "m2_flood_aware_route_share", label: T("metrics.m2_fa"), english: "M2 origins with a flood-aware route (share)",
      raw: SIM.map((s) => S[s].m2_flood_aware_route_share), values: SIM.map((s) => pct(S[s].m2_flood_aware_route_share)) },
    { key: "m3_reach_any", label: T("metrics.m3_any"), english: "M3 origins reaching at least one facility (share)",
      raw: SIM.map((s) => S[s].m3_reach_any), values: SIM.map((s) => pct(S[s].m3_reach_any)) },
    { key: "m3_ci", label: T("metrics.m3_ci"), english: "M3 origins reaching at least one facility, 90% bootstrap range",
      raw: SIM.map((s) => ciText(S[s].confidence_interval.m3_reach_any, pct)),
      values: SIM.map((s) => ciText(S[s].confidence_interval.m3_reach_any, pct)) },
    ...data.facilities.map((f) => ({
      key: `m3_reach_${f.id}`, label: T("metrics.m3_fac", { facility: f.id + " " + f.name.replace(/^GCC emergency obstetric unit, /, "").replace(/ \(.*\)$/, "") }),
      english: `M3 origins reaching ${f.id} (share)`,
      raw: SIM.map((s) => S[s].m3_reach_by_facility[f.id]), values: SIM.map((s) => pct(S[s].m3_reach_by_facility[f.id])),
    })),
    { key: "m4_coverage_conventional", label: T("metrics.m4_conv", { min }), english: `M4 coverage within ${min} min, conventional (share)`,
      raw: SIM.map((s) => S[s].m4_coverage_conventional), values: SIM.map((s) => pct(S[s].m4_coverage_conventional)) },
    { key: "m4_coverage_flood_aware", label: T("metrics.m4_fa", { min }), english: `M4 coverage within ${min} min, flood-aware (share)`,
      raw: SIM.map((s) => S[s].m4_coverage_flood_aware), values: SIM.map((s) => pct(S[s].m4_coverage_flood_aware)) },
    { key: "m4_ci", label: T("metrics.m4_ci", { min }), english: `M4 coverage within ${min} min, flood-aware, 90% bootstrap range`,
      raw: SIM.map((s) => ciText(S[s].confidence_interval.m4_coverage_flood_aware, pct)),
      values: SIM.map((s) => ciText(S[s].confidence_interval.m4_coverage_flood_aware, pct)) },
    { key: "m4_coverage_difference", label: T("metrics.m4_diff"), english: "M4 coverage difference (share, flood-aware minus conventional)",
      raw: SIM.map((s) => S[s].m4_coverage_difference), values: SIM.map((s) => (S[s].m4_coverage_difference * 100).toFixed(1)) },
    { key: "m5_robustness", label: T("metrics.m5_overall"), english: "M5 routing robustness (share)",
      raw: SIM.map((s) => S[s].robustness?.overall ?? null), values: SIM.map((s) => { const r = S[s].robustness; return r ? pct(r.overall) : null; }) },
    { key: "m5_changed", label: T("metrics.m5_changed"), english: "M5 origins whose facility changed in at least one run (share)",
      raw: SIM.map((s) => S[s].robustness?.share_changed_at_least_once ?? null), values: SIM.map((s) => { const r = S[s].robustness; return r ? pct(r.share_changed_at_least_once) : null; }) },
  ];
  return rows;
}

export function metricsCsv(data: MetricsFile, lang: string): string {
  const rows = metricRows(data, "en").map((r) => ({
    ui_language: lang, metric_key: r.key, metric: r.english, observed: r.raw[0], mild: r.raw[1], moderate: r.raw[2], severe: r.raw[3],
    kind: "observed composite and simulated", note: "indicative simulation; not a prediction; coverage is a share of sample points",
  }));
  return toCsv(["ui_language", "metric_key", "metric", "observed", "mild", "moderate", "severe", "kind", "note"], rows);
}

export default function MetricsTable({ scenario, lang }: { scenario: string; lang: Lang }) {
  const T = (k: string, p?: Record<string, string | number>) => t(lang, k, p);
  const { data, failed } = useMetrics();
  if (failed) return <div className="fp-placeholder">{T("state.metrics_missing")}</div>;
  if (!data) return <div className="fp-placeholder">{T("map.loading")}</div>;
  const rows = metricRows(data, lang);
  return (
    <div>
      <p className="fp-metrics-note">{T("note.indicative_metrics")}</p>
      <table className="fp-table">
        <thead>
          <tr>
            <th>{T("metrics.col_metric")}</th>
            {SIM.map((s) => (
              <th key={s} className={s === scenario ? "fp-col-selected" : undefined}>{T("scenario." + s)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td>{r.label}</td>
              {r.values.map((v, i) => (
                <td key={i} className={SIM[i] === scenario ? "fp-col-selected" : undefined}>{v ?? "—"}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="fp-chart-note">{T(data.population_basis === "ward_census_2011" ? "metrics.note_weighted" : "metrics.note", { n: data.n_origins, runs: (data.scenarios.mild.robustness?.runs ?? 0) })}</p>
    </div>
  );
}
