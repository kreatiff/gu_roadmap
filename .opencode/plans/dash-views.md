# Plan: New Public Dashboard Views (Swimlane + Table)

> Branch: `dash-views`  
> Target: Both `/` (public roadmap) and `/d/:slug` (public dashboards)  
> Mode: Read-only, clickable detail modals, no drag-and-drop, no inline editing

---

## 1. Goal

Add two new view modes to the public-facing roadmap / dashboard pages:

1. **Swimlane View** — Kanban-style columns grouped by stage. Styled like the admin Roadmap Editor board view but read-only and public-safe.
2. **Table/List View** — Flat sortable HTML table. Styled like the admin FeaturesTable but with a reduced, public-safe column set.

Additionally, when **creating or editing a public dashboard**, admins can now select which of these views are available to visitors of that dashboard.

All views must:
- Respect existing filters (search, stage tabs, category, tags, reviewed)
- Allow clicking a card/row to open the existing `FeatureDetailModal`
- Use the existing CSS Modules + design token system
- Be fully responsive

---

## 2. Architecture Overview

### 2.1 Public Page Views

```
RoadmapPage (updated)
├── Header + FilterBar (existing, unchanged logic)
├── View Mode Toggle (new UI — only if >1 view enabled)
│   ├── Grid  (existing)
│   ├── Swimlane  (new)
│   └── Table     (new)
│
├── Grid View        → <FeatureCard /> loop   (existing)
├── Swimlane View    → <PublicSwimlaneView />  (new)
└── Table View       → <PublicTableView />     (new)
```

### 2.2 Dashboard Configuration Flow

```
AdminDashboardsPage
└── DashboardFormModal (updated)
    └── available_views checkboxes
        ├── Grid      (checked by default)
        ├── Swimlane  (optional)
        └── Table     (optional)

PublicDashboardPage (updated)
└── RoadmapPage
    └── receives availableViews prop
        └── renders only the enabled view toggle buttons
```

**Server changes are now required** to persist and return the `available_views` field on dashboard documents.

---

## 3. Data Contract

### 3.1 Dashboard Document (Updated)

```js
// Cosmos DB dashboard document — new field added
{
  id: string,
  name: string,
  slug: string,
  filters: { tags: string[], category_ids: string[], stage_slugs: string[] },
  is_protected: boolean,
  password_hash: string | null,
  available_views: string[],   // NEW: e.g. ['grid','swimlane','table']
  created_by: string,
  created_at: string,
  updated_at: string
}
```

**Backward-compatibility rule:**
- Existing dashboards in Cosmos DB do **not** have `available_views`. The client must treat a missing/null value as **all views enabled** (`['grid','swimlane','table']`) so existing dashboards continue to work unchanged.
- New dashboards created via the form will default to `['grid']` unless the admin explicitly checks additional views.

### 3.2 View Component Props

Both new components receive the same props:

```js
{
  features:   Feature[],        // already filtered by RoadmapPage
  stages:     Stage[],          // scopedMeta.stages (dashboard) or global stages
  categories: Category[],       // for category name/color lookups in table
  onFeatureClick: (featureId) => void   // opens FeatureDetailModal
}
```

**Public table columns:**
| Column | Source field | Sortable? |
|--------|------------|-----------|
| Title | `feature.title` | Yes (α) |
| Stage | `feature.stage_name` | Yes |
| Category | `feature.category_name` | Yes |
| Tags | `feature.tags` (comma-joined) | No |
| Updated | `feature.updated_at` | Yes (date) |
| Gravity | `feature.gravity_score` | Yes (numeric) |

---

## 4. Component Specifications

### 4.1 `PublicSwimlaneView`

**Files:**
- `client/src/components/PublicSwimlaneView/PublicSwimlaneView.jsx`
- `client/src/components/PublicSwimlaneView/PublicSwimlaneView.module.css`

**Behavior:**
- Renders a horizontal flex container (`overflow-x: auto`) of stage columns.
- Columns are derived from `stages` array, filtered to `is_visible === true`.
- Each column header shows: colored dot, stage name, feature count.
- Cards are vertically stacked inside each column.
- Cards are **not draggable**.
- Card content (read-only):
  - Category tag + Verified badge
  - Title
  - Short plain-text description (1-line truncation)
  - Gravity score badge
  - Updated date
- Card click calls `onFeatureClick(feature.id)`.
- Empty columns still render (shows "0 items") to preserve layout.
- If no features match filters, show `EmptyState` component.

**Styling approach:**
- Reuse design tokens from `variables.css`.
- Column background: `stage.color` at ~5% opacity (e.g. `${col.color}0D`).
- Card styling derived from `FeatureCard.module.css` but with swimlane-specific tweaks (smaller padding, no hover lift on touch devices).
- Horizontal scroll with `min-width` per column (~320px).

### 4.3 `DashboardFormModal` — View Selection

**File:** `client/src/components/DashboardFormModal/DashboardFormModal.jsx`  
**Changes:** Add a new fieldset below the Filters section.

**UI:**
- Legend: "Available Views"
- Help text: "Choose which views visitors can switch between on this dashboard."
- Three checkboxes (or styled toggle chips) labelled **Grid**, **Swimlane**, **Table**.
- **Grid** is checked by default and cannot be unchecked (it is the fallback).
- On edit, pre-populate from `dashboard.available_views`.

**State:**
```js
availableViews: ['grid']   // default
```

**Payload change:**
Include `available_views` in the `payload` sent to `onSubmit`:
```js
const payload = {
  name: form.name.trim(),
  filters: { … },
  available_views: form.availableViews,   // NEW
  password: …
};
```

### 4.2 `PublicTableView`

**Files:**
- `client/src/components/PublicTableView/PublicTableView.jsx`
- `client/src/components/PublicTableView/PublicTableView.module.css`

**Behavior:**
- Renders a clean HTML `<table>` with `thead` + `tbody`.
- Columns: Title, Stage (badge), Category (icon + name), Tags (comma-separated), Updated (date), Gravity (badge).
- **Click-to-sort** on column headers. State: `{ key: string, direction: 'asc'|'desc' }`.
- Default sort: `stage_sort_order` ascending (same as admin board).
- Row click opens detail modal (`onFeatureClick`).
- Row hover highlight (`#fafafa`).
- Empty state when no rows.
- **No grouping** — flat list only. (This keeps the public UI simpler than the admin table.)
- **No pagination within the table** — it uses the same `features` array already loaded by `RoadmapPage` (infinite scroll is disabled while in table/swimlane mode, or we show all loaded items).

**Styling approach:**
- Reuse table styles from `FeaturesTable.module.css` as a base, but strip admin-only elements (drag handles, inline selects, edit links).
- Border radius, shadows, and typography match the existing public page aesthetic.
- Gravity badge uses the same three-tier color system as admin.
- Stage badge uses `StatusBadge` component (already used in `FeatureCard`).

---

## 5. Server Changes

### 5.1 `server/src/routes/dashboards.js`

**POST `/` (create dashboard):**
- Accept `available_views` from request body.
- Validate that it is an array of strings and contains only known view keys (`grid`, `swimlane`, `table`).
- Default to `['grid']` if not provided.
- Store in the Cosmos DB document.

**PUT `/:id` (update dashboard):**
- Accept `available_views` from request body.
- If provided, replace the existing array (do not merge).
- Persist `updated_at`.

**GET `/:slug` (public read):**
- The existing code already strips `password_hash` before returning the document.
- `available_views` will be included automatically because it is not explicitly excluded.
- No code change required for the GET endpoint itself.

### 5.2 Backward-Compatibility
- No database migration is needed. Existing documents simply lack the `available_views` key.
- The client handles missing/null by defaulting to all views enabled.

---

## 6. `RoadmapPage` Modifications

### 6.1 New Prop: `availableViews`

```js
const RoadmapPage = ({ initialFilters = {}, isDashboard = false, scopedMeta = null, dashboardName = '', availableViews = null }) => {
```

`availableViews` is an array of view keys enabled for this dashboard, e.g. `['grid', 'swimlane']`.
- When `isDashboard === false` (main public roadmap `/`), `availableViews` is `null`, meaning **all views are enabled**.
- When `isDashboard === true` and `availableViews` is missing/null, treat as **all views enabled** (backward compatibility).

### 6.2 State Additions

```js
const effectiveAvailableViews = availableViews ?? ['grid', 'swimlane', 'table'];

const [viewMode, setViewMode] = useState(() => {
  const key = isDashboard ? `dashboardViewMode_${slug}` : 'publicViewMode';
  const saved = localStorage.getItem(key);
  // If the saved view is no longer available for this dashboard, fall back to grid
  return effectiveAvailableViews.includes(saved) ? saved : effectiveAvailableViews[0];
});
```

Persist `viewMode` to `localStorage` on change so users retain their preference.

### 6.3 View Toggle UI (Conditional)

Only render the toggle group when `effectiveAvailableViews.length > 1`.

```jsx
{effectiveAvailableViews.length > 1 && (
  <div className={styles.viewSwitcher}>
    {effectiveAvailableViews.includes('grid') && (
      <button className={viewMode==='grid'?styles.viewBtnActive:styles.viewBtn} onClick={()=>setViewMode('grid')}>
        <LayoutGrid size={16} /> Grid
      </button>
    )}
    {effectiveAvailableViews.includes('swimlane') && (
      <button className={viewMode==='swimlane'?styles.viewBtnActive:styles.viewBtn} onClick={()=>setViewMode('swimlane')}>
        <Columns size={16} /> Swimlane
      </button>
    )}
    {effectiveAvailableViews.includes('table') && (
      <button className={viewMode==='table'?styles.viewBtnActive:styles.viewBtn} onClick={()=>setViewMode('table')}>
        <Table size={16} /> Table
      </button>
    )}
  </div>
)}
```

Use Lucide icons (`LayoutGrid`, `Columns`, `Table`) imported inline.

### 6.4 Conditional Rendering

Replace the single grid block with:

```jsx
{viewMode === 'grid'   && <div className={styles.grid}>…</div>}
{viewMode === 'swimlane' && <PublicSwimlaneView features={features} stages={effectiveStages} categories={categories} onFeatureClick={id => { searchParams.set('feature',id); setSearchParams(searchParams); }} />}
{viewMode === 'table'  && <PublicTableView  features={features} stages={effectiveStages} categories={categories} onFeatureClick={…} />}
```

### 6.5 Infinite Scroll Edge Case

`RoadmapPage` currently uses infinite scroll (`hasMore`, `lastFeatureElementRef`).
- In **Grid** mode: keep infinite scroll as-is.
- In **Swimlane / Table** mode: we should **fetch all features** (or at least a much higher limit, e.g. `limit: 500`) because horizontal swimlanes and tables without all rows are poor UX.

**Decision:** When `viewMode !== 'grid'`, pass `limit: 500` (or `limit: 1000`) to `getFeatures()` and disable the `IntersectionObserver`. This means a one-time larger fetch. If there are truly thousands of features, we may need true pagination in table/swimlane later, but for the current dataset this is acceptable.

---

## 7. File Inventory & Changes

| # | File | Action | Description |
|---|------|--------|-------------|
| 1 | `client/src/components/PublicSwimlaneView/PublicSwimlaneView.jsx` | **Create** | Swimlane view component |
| 2 | `client/src/components/PublicSwimlaneView/PublicSwimlaneView.module.css` | **Create** | Swimlane styles |
| 3 | `client/src/components/PublicTableView/PublicTableView.jsx` | **Create** | Table view component |
| 4 | `client/src/components/PublicTableView/PublicTableView.module.css` | **Create** | Table styles |
| 5 | `client/src/pages/RoadmapPage/RoadmapPage.jsx` | **Modify** | Add view mode state, toggle UI, conditional rendering, limit switch, `availableViews` prop |
| 6 | `client/src/pages/RoadmapPage/RoadmapPage.module.css` | **Modify** | Add `.viewSwitcher`, `.viewBtn`, `.viewBtnActive` styles |
| 7 | `client/src/pages/PublicDashboardPage/PublicDashboardPage.jsx` | **Modify** | Pass `available_views` from dashboard down to `RoadmapPage` |
| 8 | `client/src/components/DashboardFormModal/DashboardFormModal.jsx` | **Modify** | Add view selection checkboxes and include `available_views` in payload |
| 9 | `server/src/routes/dashboards.js` | **Modify** | Handle `available_views` on POST (create) and PUT (update) |

**Zero changes to:**
- `FilterBar` (filter logic is unchanged)
- `FeatureCard` (only used by grid view)
- `FeatureDetailModal` (reused by all views)
- Cosmos DB schema (new field is additive only)

---

## 8. Responsive Behavior

| View | Mobile (<768px) | Tablet (768–1024px) | Desktop (>1024px) |
|------|-----------------|---------------------|-------------------|
| **Grid** | 1 column (existing) | 2 columns (existing) | 3+ columns (existing) |
| **Swimlane** | Horizontal scroll, 280px min-width per column | Same | Same, more visible columns |
| **Table** | Horizontal scroll (`overflow-x: auto` on container) | Full width | Full width |

---

## 9. Accessibility Checklist

- [ ] View toggle buttons have `aria-pressed` matching active state
- [ ] Table `<th>` elements have `aria-sort` reflecting current sort
- [ ] Table rows are keyboard-focusable (`tabIndex={0}`) and trigger modal on `Enter`/`Space`
- [ ] Swimlane cards are `<button>` or have `role="button"` with keyboard support
- [ ] Color is not the only means of conveying stage (text label always present)

---

## 10. Implementation Order

1. **Server routes** — Add `available_views` handling to `POST /` and `PUT /:id` in `dashboards.js`.
2. **DashboardFormModal** — Add view-selection UI and wire into payload.
3. **PublicTableView** — Easiest to build and test; reuse admin table styles.
4. **PublicSwimlaneView** — Build the read-only card + column layout.
5. **RoadmapPage integration** — Wire up `availableViews` prop, view mode state, toggle UI, conditional rendering, and limit switch.
6. **PublicDashboardPage** — Pass `available_views` from dashboard API response into `RoadmapPage`.
7. **Polish & responsive pass** — CSS adjustments, mobile testing.
8. **Validation** — Run `python .agent/scripts/checklist.py .` and manual smoke test on `/` and `/d/:slug`.

---

## 11. Open Questions (Resolved)

| Question | Decision |
|----------|----------|
| Which pages get the new views? | Both `/` and `/d/:slug` (via shared `RoadmapPage`) |
| Interactivity level? | Read-only; only click-to-open-detail-modal |
| Which table columns? | Title, Stage, Category, Tags, Updated, Gravity |
| Keep infinite scroll in new views? | Fetch higher limit (500) when in swimlane/table; no scroll observer |
| Can admins restrict views per dashboard? | Yes — `available_views` array on dashboard document; form UI with checkboxes |
| Backward compatibility for existing dashboards? | Missing `available_views` → treat as all views enabled |
| Default views for new dashboards? | `['grid']`; admin must explicitly opt-in to swimlane/table |

---

## 12. Anticipated Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| `RoadmapPage` becomes too complex | Extract view rendering into the two new components; keep page as thin coordinator |
| Styling drift between public & admin | Base new CSS on existing public tokens; do not import admin module CSS |
| Performance with large feature lists | Use `limit: 500` for non-grid views; if datasets grow larger, revisit with server-side pagination |
| Mobile swimlane UX | Horizontal scroll is standard for kanban on mobile; ensure snap-scroll or visible scrollbar |
| Backward-compatibility breaking existing dashboards | Treat missing `available_views` as all views enabled; no DB migration needed |

---

*Plan prepared for branch `dash-views`. Ready for implementation.*
