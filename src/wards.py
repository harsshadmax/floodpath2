"""Ward polygons and Census 2011 populations, joined (blueprint Sections 2.4 and 3.6).

Sources (downloaded with the user's approval into data/raw/wards/):
  * D8 DataMeet Chennai `Wards-2008.geojson`: 155 ward polygons, CC BY-SA 2.5 India (Transparent Chennai).
    The newer `Wards.geojson` has 201 features and a different scheme, so it is NOT used.
  * D7 OpenCity `Chennai - Ward-wise Census Data - 2011`: enumeration-block rows, summed to 155 wards.

Joined on ward number. The join is checked (match rate, totals) and, if it fails, callers fall back to
the placeholder weights. Population is the Census 2011 count (old), assumed evenly spread inside a ward
(A-15) and scaled to the part of the ward that lies inside the study zone.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Dict, Optional, Tuple

import geopandas as gpd
import networkx as nx
import numpy as np
import pandas as pd
from shapely.geometry import box

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from config import CONFIG, Config  # noqa: E402

RAW = ROOT / "data" / "raw" / "wards"
POLYGONS = RAW / "Wards-2008.geojson"
CENSUS = RAW / "census2011_ward.csv"
POP_CSV = ROOT / "data" / "wards_population.csv"
MIN_MATCH_RATE = 0.9


class WardDataError(RuntimeError):
    code = "WARD_JOIN_FAILED"


def load_populations(path: Path = CENSUS) -> pd.DataFrame:
    """Census 2011 population per ward number (enumeration blocks summed)."""
    df = pd.read_csv(path, dtype=str)
    df = df[df["Ward Number"].str.strip().str.isdigit()].copy()
    df["ward_id"] = df["Ward Number"].astype(int)
    df["pop"] = pd.to_numeric(df["Total Population"].str.replace(",", "", regex=False), errors="coerce")
    if df["pop"].isna().any():
        raise WardDataError(f"{int(df['pop'].isna().sum())} census rows have no numeric population")
    return df.groupby("ward_id", as_index=False)["pop"].sum().rename(columns={"pop": "population"})


def load_polygons(path: Path = POLYGONS) -> gpd.GeoDataFrame:
    gdf = gpd.read_file(path)
    gdf = gdf.rename(columns={"ward": "ward_id"})
    gdf["ward_id"] = gdf["ward_id"].astype(int)
    if gdf["ward_id"].duplicated().any():
        raise WardDataError("duplicate ward numbers in the polygon file")
    gdf["geometry"] = gdf.geometry.make_valid()
    return gdf.set_crs("EPSG:4326", allow_override=True)[["ward_id", "zone", "geometry"]]


def join(polygons: gpd.GeoDataFrame, pops: pd.DataFrame, min_rate: float = MIN_MATCH_RATE) -> Tuple[gpd.GeoDataFrame, Dict[str, object]]:
    """Join on ward number. Raises WardDataError when too few polygons match a census ward."""
    merged = polygons.merge(pops, on="ward_id", how="left")
    matched = merged["population"].notna()
    report: Dict[str, object] = {
        "polygons": int(len(polygons)), "census_wards": int(len(pops)), "matched": int(matched.sum()),
        "match_rate": round(float(matched.mean()), 4),
        "polygons_without_census": sorted(merged.loc[~matched, "ward_id"].astype(int).tolist()),
        "census_without_polygon": sorted(set(pops["ward_id"]) - set(polygons["ward_id"])),
        "census_total_population": int(pops["population"].sum()),
    }
    if report["match_rate"] < min_rate:
        raise WardDataError(f"only {report['match_rate']:.0%} of ward polygons matched a census ward")
    merged = merged[matched].copy()
    merged["ward_name"] = "Ward " + merged["ward_id"].astype(str)
    return gpd.GeoDataFrame(merged, geometry="geometry", crs="EPSG:4326"), report


def load_joined() -> Tuple[gpd.GeoDataFrame, Dict[str, object]]:
    for p in (POLYGONS, CENSUS):
        if not p.exists():
            raise WardDataError(f"{p.name} is missing; see docs/DATA_LIMITS.md (PHASE 8b) for the download")
    return join(load_polygons(), load_populations())


def zone_scaled(wards: gpd.GeoDataFrame, cfg: Config = CONFIG) -> gpd.GeoDataFrame:
    """Add `inside_fraction` (area of the ward inside the study zone / ward area) and `population_in_zone`.
    Wards that do not touch the zone are dropped. Even spread inside a ward is assumed (A-15)."""
    zone = gpd.GeoSeries([box(*cfg.STUDY_BBOX)], crs=cfg.CRS_GEO).to_crs(cfg.CRS_METRIC).iloc[0]  # type: ignore[misc]
    metric = wards.to_crs(cfg.CRS_METRIC)
    clipped = metric.geometry.intersection(zone)
    out = wards.copy()
    out["area_km2"] = (metric.geometry.area / 1e6).round(3)
    out["inside_fraction"] = (clipped.area / metric.geometry.area).round(4)
    out["population_in_zone"] = (out["population"] * out["inside_fraction"]).round(0)
    out["geometry_in_zone"] = clipped.to_crs(cfg.CRS_GEO)
    return out[out["inside_fraction"] > 0].reset_index(drop=True)


def write_population_csv(wards: gpd.GeoDataFrame, path: Path = POP_CSV) -> None:
    """Blueprint 3.6: ward_id, ward_name, population, source_year (all joined wards, not only the zone)."""
    df = wards[["ward_id", "ward_name", "population"]].copy()
    df["population"] = df["population"].astype(int)
    df["source_year"] = 2011
    path.parent.mkdir(parents=True, exist_ok=True)
    df.sort_values("ward_id").to_csv(path, index=False)


def assign_nodes(G: nx.MultiDiGraph, zone_wards: gpd.GeoDataFrame, max_gap_m: float = 100.0, cfg: Config = CONFIG) -> Dict[int, Optional[int]]:
    """Ward number for every graph node: inside a ward polygon, else the nearest ward within max_gap_m
    (polygon edges rarely meet exactly), else None."""
    ids = list(G.nodes)
    pts = gpd.GeoDataFrame({"node": ids}, geometry=gpd.points_from_xy([G.nodes[n]["x"] for n in ids], [G.nodes[n]["y"] for n in ids]),
                           crs=cfg.CRS_GEO).to_crs(cfg.CRS_METRIC)
    polys = gpd.GeoDataFrame({"ward_id": zone_wards["ward_id"]}, geometry=zone_wards.to_crs(cfg.CRS_METRIC).geometry, crs=cfg.CRS_METRIC)
    inside = gpd.sjoin(pts, polys, how="left", predicate="within").drop_duplicates("node").set_index("node")["ward_id"]
    result: Dict[int, Optional[int]] = {n: (None if pd.isna(inside.get(n)) else int(inside[n])) for n in ids}
    missing = [n for n, w in result.items() if w is None]
    if missing:
        near = gpd.sjoin_nearest(pts[pts["node"].isin(missing)], polys, how="left", max_distance=max_gap_m).drop_duplicates("node").set_index("node")["ward_id"]
        for n in missing:
            v = near.get(n)
            result[n] = None if v is None or pd.isna(v) else int(v)
    return result


def attach_to_origins(origins: pd.DataFrame, assignment: Dict[int, Optional[int]], zone_wards: gpd.GeoDataFrame) -> pd.DataFrame:
    """Set ward_id and population_weight on the sample origins. Each ward contributes its in-zone population
    once, shared equally by the sample origins that fall in it (post-stratification), so a ward with three
    origins does not count three times. Wards with no sample origin contribute nothing (the sample is small)."""
    out = origins.copy()
    out["ward_id"] = out["node_id"].map(assignment)
    pop = zone_wards.set_index("ward_id")["population_in_zone"]
    counts = out["ward_id"].value_counts()
    out["population_weight"] = [
        (float(pop.get(w, np.nan)) / counts[w]) if pd.notna(w) and w in pop.index else np.nan for w in out["ward_id"]
    ]
    if out["population_weight"].isna().any():
        raise WardDataError("some sample origins could not be placed in a ward")
    return out


def node_population_weight(assignment: Dict[int, Optional[int]], zone_wards: gpd.GeoDataFrame) -> Dict[int, float]:
    """Ward in-zone population for every graph node, for population-proportional origin sampling
    (src.facilities.sample_origins). A node outside any ward is left out; the caller treats a
    missing node as the smallest observed weight, not zero, so it can still be drawn."""
    pop = zone_wards.set_index("ward_id")["population_in_zone"]
    return {n: float(pop[w]) for n, w in assignment.items() if w is not None and w in pop.index}


def report_json(report: Dict[str, object]) -> str:
    return json.dumps(report, indent=2)


def load_zone_wards(cfg: Config = CONFIG) -> Tuple[gpd.GeoDataFrame, Dict[str, object]]:
    """Joined wards that touch the study zone, with in-zone population. Raises WardDataError on failure."""
    wards, report = load_joined()
    return zone_scaled(wards, cfg), report
