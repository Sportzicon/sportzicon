import { useRef, useState, useEffect } from "react";
import clsx from "clsx";
import { Video, X } from "lucide-react";
import { useUpload, ACCEPT_BY_CONTEXT } from "../hooks/useUpload";
import { Spinner } from "./UI";

interface VideoUploadProps {
  value?: string;
  onChange: (url: string) => void;
  className?: string;
}

export function VideoUpload({ value, onChange, className }: VideoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { upload, retry, progress, isUploading, error, reset } = useUpload({
    context: "reel",
    onSuccess: (url) => {
      onChange(url);
    },
  });

  // Create object URL for local preview before upload completes
  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    // Client-side size check with clear message before calling the hook
    if (file.size > 200 * 1024 * 1024) {
      alert(`Video must be under 200MB. Your file is ${(file.size / 1024 / 1024).toFixed(1)}MB.`);
      return;
    }

    setSelectedFile(file);
    upload(file);
  }

  function handleClear() {
    reset();
    setSelectedFile(null);
    setPreviewUrl(null);
  }

  const fileSizeMB = selectedFile ? (selectedFile.size / 1024 / 1024).toFixed(1) : null;

  return (
    <div className={clsx("w-full", className)}>
      <div
        className={clsx(
          "relative w-full rounded-lg border-2 border-dashed transition",
          "overflow-hidden",
          value || previewUrl ? "border-hair" : "border-hair hover:border-brand-500",
        )}
        style={{ minHeight: "200px" }}
      >
        {/* Video preview */}
        {(previewUrl || value) && !isUploading && (
          <>
            <video
              src={previewUrl ?? value}
              className="h-full w-full object-cover"
              style={{ maxHeight: "320px" }}
              controls={!isUploading}
              loop
              muted
              playsInline
            />
            <button
              type="button"
              onClick={handleClear}
              className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
              aria-label="Remove video"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        )}

        {/* Upload in progress */}
        {isUploading && (
          <div className="flex flex-col items-center justify-center gap-3 p-8">
            <Spinner className="h-8 w-8 text-brand-500" />
            <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-fill">
              <div
                className="h-full rounded-full bg-brand-500 transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="text-center text-sm text-ink-sub">
              <span className="font-medium">{progress}%</span>
              {fileSizeMB && <span className="ml-2">· {fileSizeMB}MB</span>}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!value && !previewUrl && !isUploading && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-2 py-12 px-4 text-center"
            aria-label="Upload video"
          >
            <Video className="h-10 w-10 text-ink-sub" />
            <span className="text-sm font-medium text-ink">Tap to select video</span>
            <span className="text-xs text-ink-sub">MP4, WebM, or MOV · max 200MB</span>
          </button>
        )}
      </div>

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

      {/* Change button when video is already set */}
      {(value || previewUrl) && !isUploading && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-2 text-sm font-medium text-brand-500 hover:underline"
        >
          Change video
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_BY_CONTEXT["reel"]}
        capture="environment"
        onChange={handleFileChange}
        className="sr-only"
        aria-hidden="true"
      />
    </div>
  );
}
