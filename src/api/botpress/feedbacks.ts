import type { Client } from '@botpress/client';
export interface FeedbackRow {
  id: number;
  createdAt: string;
  updatedAt: string;
  conversationId: string;
  userId: string;
  messageId: string;
  text: string;
  reaction: 'positive' | 'negative';
  comment: string;
  messageDate: string;
}
export interface FeedbackRowsOptions {
  page: number;
  pageSize?: number;
  reaction: string | null;
  startDate: Date | undefined;
  endDate: Date | undefined;
}
export function buildFeedbackRowsQuery({ page, pageSize = 100, reaction, startDate, endDate }: FeedbackRowsOptions) {
  const dateFilter: Record<string, string> = {};
  if (startDate)
    dateFilter.$gte = startDate.toISOString();
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    dateFilter.$lte = end.toISOString();
  }
  return {
    limit: pageSize,
    offset: page * pageSize,
    select: ['createdAt', 'updatedAt', 'conversationId', 'userId', 'messageId', 'text', 'reaction', 'comment', 'messageDate'],
    filter: {
      ...(reaction && { reaction: { $eq: reaction } }),
      ...((startDate || endDate) && { messageDate: dateFilter })
    },
    orderBy: 'messageDate',
    orderDirection: 'desc' as const
  };
}
export const getFeedbackTable = (client: Client) => client.getTable({ table: 'feedbacksTable' });
export async function getFeedbackRows(client: Client, options: FeedbackRowsOptions) {
  const response = await client.findTableRows({
    table: 'feedbacksTable',
    ...buildFeedbackRowsQuery(options)
  });
  const rows: FeedbackRow[] = response.rows.map(row => ({
    id: row.id,
    createdAt: row.createdAt || '',
    updatedAt: row.updatedAt || '',
    conversationId: row.conversationId || '',
    userId: row.userId || '',
    messageId: row.messageId || '',
    text: row.text || '',
    reaction: row.reaction || 'positive',
    comment: row.comment || '',
    messageDate: row.messageDate || row.createdAt
  }));
  return {
    rows,
    hasMore: response.hasMore
  };
}
export async function getAllFeedbackRows(client: Client, options: Omit<FeedbackRowsOptions, 'page'>) {
  const rows: FeedbackRow[] = [];
  for (let page = 0;; page++) {
    const result = await getFeedbackRows(client, {
      ...options,
      page,
      pageSize: 1000
    });
    rows.push(...result.rows);
    if (!result.hasMore || !result.rows.length)
      return rows;
  }
}
