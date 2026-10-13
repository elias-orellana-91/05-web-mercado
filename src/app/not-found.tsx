import Link from "next/link";

export default function NotFound() {
  return (
    <section>
      <h1>No encontrado</h1>
      <p>La página o el símbolo pedido no existe en esta web.</p>
      <p>
        <Link href="/">Volver al ranking</Link>
      </p>
    </section>
  );
}