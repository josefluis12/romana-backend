import { Search } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";

export interface ComboboxOption {
  id: string;
  label: string;
}

interface Props {
  id: string;
  label: string;
  value: string;
  options: ComboboxOption[];
  placeholder: string;
  wide?: boolean;
  onChange: (value: string) => void;
  onSelect: (option: ComboboxOption) => void;
}

export function SearchCombobox({ id, label, value, options, placeholder, wide = false, onChange, onSelect }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const listboxId = `${id}-suggestions`;

  useEffect(() => {
    function close(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  useEffect(() => setHighlighted(0), [options]);

  function choose(option: ComboboxOption) {
    onSelect(option);
    setOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") return setOpen(false);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setHighlighted((current) => Math.min(current + 1, options.length - 1));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted((current) => Math.max(current - 1, 0));
    }
    if (event.key === "Enter" && open && options[highlighted]) {
      event.preventDefault();
      choose(options[highlighted]);
    }
  }

  return (
    <div className={`grid gap-2 text-sm font-bold text-[#4b4944] ${wide ? "md:col-span-2" : ""}`} ref={root}>
      <label htmlFor={id}>{label}</label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-[var(--muted)]" aria-hidden="true" />
        <input
          className={`h-11 w-full border border-[#cbc7bd] bg-white py-2 pl-10 pr-3 outline-none focus:border-[var(--red)] focus:ring-1 focus:ring-[var(--red)] ${open ? "rounded-t" : "rounded"}`}
          id={id}
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={open}
          aria-activedescendant={open && options[highlighted] ? `${id}-option-${options[highlighted].id}` : undefined}
          autoComplete="off"
          required
          value={value}
          placeholder={placeholder}
          onChange={(event) => { onChange(event.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />
        {open && (
          <div className="absolute inset-x-0 top-full z-30 max-h-60 overflow-y-auto rounded-b border border-t-0 border-[#cbc7bd] bg-white shadow-lg" id={listboxId} role="listbox">
            {options.length ? options.map((option, index) => (
              <button
                className={`block w-full px-4 py-3 text-left text-sm ${index === highlighted ? "bg-[#f7e9e9] text-[var(--red)]" : "bg-white text-[#34322e] hover:bg-[#f5f3ee]"}`}
                id={`${id}-option-${option.id}`}
                key={option.id}
                type="button"
                role="option"
                aria-selected={index === highlighted}
                onMouseEnter={() => setHighlighted(index)}
                onMouseDown={(event) => { event.preventDefault(); choose(option); }}
              >
                {option.label}
              </button>
            )) : <p className="m-0 px-4 py-3 font-normal text-[var(--muted)]">No matching results</p>}
          </div>
        )}
      </div>
    </div>
  );
}
