import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Client } from '@botpress/client';
import { useSettings } from '../contexts/SettingsContext';
import { useBotpressClient } from '../hooks/useBotpressClient';
import { fetchLearnings, fetchIntroRows, fetchCodeTextRows } from '../api/botpress/knowledge';
import { queryKeys } from './queryKeys';

function useKnowledgeRows<T>(
  botId: string,
  table: string,
  fetchRows: (client: Client, signal?: AbortSignal) => Promise<T>,
) {
  const { settings } = useSettings();
  const client = useBotpressClient(botId);
  const cache = useQueryClient();
  const key = queryKeys.resourceRoot(settings.workspaceId, botId, table);
  const requireClient = () => {
    if (!client) throw new Error('Botpress configuration is required');
    return client;
  };
  const query = useQuery({
    queryKey: queryKeys.resource(settings.workspaceId, botId, table),
    queryFn: ({ signal }) => fetchRows(requireClient(), signal),
    enabled: !!client,
  });
  // Capture the scope when the write starts, even if the selected bot later changes.
  const onMutate = () => ({ queryKey: key });
  const onSuccess = (
    _data: unknown,
    _variables: unknown,
    context: ReturnType<typeof onMutate> | undefined,
  ) => cache.invalidateQueries({ queryKey: context?.queryKey ?? key });
  const create = useMutation({
    mutationFn: (input: Parameters<Client['createTableRows']>[0]) =>
      requireClient().createTableRows(input),
    onMutate,
    onSuccess,
  });
  const update = useMutation({
    mutationFn: (input: Parameters<Client['updateTableRows']>[0]) =>
      requireClient().updateTableRows(input),
    onMutate,
    onSuccess,
  });
  const remove = useMutation({
    mutationFn: (input: Parameters<Client['deleteTableRows']>[0]) =>
      requireClient().deleteTableRows(input),
    onMutate,
    onSuccess,
  });
  return {
    ...query,
    client,
    create,
    update,
    remove,
    saving: create.isPending || update.isPending,
  };
}

export const useLearnings = (botId: string) =>
  useKnowledgeRows(botId, 'learningsTable', fetchLearnings);
export const useIntroRows = (botId: string) =>
  useKnowledgeRows(botId, 'introTable', fetchIntroRows);
export const useCodeTextRows = (botId: string) =>
  useKnowledgeRows(botId, 'codeTextTable', fetchCodeTextRows);
