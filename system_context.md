# System Context: Griffith University (GU) Roadmap Tool

This document provides a technical summary of the **GU Roadmap** application, optimized for AI agents to understand the architecture, data models, and UI patterns.

## 🚀 System Overview
The GU Roadmap is a full-stack feedback and strategic planning tool allowing students to vote on features and admins to prioritize delivery using a Jira Product Discovery-style interface.

### Tech Stack
- **Frontend:** React 19, Vite 6, React Router v7.
- **Backend:** Fastify v5 (Node.js).
- **Database:** `better-sqlite3` (WAL mode enabled for high concurrency).
- **Style:** Vanilla CSS with modern tokens (Glassmorphism, CSS Variables).

---

## 📊 Core Data Model: `features`
The `features` table is the central entity. Below is the current schema and field definitions:

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | TEXT (UUID) | Unique identifier. |
| `title` | TEXT | Feature summary/name. |
| `slug` | TEXT | URL-friendly unique title. |
| `description` | TEXT | Detailed markdown-supported description. |
| `status` | TEXT | Enum: `under_review`, `planned`, `in_progress`, `launched`, `declined`. |
| `category_id` | TEXT | Foreign key to `categories` (Mobile, LMS, etc.). |
| `vote_count` | INTEGER | Total student votes (managed via SQL transactions). |
| `impact` | INTEGER | 1-5 strategic impact score. |
| `effort` | INTEGER | 1-5 development effort score. |
| `owner` | TEXT | **[Admin Only]** Primary delivery lead. |
| `key_stakeholder`| TEXT | **[Admin Only]** Main business point of contact. |
| `priority` | TEXT | **[Admin Only]** Strategic rank (`Low`, `Medium`, `High`, `Critical`). |
| `tags` | TEXT (JSON) | Array of arbitrary labels. |
| `pinned` | INTEGER | Boolean (0/1) to pin to the top of the public view. |
| `created_at` | TEXT | ISO timestamp. |
| `updated_at` | TEXT | ISO timestamp. |

---

## 🔐 Admin UI & Management
The Admin area (`/admin`) is designed for high-density strategic management.

### 1. Dual-View Dashboard
- **Persistence:** View mode (`board` vs `list`) is persisted in `localStorage` as `adminViewMode`.
- **Kanban Board:** Drag-and-drop status updates using `@hello-pangea/dnd`. Cards display color-coded **Priority** badges and **Owner** names.
- **Interactive Table:**
  - **Sorting:** Multi-column sorting (Title, Status, Votes, Impact, Effort, Priority, Owner).
  - **Grouping:** Features are grouped by `category_name` with collapsible headers.
  - **Inline Editing:** `Status` and `Priority` are editable via integrated custom `<select>` components without leaving the table.

### 2. Strategic Feature Form
- Includes standard fields (Title, Description, Category).
- **Strategic Category Section:** Dedicated inputs for Impact/Effort sliders and strategic text fields (Priority, Owner, Stakeholder).
- Optimistic UI pattern: Dashboard updates state immediately on save/delete.

---

## 🌐 Public UI & Student Interaction
The Public area (`/`) focuses on transparency and engagement.

### 1. Roadmap Views
- **Grid View:** Pinterest-style cards showing status, votes, and category.
- **Priority Matrix:** 4-quadrant interactive chart (Impact vs Effort). "Quick Wins" vs "Big Bets" visualization.
- **Detail Modal:** Deep-dive view with full description and vote action.

### 2. Voting System
- **SSO Protection:** Users must log in via Griffith OIDC to vote.
- **Concurrency:** Uses a SQLite transaction to increment `vote_count` and record the user's vote atomicity.
- **Privacy:** Admin-only fields (`Priority`, `Owner`, `Stakeholder`) are **EXCLUDED** from the public API responses and UI cards.

---

## 🛠️ Key Interaction Patterns
- **Optimistic UI:** The `AdminDashboardPage` uses a centralized `onUpdateFeatureField` handler that updates the local React state (both flat list and partitioned Kanban columns) before the API call completes.
- **State Partitioning:** For the Board view, features are partitioned into objects keyed by status (`under_review`, etc.) to optimize DND rendering.
- **CSS Architecture:** Uses global variables for theming (e.g., `--gu-red`, `--gu-gold`) and glassmorphism utilities for tooltips and cards.
