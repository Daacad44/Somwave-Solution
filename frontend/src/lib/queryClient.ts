import { QueryClient } from '@tanstack/react-query';

// Single TanStack Query client — server state lives here, not in a global store
// (SYSTEM_PROMPT §4: no Redux/Zustand/MobX).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
