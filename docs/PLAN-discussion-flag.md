# Requirements: "Flagged for Discussion" Highlight

## Overview

Add a per-item flag that lets an admin mark a roadmap feature as needing team discussion. Flagged items are visually called out in the admin board/table and can be isolated with a dedicated filter, so the team can quickly find everything that's pending a conversation.

This is an **admin-only** feature. It does not appear on the public roadmap in any form.

## Goals

- Let any admin mark/unmark a feature as "needs discussion" with one click.
- Make flagged items easy to spot at a glance in both board and table views.
- Let admins filter the admin view down to only flagged items (and the inverse: hide them).
- Tie the flag to the existing internal notes log so there's a record of *why* something was flagged, without blocking the flag action on writing a note.

## Non-goals

- No public-facing visibility of the flag (not shown on `RoadmapPage`, `FeatureCard`, swimlane/table public views).
- No notifications/alerts (e.g. email, Slack) when something is flagged — out of scope for this pass.
- No workflow enforcement around *resolving* discussion (no required "resolution" step to unflag) — unflagging is a plain toggle, same as `pinned`/`is_reviewed`.
- No multi-level flag (e.g. "urgent discussion" vs "minor") — this is a single boolean, consistent with existing flags.

## Data model

Add a new boolean field on the feature document, following the existing `pinned` / `is_reviewed` pattern in `server/src/routes/features.js`:

- **Field name:** `flagged_for_discussion` (boolean, default `false`)
- Included in the POST (create) and PUT (update) JSON schemas and the `doc`/`updated` objects, same as `pinned` today.
- Changes to this field are recorded in the existing per-field revision history (`feature_revisions` container) using the same old/new diff pattern already used for `pinned` and `is_reviewed`.
- No new container or migration needed for the flag itself — existing containers cover it. (A one-off backfill script is **not** required since the field defaults to `false`/absent for existing documents, same as other boolean flags were introduced.)

### Relationship to internal notes

The flag is an independent boolean — it does **not** require a note to exist, and nothing blocks saving a flag with no note attached. However, the workflow should actively encourage pairing a flag with a note:

- When an admin flags an item (checkbox in `AdminFeatureFormPage.jsx`, or a quick-toggle on the card — see below), the UI should prompt/nudge them toward the Internal Notes panel (e.g. auto-expand/focus the notes composer, or show a short inline prompt like "Add a note explaining what needs discussion") rather than hard-requiring text entry.
- Wherever the flag badge appears (card, table row), hovering/clicking it should surface the **most recent internal note** (if any) as a tooltip/preview, and clicking through should open that item's Internal Notes panel. This gives reviewers immediate context without leaving the board.
- If there are no notes yet on a flagged item, the badge/tooltip should indicate that (e.g. "No notes yet — click to add one") so it's obvious context is missing.

This keeps the flag and the notes log loosely coupled: flagging never fails or gets blocked by notes state, but the UI consistently routes you from "this is flagged" to "here's why."

## Who can toggle it

Any admin can flag or unflag an item, at any time, with a single click/toggle — same permission level as `pinned` and `is_reviewed`. No approval step, no restriction to item owner.

**Where it can be toggled:**
- Checkbox in the edit form (`AdminFeatureFormPage.jsx`), alongside the existing `pinned`/`is_reviewed` checkboxes.
- A quick-toggle directly on the card/row in the board and table views (new UX pattern for this codebase — existing flags are edit-form-only — but worth adding here since the whole point is fast triage). Clicking the badge/icon toggles the flag without opening the full edit form.

## Visual treatment

Flagged items get three things, all admin-only (board view, table view):

1. **Badge/icon** — a new icon (e.g. a speech-bubble/flag glyph) next to the existing `DRAFT` / `★ pinned` / verified badges on cards (`FeaturesTable.jsx`, board card rendering in `AdminDashboardPage.jsx`). Avoid purple per the workspace's color convention — suggest an amber/orange tone to read as "needs attention" without colliding with existing status/priority colors.
2. **Highlight** — a subtle highlight on the card/row itself (e.g. a colored left border + faint background tint in the same amber/orange family as the badge), so flagged items stand out even before you look for the badge specifically.
3. **Sort priority ("bubble to top")** — flagged items sort above non-flagged items within their column/group. Proposed precedence, since `pinned` already has sort meaning (it affects the *public* roadmap's default order) while this flag is purely an internal/admin concern:

   `pinned` (desc) → `flagged_for_discussion` (desc) → existing default sort (e.g. by stage order / creation date)

   i.e. pinned items still sort first; among non-pinned items, flagged ones rise to the top of their column. **This precedence is an assumption — confirm before implementation if pinned+flagged items should instead interleave differently.**

   This affects the admin board's per-column ordering and the table view's default sort; it should not change the public roadmap's sort at all (the flag has no bearing there).

## Filter

Add a new filter to the admin dashboard, copying the existing "Review" filter pattern exactly (`AdminDashboardPage.jsx`):

- New `FilterDropdown` labeled **"Discussion"** with three states: **All** / **Flagged** / **Not Flagged** (tri-state button list, same as the current Reviewed filter).
- Wired into the same `useMemo` filter pipeline as the other filters (`matchesReviewed`-style matcher), so it composes with search, category, status, priority, and reviewed filters.
- Included in the filter-chip row (removable chip when active) and in `clearAllFilters`.
- Persisted the same way as the other filters: mirrored to both `localStorage` (`adminDashboardPrefs`) and a URL query param (e.g. `discussion=flagged`), so filtered views stay bookmarkable/shareable among admins.
- Applies to both board and table view, since both already read from the same filtered feature list.

## Implementation notes (as built)

1. **Sort precedence** — implemented as: flagged items float above everything else within each column/group (board and table), overriding pinned and manual drag order alike, but only under the default/manual sort. Explicit sort choices (Newest, Recently Modified, Highest Gravity, or clicking a table column header) are left untouched and do not get the flagged items pulled to the top.
2. **Quick-toggle on card** — **not implemented in this pass**. The flag can currently only be toggled from the edit form checkbox, same as `pinned`/`is_reviewed`. A card-level quick-toggle was sketched in the original mockup but deferred since it needs its own design decision (always-visible toggle control vs. conditional badge) rather than being bundled into this change.
3. **Note-prompt behavior** — implemented as a dismissible-by-unchecking inline banner (not a hard requirement, no auto-focus of the notes composer): it reads differently depending on whether notes already exist, and on the edit page it links to scroll the internal notes panel into view.
4. **Badge/highlight color** — implemented using the amber already established in the codebase for "Medium priority" (`#fef3c7` / `#92400e`, left-border accent `#d97706`), so no new color was introduced.

All UI copy added for this feature avoids em dashes per standing instruction.
