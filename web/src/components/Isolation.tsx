"use client";
// Isolation priority view (extra view). Zones are 1 km grid cells with placeholder weights, so the
// ranking follows the share of road nodes cut off, not people (see the notes shown on the page).
// All numbers come from isolation.json, written by scripts/build_isolation.py.
import { useMemo, useState } from "react";
import { GeoJSON, MapContainer, TileLayer } from "react-leaflet";
import type { Layer, PathOptions } from "leaflet";
import "leaflet/dist/leaflet.css";
import config from "@/data/config.json";
import { fmtInt, fmtPct, t, type Lang } from "@/lib/i18n";
import { saveFile } from "@/lib/download";
import { isolationCsv, SIM, useIsolation } from "./isolationData";

const SHADES = ["#e8f1fa", "#bcd6ee", "#7fb0dc", "#3f83c6", "#174e8f"];

/** Card C3 on the overview: the top five zones for the selected scenario. */
export function IsolationTop({ scenario, lang }: { scenario: string; lang: Lang }) {
  const T = (k: string) => t(lang, k);
  const { data, failed } = useIsolation();
  if (failed) return <div className="fp-placeholder">{T("state.not_built")}</div>;
  if (!data) return <div className="fp-placeholder">{T("map.loading")}</div>;
  const rows = data.scenarios[scenario].units.slice(0, 5);
  return (
    <div className="fp-chart">
      <table className="fp-table fp-table-compact">
        <thead>
          <tr>
            <th>{T("label.rank")}</th>
            <th>{T(data.population_basis === "ward_census_2011" ? "label.ward" : "iso.unit")}</th>
            <th>{T("iso.isolated_share")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.unit_id}>
              <td>{u.rank}</td>
              <td className="fp-mono">{unitLabel(u)}</td>
              <td>{fmtPct(u.isolated_share)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="fp-chart-note">{T(data.population_basis === "ward_census_2011" ? "iso.units_note_wards" : "iso.units_note")}</p>
    </div>
  );
}

type SortKey = "rank" | "unit_id" | "isolated_share" | "delayed_share" | "priority_score" | "estimated_people_isolated";
const unitLabel = (u: { unit_name: string }) => u.unit_name.replace(/^Zone /, "");

export default function IsolationPage({ scenario, lang }: { scenario: string; lang: Lang }) {
  const T = (k: string, p?: Record<string, string | number>) => t(lang, k, p);
  const { data, failed } = useIsolation();
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: "rank", asc: true });

  const units = useMemo(() => (data ? data.scenarios[scenario].units : []), [data, scenario]);
  const byId = useMemo(() => new Map(units.map((u) => [u.unit_id, u])), [units]);
  const sorted = useMemo(() => {
    const dir = sort.asc ? 1 : -1;
    return [...units].sort((a, b) => {
      const x = a[sort.key];
      const y = b[sort.key];
      return (typeof x === "string" ? x.localeCompare(y as string) : (x as number) - (y as number)) * dir;
    });
  }, [units, sort]);

  if (failed) return <div className="fp-placeholder">{T("state.not_built")}</div>;
  if (!data) return <div className="fp-placeholder">{T("map.loading")}</div>;

  const scores = units.map((u) => u.priority_score).sort((a, b) => a - b);
  const shade = (score: number) => {
    // quantile band 0..4: the share of zones scoring at or below this one; ties take the upper band,
    // so a scenario where every zone is fully cut off is drawn in the darkest shade, not the lightest
    const atOrBelow = scores.filter((v) => v <= score).length;
    return SHADES[Math.min(4, Math.floor(((atOrBelow - 1) / scores.length) * 5))];
  };
  const styleFor = (feature?: { properties?: { unit_id?: string } | null }): PathOptions => {
    const u = byId.get(feature?.properties?.unit_id ?? "");
    return { color: "#ffffff", weight: 1, fillColor: u ? shade(u.priority_score) : "#eee", fillOpacity: 0.72 };
  };
  const onEach = (feature: { properties?: { unit_id?: string } | null }, layer: Layer) => {
    const u = byId.get(feature.properties?.unit_id ?? "");
    if (!u) return;
    // Leaflet registers tooltip handlers once per layer, so bind exactly one tooltip: a permanent rank
    // label for the top zones, a hover label for the rest. Details for every zone open on click.
    layer.bindPopup(`${unitLabel(u)}: #${u.rank} · ${fmtPct(u.isolated_share)}`);
    if (u.rank <= data.top_k) layer.bindTooltip(String(u.rank), { permanent: true, direction: "center", className: "fp-rank" });
    else layer.bindTooltip(`${unitLabel(u)}: #${u.rank}`, { sticky: true });
  };

  const wards = data.population_basis === "ward_census_2011";
  const [west, south, east, north] = config.study.bbox as number[];
  const head = (key: SortKey, label: string) => (
    <th aria-sort={sort.key === key ? (sort.asc ? "ascending" : "descending") : "none"}>
      <button type="button" className="fp-sort" onClick={() => setSort((s) => ({ key, asc: s.key === key ? !s.asc : true }))}>
        {label}{sort.key === key ? (sort.asc ? " ▲" : " ▼") : ""}
      </button>
    </th>
  );
  const prevScenario = (s: string) => SIM[SIM.indexOf(s as (typeof SIM)[number]) - 1];

  return (
    <div>
      <p className="fp-metrics-note">{T("note.indicative_metrics")}</p>
      {!wards && <p className="fp-metrics-note">{T("label.placeholder_weights")}</p>}
      <div className="fp-iso-grid">
        <div>
          <div className="fp-map-frame fp-map-frame-tall" role="img" aria-label={T("nav.isolation")}>
            <MapContainer key={scenario} bounds={[[south, west], [north, east]]} boundsOptions={{ padding: [6, 6] }} zoomSnap={0.1}
              scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
              <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" opacity={0.5} />
              <GeoJSON key={scenario} data={data.cells} style={styleFor} onEachFeature={onEach} />
            </MapContainer>
          </div>
          <p className="fp-chart-note">{T("iso.legend_rank", { k: data.top_k })}</p>
          <p className="fp-chart-note">{T(wards ? "iso.units_note_wards" : "iso.units_note")}</p>
          {data.scenarios[scenario].nodes_baseline_disconnected > 0 && (
            <p className="fp-chart-note">{T("iso.excluded_baseline", { n: data.scenarios[scenario].nodes_baseline_disconnected })}</p>
          )}
        </div>
        <div className="fp-iso-table">
          <table className="fp-table fp-table-compact">
            <thead>
              <tr>
                {head("rank", T("label.rank"))}
                {head("unit_id", T(wards ? "label.ward" : "iso.unit"))}
                {head("isolated_share", T("iso.isolated_share"))}
                {head("delayed_share", T("iso.delayed_share"))}
                {wards && head("estimated_people_isolated", T("label.est_people_isolated"))}
                {head("priority_score", T("iso.score"))}
              </tr>
            </thead>
            <tbody>
              {sorted.slice(0, 15).map((u) => (
                <tr key={u.unit_id}>
                  <td>{u.rank}</td>
                  <td className="fp-mono">{unitLabel(u)}</td>
                  <td>{fmtPct(u.isolated_share)}</td>
                  <td>{fmtPct(u.delayed_share)}</td>
                  {wards && <td>{fmtInt(u.estimated_people_isolated)}</td>}
                  <td>{u.priority_score.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="fp-chart-note">
            {T("iso.basis")}: {wards ? T("iso.basis_census") : `${T("iso.basis_placeholder")}; ${T("iso.people_col")}`}
          </p>
          <button type="button" className="fp-btn" onClick={() => saveFile(`floodpath_isolation_${scenario}.csv`, "text/csv", isolationCsv(data, lang, [scenario]))}>
            {T("button.download_csv")}
          </button>
        </div>
      </div>

      <h4 className="fp-h4">{T(wards ? "iso.top_by_scenario_wards" : "iso.top_by_scenario")}</h4>
      <div className="fp-iso-compare">
        {SIM.map((s) => {
          const prev = prevScenario(s);
          const prevRank = prev ? new Map(data.scenarios[prev].units.map((u) => [u.unit_id, u.rank])) : null;
          return (
            <div key={s} className={s === scenario ? "fp-iso-col selected" : "fp-iso-col"}>
              <strong>{T("scenario." + s)}</strong>
              <ol>
                {data.scenarios[s].units.slice(0, 5).map((u) => {
                  const before = prevRank?.get(u.unit_id);
                  const delta = before === undefined ? null : before - u.rank;
                  return (
                    <li key={u.unit_id}>
                      <span className="fp-mono">{unitLabel(u)}</span> {fmtPct(u.isolated_share)}
                      {prevRank && (
                        <span className="fp-rank-change" title={T("iso.rank_change")}>
                          {delta === null ? ` ${T("iso.new_in_top")}` : delta > 0 ? ` ▲${delta}` : delta < 0 ? ` ▼${-delta}` : " ="}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          );
        })}
      </div>
      <p className="fp-chart-note">{T("iso.rank_change")}</p>

      <h4 className="fp-h4">{T("iso.limits_title")}</h4>
      <ul className="fp-explain">
        {[1, 2, 3, 4, 5].map((i) => (
          <li key={i}>{T(i === 2 && wards ? "iso.limit2_wards" : "iso.limit" + i)}</li>
        ))}
      </ul>
    </div>
  );
}
