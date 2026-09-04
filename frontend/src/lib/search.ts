export function compactSearch(value: string) {
  return value.normalize('NFKC').replace(/\s+/g, '').toLowerCase();
}
