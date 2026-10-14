import { P3Error, type P3ErrorKind } from "@/lib/p3";
import { MAX_AUTO_RETRIES, withAttempt } from "@/lib/retry";

const MESSAGES: Record<P3ErrorKind, { title: string; body: string; retry: boolean }> = {
  unavailable: {
    title: "La API de mercado no responde",
    body: "Puede estar iniciándose (el servicio gratuito se duerme tras un rato sin uso).",
    retry: true,
  },
  timeout: {
    title: "La API tardó demasiado",
    body: "Puede estar despertando.",
    retry: true,
  },
  rate_limited: {
    title: "Demasiadas consultas",
    body: "La API limitó las peticiones. Espera un momento y reintenta.",
    retry: true,
  },
  server: { title: "La API tuvo un problema", body: "Reintenta en unos minutos.", retry: true },
  config: { title: "Configuración incompleta", body: "El servidor web no tiene una configuración válida de la API.", retry: false },
  too_large: { title: "Respuesta demasiado grande", body: "La API devolvió más datos de los permitidos.", retry: false },
  unexpected: { title: "Respuesta inesperada de la API", body: "Los datos recibidos no tienen la forma esperada.", retry: false },
  invalid: { title: "Consulta no válida", body: "La API rechazó la consulta.", retry: false },
  not_found: { title: "No encontrado", body: "El recurso pedido no existe.", retry: false },
};

/** Estado de error amigable: nunca muestra trazas ni detalles internos. */
/**
 * `path` = ruta actual (con su query, sin `r`); `attempt` = refrescos automáticos ya hechos (`?r=`).
 * El refresco automático (meta refresh, sin JS) se detiene tras MAX_AUTO_RETRIES.
 */
export function ProblemPanel({ error, path = "", attempt = 0 }: { error: unknown; path?: string; attempt?: number }) {
  const kind: P3ErrorKind = error instanceof P3Error ? error.kind : "unexpected";
  const m = MESSAGES[kind];
  const rid = error instanceof P3Error ? error.requestId : undefined;
  const auto = m.retry && kind !== "rate_limited" && attempt < MAX_AUTO_RETRIES;
  const exhausted = m.retry && kind !== "rate_limited" && attempt >= MAX_AUTO_RETRIES;
  return (
    <section className="problem" role="alert" aria-live="polite">
      {auto && <meta httpEquiv="refresh" content={`20;url=${withAttempt(path, attempt + 1)}`} />}
      <h2>{m.title}</h2>
      <p>{m.body}</p>
      {exhausted && (
        <p>Se agotaron los reintentos automáticos. Reintenta manualmente cuando la API esté disponible.</p>
      )}
      {auto && (
        <p className="muted">
          Esta página se reintentará sola en 20 s (intento {attempt + 1} de {MAX_AUTO_RETRIES}).
        </p>
      )}
      {rid && <p className="muted">Id de petición: {rid}</p>}
      {m.retry && (
        <p>
          <a className="button" href={withAttempt(path, 0)}>
            Reintentar ahora
          </a>
        </p>
      )}
    </section>
  );
}