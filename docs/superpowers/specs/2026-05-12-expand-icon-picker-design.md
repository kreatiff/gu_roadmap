# Expand Category Icon Picker

**Date:** 2026-05-12  
**Status:** Approved

## Overview

Expand the category icon picker with ~500 curated `lucide-react` line icons, themed around Education & University, Project Management, and Software Development. Replace the current ~118-icon flat list with a larger, better-organized set.

## Current State

- `client/src/components/IconPicker.jsx` has a hardcoded `ICON_LIST` array of ~100 icon names
- Grouped loosely into: Web Dev, Business, Education, Utility & Interface
- Contains 1 invalid entry (`Clarity` — no such lucide icon)
- Uses `import * as Icons from 'lucide-react'` (all 3875 icons already available)
- `VALID_ICONS` filter validates names at runtime

## Design

### New Taxonomy (4 Groups, ~500 Icons)

| Group | Count | Description |
|---|---|---|
| Education & University | ~120 | Academic, campus, science, arts, learning tools |
| Project Management | ~100 | Planning boards, tracking, workflow, reporting |
| Software Development | ~180 | Code, version control, cloud, security, devices |
| General / Interface | ~100 | Navigation, actions, status, common UI patterns |

### Curation Rules

- All entries must resolve in `lucide-react` (enforced by VALID_ICONS filter)
- Remove `Lucide*` prefixed duplicates (same icons, different export keys)
- Drop off-topic/noise entries (Heart variants, PartyPopper, SoapDispenserDroplet, etc.)
- Keep 1-2 variants where lucide has many (e.g., `Book`, `BookOpen`, not all 20+ `Book*` variants)
- Preserve all icons used by current seeded categories: `Smartphone`, `Layout`, `GraduationCap`, `Wifi`, `Briefcase`

### Code Changes

**Single file modified:** `client/src/components/IconPicker.jsx`

1. Replace `ICON_LIST` array (lines 5-22) with new curated list
2. Update placeholder: `"Search 100+ icons..."` → `"Search 500+ icons..."`
3. Remove invalid `Clarity` entry

**No other files touched** — no CSS changes, no API changes, no seed data changes, no DB schema changes.

### Files Not Changed

- `IconPicker.module.css` — styling unchanged
- `server/src/seed.js` — existing category icons preserved
- `client/src/pages/admin/AdminFeatureFormPage/AdminFeatureFormPage.jsx` — uses IconPicker unchanged
- All other components importing lucide icons — unaffected

## Verification

1. Script check: confirm all 500 names exist in lucide-react (zero invalid entries)
2. Manual: open admin feature form, click icon picker — dropdown renders
3. Manual: search for icon names — filtering works
4. Manual: verify seeded categories display correct icons

## Risks

- None. This is a content change to a static array. The VALID_ICONS filter provides a runtime safety net.
- Bundle size unaffected — `import * as Icons from 'lucide-react'` already imports everything.
