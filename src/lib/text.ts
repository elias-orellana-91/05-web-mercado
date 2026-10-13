// Texto externo (API) -> una línea sin caracteres de control/bidi y con largo acotado.
// React ya escapa HTML; esto evita además caracteres invisibles o de redirección visual.
const CTRL = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u2064\u2066-\u2069\u061c\ufeff]/g;

export function clean(value: unknown, max = 80): string {
  if (value === null || value === undefined || typeof value === "object") return "n/d";
  return String(value).replace(CTRL, " ").trim().slice(0, max);
}