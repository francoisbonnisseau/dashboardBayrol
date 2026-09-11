import { useQuery } from '@tanstack/react-query';
import type { Client } from '@botpress/client';
import { getFeedbackRows, getFeedbackTable, buildFeedbackRowsQuery } from '../api/botpress/feedbacks';
import type { FeedbackRowsOptions } from '../api/botpress/feedbacks';
import { queryKeys } from './queryKeys';

export function useFeedbackRows(client: Client | null, workspaceId: string, botId: string, options: FeedbackRowsOptions) {
  return useQuery({
    queryKey: queryKeys.resource(workspaceId, botId, 'feedbacks', buildFeedbackRowsQuery(options)),
    queryFn: () => getFeedbackRows(client!, options),
    enabled: !!client,
    placeholderData: (previous, query) =>
      client && query?.queryKey[1] === workspaceId && query.queryKey[2] === botId ? previous : undefined,
  });
}

export function useFeedbackTable(client: Client | null, workspaceId: string, botId: string) {
  return useQuery({
    queryKey: queryKeys.resource(workspaceId, botId, 'feedbacksTable'),
    queryFn: () => getFeedbackTable(client!),
    enabled: false,
  });
}
