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

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({ addToast: vi.fn() }),
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

    await waitFor(() => expect(notesApi.createFeatureNote).toHaveBeenCalledWith('feature-1', 'New note'));
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
});
