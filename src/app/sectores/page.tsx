import type { Metadata } from "next";
import { ProblemPanel } from "@/components/ProblemPanel";
import { getSectors } from "@/lib/api";
import { num, pct } from "@/lib/format";
import { attemptFrom } from "@/lib/retry";
import { settle } from "@/lib/settle";
import { clean } from "@/lib/text";

export const metadata: Metadata = { title: "Sectores" };

export default async function Sectores({ searchParams }: { searchParams?: Promise<{ r?: string | string[] }> } = {}) {
  const attempt = attemptFrom((await searchParams)?.r);
  const res = await settle(getSectors());
  const rows = res.ok ? [...res.data.sectors].sort((a, b) => b.total_return - a.total_return) : [];
  return (
    <>
      <h1>Resumen por sector</h1>
      {res.ok ? (
        <>
          <p className="muted">
            Cartera de igual ponderación por sector, {clean(res.data.start, 10)} a {clean(res.data.end, 10)}. Rentabilidades
            pasadas no garantizan resultados futuros.
          </p>
          <div className="table-scroll" tabIndex={0} role="region" aria-label="Tabla de sectores">
            <table>
              <caption className="sr-only">Resumen por sector</caption>
              <thead>
                <tr>
                  <th scope="col">Sector</th>
                  <th scope="col" className="n">
                    Retorno total
                  </th>
                  <th scope="col" className="n">
                    Volatilidad
                  </th>
                  <th scope="col" className="n">
                    Máx. caída
                  </th>
                  <th scope="col" className="n">
                    Sharpe
                  </th>
                  <th scope="col">Mejor / peor</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.sector}>
                    <th scope="row">{clean(r.sector, 40)}</th>
                    <td className="n">{pct(r.total_return)}</td>
                    <td className="n">{pct(r.volatility, 1, false)}</td>
                    <td className="n">{pct(r.max_drawdown)}</td>
                    <td className="n">{num(r.sharpe)}</td>
                    <td>
                      {clean(r.best_ticker, 16)} / {clean(r.worst_ticker, 16)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <ProblemPanel error={res.error} path="/sectores" attempt={attempt} />
      )}
    </>
  );
}
