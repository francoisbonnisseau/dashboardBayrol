import type { Client } from '@botpress/client';
export interface SentimentRow {
  id: number;
  date: string;
  topics?: string;
  resolved: boolean;
  sentiment: 'very negative' | 'negative' | 'neutral' | 'positive' | 'very positive';
  conversationId: string;
}
import { buildSentimentRowsQuery, type SentimentRowsQueryOptions } from '../../lib/sentimentRows.ts';
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
export async function getAllSentimentRows(client: Client, options: Omit<SentimentRowsQueryOptions, 'page'>) {
  const rows: SentimentRow[] = [];
  for (let page = 0;; page++) {
    const result = await getSentimentRows(client, {
      ...options,
      page,
      pageSize: 1000
    });
    rows.push(...result.rows);
    if (!result.hasMore || !result.rows.length)
      return rows;
  }
}
