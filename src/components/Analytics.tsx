import { useState, useEffect } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useBotpressClient } from '../hooks/useBotpressClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Button } from '@/components/ui/button';
import { Loader2, Users, MessageSquare, BarChart3, CheckCircle2, XCircle, Smile, Meh, Bot, Sparkles } from 'lucide-react';
import { subDays, format } from 'date-fns';
import { toast } from 'sonner';
import { Area, AreaChart, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Tooltip } from 'recharts';
import { useAnalytics } from '@/queries/useAnalytics';

// Keep the original rolling start timestamp stable across screen remounts.
const DEFAULT_START_DATE = subDays(new Date(), 30);

// Custom tooltip for charts
interface ChartPayloadItem {
  name?: string;
  value?: number | string;
  color?: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: ChartPayloadItem[];
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3">
        <p className="font-medium text-sm mb-1 text-gray-900 dark:text-gray-100">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

function formatUsd(value: number, fractionDigits: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export default function Analytics() {
  const { settings } = useSettings();
  const [selectedBotId, setSelectedBotId] = useState<string>('');
  const [startDate, setStartDate] = useState<Date | undefined>(() => new Date(DEFAULT_START_DATE));
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const client = useBotpressClient(selectedBotId);
  const analyticsQuery = useAnalytics(client, settings.workspaceId, selectedBotId, startDate, endDate);
  const analyticsData = analyticsQuery.data?.analyticsData ?? [];
  const summary = analyticsQuery.data?.summary ?? null;
  const sentimentData = analyticsQuery.data?.sentimentData ?? [];
  const resolutionData = analyticsQuery.data?.resolutionData ?? null;
  const isLoading = analyticsQuery.isFetching;
  const fetchAnalytics = () => { void analyticsQuery.refetch(); };

  useEffect(() => {
    if (analyticsQuery.error) toast.error('Failed to fetch analytics data');
  }, [analyticsQuery.error]);
  useEffect(() => {
    if (analyticsQuery.data?.aiCostUnavailable) toast.error('Failed to fetch AI cost analytics');
  }, [analyticsQuery.data]);
  useEffect(() => {
    if (!analyticsQuery.isFetchedAfterMount || !analyticsQuery.data) return;
    const days = analyticsQuery.data.analyticsData.length;
    if (days) toast.success(`Analytics data loaded for ${days} days`);
    else toast.error('No analytics data found for this period');
  }, [analyticsQuery.dataUpdatedAt, analyticsQuery.isFetchedAfterMount, analyticsQuery.data]);

  // Set default bot if none selected
  useEffect(() => {
    if (!selectedBotId && settings.bots.length > 0) {
      const firstConfiguredBot = settings.bots.find((bot) => bot.botId);
      if (firstConfiguredBot) {
        setSelectedBotId(firstConfiguredBot.botId);
      }
    }
  }, [settings.bots, selectedBotId]);

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
                    {settings.bots.filter((bot) => bot.botId).map((bot) => (
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
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
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 -mr-6 -mt-6 rounded-full bg-sky-500/10" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">AI Cost / Conversation</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-sky-500/10 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-sky-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {summary.avgAiCostPerConversationUsd === null
                  ? '-'
                  : formatUsd(summary.avgAiCostPerConversationUsd, 4)}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {summary.totalAiCostUsd === null
                  ? 'AI spend unavailable'
                  : `${formatUsd(summary.totalAiCostUsd, 4)} total AI spend`}
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
