import { day, num } from "@/lib/format";

export type Point = { date: string; close: number };

const W = 640;
const H = 260;
const PAD = { l: 56, r: 12, t: 12, b: 28 };

/** Gráfico de línea en SVG (sin librerías ni estilos en línea) con descripción y tabla alternativa. */
export function PriceChart({ symbol, points }: { symbol: string; points: Point[] }) {
  if (points.length < 2) return <p>No hay suficientes precios para graficar.</p>;
  const closes = points.map((p) => p.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const span = max - min || 1;
  const x = (i: number) => PAD.l + (i / (points.length - 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - min) / span) * (H - PAD.t - PAD.b);
  const line = points.map((p, i) => `${x(i).toFixed(1)},${y(p.close).toFixed(1)}`).join(" ");
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const ticks = [min, min + span / 2, max];
  const summary = `Cierre ajustado de ${symbol} entre ${day(first.date)} y ${day(last.date)}: de ${num(first.close)} a ${num(last.close)} USD (mínimo ${num(min)}, máximo ${num(max)}).`;
  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`chart-t-${symbol}`} focusable="false">
        <title id={`chart-t-${symbol}`}>{summary}</title>
        {ticks.map((t) => (
          <g key={t}>
            <line className="chart-grid" x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} />
            <text className="chart-label" x={PAD.l - 6} y={y(t) + 4} textAnchor="end">
              {num(t)}
            </text>
          </g>
        ))}
        <polyline className="chart-line" fill="none" points={line} />
        <text className="chart-label" x={PAD.l} y={H - 8}>
          {day(first.date)}
        </text>
        <text className="chart-label" x={W - PAD.r} y={H - 8} textAnchor="end">
          {day(last.date)}
        </text>
      </svg>
      <figcaption>{summary}</figcaption>
      <details>
        <summary>Ver los datos en una tabla</summary>
        <div className="table-scroll" tabIndex={0} role="region" aria-label={`Tabla de precios de ${symbol}`}>
          <table>
            <caption className="sr-only">Cierres ajustados de {symbol} (USD), más recientes primero</caption>
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Cierre (USD)</th>
              </tr>
            </thead>
            <tbody>
              {[...points].reverse().map((p) => (
                <tr key={p.date}>
                  <td>{day(p.date)}</td>
                  <td className="n">{num(p.close)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}