import { z } from "zod";
import { clean } from "./text";

// Todo texto de la API se sanea al validar (sin control/bidi/invisibles): así tampoco viaja sucio en el payload RSC.
const text = (max: number) => z.string().max(max).transform((s) => clean(s, max));
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}/).max(40);
const num = z.number().finite();

export const tickerSchema = z.object({ symbol: text(16), name: text(200), sector: text(100) });
export const tickersSchema = z.array(tickerSchema).max(1000);

const rankingItem = z.object({ rank: z.number().int(), ticker: text(16), name: text(200), sector: text(100), value: num.nullable() });
export const rankingSchema = z.object({
  period: z.enum(["month", "quarter", "ytd", "custom"]),
  metric: z.enum(["return", "volatility", "sharpe"]),
  order: z.enum(["desc", "asc"]),
  start: date,
  end: date,
  best: rankingItem.nullable(),
  items: z.array(rankingItem).max(200),
});

export const metricsSchema = z.object({
  ticker: text(16),
  start: date,
  end: date,
  n_days: z.number().int(),
  total_return: num,
  volatility: num,
  max_drawdown: num,
  sharpe: num.nullable(),
});

export const pricesSchema = z.object({
  ticker: text(16),
  total: z.number().int(),
  items: z.array(z.object({ date, close: num, volume: num.nullable().optional() })).max(5000),
});

export const sectorsSchema = z.object({
  start: date,
  end: date,
  sectors: z
    .array(
      z.object({
        sector: text(100),
        tickers: z.array(text(16)).max(200),
        total_return: num,
        volatility: num,
        max_drawdown: num,
        sharpe: num.nullable(),
        best_ticker: text(16),
        worst_ticker: text(16),
      }),
    )
    .max(100),
});

export const predictionSchema = z.object({
  ticker: text(16),
  as_of_date: date,
  horizon_days: z.number().int(),
  probability_high_vol: num.min(0).max(1),
  predicted_class: z.number().int(),
  label: z.enum(["alta", "normal"]),
  decision_threshold: num,
  model_version: text(40),
  in_sample: z.boolean(),
});

// Solo campos públicos: sha256, library_versions y warnings NO se leen aunque la API los envíe.
export const modelSchema = z.object({
  model_name: text(100),
  model_version: text(40),
  trained_at: text(40),
  trained_on: text(200),
  decision_threshold: num,
  features: z.array(text(100)).max(500),
  test_metrics: z.record(z.string(), z.unknown()),
  baselines_test_metrics: z.record(z.string(), z.record(z.string(), z.unknown())).default({}),
});

export type Ticker = z.infer<typeof tickerSchema>;
export type Ranking = z.infer<typeof rankingSchema>;
export type Metrics = z.infer<typeof metricsSchema>;
export type Prices = z.infer<typeof pricesSchema>;
export type Sectors = z.infer<typeof sectorsSchema>;
export type Prediction = z.infer<typeof predictionSchema>;
export type ModelInfo = z.infer<typeof modelSchema>;