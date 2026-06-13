import clsx from "clsx";
import { SPORTS_LIST, getPositions } from "../data/sportPositions";

// Paired sport + position selects with cascade behaviour:
//   - changing the sport clears the position immediately
//   - the position select is disabled until a sport is chosen
//   - position options re-render whenever the sport changes
// Use this for every sport/position field pair in the app.

interface SportPositionSelectProps {
  sportValue: string;
  positionValue: string;
  onSportChange: (sport: string) => void;
  onPositionChange: (position: string) => void;
  sportError?: string;
  positionError?: string;
  disabled?: boolean;
  required?: boolean;
  layout?: "row" | "column";
}

export function SportPositionSelect({
  sportValue,
  positionValue,
  onSportChange,
  onPositionChange,
  sportError,
  positionError,
  disabled = false,
  required = false,
  layout = "row",
}: SportPositionSelectProps) {
  const positions = getPositions(sportValue);

  function handleSportChange(next: string) {
    // Cascade: a new sport invalidates the previous position — clear it now.
    onSportChange(next);
    onPositionChange("");
  }

  return (
    <div
      className={clsx(
        "grid grid-cols-1 gap-4",
        // Mobile is always single column regardless of layout prop.
        layout === "row" && "sm:grid-cols-2",
      )}
    >
      <div>
        <label className="label">
          Sport{required && <span className="text-red-600"> *</span>}
        </label>
        <select
          className={clsx("input min-h-[44px]", sportError && "border-red-500 focus:border-red-500")}
          value={sportValue}
          onChange={(e) => handleSportChange(e.target.value)}
          disabled={disabled}
          required={required}
        >
          <option value="">Select sport</option>
          {SPORTS_LIST.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        {sportError && <p className="field-error">{sportError}</p>}
      </div>

      <div>
        <label className="label">
          Position{required && <span className="text-red-600"> *</span>}
        </label>
        <select
          className={clsx("input min-h-[44px]", positionError && "border-red-500 focus:border-red-500")}
          value={positionValue}
          onChange={(e) => onPositionChange(e.target.value)}
          disabled={disabled || !sportValue}
          required={required}
        >
          <option value="">Select position</option>
          {positions.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        {positionError && <p className="field-error">{positionError}</p>}
      </div>
    </div>
  );
}
