import { useState, useEffect, useCallback } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useBotpressClient } from '../hooks/useBotpressClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Loader2, Users, MessageSquare, BarChart3, Calendar } from 'lucide-react';
import { subDays, format } from 'date-fns';
import { toast } from 'sonner';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Bar, BarChart as RechartsBarChart } from 'recharts';

const TABLE_NAME = 'conversationsAnalysisTable';

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
  avgMessagesPerConversation: number;
}

type SortField = 'date' | 'users' | 'userMessages' | 'botMessages';
type SortDirection = 'asc' | 'desc';

export default function Analytics() {
  const { settings } = useSettings();
  const [selectedBotId, setSelectedBotId] = useState<string>('');
  const [startDate, setStartDate] = useState<Date | undefined>(subDays(new Date(), 30));
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [analyticsData, setAnalyticsData] = useState<DailyAnalytics[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
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
        avgMessagesPerConversation: 0
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
      avgMessagesPerConversation: totalConversations > 0 
        ? Math.round((totalUserMessages + totalBotMessages) / totalConversations * 10) / 10 
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

      if (dailyAnalytics.length > 0) {
        setAnalyticsData(dailyAnalytics);
        setSummary(calculateSummary(dailyAnalytics));
        toast.success(`Analytics data loaded for ${dailyAnalytics.length} days`);
      } else {
        toast.error('No analytics data found for this period');
        setAnalyticsData([]);
        setSummary(null);
      }
      
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Failed to fetch analytics data');
      setAnalyticsData([]);
      setSummary(null);
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

  const selectedBot = settings.bots.find((bot: any) => bot.botId === selectedBotId);

  // Sort data for table
  const sortedData = [...analyticsData].sort((a, b) => {
    let aValue: number | string;
    let bValue: number | string;

    switch (sortField) {
      case 'date':
        aValue = new Date(a.date).getTime();
        bValue = new Date(b.date).getTime();
        break;
      case 'users':
        aValue = a.uniqueUsers;
        bValue = b.uniqueUsers;
        break;
      case 'userMessages':
        aValue = a.userMessages;
        bValue = b.userMessages;
        break;
      case 'botMessages':
        aValue = a.botMessages;
        bValue = b.botMessages;
        break;
      default:
        return 0;
    }

    if (sortDirection === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  // Handle sort column click
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

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
    <div className="w-full min-h-screen bg-gradient-to-br from-background to-muted/20">
      <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8 max-w-7xl space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Bot Analytics
            </h1>
            <p className="text-muted-foreground mt-2">
              Performance metrics and usage statistics overview
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Label className="text-sm font-medium">Bot:</Label>
            <Select value={selectedBotId} onValueChange={setSelectedBotId}>
              <SelectTrigger className="w-64">
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
        </div>

        {/* Date Range Selection */}
        <Card className="border-2 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Analysis Period
            </CardTitle>
            <CardDescription>
              Select the period for which you want to view analytics data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-end gap-4">
              <div className="space-y-2 flex-1 w-full">
                <Label>Start Date</Label>
                <DatePicker date={startDate} setDate={setStartDate} />
              </div>
              <div className="space-y-2 flex-1 w-full">
                <Label>End Date</Label>
                <DatePicker date={endDate} setDate={setEndDate} />
              </div>
              <Button 
                onClick={fetchAnalytics} 
                disabled={isLoading || !selectedBotId}
                className="px-8 w-full sm:w-auto"
                size="lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <BarChart3 className="mr-2 h-4 w-4" />
                    Load Data
                  </>
                )}
              </Button>
            </div>
            {selectedBot && (
              <div className="mt-4 p-3 bg-primary/5 rounded-lg border border-primary/10">
                <p className="text-sm text-muted-foreground">
                  Analyzing: <span className="font-semibold text-foreground">{selectedBot.name}</span>
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary Cards */}
        {summary && (
          <div className="grid gap-6 md:grid-cols-3 lg:grid-cols-3">
            <Card className="border-2 hover:shadow-xl transition-shadow duration-300 bg-gradient-to-br from-purple-50 to-background dark:from-purple-950/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Unique Users</CardTitle>
                <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                  {summary.totalUsers.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Based on unique conversation IDs
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:shadow-xl transition-shadow duration-300 bg-gradient-to-br from-green-50 to-background dark:from-green-950/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">User Messages</CardTitle>
                <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                  <MessageSquare className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {summary.totalUserMessages.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {summary.avgMessagesPerConversation} avg per conversation
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:shadow-xl transition-shadow duration-300 bg-gradient-to-br from-orange-50 to-background dark:from-orange-950/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Bot Messages</CardTitle>
                <div className="h-10 w-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                  <MessageSquare className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                  {summary.totalBotMessages.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Automated responses
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Charts - Side by side */}
        {analyticsData.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Users Chart */}
            <Card className="border-2 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Unique Users Over Time
                </CardTitle>
                <CardDescription>
                  Daily evolution of unique users
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    users: {
                      label: "Users",
                      color: "hsl(var(--chart-2))",
                    },
                  }}
                  className="h-[350px] w-full"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="date" 
                        className="text-xs"
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <YAxis 
                        className="text-xs"
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <ChartTooltip 
                        content={<ChartTooltipContent />}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="users" 
                        stroke="hsl(var(--chart-2))" 
                        fillOpacity={1} 
                        fill="url(#colorUsers)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Messages Chart */}
            <Card className="border-2 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  User vs Bot Messages
                </CardTitle>
                <CardDescription>
                  Comparison of messages sent by users and bot
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    userMessages: {
                      label: "User Messages",
                      color: "hsl(var(--chart-3))",
                    },
                    botMessages: {
                      label: "Bot Messages",
                      color: "hsl(var(--chart-4))",
                    },
                  }}
                  className="h-[350px] w-full"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="date" 
                        className="text-xs"
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <YAxis 
                        className="text-xs"
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <ChartTooltip 
                        content={<ChartTooltipContent />}
                      />
                      <Bar 
                        dataKey="userMessages" 
                        fill="hsl(var(--chart-3))" 
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar 
                        dataKey="botMessages" 
                        fill="hsl(var(--chart-4))" 
                        radius={[4, 4, 0, 0]}
                      />
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Detailed Data Table */}
        {analyticsData.length > 0 && (
          <Card className="border-2 shadow-lg">
            <CardHeader>
              <CardTitle>Daily Breakdown</CardTitle>
              <CardDescription>
                Detailed analytics data for each day in the selected period. Click column headers to sort.
              </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="relative overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase bg-muted/50">
                      <tr>
                        <th 
                          className="px-6 py-4 text-left font-semibold cursor-pointer hover:bg-muted/70 transition-colors"
                          onClick={() => handleSort('date')}
                        >
                          <div className="flex items-center gap-2">
                            Date
                            {sortField === 'date' && (
                              <span className="text-primary">
                                {sortDirection === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </div>
                        </th>
                        <th 
                          className="px-6 py-4 text-right font-semibold cursor-pointer hover:bg-muted/70 transition-colors"
                          onClick={() => handleSort('users')}
                        >
                          <div className="flex items-center justify-end gap-2">
                            Users
                            {sortField === 'users' && (
                              <span className="text-primary">
                                {sortDirection === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </div>
                        </th>
                        <th 
                          className="px-6 py-4 text-right font-semibold cursor-pointer hover:bg-muted/70 transition-colors"
                          onClick={() => handleSort('userMessages')}
                        >
                          <div className="flex items-center justify-end gap-2">
                            User Msgs
                            {sortField === 'userMessages' && (
                              <span className="text-primary">
                                {sortDirection === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </div>
                        </th>
                        <th 
                          className="px-6 py-4 text-right font-semibold cursor-pointer hover:bg-muted/70 transition-colors"
                          onClick={() => handleSort('botMessages')}
                        >
                          <div className="flex items-center justify-end gap-2">
                            Bot Msgs
                            {sortField === 'botMessages' && (
                              <span className="text-primary">
                                {sortDirection === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {sortedData.map((record, index) => {
                        // Safely format the date, fallback to raw string if invalid
                        let formattedDate = record.date;
                        try {
                          const dateObj = new Date(record.date);
                          if (!isNaN(dateObj.getTime())) {
                            formattedDate = format(dateObj, 'MMM dd, yyyy');
                          }
                        } catch (e) {
                          console.warn('Invalid date:', record.date);
                        }
                        
                        return (
                          <tr key={index} className="hover:bg-muted/30 transition-colors">
                            <td className="px-6 py-4 font-medium">
                              {formattedDate}
                            </td>
                            <td className="px-6 py-4 text-right font-semibold text-purple-600 dark:text-purple-400">
                              {record.uniqueUsers}
                            </td>
                            <td className="px-6 py-4 text-right font-semibold text-green-600 dark:text-green-400">
                              {record.userMessages}
                            </td>
                            <td className="px-6 py-4 text-right font-semibold text-orange-600 dark:text-orange-400">
                              {record.botMessages}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
        )}

        {/* Empty State */}
        {!isLoading && analyticsData.length === 0 && selectedBotId && (
          <Card className="border-2">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mb-4">
                <BarChart3 className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No Data Available</h3>
              <p className="text-muted-foreground text-center max-w-md">
                No analytics data is available for the selected period. 
                Try selecting a different date range or check if your bot has received any interactions.
              </p>
            </CardContent>
          </Card>
        )}

        {/* No Bot Selected */}
        {!selectedBotId && (
          <Card className="border-2">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <BarChart3 className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Select a Bot</h3>
              <p className="text-muted-foreground text-center max-w-md">
                Please select a bot from the dropdown above to view its analytics data.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
