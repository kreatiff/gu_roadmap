# SQLite → Azure Cosmos DB (NoSQL) Migration Plan

## Context

The app currently uses `better-sqlite3` with raw synchronous SQL in a Fastify/Node.js backend. The goal is to migrate the persistence layer to **Azure Cosmos DB for NoSQL** (document API). This is a fresh-start migration — no data needs to be preserved; `seed.js` will populate the new database. The entire DB layer is unabstracted raw SQL so every operation must be rewritten.

---

## Files to Change (Summary)

| File | Change Type |
|------|-------------|
| `server/src/db.js` | **Full rewrite** — replace better-sqlite3 with @azure/cosmos client + container bootstrap |
| `server/src/routes/features.js` | **Full rewrite** — all queries → async Cosmos SDK calls |
| `server/src/routes/categories.js` | **Full rewrite** — all queries → async Cosmos SDK calls |
| `server/src/routes/stages.js` | **Full rewrite** — all queries → async Cosmos SDK calls |
| `server/src/routes/votes.js` | **Full rewrite** — transactions → atomic-safe async pattern |
| `server/src/lib/gravityUtils.js` | **Full rewrite** — sync db.transaction → async container operations |
| `server/src/seed.js` | **Full rewrite** — sync prepared statements → async creates |
| `server/src/config.js` | Add Cosmos env vars |
| `.env.example` | Add `COSMOS_ENDPOINT`, `COSMOS_KEY`, `COSMOS_DATABASE_ID` |
| `server/package.json` | Remove `better-sqlite3`, add `@azure/cosmos` |
| `docker-compose.yml` | Remove SQLite volume mount, add Cosmos env vars |

---

## Cosmos DB Design

### Container Layout

| Container | Partition Key | Unique Key Policy |
|-----------|---------------|-------------------|
| `categories` | `/id` | none needed |
| `stages` | `/id` | `/slug` (enforce via policy) |
| `features` | `/id` | `/slug` |
| `votes` | `/featureId` | none (id IS the composite key) |
| `feature_revisions` | `/featureId` | none |

### Document Schemas

**Feature** — denormalized with category and stage embedded to avoid cross-container lookups:
```json
{
  "id": "uuid",
  "title": "...",
  "slug": "...",
  "description": "",
  "status": "under_review",
  "category_id": "uuid | null",
  "category_name": "...",
  "category_color": "#...",
  "category_icon": "briefcase",
  "stage_id": "uuid | null",
  "stage_name": "...",
  "stage_color": "#...",
  "stage_slug": "...",
  "vote_count": 0,
  "impact": 1,
  "effort": 1,
  "tags": [],
  "pinned": false,
  "is_published": true,
  "owner": "",
  "key_stakeholder": "",
  "priority": "Medium",
  "gravity_score": 0,
  "created_at": "ISO string",
  "updated_at": "ISO string"
}
```

**Vote** — id is a synthetic composite key to enforce one-vote-per-user-per-feature:
```json
{
  "id": "userId::featureId",
  "featureId": "uuid",
  "userId": "..."
}
```

**Category** and **Stage** — same fields as current SQLite schema, stored as native JSON (no changes to shape).

**Feature Revision** — same shape, stored as JSON.

---

## Step-by-Step Implementation Plan

### Step 1 — Package Updates

**`server/package.json`**
- Remove: `"better-sqlite3": "^11.8.1"`
- Add: `"@azure/cosmos": "^4.x"`

### Step 2 — Environment Variables

**`.env.example`** — add:
```
COSMOS_ENDPOINT=https://<account>.documents.azure.com:443/
COSMOS_KEY=<primary-key>
COSMOS_DATABASE_ID=gu_roadmap
```

**`server/src/config.js`** — export `COSMOS_ENDPOINT`, `COSMOS_KEY`, `COSMOS_DATABASE_ID` with validation that they're set in production.

### Step 3 — Rewrite `server/src/db.js`

Replace the entire file. New responsibilities:
1. Create `CosmosClient` from `@azure/cosmos`
2. Use `client.databases.createIfNotExists({ id: DB_ID })`
3. Use `database.containers.createIfNotExists()` for each of the 5 containers
4. Export named container references: `categoriesContainer`, `stagesContainer`, `featuresContainer`, `votesContainer`, `revisionsContainer`
5. Export an async `initDb()` function called from `server/src/index.js` at startup
6. **No schema migration code needed** — Cosmos is schema-less; old migration logic all goes away

```js
// New export shape
export { categoriesContainer, stagesContainer, featuresContainer, votesContainer, revisionsContainer };
```

### Step 4 — Rewrite `server/src/routes/features.js`

All 6 operations need to change. Import named containers from db.js (not a `db` singleton).

**GET / (list + filter)**
Current: complex SQL with LEFT JOIN categories + stages, correlated subquery for `user_voted`, LIKE search, pagination via LIMIT/OFFSET.

New approach:
- Build a parameterized Cosmos SQL query:
  ```sql
  SELECT * FROM c WHERE c.is_published = true [AND c.status = @status] [AND c.category_id = @category] [AND (CONTAINS(c.title, @search) OR CONTAINS(c.description, @search))]
  ORDER BY c.pinned DESC, c.vote_count DESC, c.created_at DESC
  OFFSET @offset LIMIT @limit
  ```
- category_name / stage_name come from denormalized fields — **no JOIN needed**
- `user_voted`: after fetching features, do a single `votesContainer.items.query(SELECT c.id FROM c WHERE c.featureId IN (...) AND c.userId = @userId)` to get all voted feature IDs, then map boolean onto results
- Admin visibility: omit `is_published` filter for admins
- **Note**: `OFFSET/LIMIT` in Cosmos SQL requires `enableCrossPartitionQuery: true` and is supported but requires a full scan — acceptable for this data size

**GET /:id (single feature)**
- `featuresContainer.item(id, id).read()` — O(1) point read
- 404 if `statusCode === 404`
- Fetch vote status separately: `votesContainer.item(\`${userId}::${id}\`, id).read()`
- Tags already native array — no JSON.parse needed
- Remove the `query += ' AND f.is_published = 1'` mutation bug (line 92 in current code — `query` is `const` and this line throws silently; fix this logic properly in the rewrite)

**POST / (create feature)**
- Fetch default stage: `stagesContainer.items.query('SELECT TOP 1 * FROM c ORDER BY c.order_idx ASC')` 
- Fetch category to embed: `categoriesContainer.item(category_id, category_id).read()`
- Build full feature document with denormalized category + stage fields
- `featuresContainer.items.create(doc)` — throws `409` on duplicate slug (unique key policy)
- Create revision: `revisionsContainer.items.create(revisionDoc)`
- Call `recalculateAllGravityScores()`

**PUT /:id (update feature)**
- Read existing: `featuresContainer.item(id, id).read()`
- Build updated document (spread existing + apply changes)
- If `category_id` changed: fetch new category to re-embed category fields
- If `stage_id` changed: fetch new stage to re-embed stage fields
- `featuresContainer.item(id, id).replace(updatedDoc)`
- If category or stage display fields changed, must also **fan-out update** to features that reference the same category/stage — see Gotcha #1

**DELETE /:id (delete feature)**
- `featuresContainer.item(id, id).delete()`
- Delete associated votes: query `votes` by `featureId = id`, then delete each
- Delete associated revisions: query `feature_revisions` by `featureId = id`, then delete each
- NOTE: No CASCADE DELETE in Cosmos — must do this manually
- Call `recalculateAllGravityScores()`

**GET /:id/revisions**
- `revisionsContainer.items.query('SELECT * FROM c WHERE c.featureId = @id ORDER BY c.changed_at DESC', { parameters: [{ name: '@id', value: id }] })`

### Step 5 — Rewrite `server/src/routes/categories.js`

**GET / (all categories with feature_count)**
- Query all categories: `SELECT * FROM c ORDER BY c.order_idx ASC`
- For each category, query feature count: `SELECT VALUE COUNT(1) FROM c WHERE c.category_id = @id`
- These N count queries run in parallel via `Promise.all()`
- **Gotcha**: This is N+1 queries but acceptable for the number of categories (typically < 20)

**POST / (create)**
- `categoriesContainer.items.create(doc)`

**PUT /:id (update)**
- Read, patch fields, replace
- **Important**: If `name`, `color`, or `icon` changed — must fan-out update all features in that category to re-embed the new values (see Gotcha #1)

**POST /reorder (batch order update)**
- No `db.transaction()` available
- Run individual `item.replace()` calls in `Promise.all()` — not atomic but acceptable since reordering is idempotent
- Consider using Cosmos [Transactional Batch](https://learn.microsoft.com/azure/cosmos-db/nosql/transactional-batch) if all items share the same partition key (they don't here since each `/id` is unique) — so parallel individual calls is the right approach

**DELETE /:id**
- Query features with this `category_id`
- If count > 0 and no `reassignTo`: return 409
- If reassignTo: fan-out update all those features (`category_id`, `category_name`, etc.) in parallel
- Delete the category

### Step 6 — Rewrite `server/src/routes/stages.js`

Same pattern as categories:
- `MAX(order_idx)` for auto-order: `SELECT VALUE MAX(c.order_idx) FROM c`
- Feature count queries in parallel
- Fan-out update to features when stage display fields change (stage_name, stage_color, stage_slug)
- Batch reorder via parallel `item.replace()` calls

### Step 7 — Rewrite `server/src/routes/votes.js`

This is the most complex change due to the loss of ACID transactions.

**Current**: `db.transaction()` wraps `INSERT votes` + `UPDATE features.vote_count = +1` atomically.

**New approach** — optimistic pattern:
1. Create vote document with id `\`${userId}::${featureId}\``
   - If `409 Conflict` (vote exists): return appropriate error — uniqueness is enforced by the composite id
2. Read current feature, increment `vote_count`, replace with `ifMatch` (ETag) — retry once on `412 Precondition Failed`
3. Call `recalculateAllGravityScores()`

**Remove vote**:
1. `votesContainer.item(\`${userId}::${featureId}\`, featureId).delete()` — if 404, return 404 to client
2. Read feature, decrement vote_count, replace with ETag
3. Call `recalculateAllGravityScores()`

**Note**: There is a window where vote is recorded but vote_count hasn't incremented (or vice versa after a crash). For this application (university roadmap voting), eventual consistency is acceptable — this isn't a financial transaction.

### Step 8 — Rewrite `server/src/lib/gravityUtils.js`

**`recalculateAllGravityScores()`** — change from sync to async, remove `db` parameter (import containers directly):
1. `SELECT VALUE MAX(c.vote_count) FROM c` → `maxVotes`
2. `SELECT c.id, c.vote_count, c.impact, c.effort, c.priority FROM c` → all features
3. Calculate score for each
4. Run all `item.replace(partialUpdate)` in `Promise.all()` batches (chunk into groups of 50 to avoid rate limiting)
5. **`calculateGravityScore()`** is pure JS — no changes needed

### Step 9 — Rewrite `server/src/seed.js`

- Import async containers from db.js
- Replace `db.prepare().run()` with `container.items.create()` calls
- Wrap in try/catch (409 on duplicate ID = already seeded, skip)
- Make the `seed()` function async

### Step 10 — Update `server/src/index.js`

- Call `await initDb()` before registering routes to ensure containers exist

### Step 11 — Update `docker-compose.yml`

- Remove `volumes:` mount for `server/data`
- Add environment variables for `COSMOS_ENDPOINT`, `COSMOS_KEY`, `COSMOS_DATABASE_ID`

---

## Gotchas, Problems & Things to Watch Out For

### Gotcha #1 — Denormalization Fan-Out (Critical)
Features embed category and stage display fields. When a category's `name/color/icon` or a stage's `name/color/slug` changes, **every feature in that category/stage must be updated** to keep the embedded data in sync. This means:
- `PUT /categories/:id` → query all features with `category_id = id`, update each
- `PUT /stages/:id` → query all features with `stage_id = id`, update each
- This is O(N) writes on each category/stage update — acceptable for this scale but must not be forgotten

### Gotcha #2 — No Transactions Across Containers (Critical)
The voting operation (insert vote + increment counter) is no longer atomic. Use:
- Composite id for votes (`userId::featureId`) to ensure idempotency on the insert
- ETag-based optimistic concurrency on the feature update
- Accept that vote_count could be off by 1 in an edge case crash scenario

### Gotcha #3 — No CASCADE DELETE
SQLite's `ON DELETE CASCADE` on `votes` and `feature_revisions` is gone. When deleting a feature, the route **must manually** delete all child votes and revisions. Same for stages/categories (though features have `ON DELETE SET NULL` semantics that must be replicated in code).

### Gotcha #4 — Unique Key Policy Must Be Set at Container Creation
Cosmos DB unique key policies are **set at container creation time and cannot be changed**. The plan sets:
- `/slug` as a unique key on `features` and `stages` containers
- If you skip this and create the containers without it, you must delete and recreate them to add it later — no ALTER TABLE equivalent

### Gotcha #5 — `const query` Bug in Current `features.js:92`
In the current codebase, `GET /:id` declares `query` as `const` on line 80, then tries to do `query += ' AND f.is_published = 1'` on line 93 — this silently fails because string concatenation on a const re-assigns. The admin visibility filter for single features is currently broken. Fix this properly in the rewrite.

### Gotcha #6 — Tags: JSON String → Native Array
Current code stores tags as `JSON.stringify(tags)` and parses with `JSON.parse(f.tags || '[]')` everywhere. In Cosmos DB, tags are stored as native JSON arrays — remove all `JSON.stringify`/`JSON.parse` for tags. The API shape to clients stays the same.

### Gotcha #7 — Booleans: 0/1 → true/false
SQLite uses `INTEGER` for booleans. `is_published`, `pinned`, `is_visible` are all `0` or `1`. In Cosmos documents, use native JS booleans. The API responses already return these as integers — check the frontend doesn't break (it uses `Boolean(f.user_voted)` but accesses `f.pinned` directly in sort). Update frontend if needed.

### Gotcha #8 — `result.changes` Pattern Gone
Every `db.prepare().run()` returns `{ changes: N }` to detect "not found". Cosmos DB instead throws a `404` error on `item.delete()` and `item.read()` when the item doesn't exist. Replace every `if (result.changes === 0) return reply.code(404)` with try/catch on `ItemResponse.statusCode === 404`.

### Gotcha #9 — `recalculateAllGravityScores` Is Called Synchronously In Transactions
Currently `recalculateAllGravityScores(db)` is called synchronously from within `db.transaction()` callbacks and synchronous route handlers. After the rewrite, it becomes async — ensure it is properly `await`-ed in all callers (features POST/PUT/DELETE, votes POST/DELETE).

### Gotcha #10 — OFFSET Pagination Has Cost
Cosmos DB supports `OFFSET @n LIMIT @m` in SQL queries but it performs a full scan up to the offset position — it doesn't cache. For a small dataset (hundreds of features), this is fine. If the dataset grows, switch to continuation token-based pagination.

### Gotcha #11 — `INSERT OR IGNORE` Pattern Gone
Used in seed.js for idempotent stage seeding. Replace with `items.create()` wrapped in try/catch where `409` (Conflict) is silently ignored.

### Gotcha #12 — Cross-Partition Queries Require `enableCrossPartitionQuery: true`
Most queries across all items in a container (e.g. `SELECT * FROM c` on the features container partitioned by `/id`) are cross-partition and need `{ enableCrossPartitionQuery: true }` in query options. This is the default for most high-level SDK methods but make sure it's explicit.

### Gotcha #13 — `better-sqlite3` Is Synchronous; Cosmos SDK Is Async
All route handlers are already `async` so this is mostly handled. The main risk is in `seed.js` and gravity recalculation which currently executes synchronously at module load time. These must be converted to async functions called explicitly (not at import time).

### Gotcha #14 — Docker Volume Removal
The Docker volume `server/data` persists the SQLite file. This volume must be removed from `docker-compose.yml`. Connection to Cosmos DB is via environment variables instead. Ensure `COSMOS_ENDPOINT` and `COSMOS_KEY` are in the deployment secrets / CI environment.

### Gotcha #15 — Cosmos Emulator for Local Dev
Without a real Azure account, local development requires the [Azure Cosmos DB Emulator](https://learn.microsoft.com/azure/cosmos-db/local-emulator). Add a note in `.env.example` with emulator defaults:
```
COSMOS_ENDPOINT=https://localhost:8081
COSMOS_KEY=C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b7u...
```

---

## Verification Checklist

After implementation:
1. `npm install` — verify `better-sqlite3` removed, `@azure/cosmos` present
2. Start Cosmos Emulator (or point at real account) and set env vars
3. `npm run seed` — verify 5 categories and 40 features are created in Cosmos
4. `npm start` — verify server starts without errors
5. `GET /api/categories` — should return categories with `feature_count`
6. `GET /api/features` — should return paginated features with embedded category/stage data
7. `GET /api/features?search=foo` — verify CONTAINS search works
8. `POST /api/features/:id/vote` (as authenticated user) — verify vote count increments
9. `DELETE /api/features/:id/vote` — verify vote count decrements, 404 on double-remove
10. `PUT /api/categories/:id` (change name) — verify all features in that category update their embedded `category_name`
11. `DELETE /api/categories/:id` with features → verify 409 returned
12. `DELETE /api/categories/:id` with `reassignTo` → verify features move, category deletes
13. `POST /api/categories/reorder` — verify order_idx updates
14. `GET /api/features/:id/revisions` — verify revisions are created and retrievable
15. Admin visibility — `is_published = false` features hidden from public, visible to admin
