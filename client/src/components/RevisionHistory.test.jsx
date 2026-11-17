import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import RevisionHistory from './RevisionHistory';

const revisions = [
  {
    id: 'r1',
    changed_by: 'jane@example.edu',
    changed_at: '2026-11-17T01:00:00Z',
    changes: { action: 'updated', fields: { flagged_for_discussion: { old: false, new: true } } },
  },
];

describe('RevisionHistory', () => {
  it('renders nothing when closed', () => {
    render(<RevisionHistory isOpen={false} onClose={() => {}} revisions={revisions} />);
    expect(screen.queryByText('jane@example.edu')).not.toBeInTheDocument();
  });

  // Regression: rendered inline inside the feature form (a z-index: 1 stacking context) the
  // modal was painted underneath the sticky notes column, so it must live directly in <body>.
  it('renders into document.body, outside the component tree that opened it', () => {
    const { container } = render(
      <form><RevisionHistory isOpen onClose={() => {}} revisions={revisions} /></form>
    );
    const user = screen.getByText('jane@example.edu');
    expect(container.contains(user)).toBe(false);
    expect(document.body.contains(user)).toBe(true);
  });

  it('shows a Discussion Flag change as Yes/No', () => {
    render(<RevisionHistory isOpen onClose={() => {}} revisions={revisions} />);
    expect(screen.getByText('Changed Discussion Flag from "No" to "Yes"')).toBeInTheDocument();
  });
});
