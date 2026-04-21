import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../lib/api';

export function useReviews(limit = 10) {
  return useQuery({
    queryKey: ['reviews', limit],
    queryFn: () => api.getReviews(limit),
  });
}

export function useCurrentReview() {
  return useQuery({
    queryKey: ['reviews', 'current'],
    queryFn: api.getCurrentReview,
    refetchInterval: 60000,
  });
}

export function useGenerateReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ periodStart, periodEnd }: { periodStart?: string; periodEnd?: string } = {}) =>
      api.generateReview(periodStart, periodEnd),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reviews'] });
    },
  });
}
