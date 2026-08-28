// Milestones hooks (I2.3, §4: server state via TanStack Query, no global store).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateMilestoneInput, UpdateMilestoneInput } from '@somwave/shared';
import {
  listMilestones,
  createMilestone,
  updateMilestone,
  deleteMilestone,
  type ListMilestonesParams,
} from './api';

const MILESTONES_KEY = ['milestones'] as const;

export function useMilestones(params: ListMilestonesParams) {
  return useQuery({
    queryKey: [...MILESTONES_KEY, params],
    queryFn: () => listMilestones(params),
    placeholderData: (prev) => prev,
  });
}

export function useCreateMilestone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMilestoneInput) => createMilestone(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MILESTONES_KEY }),
  });
}

export function useUpdateMilestone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateMilestoneInput }) =>
      updateMilestone(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MILESTONES_KEY }),
  });
}

export function useDeleteMilestone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteMilestone(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MILESTONES_KEY }),
  });
}
