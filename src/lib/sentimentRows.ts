export const SENTIMENT_PAGE_SIZE = 100;

export const SENTIMENT_LIST_COLUMNS = [
  'date',
  'topics',
  'resolved',
  'sentiment',
  'conversationId',
] as const;

export interface SentimentRowsQueryOptions {
  page: number;
  pageSize?: number;
  sentiment: string | null;
  showResolved: boolean;
  startDate: Date | undefined;
  endDate: Date | undefined;
}

export function buildSentimentRowsQuery({
  page,
  pageSize = SENTIMENT_PAGE_SIZE,
  sentiment,
  showResolved,
  startDate,
  endDate,
}: SentimentRowsQueryOptions) {
  const dateFilter: Record<string, string> = {};

  if (startDate) {
    dateFilter.$gte = startDate.toISOString();
  }

  if (endDate) {
    const endOfDay = new Date(endDate);
    endOfDay.setHours(23, 59, 59, 999);
    dateFilter.$lte = endOfDay.toISOString();
  }

  return {
    limit: pageSize,
    offset: page * pageSize,
    select: [...SENTIMENT_LIST_COLUMNS],
    filter: {
      ...(sentiment && { sentiment: { $eq: sentiment } }),
      ...(!showResolved && { resolved: { $eq: false } }),
      ...((startDate || endDate) && { date: dateFilter }),
    },
    orderBy: 'date',
    orderDirection: 'desc' as const,
  };
}
