import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSyncStatus, configureSync, testSyncConnection, triggerSync, triggerPush, triggerPull, disableSync, getSyncHistory } from '../lib/api';
import type { GitSyncConfig } from '../types';

export function useSyncStatus() {
  return useQuery({
    queryKey: ['syncStatus'],
    queryFn: getSyncStatus,
    refetchInterval: 30000,
  });
}

export function useSyncHistory() {
  return useQuery({
    queryKey: ['syncHistory'],
    queryFn: () => getSyncHistory(10),
  });
}

export function useConfigureSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (config: GitSyncConfig) => configureSync(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['syncStatus'] });
      queryClient.invalidateQueries({ queryKey: ['syncHistory'] });
    },
  });
}

export function useTestConnection() {
  return useMutation({
    mutationFn: (data: { repoUrl: string; authToken: string }) => testSyncConnection(data),
  });
}

export function useTriggerSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: triggerSync,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['syncStatus'] });
      queryClient.invalidateQueries({ queryKey: ['syncHistory'] });
    },
  });
}

export function useTriggerPush() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: triggerPush,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['syncStatus'] });
      queryClient.invalidateQueries({ queryKey: ['syncHistory'] });
    },
  });
}

export function useTriggerPull() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: triggerPull,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['syncStatus'] });
      queryClient.invalidateQueries({ queryKey: ['syncHistory'] });
    },
  });
}

export function useDisableSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: disableSync,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['syncStatus'] });
    },
  });
}
