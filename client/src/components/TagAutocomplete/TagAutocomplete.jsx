import { useState, useRef, useEffect } from 'react';
import styles from './TagAutocomplete.module.css';

const TagAutocomplete = ({ selected = [], onChange, suggestions = [] }) => {
  const [inputValue, setInputValue] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  const filteredSuggestions = suggestions
    .filter(tag => !selected.includes(tag))
    .filter(tag => tag.toLowerCase().includes(inputValue.toLowerCase()));

  useEffect(() => {
    setHighlightedIndex(0);
  }, [inputValue]);

  const addTag = (tag) => {
    if (tag && !selected.includes(tag)) {
      onChange([...selected, tag]);
    }
    setInputValue('');
    setShowDropdown(false);
  };

  const removeTag = (tagToRemove) => {
    onChange(selected.filter(tag => tag !== tagToRemove));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
      e.preventDefault();
      if (showDropdown && filteredSuggestions[highlightedIndex]) {
        addTag(filteredSuggestions[highlightedIndex]);
      } else if (inputValue.trim()) {
        addTag(inputValue.trim());
      }
    } else if (e.key === 'Backspace' && !inputValue && selected.length > 0) {
      removeTag(selected[selected.length - 1]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => Math.min(prev + 1, filteredSuggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.inputArea} onClick={() => inputRef.current.focus()}>
        {selected.map(tag => (
          <span key={tag} className={styles.chip}>
            {tag}
            <button 
              type="button" 
              className={styles.removeBtn} 
              onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
            >
              &times;
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setShowDropdown(true);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowDropdown(true)}
          className={styles.input}
          placeholder={selected.length === 0 ? "Add tags (OSU, VLE...)" : ""}
        />
      </div>

      {showDropdown && filteredSuggestions.length > 0 && (
        <div className={styles.dropdown} ref={dropdownRef}>
          {filteredSuggestions.map((tag, index) => (
            <div
              key={tag}
              className={`${styles.suggestion} ${index === highlightedIndex ? styles.highlighted : ''}`}
              onMouseDown={(e) => {
                e.preventDefault();
                addTag(tag);
              }}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              {tag}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TagAutocomplete;
