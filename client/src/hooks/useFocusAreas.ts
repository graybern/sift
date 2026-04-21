import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../lib/api';

export function useFocusAreas(spaceId?: string) {
  return useQuery({
    queryKey: ['focus-areas', spaceId],
    queryFn: () => api.getFocusAreas(spaceId),
  });
}

export function useCreateFocusArea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createFocusArea,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['focus-areas'] });
    },
  });
}

export function useUpdateFocusArea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; icon?: string }) =>
      api.updateFocusArea(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['focus-areas'] });
    },
  });
}

export function useDeleteFocusArea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteFocusArea,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['focus-areas'] });
      qc.invalidateQueries({ queryKey: ['items'] });
    },
  });
}
