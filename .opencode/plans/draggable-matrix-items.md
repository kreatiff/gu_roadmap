# Plan: Draggable Priority Matrix Items

## Overview
Make feature badges in the Priority Matrix draggable so users can update `impact` and `effort` by repositioning items on the board.

## Current State
- `@hello-pangea/dnd` v18.0.1 is already installed and used in 3 other admin pages (Stages, Categories, Dashboard)
- `updateFeature(id, data)` PUT API exists for updating feature fields
- PriorityMatrix receives `features`, `onFeatureClick`, `selectedFeatureId` props
- AdminMatrixPage manages `features` state and fetches via `getFeatures()`
- Each matrix cell corresponds to `impact` (Y) × `effort` (X) coordinates

## Proposed Implementation

### 1. PriorityMatrix Component Changes
- Wrap the matrix grid in a `DragDropContext`
- Make each of the 100 cells a `Droppable` zone with unique IDs like `"cell-10-1"`
- Make each feature badge a `Draggable` item
- When a feature is dropped on a cell, derive new `impact` (from row) and `effort` (from column)
- Call `onFeatureMove(featureId, newImpact, newEffort)` callback

### 2. AdminMatrixPage Changes
- Accept `onFeatureMove` callback
- Call `updateFeature(id, { impact: newImpact, effort: newEffort })`
- Optimistically update local `features` state OR refetch after success
- Handle loading/error states

### 3. Visual Feedback
- Drag ghost/preview of the badge being dragged
- Hover highlight on droppable cells
- Selected feature remains visually selected during/after drag
- Optional: Shake animation or color flash on successful drop

## Open Questions

1. **Auto-save behavior**: Should dragging auto-save immediately to the server (like the dashboard drag-to-reorder), or should there be a "Save Changes" button that batches updates?

2. **Visual feedback preference**: Should dropped features smoothly animate to their new cell position, or snap instantly? And should cells highlight when you drag over them?

3. **Multiple features per cell**: If a cell already has 2-3 features, should dropping another one just append it normally, or should there be a maximum limit per cell?
