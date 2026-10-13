// Configuración SOLO del servidor. Nada de NEXT_PUBLIC_*: ni la URL de P3 ni la clave llegan al navegador.

export class ConfigError extends Error {}

export type Config = {
  baseUrl: string;
  apiKey: string | undefined;
  timeoutMs: number;
  retries: number;
};

export const MAX_BODY_BYTES = 2_000_000;

export function validateBaseUrl(raw: string): string {
  if (/[\x00-\x20\x7f-\x9f]/.test(raw)) throw new ConfigError("P3_BASE_URL contiene espacios o caracteres de control.");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ConfigError("P3_BASE_URL no es una URL válida.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new ConfigError("P3_BASE_URL debe ser http(s).");
  if (url.username || url.password) throw new ConfigError("P3_BASE_URL no debe incluir credenciales.");
  return raw.replace(/\/+$/, "");
}

function intInRange(name: string, raw: string | undefined, def: number, lo: number, hi: number): number {
  if (raw === undefined || raw.trim() === "") return def;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < lo || n > hi) throw new ConfigError(`${name} debe ser un entero entre ${lo} y ${hi}.`);
  return n;
}

export function getConfig(env: Record<string, string | undefined> = process.env): Config {
  return {
    baseUrl: validateBaseUrl(env.P3_BASE_URL ?? "http://127.0.0.1:8000"),
    apiKey: env.P3_API_KEY?.trim() || undefined,
    timeoutMs: intInRange("P3_TIMEOUT_MS", env.P3_TIMEOUT_MS, 8000, 1000, 60000),
    retries: intInRange("P3_RETRIES", env.P3_RETRIES, 2, 0, 4),
  };
}