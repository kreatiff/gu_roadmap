import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import StringAutocomplete from './StringAutocomplete';

describe('StringAutocomplete', () => {
  const suggestions = ['Sarah Miller (Digital ID)', 'James Chen (LMS)', 'Emma Watson (Campus Exp)'];

  it('renders the current value in the input', () => {
    render(<StringAutocomplete value="Sarah Miller" onChange={vi.fn()} suggestions={suggestions} />);
    expect(screen.getByRole('textbox')).toHaveValue('Sarah Miller');
  });

  it('shows matching suggestions when typing', () => {
    render(<StringAutocomplete value="" onChange={vi.fn()} suggestions={suggestions} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'james' } });
    expect(screen.getByText('James Chen (LMS)')).toBeInTheDocument();
    expect(screen.queryByText('Emma Watson (Campus Exp)')).not.toBeInTheDocument();
  });

  it('calls onChange with selected suggestion on click', () => {
    const onChange = vi.fn();
    render(<StringAutocomplete value="" onChange={onChange} suggestions={suggestions} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'james' } });
    fireEvent.mouseDown(screen.getByText('James Chen (LMS)'));
    expect(onChange).toHaveBeenCalledWith('James Chen (LMS)');
  });

  it('calls onChange with current input on Enter when no suggestion is highlighted', () => {
    const onChange = vi.fn();
    render(<StringAutocomplete value="" onChange={onChange} suggestions={suggestions} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'New Person' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('New Person');
  });

  it('selects the first matching suggestion on Enter', () => {
    const onChange = vi.fn();
    render(<StringAutocomplete value="" onChange={onChange} suggestions={suggestions} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'james' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('James Chen (LMS)');
  });

  it('closes dropdown on Escape', () => {
    render(<StringAutocomplete value="" onChange={vi.fn()} suggestions={suggestions} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'james' } });
    expect(screen.getByText('James Chen (LMS)')).toBeInTheDocument();
    fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' });
    expect(screen.queryByText('James Chen (LMS)')).not.toBeInTheDocument();
  });

  it('trims whitespace from free-text input before calling onChange', () => {
    const onChange = vi.fn();
    render(<StringAutocomplete value="" onChange={onChange} suggestions={suggestions} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '  New Person  ' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('New Person');
  });

  it('does not call onChange for empty or whitespace-only input', () => {
    const onChange = vi.fn();
    render(<StringAutocomplete value="" onChange={onChange} suggestions={suggestions} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('highlights next suggestion on ArrowDown', () => {
    render(<StringAutocomplete value="" onChange={vi.fn()} suggestions={suggestions} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'a' } });
    const items = screen.getAllByText(/Sarah Miller|James Chen|Emma Watson/);
    expect(items[0].className).toMatch(/highlighted/);
    fireEvent.keyDown(input, { key: 'ArrowDown', code: 'ArrowDown' });
    expect(items[1].className).toMatch(/highlighted/);
  });

  it('highlights previous suggestion on ArrowUp', () => {
    render(<StringAutocomplete value="" onChange={vi.fn()} suggestions={suggestions} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'a' } });
    const items = screen.getAllByText(/Sarah Miller|James Chen|Emma Watson/);
    fireEvent.keyDown(input, { key: 'ArrowDown', code: 'ArrowDown' });
    expect(items[1].className).toMatch(/highlighted/);
    fireEvent.keyDown(input, { key: 'ArrowUp', code: 'ArrowUp' });
    expect(items[0].className).toMatch(/highlighted/);
  });

  it('does not hijack Tab when user has not navigated suggestions', () => {
    const onChange = vi.fn();
    render(<StringAutocomplete value="" onChange={onChange} suggestions={suggestions} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'james' } });
    fireEvent.keyDown(input, { key: 'Tab', code: 'Tab' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('resets input value on click outside', () => {
    render(
      <div>
        <StringAutocomplete value="Sarah Miller" onChange={vi.fn()} suggestions={suggestions} />
        <button>Outside</button>
      </div>
    );
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'james' } });
    fireEvent.mouseDown(screen.getByText('Outside'));
    expect(input).toHaveValue('Sarah Miller');
  });
});
