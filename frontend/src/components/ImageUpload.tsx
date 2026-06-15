import { useRef } from "react";
import clsx from "clsx";
import { Camera } from "lucide-react";
import { useUpload, type UploadContext, ACCEPT_BY_CONTEXT } from "../hooks/useUpload";
import { Spinner } from "./UI";

interface ImageUploadProps {
  value?: string;
  onChange: (url: string) => void;
  context: UploadContext;
  label?: string;
  /** CSS aspect-ratio value, e.g. "1/1" or "16/9" */
  aspectRatio?: string;
  className?: string;
}

export function ImageUpload({
  value,
  onChange,
  context,
  label,
  aspectRatio = "1/1",
  className,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const { upload, retry, progress, isUploading, error, reset } = useUpload({
    context,
    onSuccess: onChange,
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset value so the same file can be re-selected if needed
    e.target.value = "";
    upload(file);
  }

  return (
    <div className={clsx("w-full", className)}>
      {label && <p className="label mb-1">{label}</p>}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={isUploading}
        className={clsx(
          "relative w-full min-h-[120px] rounded-lg border-2 border-dashed transition",
          "flex items-center justify-center overflow-hidden",
          value ? "border-hair" : "border-hair hover:border-brand-500",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
        )}
        style={{ aspectRatio }}
        aria-label={label ?? "Upload image"}
      >
        {/* Preview */}
        {value && !isUploading && (
          <>
            <img
              src={value}
              alt="Upload preview"
              className="absolute inset-0 h-full w-full object-cover"
            />
            {/* "Change" overlay on hover/focus */}
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 opacity-0 transition-opacity hover:opacity-100 focus:opacity-100">
              <Camera className="h-6 w-6 text-white" />
              <span className="mt-1 text-sm font-medium text-white">Change</span>
            </div>
          </>
        )}

        {/* Upload in progress */}
        {isUploading && (
          <div className="flex w-full flex-col items-center gap-2 px-4">
            <Spinner className="text-brand-500" />
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-fill">
              <div
                className="h-full rounded-full bg-brand-500 transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs text-ink-sub">{progress}%</span>
          </div>
        )}

        {/* Empty state */}
        {!value && !isUploading && (
          <div className="flex flex-col items-center gap-2 py-6 px-4 text-center">
            <Camera className="h-8 w-8 text-ink-sub" />
            <span className="text-sm text-ink-sub">Tap to upload</span>
          </div>
        )}
      </button>

      {/* Error state */}
      {error && (
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-sm text-red-600">{error}</p>
          {retry && (
            <button
              type="button"
              onClick={() => { reset(); retry(); }}
              className="shrink-0 text-sm font-medium text-brand-500 hover:underline"
            >
              Retry
            </button>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_BY_CONTEXT[context]}
        capture="environment"
        onChange={handleFileChange}
        className="sr-only"
        aria-hidden="true"
      />
    </div>
  );
}
