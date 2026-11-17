import { describe, it, expect } from 'vitest';
import { initialArrayFilter, parseArrayParam } from './filterState';

const params = (qs) => new URLSearchParams(qs);

describe('initialArrayFilter', () => {
  it('uses the URL value when the param is present, ignoring the saved preference', () => {
    expect(initialArrayFilter(params('category=a,b'), 'category', ['saved'])).toEqual(['a', 'b']);
  });

  it('falls back to the saved preference when the URL has no such param', () => {
    expect(initialArrayFilter(params('q=x'), 'category', ['saved-1', 'saved-2'])).toEqual(['saved-1', 'saved-2']);
  });

  it('starts empty when there is neither a URL param nor a saved preference', () => {
    expect(initialArrayFilter(params(''), 'category', undefined)).toEqual([]);
    expect(initialArrayFilter(params(''), 'category', 'not-an-array')).toEqual([]);
  });

  it('treats an explicitly empty param as "no selection" rather than falling back', () => {
    expect(initialArrayFilter(params('category='), 'category', ['saved'])).toEqual([]);
  });

  it('accepts a custom parser', () => {
    expect(initialArrayFilter(params('k=A,B'), 'k', [], (v) => v.toLowerCase().split(','))).toEqual(['a', 'b']);
  });
});

describe('parseArrayParam', () => {
  it('splits on commas and drops empties', () => {
    expect(parseArrayParam('a,,b')).toEqual(['a', 'b']);
    expect(parseArrayParam(null)).toEqual([]);
  });
});
