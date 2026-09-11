import { useQuery } from '@tanstack/react-query';
import type { Client } from '@botpress/client';
import { getSentimentRows, getSentimentTable } from '../api/botpress/sentiment';
import { buildSentimentRowsQuery, type SentimentRowsQueryOptions } from '../lib/sentimentRows';
import { queryKeys } from './queryKeys';

export function useSentimentRows(client: Client | null, workspaceId: string, botId: string, options: SentimentRowsQueryOptions) {
  return useQuery({
    queryKey: queryKeys.resource(workspaceId, botId, 'sentiment', buildSentimentRowsQuery(options)),
    queryFn: () => getSentimentRows(client!, options),
    enabled: !!client,
    placeholderData: (previous, query) =>
      client && query?.queryKey[1] === workspaceId && query.queryKey[2] === botId ? previous : undefined,
  });
}

export function useSentimentTable(client: Client | null, workspaceId: string, botId: string) {
  return useQuery({
    queryKey: queryKeys.resource(workspaceId, botId, 'sentimentTable'),
    queryFn: () => getSentimentTable(client!),
    enabled: false,
  });
}
