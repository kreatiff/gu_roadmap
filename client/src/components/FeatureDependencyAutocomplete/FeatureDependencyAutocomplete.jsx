import { useState, useRef, useEffect, useMemo } from 'react';
import { X, Search } from 'lucide-react';
import { getFeatures } from '../../api/features';
import styles from './FeatureDependencyAutocomplete.module.css';

const FeatureDependencyAutocomplete = ({ selected = [], onChange, excludeId }) => {
  const [inputValue, setInputValue] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [allFeatures, setAllFeatures] = useState([]);
  const [truncated, setTruncated] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    getFeatures({ limit: 200 }).then(res => {
      const features = (res.data || []);
      if (excludeId) {
        setAllFeatures(features.filter(f => f.id !== excludeId));
      } else {
        setAllFeatures(features);
      }
      setTruncated(features.length >= 200);
    }).catch(() => setAllFeatures([]));
  }, [excludeId]);

  const filteredSuggestions = useMemo(() => {
    if (!inputValue.trim()) return [];
    const q = inputValue.toLowerCase();
    return allFeatures
      .filter(f => !selected.some(s => s.id === f.id))
      .filter(f => f.title.toLowerCase().includes(q))
      .slice(0, 6);
  }, [inputValue, allFeatures, selected]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [inputValue]);

  const addDep = (feature) => {
    if (!selected.some(s => s.id === feature.id)) {
      onChange([...selected, {
        id: feature.id,
        title: feature.title,
        stage_name: feature.stage_name || feature.status || '--',
        stage_color: feature.stage_color || '#94a3b8',
        owner: feature.owner || '',
        key_stakeholder: feature.key_stakeholder || '',
        gravity_score: feature.gravity_score || 0,
      }]);
    }
    setInputValue('');
    setShowDropdown(false);
  };

  const removeDep = (id) => {
    onChange(selected.filter(s => s.id !== id));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (showDropdown && filteredSuggestions[highlightedIndex]) {
        addDep(filteredSuggestions[highlightedIndex]);
      }
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
        <Search size={14} className={styles.searchIcon} />
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
          onBlur={() => {
            setTimeout(() => setShowDropdown(false), 150);
          }}
          className={styles.input}
          placeholder={selected.length === 0 ? 'Search features to add as dependencies...' : 'Add another dependency...'}
        />
        {selected.length > 0 && (
          <span className={styles.countBadge}>{selected.length}</span>
        )}
      </div>

      {truncated && (
        <div className={styles.truncatedNote}>Showing top 200 features. Use the search to find others.</div>
      )}

      {showDropdown && filteredSuggestions.length > 0 && (
        <div className={styles.dropdown}>
          {filteredSuggestions.map((f, index) => (
            <div
              key={f.id}
              className={`${styles.suggestion} ${index === highlightedIndex ? styles.highlighted : ''}`}
              onMouseDown={(e) => {
                e.preventDefault();
                addDep(f);
              }}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              <span className={styles.suggestionTitle}>{f.title}</span>
              <span className={styles.suggestionMeta}>{f.stage_name || f.status} · gravity {f.gravity_score || 0}</span>
            </div>
          ))}
        </div>
      )}

      {selected.length > 0 && (
        <table className={styles.depsTable}>
          <thead>
            <tr>
              <th className={styles.th}>Name</th>
              <th className={styles.th}>Current Stage</th>
              <th className={styles.th}>Owner</th>
              <th className={styles.th}>Stakeholder</th>
              <th className={styles.th} style={{ textAlign: 'center' }}>Gravity</th>
              <th className={styles.th} style={{ width: 32 }}></th>
            </tr>
          </thead>
          <tbody>
            {selected.map(dep => (
              <tr key={dep.id} className={styles.depRow}>
                <td className={styles.td}>
                  <span className={styles.depTitle}>{dep.title}</span>
                </td>
                <td className={styles.td}>
                  <span className={styles.stagePill} style={{ backgroundColor: `${dep.stage_color || '#94a3b8'}15`, color: dep.stage_color || '#94a3b8' }}>
                    {dep.stage_name || '--'}
                  </span>
                </td>
                <td className={styles.td}>
                  <span className={styles.depMeta}>{dep.owner || '--'}</span>
                </td>
                <td className={styles.td}>
                  <span className={styles.depMeta}>{dep.key_stakeholder || '--'}</span>
                </td>
                <td className={styles.td} style={{ textAlign: 'center' }}>
                  <span className={`${styles.gravityBadge} ${(dep.gravity_score || 0) >= 75 ? styles.gravityHigh : (dep.gravity_score || 0) >= 50 ? styles.gravityMid : styles.gravityLow}`}>
                    {(dep.gravity_score || 0)}
                  </span>
                </td>
                <td className={styles.td}>
                  <button
                    type="button"
                    className={styles.removeRowBtn}
                    onClick={() => removeDep(dep.id)}
                    title="Remove dependency"
                  >
                    <X size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default FeatureDependencyAutocomplete;
