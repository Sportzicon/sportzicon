import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./styles.css";
import App from "./App";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 2 * 60_000,      // 2 min fresh — no redundant refetches within that window
      gcTime: 10 * 60_000,         // 10 min in memory — instant back-navigation
      refetchOnWindowFocus: false, // don't hammer API on tab switch
      // refetchOnMount defaults to true — respects staleTime correctly:
      // mount within 2min → serve cache; mount after 2min → refetch
    }
  }
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>
);
