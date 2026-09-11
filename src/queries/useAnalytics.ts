import { useQuery } from '@tanstack/react-query';
import type { Client } from '@botpress/client';
import { fetchAnalytics } from '@/api/botpress/analytics';
import { queryKeys } from './queryKeys';

export function useAnalytics(client: Client | null, workspaceId: string, botId: string, startDate?: Date, endDate?: Date) {
  const endOfDay = endDate ? new Date(endDate) : undefined;
  endOfDay?.setHours(23, 59, 59, 999);
  const start = startDate?.toISOString();
  const end = endOfDay?.toISOString();
  return useQuery({
    queryKey: queryKeys.resource(workspaceId, botId, 'analytics', { start, end }),
    queryFn: () => fetchAnalytics(client!, botId, start!, end!),
    enabled: Boolean(client && botId && start && end),
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === workspaceId && previousQuery?.queryKey[2] === botId ? previous : undefined,
  });
}
