import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useState } from 'react';
import * as api from '../lib/api';
import type { Space } from '../types';

export function useSpaces() {
  return useQuery({
    queryKey: ['spaces'],
    queryFn: api.getSpaces,
  });
}

export function useCreateSpace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createSpace,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['spaces'] }),
  });
}

export function useUpdateSpace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<Space>) => api.updateSpace(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['spaces'] }),
  });
}

export function useDeleteSpace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, moveItemsTo }: { id: string; moveItemsTo?: string }) => api.deleteSpace(id, moveItemsTo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['spaces'] });
      qc.invalidateQueries({ queryKey: ['items'] });
    },
  });
}

export function useReorderSpaces() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.reorderSpaces,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['spaces'] }),
  });
}

// Active space context
interface ActiveSpaceContextValue {
  activeSpaceId: string | null;
  setActiveSpaceId: (id: string | null) => void;
  activeFocusAreaId: string | null;
  setActiveFocusAreaId: (id: string | null) => void;
}

export const ActiveSpaceContext = createContext<ActiveSpaceContextValue>({
  activeSpaceId: null,
  setActiveSpaceId: () => {},
  activeFocusAreaId: null,
  setActiveFocusAreaId: () => {},
});

export function useActiveSpace() {
  return useContext(ActiveSpaceContext);
}

export function useActiveSpaceProvider() {
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);
  const [activeFocusAreaId, setActiveFocusAreaId] = useState<string | null>(null);

  const wrappedSetActiveSpaceId = (id: string | null) => {
    setActiveSpaceId(id);
    setActiveFocusAreaId(null);
  };

  return {
    activeSpaceId,
    setActiveSpaceId: wrappedSetActiveSpaceId,
    activeFocusAreaId,
    setActiveFocusAreaId,
  };
}
