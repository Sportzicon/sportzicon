import { useRef, useState, KeyboardEvent } from "react";
import { X } from "lucide-react";

export const SPORTS = [
  "", "Cricket", "Football", "Basketball", "Swimming", "Athletics",
  "Hockey", "Tennis", "Badminton", "Volleyball", "Kabaddi", "Wrestling", "Boxing", "Other",
];

export function Field({ label, children, hint, error }: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  error?: string;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="lab mt-1.5 block normal-case tracking-normal text-[10.5px]">{hint}</span>}
      {error && <span className="text-red-600 text-[11px] mt-1 block">{error}</span>}
    </label>
  );
}

const MAX_TAGS = 10;
const MAX_TAG_LEN = 30;

export function TagInput({
  tags,
  onChange,
  error,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  error?: string;
}) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function addTag(raw: string) {
    const val = raw.trim().toLowerCase().replace(/\s+/g, "-").slice(0, MAX_TAG_LEN);
    if (!val || tags.includes(val) || tags.length >= MAX_TAGS) return;
    onChange([...tags, val]);
    setInput("");
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag));
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input);
    } else if (e.key === "Backspace" && !input && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  }

  return (
    <div>
      <div
        className={`input flex flex-wrap gap-1.5 min-h-[44px] cursor-text ${error ? "border-red-500" : ""}`}
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 bg-ink text-paper text-[11px] rounded px-2 py-0.5"
          >
            #{tag}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
              className="hover:text-red-300 transition"
              aria-label={`Remove ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {tags.length < MAX_TAGS && (
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={() => { if (input.trim()) addTag(input); }}
            placeholder={tags.length === 0 ? "Type a tag and press Enter…" : "Add another…"}
            className="flex-1 min-w-[120px] bg-transparent outline-none text-[13px] text-ink placeholder:text-ink-faint"
          />
        )}
      </div>
      <p className="lab mt-1 normal-case tracking-normal text-[10.5px]">
        {tags.length}/{MAX_TAGS} tags · Press Enter or comma to add
      </p>
      {error && <span className="text-red-600 text-[11px] mt-1 block">{error}</span>}
    </div>
  );
}
