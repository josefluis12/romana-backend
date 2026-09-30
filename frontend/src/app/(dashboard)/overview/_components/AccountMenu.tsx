import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, LogOut, UserRound } from "lucide-react";
import type { AuthenticatedUser } from "../../../../types/auth";

interface AccountMenuProps {
  user: AuthenticatedUser;
  loggingOut: boolean;
  onSignOut: () => void;
}

export function AccountMenu({ user, loggingOut, onSignOut }: AccountMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!isOpen) return;

    function closeOnOutsideClick(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className="flex h-11 items-center gap-2 rounded-full border border-stone-300 bg-white p-1 pr-2 text-stone-700 shadow-sm transition hover:border-stone-400 hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c82028]"
        aria-label="Open profile menu"
        aria-controls={menuId}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="grid size-8 place-items-center rounded-full bg-[#c82028] text-white">
          <UserRound className="size-4" aria-hidden="true" />
        </span>
        <ChevronDown
          className={`size-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div
          id={menuId}
          className="absolute right-0 z-30 mt-2 w-64 overflow-hidden rounded-md border border-stone-200 bg-white shadow-xl"
          role="menu"
        >
          <div className="border-b border-stone-200 px-4 py-3">
            <p className="m-0 truncate text-sm font-semibold text-stone-900">
              {user.name}
            </p>
            <p className="mt-1 mb-0 truncate text-xs text-stone-500">
              {user.email}
            </p>
          </div>
          <div className="p-1.5">
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-sm px-3 py-2.5 text-left text-sm font-semibold text-[#9f171d] transition hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-[#c82028] disabled:cursor-wait disabled:opacity-70"
              role="menuitem"
              onClick={onSignOut}
              disabled={loggingOut}
            >
              <LogOut className="size-4" aria-hidden="true" />
              <span>{loggingOut ? "Signing out..." : "Sign out"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
