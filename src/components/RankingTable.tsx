import Link from "next/link";
import { clean } from "@/lib/text";
import { num, pct } from "@/lib/format";
import type { Ranking } from "@/lib/schemas";

export const metricLabel = { return: "retorno", volatility: "volatilidad anualizada", sharpe: "Sharpe" } as const;
export const periodLabel = { month: "del mes", quarter: "del trimestre", ytd: "del año en curso", custom: "del periodo" } as const;

export function fmtValue(metric: Ranking["metric"], v: number | null): string {
  return metric === "sharpe" ? num(v) : pct(v, 1, metric === "return");
}

export function headline(r: Ranking): string {
  const dir = r.order === "desc" ? "Mayor" : "Menor";
  return `${dir} ${metricLabel[r.metric]} ${periodLabel[r.period]}`;
}

export function RankingTable({ ranking }: { ranking: Ranking }) {
  if (ranking.items.length === 0) return <p>No hay datos suficientes para armar el ranking.</p>;
  return (
    <div className="table-scroll" tabIndex={0} role="region" aria-label="Tabla de ranking">
      <table>
        <caption className="sr-only">
          {headline(ranking)} ({clean(ranking.start, 10)} a {clean(ranking.end, 10)})
        </caption>
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Símbolo</th>
            <th scope="col">Empresa</th>
            <th scope="col">Sector</th>
            <th scope="col" className="n">
              {metricLabel[ranking.metric]}
            </th>
          </tr>
        </thead>
        <tbody>
          {ranking.items.map((it) => (
            <tr key={it.ticker}>
              <td>{it.rank}</td>
              <th scope="row">
                <Link href={`/ticker/${encodeURIComponent(it.ticker)}`}>{clean(it.ticker, 16)}</Link>
              </th>
              <td>{clean(it.name, 60)}</td>
              <td>{clean(it.sector, 40)}</td>
              <td className="n">{fmtValue(ranking.metric, it.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}