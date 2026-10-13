import Link from "next/link";

export function Nav() {
  return (
    <nav aria-label="Principal">
      <Link href="/">Ranking</Link>
      <Link href="/sectores">Sectores</Link>
      <Link href="/modelo">Modelo</Link>
    </nav>
  );
}