import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tournamentService, organizationService } from "../../../services";
import { queryKeys } from "../../../hooks/queryKeys";
import { useAuthStore } from "../../../store/auth";
import { isAdmin } from "../../../utils/roles";
import type {
  OrgTournamentFilters,
  CreateOrgTournamentRequest,
  UpdateOrgTournamentRequest,
  CreateOrgTeamRequest,
} from "../../../models";

export function useInfiniteOrgTournaments(filters: OrgTournamentFilters = {}) {
  const qc = useQueryClient();

  const list = useInfiniteQuery({
    queryKey: queryKeys.orgTournamentsInfinite(filters),
    queryFn: ({ pageParam }) => tournamentService.listGlobal({ ...filters, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const remove = useMutation({
    mutationFn: (id: string) => tournamentService.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.orgTournamentsInfinite() }),
  });

  return { list, remove };
}

export function useOrgTournamentsForOrg(orgId: string) {
  return useQuery({
    queryKey: queryKeys.orgTournamentsForOrg(orgId),
    queryFn: () => tournamentService.listForOrg(orgId),
    enabled: !!orgId,
  });
}

export function useOrgTournament(id: string) {
  const qc = useQueryClient();

  const detail = useQuery({
    queryKey: queryKeys.orgTournament(id),
    queryFn: () => tournamentService.get(id),
    enabled: !!id,
  });

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: queryKeys.orgTournament(id) });
    qc.invalidateQueries({ queryKey: queryKeys.orgTournamentsInfinite() });
  }

  const remove = useMutation({
    mutationFn: () => tournamentService.delete(id),
    onSuccess: invalidateAll,
  });

  const addTeam = useMutation({
    mutationFn: (data: CreateOrgTeamRequest) => tournamentService.addTeam(id, data),
    onSuccess: invalidateAll,
  });

  const removeTeam = useMutation({
    mutationFn: (teamId: string) => tournamentService.removeTeam(id, teamId),
    onSuccess: invalidateAll,
  });

  return { detail, remove, addTeam, removeTeam };
}

export function useOrgTournamentForm(id?: string) {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const admin = isAdmin(user?.role ?? "");

  // Admins typically don't own a club themselves — without this they'd see
  // an empty org picker and be unable to create/manage tournaments at all.
  const orgs = useQuery({
    queryKey: [...queryKeys.myOrgs(), admin],
    queryFn: () => (admin ? organizationService.list() : organizationService.getMine()),
  });

  const existing = useQuery({
    queryKey: queryKeys.orgTournament(id ?? ""),
    queryFn: () => tournamentService.get(id!),
    enabled: !!id,
  });

  const save = useMutation({
    mutationFn: ({ orgId, data }: { orgId: string; data: CreateOrgTournamentRequest | UpdateOrgTournamentRequest }) =>
      id
        ? tournamentService.update(id, data as UpdateOrgTournamentRequest)
        : tournamentService.create(orgId, data as CreateOrgTournamentRequest),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.orgTournamentsInfinite() });
      if (id) qc.invalidateQueries({ queryKey: queryKeys.orgTournament(id) });
    },
  });

  return { orgs, existing, save };
}
