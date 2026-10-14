/** Máximo de refrescos automáticos seguidos del estado de error (sin JS: el contador viaja en `?r=`). */
export const MAX_AUTO_RETRIES = 5;

/** Lee el contador `r` de la URL; cualquier valor raro cuenta como 0 y se acota a [0, MAX_AUTO_RETRIES]. */
export function attemptFrom(raw: string | string[] | undefined): number {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === undefined || !/^\d{1,3}$/.test(v)) return 0;
  return Math.min(Number(v), MAX_AUTO_RETRIES);
}

/** Misma ruta con el contador `r` fijado (o sin él si `attempt` es 0). */
export function withAttempt(path: string, attempt: number): string {
  const base = path || "/";
  if (attempt <= 0) return base;
  return `${base}${base.includes("?") ? "&" : "?"}r=${attempt}`;
}