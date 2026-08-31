// CMS hooks (W4, §4: server state via TanStack Query, no global store).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateServiceInput,
  UpdateServiceInput,
  CreatePostInput,
  UpdatePostInput,
} from '@somwave/shared';
import {
  listServices,
  createService,
  updateService,
  deleteService,
  listPosts,
  listCategories,
  createPost,
  updatePost,
  deletePost,
} from './api';

const SERVICES_KEY = ['cms', 'services'] as const;
const POSTS_KEY = ['cms', 'posts'] as const;
const CATEGORIES_KEY = ['cms', 'categories'] as const;

export function useCmsServices() {
  return useQuery({ queryKey: SERVICES_KEY, queryFn: listServices });
}

export function useCreateService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateServiceInput) => createService(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SERVICES_KEY }),
  });
}

export function useUpdateService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateServiceInput }) =>
      updateService(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SERVICES_KEY }),
  });
}

export function useDeleteService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteService(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SERVICES_KEY }),
  });
}

// ── Blog posts (W4.2) ─────────────────────────────────────────────────────────

export function useCmsPosts() {
  return useQuery({ queryKey: POSTS_KEY, queryFn: listPosts });
}

export function useCmsCategories() {
  return useQuery({ queryKey: CATEGORIES_KEY, queryFn: listCategories, staleTime: 5 * 60_000 });
}

export function useCreatePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePostInput) => createPost(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: POSTS_KEY }),
  });
}

export function useUpdatePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdatePostInput }) => updatePost(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: POSTS_KEY }),
  });
}

export function useDeletePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePost(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: POSTS_KEY }),
  });
}
