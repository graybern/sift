import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../lib/api';
import type { Item, Horizon } from '../types';

interface ItemFilters {
  space_id?: string;
  horizon?: string;
  type?: string;
  energy?: string;
  focus_area_id?: string;
  search?: string;
  parent_id?: string;
}

export function useItems(filters?: ItemFilters) {
  return useQuery({
    queryKey: ['items', filters],
    queryFn: () => api.getItems(filters),
  });
}

export function useItemChildren(parentId: string) {
  return useQuery({
    queryKey: ['items', 'children', parentId],
    queryFn: () => api.getItemChildren(parentId),
    enabled: !!parentId,
  });
}

export function useCreateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createItem,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['items'] });
    },
  });
}

export function useUpdateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.updateItem,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['items'] });
    },
  });
}

export function useDeleteItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteItem,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['items'] });
    },
  });
}

export function useMoveItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, horizon, position }: { id: string; horizon: Horizon; position?: number }) =>
      api.moveItemToHorizon(id, horizon, position),
    onMutate: async ({ id, horizon, position }) => {
      await qc.cancelQueries({ queryKey: ['items'] });

      const previousQueries = qc.getQueriesData<Item[]>({ queryKey: ['items'] });

      qc.setQueriesData<Item[]>({ queryKey: ['items'] }, (old) => {
        if (!old) return old;
        return old.map((item) =>
          item.id === id
            ? { ...item, horizon, position: position ?? 0, updated_at: new Date().toISOString() }
            : item
        );
      });

      return { previousQueries };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]) => {
          qc.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['items'] });
    },
  });
}

export function useReorderItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.reorderItems,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['items'] });
    },
  });
}
