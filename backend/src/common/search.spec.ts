import {
  buildSearchKey,
  compactSearch,
  escapeSearchRegex,
  normalizeSearch,
} from './search';

describe('search helpers', () => {
  it('trims and ignores whitespace for compact matching', () => {
    expect(normalizeSearch('  Vivek  Raj  ')).toBe('Vivek  Raj');
    expect(compactSearch('  Vivek  Raj  ')).toBe('vivekraj');
    expect(buildSearchKey('Vivek', 'Raj', null, 'College')).toBe('vivekrajcollege');
  });

  it('escapes regex metacharacters as literal search text', () => {
    expect(escapeSearchRegex('vivek raj(')).toBe('vivek raj\\(');
    expect(escapeSearchRegex('[test]*')).toBe('\\[test\\]\\*');
  });
});
