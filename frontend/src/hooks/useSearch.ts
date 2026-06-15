import { useInfiniteQuery } from "@tanstack/react-query";
import { queryKeys } from "./queryKeys";
import { searchService } from "../services";
import type { PlayerSearchParams, ClubSearchParams, OpportunitySearchParams } from "../services/search.service";

export function useSearchPlayers(params: Omit<PlayerSearchParams, "cursor">, enabled = true) {
  return useInfiniteQuery({
    queryKey: queryKeys.search("players", params as Record<string, unknown>),
    queryFn: ({ pageParam }) =>
      searchService.searchPlayers({ ...params, cursor: pageParam }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
    enabled,
    placeholderData: (prev) => prev,
  });
}

export function useSearchClubs(params: Omit<ClubSearchParams, "cursor">, enabled = true) {
  return useInfiniteQuery({
    queryKey: queryKeys.search("clubs", params as Record<string, unknown>),
    queryFn: ({ pageParam }) =>
      searchService.searchClubs({ ...params, cursor: pageParam }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
    enabled,
    placeholderData: (prev) => prev,
  });
}

export function useSearchOpportunities(params: Omit<OpportunitySearchParams, "cursor">, enabled = true) {
  return useInfiniteQuery({
    queryKey: queryKeys.search("opportunities", params as Record<string, unknown>),
    queryFn: ({ pageParam }) =>
      searchService.searchOpportunities({ ...params, cursor: pageParam }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
    enabled,
    placeholderData: (prev) => prev,
  });
}
