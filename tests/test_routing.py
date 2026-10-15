"""Edge classification, facilities and routing on the synthetic grid (T-01 to T-05, T-08, T-09)."""
import json
from pathlib import Path

import geopandas as gpd
import pandas as pd
import pytest
from shapely.geometry import Point

from config import CONFIG
from src import facilities as fac
from src import impact, route
from tests.fixtures import LAT0, LON0, STEP, make_grid_graph

ROOT = Path(__file__).resolve().parent.parent
ROUTES_PATH = ROOT / "web" / "public" / "data" / "routes.json"

# Pinned outcomes for three real Chennai ambulance-start points, read off web/public/data/routes.json
# the last time the pipeline was run on the real road graph and the real flood-scenario geometries.
# A change here means routing on real data has changed and must be looked at, not just re-pinned.
PINNED_ROUTES = {
    ("A01", "mild"): {"reachable": True, "facility_id": "F02", "time_min": 6.64},
    ("A01", "severe"): {"reachable": True, "facility_id": "F01", "time_min": 13.08},
    ("A02", "moderate"): {"reachable": True, "facility_id": "F02", "time_min": 21.40},
    ("A02", "severe"): {"reachable": False, "facility_id": None, "time_min": None},
    ("A03", "mild"): {"reachable": True, "facility_id": "F03", "time_min": 11.41},
}


def _metric_point(lon, lat):
    return gpd.GeoSeries([Point(lon, lat)], crs=CONFIG.CRS_GEO).to_crs(CONFIG.CRS_METRIC).iloc[0]


def _facility_table(nodes, statuses=None):
    statuses = statuses or ["unverified"] * len(nodes)
    return pd.DataFrame({"facility_id": [f"F{i + 1:02d}" for i in range(len(nodes))],
                         "node_id": nodes, "verification_status": statuses})


def _flood_around_node(G, node, radius_m):
    return _metric_point(G.nodes[node]["x"], G.nodes[node]["y"]).buffer(radius_m)


def test_classification_thresholds_and_original_unchanged():
    G = make_grid_graph()
    before = (G.number_of_nodes(), G.number_of_edges(), G[0][1][0]["travel_time"])
    flood = _flood_around_node(G, 12, 300)  # covers the four edges at the centre node entirely
    table = impact.classify_edges(G, flood)
    counts = impact.class_counts(table)
    assert counts["blocked"] >= 8  # 4 edges x 2 directions
    assert set(table["class"]) <= {"passable", "at_risk", "blocked"}
    assert ((table["flooded_fraction"] >= 0) & (table["flooded_fraction"] <= 1)).all()
    G2 = impact.apply_flood(G, table)
    assert (G.number_of_nodes(), G.number_of_edges(), G[0][1][0]["travel_time"]) == before  # T-04
    assert G2.number_of_edges() == G.number_of_edges() - counts["blocked"]


def test_at_risk_multiplies_time_and_blocked_removes():
    G = make_grid_graph()
    # a 45 m disc on the midpoint of edge 0-1 covers about 90 m of a ~220 m edge: at risk, not blocked
    mid = _metric_point(LON0 + STEP / 2, LAT0).buffer(45)
    table = impact.classify_edges(G, mid)
    row = table[(table.u == 0) & (table.v == 1)].iloc[0]
    assert row["class"] == "at_risk"
    G2 = impact.apply_flood(G, table)
    assert G2[0][1][0]["travel_time"] == pytest.approx(G[0][1][0]["travel_time"] * CONFIG.AT_RISK_TIME_MULTIPLIER)


def test_t01_flooded_baseline_edge_changes_route():
    G = make_grid_graph()
    facs = _facility_table([24])
    # find the baseline path, then flood its first edge
    G_same = G.copy()
    base = route.route_origin(G, G_same, 0, facs, {})
    first_edge = (base.baseline_path_nodes[0], base.baseline_path_nodes[1])
    mid_lon = (G.nodes[first_edge[0]]["x"] + G.nodes[first_edge[1]]["x"]) / 2
    mid_lat = (G.nodes[first_edge[0]]["y"] + G.nodes[first_edge[1]]["y"]) / 2
    flood = _metric_point(mid_lon, mid_lat).buffer(130)
    table = impact.classify_edges(G, flood)
    G2 = impact.apply_flood(G, table)
    res = route.route_origin(G, G2, 0, facs, impact.class_lookup(table))
    assert res.reachable
    assert res.baseline_drivable is False
    assert res.baseline_blocked_edges
    used = set(zip(res.path_nodes[:-1], res.path_nodes[1:]))
    assert first_edge not in used
    assert res.path_nodes != base.baseline_path_nodes
    assert res.time_min >= res.baseline_time_min


def test_t02_cut_off_origin_is_not_a_crash():
    G = make_grid_graph()
    facs = _facility_table([24])
    flood = _flood_around_node(G, 12, 300)
    table = impact.classify_edges(G, flood)
    G2 = impact.apply_flood(G, table)
    res = route.route_origin(G, G2, 12, facs, impact.class_lookup(table))
    assert res.reachable is False
    assert res.reason == route.UNREACHABLE_REASON
    assert res.unreachable_facilities


def test_t03_unknown_service_never_chosen():
    G = make_grid_graph()
    df = pd.DataFrame({
        "facility_id": ["F01", "F02"], "name": ["near unknown", "far valid"],
        "latitude": [G.nodes[1]["y"], G.nodes[24]["y"]], "longitude": [G.nodes[1]["x"], G.nodes[24]["x"]],
        "service": ["unknown", "emergency_obstetric"], "tier": ["D", "B"],
        "verification_status": ["unverified", "unverified"], "source": ["", ""], "verified_on": ["", ""], "notes": ["", ""]})
    suitable, excluded = fac.suitable_facilities(df, G)
    assert list(suitable["facility_id"]) == ["F02"]
    assert {"facility_id": "F01", "reason": "SERVICE_NOT_CONFIRMED"} in excluded
    res = route.route_origin(G, G, 0, suitable, {})
    assert res.facility_id == "F02"


@pytest.mark.skipif(not ROUTES_PATH.exists(), reason="routes.json not built yet (scripts/build_routes.py)")
@pytest.mark.parametrize("point_id,scenario", list(PINNED_ROUTES))
def test_pinned_real_route_outcome(point_id, scenario):
    """Regression check on real Chennai data: catches a routing-code or scenario-geometry change
    that silently shifts which facility is reached, or how long it takes, for real points."""
    data = json.loads(ROUTES_PATH.read_text(encoding="utf-8"))
    result = data["scenarios"][scenario][point_id]
    expected = PINNED_ROUTES[(point_id, scenario)]
    assert result["reachable"] == expected["reachable"]
    assert result["facility_id"] == expected["facility_id"]
    if expected["time_min"] is None:
        assert result["time_min"] is None
    else:
        assert result["time_min"] == pytest.approx(expected["time_min"], abs=0.05)


def test_far_facility_is_excluded_and_reported():
    G = make_grid_graph()
    df = pd.DataFrame({
        "facility_id": ["F01", "F02"], "name": ["on grid", "far away"],
        "latitude": [G.nodes[6]["y"], 12.95], "longitude": [G.nodes[6]["x"], 80.24],
        "service": ["emergency_obstetric"] * 2, "tier": ["B"] * 2,
        "verification_status": ["unverified"] * 2, "source": [""] * 2, "verified_on": [""] * 2, "notes": [""] * 2})
    suitable, excluded = fac.suitable_facilities(df, G)
    assert list(suitable["facility_id"]) == ["F01"]
    assert any(e["facility_id"] == "F02" and "SNAP" in e["reason"] for e in excluded)


def test_tie_goes_to_better_verification_then_id():
    G = make_grid_graph()
    # F01 and F02 at the same node: the better verification rank wins even with a later id
    facs = _facility_table([24, 24], ["unverified", "source_listed"])
    res = route.route_origin(G, G, 0, facs, {})
    assert res.facility_id == "F02"


def test_phone_verified_needs_source_and_date(tmp_path):
    path = tmp_path / "f.csv"
    pd.DataFrame([{"facility_id": "F01", "name": "x", "latitude": 13.0, "longitude": 80.2,
                   "service": "emergency_obstetric", "tier": "B", "verification_status": "phone_verified",
                   "source": "", "verified_on": "", "notes": ""}]).to_csv(path, index=False)
    with pytest.raises(fac.FacilityError) as err:
        fac.load_facilities(path)
    assert err.value.code == "FACILITY_VERIFICATION_INVALID"


def test_ambulance_starts_must_be_simulated(tmp_path):
    path = tmp_path / "a.csv"
    pd.DataFrame({"start_id": ["A01"], "latitude": [13.0], "longitude": [80.2], "label": ["real"]}).to_csv(path, index=False)
    with pytest.raises(fac.FacilityError) as err:
        fac.load_ambulance_starts(path)
    assert err.value.code == "AMBULANCE_LABEL_INVALID"


def test_origins_seeded_and_stratified():
    G = make_grid_graph()
    flood = _flood_around_node(G, 12, 250)
    a = fac.sample_origins(G, flood)
    b = fac.sample_origins(G, flood)
    assert list(a["node_id"]) == list(b["node_id"])
    assert len(a) == CONFIG.N_ORIGINS and a["node_id"].is_unique
    assert a["flood_adjacent"].sum() >= CONFIG.MIN_FLOOD_ADJACENT_ORIGINS
