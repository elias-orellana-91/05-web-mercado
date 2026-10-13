import { p3Get, P3Error, parseWith } from "./p3";
import {
  metricsSchema, modelSchema, predictionSchema, pricesSchema, rankingSchema, sectorsSchema, tickersSchema,
  type Ticker,
} from "./schemas";

const SYMBOL_RE = /^[A-Za-z][A-Za-z0-9.\-]{0,15}$/;
const TTL = { tickers: 3_600_000, market: 300_000, model: 3_600_000 };

export const PERIODS = ["month", "quarter", "ytd"] as const;
export const METRICS = ["return", "volatility", "sharpe"] as const;
export const ORDERS = ["desc", "asc"] as const;
export type Period = (typeof PERIODS)[number];
export type MetricName = (typeof METRICS)[number];
export type Order = (typeof ORDERS)[number];

export async function getTickers(): Promise<Ticker[]> {
  return parseWith(tickersSchema, await p3Get("/tickers", { ttlMs: TTL.tickers }));
}

/** Valida el símbolo (formato Y pertenencia a /tickers) antes de armar cualquier URL. */
export async function resolveSymbol(raw: string): Promise<Ticker> {
  if (!SYMBOL_RE.test(raw)) throw new P3Error("not_found", "El símbolo no es válido.");
  const sym = raw.toUpperCase();
  const found = (await getTickers()).find((t) => t.symbol.toUpperCase() === sym);
  if (!found) throw new P3Error("not_found", "El símbolo no está en el universo de la API.");
  return found;
}

export async function getRanking(period: Period, metric: MetricName, order: Order, limit = 20) {
  return parseWith(rankingSchema, await p3Get("/ranking", { params: { period, metric, order, limit }, ttlMs: TTL.market }));
}

export async function getMetrics(symbol: string) {
  const t = await resolveSymbol(symbol);
  return parseWith(metricsSchema, await p3Get(`/metrics/${encodeURIComponent(t.symbol)}`, { ttlMs: TTL.market }));
}

/** Últimos `days` cierres, en orden cronológico. */
export async function getPrices(symbol: string, days = 260) {
  const t = await resolveSymbol(symbol);
  const data = parseWith(
    pricesSchema,
    await p3Get(`/prices/${encodeURIComponent(t.symbol)}`, { params: { limit: days, order: "desc" }, ttlMs: TTL.market }),
  );
  return { ...data, items: [...data.items].reverse() };
}

export async function getPrediction(symbol: string) {
  const t = await resolveSymbol(symbol);
  return parseWith(predictionSchema, await p3Get(`/predictions/${encodeURIComponent(t.symbol)}`, { ttlMs: TTL.market }));
}

export async function getSectors() {
  return parseWith(sectorsSchema, await p3Get("/sectors/summary", { ttlMs: TTL.market }));
}

export async function getModel() {
  return parseWith(modelSchema, await p3Get("/model/info", { ttlMs: TTL.model }));
}