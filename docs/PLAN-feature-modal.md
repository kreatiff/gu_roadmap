# PLAN-feature-modal.md

## Context check (Phase -1)
- Goal: Implement a deep-linkable modal detail view for features in the public roadmap and migrate upvoting to that view only.
- User constraints: Use query parameter `?feature=ID`, remove upvote from grid, cool success animation, and login enforcement.
- Model assigned: `frontend-specialist`.

## Goal
Enhance the user experience of the Griffith Roadmap by providing a rich, contextual detail view and a structured voting flow.

## Tasks

### Phase 1: Infrastructure & Components
- [/] Install `framer-motion` (Optional, for higher-end animations) → Verify: `npm list framer-motion`
- [/] Create `FeatureDetailModal.jsx` → Verify: Modal renders when `?feature=ID` is present in the URL.
- [/] Implement Backdrop & Close functionality → Verify: Clicking outside removes query parameter from URL.

### Phase 2: FeatureCard Refactor
- [/] Modify `FeatureCard.jsx` to remove `VoteButton` → Verify: Upvote button is gone from the main grid.
- [/] Add click interaction to `FeatureCard` → Verify: Clicking a card updates URL to `?feature=ID`.
- [/] Style card for focus/active states.

### Phase 3: Voting Migration & Polish
- [/] Add `VoteButton` to `FeatureDetailModal` → Verify: Voting works within the modal.
- [/] Implement CSS/Motion pulse animation on vote success → Verify: "Cool animation" triggers on heart click.
- [/] Add Scroll Locking when modal is active → Verify: Background page doesn't scroll when modal is open.

### Phase 4: Auth Enforcement
- [/] Wrap `RoadmapPage.jsx` grid in a session check → Verify: Non-logged-in users see a login prompt instead of feature cards.

## Done When
- [ ] Clicking any card on the public view opens a detailed modal.
- [ ] Users can only upvote from within the modal.
- [ ] The feature can be shared by a direct link containing `?feature=ID`.
- [ ] A success animation triggers upon upvoting.
- [ ] Roadmap grid is hidden for guests.
