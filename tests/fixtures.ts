import { vi } from "vitest";

export const TICKERS = [
  { symbol: "AAPL", name: "Apple Inc.", sector: "Tecnología" },
  { symbol: "NVDA", name: "NVIDIA Corporation", sector: "Tecnología" },
  { symbol: "GS", name: "The Goldman Sachs Group, Inc.", sector: "Bancos" },
  { symbol: "BRK.B", name: "Berkshire Hathaway", sector: "Finanzas" },
];

export const item = (rank: number, ticker: string, value: number | null) => ({
  rank, ticker, name: `${ticker} Inc.`, sector: "Tecnología", value,
});

export const ranking = (over: Record<string, unknown> = {}) => {
  const items = [item(1, "GS", 0.076), item(2, "NVDA", 0.06), item(3, "AAPL", -0.01)];
  return { period: "month", metric: "return", order: "desc", start: "2025-11-28", end: "2025-12-30", best: items[0], items, ...over };
};

export const metrics = { ticker: "AAPL", start: "2015-01-02", end: "2025-12-30", n_days: 2700, total_return: 9.1, volatility: 0.318, max_drawdown: -0.3057, sharpe: 0.41 };

export const prices = (n = 5) => ({
  ticker: "AAPL", start: null, end: null, total: n, limit: 260, offset: 0,
  items: Array.from({ length: n }, (_, i) => ({ date: `2025-12-${String(30 - i).padStart(2, "0")}`, close: 270 - i, volume: 1 })),
});

export const prediction = (over: Record<string, unknown> = {}) => ({
  ticker: "AAPL", as_of_date: "2025-12-30", horizon_days: 5, probability_high_vol: 0.62, predicted_class: 1, label: "alta",
  decision_threshold: 0.5, model_version: "0.1.0", in_sample: false, created_at: "2026-01-02T10:00:00Z", ...over,
});

export const sectors = {
  start: "2015-01-02", end: "2025-12-30",
  sectors: [
    { sector: "Bancos", tickers: ["GS"], total_return: 2.5, volatility: 0.28, max_drawdown: -0.4, sharpe: 0.9, best_ticker: "GS", worst_ticker: "GS" },
    { sector: "Tecnología", tickers: ["AAPL", "NVDA"], total_return: 9.1, volatility: 0.33, max_drawdown: -0.35, sharpe: 1.1, best_ticker: "NVDA", worst_ticker: "AAPL" },
  ],
};

export const model = {
  model_name: "Regresión logística", model_version: "0.1.0", trained_at: "2026-10-11T02:47:55+00:00", trained_on: "2016-2022",
  sha256: "deadbeef", decision_threshold: 0.5, features: ["a", "b"], test_metrics: { roc_auc: 0.646, f1: 0.517 },
  baselines_test_metrics: { "HAR-RV": { roc_auc: 0.627 } }, required_inputs: {},
  library_versions: { numpy: "2.5" }, warnings: ["x"],
};

export const errBody = (code: string, message: string) => ({ error: { code, message, details: null, request_id: "rid-1" } });
export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

/** Simula P3 por ruta. `overrides` sustituye respuestas; devuelve el mock y la lista de URLs pedidas. */
export function mockP3(overrides: Record<string, (url: URL) => Response | Promise<Response>> = {}) {
  const calls: URL[] = [];
  const fn = vi.fn(async (input: URL | string, init?: RequestInit) => {
    void init;
    const url = new URL(String(input));
    calls.push(url);
    const o = overrides[url.pathname];
    if (o) return o(url);
    const p = url.pathname;
    if (p === "/tickers") return json(TICKERS);
    if (p === "/ranking") return json(ranking({ metric: url.searchParams.get("metric"), order: url.searchParams.get("order"), period: url.searchParams.get("period") }));
    if (p.startsWith("/metrics/")) return json(metrics);
    if (p.startsWith("/prices/")) return json(prices());
    if (p.startsWith("/predictions/")) return json(prediction());
    if (p === "/sectors/summary") return json(sectors);
    if (p === "/model/info") return json(model);
    return json(errBody("not_found", "Not Found"), 404);
  });
  vi.stubGlobal("fetch", fn);
  return { fn, calls };
}