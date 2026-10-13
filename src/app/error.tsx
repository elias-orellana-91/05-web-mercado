"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  // No se muestra el mensaje del error: podría contener detalles internos.
  return (
    <section className="problem" role="alert">
      <h2>Algo salió mal</h2>
      <p>No pudimos mostrar esta página. Reintenta en unos instantes.</p>
      <p>
        <button className="button" onClick={() => reset()}>
          Reintentar
        </button>
      </p>
    </section>
  );
}