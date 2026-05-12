# Plan: Gravity Score Redesign + 10-Point Scales

## 1. Goal

Redesign the gravity score calculation so that:
1. **User votes are completely ignored** in the score.
2. **Impact** is the #1 driver, **Priority** is #2, **Effort** is #3 (mild tie-breaker).
3. Impact and Effort scales expand from **1–5 → 1–10**.
4. The Priority Matrix becomes a **10×10 grid** with the **Effort axis reversed** so that **High Impact + Low Effort (Quick Wins)** appear in the **top-right** corner.
5. Existing production data is migrated by **multiplying current impact/effort values by 2**.

---

## 2. New Gravity Formula

```js
const PRIORITY_SCORES = { Low: 1, Medium: 2, High: 3, Critical: 4 };

export function calculateGravityScore(feature) {
  const impact = Math.max(1, Math.min(10, feature.impact ?? 5));
  const effort = Math.max(1, Math.min(10, feature.effort > 0 ? feature.effort : 1));
  const priority = PRIORITY_SCORES[feature.priority] ?? 2;

  // Hierarchical weighted sum (no votes)
  const impactPart   = (impact / 10) * 65;          // up to 65 pts
  const priorityPart = (priority / 4) * 25;         // up to 25 pts
  const effortPart   = ((11 - effort) / 10) * 10;   // up to 10 pts (inverse)

  return Math.min(Math.ceil(impactPart + priorityPart + effortPart), 100);
}
```

### Why this formula?
- **Impact = 65% weight** — guaranteed dominant factor.
- **Priority = 25% weight** — strong strategic tie-breaker.
- **Effort = 10% weight** — third-most-important but mild; max swing is only 10 points.
- A **10 Impact / Critical** feature scores **91–100** regardless of effort (meets the "60+ regardless of effort" requirement).
- A **1 Impact / Critical** feature tops out at ~42 — low impact cannot be gamed by priority alone.

### Score Reference Table
| Impact | Priority | Effort | Score |
|--------|----------|--------|-------|
| 10 | Critical | 1 | 100 |
| 10 | Critical | 10 | 91 |
| 10 | High | 10 | 85 |
| 10 | Medium | 10 | 80 |
| 5 | Critical | 10 | 59 |
| 5 | Critical | 1 | 68 |
| 1 | Critical | 1 | 42 |

---

## 3. Data Migration (One-Time)

Existing Cosmos DB features have `impact` and `effort` in the 1–5 range. We must double them to 2–10 before the new formula takes effect.

### Script: `server/src/migrations/001_scale_1_to_10.js`
- Read every feature document.
- Patch `impact = impact * 2` and `effort = effort * 2`.
- After all patches, call `recalculateAllGravityScores()`.
- Run this **once** against the production container before deploying the new code.

> **Safety note:** Because some doubled values (e.g., old `impact=1` → new `2`) are still ≤ 5, we cannot auto-detect "old vs new" data. This must be a deliberate, one-time operation.

### Seed Data
`server/src/seed.js` — multiply every hard-coded `impact` and `effort` by 2 so fresh environments match the new scale.

---

## 4. Files to Modify

### Backend

| File | Change | Details |
|------|--------|---------|
| `server/src/lib/gravityUtils.js` | **Full rewrite** | New formula (no `maxVotes` param); remove vote-based normalization; `recalculateAllGravityScores` no longer queries `MAX(vote_count)`. |
| `server/src/routes/features.js` | Defaults update (optional but recommended) | Change creation defaults from `impact ?? 1` / `effort ?? 1` to `impact ?? 5` / `effort ?? 5` so new features start at the neutral center of the 1–10 scale. |
| `server/src/routes/votes.js` | No logic change | `recalculateAllGravityScores()` call remains valid (signature will drop `maxVotes` argument). |
| `server/src/seed.js` | Multiply values | Every `impact: X` → `impact: X*2`; every `effort: X` → `effort: X*2`. |
| `server/src/migrations/001_scale_1_to_10.js` | **New file** | One-time migration script (see §3). |

### Frontend

| File | Change | Details |
|------|--------|---------|
| `client/src/pages/admin/AdminFeatureFormPage/AdminFeatureFormPage.jsx` | Slider ranges + preview formula + help text | `max="5"` → `max="10"` on both Impact and Effort sliders. Update `calculatedScore` `useMemo` to new formula (no `vote_count`, no `maxVotes`). Update help text to remove vote references. |
| `client/src/pages/admin/AdminDashboardPage/FeaturesTable.jsx` | DotScale range | `DotScale` currently maps `[1,2,3,4,5]`. Expand to `[1..10]` dynamically or hard-code `1..10`. |
| `client/src/components/PriorityMatrix.jsx` | 10×10 grid + reversed effort axis + tooltip | `axisIndices = [10,9,8,7,6,5,4,3,2,1]`; `xAxisIndices = [10,9,8,7,6,5,4,3,2,1]` (so effort=1 is rightmost). Remove `vote_count` from tooltip. Update legend text to "top-right". |
| `client/src/components/PriorityMatrix.module.css` | Grid sizing | `.yAxis` `grid-template-rows: repeat(5, 1fr)` → `repeat(10, 1fr)`; `.matrixGrid` `repeat(5, 1fr)` → `repeat(10, 1fr)` (rows + cols); `.xAxis` `repeat(5, 1fr)` → `repeat(10, 1fr)`. |
| `client/src/pages/admin/AdminMatrixPage/AdminMatrixPage.jsx` | Display labels | `Impact: X / 5` → `Impact: X / 10`; `Effort: X / 5` → `Effort: X / 10`. |
| `system_context.md` | Documentation | Update `impact` and `effort` rows from `1-5` to `1-10`. |

### No Changes Required
- `FeatureCard.jsx` — still displays `vote_count` and `gravity_score`; no structural changes needed.
- `FeatureSidebarCard.jsx` — displays raw `impact`/`effort` values; no changes needed.

---

## 5. Implementation Order

1. **Backend**
   1. Rewrite `server/src/lib/gravityUtils.js`.
   2. Create `server/src/migrations/001_scale_1_to_10.js`.
   3. Update `server/src/seed.js` (multiply impact/effort by 2).
   4. Optionally update defaults in `server/src/routes/features.js`.

2. **Run Migration**
   1. Execute `node server/src/migrations/001_scale_1_to_10.js` against the production Cosmos container.

3. **Frontend**
   1. `AdminFeatureFormPage.jsx` — sliders + preview formula.
   2. `FeaturesTable.jsx` — `DotScale` 1–10.
   3. `PriorityMatrix.jsx` + `.module.css` — 10×10 grid, reversed axis, tooltip.
   4. `AdminMatrixPage.jsx` — `/ 10` labels.
   5. `system_context.md` — docs.

4. **Verification**
   1. Create/edit a feature with Impact=10, Effort=10, Priority=Critical → expect Gravity=91.
   2. Create/edit a feature with Impact=10, Effort=1, Priority=Critical → expect Gravity=100.
   3. Verify Priority Matrix renders 10 rows × 10 columns.
   4. Verify a feature with Effort=1 appears in the rightmost column.
   5. Run existing tests (if any) and lint.

---

## 6. Risk & Rollback

| Risk | Mitigation |
|------|------------|
| Migration runs twice, quadrupling values | The migration script should be idempotent (e.g., check a `scaleVersion` field, or simply document it as run-once). Simplest: run it once manually, then delete or archive the script. |
| Frontend caches old 1–5 slider values | Browsers will pick up new `max="10"` on next load. No cache issue for HTML attributes. |
| Priority Matrix CSS looks cramped at 10×10 | The `max-width: 900px` and `aspect-ratio: 1.1 / 1` should still hold; cells become smaller but usable. If too cramped, increase `max-width` to `1100px` or reduce cell padding. |

### Rollback
- Revert `gravityUtils.js` to the previous commit.
- Run an inverse migration (divide impact/effort by 2) if needed within the same deployment window.

---

## 7. Acceptance Criteria

- [ ] `calculateGravityScore` no longer references `vote_count` or `maxVotes`.
- [ ] Impact/Effort sliders in the admin form allow values 1–10.
- [ ] Priority Matrix displays a 10×10 grid.
- [ ] Low-effort features appear on the **right** side of the matrix; high-effort on the **left**.
- [ ] A feature with Impact=10 and Priority=Critical scores ≥ 91 even at Effort=10.
- [ ] Existing Cosmos DB features have impact/effort values doubled from the migration.
- [ ] Seed data uses 1–10 values.
- [ ] No references to "1–5" scale remain in docs or UI copy.
