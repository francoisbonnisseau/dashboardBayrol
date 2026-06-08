export const SENTIMENT_PAGE_SIZE = 1000;

export const SENTIMENT_LIST_COLUMNS = [
  'date',
  'topics',
  'resolved',
  'sentiment',
  'conversationId',
] as const;

interface SentimentRowsQueryOptions {
  page: number;
  sentiment: string | null;
  showResolved: boolean;
  startDate: Date | undefined;
  endDate: Date | undefined;
}

export function buildSentimentRowsQuery({
  page,
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
    limit: SENTIMENT_PAGE_SIZE,
    offset: page * SENTIMENT_PAGE_SIZE,
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
