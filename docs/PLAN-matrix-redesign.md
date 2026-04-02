# Overview
Redesign the Priority Matrix to visually and functionally match the Atlassian Jira Product Discovery interface. This involves shifting from percentage-based coordinates to a clean, discrete 5x5 grid layout. Features will be clustered when they share coordinates. A new side panel will be added to `AdminMatrixPage` to list all features and show detailed information upon selection.

# Project Type
WEB

# Success Criteria
- **Matrix Grid**: A 5x5 discrete grid with subtle lines and dot-based axis indicators (1-5 dots).
- **Clustering**: Multiple features at the same grid cell will "cluster" (offset slightly or arrange in a mini-grid) within that cell.
- **Side Panel**: A right-side panel in `AdminMatrixPage` containing:
    - Searchable list of all features.
    - Detail view for the currently selected feature.
- **Interactivity**: Clicking a node in the matrix or an item in the sidebar list updates the "Selected Feature" state and displays details in the sidebar.
- **Aesthetics**: Clean, modern UI inspired by Jira Product Discovery (gray/blue/orange palette, no purple).

# Tech Stack
- React (Hooks, state management)
- Vanilla CSS (Flexbox, Grid, CSS Modules)

# File Structure
- `client/src/components/PriorityMatrix.jsx`: Updated for discrete grid and clustering.
- `client/src/components/PriorityMatrix.module.css`: Grid-specific styles.
- `client/src/pages/admin/AdminMatrixPage/AdminMatrixPage.jsx`: Split layout (Matrix + Sidebar).
- `client/src/pages/admin/AdminMatrixPage/AdminMatrixPage.module.css`: Sidebar and layout styles.
- `client/src/components/FeatureSidebarCard.jsx` [NEW]: Simplified card for the sidebar list.

# Task Breakdown

### Phase 1: Matrix Core Redesign
- **Task 1: Discrete 5x5 Grid Layout**
    - Build a CSS Grid container for the 5x5 matrix.
    - Implement axis labels using 1-5 dots (Blue for Impact/Y, Orange for Effort/X).
    - **Verify**: Grid renders correctly with 25 cells and dot-based labels.
- **Task 2: Positioning & Clustering Logic**
    - Group features by their (Impact, Effort) coordinates.
    - For each group, arrange dots within their specific grid cell (clustering).
    - **Verify**: Multiple features at (3,3) are visible and clickable within the center cell.

### Phase 2: Admin Sidebar Implementation
- **Task 3: Layout Refactor**
    - Update `AdminMatrixPage` to a two-column layout (70% Matrix, 30% Sidebar).
- **Task 4: Feature List & Detail Component**
    - Create a searchable list of features in the sidebar.
    - Create a "Detail View" state that shows description, tags, and owner when a feature is selected.
    - **Verify**: Selecting a feature updates the sidebar content.
- **Task 5: Cross-Selection Sync**
    - Sync state between the Matrix (clicking a dot selects it in the list) and the Sidebar (clicking a list item highlights the dot).

### Phase 3: Final Polish
- **Task 6: Aesthetics & Transitions**
    - Add smooth transitions for highlights and side panel updates.
    - Apply consistent design tokens.

# Phase X: Verification Plan
- [ ] Manual test: Verify coordinates match grid placement.
- [ ] Manual test: Verify clustering prevents dot overlap.
- [ ] Manual test: Verify sidebar search filters the list.
- [ ] Script: `ux_audit.py` to ensure compliance with design guidelines.
- [ ] Verify: No purple colors used.

