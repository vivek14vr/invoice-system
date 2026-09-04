export function normalizeSearch(value?: string) {
  return value?.trim() || '';
}

export function compactSearch(value: string) {
  return value.normalize('NFKC').replace(/\s+/g, '').toLowerCase();
}

export function buildSearchKey(...values: unknown[]) {
  return compactSearch(
    values.filter((value): value is string => typeof value === 'string').join(' '),
  );
}

// MongoDB evaluates Prisma `contains` filters as regular expressions.
export function escapeSearchRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
