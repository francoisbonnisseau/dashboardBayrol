import { useState, useEffect, useCallback } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useBotpressClient } from '../hooks/useBotpressClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Button } from '@/components/ui/button';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Loader2, Users, MessageSquare, BarChart3 } from 'lucide-react';
import { subDays, format } from 'date-fns';
import { toast } from 'sonner';
import { Area, AreaChart, XAxis, ResponsiveContainer, CartesianGrid } from 'recharts';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalUsers.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Unique interactions</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversations</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalConversations.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Total sessions</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">User Messages</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalUserMessages.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Avg {summary.avgMessagesPerConversation} per conv</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Bot Messages</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalBotMessages.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Automated replies</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts */}
      {analyticsData.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Unique Users</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer
                  config={{
                    users: {
                      label: "Users",
                      color: "hsl(var(--chart-1))",
                    },
                  }}
                  className="h-[300px] w-full"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={chartData}
                      margin={{
                        left: 12,
                        right: 12,
                      }}
                    >
                      <CartesianGrid vertical={false} />
                      <XAxis 
                        dataKey="date" 
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                      />
                      <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
                      <Area 
                        dataKey="users" 
                        type="natural" 
                        fill="var(--color-users)" 
                        fillOpacity={0.4} 
                        stroke="var(--color-users)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>User Messages</CardTitle>
            </CardHeader>
            <CardContent>
               <ChartContainer
                  config={{
                    userMessages: {
                      label: "User Messages",
                      color: "hsl(var(--chart-2))",
                    },
                  }}
                  className="h-[300px] w-full"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={chartData}
                      margin={{
                        left: 12,
                        right: 12,
                      }}
                    >
                      <CartesianGrid vertical={false} />
                      <XAxis 
                        dataKey="date" 
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                      />
                      <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
                      <Area 
                        dataKey="userMessages" 
                        type="natural" 
                        fill="var(--color-userMessages)" 
                        fillOpacity={0.4} 
                        stroke="var(--color-userMessages)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Table */}
      {analyticsData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Daily Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('date')}>Date</TableHead>
                  <TableHead className="text-right cursor-pointer" onClick={() => handleSort('users')}>Users</TableHead>
                  <TableHead className="text-right cursor-pointer" onClick={() => handleSort('userMessages')}>User Msgs</TableHead>
                  <TableHead className="text-right cursor-pointer" onClick={() => handleSort('botMessages')}>Bot Msgs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedData.map((record, index) => {
                   let formattedDate = record.date;
                    try {
                      const dateObj = new Date(record.date);
                      if (!isNaN(dateObj.getTime())) {
                        formattedDate = format(dateObj, 'MMM dd, yyyy');
                      }
                    } catch (e) {}
                  return (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{formattedDate}</TableCell>
                      <TableCell className="text-right">{record.uniqueUsers}</TableCell>
                      <TableCell className="text-right">{record.userMessages}</TableCell>
                      <TableCell className="text-right">{record.botMessages}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
