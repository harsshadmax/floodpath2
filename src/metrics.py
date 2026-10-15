"""The five metrics per scenario and the robustness check (blueprint Sections 4.8, 5.5 and 5.6).

All values are comparative results of a simulation on a proxy facility list, simulated origins and
assumed thresholds. They are not predictions and not real response times. Coverage uses placeholder
equal weights (the ward population join was skipped), so it is a share of sample points, not of people.
"""
from __future__ import annotations

import statistics
import sys
from pathlib import Path
from typing import Dict, List, Optional

import numpy as np
import pandas as pd
from shapely.geometry.base import BaseGeometry

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from config import CONFIG, Config  # noqa: E402
from src import flood, impact, route  # noqa: E402


def route_all(G, geom_m: BaseGeometry, origins: pd.DataFrame, facilities: pd.DataFrame, cfg: Config = CONFIG):
    """Classify edges for one flood geometry and route every origin. Returns (table, results)."""
    table = impact.classify_edges(G, geom_m, cfg)
    G2 = impact.apply_flood(G, table, cfg)
    classes = impact.class_lookup(table)
    results = [route.route_origin(G, G2, int(o), facilities, classes) for o in origins["node_id"]]
    return table, results


def _stats(values: List[float]) -> Dict[str, Optional[float]]:
    if not values:
        return {"mean": None, "median": None, "max": None, "n": 0}
    return {"mean": round(float(np.mean(values)), 2), "median": round(float(statistics.median(values)), 2),
            "max": round(float(max(values)), 2), "n": len(values)}


def bootstrap_ci(results: List[route.RouteResult], origins: pd.DataFrame, cfg: Config = CONFIG) -> Dict[str, object]:
    """Weighted-bootstrap confidence interval for the three headline KPIs, so each one reports a
    range instead of a single point estimate. Resamples origins with replacement, cfg.BOOTSTRAP_RESAMPLES
    times, with each origin's draw probability proportional to its population_weight (so the resampling
    distribution matches the population-weighted statistic, not a plain unweighted one). Reports the
    cfg.BOOTSTRAP_CI percentiles (default 10th-90th) of each bootstrap statistic's distribution."""
    rng = np.random.default_rng(cfg.RANDOM_SEED + 200)
    n = len(results)
    w = origins["population_weight"].to_numpy(dtype=float)
    p = w / w.sum()
    thr = cfg.COVERAGE_THRESHOLD_MIN
    reach = np.array([r.reachable for r in results], dtype=float)
    t_fa = np.array([r.time_min if r.reachable else np.inf for r in results], dtype=float)
    extra = np.array([(r.time_min - r.baseline_time_min) if r.reachable else np.nan for r in results], dtype=float)
    idx = np.arange(n)
    reach_draws, cov_draws, m1_draws = [], [], []
    for _ in range(cfg.BOOTSTRAP_RESAMPLES):
        pick = rng.choice(idx, size=n, replace=True, p=p)
        reach_draws.append(float(reach[pick].mean()))
        cov_draws.append(float((t_fa[pick] <= thr).mean()))
        picked_extra = extra[pick]
        with np.errstate(invalid="ignore"):
            m1_draws.append(float(np.nanmean(picked_extra)) if np.isfinite(picked_extra).any() else float("nan"))
    lo, hi = cfg.BOOTSTRAP_CI

    def _ci(draws: List[float], digits: int) -> Optional[List[float]]:
        if not np.isfinite(draws).any():
            return None
        return [round(float(np.nanquantile(draws, lo)), digits), round(float(np.nanquantile(draws, hi)), digits)]

    return {
        "resamples": cfg.BOOTSTRAP_RESAMPLES, "percentiles": list(cfg.BOOTSTRAP_CI),
        "m1_time_increase_min": _ci(m1_draws, 2),
        "m3_reach_any": _ci(reach_draws, 3),
        "m4_coverage_flood_aware": _ci(cov_draws, 3),
    }


def scenario_metrics(results: List[route.RouteResult], origins: pd.DataFrame, facilities: pd.DataFrame,
                     cfg: Config = CONFIG) -> Dict[str, object]:
    """M1 to M4 for one scenario (M5 comes from robustness()), plus a bootstrap confidence interval
    for the three headline numbers (see bootstrap_ci)."""
    w = origins["population_weight"].to_numpy(dtype=float)
    # Travel-time increase: flood-aware time minus the unflooded shortest time, for every origin that still
    # reaches a facility (this includes origins whose conventional route is blocked).
    reached = [r for r in results if r.reachable]
    m1 = _stats([r.time_min - r.baseline_time_min for r in reached])  # type: ignore[operator]
    drivable = np.array([r.baseline_drivable for r in results])
    has_fa = np.array([r.reachable for r in results])
    per_fac = {}
    for f in facilities["facility_id"]:
        cut = [f in {u["facility_id"] for u in r.unreachable_facilities} for r in results]
        per_fac[f] = round(1.0 - float(np.mean(cut)), 3)
    thr = cfg.COVERAGE_THRESHOLD_MIN
    t_fa = np.array([r.time_min if r.reachable else np.inf for r in results], dtype=float)
    t_base = np.array([r.baseline_time_min if r.baseline_time_min is not None else np.inf for r in results], dtype=float)
    cov_fa = float((w * (t_fa <= thr)).sum() / w.sum())
    cov_conv = float((w * (drivable & (t_base <= thr))).sum() / w.sum())
    return {
        "n_origins": len(results),
        "m1_time_increase_min": m1,
        "m2_false_route_rate": round(float(1 - drivable.mean()), 3),
        "m2_flood_aware_route_share": round(float(has_fa.mean()), 3),
        "m3_reach_any": round(float(has_fa.mean()), 3),
        "m3_reach_by_facility": per_fac,
        "m4_coverage_flood_aware": round(cov_fa, 3),
        "m4_coverage_conventional": round(cov_conv, 3),
        "m4_coverage_difference": round(cov_fa - cov_conv, 3),
        "coverage_threshold_min": thr,
        "confidence_interval": bootstrap_ci(results, origins, cfg),
    }


def robustness(G, features, ranks, zone_m, central_results, origins, facilities, cfg: Config = CONFIG) -> Dict[str, object]:
    """Section 5.6, adapted to the subset scenarios: draw the share of street-level reports kept from
    ROBUSTNESS_SHARE_RANGE (same report ranks, so only the extent changes), re-route, and count how often
    each origin keeps the facility it had in the scenario being evaluated (None equals None counts as
    stable). Seeded: the same seed gives the same output."""
    rng = np.random.default_rng(cfg.RANDOM_SEED + 100)
    low, high = cfg.ROBUSTNESS_SHARE_RANGE
    central = [r.facility_id for r in central_results]
    same = np.zeros(len(central))
    changed = np.zeros(len(central), dtype=bool)
    for _ in range(cfg.ROBUSTNESS_RUNS):
        share = float(rng.uniform(low, high))
        geom = flood.subset_geometry(features, ranks, share, zone_m)
        table = impact.classify_edges(G, geom, cfg)
        chosen = route.choose_facilities(impact.apply_flood(G, table, cfg), [int(n) for n in origins["node_id"]], facilities)
        match = np.array([a == b for a, b in zip(chosen, central)])
        same += match
        changed |= ~match
    per_origin = same / cfg.ROBUSTNESS_RUNS
    return {"runs": cfg.ROBUSTNESS_RUNS, "share_range": [low, high], "overall": round(float(per_origin.mean()), 3),
            "share_changed_at_least_once": round(float(changed.mean()), 3),
            "per_origin": [round(float(x), 3) for x in per_origin]}
