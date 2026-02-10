'use client';

import { useState, useRef, useEffect } from 'react';

interface Option {
  value: string;
  label: string;
  subtitle?: string;
}

interface SearchSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function SearchSelect({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  className = '',
}: SearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = options.filter(
    (o) =>
      o.label.toLowerCase().includes(search.toLowerCase()) ||
      o.value.toLowerCase().includes(search.toLowerCase()) ||
      (o.subtitle || '').toLowerCase().includes(search.toLowerCase())
  );

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="input text-xs w-full text-left truncate flex items-center justify-between gap-1"
      >
        <span className={selected ? '' : 'text-[var(--muted)]'}>
          {selected ? selected.label : placeholder}
        </span>
        <svg className="w-3 h-3 shrink-0 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-xl max-h-48 overflow-hidden">
          <div className="p-1.5">
            <input
              type="text"
              className="input text-xs w-full"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="overflow-y-auto max-h-32">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs text-[var(--muted)]">No results</div>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                    setSearch('');
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--sidebar-hover)] ${
                    o.value === value ? 'bg-[var(--primary-light)] text-[var(--primary)]' : ''
                  }`}
                >
                  <div className="font-medium truncate">{o.label}</div>
                  {o.subtitle && (
                    <div className="text-[10px] text-[var(--muted)] truncate">{o.subtitle}</div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
