import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AuthUser,
  ConfirmTwoFactorInput,
  VerifyTwoFactorInput,
} from '@somwave/shared';
import {
  confirmTwoFactorSetup,
  fetchCurrentUser,
  login,
  logout,
  startTwoFactorSetup,
  verifyTwoFactorLogin,
} from './api';

const CURRENT_USER_KEY = ['auth', 'me'] as const;

export function useCurrentUser() {
  return useQuery<AuthUser | null>({
    queryKey: CURRENT_USER_KEY,
    queryFn: fetchCurrentUser,
    retry: false,
    staleTime: 5 * 60_000,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: login,
    onSuccess: (result) => {
      if ('user' in result && result.user) {
        queryClient.setQueryData(CURRENT_USER_KEY, result.user);
      }
    },
  });
}

export function useVerifyTwoFactor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: VerifyTwoFactorInput) => verifyTwoFactorLogin(input),
    onSuccess: ({ user }) => {
      queryClient.setQueryData(CURRENT_USER_KEY, user);
    },
  });
}

export function useStartTwoFactor() {
  return useMutation({ mutationFn: startTwoFactorSetup });
}

export function useConfirmTwoFactor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ConfirmTwoFactorInput) => confirmTwoFactorSetup(input),
    onSuccess: ({ user }) => {
      queryClient.setQueryData(CURRENT_USER_KEY, user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(CURRENT_USER_KEY, null);
    },
  });
}
