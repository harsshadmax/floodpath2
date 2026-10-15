"""Explanation text: grounded in the result values, three languages (T-13, T-35)."""
import pytest

from src import explain

FAC = {"F01": {"name": "Unit A", "verification": "unverified"}, "F02": {"name": "Unit B", "verification": "unverified"}}


def result(**kw):
    base = {"reachable": True, "facility_id": "F02", "time_min": 12.34, "baseline_facility_id": "F01",
            "baseline_time_min": 8.0, "baseline_drivable": False, "n_blocked": 3,
            "unreachable": [{"facility_id": "F01", "reason": "NO_PATH_AFTER_FLOODING"}]}
    base.update(kw)
    return base


def test_t13_every_number_comes_from_the_result():
    text = " ".join(explain.explain(result(), "moderate", "simulated", "D1", FAC, "en"))
    assert "Unit B" in text and "12.3 minutes" in text and "4.3 minutes longer" in text
    assert "3 blocked road segment" in text and "Unit A" in text
    assert "1 facility(ies) cannot be reached" in text and "no road path remains after flooding" in text
    assert "Unverified" in text and "Simulated" in text and "source D1" in text


def test_shorter_and_same_wording():
    shorter = " ".join(explain.explain(result(time_min=5.0, baseline_drivable=True, unreachable=[]), "mild", "simulated", "D1", FAC, "en"))
    assert "3.0 minutes shorter" in shorter and "blocked road segment" not in shorter
    same = " ".join(explain.explain(result(time_min=8.0, baseline_drivable=True, unreachable=[]), "mild", "simulated", "D1", FAC, "en"))
    assert "the same as the conventional route" in same


def test_unreachable_overall_and_no_invented_facility():
    r = result(reachable=False, facility_id=None, time_min=None,
               unreachable=[{"facility_id": "F01", "reason": "ORIGIN_CUT_OFF"}, {"facility_id": "F02", "reason": "ORIGIN_CUT_OFF"}])
    text = " ".join(explain.explain(r, "severe", "simulated", "D1", FAC, "en"))
    assert "No suitable facility is reachable from this origin under the 25% blocked scenario." in text
    assert "2 facility(ies)" in text and "minutes away" not in text


@pytest.mark.parametrize("lang", ["en", "ta", "hi"])
def test_t35_all_languages_render_without_leftover_placeholders(lang):
    for r in (result(), result(reachable=False, facility_id=None, time_min=None)):
        for s in explain.explain(r, "moderate", "composite", "D1", FAC, lang):
            assert s and "{" not in s and "}" not in s
    # facility names are never translated
    assert any("Unit B" in s for s in explain.explain(result(), "mild", "simulated", "D1", FAC, lang))
