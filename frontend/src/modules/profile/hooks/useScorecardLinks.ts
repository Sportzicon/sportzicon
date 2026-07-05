import { useMutation, useQueryClient } from "@tanstack/react-query";
import { userService } from "../../../services";
import { queryKeys } from "../../../hooks/queryKeys";
import type { ScorecardLink } from "../../../models";

export function useScorecardLinkPreview() {
  return useMutation({
    mutationFn: (url: string) => userService.getScorecardLinkPreview(url),
  });
}

// Persists the full scorecard_links array — caller merges add/remove client-side first.
export function useUpdateScorecardLinks(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (scorecard_links: ScorecardLink[]) => userService.updateAthleteProfile({ scorecard_links }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.user(userId) }),
  });
}
