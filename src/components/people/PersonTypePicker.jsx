import { useId, useMemo, useState } from 'react';
import { PERSON_GROUP_LABELS, PERSON_GROUP_ORDER } from '../../models/people';
import { withFieldError } from '../shared/FormField';

// Searchable dropdown of the org's person types, listed under each type's
// default Group. It only reports the pick (a type object, or null to clear);
// callers decide what to pre-fill from it.
export default function PersonTypePicker({ types, value, onChange, hasError = false, disabled = false, id }) {
  const listId = useId();
  const [open, setOpen]     = useState(false);
  const [search, setSearch] = useState('');
  const [active, setActive] = useState(0);

  const selected = types.find(t => t.id === value) || null;

  const sections = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matches = types
      .filter(t => !q || (t.label || '').toLowerCase().includes(q))
      .sort((a, b) => (a.label || '').localeCompare(b.label || '', undefined, { sensitivity: 'base' }));
    const groupOf = t => (PERSON_GROUP_ORDER.includes(t.defaultGroup) ? t.defaultGroup : null);
    return [...PERSON_GROUP_ORDER, null]
      .map(group => ({
        group,
        heading: group ? PERSON_GROUP_LABELS[group] : 'Other',
        types: matches.filter(t => groupOf(t) === group),
      }))
      .filter(s => s.types.length > 0);
  }, [types, search]);

  const flat = sections.flatMap(s => s.types);

  function openList() {
    if (disabled) return;
    setSearch('');
    setActive(0);
    setOpen(true);
  }

  function pick(type) {
    onChange(type);
    setOpen(false);
    setSearch('');
  }

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) { openList(); return; }
      setActive(i => Math.min(i + 1, flat.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (open && flat[active]) {
        e.preventDefault();
        pick(flat[active]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  const optionId = i => `${listId}-opt-${i}`;
  let index = -1;

  return (
    <div className="relative">
      <div className="relative">
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && flat[active] ? optionId(active) : undefined}
          value={open ? search : (selected?.label || '')}
          onChange={e => { setSearch(e.target.value); setActive(0); if (!open) setOpen(true); }}
          onFocus={openList}
          onClick={() => { if (!open) openList(); }}
          onBlur={() => setOpen(false)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={selected ? selected.label : 'Search person types...'}
          className={withFieldError('w-full border border-gray-300 rounded-lg pl-3 pr-9 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-places-blue disabled:opacity-50', hasError)}
        />
        {selected && !open && !disabled && (
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="Clear person type"
            className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-600"
          >
            ×
          </button>
        )}
      </div>

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg py-1"
        >
          {flat.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-400">
              {types.length === 0 ? 'No person types yet. Add them in Settings.' : 'No matching types.'}
            </li>
          ) : sections.map(section => (
            <li key={section.heading} role="presentation">
              <p className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                {section.heading}
              </p>
              <ul role="presentation">
                {section.types.map(type => {
                  index += 1;
                  const i = index;
                  const isActive = i === active;
                  const isSelected = type.id === value;
                  return (
                    <li
                      key={type.id}
                      id={optionId(i)}
                      role="option"
                      aria-selected={isSelected}
                      // Keep focus in the input so its blur doesn't close the
                      // list before the click lands.
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => pick(type)}
                      onMouseEnter={() => setActive(i)}
                      className={`px-3 py-2 text-sm cursor-pointer ${isActive ? 'bg-places-blue/10' : ''} ${isSelected ? 'font-medium text-places-blue' : 'text-gray-800'}`}
                    >
                      {type.label}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
