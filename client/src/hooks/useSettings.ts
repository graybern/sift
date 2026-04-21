import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../lib/api';

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: api.getSettings,
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.updateSettings,
    onSuccess: (data) => {
      qc.setQueryData(['settings'], data);
    },
  });
}
