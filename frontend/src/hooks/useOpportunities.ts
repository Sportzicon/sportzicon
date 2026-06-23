import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { opportunityService, organizationService } from "../services";
import { queryKeys } from "./queryKeys";
import type { OpportunityFilters, CreateOpportunityRequest, UpdateOpportunityRequest } from "../models";

export function useMyOpportunities() {
  return useQuery({
    queryKey: queryKeys.myOpportunities(),
    queryFn: () => opportunityService.getMine(),
  });
}

export function useOpportunities(filters: OpportunityFilters = {}) {
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: queryKeys.opportunities(filters),
    queryFn: async () => (await opportunityService.list(filters)).data,
  });

  const remove = useMutation({
    mutationFn: (id: string) => opportunityService.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.opportunities() }),
  });

  return { list, remove };
}

export function useInfiniteOpportunities(filters: OpportunityFilters = {}) {
  const qc = useQueryClient();

  const list = useInfiniteQuery({
    queryKey: queryKeys.opportunitiesInfinite(filters),
    queryFn: ({ pageParam }) => opportunityService.list({ ...filters, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const remove = useMutation({
    mutationFn: (id: string) => opportunityService.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.opportunitiesInfinite(filters) }),
  });

  return { list, remove };
}

export function useOpportunity(id: string) {
  const qc = useQueryClient();

  const detail = useQuery({
    queryKey: queryKeys.opportunity(id),
    queryFn: () => opportunityService.get(id),
    enabled: !!id,
  });

  const remove = useMutation({
    mutationFn: () => opportunityService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.opportunities() });
      qc.removeQueries({ queryKey: queryKeys.opportunity(id) });
    },
  });

  return { detail, remove };
}

export function useOpportunityForm(id?: string) {
  const qc = useQueryClient();

  const orgs = useQuery({
    queryKey: queryKeys.myOrgs(),
    queryFn: () => organizationService.getMine(),
  });

  const existing = useQuery({
    queryKey: queryKeys.opportunity(id ?? ""),
    queryFn: () => opportunityService.get(id!),
    enabled: !!id,
  });

  const save = useMutation({
    mutationFn: (data: CreateOpportunityRequest | UpdateOpportunityRequest) =>
      id
        ? opportunityService.update(id, data as UpdateOpportunityRequest)
        : opportunityService.create(data as CreateOpportunityRequest),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.opportunities() });
      if (id) qc.invalidateQueries({ queryKey: queryKeys.opportunity(id) });
    },
  });

  return { orgs, existing, save };
}
