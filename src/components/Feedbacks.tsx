import { useFeedbackRows, useFeedbackTable } from '@/queries/useFeedbackRows';
import { getAllFeedbackRows, type FeedbackRow } from '@/api/botpress/feedbacks';
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
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Download,
} from 'lucide-react';
import FeedbackConversationDetail from './FeedbackConversationDetail';
import { formatBotpressError } from '@/lib/errorMessages';

export default function Feedbacks() {
  const { settings } = useSettings();
  const [selectedBotId, setSelectedBotId] = useState<string>('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(0);
  // Filter states
  const [reactionFilter, setReactionFilter] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  // Conversation detail states
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackRow | null>(
    null,
  );
  const [conversationSheetOpen, setConversationSheetOpen] =
    useState<boolean>(false);

  const client = useBotpressClient(selectedBotId);

  const rowsQuery = useFeedbackRows(
    client,
    settings.workspaceId,
    selectedBotId,
    { page: currentPage, reaction: reactionFilter, startDate, endDate },
  );
  const tableQuery = useFeedbackTable(
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

  // Get icon based on reaction
  const getReactionIcon = (reaction: string) => {
    switch (reaction) {
      case 'negative':
        return <ThumbsDown className="h-3.5 w-3.5" />;
      case 'positive':
        return <ThumbsUp className="h-3.5 w-3.5" />;
      default:
        return <MessageSquare className="h-3.5 w-3.5" />;
    }
  };

  // Handle row click to show conversation
  const handleRowClick = useCallback((feedback: FeedbackRow) => {
    setSelectedFeedback(feedback);
    setConversationSheetOpen(true);
  }, []);

  // Download feedbacks in JSON format
  const downloadFeedbacks = useCallback(async () => {
    if (!client) return;

    setExporting(true);
    setExportError(null);

    try {
      const exportRows = await getAllFeedbackRows(client, {
        reaction: reactionFilter,
        startDate,
        endDate,
      });
      // Create JSON content
      const jsonContent = JSON.stringify(exportRows, null, 2);

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
      const reactionStr = reactionFilter
        ? `_${reactionFilter}`
        : '_all-reactions';

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

      const filename = `feedbacks_${dateStr}${reactionStr}${dateRangeStr}.json`;

      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      setExportError(formatBotpressError(error, 'Failed to export data'));
      console.error('Error downloading feedbacks:', error);
    } finally {
      setExporting(false);
    }
  }, [client, reactionFilter, startDate, endDate]);

  const resetFilters = () => {
    setCurrentPage(0);
    setReactionFilter(null);
    setStartDate(undefined);
    setEndDate(undefined);
  };
  return (
    <>
      <PageHeader
        title="Feedbacks"
        description="Review reactions and comments on assistant responses"
        actions={
          <Select
            value={selectedBotId}
            onValueChange={(id) => {
              setCurrentPage(0);
              setSelectedFeedback(null);
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
          title="Unable to load or export feedback"
          description={error}
          onRetry={fetchTableInfo}
          retrying={loading}
        />
      )}
      <DataTableShell
        label="Feedbacks"
        loading={rowsQuery.isPending && !!client}
        refreshing={rowsQuery.isFetching && !!rowsQuery.data}
        empty={!filteredRows.length}
        emptyState={
          <EmptyState
            title="No feedback found"
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
              value={reactionFilter || 'all'}
              onValueChange={(value) => {
                setCurrentPage(0);
                setReactionFilter(value === 'all' ? null : value);
              }}
            >
              <SelectTrigger aria-label="Reaction" className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All reactions</SelectItem>
                <SelectItem value="positive">Positive</SelectItem>
                <SelectItem value="negative">Negative</SelectItem>
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
            <Button
              variant="outline"
              onClick={fetchTableInfo}
              disabled={loading || !client}
            >
              <RefreshCw className="size-4" />
              Refresh
            </Button>
            <Button
              variant="outline"
              onClick={downloadFeedbacks}
              disabled={loading || !client || (!hasMore && !rows.length)}
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
              <TableHead>Reaction</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>Comment</TableHead>
              <TableHead>Conversation</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.map((row) => (
              <TableRow
                key={row.id}
                className="cursor-pointer"
                onClick={() => handleRowClick(row)}
              >
                <TableCell className="whitespace-nowrap">
                  {formatDate(row.messageDate)}
                </TableCell>
                <TableCell>
                  <StatusBadge
                    variant={row.reaction === 'positive' ? 'success' : 'danger'}
                  >
                    {getReactionIcon(row.reaction)}
                    {row.reaction}
                  </StatusBadge>
                </TableCell>
                <TableCell className="max-w-[300px] truncate" title={row.text}>
                  {row.text || '—'}
                </TableCell>
                <TableCell
                  className="max-w-[240px] truncate"
                  title={row.comment}
                >
                  {row.comment || '—'}
                </TableCell>
                <TableCell>
                  <Button
                    variant="link"
                    className="h-auto p-0 font-mono text-xs"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleRowClick(row);
                    }}
                  >
                    {row.conversationId || 'View feedback'}
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
      {selectedFeedback && (
        <FeedbackConversationDetail
          key={selectedFeedback.id}
          botId={selectedBotId}
          conversationId={selectedFeedback.conversationId}
          messageId={selectedFeedback.messageId}
          feedback={selectedFeedback}
          open={conversationSheetOpen}
          onClose={() => {
            setConversationSheetOpen(false);
            setSelectedFeedback(null);
          }}
        />
      )}
    </>
  );
}
