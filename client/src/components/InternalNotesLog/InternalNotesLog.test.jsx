import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import InternalNotesLog from './InternalNotesLog';
import * as notesApi from '../../api/notes';
import * as jiraApi from '../../api/jira';

vi.mock('../../api/notes');
vi.mock('../../api/jira');

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1', name: 'Jane Smith', email: 'jane@griffith.edu.au' } }),
}));

const addToast = vi.hoisted(() => vi.fn());
vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({ addToast }),
}));

vi.mock('../RichTextEditor', () => ({
  default: ({ value, onChange, placeholder }) => (
    <textarea
      data-testid="rich-text-editor"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock('../RichTextViewer', () => ({
  default: ({ content }) => <div data-testid="rich-text-viewer">{content}</div>,
  getPlainTextFromRichText: (value) => value,
}));

const noteFromUser = {
  id: 'note-1',
  featureId: 'feature-1',
  content: 'My own note',
  authorId: 'user-1',
  authorName: 'Jane Smith',
  createdAt: '2026-07-01T00:00:00Z',
  updatedAt: null,
  edited: false,
};

const noteFromOther = {
  id: 'note-2',
  featureId: 'feature-1',
  content: "Someone else's note",
  authorId: 'user-2',
  authorName: 'Other Admin',
  createdAt: '2026-06-30T00:00:00Z',
  updatedAt: null,
  edited: false,
};

describe('InternalNotesLog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notesApi.getNoteErrorMessage.mockImplementation((err, fallback) => err?.message || fallback);
    jiraApi.fetchJiraConfig.mockResolvedValue({ baseUrl: '', aiConfigured: true });
  });

  it("shows edit/delete controls only for the current user's own notes", async () => {
    notesApi.getFeatureNotes.mockResolvedValue([noteFromUser, noteFromOther]);
    render(<InternalNotesLog featureId="feature-1" />);

    await screen.findByText('My own note');
    const ownEntry = screen.getByText('My own note').closest('li');
    const otherEntry = screen.getByText("Someone else's note").closest('li');

    expect(ownEntry.querySelector('[aria-label="Edit note"]')).not.toBeNull();
    expect(otherEntry.querySelector('[aria-label="Edit note"]')).toBeNull();
  });

  it('disables the Add note button while the draft is empty', async () => {
    notesApi.getFeatureNotes.mockResolvedValue([]);
    render(<InternalNotesLog featureId="feature-1" />);

    await screen.findByText('No internal notes yet.');
    expect(screen.getByText('Add note')).toBeDisabled();
  });

  it('enables and posts a note once the draft has content', async () => {
    notesApi.getFeatureNotes.mockResolvedValue([]);
    notesApi.createFeatureNote.mockResolvedValue({ ...noteFromUser, id: 'note-3', content: 'New note' });
    render(<InternalNotesLog featureId="feature-1" />);

    await screen.findByText('No internal notes yet.');
    fireEvent.change(screen.getByTestId('rich-text-editor'), { target: { value: 'New note' } });
    expect(screen.getByText('Add note')).not.toBeDisabled();

    fireEvent.click(screen.getByText('Add note'));

    await waitFor(() => expect(notesApi.createFeatureNote).toHaveBeenCalledWith('feature-1', 'New note', { discussion: false }));
  });

  it('shows a stale badge when a newer note exists than the saved summary', async () => {
    notesApi.getFeatureNotes.mockResolvedValue([noteFromUser]);
    const summary = { content: 'Old summary', generatedAt: '2026-06-01T00:00:00Z', generatedByName: 'Admin' };
    render(<InternalNotesLog featureId="feature-1" initialSummary={summary} />);

    await screen.findByText('New notes since this summary');
  });

  it('does not show a stale badge when the summary is newer than all notes', async () => {
    notesApi.getFeatureNotes.mockResolvedValue([noteFromOther]);
    const summary = { content: 'Fresh summary', generatedAt: '2026-07-05T00:00:00Z', generatedByName: 'Admin' };
    render(<InternalNotesLog featureId="feature-1" initialSummary={summary} />);

    await screen.findByText('Fresh summary');
    expect(screen.queryByText('New notes since this summary')).not.toBeInTheDocument();
  });

  it('hides the AI summary panel entirely when AI is not configured', async () => {
    jiraApi.fetchJiraConfig.mockResolvedValue({ baseUrl: '', aiConfigured: false });
    notesApi.getFeatureNotes.mockResolvedValue([]);
    render(<InternalNotesLog featureId="feature-1" />);

    await screen.findByText('No internal notes yet.');
    expect(screen.queryByText('Summarise notes')).not.toBeInTheDocument();
  });

  it('allows the summary to be edited and saved', async () => {
    notesApi.getFeatureNotes.mockResolvedValue([]);
    const summary = { content: 'Initial summary', generatedAt: '2026-07-05T00:00:00Z', generatedByName: 'Admin' };
    notesApi.updateNotesSummary.mockResolvedValue({
      content: 'Updated summary text',
      generatedAt: '2026-07-09T00:00:00Z',
      generatedByName: 'Jane Smith',
    });

    render(<InternalNotesLog featureId="feature-1" initialSummary={summary} />);

    await screen.findByText('Initial summary');
    
    // Click Edit summary
    fireEvent.click(screen.getByText('Edit summary'));

    // The editor should have the initial summary value, wrapped as a paragraph
    // so a plain-text AI summary doesn't collapse when opened for editing
    const editors = screen.getAllByTestId('rich-text-editor');
    const summaryEditor = editors[0];
    expect(summaryEditor.value).toBe('<p>Initial summary</p>');

    // Change text and click save
    fireEvent.change(summaryEditor, { target: { value: 'Updated summary text' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(notesApi.updateNotesSummary).toHaveBeenCalledWith('feature-1', 'Updated summary text'));
    await screen.findByText('Updated summary text');
  });

  it('marks the summary stale after editing a note, even with no newer note', async () => {
    notesApi.getFeatureNotes.mockResolvedValue([noteFromUser]);
    const summary = { content: 'Old summary', generatedAt: '2026-07-05T00:00:00Z', generatedByName: 'Admin', noteCount: 1 };
    notesApi.updateFeatureNote.mockResolvedValue({
      ...noteFromUser,
      content: 'Edited content',
      edited: true,
      updatedAt: '2026-07-06T00:00:00Z',
    });

    render(<InternalNotesLog featureId="feature-1" initialSummary={summary} />);

    await screen.findByText('My own note');
    expect(screen.queryByText('New notes since this summary')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Edit note'));
    const noteEditor = screen.getAllByTestId('rich-text-editor')[0];
    fireEvent.change(noteEditor, { target: { value: 'Edited content' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(notesApi.updateFeatureNote).toHaveBeenCalled());
    await screen.findByText('New notes since this summary');
  });

  it('marks the summary stale after deleting a note, even with no newer note', async () => {
    notesApi.getFeatureNotes.mockResolvedValue([noteFromUser, noteFromOther]);
    const summary = { content: 'Old summary', generatedAt: '2026-07-05T00:00:00Z', generatedByName: 'Admin', noteCount: 2 };
    notesApi.deleteFeatureNote.mockResolvedValue({ ok: true });

    render(<InternalNotesLog featureId="feature-1" initialSummary={summary} />);

    await screen.findByText('My own note');
    expect(screen.queryByText('New notes since this summary')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Delete note'));
    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => expect(notesApi.deleteFeatureNote).toHaveBeenCalled());
    await screen.findByText('New notes since this summary');
  });

  describe('discussion points', () => {
    const openPoint = {
      ...noteFromOther,
      id: 'note-open',
      content: 'Should we build SSO?',
      discussion: { status: 'open', resolution: null, resolvedAt: null, resolvedById: null, resolvedByName: null },
    };
    const resolvedPoint = {
      ...noteFromUser,
      id: 'note-resolved',
      content: 'Older question',
      discussion: { status: 'resolved', resolution: 'Decided: yes', resolvedAt: '2026-07-02T00:00:00Z', resolvedById: 'user-2', resolvedByName: 'Other Admin' },
    };

    it('posts a note as a discussion point when the option is ticked', async () => {
      notesApi.getFeatureNotes.mockResolvedValue([]);
      notesApi.createFeatureNote.mockResolvedValue({ ...noteFromUser, id: 'n9', content: 'Q', discussion: openPoint.discussion });
      render(<InternalNotesLog featureId="feature-1" />);

      await screen.findByText('No internal notes yet.');
      fireEvent.change(screen.getByTestId('rich-text-editor'), { target: { value: 'Q' } });
      fireEvent.click(screen.getByLabelText('Discussion point'));
      fireEvent.click(screen.getByText('Add discussion point'));

      await waitFor(() => expect(notesApi.createFeatureNote).toHaveBeenCalledWith('feature-1', 'Q', { discussion: true }));
      expect(addToast).toHaveBeenCalledWith('Discussion point added. This feature is now flagged for discussion.', 'success');
    });

    it('blocks a second open discussion point and says exactly why', async () => {
      notesApi.getFeatureNotes.mockResolvedValue([openPoint]);
      render(<InternalNotesLog featureId="feature-1" />);

      await screen.findByText('Should we build SSO?');
      expect(screen.getByLabelText('Discussion point')).toBeDisabled();
      expect(screen.getByText(/A discussion point is already open on this feature \(added by Other Admin on/)).toBeInTheDocument();
      expect(screen.getByText(/Only one can be open at a time, so resolve it before adding another/)).toBeInTheDocument();
    });

    it('resolves an open discussion point with an optional note', async () => {
      notesApi.getFeatureNotes.mockResolvedValue([openPoint]);
      notesApi.resolveDiscussionPoint.mockResolvedValue({
        ...openPoint,
        discussion: { status: 'resolved', resolution: 'Agreed to build it', resolvedAt: '2026-07-03T00:00:00Z', resolvedById: 'user-1', resolvedByName: 'Jane Smith' },
      });
      render(<InternalNotesLog featureId="feature-1" />);

      await screen.findByText('Should we build SSO?');
      fireEvent.click(screen.getByText('Resolve'));
      const editors = screen.getAllByTestId('rich-text-editor');
      fireEvent.change(editors[editors.length - 1], { target: { value: 'Agreed to build it' } });
      fireEvent.click(screen.getByText('Resolve discussion'));

      await waitFor(() => expect(notesApi.resolveDiscussionPoint).toHaveBeenCalledWith('feature-1', 'note-open', 'Agreed to build it'));
      await screen.findByText('Agreed to build it');
      expect(screen.getByText(/Resolved by Jane Smith/)).toBeInTheDocument();
    });

    it('allows resolving with no resolution note', async () => {
      notesApi.getFeatureNotes.mockResolvedValue([openPoint]);
      notesApi.resolveDiscussionPoint.mockResolvedValue({
        ...openPoint,
        discussion: { status: 'resolved', resolution: null, resolvedAt: '2026-07-03T00:00:00Z', resolvedById: 'user-1', resolvedByName: 'Jane Smith' },
      });
      render(<InternalNotesLog featureId="feature-1" />);

      await screen.findByText('Should we build SSO?');
      fireEvent.click(screen.getByText('Resolve'));
      fireEvent.click(screen.getByText('Resolve discussion'));

      await waitFor(() => expect(notesApi.resolveDiscussionPoint).toHaveBeenCalledWith('feature-1', 'note-open', ''));
      await screen.findByText('Resolved without a resolution note.');
    });

    it('shows a resolved point together with its resolution', async () => {
      notesApi.getFeatureNotes.mockResolvedValue([resolvedPoint]);
      render(<InternalNotesLog featureId="feature-1" />);

      await screen.findByText('Older question');
      expect(screen.getByText('Decided: yes')).toBeInTheDocument();
      expect(screen.getByText(/Resolved by Other Admin/)).toBeInTheDocument();
    });

    it('explains why a resolved point cannot be reopened while another is open', async () => {
      notesApi.getFeatureNotes.mockResolvedValue([openPoint, resolvedPoint]);
      render(<InternalNotesLog featureId="feature-1" />);

      await screen.findByText('Older question');
      fireEvent.click(screen.getByText('Reopen'));

      expect(notesApi.reopenDiscussionPoint).not.toHaveBeenCalled();
      expect(addToast).toHaveBeenCalledWith(
        expect.stringMatching(/cannot be reopened because another discussion point on this feature \(added by Other Admin on .*\) is still open and unresolved\. Resolve that one first, then reopen this one\./),
        'error',
      );
    });

    it('reopens a resolved point after confirmation when nothing else is open', async () => {
      notesApi.getFeatureNotes.mockResolvedValue([resolvedPoint]);
      notesApi.reopenDiscussionPoint.mockResolvedValue({ ...resolvedPoint, discussion: openPoint.discussion });
      render(<InternalNotesLog featureId="feature-1" />);

      await screen.findByText('Older question');
      fireEvent.click(screen.getByText('Reopen'));
      const reopenButtons = screen.getAllByText('Reopen');
      fireEvent.click(reopenButtons[reopenButtons.length - 1]);

      await waitFor(() => expect(notesApi.reopenDiscussionPoint).toHaveBeenCalledWith('feature-1', 'note-resolved'));
      await screen.findByText('Resolve');
    });

    it('shows the server explanation verbatim when an action is refused, and refreshes stale notes', async () => {
      notesApi.getFeatureNotes.mockResolvedValue([openPoint]);
      const serverMessage = 'This discussion point was already resolved by Sam on 3 Jul 2026. Refresh the page to see their resolution.';
      notesApi.resolveDiscussionPoint.mockRejectedValue({ statusCode: 409, error: 'Discussion point already resolved', message: serverMessage });
      render(<InternalNotesLog featureId="feature-1" />);

      await screen.findByText('Should we build SSO?');
      fireEvent.click(screen.getByText('Resolve'));
      fireEvent.click(screen.getByText('Resolve discussion'));

      await waitFor(() => expect(addToast).toHaveBeenCalledWith(serverMessage, 'error'));
      await waitFor(() => expect(notesApi.getFeatureNotes).toHaveBeenCalledTimes(2));
    });

    it('warns that deleting an open discussion point clears the flag', async () => {
      const ownOpen = { ...openPoint, authorId: 'user-1', authorName: 'Jane Smith' };
      notesApi.getFeatureNotes.mockResolvedValue([ownOpen]);
      notesApi.deleteFeatureNote.mockResolvedValue({ ok: true });
      render(<InternalNotesLog featureId="feature-1" />);

      await screen.findByText('Should we build SSO?');
      fireEvent.click(screen.getByLabelText('Delete note'));
      expect(screen.getByText(/no longer be flagged for discussion/)).toBeInTheDocument();
      fireEvent.click(screen.getByText('Delete'));

      await waitFor(() => expect(notesApi.deleteFeatureNote).toHaveBeenCalled());
      expect(addToast).toHaveBeenCalledWith('Discussion point deleted. This feature is no longer flagged for discussion.', 'success');
    });
  });
});
