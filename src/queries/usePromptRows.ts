import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Client } from '@botpress/client';
import { fetchPromptRows } from '@/api/botpress/prompts';
import { queryKeys } from './queryKeys';

export function usePromptRows(client: Client | null, workspaceId: string, botId: string) {
  return useQuery({
    queryKey: queryKeys.resource(workspaceId, botId, 'prompts'),
    queryFn: () => fetchPromptRows(client!),
    enabled: Boolean(client && botId),
  });
}

export function usePromptMutations(client: Client | null, workspaceId: string, botId: string) {
  const queryClient = useQueryClient();
  const onMutate = () => queryKeys.resourceRoot(workspaceId, botId, 'prompts');
  const onSuccess = (_data: unknown, _variables: unknown, key: ReturnType<typeof onMutate> | undefined) =>
    key ? queryClient.invalidateQueries({ queryKey: key }) : Promise.resolve();
  const create = useMutation({
    mutationFn: (request: Parameters<Client['createTableRows']>[0]) => client!.createTableRows(request),
    onMutate,
    onSuccess,
  });
  const update = useMutation({
    mutationFn: (request: Parameters<Client['updateTableRows']>[0]) => client!.updateTableRows(request),
    onMutate,
    onSuccess,
  });
  return { create, update };
}
