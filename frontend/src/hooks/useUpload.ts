import { useState, useCallback, useRef } from "react";
import { api, humanizeError } from "../api/client";

export type UploadContext = "avatar" | "post" | "reel" | "blog-cover" | "org-logo" | "org-doc";

export const MAX_SIZE_MB: Record<UploadContext, number> = {
  avatar: 5,
  post: 10,
  "blog-cover": 10,
  "org-logo": 10,
  reel: 200,
  "org-doc": 20,
};

export const ACCEPT_BY_CONTEXT: Record<UploadContext, string> = {
  avatar: "image/jpeg,image/png,image/webp,image/gif",
  post: "image/jpeg,image/png,image/webp,image/gif",
  "blog-cover": "image/jpeg,image/png,image/webp",
  "org-logo": "image/jpeg,image/png,image/webp",
  reel: "video/mp4,video/webm,video/quicktime",
  "org-doc": "application/pdf",
};

interface UseUploadOptions {
  context: UploadContext;
  /** Override the default max size for this context */
  maxSizeMB?: number;
  onSuccess?: (mediaUrl: string) => void;
}

interface UseUploadResult {
  upload: (file: File) => Promise<void>;
  retry: (() => Promise<void>) | undefined;
  progress: number;
  isUploading: boolean;
  error: string | null;
  reset: () => void;
}

export function useUpload({ context, maxSizeMB, onSuccess }: UseUploadOptions): UseUploadResult {
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savedFile = useRef<File | null>(null);

  const reset = useCallback(() => {
    setProgress(0);
    setIsUploading(false);
    setError(null);
    savedFile.current = null;
  }, []);

  const upload = useCallback(
    async (file: File) => {
      // a. Client-side validation before touching the network
      const effectiveMaxMB = maxSizeMB ?? MAX_SIZE_MB[context];
      const allowedTypes = ACCEPT_BY_CONTEXT[context].split(",");

      if (!allowedTypes.includes(file.type)) {
        setError(`File type "${file.type}" is not supported.`);
        return;
      }
      if (file.size > effectiveMaxMB * 1024 * 1024) {
        setError(
          `File must be under ${effectiveMaxMB}MB. Your file is ${(file.size / 1024 / 1024).toFixed(1)}MB.`,
        );
        return;
      }

      savedFile.current = file;
      setIsUploading(true);
      setError(null);
      setProgress(0);

      try {
        // b. Get signed upload URL
        const urlRes = await api.post<{
          upload_url: string;
          headers: Record<string, string>;
          object_name: string;
          public_url?: string;
        }>("/media/upload-url", {
          fileName: file.name,
          contentType: file.type,
          context,
        });
        const { upload_url, headers, object_name } = urlRes.data;

        // c. PUT directly to GCS with XHR for progress tracking
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.upload.addEventListener("progress", (e) => {
            if (e.lengthComputable) {
              setProgress(Math.round((e.loaded / e.total) * 100));
            }
          });
          xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error(`Upload failed with status ${xhr.status}`));
          });
          xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
          xhr.open("PUT", upload_url);
          Object.entries(headers ?? {}).forEach(([k, v]) => xhr.setRequestHeader(k, v));
          xhr.send(file);
        });

        // d. Confirm file landed in GCS
        const confirmRes = await api.post<{ url: string | null }>("/media/confirm", {
          key: object_name,
          context,
        });

        // e. Call onSuccess with the public URL (or the key for private contexts)
        const mediaUrl = confirmRes.data.url ?? object_name;
        onSuccess?.(mediaUrl);
        setProgress(100);
      } catch (e) {
        setError(humanizeError(e));
      } finally {
        setIsUploading(false);
      }
    },
    [context, maxSizeMB, onSuccess],
  );

  const retry = savedFile.current
    ? () => upload(savedFile.current!)
    : undefined;

  return { upload, retry, progress, isUploading, error, reset };
}
