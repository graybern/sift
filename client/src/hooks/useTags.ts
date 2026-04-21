import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../lib/api';

export function useTags() {
  return useQuery({
    queryKey: ['tags'],
    queryFn: api.getTags,
  });
}

export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createTag,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tags'] }),
  });
}

export function useUpdateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; color?: string }) =>
      api.updateTag(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tags'] }),
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteTag,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tags'] });
      qc.invalidateQueries({ queryKey: ['items'] });
    },
  });
}

export function useAddTagToItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, tagId }: { itemId: string; tagId: string }) =>
      api.addTagToItem(itemId, tagId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['items'] }),
  });
}

export function useRemoveTagFromItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, tagId }: { itemId: string; tagId: string }) =>
      api.removeTagFromItem(itemId, tagId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['items'] }),
  });
}
