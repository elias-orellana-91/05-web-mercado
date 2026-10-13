export default function Loading() {
  return (
    <p role="status" aria-live="polite">
      Cargando datos… si la API estaba dormida puede tardar unos segundos.
    </p>
  );
}