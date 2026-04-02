# Implementation Plan: Composite Priority Score (RICE × Admin Confidence)

## Overview

Implement a computed `priority_score` field on the `features` table using a **RICE-inspired formula modulated by the admin's strategic `priority` field** as a confidence multiplier. The score is normalised to a 0–100 scale, recalculated on every write that touches any of its inputs, and surfaced in both the Admin and Public UIs.

### Formula

```
priority_multiplier = { Low: 0.5, Medium: 1.0, High: 1.5, Critical: 2.0 }
votes_norm          = (vote_count / MAX(vote_count across all features)) * 5   -- scaled to 1–5; 0 if max is 0
raw_score           = (votes_norm * impact * priority_multiplier) / effort
priority_score      = ROUND((raw_score / 50) * 100, 2)                         -- normalised to 0–100
```

**Why divide by 50?** The theoretical maximum of `raw_score` is `(5 × 5 × 2.0) / 1 = 50`, achieved by a feature with max normalised votes, impact=5, effort=1, and Critical priority. Dividing by 50 and multiplying by 100 maps the full range cleanly to 0–100.

**Edge cases:**

- `effort = 0` → treat as `1` to avoid division by zero (should not occur given 1–5 slider, but guard anyway).
- `vote_count = 0` → `votes_norm = 0`, so `priority_score = 0.00`.
- `priority = NULL` → treat multiplier as `1.0`.
- `impact = NULL` → treat as `3` (mid-range neutral).
- `priority_score` is capped at `100.00` — if formula inputs are somehow out of expected bounds, clamp the result.

---

## Step 1 — Database Migration

**File to create:** `server/migrations/003_add_priority_score.sql`

```sql
-- Add the priority_score column (nullable initially to allow backfill)
ALTER TABLE features ADD COLUMN priority_score REAL DEFAULT 0;
```

**File to modify:** `server/db.js` (or wherever migrations are applied at startup)

- After applying the migration SQL, immediately call the recalculation function (Step 2) to backfill all existing rows.
- Ensure the migration is idempotent: check if the column already exists before attempting `ALTER TABLE` (use `PRAGMA table_info(features)` or a `try/catch`).

---

## Step 2 — Score Calculation Utility

**File to create:** `server/lib/scoringUtils.js`

Implement and export two functions:

### `calculatePriorityScore(feature, maxVotes)`

Pure function. Takes a single feature object and the current max `vote_count` across all features. Returns a `Number` between `0` and `100`.

```
priority_multiplier_map = { Low: 0.5, Medium: 1.0, High: 1.5, Critical: 2.0 }

votes_norm = maxVotes > 0 ? ((feature.vote_count / maxVotes) * 5) : 0
multiplier = priority_multiplier_map[feature.priority] ?? 1.0
safe_effort = feature.effort > 0 ? feature.effort : 1
safe_impact = feature.impact ?? 3

raw_score = (votes_norm * safe_impact * multiplier) / safe_effort
score = Math.round(((raw_score / 50) * 100) * 100) / 100   // 2 decimal places
return Math.min(score, 100)                                  // clamp to 100
```

### `recalculateAllScores(db)`

Mutating function. Queries the DB, recomputes every feature's score, and batch-updates in a single transaction.

```
1. Query: SELECT MAX(vote_count) AS max_votes FROM features
2. Query: SELECT id, vote_count, impact, effort, priority FROM features
3. Open a SQLite transaction
4. For each feature: compute score via calculatePriorityScore(), then run:
   UPDATE features SET priority_score = ?, updated_at = ? WHERE id = ?
5. Commit transaction
```

Export both functions. Do not import any route or HTTP layer here — keep this module pure infrastructure.

---

## Step 3 — Hook Score Recalculation into Write Operations

**File to modify:** `server/routes/features.js` (or equivalent Fastify route file)

Identify every route handler that mutates a field used in the formula:

- `vote_count` — the voting endpoint (e.g. `POST /features/:id/vote`)
- `impact` — feature create/update
- `effort` — feature create/update
- `priority` — feature create/update (admin only)

**For each of these handlers**, after the primary DB write completes successfully, call `recalculateAllScores(db)`.

> **Why recalculate all, not just one?** `votes_norm` is relative — changing one feature's `vote_count` changes the `max_votes` denominator, which shifts every other feature's normalised vote score. A full recalculation keeps all scores consistent. SQLite with WAL mode makes this fast.

Do **not** call recalculation on reads, status-only updates, tag/pin changes, or owner/stakeholder changes, as none of these affect the formula inputs.

---

## Step 4 — Expose `priority_score` via the API

### Admin API

**File to modify:** The Fastify route that handles `GET /admin/features` (or equivalent).

- Add `priority_score` to the `SELECT` column list.
- No other changes needed; the field is already stored on the row.

### Public API

**File to modify:** The Fastify route that handles `GET /features` (public endpoint).

- Add `priority_score` to the `SELECT` column list.
- Verify that `owner`, `key_stakeholder`, and `priority` remain excluded from this query (they are admin-only per the existing privacy rules). `priority_score` itself is **safe to expose publicly** — it is a derived number that reveals no raw strategic text.

---

## Step 5 — Admin UI: Display Score in Table & Board Views

**File to modify:** The admin feature table component (referenced in system context as the Interactive Table in `AdminDashboardPage`).

### Table View

- Add a **"Score"** column header, sortable, positioned after the existing "Priority" column.
- Render `priority_score` formatted to 2 decimal places followed by `/100` (e.g. `73.50 / 100`).
- Apply a subtle colour scale to the cell background or text based on the 0–100 range:
  - `score >= 60` → green tint (`--gu-green` or closest available token)
  - `score >= 30 and < 60` → amber tint
  - `score < 30` → no tint (neutral)
- Wire the column into the existing multi-column sort handler, sorting numerically descending.

### Kanban Board View

- On each Kanban card, add a small score badge alongside the existing Priority badge.
- Format: a pill labelled `⚡ 73.50` or similar. Keep it visually subordinate to the Priority badge (smaller font, muted colour).

---

## Step 6 — Admin UI: "Sort by Score" as Default

**File to modify:** `AdminDashboardPage` initial state / `useEffect` that initialises sort order.

- Change the default sort for the table view from whatever it currently is to `priority_score DESC`.
- Persist this default in the existing sort state; do not override user-selected sorts once they interact.

---

## Step 7 — Public UI: Surface Score on Cards & Matrix

### Grid View Cards

**File to modify:** The public feature card component.

- Add a small `⚡ 73.50 / 100` indicator to the card footer, alongside the existing vote count.
- Keep it visually lightweight — this is informational, not the primary CTA.

### Priority Matrix (Impact vs Effort Chart)

**File to modify:** The matrix/quadrant chart component.

- Use `priority_score` to size the data point (bubble chart style): higher score = larger bubble radius.
- Since the score is already on a fixed 0–100 scale, size bubbles linearly against this absolute range rather than the dataset min/max — this gives consistent sizing across sessions.
- Clamp bubble size: `min-radius = 8px`, `max-radius = 28px`. Map `score 0 → 8px`, `score 100 → 28px`.
- Add a tooltip on hover that shows: Feature title, Score (x / 100), Votes, Impact, Effort, Priority.

---

## Step 8 — Detail Modal: Show Score Breakdown

**File to modify:** The public feature detail modal component.

Add a **"Priority Score"** section that shows not just the final number but its components, so students understand how it is calculated:

```
Priority Score: 73.50 / 100
  ├─ Votes (normalised): 3.2 / 5
  ├─ Impact: 4 / 5
  ├─ Effort: 3 / 5
  └─ Strategic weight: 1.5× (High)
```

Display this only when `priority_score` is present and `> 0`. The strategic weight label ("High") may be shown here even on the public view since it is derived — do **not** expose the raw `priority` text field from the DB if it is excluded from the public API (the multiplier label can be inferred from the score breakdown or passed as a separate safe field).

> If exposing the label is undesirable, simply omit the "Strategic weight" row and show the other three components only.

---

## Step 9 — Admin Feature Form: Live Score Preview

**File to modify:** The Strategic Feature Form component.

- Add a read-only **"Estimated Score"** display field inside the Strategic Section, positioned after the Impact/Effort sliders.
- Recompute it client-side in real time as the user adjusts Impact, Effort, and Priority dropdowns:
  - Use the same formula as Step 2. For `votes_norm`, use the current feature's `vote_count` and the `maxVotes` value fetched alongside the feature data (add this to the GET /admin/features/:id response or derive from the list).
  - Format as `XX.XX / 100`.
- Label it: `Estimated Priority Score (preview)` with a muted style to indicate it is non-editable.

---

## Step 10 — Validation & Testing Checklist

The coding agent must verify the following before considering the implementation complete:

1. **Migration safety:** Running the server twice does not throw a "column already exists" error.
2. **Backfill correctness:** After migration, query `SELECT id, priority_score FROM features` — no row should have `NULL`. Zero-vote features should have `0.00`.
3. **Score ceiling:** A feature with `vote_count = MAX`, `impact = 5`, `effort = 1`, `priority = Critical` should produce exactly `100.00`.
4. **Vote triggers recalc:** Cast a vote on feature A; confirm feature B's `priority_score` also updates (because `max_votes` may have changed).
5. **Edge case — single feature:** When only one feature exists with `vote_count > 0`, `votes_norm = 5.0` (it is the max). Confirm score is non-zero.
6. **Edge case — zero votes:** Feature with `vote_count = 0` has `priority_score = 0.00` regardless of impact/effort/priority.
7. **Public API exclusion:** Confirm `owner`, `key_stakeholder`, and `priority` (raw text) are not present in `GET /features` response body. `priority_score` (number) **is** present.
8. **Admin table sort:** Clicking "Score" column header sorts correctly ascending and descending.
9. **No N+1 queries:** `recalculateAllScores` uses a single SELECT for all features and a single transaction for all UPDATEs — not one UPDATE per HTTP request cycle.
10. **Formula parity:** The client-side preview in the form (Step 9) produces the same value as the server-stored score for the same inputs. Write at least one manual test case to verify.
11. **Colour scale:** Spot-check three features covering each colour band (≥60, 30–59, <30) and confirm correct tinting in the admin table.

---

## Summary of Files Affected

| File                                           | Change Type                                                   |
| ---------------------------------------------- | ------------------------------------------------------------- |
| `server/migrations/003_add_priority_score.sql` | **Create**                                                    |
| `server/db.js`                                 | **Modify** — apply migration + backfill on startup            |
| `server/lib/scoringUtils.js`                   | **Create**                                                    |
| `server/routes/features.js`                    | **Modify** — hook recalc into vote, create, update handlers   |
| Admin table component                          | **Modify** — add Score column, sorting, colour scale          |
| Admin Kanban card component                    | **Modify** — add score badge                                  |
| `AdminDashboardPage`                           | **Modify** — default sort by score                            |
| Public feature card component                  | **Modify** — add score indicator                              |
| Priority Matrix component                      | **Modify** — absolute bubble sizing by score (0–100), tooltip |
| Feature detail modal component                 | **Modify** — score breakdown section                          |
| Strategic Feature Form component               | **Modify** — live score preview                               |
