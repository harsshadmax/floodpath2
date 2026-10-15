"""The Next.js app reads copies of the Python dictionaries and config (scripts/export_web_*.py).
These tests fail if the copies drift from the Python source of truth."""
import json
from pathlib import Path

import pytest

from config import CONFIG

ROOT = Path(__file__).resolve().parent.parent


@pytest.mark.parametrize("lang", ["en", "ta", "hi"])
def test_web_dictionary_matches_python_dictionary(lang):
    py = json.loads((ROOT / "i18n" / f"{lang}.json").read_text(encoding="utf-8"))
    web = json.loads((ROOT / "web" / "src" / "i18n" / f"{lang}.json").read_text(encoding="utf-8"))
    assert web == py, "run: python scripts/export_web_i18n.py"


def test_web_config_matches_python_config():
    web = json.loads((ROOT / "web" / "src" / "data" / "config.json").read_text(encoding="utf-8"))
    values = {a["name"]: a["value"] for a in web["assumptions"]}
    assert values["FLOOD_FRACTION_AT_RISK"] == CONFIG.FLOOD_FRACTION_AT_RISK
    assert values["FLOOD_FRACTION_BLOCKED"] == CONFIG.FLOOD_FRACTION_BLOCKED
    assert values["AT_RISK_TIME_MULTIPLIER"] == CONFIG.AT_RISK_TIME_MULTIPLIER
    assert values["LINE_BUFFER_M"] == CONFIG.LINE_BUFFER_M
    assert values["SCENARIO_FEATURE_SHARE"] == dict(CONFIG.SCENARIO_FEATURE_SHARE)
    assert values["RANDOM_SEED"] == CONFIG.RANDOM_SEED
    assert web["study"]["bbox"] == list(CONFIG.STUDY_BBOX), "run: python scripts/export_web_config.py"


@pytest.mark.parametrize("name", [
    "manifest.json", "roads.geojson", "metrics.json", "routes.json",
    "isolation.json", "audit.json",
    "flood_observed.geojson", "flood_mild.geojson", "flood_moderate.geojson", "flood_severe.geojson",
])
def test_web_public_data_is_present(name):
    """web/public/data/ must be committed (not git-ignored): a clean checkout has to run the site
    without first installing the Python pipeline and the raw datasets. If this fails, run
    `python scripts/build_all.py` and commit web/public/data/."""
    path = ROOT / "web" / "public" / "data" / name
    assert path.is_file(), f"missing {path}; run: python scripts/build_all.py"
