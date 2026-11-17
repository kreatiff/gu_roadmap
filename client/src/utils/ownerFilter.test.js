import { describe, it, expect } from 'vitest';
import {
  NO_OWNER, ownerKey, buildOwnerOptions, matchesOwnerFilter, formatOwnerParam, parseOwnerParam,
} from './ownerFilter';

const f = (owner) => ({ id: String(Math.random()), owner });

describe('buildOwnerOptions', () => {
  it('lists each distinct owner once, alphabetically, ignoring case and spacing differences', () => {
    const options = buildOwnerOptions([f('Priya Shah'), f('sam lee'), f('priya shah '), f('Alex Wong')]);
    expect(options.map((o) => o.label)).toEqual(['Alex Wong', 'Priya Shah', 'sam lee']);
    expect(options.find((o) => o.label === 'Priya Shah').id).toBe('priya shah');
  });

  it('puts "No owner" first only when some feature has no owner', () => {
    expect(buildOwnerOptions([f('Sam'), f(''), f(undefined), f('   ')])[0]).toEqual({ id: NO_OWNER, label: 'No owner' });
    expect(buildOwnerOptions([f('Sam')]).some((o) => o.id === NO_OWNER)).toBe(false);
  });

  it('returns nothing for no features', () => {
    expect(buildOwnerOptions([])).toEqual([]);
  });
});

describe('matchesOwnerFilter', () => {
  it('matches everything when nothing is selected', () => {
    expect(matchesOwnerFilter(f('Sam'), [])).toBe(true);
    expect(matchesOwnerFilter(f(''), [])).toBe(true);
  });

  it('matches case-insensitively and treats several selections as OR', () => {
    expect(matchesOwnerFilter(f('PRIYA SHAH'), [ownerKey('priya shah')])).toBe(true);
    expect(matchesOwnerFilter(f('Sam'), [ownerKey('Priya Shah'), ownerKey('Sam')])).toBe(true);
    expect(matchesOwnerFilter(f('Alex'), [ownerKey('Priya Shah')])).toBe(false);
  });

  it('matches unowned features only via the No owner option', () => {
    expect(matchesOwnerFilter(f(undefined), [NO_OWNER])).toBe(true);
    expect(matchesOwnerFilter(f('  '), [NO_OWNER])).toBe(true);
    expect(matchesOwnerFilter(f('Sam'), [NO_OWNER])).toBe(false);
    expect(matchesOwnerFilter(f(undefined), [ownerKey('Sam')])).toBe(false);
  });
});

describe('owner URL param', () => {
  it('round-trips keys, including owners whose names contain commas', () => {
    const keys = ['shah, priya', 'sam lee', NO_OWNER];
    expect(parseOwnerParam(formatOwnerParam(keys))).toEqual(keys);
  });

  it('parses an empty or missing param as no selection', () => {
    expect(parseOwnerParam(null)).toEqual([]);
    expect(parseOwnerParam('')).toEqual([]);
  });
});
