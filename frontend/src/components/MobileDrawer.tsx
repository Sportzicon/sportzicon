import { type ReactNode, useEffect } from "react";
import clsx from "clsx";

// Bottom-sheet drawer for mobile filters and forms.
//   - Mobile (< lg): slides up from the bottom, full width, scrollable.
//   - Desktop (lg+): renders children inline with no drawer chrome.

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function MobileDrawer({ isOpen, onClose, title, children }: MobileDrawerProps) {
  // Lock background scroll while the sheet is open on mobile.
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  return (
    <>
      {/* Mobile bottom sheet */}
      <div className="lg:hidden" aria-hidden={!isOpen}>
        {/* Backdrop */}
        <div
          className={clsx(
            "fixed inset-0 z-40 bg-black/40 transition-opacity duration-300",
            isOpen ? "opacity-100" : "pointer-events-none opacity-0",
          )}
          onClick={onClose}
        />
        {/* Sheet */}
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className={clsx(
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-2xl bg-panel shadow-card transition-transform duration-300 ease-out",
            "pb-[env(safe-area-inset-bottom)]",
            isOpen ? "translate-y-0" : "translate-y-full",
          )}
        >
          {/* Drag handle */}
          <div className="flex shrink-0 justify-center pt-3">
            <span className="h-1.5 w-10 rounded-full bg-hair" />
          </div>
          <div className="flex shrink-0 items-center justify-between border-b border-hair px-4 py-3">
            <h2 className="font-disp text-lg text-ink">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-11 min-h-[44px] w-11 items-center justify-center text-ink-sub hover:text-ink"
            >
              ✕
            </button>
          </div>
          <div className="overflow-y-auto p-4">{children}</div>
        </div>
      </div>

      {/* Desktop: render inline, no drawer */}
      <div className="hidden lg:block">{children}</div>
    </>
  );
}
