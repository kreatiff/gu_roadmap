/**
 * Cosmos DB (NoSQL) rejects any ORDER BY on more than one property unless a composite
 * index with exactly that property order and those sort directions exists:
 *   "The order by query does not have a corresponding composite index that it can be
 *    served from."
 * The local emulator is lenient about this, so it only shows up on a real account.
 *
 * Kept free of database imports so it can be unit tested with a fake container.
 */

// Must match the ORDER BY in GET /api/features (routes/features.js) exactly:
//   ORDER BY c.pinned DESC, c.stage_sort_order ASC, c.vote_count DESC, c.created_at DESC
export const FEATURES_LIST_COMPOSITE_INDEX = [
  { path: '/pinned', order: 'descending' },
  { path: '/stage_sort_order', order: 'ascending' },
  { path: '/vote_count', order: 'descending' },
  { path: '/created_at', order: 'descending' },
];

const sameIndex = (a, b) =>
  a.length === b.length &&
  a.every((p, i) => p.path === b[i].path && (p.order ?? 'ascending') === (b[i].order ?? 'ascending'));

export function hasCompositeIndex(indexingPolicy, composite) {
  return (indexingPolicy?.compositeIndexes ?? []).some((idx) => sameIndex(idx, composite));
}

/**
 * createIfNotExists never changes the indexing policy of a container that already
 * exists, so containers created before a composite index was needed must be updated
 * in place. Cosmos rebuilds the index online; queries that need it can keep failing
 * for a short while (seconds for a small container) until that finishes.
 * Returns true if the policy was changed.
 */
export async function ensureCompositeIndex(container, composite, logger = console) {
  const { resource: definition } = await container.read();
  if (hasCompositeIndex(definition.indexingPolicy, composite)) return false;

  logger.info(`Adding composite index (${composite.map((p) => `${p.path} ${p.order}`).join(', ')}) to container "${definition.id}"`);
  await container.replace({
    ...definition,
    indexingPolicy: {
      ...definition.indexingPolicy,
      compositeIndexes: [...(definition.indexingPolicy?.compositeIndexes ?? []), composite],
    },
  });
  return true;
}
