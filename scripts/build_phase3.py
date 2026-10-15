"""PHASE 3 to 5 pipeline: facilities, simulated starts, origins, edge classes per scenario, routes.

Usage: python scripts/build_phase3.py   (needs data/processed from build_phase2.py)
Writes data/facilities.csv, data/ambulance_starts.csv, data/processed/origins.csv and prints a
summary of what the routing found on the real zone.
"""
import json
import sys
from pathlib import Path

import geopandas as gpd

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from config import CONFIG  # noqa: E402
from src import facilities as fac  # noqa: E402
from src import flood, impact, roads, route, wards  # noqa: E402

PROCESSED = ROOT / "data" / "processed"


def main() -> dict:
    G = roads.load_graph()
    fac.build_starter_csv()
    df = fac.load_facilities()
    suitable, excluded = fac.suitable_facilities(df, G)
    print("facilities used:", list(suitable["facility_id"]), "excluded:", excluded)
    print(suitable[["facility_id", "name", "node_id", "snap_m"]].to_string(index=False))

    scenarios = {s: impact.flood_union_metric(gpd.read_file(PROCESSED / f"flood_{s}.geojson")) for s in flood.SCENARIO_ORDER}
    try:
        zone_wards, _ = wards.load_zone_wards()
        assignment = wards.assign_nodes(G, zone_wards)
        node_weight = wards.node_population_weight(assignment, zone_wards)
        origins = fac.sample_origins(G, scenarios["observed"], node_weight=node_weight)
        origins = wards.attach_to_origins(origins, assignment, zone_wards)
        origins["population_basis"] = "ward_census_2011"
        print("origin weights: Census 2011 ward populations (scaled to the study zone); sampling was population-proportional")
    except wards.WardDataError as exc:
        origins = fac.sample_origins(G, scenarios["observed"])
        origins["population_basis"] = "placeholder"
        print("origin weights: placeholder 1.0 (", exc, ")")
    origins.to_csv(PROCESSED / "origins.csv", index=False)
    starts = fac.make_ambulance_starts(G)
    print("origins:", len(origins), "flood-adjacent:", int(origins["flood_adjacent"].sum()), "| starts:", len(starts))

    summary = {}
    for name, geom in scenarios.items():
        table = impact.classify_edges(G, geom)
        G2 = impact.apply_flood(G, table)
        classes = impact.class_lookup(table)
        results = [route.route_origin(G, G2, int(o), suitable, classes) for o in origins["node_id"]]
        both = [r for r in results if r.reachable and r.baseline_drivable]
        summary[name] = {
            "edges": impact.class_counts(table),
            "origins_reachable": sum(r.reachable for r in results),
            "baseline_not_drivable": sum(not r.baseline_drivable for r in results),
            "mean_extra_min": round(sum(r.time_min - r.baseline_time_min for r in both) / len(both), 2) if both else None,
        }
        print(name, json.dumps(summary[name]))
    return summary


if __name__ == "__main__":
    main()
