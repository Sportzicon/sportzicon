import { useEffect, useState } from "react";
import { MobileDrawer } from "../../../components/MobileDrawer";
import { humanizeError } from "../../../api/client";
import type { ScorecardLink, ScorecardPreview } from "../../../models";

interface AddScorecardLinkDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ScorecardLink) => void;
  onPreview: (url: string) => Promise<ScorecardPreview>;
  isSubmitting: boolean;
  editing?: ScorecardLink | null;
}

export function AddScorecardLinkDrawer({ isOpen, onClose, onSubmit, onPreview, isSubmitting, editing }: AddScorecardLinkDrawerProps) {
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setUrl(editing?.url ?? "");
    setLabel(editing?.label ?? "");
    setError(null);
  }, [isOpen, editing]);

  if (!isOpen) return null;

  const isEditing = !!editing;

  const isValidUrl = (() => {
    try {
      const u = new URL(url);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  })();

  const preview: ScorecardPreview | null =
    editing && editing.url === url
      ? { source: editing.source ?? new URL(editing.url).hostname.replace(/^www\./, ""), title: editing.preview_title ?? null, image: editing.preview_image ?? null }
      : null;

  const save = async () => {
    if (!isValidUrl) return;
    setError(null);
    setSaving(true);
    try {
      const result = preview ?? (await onPreview(url.trim()));
      onSubmit({
        url: url.trim(),
        label: label.trim() || undefined,
        source: result.source,
        preview_title: result.title ?? undefined,
        preview_image: result.image ?? undefined,
      });
    } catch (err) {
      setError(humanizeError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <MobileDrawer isOpen={isOpen} onClose={onClose} title={isEditing ? "Edit scorecard link" : "Add scorecard link"}>
      <div className="space-y-3">
        <div>
          <label className="lab">Scorecard / scoring-app URL *</label>
          <input
            className="input mt-1 min-h-[44px]"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://cricheroes.in/scorecard/…"
            maxLength={500}
          />
        </div>
        <div>
          <label className="lab">Label (optional)</label>
          <input className="input mt-1 min-h-[44px]" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Final vs Rivals CC" maxLength={120} />
        </div>
        {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">{error}</div>}
        <div className="flex gap-2">
          <button onClick={onClose} disabled={isSubmitting || saving} className="btn-secondary flex-1 min-h-[44px] disabled:opacity-50">
            Cancel
          </button>
          <button onClick={save} disabled={!isValidUrl || isSubmitting || saving} className="btn-primary flex-1 min-h-[44px] disabled:opacity-50">
            {isSubmitting || saving ? "Saving…" : isEditing ? "Save changes" : "Add to profile"}
          </button>
        </div>
      </div>
    </MobileDrawer>
  );
}
