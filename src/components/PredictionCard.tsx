import { day, num, pct } from "@/lib/format";
import { clean } from "@/lib/text";
import type { Prediction } from "@/lib/schemas";

export function PredictionCard({ p }: { p: Prediction }) {
  return (
    <div className="card">
      <p className="big">
        {pct(p.probability_high_vol, 0, false)} <span className="muted">de probabilidad de volatilidad alta</span>
      </p>
      <p>
        En los próximos {p.horizon_days} días hábiles, con datos al {day(p.as_of_date)}. Clasificación:{" "}
        <strong>{clean(p.label, 10)}</strong> (umbral {num(p.decision_threshold)}).
      </p>
      {p.in_sample && (
        <p className="warning" role="alert">
          <strong>Atención:</strong> esta fecha cae dentro de la muestra de entrenamiento del modelo. Ya vio esos datos,
          así que no es una predicción fuera de muestra y no debe leerse como evidencia de capacidad predictiva.
        </p>
      )}
      <p className="muted">
        Modelo v{clean(p.model_version, 20)}. Es una estimación estadística, no una certeza. No es asesoría ni
        recomendación de inversión.
      </p>
    </div>
  );
}