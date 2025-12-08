import { useState, useEffect, useCallback } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useBotpressClient } from '../hooks/useBotpressClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Button } from '@/components/ui/button';
import { Loader2, Users, MessageSquare, BarChart3, CheckCircle2, XCircle, Smile, Meh, Bot } from 'lucide-react';
import { subDays, format } from 'date-fns';
import { toast } from 'sonner';
import { Area, AreaChart, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Tooltip } from 'recharts';

const TABLE_NAME = 'conversationsAnalysisTable';

// Sentiment colors
const SENTIMENT_COLORS: Record<string, string> = {
  'very positive': '#22c55e',
  'positive': '#86efac',
  'neutral': '#94a3b8',
  'negative': '#fca5a5',
  'very negative': '#ef4444',
};

// Custom tooltip for charts
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3">
        <p className="font-medium text-sm mb-1 text-gray-900 dark:text-gray-100">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {entry.value.toLocaleString()}
          </p>
        ))}
      </div>
    );
  }
  return null;
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

interface DailyAnalytics {
  date: string;
  uniqueUsers: number;
  userMessages: number;
  botMessages: number;
  conversations: number;
}

interface AnalyticsSummary {
  totalUsers: number;
  totalUserMessages: number;
  totalBotMessages: number;
  totalConversations: number;
  avgUserMessagesPerConversation: number;
  avgBotMessagesPerConversation: number;
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

export default function Analytics() {
  const { settings } = useSettings();
  const [selectedBotId, setSelectedBotId] = useState<string>('');
  const [startDate, setStartDate] = useState<Date | undefined>(subDays(new Date(), 30));
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [analyticsData, setAnalyticsData] = useState<DailyAnalytics[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [sentimentData, setSentimentData] = useState<SentimentData[]>([]);
  const [resolutionData, setResolutionData] = useState<ResolutionData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  const client = useBotpressClient(selectedBotId);
  
  // Set default bot if none selected
  useEffect(() => {
    if (!selectedBotId && settings.bots.length > 0) {
      const firstConfiguredBot = settings.bots.find((bot: any) => bot.botId);
      if (firstConfiguredBot) {
        setSelectedBotId(firstConfiguredBot.botId);
      }
    }
  }, [settings.bots, selectedBotId]);

  // Calculate summary from analytics data
  const calculateSummary = useCallback((records: DailyAnalytics[]): AnalyticsSummary => {
    if (records.length === 0) {
      return {
        totalUsers: 0,
        totalUserMessages: 0,
        totalBotMessages: 0,
        totalConversations: 0,
        avgUserMessagesPerConversation: 0,
        avgBotMessagesPerConversation: 0
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
        : 0
    };
  }, []);

  // Fetch analytics data from conversationsAnalysisTable
  const fetchAnalytics = useCallback(async () => {
    if (!client || !selectedBotId || !startDate || !endDate) {
      toast.error('Please select a bot and date range');
      return;
    }

    setIsLoading(true);
    
    try {
      // Set end date to end of day (23:59:59.999) to include the entire last day
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      const startTimestamp = startDate.toISOString();
      const endTimestamp = endOfDay.toISOString();
      
      console.log('Fetching conversations from', startTimestamp, 'to', endTimestamp);
      
      // Fetch data with MongoDB-like filter to get only rows in date range
      let allRows: any[] = [];
      let currentOffset = 0;
      const batchSize = 1000; // Maximum allowed by API
      let hasMore = true;
      
      while (hasMore) {
        const params: any = {
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
          allRows = allRows.concat(response.rows);
          console.log(`Fetched ${response.rows.length} rows at offset ${currentOffset}, total: ${allRows.length}`);
        }
        
        // Check the hasMore flag from the API response
        hasMore = (response as any).hasMore === true;
        
        if (hasMore) {
          currentOffset += batchSize;
        }
      }
      
      if (allRows.length === 0) {
        toast.error('No conversation data available');
        setAnalyticsData([]);
        setSummary(null);
        setIsLoading(false);
        return;
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
      
      allRows.forEach((row: any) => {
        const convId = row.conversationId;
        
        // Skip rows without conversationId
        if (!convId) {
          console.warn('Row without conversationId:', row.id);
          return;
        }
        
        const createdAt = new Date(row.createdAt);
        
        // Keep only the most recent entry for each conversationId
        if (!conversationsMap.has(convId) || 
            new Date(conversationsMap.get(convId)!.createdAt) < createdAt) {
          conversationsMap.set(convId, {
            id: row.id,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            date: row.date,
            topics: row.topics || [],
            summary: row.summary || '',
            resolved: !!row.resolved,
            sentiment: row.sentiment || 'neutral',
            transcript: row.transcript || [],
            escalations: row.escalations || [],
            conversationId: row.conversationId
          });
        }
      });

      const uniqueConversations = Array.from(conversationsMap.values());
      console.log(`${uniqueConversations.length} unique conversations after deduplication`);

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
          conversations: metrics.conversations
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
        .filter(([_, value]) => value > 0)
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

      if (dailyAnalytics.length > 0) {
        setAnalyticsData(dailyAnalytics);
        setSummary(calculateSummary(dailyAnalytics));
        setSentimentData(sentimentDistribution);
        setResolutionData({ resolved: resolvedCount, unresolved: unresolvedCount, resolutionRate });
        toast.success(`Analytics data loaded for ${dailyAnalytics.length} days`);
      } else {
        toast.error('No analytics data found for this period');
        setAnalyticsData([]);
        setSummary(null);
        setSentimentData([]);
        setResolutionData(null);
      }
      
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Failed to fetch analytics data');
      setAnalyticsData([]);
      setSummary(null);
      setSentimentData([]);
      setResolutionData(null);
    } finally {
      setIsLoading(false);
    }
  }, [client, selectedBotId, startDate, endDate, calculateSummary]);

  // Auto-fetch when bot or dates change
  useEffect(() => {
    if (selectedBotId && startDate && endDate) {
      fetchAnalytics();
    }
  }, [selectedBotId, startDate, endDate, fetchAnalytics]);

  // Prepare chart data with properly formatted dates
  const chartData = analyticsData.map(record => {
    const dateObj = new Date(record.date);
    return {
      date: format(dateObj, 'MMM dd'),
      fullDate: format(dateObj, 'MMM dd, yyyy'),
      users: record.uniqueUsers,
      userMessages: record.userMessages,
      botMessages: record.botMessages,
    };
  });

  return (
    <div className="space-y-6 px-6 py-4">
      {/* Filters Card */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col gap-4">
            {/* Top row: Bot selector and description */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-muted-foreground">Bot:</span>
                <Select value={selectedBotId} onValueChange={setSelectedBotId}>
                  <SelectTrigger className="w-[180px] h-9">
                    <SelectValue placeholder="Select a bot" />
                  </SelectTrigger>
                  <SelectContent>
                    {settings.bots.map((bot: any) => (
                      <SelectItem key={bot.id} value={bot.botId}>
                        {bot.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-sm text-muted-foreground">
                Overview of your bot's performance and engagement
              </p>
            </div>
            
            {/* Divider */}
            <div className="border-t" />
            
            {/* Filter row */}
            <div className="flex flex-wrap items-end gap-4">
              {/* Date range */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Date Range
                </label>
                <div className="flex items-center gap-2">
                  <DatePicker
                    date={startDate}
                    setDate={setStartDate}
                    placeholder="Start"
                    className="w-[140px]"
                  />
                  <span className="text-muted-foreground">→</span>
                  <DatePicker
                    date={endDate}
                    setDate={setEndDate}
                    placeholder="End"
                    className="w-[140px]"
                  />
                </div>
              </div>
              
              {/* Update button */}
              <Button 
                onClick={fetchAnalytics} 
                disabled={isLoading || !selectedBotId}
                className="h-9"
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <BarChart3 className="mr-2 h-4 w-4" />
                )}
                Update View
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards - Row 1 */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 -mr-6 -mt-6 rounded-full bg-orange-500/10" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Conversations</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <MessageSquare className="h-4 w-4 text-orange-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{summary.totalConversations.toLocaleString()}</div>
              <p className="text-sm text-muted-foreground mt-1">
                {analyticsData.length > 0 && (
                  <span className="inline-flex items-center">
                    ~{Math.round(summary.totalConversations / analyticsData.length)} per day
                  </span>
                )}
              </p>
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 -mr-6 -mt-6 rounded-full bg-green-500/10" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Resolution Rate</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {resolutionData ? `${resolutionData.resolutionRate}%` : '—'}
              </div>
              <div className="flex items-center gap-3 mt-1">
                {resolutionData && (
                  <>
                    <span className="text-sm text-green-600">{resolutionData.resolved} ✓</span>
                    <span className="text-sm text-red-500">{resolutionData.unresolved} ✗</span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 -mr-6 -mt-6 rounded-full bg-teal-500/10" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">User Messages</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-teal-500/10 flex items-center justify-center">
                <Users className="h-4 w-4 text-teal-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{summary.totalUserMessages.toLocaleString()}</div>
              <p className="text-sm text-muted-foreground mt-1">
                ~{summary.avgUserMessagesPerConversation} per conversation
              </p>
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 -mr-6 -mt-6 rounded-full bg-purple-500/10" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Bot Responses</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Bot className="h-4 w-4 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{summary.totalBotMessages.toLocaleString()}</div>
              <p className="text-sm text-muted-foreground mt-1">
                ~{summary.avgBotMessagesPerConversation} per conversation
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts Row - Conversations over time + Sentiment Distribution */}
      {analyticsData.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          {/* Conversations Over Time - takes 2 columns */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Conversations Over Time</CardTitle>
              <CardDescription>Daily conversation volume</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart
                  data={chartData}
                  margin={{ left: 0, right: 12, top: 12, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#e76e50" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#e76e50" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    className="text-xs"
                  />
                  <YAxis 
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    className="text-xs"
                    width={40}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area 
                    name="Users"
                    dataKey="users" 
                    type="monotone" 
                    fill="url(#colorUsers)" 
                    stroke="#e76e50" 
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Sentiment Distribution - Horizontal Bars */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smile className="h-4 w-4" />
                Sentiment Distribution
              </CardTitle>
              <CardDescription>Conversation sentiment breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              {sentimentData.length > 0 ? (
                <div className="space-y-3">
                  {(() => {
                    const total = sentimentData.reduce((sum, d) => sum + d.value, 0);
                    return sentimentData.map((item) => {
                      const percent = total > 0 ? Math.round((item.value / total) * 100) : 0;
                      return (
                        <div key={item.name} className="space-y-1.5">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{item.name}</span>
                            <span className="text-muted-foreground">
                              {item.value} ({percent}%)
                            </span>
                          </div>
                          <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${percent}%`,
                                backgroundColor: item.color,
                              }}
                            />
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              ) : (
                <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                  <Meh className="h-8 w-8 mr-2" />
                  No sentiment data
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Second Charts Row - Messages + Resolution */}
      {analyticsData.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          {/* User Messages Over Time */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>User Messages Over Time</CardTitle>
              <CardDescription>Daily user message volume</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart
                  data={chartData}
                  margin={{ left: 0, right: 12, top: 12, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorUserMessages" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2a9d90" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#2a9d90" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    className="text-xs"
                  />
                  <YAxis 
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    className="text-xs"
                    width={40}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area 
                    name="User Messages"
                    dataKey="userMessages" 
                    type="monotone" 
                    fill="url(#colorUserMessages)" 
                    stroke="#2a9d90" 
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Resolution Rate Visual */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Resolution Status
              </CardTitle>
              <CardDescription>Resolved vs unresolved conversations</CardDescription>
            </CardHeader>
            <CardContent>
              {resolutionData ? (
                <div className="space-y-6">
                  {/* Circular progress indicator */}
                  <div className="flex flex-col items-center justify-center">
                    <div className="relative">
                      <svg className="h-32 w-32 transform -rotate-90">
                        <circle
                          className="text-muted stroke-current"
                          strokeWidth="12"
                          fill="transparent"
                          r="52"
                          cx="64"
                          cy="64"
                        />
                        <circle
                          className="text-green-500 stroke-current transition-all duration-500"
                          strokeWidth="12"
                          strokeLinecap="round"
                          fill="transparent"
                          r="52"
                          cx="64"
                          cy="64"
                          strokeDasharray={`${resolutionData.resolutionRate * 3.27} 327`}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-bold">{resolutionData.resolutionRate}%</span>
                        <span className="text-xs text-muted-foreground">Resolved</span>
                      </div>
                    </div>
                  </div>

                  {/* Stats bars */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-green-500" />
                        <span className="text-sm">Resolved</span>
                      </div>
                      <span className="font-medium">{resolutionData.resolved}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-red-500" />
                        <span className="text-sm">Unresolved</span>
                      </div>
                      <span className="font-medium">{resolutionData.unresolved}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[260px] text-muted-foreground">
                  <XCircle className="h-8 w-8 mr-2" />
                  No resolution data
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && analyticsData.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Analytics Data</h3>
            <p className="text-muted-foreground text-center max-w-md">
              Select a bot and date range, then click "Update View" to load analytics data.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
