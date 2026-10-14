import { getConfig, MAX_BODY_BYTES } from "./env";
import { ConfigError } from "./env";
import { clean } from "./text";
import { z } from "zod";

export type P3ErrorKind =
  | "config"
  | "unavailable" // red caída / P3 dormida
  | "timeout"
  | "rate_limited"
  | "not_found"
  | "invalid" // 4xx de validación
  | "server" // 5xx
  | "too_large"
  | "unexpected"; // forma de respuesta inesperada

export class P3Error extends Error {
  constructor(
    public kind: P3ErrorKind,
    message: string,
    public status?: number,
    public code?: string,
    public requestId?: string,
    public retryAfter?: number,
  ) {
    super(message);
    this.name = "P3Error";
  }
}

/** Dependencias sustituibles en tests (sin esperas reales). */
export const deps = {
  sleep: (ms: number) => new Promise<void>((r) => setTimeout(r, ms)),
  now: () => Date.now(),
};

const RETRY_STATUS = new Set([502, 503, 504]);
const envelope = z.object({
  error: z.object({ code: z.string().optional(), message: z.string().optional(), request_id: z.string().nullish() }),
});

// Caché en memoria (solo respuestas correctas) para no golpear a P3 en cada visita.
const cache = new Map<string, { exp: number; data: unknown }>();
const MAX_CACHE = 200;
export function clearCache() {
  cache.clear();
}

async function readCapped(res: Response, signal: AbortSignal): Promise<string> {
  const declared = Number(res.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    await res.body?.cancel().catch(() => {});
    throw new P3Error("too_large", "La API devolvió una respuesta demasiado grande.");
  }
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    if (signal.aborted) {
      await reader.cancel().catch(() => {});
      throw new P3Error("timeout", "La API tardó demasiado en responder.");
    }
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel().catch(() => {});
      throw new P3Error("too_large", "La API devolvió una respuesta demasiado grande.");
    }
    chunks.push(value);
  }
  const buf = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    buf.set(c, off);
    off += c.byteLength;
  }
  return new TextDecoder().decode(buf);
}

function errorFrom(status: number, text: string, headers: Headers): P3Error {
  let code: string | undefined;
  let message: string | undefined;
  let rid: string | undefined;
  try {
    const parsed = envelope.safeParse(JSON.parse(text));
    if (parsed.success) {
      code = clean(parsed.data.error.code, 40);
      message = clean(parsed.data.error.message, 200);
      rid = parsed.data.error.request_id ? clean(parsed.data.error.request_id, 40) : undefined;
    }
  } catch {
    /* cuerpo no JSON: se usa el mensaje genérico */
  }
  if (status === 429) {
    const ra = Number(headers.get("retry-after"));
    return new P3Error("rate_limited", "La API recibió demasiadas peticiones.", status, code, rid, Number.isFinite(ra) && ra > 0 ? Math.min(ra, 3600) : undefined);
  }
  if (status === 404) return new P3Error("not_found", message ?? "No encontrado.", status, code, rid);
  if (status >= 500) return new P3Error("server", "La API tuvo un problema interno.", status, code, rid);
  return new P3Error("invalid", message ?? `La API rechazó la consulta (HTTP ${status}).`, status, code, rid);
}

export type GetOptions = {
  params?: Record<string, string | number>;
  ttlMs?: number;
  /** Si se indica, la respuesta se valida ANTES de cachearla: una respuesta malformada nunca queda en caché. */
  schema?: z.ZodType;
};

/** GET a P3 con plazo total, tope de tamaño, sin compresión y reintentos acotados. Devuelve JSON sin validar. */
export async function p3Get(path: string, opts: GetOptions = {}): Promise<unknown> {
  let cfg;
  try {
    cfg = getConfig();
  } catch (e) {
    throw new P3Error("config", e instanceof ConfigError ? e.message : "Configuración inválida.");
  }
  const url = new URL(cfg.baseUrl + path);
  for (const [k, v] of Object.entries(opts.params ?? {})) url.searchParams.set(k, String(v));
  const key = url.toString();
  const hit = cache.get(key);
  if (hit && hit.exp > deps.now()) return hit.data;

  const signal = AbortSignal.timeout(cfg.timeoutMs); // plazo TOTAL de la consulta, reintentos incluidos
  const headers: Record<string, string> = { Accept: "application/json", "Accept-Encoding": "identity" };
  if (cfg.apiKey) headers["X-API-Key"] = cfg.apiKey;
  let last: P3Error | undefined;

  for (let attempt = 0; attempt <= cfg.retries; attempt++) {
    if (attempt > 0) await deps.sleep(250 * 2 ** (attempt - 1));
    if (signal.aborted) throw new P3Error("timeout", "La API tardó demasiado en responder.");
    try {
      const res = await fetch(url, { headers, signal, redirect: "error", cache: "no-store" });
      const enc = (res.headers.get("content-encoding") ?? "identity").trim().toLowerCase();
      if (enc !== "" && enc !== "identity") {
        await res.body?.cancel().catch(() => {});
        throw new P3Error("unexpected", "Respuesta inesperada de la API (codificación no soportada).");
      }
      const text = await readCapped(res, signal);
      if (RETRY_STATUS.has(res.status) && attempt < cfg.retries) {
        last = errorFrom(res.status, text, res.headers);
        continue;
      }
      if (!res.ok) throw errorFrom(res.status, text, res.headers);
      if (text.trim() === "") throw new P3Error("unexpected", "Respuesta inesperada de la API (cuerpo vacío).");
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        throw new P3Error("unexpected", "Respuesta inesperada de la API (no es JSON).");
      }
      if (opts.schema) data = parseWith(opts.schema, data); // lanza P3Error("unexpected") antes de cachear
      if (opts.ttlMs) {
        if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value as string);
        cache.set(key, { exp: deps.now() + opts.ttlMs, data });
      }
      return data;
    } catch (e) {
      if (e instanceof P3Error) throw e;
      if (signal.aborted || (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError"))) {
        throw new P3Error("timeout", "La API tardó demasiado en responder.");
      }
      last = new P3Error("unavailable", "No se pudo conectar con la API de mercado.");
    }
  }
  throw last ?? new P3Error("unavailable", "No se pudo conectar con la API de mercado.");
}

/** p3Get + validación con esquema (antes de cachear), con tipo de salida. */
export async function p3Fetch<S extends z.ZodType>(schema: S, path: string, opts: Omit<GetOptions, "schema"> = {}): Promise<z.infer<S>> {
  return (await p3Get(path, { ...opts, schema })) as z.infer<S>;
}

/** Valida la forma de una respuesta; si no coincide, error controlado ("respuesta inesperada"). */
export function parseWith<S extends z.ZodType>(schema: S, data: unknown): z.infer<S> {
  const r = schema.safeParse(data);
  if (!r.success) throw new P3Error("unexpected", "Respuesta inesperada de la API.");
  return r.data;
}