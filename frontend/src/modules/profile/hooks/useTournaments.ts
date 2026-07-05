import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { userService } from "../../../services";
import { queryKeys } from "../../../hooks/queryKeys";
import type { NewTournament } from "../../../models";

export function useTournaments(userId: string) {
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: queryKeys.athleteTournaments(userId),
    queryFn: () => userService.listTournaments(userId),
    enabled: !!userId,
  });

  const add = useMutation({
    mutationFn: (data: NewTournament) => userService.addTournament(userId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.athleteTournaments(userId) }),
  });

  const update = useMutation({
    mutationFn: ({ tournamentId, data }: { tournamentId: string; data: NewTournament }) =>
      userService.updateTournament(userId, tournamentId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.athleteTournaments(userId) }),
  });

  const remove = useMutation({
    mutationFn: (tournamentId: string) => userService.deleteTournament(userId, tournamentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.athleteTournaments(userId) }),
  });

  return { list, add, update, remove };
}
