import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import type { SearchType } from '@somwave/shared';
import { searchRecords } from '../../features/search/api';

const TYPE_LABELS: Record<SearchType, string> = {
  project: 'Mashruuc',
  task: 'Hawl',
  client: 'Macmiil',
  lead: 'Lead',
  ticket: 'Tigidh',
  invoice: 'Biil',
  user: 'Isticmaale',
  service: 'Adeeg',
  article: 'Maqaal',
  document: 'Dukumeenti',
};

export function GlobalSearch(): ReactNode {
  const [value, setValue] = useState('');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(value.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [value]);

  useEffect(() => {
    function onKey(event: KeyboardEvent): void {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (event.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    function onPointer(event: MouseEvent): void {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, []);

  const results = useQuery({
    queryKey: ['search', query],
    queryFn: () => searchRecords(query),
    enabled: open && query.length >= 2,
  });

  const showPanel = open && value.trim().length >= 2;

  return (
    <div ref={boxRef} className="relative min-w-0 flex-1 sm:max-w-md">
      <label className="relative block">
        <span className="sr-only">Raadi</span>
        <Search
          className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          type="search"
          value={value}
          placeholder="Raadi mashruuc, macmiil, tigidh…"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          className="h-11 w-full rounded-lg border border-border bg-canvas ps-10 pe-16 text-sm text-ink placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          onChange={(event) => {
            setValue(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
        <kbd className="pointer-events-none absolute end-2 top-1/2 hidden -translate-y-1/2 items-center rounded-md border border-border bg-surface px-1.5 py-0.5 text-[11px] font-medium text-muted md:inline-flex">
          ⌘ K
        </kbd>
      </label>
      {showPanel ? (
        <div
          id={listId}
          role="listbox"
          aria-label="Natiijooyinka raadinta"
          className="absolute start-0 top-12 z-40 max-h-80 w-full overflow-y-auto rounded-lg border border-border bg-surface p-1 shadow-md"
        >
          {results.isLoading ? (
            <p className="px-3 py-3 text-sm text-muted">Waa la raadinayaa…</p>
          ) : results.isError ? (
            <p className="px-3 py-3 text-sm text-error">
              Raadinta way fashilantay. Isku day mar kale.
            </p>
          ) : (results.data?.length ?? 0) === 0 ? (
            <p className="px-3 py-3 text-sm text-muted">Wax la mid ah lama helin.</p>
          ) : (
            results.data?.map((hit) => (
              <Link
                key={`${hit.type}-${hit.id}`}
                role="option"
                to={hit.href}
                className="flex min-h-11 flex-col justify-center rounded-md px-3 py-2 hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                onClick={() => {
                  setOpen(false);
                  setValue('');
                  setQuery('');
                }}
              >
                <span className="text-sm font-medium text-ink">{hit.title}</span>
                <span className="text-xs text-muted">
                  {TYPE_LABELS[hit.type]}
                  {hit.subtitle ? ` · ${hit.subtitle}` : ''}
                </span>
              </Link>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
