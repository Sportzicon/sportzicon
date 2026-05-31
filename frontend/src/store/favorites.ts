import { create } from "zustand";
import { persist } from "zustand/middleware";

interface FavoritesStore {
  favoriteReels: Set<string>;
  toggleFavoriteReel: (id: string) => void;
  isFavorite: (id: string) => boolean;
}

export const useFavoritesStore = create<FavoritesStore>()(
  persist(
    (set, get) => ({
      favoriteReels: new Set(),
      toggleFavoriteReel: (id: string) =>
        set((state) => {
          const next = new Set(state.favoriteReels);
          next.has(id) ? next.delete(id) : next.add(id);
          return { favoriteReels: next };
        }),
      isFavorite: (id: string) => get().favoriteReels.has(id)
    }),
    {
      name: "favorites-store",
      storage: {
        getItem: (name) => {
          const item = localStorage.getItem(name);
          if (!item) return null;
          const parsed = JSON.parse(item);
          return {
            state: {
              ...parsed.state,
              favoriteReels: new Set(parsed.state.favoriteReels || [])
            }
          };
        },
        setItem: (name, value) => {
          localStorage.setItem(
            name,
            JSON.stringify({
              ...value,
              state: {
                ...value.state,
                favoriteReels: Array.from(value.state.favoriteReels)
              }
            })
          );
        },
        removeItem: (name) => localStorage.removeItem(name)
      }
    }
  )
);
