"""FloodPath-Care configuration (blueprint Section 12.1).

Every numeric value below is an ASSUMPTION unless stated otherwise. None is measured data or an
official standard. The app shows these values in the Data and limits page and writes them to the
audit log. Do not present them as facts.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional, Tuple


class ConfigError(ValueError):
    """Raised with code CONFIG_INVALID when a configuration value is unusable."""

    code = "CONFIG_INVALID"

    def __init__(self, key: str, message: str):
        super().__init__(f"CONFIG_INVALID [{key}]: {message}")
        self.key = key


@dataclass(frozen=True)
class Config:
    # Study area. Chosen in PHASE 1 by scripts/choose_zone.py: central Chennai, 70 km2, contains 3 of the
    # 5 GCC emergency obstetric units (Shenoy Nagar, Saidapet, Purasaiwalkam), 217 stagnation points,
    # 87 GCC hotspots, 2139 crowd-sourced flooded street segments, and about 39% of its area lies inside
    # the NRSC inundation polygons. The zone is a decision the user can change at the first preview.
    STUDY_AREA: Optional[str] = "Central Chennai (Saidapet, Shenoy Nagar, Purasaiwalkam)"
    # West, south, east, north in degrees. Build a polygon from this for OSMnx (avoids bbox argument-order
    # changes between OSMnx versions).
    STUDY_BBOX: Optional[Tuple[float, float, float, float]] = (80.205, 13.010, 80.270, 13.100)

    CRS_GEO: str = "EPSG:4326"
    CRS_METRIC: str = "EPSG:32644"  # UTM zone 44N covers Chennai

    # Edge flood classification (A-01, A-02, A-03)
    FLOOD_FRACTION_AT_RISK: float = 0.10
    FLOOD_FRACTION_BLOCKED: float = 0.50
    AT_RISK_TIME_MULTIPLIER: float = 3.0

    # Flood layers (A-04, A-09). Negative buffers shrink the extent.
    POINT_BUFFER_M: float = 75.0
    # The crowd-sourced layer is LineStrings (flooded street segments), not points (found in PHASE 1).
    LINE_BUFFER_M: float = 25.0  # A-22: roughly a road width plus margin
    # Scenario design changed in PHASE 3 (user decision, option 1). Buffering the composite (PHASE 2) made the
    # road network collapse: the observed composite blocks about 71% of road length and no sample origin can
    # reach any facility, in every buffered scenario. So mild, moderate and severe are now seeded SUBSETS of the
    # street-level flood reports (GCC stagnation points, GCC hotspots, crowd-sourced flooded segments), nested
    # so mild is inside moderate is inside severe. The shares are arbitrary sensitivity settings, not physical
    # models, and not predictions. The observed composite is routed on as the extreme upper bound. Shares were re-set
    # from 10/20/35% to 8/16/25% after a sweep showed the network collapses between 25% and 30% of reports.
    SCENARIO_FEATURE_SHARE: Tuple[Tuple[str, float], ...] = (
        ("mild", 0.08),
        ("moderate", 0.16),
        ("severe", 0.25),
    )

    # Robustness (A-07)
    ROBUSTNESS_RUNS: int = 50
    ROBUSTNESS_SHARE_RANGE: Tuple[float, float] = (0.05, 0.30)  # share of street-level reports kept in each run

    # Metrics (A-06: an analysis parameter, not an official standard)
    COVERAGE_THRESHOLD_MIN: float = 30.0
    # Raised from 20 to 120 (PHASE 11): 20 origins -- one per ward touching the zone -- was too thin
    # to represent who is actually affected (standing gap: population impact is uncertain). Sampling
    # is now population-weighted (see sample_origins) so a populous ward gets proportionally more
    # origins instead of exactly one.
    N_ORIGINS: int = 120
    MIN_ORIGINS: int = 10
    MIN_FLOOD_ADJACENT_ORIGINS: int = 30
    FLOOD_ADJACENT_RADIUS_M: float = 300.0  # A-10
    # Bootstrap resamples (with replacement, weighted by population_weight) for the confidence
    # interval reported next to each headline KPI.
    BOOTSTRAP_RESAMPLES: int = 300
    BOOTSTRAP_CI: Tuple[float, float] = (0.10, 0.90)  # 10th-90th percentile
    MAX_SNAP_DISTANCE_M: float = 300.0  # A-11

    # Optional rules
    TREAT_TUNNELS_AS_FLOOD_SENSITIVE: bool = False
    TUNNEL_SENSITIVITY_RADIUS_M: float = 50.0  # A-08
    INCLUDE_UNVERIFIED_FACILITIES: bool = True

    # Isolation view (extra view, cut from the 2-hour build; values kept for later)
    ISOLATION_DELAY_MIN: float = 15.0  # A-13
    ISOLATION_DELAY_WEIGHT: float = 0.5  # A-14
    ISOLATION_TOP_K: int = 10
    ISOLATION_FALLBACK_GRID_M: float = 1000.0
    MIN_ELIGIBLE_NODES_PER_UNIT: int = 5  # A-17

    # Language and theme
    DEFAULT_LANGUAGE: str = "en"
    SUPPORTED_LANGUAGES: Tuple[str, ...] = ("en", "ta", "hi")
    FONT_STACK: str = (
        '"Noto Sans", "Noto Sans Tamil", "Noto Sans Devanagari", '
        '"Nirmala UI", "Segoe UI", Arial, sans-serif'
    )
    BUNDLE_FONTS: bool = False  # True only after the user approves the font download

    # Safety
    RANDOM_SEED: int = 42
    MAX_DOWNLOAD_MB: int = 100


def validate_config(cfg: Config, require_study_area: bool = False) -> Config:
    """Validate a Config. Raises ConfigError (code CONFIG_INVALID) on the first problem."""
    if not (0 < cfg.FLOOD_FRACTION_AT_RISK < cfg.FLOOD_FRACTION_BLOCKED <= 1):
        raise ConfigError(
            "FLOOD_FRACTION_AT_RISK",
            "need 0 < FLOOD_FRACTION_AT_RISK < FLOOD_FRACTION_BLOCKED <= 1",
        )
    if cfg.AT_RISK_TIME_MULTIPLIER < 1:
        raise ConfigError("AT_RISK_TIME_MULTIPLIER", "must be at least 1")
    if cfg.POINT_BUFFER_M <= 0 or cfg.LINE_BUFFER_M <= 0:
        raise ConfigError("POINT_BUFFER_M", "POINT_BUFFER_M and LINE_BUFFER_M must be positive")
    names = [name for name, _ in cfg.SCENARIO_FEATURE_SHARE]
    if names != ["mild", "moderate", "severe"]:
        raise ConfigError("SCENARIO_FEATURE_SHARE", "must list mild, moderate, severe in that order")
    shares = [value for _, value in cfg.SCENARIO_FEATURE_SHARE]
    if not (0 < shares[0] <= shares[1] <= shares[2] <= 1):
        raise ConfigError("SCENARIO_FEATURE_SHARE", "shares must be in (0, 1] and not decrease from mild to severe")
    low, high = cfg.ROBUSTNESS_SHARE_RANGE
    if not (0 < low < high <= 1):
        raise ConfigError("ROBUSTNESS_SHARE_RANGE", "need 0 < lower < upper <= 1")
    if cfg.ROBUSTNESS_RUNS < 1:
        raise ConfigError("ROBUSTNESS_RUNS", "must be at least 1")
    if cfg.COVERAGE_THRESHOLD_MIN <= 0:
        raise ConfigError("COVERAGE_THRESHOLD_MIN", "must be positive")
    if cfg.MIN_ORIGINS < 1 or cfg.N_ORIGINS < cfg.MIN_ORIGINS:
        raise ConfigError("N_ORIGINS", "need N_ORIGINS >= MIN_ORIGINS >= 1")
    if cfg.MIN_FLOOD_ADJACENT_ORIGINS < 0 or cfg.MIN_FLOOD_ADJACENT_ORIGINS > cfg.N_ORIGINS:
        raise ConfigError("MIN_FLOOD_ADJACENT_ORIGINS", "must be between 0 and N_ORIGINS")
    for key in (
        "FLOOD_ADJACENT_RADIUS_M",
        "MAX_SNAP_DISTANCE_M",
        "TUNNEL_SENSITIVITY_RADIUS_M",
        "ISOLATION_DELAY_MIN",
        "ISOLATION_FALLBACK_GRID_M",
        "MAX_DOWNLOAD_MB",
    ):
        if getattr(cfg, key) <= 0:
            raise ConfigError(key, "must be positive")
    if cfg.ISOLATION_DELAY_WEIGHT < 0:
        raise ConfigError("ISOLATION_DELAY_WEIGHT", "must not be negative")
    if cfg.ISOLATION_TOP_K < 1 or cfg.MIN_ELIGIBLE_NODES_PER_UNIT < 1:
        raise ConfigError("ISOLATION_TOP_K", "ISOLATION_TOP_K and MIN_ELIGIBLE_NODES_PER_UNIT must be >= 1")
    if cfg.DEFAULT_LANGUAGE not in cfg.SUPPORTED_LANGUAGES:
        raise ConfigError("DEFAULT_LANGUAGE", "must be one of SUPPORTED_LANGUAGES")
    if cfg.STUDY_BBOX is not None:
        w, s, e, n = cfg.STUDY_BBOX
        if not (w < e and s < n):
            raise ConfigError("STUDY_BBOX", "need west < east and south < north")
        if not (79.5 <= w and e <= 80.6 and 12.5 <= s and n <= 13.6):
            raise ConfigError("STUDY_BBOX", "must lie inside the Chennai region (79.5-80.6 E, 12.5-13.6 N)")
    if require_study_area and not (cfg.STUDY_AREA and cfg.STUDY_BBOX):
        raise ConfigError("STUDY_BBOX", "set STUDY_AREA and STUDY_BBOX before building the road graph")
    return cfg


CONFIG = Config()
