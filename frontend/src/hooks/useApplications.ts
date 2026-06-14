import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { applicationService, opportunityService } from "../services";
import { queryKeys } from "./queryKeys";
import type { Application, ApplicationStatus } from "../models";

export function useMyApplications() {
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: queryKeys.myApplications(),
    queryFn: () => applicationService.getMine(),
  });

  const withdraw = useMutation({
    mutationFn: (id: string) => applicationService.withdraw(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: queryKeys.myApplications() });
      const prev = qc.getQueryData<Application[]>(queryKeys.myApplications());
      qc.setQueryData<Application[]>(queryKeys.myApplications(), (old) =>
        old?.map((a) => a.id === id ? { ...a, status: "withdrawn" as ApplicationStatus } : a)
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.myApplications(), ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.myApplications() }),
  });

  return { list, withdraw };
}

export function useOpportunityApplication(opportunityId: string) {
  const { list } = useMyApplications();
  const application = list.data?.find((a) => a.opportunity_id === opportunityId) ?? null;
  return { application, isLoading: list.isLoading };
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
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: queryKeys.applicants(opportunityId) });
      const prev = qc.getQueryData<Application[]>(queryKeys.applicants(opportunityId));
      qc.setQueryData<Application[]>(queryKeys.applicants(opportunityId), (old) =>
        old?.map((a) => a.id === id ? { ...a, status: status as ApplicationStatus } : a)
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.applicants(opportunityId), ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.applicants(opportunityId) });
      qc.invalidateQueries({ queryKey: queryKeys.opportunity(opportunityId) });
    },
  });

  return { opportunity, applicants, updateStatus };
}
