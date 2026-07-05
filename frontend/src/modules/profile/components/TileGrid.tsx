import type { ReactNode } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

// Generic add/remove tile grid — shared by the Tournaments and Scorecard
// Links profile zones. Matches the existing "Editorial Workstation" card
// skin (see components/UI.tsx) rather than introducing a new visual style.
interface TileGridProps<T> {
  items: T[];
  renderTile: (item: T, index: number) => ReactNode;
  onAdd?: () => void;
  onEdit?: (item: T, index: number) => void;
  onDelete?: (index: number) => void;
  maxItems: number;
  emptyIcon: string;
  emptyLabel: string;
  emptyHint?: string;
}

export function TileGrid<T>({ items, renderTile, onAdd, onEdit, onDelete, maxItems, emptyIcon, emptyLabel, emptyHint }: TileGridProps<T>) {
  if (items.length === 0 && !onAdd) {
    return (
      <div className="card card-body text-center border-dashed">
        <div className="text-3xl text-ink-faint mb-2">{emptyIcon}</div>
        <div className="lab text-ink-faint">{emptyLabel}</div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="card card-body text-center border-dashed">
        <div className="text-3xl text-ink-faint mb-2">{emptyIcon}</div>
        <div className="lab text-ink-faint">{emptyLabel}</div>
        {emptyHint && <p className="text-[12.5px] text-ink-sub mt-1">{emptyHint}</p>}
        {onAdd && (
          <button onClick={onAdd} className="btn-secondary mt-3 mx-auto min-h-[44px]">
            + Add
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {items.map((item, i) => (
        <div key={i} className="card card-body relative">
          {(onEdit || onDelete) && (
            <div className="absolute right-1.5 top-1.5 flex items-center gap-0.5">
              {onEdit && (
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(item, i); }}
                  aria-label="Edit"
                  className="flex h-8 w-8 items-center justify-center text-ink-faint hover:text-ink transition"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(i); }}
                  aria-label="Delete"
                  className="flex h-8 w-8 items-center justify-center text-ink-faint hover:text-red-500 transition"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
          {renderTile(item, i)}
        </div>
      ))}
      {onAdd && items.length < maxItems && (
        <button
          onClick={onAdd}
          className="card border-dashed flex min-h-[110px] flex-col items-center justify-center gap-1.5 text-ink-faint hover:text-ink hover:border-ink transition"
        >
          <Plus className="h-5 w-5" />
          <span className="lab">Add</span>
        </button>
      )}
    </div>
  );
}
