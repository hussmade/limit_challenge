import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="center-state">
      <h1>Page not found</h1>
      <p>This page may have moved or the link may be incomplete.</p>
      <Link href="/">Return to workspace</Link>
    </main>
  );
}
