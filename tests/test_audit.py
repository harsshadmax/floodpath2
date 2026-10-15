"""Audit log (T-14): every required field, every config value, the four standing gaps."""
import json

import pytest

from config import CONFIG
from src import audit

POINT = {"id": "A01", "group": "start", "lat": 13.07, "lon": 80.24}
MANIFEST = {"flood": {"stats": {"scenario_area_km2": {"observed": 41.6, "mild": 3.2, "moderate": 6.3, "severe": 10.2},
                                "zone_area_km2": 70.2, "feature_counts_in_zone": {"inundation": 290}}}}
METRICS = {"share_of_reports": 0.1, "origins": [{"id": "O01"}], "m3_reach_any": 0.95,
           "robustness": {"overall": 0.4, "runs": 50, "per_origin": [1.0, 0.5]}}


def doc(scenario="mild", result=None, metrics=METRICS):
    info = audit.flood_layer_info(scenario, MANIFEST, metrics, 2443)
    return audit.build_audit(scenario, POINT, result, metrics, info, [{"facility_id": "F01"}], [])


def test_t14_all_required_fields_present():
    d = doc(result={"reachable": True})
    assert set(audit.REQUIRED_FIELDS) <= set(d)
    assert d["selection"]["origin_label"] == "simulated" and d["selection"]["service"] == "emergency_obstetric"
    assert d["selection"]["origin_id"] == "A01"


def test_config_in_effect_is_complete_and_json_safe():
    d = doc()
    assert set(d["config"]) == set(CONFIG.__dataclass_fields__)
    json.dumps(d)  # serialisable
    assert d["config"]["SCENARIO_FEATURE_SHARE"] == [["mild", 0.08], ["moderate", 0.16], ["severe", 0.25]]


def test_limits_include_four_standing_gaps_and_draft_status():
    lim = doc()["limits"]
    assert len(lim["standing_gaps"]) == 4 and all(lim["standing_gaps"])
    assert lim["translation_status"]["ta"] == "draft" and lim["translation_status"]["hi"] == "draft"


def test_metrics_summary_drops_per_origin_lists_and_observed_is_not_routed():
    d = doc()
    assert "origins" not in d["metrics"] and "per_origin" not in d["metrics"]["robustness"]
    obs = doc("observed", result=None, metrics=None)
    assert obs["flood_layer"]["routed"] is True and obs["flood_layer"]["kind"] == "composite"
    assert obs["result"] is None and obs["metrics"] is None


def test_datasets_have_url_licence_and_access_date():
    for ds in doc()["datasets"]:
        assert ds["url"].startswith("http") and ds["licence"] and ds["kind"]


def test_generated_audit_file_if_built():
    path = audit.ROOT / "web" / "public" / "data" / "audit.json"
    if not path.exists():
        pytest.skip("run scripts/build_audit.py")
    data = json.loads(path.read_text(encoding="utf-8"))
    assert set(data) == {"observed", "mild", "moderate", "severe"}
    for scen, docs in data.items():
        assert len(docs) == 6 + CONFIG.N_ORIGINS  # 6 simulated ambulance starts + the sample origins
        for d in docs.values():
            assert set(audit.REQUIRED_FIELDS) <= set(d)
            if d["result"]:
                assert len(d["result"]["blocked_edge_ids"]) == d["result"]["n_blocked"]
