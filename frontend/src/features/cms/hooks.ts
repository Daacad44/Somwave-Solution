// CMS hooks (W4, §4: server state via TanStack Query, no global store).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateServiceInput,
  UpdateServiceInput,
  CreatePostInput,
  UpdatePostInput,
  CreatePortfolioItemInput,
  UpdatePortfolioItemInput,
  CreateJobOpeningInput,
  UpdateJobOpeningInput,
  CreateTestimonialInput,
  UpdateTestimonialInput,
  CreateTeamMemberInput,
  UpdateTeamMemberInput,
  CreateFaqInput,
  UpdateFaqInput,
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
  listPortfolio,
  createPortfolio,
  updatePortfolio,
  deletePortfolio,
  listOpenings,
  createOpening,
  updateOpening,
  deleteOpening,
  listTestimonials,
  createTestimonial,
  updateTestimonial,
  deleteTestimonial,
  listTeam,
  createTeamMember,
  updateTeamMember,
  deleteTeamMember,
  listFaqs,
  createFaq,
  updateFaq,
  deleteFaq,
} from './api';

const SERVICES_KEY = ['cms', 'services'] as const;
const POSTS_KEY = ['cms', 'posts'] as const;
const CATEGORIES_KEY = ['cms', 'categories'] as const;
const PORTFOLIO_KEY = ['cms', 'portfolio'] as const;
const CAREERS_KEY = ['cms', 'careers'] as const;
const TESTIMONIALS_KEY = ['cms', 'testimonials'] as const;
const TEAM_KEY = ['cms', 'team'] as const;
const FAQS_KEY = ['cms', 'faqs'] as const;

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

// ── Portfolio (W4.3) ──────────────────────────────────────────────────────────

export function useCmsPortfolio() {
  return useQuery({ queryKey: PORTFOLIO_KEY, queryFn: listPortfolio });
}

export function useCreatePortfolio() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePortfolioItemInput) => createPortfolio(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PORTFOLIO_KEY }),
  });
}

export function useUpdatePortfolio() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdatePortfolioItemInput }) =>
      updatePortfolio(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PORTFOLIO_KEY }),
  });
}

export function useDeletePortfolio() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePortfolio(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PORTFOLIO_KEY }),
  });
}

// ── Careers / job openings (W4.4) ─────────────────────────────────────────────

export function useCmsCareers() {
  return useQuery({ queryKey: CAREERS_KEY, queryFn: listOpenings });
}

export function useCreateOpening() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateJobOpeningInput) => createOpening(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CAREERS_KEY }),
  });
}

export function useUpdateOpening() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateJobOpeningInput }) =>
      updateOpening(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CAREERS_KEY }),
  });
}

export function useDeleteOpening() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteOpening(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CAREERS_KEY }),
  });
}

// ── Testimonials (W5.1) ───────────────────────────────────────────────────────

export function useCmsTestimonials() {
  return useQuery({ queryKey: TESTIMONIALS_KEY, queryFn: listTestimonials });
}

export function useCreateTestimonial() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTestimonialInput) => createTestimonial(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TESTIMONIALS_KEY }),
  });
}

export function useUpdateTestimonial() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTestimonialInput }) =>
      updateTestimonial(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TESTIMONIALS_KEY }),
  });
}

export function useDeleteTestimonial() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTestimonial(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TESTIMONIALS_KEY }),
  });
}

// ── Team members (W5.2) ───────────────────────────────────────────────────────

export function useCmsTeam() {
  return useQuery({ queryKey: TEAM_KEY, queryFn: listTeam });
}

export function useCreateTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTeamMemberInput) => createTeamMember(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TEAM_KEY }),
  });
}

export function useUpdateTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTeamMemberInput }) =>
      updateTeamMember(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TEAM_KEY }),
  });
}

export function useDeleteTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTeamMember(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TEAM_KEY }),
  });
}

// ── FAQ (W5.3) ────────────────────────────────────────────────────────────────

export function useCmsFaqs() {
  return useQuery({ queryKey: FAQS_KEY, queryFn: listFaqs });
}

export function useCreateFaq() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateFaqInput) => createFaq(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FAQS_KEY }),
  });
}

export function useUpdateFaq() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateFaqInput }) => updateFaq(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FAQS_KEY }),
  });
}

export function useDeleteFaq() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteFaq(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FAQS_KEY }),
  });
}
