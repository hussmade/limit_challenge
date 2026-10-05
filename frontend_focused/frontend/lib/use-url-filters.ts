'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
export function useUrlFilters() {
  const search = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const params = Object.fromEntries(search.entries());
  function update(values: Record<string, string>, replace = false) {
    const next = new URLSearchParams(search.toString());
    if (!('page' in values)) next.delete('page');
    Object.entries(values).forEach(([key, value]) =>
      value ? next.set(key, value) : next.delete(key),
    );
    const href = `${path}${next.size ? `?${next}` : ''}`;
    if (replace) router.replace(href, { scroll: false });
    else router.push(href, { scroll: false });
  }
  return {
    params,
    page: Math.max(1, Number(params.page) || 1),
    update,
    clear: () => router.push(path, { scroll: false }),
    query: search.toString(),
  };
}
