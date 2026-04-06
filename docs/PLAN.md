# Roadmap Filter & Sorting System Analysis

## Goal
Evaluate and analyze the design and implementation of the filtering and sorting system within the Admin UI (Card/Kanban and Table view), proposing top-tier UX improvements from multiple agent perspectives.

## 1. System Evaluation (Current State)

- **Filtering Structure**: Located in a global bar (`AdminDashboardPage.jsx`). Filtering options include Search (Title/Owner/Tags), View Mode (Board/List), Visible Stages, Category, Sort, and Status (including Drafts).
- **Sorting Mechanism**: Split logic. Global sort exists in `AdminDashboardPage`, but `FeaturesTable` implements its own internal sorting (`sortConfig`), leading to conflicts.
- **Client/Server**: Entirely client-side. Fetches up to 1000 features, using `useMemo` for text filtering.
- **State Representation**: Filters are stored in React `useState`. State is lost on refresh or navigation.

## 2. Agent Perspectives & Alternatives

### 🎭 Frontend Specialist (UI/UX Design)
- **Alternative A: Sidebar Filters (E-commerce Style)**. Pro: High visibility. Con: Cannibalizes horizontal space needed by Kanban boards.
- **Alternative B: Command Palette (Linear Style)**. Pro: Extremely fast for power users. Con: Low discoverability for average admins.
- **Alternative C: Filter Chips / Query System (Jira / Notion Style)**. Pro: Clean default UI. Users click "+ Filter" to dynamically add "Category", "Status", or "Priority" chips.
- **Recommendation**: **Alternative C** (Filter Chips) multi-select enabled. It creates a professional, high-density interface.

### 🎭 Backend Specialist (Data Scale)
- **Alternative A: Server-side Pagination & Filtering.** Pro: Infinite scale. Con: Slower UI response for immediate filtering, requires rewriting API and table component.
- **Alternative B: Custom Filter Hook (Client-side Refactor).** Pro: Decouples UI from logic. Scale is acceptable for roadmaps (usually < 2000 features). 
- **Recommendation**: Refactor into a `useRoadmapFilters` hook to manage the complex logic client-side, making code maintainable without rewriting the API layer right now.

### 🎭 Performance Optimizer
- **Alternative A: Web Workers for Sorting.** Pro: Zero UI blocking. Con: Over-engineered.
- **Alternative B: Debounced Search + Unified State.** Pro: Fixes keystroke lag on search. Resolves the conflicting global vs. table sorting paradox.
- **Recommendation**: Introduce debouncing for text inputs. Sync text table column sorting clicks directly with the global sort state so both Kanban and List view stay aligned.

### 🎭 DevOps / Product Planner
- **Alternative A: LocalStorage Persistence**. Pro: Easy. Con: Cannot share URLs with teammates.
- **Alternative B: URL Parameter Sync**. Pro: Deep linking. Admins can bookmark or share "Drafts in Mobile" filters directly.
- **Recommendation**: Bind all filtering state to the URL via `react-router-dom`'s `useSearchParams`.

## 3. High-Level Improvements (Proposed Actions)

1. **UX Revamp: "Filter Chips"**
   - Remove the permanent dropdowns.
   - Implement an 'Add Filter' button.
   - Filters appear as removable chips (e.g., `Category: Mobile ✕`).

2. **State Synchronization (URL State)**
   - Sync `view` (board/list), `category`, `status`, `sort`, and `q` (search) to the URL for shareable links and preserved routing.

3. **Multi-Select Capability**
   - Upgrade Category and Status filters to allow multiple selections (e.g., `Category in [Web, Mobile]`).

4. **Unified Sorting Engine**
   - Decouple sorting logic from the `FeaturesTable` internal state. Use the same global sort parameter so switching from Table to Kanban retains the EXACT ordering logic.

5. **Performance Upgrades**
   - Extract logic to `useRoadmapFilters` hook.
   - Wrap the main search input in a `useDebounce` hook (e.stopPropagation/300ms).

## User Review Required

> [!IMPORTANT]
> **Action Required**: Please confirm if you would like to proceed with the proposed **Filter Chips UI** and **URL query syncing**, keeping the filter engine client-side but heavily optimized for performance.
