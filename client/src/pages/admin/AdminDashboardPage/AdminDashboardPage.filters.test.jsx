import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import AdminDashboardPage from './AdminDashboardPage';
import * as featuresApi from '../../../api/features';
import * as categoriesApi from '../../../api/categories';
import * as stagesApi from '../../../api/stages';

vi.mock('../../../api/features');
vi.mock('../../../api/categories');
vi.mock('../../../api/stages');
vi.mock('../../../components/AdminLayout', () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock('../../../contexts/ToastContext', () => ({ useToast: () => ({ addToast: vi.fn() }) }));

const stage = { id: 's1', slug: 'planned', name: 'Planned', color: '#000', order_idx: 1, is_visible: true };
const feat = (id, title, owner) => ({
  id, title, owner, stage_id: 's1', stage_slug: 'planned', status: 'planned', priority: 'High',
  category_id: 'c1', category_name: 'Core', category_color: '#000', stage_sort_order: Number(id.slice(1)) * 1000,
  is_published: true, impact: 1, effort: 1, gravity_score: 1, created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-01T00:00:00Z', tags: [],
});

const Search = () => <div data-testid="search">{useLocation().search}</div>;

const renderPage = (initialUrl = '/admin') => render(
  <MemoryRouter initialEntries={[initialUrl]}><AdminDashboardPage /><Search /></MemoryRouter>
);

describe('AdminDashboardPage filters', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    featuresApi.getFeatures.mockResolvedValue({
      data: [feat('f1', 'Alpha feature', 'Priya Shah'), feat('f2', 'Beta feature', 'priya shah '), feat('f3', 'Gamma feature', 'Sam Lee'), feat('f4', 'Delta feature', '')],
    });
    categoriesApi.getCategories.mockResolvedValue([{ id: 'c1', name: 'Core' }]);
    stagesApi.getStages.mockResolvedValue([stage]);
  });

  const openOwnerDropdown = async () => {
    await screen.findByText('Alpha feature');
    fireEvent.click(screen.getByRole('button', { name: /^Owner/ }));
  };

  it('lists each owner once (case-insensitively) plus No owner', async () => {
    renderPage();
    await openOwnerDropdown();
    expect(screen.getAllByLabelText(/Priya Shah/i)).toHaveLength(1);
    expect(screen.getByLabelText('Sam Lee')).toBeInTheDocument();
    expect(screen.getByLabelText('No owner')).toBeInTheDocument();
  });

  it('filters the board, shows a chip and writes the URL, then clears', async () => {
    renderPage();
    await openOwnerDropdown();
    fireEvent.click(screen.getByLabelText('Sam Lee'));

    await waitFor(() => expect(screen.queryByText('Alpha feature')).not.toBeInTheDocument());
    expect(screen.getByText('Gamma feature')).toBeInTheDocument();
    expect(screen.getByLabelText('Remove owner-sam lee filter')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('search').textContent).toContain('owner=sam%2520lee'));

    fireEvent.click(screen.getByLabelText('Remove owner-sam lee filter'));
    await waitFor(() => expect(screen.getByText('Alpha feature')).toBeInTheDocument());
  });

  it('combines several owners and can pick unowned features', async () => {
    renderPage();
    await openOwnerDropdown();
    fireEvent.click(screen.getByLabelText(/Priya Shah/i));
    fireEvent.click(screen.getByLabelText('No owner'));

    await waitFor(() => expect(screen.queryByText('Gamma feature')).not.toBeInTheDocument());
    expect(screen.getByText('Alpha feature')).toBeInTheDocument();
    expect(screen.getByText('Beta feature')).toBeInTheDocument();
    expect(screen.getByText('Delta feature')).toBeInTheDocument();
  });

  it('restores the selection from the URL', async () => {
    renderPage('/admin?owner=sam%2520lee');
    await screen.findByText('Gamma feature');
    expect(screen.queryByText('Alpha feature')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Remove owner-sam lee filter')).toBeInTheDocument();
  });

  describe('saved preferences', () => {
    const savePrefs = (prefs) => localStorage.setItem('adminDashboardPrefs', JSON.stringify(prefs));

    it('restores a saved Category selection when the URL has none', async () => {
      featuresApi.getFeatures.mockResolvedValue({
        data: [{ ...feat('f1', 'Alpha feature', 'Sam'), category_id: 'c1' }, { ...feat('f2', 'Beta feature', 'Sam'), category_id: 'c2' }],
      });
      categoriesApi.getCategories.mockResolvedValue([{ id: 'c1', name: 'Core' }, { id: 'c2', name: 'Extras' }]);
      savePrefs({ selectedCategories: ['c2'] });

      renderPage('/admin');
      await screen.findByText('Beta feature');
      expect(screen.queryByText('Alpha feature')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Remove category-c2 filter')).toBeInTheDocument();
    });

    it('restores saved Stage, Priority and Owner selections too', async () => {
      featuresApi.getFeatures.mockResolvedValue({
        data: [
          { ...feat('f1', 'Alpha feature', 'Sam Lee'), priority: 'High' },
          { ...feat('f2', 'Beta feature', 'Sam Lee'), priority: 'Low' },
          { ...feat('f3', 'Gamma feature', 'Priya Shah'), priority: 'High' },
        ],
      });
      savePrefs({ selectedStatuses: ['s1'], selectedPriorities: ['High'], selectedOwners: ['sam lee'] });

      renderPage('/admin');
      await screen.findByText('Alpha feature');
      expect(screen.queryByText('Beta feature')).not.toBeInTheDocument();
      expect(screen.queryByText('Gamma feature')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Remove status-s1 filter')).toBeInTheDocument();
      expect(screen.getByLabelText('Remove priority-High filter')).toBeInTheDocument();
      expect(screen.getByLabelText('Remove owner-sam lee filter')).toBeInTheDocument();
    });

    it('lets the URL override a saved selection', async () => {
      featuresApi.getFeatures.mockResolvedValue({
        data: [{ ...feat('f1', 'Alpha feature', 'Sam'), priority: 'High' }, { ...feat('f2', 'Beta feature', 'Sam'), priority: 'Low' }],
      });
      savePrefs({ selectedPriorities: ['High'] });

      renderPage('/admin?priority=Low');
      await screen.findByText('Beta feature');
      expect(screen.queryByText('Alpha feature')).not.toBeInTheDocument();
    });

    it('starts unfiltered with no saved preference and no URL param', async () => {
      renderPage('/admin');
      await screen.findByText('Alpha feature');
      expect(screen.getByText('Gamma feature')).toBeInTheDocument();
      expect(screen.queryByLabelText(/^Remove .* filter$/)).not.toBeInTheDocument();
    });
  });
});
