import type { Metadata } from "next";
import { ProblemPanel } from "@/components/ProblemPanel";
import { getModel } from "@/lib/api";
import { num, numericEntries } from "@/lib/format";
import { settle } from "@/lib/settle";
import { clean } from "@/lib/text";

export const metadata: Metadata = { title: "Modelo" };

function MetricsTable({ title, data }: { title: string; data: Record<string, unknown> }) {
  const rows = numericEntries(data);
  if (rows.length === 0) return null;
  return (
    <table>
      <caption>{title}</caption>
      <thead>
        <tr>
          <th scope="col">Métrica</th>
          <th scope="col" className="n">
            Valor
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k}>
            <th scope="row">{k}</th>
            <td className="n">{num(v, 3)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function Modelo() {
  const res = await settle(getModel());
  return (
    <>
      <h1>Modelo de volatilidad</h1>
      <p>Estima la probabilidad de volatilidad alta en los próximos 5 días hábiles. Es un modelo educativo.</p>
      {res.ok ? (
        <>
          <dl className="facts">
            <dt>Modelo</dt>
            <dd>
              {clean(res.data.model_name, 60)} v{clean(res.data.model_version, 20)}
            </dd>
            <dt>Entrenado el</dt>
            <dd>{clean(res.data.trained_at, 30)}</dd>
            <dt>Datos de entrenamiento</dt>
            <dd>{clean(res.data.trained_on, 120)}</dd>
            <dt>Umbral de decisión</dt>
            <dd>{num(res.data.decision_threshold)}</dd>
            <dt>Variables</dt>
            <dd>{res.data.features.length}</dd>
          </dl>
          <MetricsTable title="Métricas en el conjunto de test" data={res.data.test_metrics} />
          {Object.entries(res.data.baselines_test_metrics)
            .slice(0, 5)
            .map(([name, d]) => (
              <MetricsTable key={name} title={`Referencia: ${clean(name, 40)}`} data={d} />
            ))}
          <p className="muted">
            Las referencias son modelos simples para comparar. Si el modelo apenas las supera, la ventaja es modesta: las
            métricas de test son la única evidencia fuera de muestra.
          </p>
        </>
      ) : (
        <ProblemPanel error={res.error} path="/modelo" />
      )}
    </>
  );
}
