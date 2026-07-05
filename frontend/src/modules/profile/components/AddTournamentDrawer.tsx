import { useEffect, useState } from "react";
import { MobileDrawer } from "../../../components/MobileDrawer";
import type { NewTournament, Tournament } from "../../../models";

interface AddTournamentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: NewTournament) => void;
  isSubmitting: boolean;
  error?: string | null;
  editing?: Tournament | null;
}

export function AddTournamentDrawer({ isOpen, onClose, onSubmit, isSubmitting, error, editing }: AddTournamentDrawerProps) {
  const [name, setName] = useState("");
  const [year, setYear] = useState("");
  const [team, setTeam] = useState("");
  const [format, setFormat] = useState("");
  const [result, setResult] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setName(editing?.name ?? "");
    setYear(editing?.year ?? "");
    setTeam(editing?.team ?? "");
    setFormat(editing?.format ?? "");
    setResult(editing?.result ?? "");
  }, [isOpen, editing]);

  if (!isOpen) return null;

  const isEditing = !!editing;
  const canSubmit = name.trim().length > 0 && /^\d{4}$/.test(year.trim());

  const submit = () => {
    if (!canSubmit) return;
    onSubmit({
      name: name.trim(),
      year: year.trim(),
      team: team.trim() || undefined,
      format: format.trim() || undefined,
      result: result.trim() || undefined,
    });
  };

  return (
    <MobileDrawer isOpen={isOpen} onClose={onClose} title={isEditing ? "Edit tournament" : "Add tournament"}>
      <div className="space-y-3">
        <div>
          <label className="lab">Tournament name *</label>
          <input className="input mt-1 min-h-[44px]" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. State U-19 Championship" maxLength={200} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="lab">Year *</label>
            <input className="input mt-1 min-h-[44px]" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} placeholder="2024" maxLength={4} />
          </div>
          <div>
            <label className="lab">Team</label>
            <input className="input mt-1 min-h-[44px]" value={team} onChange={(e) => setTeam(e.target.value)} placeholder="e.g. Mumbai CC" maxLength={120} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="lab">Format</label>
            <input className="input mt-1 min-h-[44px]" value={format} onChange={(e) => setFormat(e.target.value)} placeholder="e.g. T20" maxLength={60} />
          </div>
          <div>
            <label className="lab">Result / role</label>
            <input className="input mt-1 min-h-[44px]" value={result} onChange={(e) => setResult(e.target.value)} placeholder="e.g. Winner, top scorer" maxLength={200} />
          </div>
        </div>
        {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">{error}</div>}
        <div className="flex gap-2">
          <button onClick={onClose} disabled={isSubmitting} className="btn-secondary flex-1 min-h-[44px] disabled:opacity-50">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!canSubmit || isSubmitting}
            className="btn-primary flex-1 min-h-[44px] disabled:opacity-50"
          >
            {isSubmitting ? "Saving…" : isEditing ? "Save changes" : "Add tournament"}
          </button>
        </div>
      </div>
    </MobileDrawer>
  );
}
