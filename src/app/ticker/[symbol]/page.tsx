import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Disclaimer } from "@/components/Disclaimer";
import { PredictionCard } from "@/components/PredictionCard";
import { PriceChart } from "@/components/PriceChart";
import { ProblemPanel } from "@/components/ProblemPanel";
import { getMetrics, getPrediction, getPrices, resolveSymbol } from "@/lib/api";
import { day, num, pct } from "@/lib/format";
import { P3Error } from "@/lib/p3";
import { attemptFrom } from "@/lib/retry";
import { settle } from "@/lib/settle";
import { clean } from "@/lib/text";

type Params = Promise<{ symbol: string }>;

function decode(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return "";
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { symbol } = await params;
  return { title: clean(decode(symbol).toUpperCase(), 16) };
}

export default async function TickerPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams?: Promise<{ r?: string | string[] }>;
}) {
  const { symbol: raw } = await params;
  const attempt = attemptFrom((await searchParams)?.r);
  // El símbolo se valida (formato + lista de /tickers) antes de construir cualquier URL hacia P3.
  const ticker = await settle(resolveSymbol(decode(raw)));
  if (!ticker.ok) {
    if (ticker.error instanceof P3Error && ticker.error.kind === "not_found") notFound();
    return <ProblemPanel error={ticker.error} path={`/ticker/${encodeURIComponent(raw)}`} attempt={attempt} />;
  }
  const { symbol, name, sector } = ticker.data;
  const [prices, metrics, prediction] = await Promise.all([
    settle(getPrices(symbol)),
    settle(getMetrics(symbol)),
    settle(getPrediction(symbol)),
  ]);
  const path = `/ticker/${encodeURIComponent(symbol)}`;
  return (
    <>
      <h1>
        {clean(symbol, 16)}{" "}
        <span className="muted">
          {clean(name, 60)} · {clean(sector, 40)}
        </span>
      </h1>

      <section aria-labelledby="h-precios">
        <h2 id="h-precios">Precio (último año)</h2>
        {prices.ok ? (
          <PriceChart symbol={clean(symbol, 16)} points={prices.data.items} />
        ) : (
          <ProblemPanel error={prices.error} path={path} attempt={attempt} />
        )}
      </section>

      <section aria-labelledby="h-metricas">
        <h2 id="h-metricas">Métricas</h2>
        {metrics.ok ? (
          <>
            <dl className="facts">
              <dt>Periodo</dt>
              <dd>
                {day(metrics.data.start)} a {day(metrics.data.end)} ({metrics.data.n_days} días)
              </dd>
              <dt>Retorno total</dt>
              <dd>{pct(metrics.data.total_return)}</dd>
              <dt>Volatilidad anualizada</dt>
              <dd>{pct(metrics.data.volatility, 1, false)}</dd>
              <dt>Máxima caída</dt>
              <dd>{pct(metrics.data.max_drawdown)}</dd>
              <dt>Sharpe</dt>
              <dd>{num(metrics.data.sharpe)}</dd>
            </dl>
            <p className="muted">
              Calculadas sobre todo el historial disponible. Rentabilidades pasadas no garantizan resultados futuros.
            </p>
          </>
        ) : (
          <ProblemPanel error={metrics.error} path={path} attempt={attempt} />
        )}
      </section>

      <section aria-labelledby="h-pred">
        <h2 id="h-pred">Predicción de volatilidad</h2>
        {prediction.ok ? <PredictionCard p={prediction.data} /> : <ProblemPanel error={prediction.error} path={path} attempt={attempt} />}
      </section>
      <Disclaimer />
    </>
  );
}
