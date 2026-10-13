import Link from "next/link";
import type { Metadata } from "next";
import { z } from "zod";
import { Disclaimer } from "@/components/Disclaimer";
import { ProblemPanel } from "@/components/ProblemPanel";
import { fmtValue, headline, metricLabel, RankingTable } from "@/components/RankingTable";
import { getRanking, METRICS, ORDERS, PERIODS } from "@/lib/api";
import { settle } from "@/lib/settle";
import { clean } from "@/lib/text";

export const metadata: Metadata = { title: "Ranking" };

// Parámetros de la URL: cualquier valor inválido vuelve al valor por defecto (nunca llega a P3).
const query = z.object({
  period: z.enum(PERIODS).catch("month"),
  metric: z.enum(METRICS).catch("return"),
  order: z.enum(ORDERS).catch("desc"),
});
type Query = z.infer<typeof query>;

const periodNames = { month: "Mes", quarter: "Trimestre", ytd: "Año en curso" } as const;
const metricNames = { return: "Retorno", volatility: "Volatilidad", sharpe: "Sharpe" } as const;
const orderNames = { desc: "Mayor primero", asc: "Menor primero" } as const;

function Options<T extends string>({
  label,
  name,
  values,
  names,
  current,
  q,
}: {
  label: string;
  name: keyof Query;
  values: readonly T[];
  names: Record<T, string>;
  current: T;
  q: Query;
}) {
  return (
    <div className="options" role="group" aria-label={label}>
      <span className="muted">{label}:</span>
      {values.map((v) => (
        <Link key={v} href={{ pathname: "/", query: { ...q, [name]: v } }} aria-current={v === current ? "true" : undefined}>
          {names[v]}
        </Link>
      ))}
    </div>
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const q = query.parse({ period: first(raw.period), metric: first(raw.metric), order: first(raw.order) });
  const res = await settle(getRanking(q.period, q.metric, q.order));

  return (
    <>
      <h1>¿Qué acción rindió mejor?</h1>
      <Options label="Periodo" name="period" values={PERIODS} names={periodNames} current={q.period} q={q} />
      <Options label="Métrica" name="metric" values={METRICS} names={metricNames} current={q.metric} q={q} />
      <Options label="Orden" name="order" values={ORDERS} names={orderNames} current={q.order} q={q} />
      {res.ok ? (
        <>
          <h2>{headline(res.data)}</h2>
          {res.data.best && (
            <p className="callout">
              Primero del ranking:{" "}
              <Link href={`/ticker/${encodeURIComponent(res.data.best.ticker)}`}>{clean(res.data.best.ticker, 16)}</Link> (
              {clean(res.data.best.name, 60)}) con {fmtValue(res.data.metric, res.data.best.value)} en{" "}
              {metricLabel[res.data.metric]}. Es la posición 1 según el orden elegido, no un juicio de calidad.
            </p>
          )}
          <RankingTable ranking={res.data} />
          <p className="muted">
            Periodo calculado: {clean(res.data.start, 10)} a {clean(res.data.end, 10)}.
          </p>
        </>
      ) : (
        <ProblemPanel error={res.error} />
      )}
      <Disclaimer />
    </>
  );
}
