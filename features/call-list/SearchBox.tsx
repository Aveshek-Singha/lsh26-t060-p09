"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import type { CallListEntry } from "@/lib/domain/priority";

type SuggestionKind = "Owner" | "Vehicle" | "Item";

interface Suggestion {
  value: string;
  kind: SuggestionKind;
  /** How many calls this term would narrow the list to. */
  count: number;
}

const MAX_SUGGESTIONS = 7;

/**
 * Search with a suggestion list.
 *
 * The workshop searches for the thing in front of it — a plate read off a
 * windscreen, a name heard on the phone. Suggestions turn a half-remembered
 * fragment into an exact term, and the count says what you will get before you
 * commit to it.
 *
 * Deliberately not animated: this opens and closes on almost every keystroke,
 * and motion at that frequency reads as lag.
 */
export function SearchBox({
  entries,
  query,
  onQueryChange,
}: {
  entries: CallListEntry[];
  query: string;
  onQueryChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  // One pass over the fleet, not one per keystroke.
  const terms = useMemo(() => {
    // The value is stored on the entry rather than parsed back out of the key:
    // names and plates contain spaces, so splitting a "kind value" key would
    // yield only the first word ("Salma Ahmed" becomes "Salma").
    const counts = new Map<string, Suggestion>();
    const add = (value: string, kind: SuggestionKind) => {
      const key = `${kind} ${value}`;
      const existing = counts.get(key);
      if (existing) existing.count += 1;
      else counts.set(key, { value, kind, count: 1 });
    };

    for (const entry of entries) {
      if (entry.owner) add(entry.owner.name, "Owner");
      for (const { vehicle } of entry.vehicles) add(vehicle.plate, "Vehicle");
      // An item can repeat across an owner's vehicles; count the call once.
      for (const name of new Set(entry.actionable.map((i) => i.itemName))) add(name, "Item");
    }

    return [...counts.values()];
  }, [entries]);

  const suggestions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle === "") return [];

    return terms
      .filter((t) => t.value.toLowerCase().includes(needle))
      .sort((a, b) => {
        // Terms that start with what was typed are what the user meant.
        const aStarts = a.value.toLowerCase().startsWith(needle) ? 0 : 1;
        const bStarts = b.value.toLowerCase().startsWith(needle) ? 0 : 1;
        if (aStarts !== bStarts) return aStarts - bStarts;
        if (b.count !== a.count) return b.count - a.count;
        return a.value.localeCompare(b.value);
      })
      .slice(0, MAX_SUGGESTIONS);
  }, [terms, query]);

  const visible = open && suggestions.length > 0;

  // Reset the highlight whenever the candidates change, or the arrow keys start
  // from a stale row.
  useEffect(() => setActive(-1), [query]);

  useEffect(() => {
    if (!visible) return undefined;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [visible]);

  function choose(value: string) {
    onQueryChange(value);
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!visible) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => (i + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (event.key === "Enter" && active >= 0) {
      event.preventDefault();
      choose(suggestions[active]!.value);
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1 sm:max-w-xs">
      <label htmlFor="call-search" className="sr-only">
        Search by owner, phone, plate, model or item
      </label>
      <input
        id="call-search"
        type="text"
        role="combobox"
        aria-expanded={visible}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        value={query}
        onChange={(event) => {
          onQueryChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search plate, owner, phone or item..."
        className="w-full rounded border border-line bg-surface px-3 py-2 text-sm text-hi placeholder:text-low"
      />

      {visible && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Search suggestions"
          data-suggestions
          className="absolute z-30 mt-1 w-full overflow-hidden rounded border border-line-strong bg-raised shadow-lg"
        >
          {suggestions.map((s, index) => (
            <li key={`${s.kind}-${s.value}`} role="none">
              <button
                type="button"
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                // pointerdown fires before the input blurs, so the choice is not
                // lost to the dismiss handler.
                onPointerDown={(event) => {
                  event.preventDefault();
                  choose(s.value);
                }}
                onMouseEnter={() => setActive(index)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs ${
                  index === active ? "bg-surface text-hi" : "text-mid"
                }`}
              >
                <span className="shrink-0 rounded border border-line px-1 py-0.5 text-[0.8125rem] uppercase tracking-wide text-low">
                  {s.kind}
                </span>
                <Highlighted text={s.value} query={query} />
                <span className="nums ml-auto shrink-0 text-[0.875rem] text-low">
                  {s.count} {s.count === 1 ? "call" : "calls"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Bolds the part of the term the user has actually typed. */
function Highlighted({ text, query }: { text: string; query: string }) {
  const needle = query.trim();
  const at = text.toLowerCase().indexOf(needle.toLowerCase());
  if (needle === "" || at === -1) return <span className="truncate">{text}</span>;

  return (
    <span className="truncate">
      {text.slice(0, at)}
      <mark className="bg-transparent font-semibold text-accent">
        {text.slice(at, at + needle.length)}
      </mark>
      {text.slice(at + needle.length)}
    </span>
  );
}
