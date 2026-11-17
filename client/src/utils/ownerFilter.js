// Owner is free text on a feature, so the same person can be typed as "Priya Shah",
// "priya shah " or "PRIYA SHAH". Filter on a normalised key so they count as one owner.
export const NO_OWNER = '__no_owner__';

export const normalizeOwner = (owner) => (typeof owner === 'string' ? owner.trim().toLowerCase() : '');

export const ownerKey = (owner) => normalizeOwner(owner) || NO_OWNER;

/** Dropdown options: one per distinct owner (alphabetical), plus "No owner" first if any feature has none. */
export function buildOwnerOptions(features) {
  const labels = new Map();
  let hasUnowned = false;

  for (const feature of features) {
    const key = ownerKey(feature.owner);
    if (key === NO_OWNER) {
      hasUnowned = true;
    } else if (!labels.has(key)) {
      labels.set(key, feature.owner.trim());
    }
  }

  const named = [...labels]
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));

  return hasUnowned ? [{ id: NO_OWNER, label: 'No owner' }, ...named] : named;
}

export const matchesOwnerFilter = (feature, selectedKeys) =>
  selectedKeys.length === 0 || selectedKeys.includes(ownerKey(feature.owner));

// Owner names can contain commas ("Shah, Priya"), so each key is encoded before joining.
export const formatOwnerParam = (keys) => keys.map(encodeURIComponent).join(',');

export const parseOwnerParam = (param) =>
  param
    ? param.split(',').filter(Boolean).map((part) => {
        try { return decodeURIComponent(part); } catch { return part; }
      })
    : [];
