import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TagAutocomplete from './TagAutocomplete';

describe('TagAutocomplete', () => {
  const suggestions = ['React', 'Vue', 'Angular', 'Svelte'];

  it('does not call onChange when adding a tag that differs only in case from a selected tag', () => {
    const onChange = vi.fn();
    render(
      <TagAutocomplete
        selected={['React']}
        onChange={onChange}
        suggestions={suggestions}
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'react' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not call onChange when adding a whitespace-padded duplicate', () => {
    const onChange = vi.fn();
    render(
      <TagAutocomplete
        selected={['React']}
        onChange={onChange}
        suggestions={suggestions}
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '  React  ' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not call onChange when adding an empty or whitespace-only string', () => {
    const onChange = vi.fn();
    render(
      <TagAutocomplete
        selected={[]}
        onChange={onChange}
        suggestions={suggestions}
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('calls onChange with the trimmed string when adding a valid new tag', () => {
    const onChange = vi.fn();
    render(
      <TagAutocomplete
        selected={[]}
        onChange={onChange}
        suggestions={suggestions}
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '  Vue  ' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(['Vue']);
  });

  it('excludes case-insensitive matches from already-selected tags in filteredSuggestions', () => {
    const onChange = vi.fn();
    render(
      <TagAutocomplete
        selected={['react']}
        onChange={onChange}
        suggestions={suggestions}
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'e' } });

    // "React" should not appear because "react" is already selected (case-insensitive match)
    expect(screen.queryByText('React')).not.toBeInTheDocument();
    // Vue and Svelte still match the filter and should be visible
    expect(screen.getByText('Vue')).toBeInTheDocument();
    expect(screen.getByText('Svelte')).toBeInTheDocument();
  });
});
