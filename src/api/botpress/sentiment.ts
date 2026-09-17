import type { Client } from '@botpress/client';
import {
  buildSentimentRowsQuery,
  SENTIMENT_EXPORT_MAX_ROWS,
  SENTIMENT_EXPORT_PAGE_SIZE,
  type SentimentRowsQueryOptions,
} from '../../lib/sentimentRows.ts';

export interface SentimentRow {
  id: number;
  date: string;
  topics?: string;
  resolved: boolean;
  sentiment: 'very negative' | 'negative' | 'neutral' | 'positive' | 'very positive';
  conversationId: string;
}
export const getSentimentTable = (client: Client) => client.getTable({ table: 'conversationsAnalysisTable' });
export async function getSentimentRows(client: Client, options: SentimentRowsQueryOptions) {
  const response = await client.findTableRows({
    table: 'conversationsAnalysisTable',
    ...buildSentimentRowsQuery(options)
  });
  const rows: SentimentRow[] = response.rows.map(row => ({
    id: row.id,
    date: row.date,
    topics: row.topics || '',
    resolved: !!row.resolved,
    sentiment: row.sentiment || 'neutral',
    conversationId: row.conversationId || ''
  }));
  return {
    rows,
    hasMore: response.hasMore
  };
}

export async function getSentimentCount(
  client: Client,
  options: Omit<SentimentRowsQueryOptions, 'page'>,
) {
  const query = buildSentimentRowsQuery({ page: 0, ...options });
  const response = await client.findTableRows({
    table: 'conversationsAnalysisTable',
    filter: query.filter,
    group: { conversationId: 'count' },
    limit: 1,
  });
  const count = (response.rows[0] as { conversationIdCount?: unknown } | undefined)
    ?.conversationIdCount;
  return typeof count === 'number' ? count : 0;
}

export async function getAllConversationMessages(
  client: Client,
  conversationId: string,
) {
  const messages: Awaited<ReturnType<Client['listMessages']>>['messages'] = [];
  let nextToken: string | undefined;

  do {
    const response = await client.listMessages({
      conversationId,
      ...(nextToken ? { nextToken } : {}),
    });
    messages.push(...response.messages);
    nextToken = response.meta?.nextToken;
  } while (nextToken);

  return messages;
}

export async function getAllSentimentRows(
  client: Client,
  options: Omit<SentimentRowsQueryOptions, 'page'>,
  maxRows = SENTIMENT_EXPORT_MAX_ROWS,
) {
  const rows: SentimentRow[] = [];
  for (let page = 0;; page++) {
    const result = await getSentimentRows(client, {
      ...options,
      page,
      pageSize: SENTIMENT_EXPORT_PAGE_SIZE,
    });
    rows.push(...result.rows);
    if (!result.hasMore || !result.rows.length || rows.length >= maxRows) {
      return rows.slice(0, maxRows);
    }
  }
}
