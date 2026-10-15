"use client";
// Overview: map card, KPI cards and charts read data/web files written by the Python pipeline
// (metrics.json from scripts/build_metrics.py). The Route explorer and the isolation card are not built.
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import config from "@/data/config.json";
import { LANGS, LANG_LABELS, englishOriginal, fmtPct, normalizeLang, t, translationStatus, type Lang } from "@/lib/i18n";
import MetricsTable from "./MetricsTable";
import ExportPage from "./ExportPage";
import { CoverageByScenario, EdgeClasses, ReachByFacility, Spark, TopOrigins, type MetricsFile } from "./Charts";
import { DashboardIcon, DownloadIcon, InfoIcon, LayersIcon, RouteIcon, TableIcon } from "./icons";
import { Banner, Card, KpiCard, Pills, Placeholder, Rail, type RailItem } from "./ui";

// Leaflet touches `window`, so the map loads in the browser only.
const RouteExplorer = dynamic(() => import("./RouteExplorer"), { ssr: false, loading: () => <div className="fp-placeholder" /> });
const IsolationPage = dynamic(() => import("./Isolation"), { ssr: false, loading: () => <div className="fp-placeholder" /> });
const IsolationTop = dynamic(() => import("./Isolation").then((m) => m.IsolationTop), { ssr: false, loading: () => <div className="fp-placeholder" /> });
const RouteMap = dynamic(() => import("./RouteMap"), { ssr: false, loading: () => <div className="fp-placeholder" /> });

type PageId = "overview" | "route" | "isolation" | "metrics" | "export" | "data";
const PAGE_IDS: readonly string[] = ["overview", "route", "isolation", "metrics", "export", "data"];
const SCENARIOS = ["observed", "mild", "moderate", "severe"] as const;
type Scenario = (typeof SCENARIOS)[number];
const FOCUS = ["reachability", "coverage", "time"] as const;
type Focus = (typeof FOCUS)[number];
const SIM_ORDER = ["observed", "mild", "moderate", "severe"] as const;
// the header focus toggle highlights the matching KPI card and chart card
const FOCUS_KPI: Record<Focus, string> = { reachability: "kpi.reachability", coverage: "kpi.coverage", time: "kpi.time_increase" };
const FOCUS_CARD: Record<Focus, string> = { reachability: "card.reach_by_facility", coverage: "card.coverage_by_scenario", time: "card.top_origins" };
const GAP_KEYS = ["gap.facility_list", "gap.ambulance", "gap.peak", "gap.roads"];

export default function Dashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // ?page=route opens the Route explorer directly (previews and shared links)
  const [page, setPage] = useState<PageId>(() => {
    const requested = searchParams.get("page");
    return PAGE_IDS.includes(requested ?? "") ? (requested as PageId) : "overview";
  });
  // The first scenario can be set with ?scenario=severe (used for previews and shared links).
  const [scenario, setScenario] = useState<Scenario>(() => {
    const requested = searchParams.get("scenario");
    return (SCENARIOS as readonly string[]).includes(requested ?? "") ? (requested as Scenario) : "moderate";
  });
  const [metrics, setMetrics] = useState<MetricsFile | null | "missing">(null);
  useEffect(() => {
    fetch("/data/metrics.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setMetrics)
      .catch(() => setMetrics("missing"));
  }, []);
  const [focus, setFocus] = useState<Focus>("reachability");

  // The language lives in the page address (?lang=ta), so a shared link opens in that language
  // (blueprint I18N-5) and an unsupported value falls back to English.
  const lang: Lang = normalizeLang(searchParams.get("lang"));

  useEffect(() => {
    document.documentElement.lang = lang; // lets the CSS switch off letter-spacing for ta and hi
  }, [lang]);

  const changeLang = (next: Lang) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("lang", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const T = (key: string, params?: Record<string, string | number>) => t(lang, key, params);
  const m = metrics && metrics !== "missing" ? metrics : null;
  const sm = m ? m.scenarios[scenario] : null;
  const sparkOf = (pick: (x: MetricsFile["scenarios"][string]) => number | null) =>
    m ? <Spark values={SIM_ORDER.map((s) => pick(m.scenarios[s]))} selected={SIM_ORDER.indexOf(scenario)} /> : undefined;
  const offNote = metrics === "missing" ? T("state.metrics_missing") : T("state.not_built");
  // A weighted-bootstrap 10th-90th percentile range, appended to a KPI's note so the point estimate
  // never stands alone (see src.metrics.bootstrap_ci; null when the scenario has no reachable origin).
  const ci = sm?.confidence_interval;
  const ciNote = (range: [number, number] | null | undefined, fmt: (x: number) => string) =>
    range ? " " + T("kpi.note_ci", { lo: fmt(range[0]), hi: fmt(range[1]) }) : "";
  const kpis = [
    {
      key: "kpi.time_increase",
      value: sm && sm.m1_time_increase_min.mean !== null ? `+${sm.m1_time_increase_min.mean.toFixed(1)} ${T("unit.minutes")}` : null,
      note: sm && sm.m1_time_increase_min.mean !== null
        ? T("kpi.note_time", { n: sm.m1_time_increase_min.n, max: sm.m1_time_increase_min.max ?? 0 })
          + ciNote(ci?.m1_time_increase_min, (x) => `+${x.toFixed(1)} ${T("unit.minutes")}`)
        : undefined,
      none: sm ? T("kpi.note_time_none") : offNote,
      spark: sparkOf((x) => x.m1_time_increase_min.mean),
    },
    {
      key: "kpi.feasibility",
      value: sm ? fmtPct(sm.m2_false_route_rate) : null,
      note: T("kpi.note_feasibility"),
      none: offNote,
      spark: sparkOf((x) => x.m2_false_route_rate),
    },
    {
      key: "kpi.reachability",
      value: sm ? fmtPct(sm.m3_reach_any) : null,
      note: sm
        ? T("kpi.note_reach", { n: Math.round(sm.m3_reach_any * sm.n_origins), total: sm.n_origins })
          + ciNote(ci?.m3_reach_any, fmtPct)
        : undefined,
      none: offNote,
      spark: sparkOf((x) => x.m3_reach_any),
    },
    {
      key: "kpi.coverage",
      value: sm ? fmtPct(sm.m4_coverage_flood_aware) : null,
      note: sm
        ? T("kpi.note_coverage", { min: sm.coverage_threshold_min, conv: fmtPct(sm.m4_coverage_conventional) })
          + ciNote(ci?.m4_coverage_flood_aware, fmtPct)
        : undefined,
      none: offNote,
      spark: sparkOf((x) => x.m4_coverage_flood_aware),
    },
    {
      key: "kpi.robustness",
      value: sm && sm.robustness ? fmtPct(sm.robustness.overall) : null,
      note: sm && sm.robustness ? T("kpi.note_robust", { pct: fmtPct(sm.robustness.share_changed_at_least_once), runs: sm.robustness.runs }) : undefined,
      none: sm ? T("kpi.note_robust_na") : offNote,
      spark: sparkOf((x) => x.robustness?.overall ?? null),
    },
  ];
  const kind = scenario === "observed" ? T("badge.composite") : T("badge.simulated");
  const caption = `${T("scenario." + scenario)}  |  ${kind}`;

  // Two icon groups divided by a thin line, like the reference rail; Data and limits takes the info slot.
  const navGroups: RailItem[][] = [
    [
      { id: "overview", label: T("nav.overview"), icon: <DashboardIcon /> },
      { id: "route", label: T("nav.route"), icon: <RouteIcon /> },
      { id: "isolation", label: T("nav.isolation"), icon: <LayersIcon /> },
    ],
    [
      { id: "metrics", label: T("nav.metrics"), icon: <TableIcon /> },
      { id: "export", label: T("nav.export"), icon: <DownloadIcon /> },
    ],
    [{ id: "data", label: T("nav.data"), icon: <InfoIcon /> }],
  ];

  return (
    <div className="fp-shell">
      <Rail groups={navGroups} active={page} onSelect={(id) => setPage(id as PageId)} />
      <main className="fp-main">
        <header className="fp-header">
          <div className="fp-header-left">
            <h1 className="fp-title">{T("app.title")}</h1>
            <p className="fp-subtitle">{T("app.subtitle")}</p>
          </div>
          <div className="fp-header-right">
            <div className="fp-row fp-row-right">
              <Pills
                variant="light"
                label={T("nav.language")}
                value={lang}
                onChange={changeLang}
                options={LANGS.map((l) => ({ value: l, label: LANG_LABELS[l] }))}
              />
            </div>
            <Pills
              variant="dark"
              label="focus"
              value={focus}
              onChange={setFocus}
              options={FOCUS.map((f) => ({ value: f, label: T("focus." + f) }))}
            />
          </div>
        </header>

        {/* Scenario control: its own full-width row so long Tamil and Hindi labels wrap, never truncate (A-19) */}
        <div className="fp-scenario-row">
          <Pills
            variant="light"
            label={T("label.scenario")}
            value={scenario}
            onChange={setScenario}
            options={SCENARIOS.map((s) => ({ value: s, label: T("scenario." + s) }))}
          />
        </div>

        <Banner text={T("banner.simulation")} />

        {page === "overview" && (
          <>
            <p className="fp-metrics-note">{T("note.indicative_metrics")}</p>
            <div className="fp-grid-kpi">
              {kpis.map((k) => (
                <KpiCard key={k.key} label={T(k.key)} value={k.value} note={k.note} notBuilt={k.none} spark={k.spark} highlight={FOCUS_KPI[focus] === k.key} />
              ))}
            </div>
            {/* Map beside a routing log (PHASE 13, Velize reference layout), instead of the map
                sitting in the same even grid as every other chart card: the map is the thing
                worth the most space, and "origins with the largest travel-time increase" reads
                as a log of what the simulation found, not just another chart. */}
            <div className="fp-overview-split">
              <Card title={T("card.map")} caption={caption} highlight={FOCUS_CARD[focus] === "card.map"}>
                <RouteMap scenario={scenario} lang={lang} />
              </Card>
              <Card title={T("card.top_origins")} caption={caption} highlight={FOCUS_CARD[focus] === "card.top_origins"}>
                {sm ? <TopOrigins lang={lang} m={sm} /> : <Placeholder text={offNote} />}
              </Card>
            </div>
            <div className="fp-grid-cards">
              {["card.coverage_by_scenario", "card.isolation_top", "card.edge_classes", "card.reach_by_facility"].map(
                (key) => (
                  <Card
                    key={key}
                    title={T(key === "card.isolation_top" && m?.population_basis === "ward_census_2011" ? "card.isolation_top_wards" : key)}
                    caption={caption}
                    highlight={FOCUS_CARD[focus] === key}
                  >
                    {key === "card.isolation_top" ? (
                      <IsolationTop scenario={scenario} lang={lang} />
                    ) : key === "card.coverage_by_scenario" && m ? (
                      <CoverageByScenario lang={lang} metrics={m} />
                    ) : key === "card.edge_classes" && sm ? (
                      <EdgeClasses lang={lang} m={sm} />
                    ) : key === "card.reach_by_facility" && sm && m ? (
                      <ReachByFacility lang={lang} m={sm} metrics={m} />
                    ) : (
                      <Placeholder text={offNote} />
                    )}
                  </Card>
                ),
              )}
            </div>
          </>
        )}

        {page === "route" && (
          <Card title={T("page.route.title")} caption={caption}>
            <RouteExplorer scenario={scenario} lang={lang} />
          </Card>
        )}

        {page === "isolation" && (
          <Card title={T("nav.isolation")} caption={caption}>
            <IsolationPage scenario={scenario} lang={lang} />
          </Card>
        )}

        {page === "metrics" && (
          <Card title={T("nav.metrics")} caption={caption}>
            <MetricsTable scenario={scenario} lang={lang} />
          </Card>
        )}

        {page === "export" && (
          <Card title={T("nav.export")} caption={caption}>
            <ExportPage scenario={scenario} lang={lang} />
          </Card>
        )}

        {page === "data" && <DataPage lang={lang} />}
      </main>
    </div>
  );
}

function DataPage({ lang }: { lang: Lang }) {
  const T = (key: string) => t(lang, key);
  return (
    <div>
      <h2 className="fp-h2">{T("page.data.context_title")}</h2>
      <div className="fp-card">
        <p>{T("page.data.context_body1")}</p>
        <p>{T("page.data.context_body2")}</p>
        <p className="fp-original">{T("page.data.context_sources")}</p>
      </div>

      <h2 className="fp-h2">{T("page.data.gaps_title")}</h2>
      <div className="fp-stack">
        {GAP_KEYS.map((key) => (
          <div className="fp-card" key={key}>
            <div>{T(key)}</div>
            {lang !== "en" && (
              // "Original English" line so a reader can check the meaning (blueprint 6.9)
              <p className="fp-original">
                {T("page.data.original_english")}: {englishOriginal(key)}
              </p>
            )}
          </div>
        ))}
      </div>

      <h2 className="fp-h2">{T("page.data.datasets_title")}</h2>
      <div className="fp-card">
        <table className="fp-table">
          <thead>
            <tr>
              <th>{T("table.dataset")}</th>
              <th>{T("table.type")}</th>
              <th>{T("table.licence")}</th>
            </tr>
          </thead>
          <tbody>
            {config.datasets.map((d) => (
              <tr key={d.id}>
                <td>
                  <span className="fp-mono">{d.id}</span> {d.name}
                </td>
                <td>{d.typeKey ? <span className="fp-badge">{T(d.typeKey)}</span> : "-"}</td>
                <td>{d.licence}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="fp-h2">{T("page.data.assumptions_title")}</h2>
      <div className="fp-card">
        <table className="fp-table">
          <thead>
            <tr>
              <th>{T("table.parameter")}</th>
              <th>{T("table.value")}</th>
            </tr>
          </thead>
          <tbody>
            {config.assumptions.map((a) => (
              <tr key={a.name}>
                <td className="fp-mono">{a.name}</td>
                <td>{typeof a.value === "object" ? JSON.stringify(a.value) : String(a.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="fp-h2">{T("page.data.translation_status")}</h2>
      <div className="fp-card">
        {LANGS.map((l) => (
          <div key={l}>
            <strong>{LANG_LABELS[l]}</strong>: {T(translationStatus(l) === "reviewed" ? "status.reviewed" : "status.draft")}
          </div>
        ))}
      </div>
    </div>
  );
}
