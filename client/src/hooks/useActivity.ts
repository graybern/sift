import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getActivity, revertActivity } from '../lib/api';

export function useActivity(filters?: { entity_type?: string; action?: string; limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ['activity', filters],
    queryFn: () => getActivity(filters),
  });
}

export function useRevertActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => revertActivity(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity'] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      queryClient.invalidateQueries({ queryKey: ['focus-areas'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}
