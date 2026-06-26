import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

interface BackButtonProps {
  to?: string;
  label?: string;
  className?: string;
}

export function BackButton({ to, label = "Back", className = "" }: BackButtonProps) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => (to ? navigate(to) : navigate(-1))}
      className={`flex items-center gap-1.5 text-sm text-ink-sub hover:text-ink transition min-h-[44px] ${className}`}
    >
      <ChevronLeft className="h-4 w-4 flex-shrink-0" />
      {label}
    </button>
  );
}
