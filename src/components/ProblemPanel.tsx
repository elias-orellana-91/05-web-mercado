import { P3Error, type P3ErrorKind } from "@/lib/p3";

const MESSAGES: Record<P3ErrorKind, { title: string; body: string; retry: boolean }> = {
  unavailable: {
    title: "La API de mercado no responde",
    body: "Puede estar iniciándose (el servicio gratuito se duerme tras un rato sin uso). Esta página se reintentará sola.",
    retry: true,
  },
  timeout: {
    title: "La API tardó demasiado",
    body: "Puede estar despertando. Esta página se reintentará sola en unos segundos.",
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
export function ProblemPanel({ error, path = "" }: { error: unknown; path?: string }) {
  const kind: P3ErrorKind = error instanceof P3Error ? error.kind : "unexpected";
  const m = MESSAGES[kind];
  const rid = error instanceof P3Error ? error.requestId : undefined;
  return (
    <section className="problem" role="alert" aria-live="polite">
      {m.retry && kind !== "rate_limited" && <meta httpEquiv="refresh" content="20" />}
      <h2>{m.title}</h2>
      <p>{m.body}</p>
      {rid && <p className="muted">Id de petición: {rid}</p>}
      {m.retry && (
        <p>
          <a className="button" href={path || "?"}>
            Reintentar ahora
          </a>
        </p>
      )}
    </section>
  );
}