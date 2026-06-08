import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { applicationService, opportunityService } from "../services";
import { queryKeys } from "./queryKeys";

export function useMyApplications() {
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: queryKeys.myApplications(),
    queryFn: () => applicationService.getMine(),
  });

  const withdraw = useMutation({
    mutationFn: (id: string) => applicationService.withdraw(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.myApplications() }),
  });

  return { list, withdraw };
}

export function useApplicants(opportunityId: string) {
  const qc = useQueryClient();

  const opportunity = useQuery({
    queryKey: queryKeys.opportunity(opportunityId),
    queryFn: () => opportunityService.get(opportunityId),
    enabled: !!opportunityId,
  });

  const applicants = useQuery({
    queryKey: queryKeys.applicants(opportunityId),
    queryFn: () => applicationService.getForOpportunity(opportunityId),
    enabled: !!opportunityId,
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: string; reason?: string }) =>
      applicationService.updateStatus(id, status, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.applicants(opportunityId) });
      qc.invalidateQueries({ queryKey: queryKeys.opportunity(opportunityId) });
    },
  });

  return { opportunity, applicants, updateStatus };
}
