import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { userService } from "../../../services";
import { queryKeys } from "../../../hooks/queryKeys";

export function useDocuments(userId: string, enabled: boolean) {
  const qc = useQueryClient();
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const docsQ = useQuery({
    queryKey: queryKeys.userDocs(userId),
    queryFn: () => userService.getDocuments(userId),
    enabled,
  });

  const uploadDoc = useMutation({
    mutationFn: ({ file, type }: { file: File; type: string }) => {
      setUploadProgress(0);
      return userService.uploadDocument(userId, file, type, setUploadProgress);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.userDocs(userId) });
      setUploadProgress(null);
    },
    onError: () => setUploadProgress(null),
  });

  const deleteDoc = useMutation({
    mutationFn: (docId: string) => userService.deleteDocument(userId, docId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.userDocs(userId) }),
  });

  return { docsQ, uploadDoc, deleteDoc, uploadProgress };
}
