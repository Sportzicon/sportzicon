import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { documentAccessService } from "../../../services";
import { queryKeys } from "../../../hooks/queryKeys";

export function useMyAccessStatus(athleteId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.docAccessMyStatus(athleteId),
    queryFn: () => documentAccessService.getMyStatus(athleteId),
    enabled,
  });
}

export function useRequestDocAccess(athleteId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (reason?: string) => documentAccessService.requestAccess(athleteId, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.docAccessMyStatus(athleteId) }),
  });
}

export function useDocAccessRequests(athleteId: string, status?: string) {
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: queryKeys.docAccessForAthlete(athleteId, status),
    queryFn: () => documentAccessService.listForAthlete(athleteId, status),
    enabled: !!athleteId,
  });

  const decide = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "approved" | "rejected" | "revoked" }) =>
      documentAccessService.decide(id, status),
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.docAccessForAthlete(athleteId) }),
  });

  return { list, decide };
}
