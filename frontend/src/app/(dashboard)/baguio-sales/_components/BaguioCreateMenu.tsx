import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, PackagePlus, Plus, Route, type LucideIcon } from "lucide-react";

export function BaguioCreateMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!isOpen) return;

    function closeOnOutsideClick(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setIsOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  function openSubview(path: "new-order" | "new-dispatch") {
    setIsOpen(false);
    window.location.hash = `baguio-sales/${path}`;
  }

  return (
    <div className="relative ml-auto" ref={containerRef}>
      <button
        ref={triggerRef}
        className="primary-button compact-button"
        type="button"
        aria-controls={menuId}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={() => setIsOpen((open) => !open)}
      >
        <Plus aria-hidden="true" />
        <span>Add</span>
        <ChevronDown className={`size-4 transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      {isOpen && (
        <div id={menuId} className="absolute right-0 z-30 mt-2 w-52 rounded-md border border-stone-200 bg-white p-1.5 shadow-xl" role="menu">
          <MenuOption icon={PackagePlus} label="New order" onSelect={() => openSubview("new-order")} />
          <MenuOption icon={Route} label="New dispatch" onSelect={() => openSubview("new-dispatch")} />
        </div>
      )}
    </div>
  );
}

function MenuOption({ icon: Icon, label, onSelect }: {
  icon: LucideIcon;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      className="flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-left text-sm font-semibold text-stone-700 transition hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-[#c82028]"
      type="button"
      role="menuitem"
      onClick={onSelect}
    >
      <Icon className="size-4 text-[#c82028]" aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}
