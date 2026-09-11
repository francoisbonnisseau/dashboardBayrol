import type { Client } from '@botpress/client';
import { format } from 'date-fns';
import { calculateAiCostMetrics, type BotpressAnalyticsRecord } from '../../lib/analyticsMetrics.ts';

const TABLE_NAME = 'conversationsAnalysisTable';

// Sentiment colors
const SENTIMENT_COLORS: Record<string, string> = {
  'very positive': '#22c55e',
  'positive': '#86efac',
  'neutral': '#94a3b8',
  'negative': '#fca5a5',
  'very negative': '#ef4444',
};

interface TranscriptMessage {
  sender: 'bot' | 'user';
  preview: string;
}

interface ConversationRow {
  id: number;
  createdAt: string;
  updatedAt: string;
  date: string;
  topics?: string[];
  summary?: string;
  resolved: boolean;
  sentiment: string;
  transcript?: TranscriptMessage[];
  escalations?: string[];
  conversationId: string;
}

interface ConversationAnalysisTableRow {
  id: number;
  createdAt?: string;
  updatedAt?: string;
  date?: string;
  topics?: string[];
  summary?: string;
  resolved?: boolean;
  sentiment?: string;
  transcript?: TranscriptMessage[];
  escalations?: string[];
  conversationId?: string;
}

interface DailyAnalytics {
  date: string;
  uniqueUsers: number;
  userMessages: number;
  botMessages: number;
  conversations: number;
  aiCostUsd: number | null;
}

interface AnalyticsSummary {
  totalUsers: number;
  totalUserMessages: number;
  totalBotMessages: number;
  totalConversations: number;
  avgUserMessagesPerConversation: number;
  avgBotMessagesPerConversation: number;
  totalAiCostUsd: number | null;
  avgAiCostPerConversationUsd: number | null;
}

interface SentimentData {
  name: string;
  value: number;
  color: string;
}

interface ResolutionData {
  resolved: number;
  unresolved: number;
  resolutionRate: number;
}

interface AnalyticsResult {
  analyticsData: DailyAnalytics[];
  summary: AnalyticsSummary | null;
  sentimentData: SentimentData[];
  resolutionData: ResolutionData | null;
  aiCostUnavailable?: boolean;
}

function calculateSummary(
  records: DailyAnalytics[],
  aiCostMetrics: { totalAiCostUsd: number; avgAiCostPerConversationUsd: number } | null
): AnalyticsSummary {
  if (records.length === 0) {
    return {
      totalUsers: 0,
      totalUserMessages: 0,
      totalBotMessages: 0,
      totalConversations: 0,
      avgUserMessagesPerConversation: 0,
      avgBotMessagesPerConversation: 0,
      totalAiCostUsd: aiCostMetrics?.totalAiCostUsd ?? null,
      avgAiCostPerConversationUsd: aiCostMetrics?.avgAiCostPerConversationUsd ?? null
    };
  }

  const totalUsers = records.reduce((sum, r) => sum + r.uniqueUsers, 0);
  const totalUserMessages = records.reduce((sum, r) => sum + r.userMessages, 0);
  const totalBotMessages = records.reduce((sum, r) => sum + r.botMessages, 0);
  const totalConversations = records.reduce((sum, r) => sum + r.conversations, 0);

  return {
    totalUsers,
    totalUserMessages,
    totalBotMessages,
    totalConversations,
    avgUserMessagesPerConversation: totalConversations > 0 
      ? Math.round((totalUserMessages / totalConversations) * 10) / 10 
      : 0,
    avgBotMessagesPerConversation: totalConversations > 0 
      ? Math.round((totalBotMessages / totalConversations) * 10) / 10 
      : 0,
    totalAiCostUsd: aiCostMetrics?.totalAiCostUsd ?? null,
    avgAiCostPerConversationUsd: aiCostMetrics?.avgAiCostPerConversationUsd ?? null
  };
}


export async function fetchAnalytics(client: Client, botId: string, startTimestamp: string, endTimestamp: string): Promise<AnalyticsResult> {
  const botAnalyticsPromise = client
    .getBotAnalytics({
      id: botId,
      startDate: startTimestamp,
      endDate: endTimestamp,
    })
    .then((response) => response.records as BotpressAnalyticsRecord[])
    .catch((error) => {
      console.error('Error fetching Botpress AI cost analytics:', error);
      return null;
    });
  
  // Fetch data with MongoDB-like filter to get only rows in date range
  let allRows: ConversationAnalysisTableRow[] = [];
  let currentOffset = 0;
  const batchSize = 1000; // Maximum allowed by API
  let hasMore = true;
  
  while (hasMore) {
    const params = {
      table: TABLE_NAME,
      limit: batchSize,
      offset: currentOffset,
      filter: {
        createdAt: {
          $gte: startTimestamp,
          $lte: endTimestamp
        }
      }
    };
    
    const response = await client.findTableRows(params);
    
    if (response.rows && response.rows.length > 0) {
      allRows = allRows.concat(response.rows as unknown as ConversationAnalysisTableRow[]);
      console.log(`Fetched ${response.rows.length} rows at offset ${currentOffset}, total: ${allRows.length}`);
    }
    
    // Check the hasMore flag from the API response
    hasMore = (response as { hasMore?: boolean }).hasMore === true;
    
    if (hasMore) {
      currentOffset += batchSize;
    }
  }
  
  if (allRows.length === 0) {
    const botAnalyticsRecords = await botAnalyticsPromise;
    return { analyticsData: [], summary: null, sentimentData: [], resolutionData: null, aiCostUnavailable: botAnalyticsRecords === null };
  }

  console.log(`Found ${allRows.length} total rows`);
  
  // Debug: Log first few rows to see the structure
  if (allRows.length > 0) {
    console.log('First row structure:', allRows[0]);
    console.log('First row keys:', Object.keys(allRows[0]));
    console.log('First row conversationId:', allRows[0].conversationId);
    console.log('Sample transcript:', allRows[0].transcript?.slice(0, 2));
  }
  
  // No need to filter by date anymore since the filter is applied in the query
  const conversationsMap = new Map<string, ConversationRow>();
  
  allRows.forEach((row) => {
    const convId = row.conversationId;
    
    // Skip rows without conversationId
    if (!convId) {
      console.warn('Row without conversationId:', row.id);
      return;
    }

    if (!row.createdAt) {
      console.warn('Row without createdAt:', row.id);
      return;
    }
    
    const createdAt = new Date(row.createdAt);
    
    // Keep only the most recent entry for each conversationId
    if (!conversationsMap.has(convId) || 
        new Date(conversationsMap.get(convId)!.createdAt) < createdAt) {
      conversationsMap.set(convId, {
        id: row.id,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt || '',
        date: row.date || '',
        topics: row.topics || [],
        summary: row.summary || '',
        resolved: !!row.resolved,
        sentiment: row.sentiment || 'neutral',
        transcript: row.transcript || [],
        escalations: row.escalations || [],
        conversationId: convId
      });
    }
  });

  const uniqueConversations = Array.from(conversationsMap.values());
  console.log(`${uniqueConversations.length} unique conversations after deduplication`);

  const botAnalyticsRecords = await botAnalyticsPromise;
  const aiCostMetrics = botAnalyticsRecords
    ? calculateAiCostMetrics(botAnalyticsRecords, uniqueConversations.length)
    : null;
  const aiCostByDate = new Map<string, number>();

  botAnalyticsRecords?.forEach((record) => {
    const startDateTimeUtc = record.startDateTimeUtc;
    if (!startDateTimeUtc) return;

    const recordDate = new Date(startDateTimeUtc);
    if (isNaN(recordDate.getTime())) return;

    const dateKey = format(recordDate, 'yyyy-MM-dd');
    aiCostByDate.set(dateKey, (aiCostByDate.get(dateKey) ?? 0) + (record.llm?.cost?.sum ?? 0));
  });

  // Group by date and calculate metrics
  const dailyMetricsMap = new Map<string, {
    uniqueUsers: Set<string>;
    userMessages: number;
    botMessages: number;
    conversations: number;
  }>();

  uniqueConversations.forEach(conv => {
    const convDate = new Date(conv.createdAt);
    
    // Skip invalid dates
    if (isNaN(convDate.getTime())) {
      console.warn('Invalid date for conversation:', conv.conversationId, conv.createdAt);
      return;
    }
    
    const dateKey = format(convDate, 'yyyy-MM-dd');
    
    if (!dailyMetricsMap.has(dateKey)) {
      dailyMetricsMap.set(dateKey, {
        uniqueUsers: new Set<string>(),
        userMessages: 0,
        botMessages: 0,
        conversations: 0
      });
    }

    const metrics = dailyMetricsMap.get(dateKey)!;
    metrics.conversations++;
    
    // Use conversationId as user identifier (each conversation = 1 unique user)
    metrics.uniqueUsers.add(conv.conversationId);
    
    // Count messages from transcript
    if (conv.transcript && Array.isArray(conv.transcript)) {
      conv.transcript.forEach((msg: TranscriptMessage) => {
        if (msg.sender === 'user') {
          metrics.userMessages++;
        } else if (msg.sender === 'bot') {
          metrics.botMessages++;
        }
      });
    }
  });

  // Convert to DailyAnalytics array
  const dailyAnalytics: DailyAnalytics[] = Array.from(dailyMetricsMap.entries())
    .map(([date, metrics]) => ({
      date,
      uniqueUsers: metrics.uniqueUsers.size,
      userMessages: metrics.userMessages,
      botMessages: metrics.botMessages,
      conversations: metrics.conversations,
      aiCostUsd: botAnalyticsRecords ? (aiCostByDate.get(date) ?? 0) : null
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  console.log('Daily analytics:', dailyAnalytics);

  // Calculate sentiment distribution
  const sentimentCounts: Record<string, number> = {
    'very positive': 0,
    'positive': 0,
    'neutral': 0,
    'negative': 0,
    'very negative': 0,
  };
  
  uniqueConversations.forEach(conv => {
    const sentiment = (conv.sentiment || 'neutral').toLowerCase();
    if (sentiment in sentimentCounts) {
      sentimentCounts[sentiment]++;
    } else {
      sentimentCounts['neutral']++;
    }
  });

  const sentimentDistribution: SentimentData[] = Object.entries(sentimentCounts)
    .filter(([, value]) => value > 0)
    .map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      color: SENTIMENT_COLORS[name] || '#94a3b8'
    }));

  // Calculate resolution data
  const resolvedCount = uniqueConversations.filter(conv => conv.resolved === true).length;
  const unresolvedCount = uniqueConversations.length - resolvedCount;
  const resolutionRate = uniqueConversations.length > 0 
    ? Math.round((resolvedCount / uniqueConversations.length) * 100) 
    : 0;


  if (dailyAnalytics.length === 0) {
    return { analyticsData: [], summary: null, sentimentData: [], resolutionData: null, aiCostUnavailable: botAnalyticsRecords === null };
  }

  return {
    analyticsData: dailyAnalytics,
    summary: dailyAnalytics.length ? calculateSummary(dailyAnalytics, aiCostMetrics) : null,
    sentimentData: sentimentDistribution,
    resolutionData: { resolved: resolvedCount, unresolved: unresolvedCount, resolutionRate },
    aiCostUnavailable: botAnalyticsRecords === null,
  };
}
