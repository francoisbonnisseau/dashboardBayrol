import {
  useSentimentRows,
  useSentimentTable,
} from '@/queries/useSentimentRows';
import { getAllSentimentRows } from '@/api/botpress/sentiment';
import { ToggleSwitch } from '@/components/dashboard/ToggleSwitch';
import { useState, useEffect, useCallback } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useBotpressClient } from '../hooks/useBotpressClient';
import {
  PageHeader,
  FilterBar,
  DataTableShell,
  PaginationBar,
  StatusBadge,
  EmptyState,
  ErrorState,
} from '@/components/dashboard';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DatePicker } from '@/components/ui/date-picker';
import {
  RefreshCw,
  BarChart3,
  ThumbsUp,
  ThumbsDown,
  CheckCircle2,
  XCircle,
  Download,
} from 'lucide-react';
import { subDays } from 'date-fns';
import ConversationDetail from './ConversationDetail';
import { formatBotpressError } from '@/lib/errorMessages';

// Keep the initial range stable across navigation while preserving its original time bounds.
const initialStartDate = subDays(new Date(), 2);
const initialEndDate = new Date();

export default function SentimentAnalysis() {
  const { settings } = useSettings();
  const [selectedBotId, setSelectedBotId] = useState<string>('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  // Filter states
  const [sentimentFilter, setSentimentFilter] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState<boolean>(false);
  const [startDate, setStartDate] = useState<Date | undefined>(
    initialStartDate,
  );
  const [endDate, setEndDate] = useState<Date | undefined>(initialEndDate);
  const [currentPage, setCurrentPage] = useState(0);

  // Conversation detail states
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const [conversationSheetOpen, setConversationSheetOpen] =
    useState<boolean>(false);

  const client = useBotpressClient(selectedBotId);

  const rowsQuery = useSentimentRows(
    client,
    settings.workspaceId,
    selectedBotId,
    {
      page: currentPage,
      sentiment: sentimentFilter,
      showResolved,
      startDate,
      endDate,
    },
  );
  const tableQuery = useSentimentTable(
    client,
    settings.workspaceId,
    selectedBotId,
  );
  const rows = rowsQuery.data?.rows ?? [];
  const filteredRows = rows;
  const hasMore = rowsQuery.data?.hasMore ?? false;
  const tableInfo = tableQuery.data;
  const loading = rowsQuery.isFetching || tableQuery.isFetching || exporting;
  const error =
    exportError ||
    (rowsQuery.error
      ? formatBotpressError(rowsQuery.error, 'Failed to fetch rows')
      : tableQuery.error
        ? formatBotpressError(
            tableQuery.error,
            'Failed to fetch table information',
          )
        : null);
  const fetchTableInfo = () => {
    void rowsQuery.refetch();
    void tableQuery.refetch();
  };

  // Set default bot if none selected
  useEffect(() => {
    if (!selectedBotId && settings.bots.length > 0) {
      const firstConfiguredBot = settings.bots.find((bot) => bot.botId);
      if (firstConfiguredBot) {
        setSelectedBotId(firstConfiguredBot.botId);
      }
    }
  }, [settings.bots, selectedBotId]);

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get icon based on sentiment
  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'very negative':
        return <ThumbsDown className="h-3.5 w-3.5 fill-current" />;
      case 'negative':
        return <ThumbsDown className="h-3.5 w-3.5" />;
      case 'positive':
        return <ThumbsUp className="h-3.5 w-3.5" />;
      case 'very positive':
        return <ThumbsUp className="h-3.5 w-3.5 fill-current" />;
      default:
        return <BarChart3 className="h-3.5 w-3.5" />;
    }
  }; // Handle row click to show conversation
  const handleRowClick = useCallback((conversationId: string) => {
    setSelectedConversationId(conversationId);
    setConversationSheetOpen(true);
  }, []);

  // Download conversations in JSON format with simplified structure
  const downloadConversations = useCallback(async () => {
    if (!client) return;

    setExporting(true);
    setExportError(null);

    try {
      const exportRows = await getAllSentimentRows(client, {
        sentiment: sentimentFilter,
        showResolved,
        startDate,
        endDate,
      });
      // Fetch full conversation details for each filtered conversation
      const conversationsData = [];

      for (const row of exportRows) {
        try {
          // Get messages for this conversation
          const response = await client.listMessages({
            conversationId: row.conversationId,
          });
          if (response && response.messages && response.messages.length > 1) {
            // Only include conversations with more than one message
            const conversation: Record<string, string> = {};
            let messageIndex = 1;

            // Reverse messages to get chronological order (oldest first)
            const orderedMessages = [...response.messages].reverse();

            // Build conversation object with user/bot alternating structure
            orderedMessages.forEach((message) => {
              const role = message.direction === 'incoming' ? 'user' : 'bot';
              const key = `${role}${messageIndex}`;
              conversation[key] = message.payload?.text || '';

              // Increment index for alternating messages
              if (message.direction === 'outgoing') {
                messageIndex++;
              }
            });

            conversationsData.push({
              date: row.date,
              conversation: conversation,
            });
          }
        } catch (error) {
          console.error(
            `Error fetching messages for conversation ${row.conversationId}:`,
            error,
          );
          // Skip conversations that can't be fetched
        }
      }

      // Create JSON content
      const jsonContent = JSON.stringify(conversationsData, null, 2);

      // Create and download file
      const blob = new Blob([jsonContent], {
        type: 'application/json;charset=utf-8;',
      });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);

      // Create filename with current date and filter info
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD format
      const sentimentStr = sentimentFilter
        ? `_${sentimentFilter.replace(' ', '-')}`
        : '_all-sentiments';
      const resolvedStr = showResolved
        ? '_including-resolved'
        : '_unresolved-only';

      // Add date range to filename if specified
      let dateRangeStr = '';
      if (startDate || endDate) {
        const formatDate = (date: Date) => date.toISOString().split('T')[0];
        if (startDate && endDate) {
          dateRangeStr = `_from-${formatDate(startDate)}-to-${formatDate(endDate)}`;
        } else if (startDate) {
          dateRangeStr = `_from-${formatDate(startDate)}`;
        } else if (endDate) {
          dateRangeStr = `_until-${formatDate(endDate)}`;
        }
      }

      const filename = `conversations_${dateStr}${sentimentStr}${resolvedStr}${dateRangeStr}.json`;

      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      setExportError(formatBotpressError(error, 'Failed to export data'));
      console.error('Error downloading conversations:', error);
    } finally {
      setExporting(false);
    }
  }, [client, sentimentFilter, showResolved, startDate, endDate]);

  const resetFilters = () => {
    setCurrentPage(0);
    setStartDate(subDays(new Date(), 2));
    setEndDate(new Date());
    setSentimentFilter(null);
    setShowResolved(false);
  };
  return (
    <>
      <PageHeader
        title="Sentiment"
        description="Review conversation sentiment and resolution"
        actions={
          <Select
            value={selectedBotId}
            onValueChange={(id) => {
              setCurrentPage(0);
              setSelectedConversationId(null);
              setSelectedBotId(id);
            }}
          >
            <SelectTrigger aria-label="Bot" className="w-[180px]">
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
      {error && (
        <ErrorState
          title="Unable to load or export conversations"
          description={error}
          onRetry={fetchTableInfo}
          retrying={loading}
        />
      )}
      <DataTableShell
        label="Sentiment"
        loading={rowsQuery.isPending && !!client}
        refreshing={rowsQuery.isFetching && !!rowsQuery.data}
        empty={rows.length === 0}
        emptyState={
          <EmptyState
            title="No conversations found"
            description="Select a configured bot or adjust the filters."
            action={
              <Button variant="outline" onClick={resetFilters}>
                Reset filters
              </Button>
            }
          />
        }
        toolbar={
          <FilterBar onReset={resetFilters}>
            <Select
              value={sentimentFilter || 'all'}
              onValueChange={(value) => {
                setCurrentPage(0);
                setSentimentFilter(value === 'all' ? null : value);
              }}
            >
              <SelectTrigger aria-label="Sentiment" className="w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[
                  'all',
                  'very negative',
                  'negative',
                  'neutral',
                  'positive',
                  'very positive',
                ].map((value) => (
                  <SelectItem key={value} value={value}>
                    {value === 'all' ? 'All sentiments' : value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DatePicker
              date={startDate}
              setDate={(date) => {
                setCurrentPage(0);
                setStartDate(date);
              }}
              placeholder="Start date"
            />
            <DatePicker
              date={endDate}
              setDate={(date) => {
                setCurrentPage(0);
                setEndDate(date);
              }}
              placeholder="End date"
            />
            <div className="border-x px-3">
              <ToggleSwitch
                label="Unresolved only"
                checked={!showResolved}
                onCheckedChange={(checked) => {
                  setCurrentPage(0);
                  setShowResolved(!checked);
                }}
              />
            </div>
            <Button
              onClick={fetchTableInfo}
              disabled={loading || !client}
              variant="outline"
            >
              <RefreshCw className="size-4" />
              Refresh
            </Button>
            <Button
              onClick={downloadConversations}
              disabled={loading || !client || (!hasMore && !rows.length)}
              variant="outline"
            >
              <Download className="size-4" />
              {exporting ? 'Exporting…' : 'Export'}
            </Button>
          </FilterBar>
        }
        pagination={
          <PaginationBar
            summary={`Page ${currentPage + 1}`}
            hasPrevious={currentPage > 0}
            hasNext={hasMore}
            busy={rowsQuery.isFetching}
            onPrevious={() => setCurrentPage((page) => Math.max(0, page - 1))}
            onNext={() => setCurrentPage((page) => page + 1)}
          />
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Topics</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sentiment</TableHead>
              <TableHead>Conversation ID</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.map((row) => (
              <TableRow
                key={row.id}
                className="cursor-pointer"
                onClick={() => handleRowClick(row.conversationId)}
              >
                <TableCell className="whitespace-nowrap">
                  {formatDate(row.date)}
                </TableCell>
                <TableCell
                  className="max-w-[240px] truncate"
                  title={row.topics || ''}
                >
                  {row.topics || '—'}
                </TableCell>
                <TableCell>
                  <StatusBadge variant={row.resolved ? 'success' : 'danger'}>
                    {row.resolved ? (
                      <CheckCircle2 className="size-3" />
                    ) : (
                      <XCircle className="size-3" />
                    )}
                    {row.resolved ? 'Resolved' : 'Unresolved'}
                  </StatusBadge>
                </TableCell>
                <TableCell>
                  <StatusBadge
                    variant={
                      row.sentiment.includes('negative')
                        ? 'danger'
                        : row.sentiment.includes('positive')
                          ? 'success'
                          : 'neutral'
                    }
                  >
                    {getSentimentIcon(row.sentiment)}
                    {row.sentiment}
                  </StatusBadge>
                </TableCell>
                <TableCell>
                  <Button
                    variant="link"
                    className="h-auto p-0 font-mono text-xs"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleRowClick(row.conversationId);
                    }}
                  >
                    {row.conversationId}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataTableShell>
      {tableInfo && (
        <p className="text-xs text-muted-foreground">
          Total rows: {tableInfo.rows} · Stale: {tableInfo.stale} · Indexing:{' '}
          {tableInfo.indexing}
        </p>
      )}
      {selectedConversationId && (
        <ConversationDetail
          key={selectedConversationId}
          botId={selectedBotId}
          conversationId={selectedConversationId}
          open={conversationSheetOpen}
          onClose={() => {
            setConversationSheetOpen(false);
            setSelectedConversationId(null);
          }}
        />
      )}
    </>
  );
}
