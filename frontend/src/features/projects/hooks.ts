// Projects hooks (I2.1, §4: server state via TanStack Query, no global store).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateProjectInput, UpdateProjectInput } from '@somwave/shared';
import {
  listProjects,
  createProject,
  updateProject,
  deleteProject,
  type ListProjectsParams,
} from './api';

const PROJECTS_KEY = ['projects'] as const;

export function useProjects(params: ListProjectsParams) {
  return useQuery({
    queryKey: [...PROJECTS_KEY, params],
    queryFn: () => listProjects(params),
    placeholderData: (prev) => prev,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProjectInput) => createProject(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROJECTS_KEY }),
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateProjectInput }) =>
      updateProject(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROJECTS_KEY }),
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROJECTS_KEY }),
  });
}
