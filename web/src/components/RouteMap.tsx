"use client";
// Card C1: the study-zone map with the flood layer for the selected scenario and the road outline
// (blueprint 6.6, preview checkpoint CP-2). It reads files the Python pipeline wrote to
// public/data/ (scripts/build_phase2.py). No routes, facilities or road classes yet (later phases).
import { useEffect, useState } from "react";
import { GeoJSON, MapContainer, Rectangle, TileLayer } from "react-leaflet";
import type { GeoJsonObject } from "geojson";
import type { PathOptions } from "leaflet";
import "leaflet/dist/leaflet.css";
import config from "@/data/config.json";
import { fmtPct, t, type Lang } from "@/lib/i18n";

type Manifest = {
  flood: { stats: { zone_area_km2: number; scenario_area_km2: Record<string, number> } };
};

const FLOOD_STYLE: PathOptions = { color: "#2c8db8", weight: 0.5, fillColor: "#5bb5e0", fillOpacity: 0.33 };
// Major roads dark and thicker, minor roads pale and thin, so the dense network stays readable.
const MAJOR_ROADS = new Set([
  "motorway", "trunk", "primary", "secondary", "tertiary",
  "motorway_link", "trunk_link", "primary_link", "secondary_link", "tertiary_link",
]);
const ROAD_MAJOR: PathOptions = { color: "#3d464d", weight: 1.8, opacity: 0.9 };
const ROAD_MINOR: PathOptions = { color: "#8d979e", weight: 0.5, opacity: 0.6 };
const roadStyle = (feature?: { properties?: { highway?: string } | null }): PathOptions =>
  MAJOR_ROADS.has(feature?.properties?.highway ?? "") ? ROAD_MAJOR : ROAD_MINOR;
const ZONE_STYLE: PathOptions = { color: "#1e64b4", weight: 2, dashArray: "6 6", fill: false };

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return (await res.json()) as T;
}

export default function RouteMap({ scenario, lang }: { scenario: string; lang: Lang }) {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [roads, setRoads] = useState<GeoJsonObject | null>(null);
  const [flood, setFlood] = useState<Record<string, GeoJsonObject>>({});
  const [failed, setFailed] = useState(false);
  const [showFlood, setShowFlood] = useState(true);
  const [showRoads, setShowRoads] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getJson<Manifest>("/data/manifest.json"), getJson<GeoJsonObject>("/data/roads.geojson")])
      .then(([m, r]) => {
        if (!cancelled) {
          setManifest(m);
          setRoads(r);
        }
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (flood[scenario]) return;
    getJson<GeoJsonObject>(`/data/flood_${scenario}.geojson`)
      .then((g) => !cancelled && setFlood((prev) => ({ ...prev, [scenario]: g })))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [scenario, flood]);

  const T = (key: string, params?: Record<string, string | number>) => t(lang, key, params);
  if (failed) return <div className="fp-placeholder">{T("map.error")}</div>;

  const [west, south, east, north] = config.study.bbox as number[];
  const stats = manifest?.flood.stats;
  const area = stats?.scenario_area_km2[scenario];
  const statsText =
    stats && area !== undefined
      ? T("map.area_stats", { area: area.toFixed(1), zone: stats.zone_area_km2.toFixed(1), pct: fmtPct(area / stats.zone_area_km2) })
      : T("map.loading");

  return (
    <div>
      <div className="fp-map-frame" role="img" aria-label={T("card.map")}>
        {/* Floating layer panel over the map (PHASE 13 UI reference pass), instead of plain
            checkboxes above it -- same two controls, styled like the reference's "All Layers" box. */}
        <div className="fp-map-toggles fp-map-toggles-float">
          <label>
            <input type="checkbox" checked={showFlood} onChange={(e) => setShowFlood(e.target.checked)} /> {T("map.flood_layer")}
          </label>
          <label>
            <input type="checkbox" checked={showRoads} onChange={(e) => setShowRoads(e.target.checked)} /> {T("map.roads_layer")}
          </label>
        </div>
        <MapContainer
          bounds={[
            [south, west],
            [north, east],
          ]}
          boundsOptions={{ padding: [6, 6] }}
          zoomSnap={0.1}
          scrollWheelZoom={false}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            opacity={0.55}
          />
          {/* flood first, roads on top, so the roads stay readable inside flooded areas */}
          {showFlood && flood[scenario] && <GeoJSON key={scenario} data={flood[scenario]} style={() => FLOOD_STYLE} />}
          {showRoads && roads && <GeoJSON data={roads} style={roadStyle} />}
          <Rectangle
            bounds={[
              [south, west],
              [north, east],
            ]}
            pathOptions={ZONE_STYLE}
          />
        </MapContainer>
      </div>
      <p className="fp-map-note">
        <span className="fp-swatch fp-swatch-flood" /> {T("map.flood_layer")} &nbsp;
        <span className="fp-swatch fp-swatch-zone" /> {T("map.zone")}
      </p>
      <p className="fp-map-note">{statsText}</p>
      <p className="fp-map-note">{T("map.roads_note")} {T("map.tiles_note")}</p>
      <p className="fp-map-note">{T("map.attribution")}</p>
    </div>
  );
}
