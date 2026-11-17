import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FEATURES_LIST_COMPOSITE_INDEX, hasCompositeIndex, ensureCompositeIndex } from './cosmosIndexes.js';
import { readFileSync } from 'node:fs';

function fakeContainer(indexingPolicy) {
  const calls = { replaced: [] };
  return {
    calls,
    read: async () => ({ resource: { id: 'features', partitionKey: { paths: ['/id'] }, indexingPolicy, _etag: 'x' } }),
    replace: async (def) => { calls.replaced.push(def); },
  };
}

describe('features list composite index', () => {
  it('matches the ORDER BY in GET /api/features exactly (same properties, order and directions)', () => {
    const src = readFileSync(new URL('../routes/features.js', import.meta.url), 'utf8');
    const match = src.match(/const orderClause = 'ORDER BY ([^']+)'/);
    assert.ok(match, 'could not find orderClause in routes/features.js');
    const fromQuery = match[1].split(',').map((part) => {
      const [field, dir = 'ASC'] = part.trim().replace(/^c\./, '').split(/\s+/);
      return { path: `/${field}`, order: dir.toUpperCase() === 'DESC' ? 'descending' : 'ascending' };
    });
    assert.deepEqual(FEATURES_LIST_COMPOSITE_INDEX, fromQuery);
  });
});

describe('ensureCompositeIndex', () => {
  it('adds the index to an existing container that lacks it, keeping the rest of the policy', async () => {
    const c = fakeContainer({ indexingMode: 'consistent', includedPaths: [{ path: '/*' }] });
    assert.equal(await ensureCompositeIndex(c, FEATURES_LIST_COMPOSITE_INDEX, { info() {} }), true);
    const policy = c.calls.replaced[0].indexingPolicy;
    assert.deepEqual(policy.compositeIndexes, [FEATURES_LIST_COMPOSITE_INDEX]);
    assert.deepEqual(policy.includedPaths, [{ path: '/*' }]);
    assert.equal(c.calls.replaced[0].id, 'features');
  });

  it('keeps other composite indexes that are already defined', async () => {
    const other = [{ path: '/a', order: 'ascending' }, { path: '/b', order: 'ascending' }];
    const c = fakeContainer({ compositeIndexes: [other] });
    await ensureCompositeIndex(c, FEATURES_LIST_COMPOSITE_INDEX, { info() {} });
    assert.deepEqual(c.calls.replaced[0].indexingPolicy.compositeIndexes, [other, FEATURES_LIST_COMPOSITE_INDEX]);
  });

  it('does nothing when the index is already there', async () => {
    const c = fakeContainer({ compositeIndexes: [FEATURES_LIST_COMPOSITE_INDEX] });
    assert.equal(await ensureCompositeIndex(c, FEATURES_LIST_COMPOSITE_INDEX, { info() {} }), false);
    assert.equal(c.calls.replaced.length, 0);
  });

  it('does not treat a different sort direction as the same index', () => {
    const flipped = FEATURES_LIST_COMPOSITE_INDEX.map((p) => ({ ...p, order: p.order === 'ascending' ? 'descending' : 'ascending' }));
    assert.equal(hasCompositeIndex({ compositeIndexes: [flipped] }, FEATURES_LIST_COMPOSITE_INDEX), false);
  });
});
