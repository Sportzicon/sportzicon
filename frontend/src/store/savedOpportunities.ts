import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Opportunity } from "../types";

interface SavedState {
  saved: Opportunity[];
  toggle: (opp: Opportunity) => void;
  isSaved: (id: string) => boolean;
}

export const useSavedOpportunities = create<SavedState>()(
  persist(
    (set, get) => ({
      saved: [],
      toggle: (opp) =>
        set((state) => ({
          saved: state.saved.some((o) => o.id === opp.id)
            ? state.saved.filter((o) => o.id !== opp.id)
            : [opp, ...state.saved]
        })),
      isSaved: (id) => get().saved.some((o) => o.id === id)
    }),
    { name: "sx_saved_opps" }
  )
);
