"use client";
// Route explorer: one simulated start, both routes on a map, the result panel and the written
// explanation. Everything shown comes from routes.json, written by scripts/build_routes.py; the
// explanation sentences are built in Python (src/explain.py) from computed facts, no free text.
import { useEffect, useMemo, useState } from "react";
import { CircleMarker, GeoJSON, MapContainer, Polyline, TileLayer, Tooltip } from "react-leaflet";
import type { GeoJsonObject } from "geojson";
import type { LatLngBoundsExpression, PathOptions } from "leaflet";
import "leaflet/dist/leaflet.css";
import config from "@/data/config.json";
import { t, type Lang } from "@/lib/i18n";
import { downloadAudit as saveAudit } from "@/lib/download";

type Pt = [number, number];
type RouteResult = {
  reachable: boolean;
  facility_id: string | null;
  time_min: number | null;
  baseline_facility_id: string | null;
  baseline_time_min: number | null;
  baseline_drivable: boolean;
  n_blocked: number;
  unreachable: { facility_id: string; reason: string }[];
  path: Pt[];
  baseline_path: Pt[];
  blocked_segments: Pt[][];
  explain: Record<Lang, string[]>;
};
type RoutesFile = {
  facilities: { id: string; name: string; lat: number; lon: number; verification: string; tier: string }[];
  points: { id: string; group: "start" | "origin"; lat: number; lon: number; label: string }[];
  scenarios: Record<string, Record<string, RouteResult>>;
};

const FLOOD_STYLE: PathOptions = { color: "#2c8db8", weight: 0.5, fillColor: "#5bb5e0", fillOpacity: 0.3 };
const VERIFY_KEY: Record<string, string> = {
  phone_verified: "facility.verified",
  source_listed: "facility.source_listed",
  unverified: "facility.unverified",
};
const ll = (p: Pt): [number, number] => [p[1], p[0]];

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return (await res.json()) as T;
}

export default function RouteExplorer({ scenario, lang }: { scenario: string; lang: Lang }) {
  const T = (key: string, params?: Record<string, string | number>) => t(lang, key, params);
  const [data, setData] = useState<RoutesFile | null>(null);
  const [failed, setFailed] = useState(false);
  const [flood, setFlood] = useState<Record<string, GeoJsonObject>>({});
  const [pointId, setPointId] = useState("A01");

  useEffect(() => {
    getJson<RoutesFile>("/data/routes.json").then(setData).catch(() => setFailed(true));
  }, []);
  useEffect(() => {
    if (flood[scenario]) return;
    getJson<GeoJsonObject>(`/data/flood_${scenario}.geojson`)
      .then((g) => setFlood((prev) => ({ ...prev, [scenario]: g })))
      .catch(() => undefined);
  }, [scenario, flood]);

  const [auditError, setAuditError] = useState(false);
  // Builds the file in the browser from audit.json (written by scripts/build_audit.py): the stored
  // document for this scenario and start, plus the download time and the interface language.
  const downloadAudit = async () => {
    try {
      await saveAudit(scenario, pointId, lang);
      setAuditError(false);
    } catch {
      setAuditError(true);
    }
  };
  const auditButton = (
    <div className="fp-audit">
      <button type="button" className="fp-btn" onClick={downloadAudit}>{T("button.download_audit")}</button>
      {auditError && <p className="fp-muted">{T("state.audit_missing")}</p>}
      <p className="fp-muted">{T("route.audit_hint")}</p>
    </div>
  );

  const res = data ? data.scenarios[scenario]?.[pointId] : undefined;
  const point = data?.points.find((p) => p.id === pointId);
  const facName = (id: string | null) => data?.facilities.find((f) => f.id === id)?.name ?? "";

  const bounds = useMemo<LatLngBoundsExpression>(() => {
    const [w, s, e, n] = config.study.bbox as number[];
    const pts: [number, number][] = [];
    if (res && point) {
      [...res.path, ...res.baseline_path].forEach((p) => pts.push(ll(p)));
      pts.push([point.lat, point.lon]);
    }
    if (pts.length > 1) {
      const lats = pts.map((p) => p[0]);
      const lons = pts.map((p) => p[1]);
      return [[Math.min(...lats), Math.min(...lons)], [Math.max(...lats), Math.max(...lons)]];
    }
    return [[s, w], [n, e]];
  }, [res, point]);

  if (failed) return <div className="fp-placeholder">{T("state.routes_missing")}</div>;
  if (!data) return <div className="fp-placeholder">{T("map.loading")}</div>;

  const diff = res && res.reachable && res.time_min !== null && res.baseline_time_min !== null ? res.time_min - res.baseline_time_min : null;
  const mins = (x: number | null) => (x === null ? "—" : T("route.minutes_value", { n: x.toFixed(1) }));
  const starts = data.points.filter((p) => p.group === "start");
  const origins = data.points.filter((p) => p.group === "origin");

  return (
    <div className="fp-route-grid">
      <div>
        <label className="fp-select-label" htmlFor="start-select">
          {T("route.pick_origin")}
        </label>
        <select id="start-select" className="fp-select" value={pointId} onChange={(e) => setPointId(e.target.value)}>
          <optgroup label={T("route.group_starts")}>
            {starts.map((p) => (
              <option key={p.id} value={p.id}>{p.id}</option>
            ))}
          </optgroup>
          <optgroup label={T("route.group_origins")}>
            {origins.map((p) => (
              <option key={p.id} value={p.id}>{p.id}</option>
            ))}
          </optgroup>
        </select>

        {res && (
          <>
            <dl className="fp-result">
              <dt>{T("route.chosen")}</dt>
              <dd>
                {res.reachable ? facName(res.facility_id) : T("result.unreachable")}
                {res.reachable && (() => {
                  const v = data.facilities.find((f) => f.id === res.facility_id)?.verification ?? "unverified";
                  return (
                    <span className={`fp-badge ${v === "phone_verified" ? "fp-badge-verified" : "fp-badge-caution"}`}>
                      {T(VERIFY_KEY[v])}
                    </span>
                  );
                })()}
              </dd>
              <dt>{T("route.time_fa")}</dt>
              <dd>{mins(res.time_min)}</dd>
              <dt>{T("route.time_conv")}</dt>
              <dd>{mins(res.baseline_time_min)}</dd>
              <dt>{T("route.difference")}</dt>
              <dd>{diff === null ? "—" : `${diff >= 0 ? "+" : ""}${T("route.minutes_value", { n: diff.toFixed(1) })}`}</dd>
              <dt>{T("route.drivable")}</dt>
              <dd>{res.baseline_drivable ? T("route.yes") : `${T("route.no")} (${res.n_blocked})`}</dd>
            </dl>

            <h4 className="fp-h4">{T("route.explanation")}</h4>
            <ul className="fp-explain">
              {res.explain[lang].map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>

            <h4 className="fp-h4">{T("route.unreachable_title")}</h4>
            {res.unreachable.length === 0 ? (
              <p className="fp-muted">{T("route.none")}</p>
            ) : (
              <ul className="fp-explain">
                {res.unreachable.map((u) => (
                  <li key={u.facility_id}>
                    {facName(u.facility_id)}: {T("reason." + u.reason)}
                  </li>
                ))}
              </ul>
            )}
            {auditButton}
          </>
        )}
      </div>

      <div>
        <div className="fp-map-frame fp-map-frame-tall" role="img" aria-label={T("nav.route")}>
          <MapContainer key={`${scenario}-${pointId}`} bounds={bounds} boundsOptions={{ padding: [30, 30] }} zoomSnap={0.1} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
            <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" opacity={0.8} />
            {flood[scenario] && <GeoJSON key={scenario} data={flood[scenario]} style={() => FLOOD_STYLE} />}
            {res && res.baseline_path.length > 1 && (
              <Polyline positions={res.baseline_path.map(ll)} pathOptions={{ color: "#555b61", weight: 4, dashArray: "8 8", opacity: 0.9 }} />
            )}
            {res && res.blocked_segments.map((seg, i) => (
              <Polyline key={i} positions={seg.map(ll)} pathOptions={{ color: "#c0392b", weight: 7, opacity: 0.95 }} />
            ))}
            {res && res.path.length > 1 && <Polyline positions={res.path.map(ll)} pathOptions={{ color: "#1e64b4", weight: 5 }} />}
            {data.facilities.map((f) => (
              <CircleMarker key={f.id} center={[f.lat, f.lon]} radius={9}
                pathOptions={{ color: "#fff", weight: 2, fillColor: f.id === res?.facility_id ? "#0f3f77" : "#7a8da3", fillOpacity: 1 }}>
                <Tooltip direction="top">{f.name} — {T(VERIFY_KEY[f.verification])}</Tooltip>
              </CircleMarker>
            ))}
            {point && (
              <CircleMarker center={[point.lat, point.lon]} radius={8} pathOptions={{ color: "#fff", weight: 2, fillColor: "#e08a1e", fillOpacity: 1 }}>
                <Tooltip direction="top">{point.id} — {T("route.legend_start")}</Tooltip>
              </CircleMarker>
            )}
          </MapContainer>
        </div>
        <ul className="fp-legend fp-legend-row">
          <li><span className="fp-swatch" style={{ background: "#1e64b4" }} />{T("route.flood_aware")}</li>
          <li><span className="fp-swatch" style={{ background: "#555b61" }} />{T("route.baseline")}</li>
          <li><span className="fp-swatch" style={{ background: "#c0392b" }} />{T("route.legend_blocked")}</li>
          <li><span className="fp-swatch" style={{ background: "#e08a1e" }} />{T("route.legend_start")}</li>
          <li><span className="fp-swatch" style={{ background: "#7a8da3" }} />{T("route.legend_facility")}</li>
          <li><span className="fp-swatch fp-swatch-flood" />{T("map.flood_layer")}</li>
        </ul>
        <p className="fp-map-note">{T("map.roads_note")} {T("map.tiles_note")}</p>
      </div>
    </div>
  );
}
