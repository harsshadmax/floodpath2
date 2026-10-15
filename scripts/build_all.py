"""Run the full data-build pipeline in order, from a clean clone.

Usage: python scripts/build_all.py

Requires the raw datasets in data/raw/ (see SOURCES.md) -- these carry third-party licences
(UNOSAT CC BY-NC-SA, OSM ODbL, OpenCity) and are not committed to this repo.

Order matters: each step reads output written by the one before it.
    build_phase2  -> road graph, flood layers/scenarios, web map data
    build_phase3  -> facilities, sample origins, ambulance starts
    build_wards   -> ward population join (needed by build_isolation)
    build_metrics -> metrics.json (KPIs, robustness)
    build_routes  -> routes.json (route explorer)
    build_isolation -> isolation.json (isolation/priority view)
    build_audit   -> audit.json (audit log)
    export_web_i18n   -> copies i18n/*.json into web/src/i18n
    export_web_config -> web/src/data/config.json

On completion, web/public/data/ and web/src/ hold everything `npm run build` in web/ needs.
"""
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

STEPS = [
    "build_phase2.py",
    "build_phase3.py",
    "build_wards.py",
    "build_metrics.py",
    "build_routes.py",
    "build_isolation.py",
    "build_audit.py",
    "export_web_i18n.py",
    "export_web_config.py",
]


def main() -> None:
    if not (ROOT / "data" / "raw").is_dir():
        print(
            "ERROR: data/raw/ not found. Download the raw datasets listed in SOURCES.md "
            "and place them under data/raw/ before running this pipeline.",
            file=sys.stderr,
        )
        sys.exit(1)

    t0 = time.time()
    for step in STEPS:
        path = ROOT / "scripts" / step
        print(f"\n=== {step} " + "=" * (60 - len(step)))
        result = subprocess.run([sys.executable, str(path)], cwd=ROOT)
        if result.returncode != 0:
            print(f"\nFAILED at {step} (exit {result.returncode})", file=sys.stderr)
            sys.exit(result.returncode)
    print(f"\nAll {len(STEPS)} steps finished in {time.time() - t0:.0f}s.")


if __name__ == "__main__":
    main()
