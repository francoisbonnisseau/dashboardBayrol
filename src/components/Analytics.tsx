import { useState, useEffect } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useBotpressClient } from '../hooks/useBotpressClient';
import {
  PageHeader,
  FilterBar,
  EmptyState,
  LoadingState,
  ErrorState,
} from '@/components/dashboard';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { subDays } from 'date-fns';
import { toast } from 'sonner';
import { useAnalytics } from '@/queries/useAnalytics';
import { AnalyticsOverview } from '@/features/analytics/AnalyticsOverview';

// Keep the original rolling start timestamp stable across screen remounts.
const DEFAULT_START_DATE = subDays(new Date(), 30);

export default function Analytics() {
  const { settings } = useSettings();
  const [selectedBotId, setSelectedBotId] = useState<string>('');
  const [startDate, setStartDate] = useState<Date | undefined>(
    () => new Date(DEFAULT_START_DATE),
  );
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const client = useBotpressClient(selectedBotId);
  const analyticsQuery = useAnalytics(
    client,
    settings.workspaceId,
    selectedBotId,
    startDate,
    endDate,
  );
  const analyticsData = analyticsQuery.data?.analyticsData ?? [];
  const isLoading = analyticsQuery.isFetching;
  const fetchAnalytics = () => {
    void analyticsQuery.refetch();
  };

  useEffect(() => {
    if (analyticsQuery.error) toast.error('Failed to fetch analytics data');
  }, [analyticsQuery.error]);
  useEffect(() => {
    if (analyticsQuery.data?.aiCostUnavailable)
      toast.error('Failed to fetch AI cost analytics');
  }, [analyticsQuery.data]);
  useEffect(() => {
    if (!analyticsQuery.isFetchedAfterMount || !analyticsQuery.data) return;
    const days = analyticsQuery.data.analyticsData.length;
    if (days) toast.success(`Analytics data loaded for ${days} days`);
    else toast.error('No analytics data found for this period');
  }, [
    analyticsQuery.dataUpdatedAt,
    analyticsQuery.isFetchedAfterMount,
    analyticsQuery.data,
  ]);

  // Set default bot if none selected
  useEffect(() => {
    if (!selectedBotId && settings.bots.length > 0) {
      const firstConfiguredBot = settings.bots.find((bot) => bot.botId);
      if (firstConfiguredBot) {
        setSelectedBotId(firstConfiguredBot.botId);
      }
    }
  }, [settings.bots, selectedBotId]);

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Conversation performance at a glance"
        actions={
          <Select value={selectedBotId} onValueChange={setSelectedBotId}>
            <SelectTrigger aria-label="Bot" className="w-[160px]">
              <SelectValue placeholder="Select a bot" />
            </SelectTrigger>
            <SelectContent>
              {settings.bots
                .filter((bot) => bot.botId)
                .map((bot) => (
                  <SelectItem key={bot.id} value={bot.botId}>
                    {bot.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        }
      />
      <FilterBar>
        <span className="mr-2 text-xs font-medium text-muted-foreground">
          Period
        </span>
        <DatePicker
          date={startDate}
          setDate={setStartDate}
          placeholder="Start date"
        />
        <span className="px-1 text-xs text-muted-foreground" aria-hidden="true">
          –
        </span>
        <DatePicker
          date={endDate}
          setDate={setEndDate}
          placeholder="End date"
        />
        <Button
          variant="outline"
          onClick={fetchAnalytics}
          disabled={isLoading || !selectedBotId}
        >
          <RefreshCw
            className={
              isLoading ? 'size-3.5 motion-safe:animate-spin' : 'size-3.5'
            }
          />
          Update view
        </Button>
      </FilterBar>
      {analyticsQuery.error && (
        <ErrorState
          title="Unable to load analytics"
          onRetry={fetchAnalytics}
          retrying={isLoading}
        />
      )}
      {isLoading && (
        <LoadingState
          variant={analyticsQuery.data ? 'inline' : 'page'}
          label="Updating analytics…"
        />
      )}
      {analyticsQuery.data && <AnalyticsOverview data={analyticsQuery.data} />}
      {!isLoading && !analyticsQuery.error && !analyticsData.length && (
        <EmptyState
          title="No analytics data"
          description="Select a bot and date range, then update the view."
          action={
            <Button onClick={fetchAnalytics} disabled={!selectedBotId}>
              Update view
            </Button>
          }
        />
      )}
    </>
  );
}
