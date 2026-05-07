import { useState, useRef, useEffect } from 'react';
import styles from './StringAutocomplete.module.css';

const StringAutocomplete = ({ value = '', onChange, suggestions = [], placeholder = '' }) => {
  const [inputValue, setInputValue] = useState(value);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [hasNavigated, setHasNavigated] = useState(false);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const filteredSuggestions = suggestions
    .filter(s => typeof s === 'string')
    .filter(s => s.toLowerCase().includes(inputValue.toLowerCase()));

  useEffect(() => {
    setHighlightedIndex(0);
  }, [inputValue]);

  const selectValue = (newValue) => {
    const trimmed = newValue.trim();
    if (!trimmed) return;
    setInputValue(trimmed);
    onChange?.(trimmed);
    setShowDropdown(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (showDropdown && filteredSuggestions[highlightedIndex]) {
        selectValue(filteredSuggestions[highlightedIndex]);
      } else {
        selectValue(inputValue);
      }
    } else if (e.key === 'Tab') {
      if (showDropdown && hasNavigated && filteredSuggestions[highlightedIndex]) {
        e.preventDefault();
        selectValue(filteredSuggestions[highlightedIndex]);
      }
      // else allow default Tab behavior
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setShowDropdown(true);
      setHasNavigated(true);
      setHighlightedIndex(prev => Math.min(prev + 1, filteredSuggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHasNavigated(true);
      setHighlightedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowDropdown(false);
        setInputValue(value);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={styles.container} ref={containerRef}>
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value);
          setShowDropdown(true);
          setHasNavigated(false);
        }}
        onKeyDown={handleKeyDown}
        onFocus={() => setShowDropdown(true)}
        className={styles.input}
        placeholder={placeholder}
      />
      {showDropdown && filteredSuggestions.length > 0 && (
        <div className={styles.dropdown}>
          {filteredSuggestions.map((s, index) => (
            <div
              key={`${s}-${index}`}
              className={`${styles.suggestion} ${index === highlightedIndex ? styles.highlighted : ''}`}
              onMouseDown={(e) => {
                e.preventDefault();
                selectValue(s);
              }}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StringAutocomplete;
