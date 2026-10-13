export type Settled<T> = { ok: true; data: T } | { ok: false; error: unknown };

/** Convierte una promesa en resultado: permite renderizar cada sección con su propio estado de error. */
export async function settle<T>(p: Promise<T>): Promise<Settled<T>> {
  try {
    return { ok: true, data: await p };
  } catch (error) {
    return { ok: false, error };
  }
}