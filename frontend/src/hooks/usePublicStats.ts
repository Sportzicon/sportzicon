import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { queryKeys } from "./queryKeys";

export interface PublicStats {
  athletes: number;
  clubs: number;
  open_opportunities: number;
  players_selected: number;
}

export function usePublicStats() {
  return useQuery({
    queryKey: queryKeys.publicStats(),
    queryFn: async () => (await api.get<PublicStats>("/stats/public")).data,
    staleTime: 60_000
  });
}
