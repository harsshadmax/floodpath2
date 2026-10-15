"""Facilities, simulated ambulance starts and sample origins (blueprint Sections 3.3 to 3.5, 4.6 and 5.5).

Facilities are the 5 GCC 24x7 emergency obstetric units from the OpenCity maternity file. That file has
no names (only an address and a code), so names here are derived from the address locality. No
facility has been phone-verified, so every row is `unverified`: this is a proxy list, not a clinical
certification (standing gap 1). Ambulance starts and origins are SIMULATED.
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Dict, List

import geopandas as gpd
import networkx as nx
import numpy as np
import pandas as pd
from shapely import points as shapely_points

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from config import CONFIG, Config  # noqa: E402
from src import impact  # noqa: E402

FACILITIES_CSV = ROOT / "data" / "facilities.csv"
STARTS_CSV = ROOT / "data" / "ambulance_starts.csv"
KML = ROOT / "data" / "raw" / "D5__Chennai_Maternity_Hospitals_Map.kml"
COLUMNS = ["facility_id", "name", "latitude", "longitude", "service", "tier", "verification_status",
           "source", "verified_on", "notes"]
# locality read from the ADDRESS field of each unit (FINAL_CODE -> locality)
LOCALITY = {"EOCU_GCHM1": "Purasaiwalkam", "EOCU_GCHM2": "Shenoy Nagar", "EOCU_GCHM3": "Saidapet",
            "EOCU_GCHM4": "Mugalivakkam", "EOCU_GCHM5": "Thoraipakkam"}


class FacilityError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(f"{code}: {message}")
        self.code = code


def build_starter_csv(path: Path = FACILITIES_CSV, kml: Path = KML) -> pd.DataFrame:
    """Tier B rows from the D5 maternity file. All unverified; service from the file's TYPE text."""
    g = gpd.read_file(kml, driver="KML").sort_values("FINAL_CODE").reset_index(drop=True)
    rows = []
    for i, r in enumerate(g.itertuples(index=False), start=1):
        code = r.FINAL_CODE
        address = " ".join(str(r.ADDRESS).split())
        rows.append({
            "facility_id": f"F{i:02d}",
            "name": f"GCC emergency obstetric unit, {LOCALITY.get(code, code)} ({code})",
            "latitude": round(r.geometry.y, 6), "longitude": round(r.geometry.x, 6),
            "service": "emergency_obstetric", "tier": "B", "verification_status": "unverified",
            "source": "OpenCity D5 Chennai Maternity Hospitals Map", "verified_on": "",
            "notes": f"Original address: {address}. Name derived from the address; not phone-verified.",
        })
    df = pd.DataFrame(rows, columns=COLUMNS)
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(path, index=False)
    return df


def load_facilities(path: Path = FACILITIES_CSV) -> pd.DataFrame:
    """Load and validate facilities.csv (rule V-1: phone_verified needs a source and a verified_on date)."""
    df = pd.read_csv(path, dtype=str, keep_default_na=False)
    if df["facility_id"].duplicated().any():
        raise FacilityError("FACILITY_VERIFICATION_INVALID", "duplicate facility_id")
    if not set(df["verification_status"]) <= {"unverified", "source_listed", "phone_verified"}:
        raise FacilityError("FACILITY_VERIFICATION_INVALID", "unknown verification_status")
    pv = df[df["verification_status"] == "phone_verified"]
    bad = pv[(pv["source"].str.strip() == "") | (pd.to_datetime(pv["verified_on"], errors="coerce").isna())]
    if not bad.empty:
        raise FacilityError("FACILITY_VERIFICATION_INVALID",
                            f"phone_verified rows without source or valid verified_on: {list(bad['facility_id'])}")
    df["latitude"], df["longitude"] = df["latitude"].astype(float), df["longitude"].astype(float)
    return df


def _node_xy_metric(G: nx.MultiDiGraph, cfg: Config):
    ids = np.array(list(G.nodes))
    pts = gpd.GeoSeries(gpd.points_from_xy([G.nodes[n]["x"] for n in ids], [G.nodes[n]["y"] for n in ids]),
                        crs=cfg.CRS_GEO).to_crs(cfg.CRS_METRIC)
    return ids, np.column_stack([pts.x.values, pts.y.values])


def snap(G: nx.MultiDiGraph, lons, lats, cfg: Config = CONFIG):
    """Nearest graph node and distance in metres for each point (brute force; the graph is small)."""
    ids, xy = _node_xy_metric(G, cfg)
    p = gpd.GeoSeries(gpd.points_from_xy(lons, lats), crs=cfg.CRS_GEO).to_crs(cfg.CRS_METRIC)
    out_nodes, out_dist = [], []
    for x, y in zip(p.x.values, p.y.values):
        d = np.hypot(xy[:, 0] - x, xy[:, 1] - y)
        j = int(d.argmin())
        out_nodes.append(int(ids[j]))
        out_dist.append(float(d[j]))
    return out_nodes, out_dist


def suitable_facilities(df: pd.DataFrame, G: nx.MultiDiGraph, service: str = "emergency_obstetric",
                        cfg: Config = CONFIG):
    """Facilities offering `service` (never `unknown`, rule V-2), snapped to nodes.

    Returns (suitable table with node_id and snap_m, list of excluded facility dicts with a reason).
    """
    excluded: List[Dict[str, str]] = []
    keep = df[df["service"] == service].copy()
    for f in df[df["service"] != service]["facility_id"]:
        excluded.append({"facility_id": f, "reason": "SERVICE_NOT_CONFIRMED"})
    if not cfg.INCLUDE_UNVERIFIED_FACILITIES:
        for f in keep[keep["verification_status"] == "unverified"]["facility_id"]:
            excluded.append({"facility_id": f, "reason": "UNVERIFIED_EXCLUDED_BY_SETTING"})
        keep = keep[keep["verification_status"] != "unverified"]
    if keep.empty:
        return keep.assign(node_id=pd.Series(dtype=int), snap_m=pd.Series(dtype=float)), excluded
    nodes, dists = snap(G, keep["longitude"].values, keep["latitude"].values, cfg)
    keep["node_id"], keep["snap_m"] = nodes, dists
    far = keep["snap_m"] > cfg.MAX_SNAP_DISTANCE_M
    for f in keep[far]["facility_id"]:
        excluded.append({"facility_id": f, "reason": "OUTSIDE_ROAD_GRAPH_SNAP_TOO_FAR"})
    return keep[~far].reset_index(drop=True), excluded


def sample_origins(G: nx.MultiDiGraph, observed_m, cfg: Config = CONFIG, seed: int | None = None,
                   node_weight: Dict[int, float] | None = None) -> pd.DataFrame:
    """N_ORIGINS graph nodes, seeded, with at least MIN_FLOOD_ADJACENT_ORIGINS within
    FLOOD_ADJACENT_RADIUS_M of the observed composite. Nodes come from the largest strongly connected
    component so a baseline route exists.

    `node_weight` (node_id -> ward population) makes the draw population-proportional: a node in a
    populous ward is more likely to be picked, so a larger sample concentrates where more people are,
    instead of giving every ward exactly one origin regardless of size. Nodes with no weight (outside
    any ward, or ward data unavailable) get the smallest observed weight, not zero, so they can still
    be drawn. Without `node_weight` the draw is uniform, and population_weight is set after the fact
    by wards.attach_to_origins (or stays the placeholder 1.0 if ward data is unavailable)."""
    rng = np.random.default_rng(cfg.RANDOM_SEED if seed is None else seed)
    scc = max(nx.strongly_connected_components(G), key=len)
    ids, xy = _node_xy_metric(G, cfg)
    in_scc = np.array([n in scc for n in ids])
    dist_to_flood = impact.distance_to_flood(shapely_points(xy), observed_m)
    near = in_scc & (dist_to_flood <= cfg.FLOOD_ADJACENT_RADIUS_M)

    def _draw(pool_idx: np.ndarray, size: int) -> np.ndarray:
        if size <= 0 or len(pool_idx) == 0:
            return np.array([], dtype=int)
        size = min(size, len(pool_idx))
        p = None
        if node_weight:
            w = np.array([node_weight.get(int(ids[j]), np.nan) for j in pool_idx], dtype=float)
            if np.isfinite(w).any():
                floor = np.nanmin(w[w > 0]) if np.any(w > 0) else 1.0
                w = np.where(np.isfinite(w) & (w > 0), w, floor)
                p = w / w.sum()
        return rng.choice(pool_idx, size=size, replace=False, p=p)

    n_near = min(cfg.MIN_FLOOD_ADJACENT_ORIGINS, int(near.sum()))
    pick_near = _draw(np.flatnonzero(near), n_near)
    rest = np.setdiff1d(np.flatnonzero(in_scc), pick_near)
    pick_rest = _draw(rest, cfg.N_ORIGINS - len(pick_near))
    chosen = np.concatenate([pick_near, pick_rest]).astype(int)
    rows = [{"origin_id": f"O{i + 1:03d}", "node_id": int(ids[j]), "latitude": G.nodes[ids[j]]["y"],
             "longitude": G.nodes[ids[j]]["x"], "ward_id": "", "population_weight": 1.0,
             "flood_adjacent": bool(near[j]), "stratification_short": n_near < cfg.MIN_FLOOD_ADJACENT_ORIGINS}
            for i, j in enumerate(chosen)]
    return pd.DataFrame(rows)


def make_ambulance_starts(G: nx.MultiDiGraph, n: int = 6, cfg: Config = CONFIG, path: Path = STARTS_CSV) -> pd.DataFrame:
    """Simulated ambulance start points: seeded nodes from the largest component, all labelled simulated."""
    rng = np.random.default_rng(cfg.RANDOM_SEED + 1)
    scc = sorted(max(nx.strongly_connected_components(G), key=len))
    picks = rng.choice(scc, size=n, replace=False)
    df = pd.DataFrame({"start_id": [f"A{i + 1:02d}" for i in range(n)],
                       "latitude": [G.nodes[int(p)]["y"] for p in picks],
                       "longitude": [G.nodes[int(p)]["x"] for p in picks], "label": "simulated"})
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(path, index=False)
    return df


def load_ambulance_starts(path: Path = STARTS_CSV) -> pd.DataFrame:
    df = pd.read_csv(path)
    if not (df["label"] == "simulated").all():
        raise FacilityError("AMBULANCE_LABEL_INVALID", "every ambulance start must be labelled simulated")
    return df
