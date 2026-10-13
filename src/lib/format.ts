import { clean } from "./text";

const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

export function pct(x: unknown, digits = 1, sign = true): string {
  if (!isNum(x)) return "n/d";
  const s = new Intl.NumberFormat("es", { style: "percent", minimumFractionDigits: digits, maximumFractionDigits: digits, signDisplay: sign ? "exceptZero" : "auto" }).format(x);
  return s.replace(/\u00a0/g, " ");
}

export function num(x: unknown, digits = 2): string {
  if (!isNum(x)) return "n/d";
  return new Intl.NumberFormat("es", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(x);
}

export function day(x: unknown): string {
  return clean(x, 10);
}

/** Valores numéricos de un diccionario libre (métricas del modelo); descarta lo que no sea número. */
export function numericEntries(d: Record<string, unknown>, max = 12): [string, number][] {
  return Object.entries(d).filter((e): e is [string, number] => isNum(e[1])).slice(0, max).map(([k, v]) => [clean(k, 30), v]);
}