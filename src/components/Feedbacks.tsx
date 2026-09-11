import { useFeedbackRows, useFeedbackTable } from '@/queries/useFeedbackRows';
import { getAllFeedbackRows, type FeedbackRow } from '@/api/botpress/feedbacks';
import { useState, useEffect, useCallback } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useBotpressClient } from '../hooks/useBotpressClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DatePicker } from '@/components/ui/date-picker';
import { RefreshCw, MessageSquare, ThumbsUp, ThumbsDown, Download, ChevronLeft, ChevronRight } from 'lucide-react';
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
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackRow | null>(null);
  const [conversationSheetOpen, setConversationSheetOpen] = useState<boolean>(false);
  
  const client = useBotpressClient(selectedBotId);
  
  const rowsQuery = useFeedbackRows(client, settings.workspaceId, selectedBotId, {page: currentPage, reaction: reactionFilter, startDate, endDate});
  const tableQuery = useFeedbackTable(client, settings.workspaceId, selectedBotId);
  const rows = rowsQuery.data?.rows ?? [];
  const filteredRows = rows;
  const hasMore = rowsQuery.data?.hasMore ?? false;
  const tableInfo = tableQuery.data;
  const loading = rowsQuery.isFetching || tableQuery.isFetching || exporting;
  const error = exportError || (rowsQuery.error ? formatBotpressError(rowsQuery.error, 'Failed to fetch rows') : tableQuery.error ? formatBotpressError(tableQuery.error, 'Failed to fetch table information') : null);
  const fetchTableInfo = () => { void rowsQuery.refetch(); void tableQuery.refetch(); };

  // Set default bot if none selected
  useEffect(() => {
    if (!selectedBotId && settings.bots.length > 0) {
      const firstConfiguredBot = settings.bots.find(bot => bot.botId);
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
      minute: '2-digit'
    });
  };

  // Get color based on reaction
  const getReactionColor = (reaction: string) => {
    switch (reaction) {
      case 'negative':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'positive':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
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
      const exportRows = await getAllFeedbackRows(client, {reaction: reactionFilter, startDate, endDate});
      // Create JSON content
      const jsonContent = JSON.stringify(exportRows, null, 2);
      
      // Create and download file
      const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      
      // Create filename with current date and filter info
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD format
      const reactionStr = reactionFilter ? `_${reactionFilter}` : '_all-reactions';
      
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

  if (!settings.bots.some(bot => bot.botId)) {
    return (
      <div className="w-full px-6 py-6">
        <Card>
          <CardContent className="pt-6 text-center">
            Please configure at least one bot in the settings to view feedbacks.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full px-6 py-4 space-y-4">
      {/* Filters Card */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col gap-4">
            {/* Top row: Bot selector and actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-muted-foreground">Bot:</span>
                <Select value={selectedBotId} onValueChange={(botId) => { setCurrentPage(0); setSelectedFeedback(null); setSelectedBotId(botId); }}>
                  <SelectTrigger className="w-[180px] h-9">
                    <SelectValue placeholder="Select a bot" />
                  </SelectTrigger>
                  <SelectContent>
                    {settings.bots
                      .filter(bot => bot.botId)
                      .map((bot) => (
                        <SelectItem key={bot.id} value={bot.botId}>
                          {bot.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  onClick={downloadFeedbacks}
                  disabled={loading || !client || (!hasMore && filteredRows.length === 0)}
                  size="sm"
                  variant="outline"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {exporting ? 'Exporting…' : 'Export'}
                </Button>
                <Button
                  onClick={fetchTableInfo}
                  disabled={loading || !client}
                  size="sm"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </div>
            
            {/* Divider */}
            <div className="border-t" />
            
            {/* Filter row */}
            <div className="flex flex-wrap items-end gap-4">
              {/* Reaction filter */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Reaction
                </label>
                <Select 
                  value={reactionFilter || 'all'} 
                  onValueChange={(value) => { setCurrentPage(0); setReactionFilter(value === 'all' ? null : value); }}
                >
                  <SelectTrigger className="w-[140px] h-9">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All reactions</SelectItem>
                    <SelectItem value="positive">
                      <span className="flex items-center gap-2">
                        <ThumbsUp className="h-3.5 w-3.5 text-green-600" />
                        Positive
                      </span>
                    </SelectItem>
                    <SelectItem value="negative">
                      <span className="flex items-center gap-2">
                        <ThumbsDown className="h-3.5 w-3.5 text-red-600" />
                        Negative
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Date range */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Date Range
                </label>
                <div className="flex items-center gap-2">
                  <DatePicker
                    date={startDate}
                    setDate={(date) => { setCurrentPage(0); setStartDate(date); }}
                    placeholder="Start"
                    className="w-[140px]"
                  />
                  <span className="text-muted-foreground">→</span>
                  <DatePicker
                    date={endDate}
                    setDate={(date) => { setCurrentPage(0); setEndDate(date); }}
                    placeholder="End"
                    className="w-[140px]"
                  />
                </div>
              </div>
              
              {/* Clear filters */}
              {(startDate || endDate || reactionFilter) && (
                <Button
                  onClick={() => {
                    setCurrentPage(0);
                    setStartDate(undefined);
                    setEndDate(undefined);
                    setReactionFilter(null);
                  }}
                  size="sm"
                  variant="ghost"
                  className="h-9 text-muted-foreground hover:text-foreground"
                >
                  Reset filters
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-700">
              <span className="font-medium">Error:</span>
              {error}
            </div>
          </CardContent>
        </Card>
      )}
      
      {loading && rows.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="w-full">
          {filteredRows.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                {!client ? 'Select a bot to view feedbacks' : loading ? 'Loading data...' : 'No feedback data found'}
                {currentPage > 0 && (
                  <Button className="ml-3" variant="outline" size="sm" onClick={() => setCurrentPage(page => Math.max(0, page - 1))} disabled={loading}>
                    <ChevronLeft className="mr-2 h-4 w-4" />Previous
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <Table className="w-full">
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="w-[20%]">Date</TableHead>
                    <TableHead className="w-[45%]">Message Text</TableHead>
                    <TableHead className="w-[15%]">Reaction</TableHead>
                    <TableHead className="w-[20%]">ConversationId</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((row) => (
                    <TableRow 
                      key={row.id} 
                      className="hover:bg-muted/50 cursor-pointer" 
                      onClick={() => handleRowClick(row)}
                    >
                      <TableCell className="text-sm">{formatDate(row.messageDate)}</TableCell>
                      <TableCell className="font-medium">
                        <div className="max-w-[300px] truncate" title={row.text || ''}>
                          {row.text || '—'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`${getReactionColor(row.reaction)} flex items-center gap-1 w-fit`}>
                          {getReactionIcon(row.reaction)}
                          {row.reaction}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm font-mono">
                        {row.conversationId ? row.conversationId.substring(0, 8) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between border-t px-4 py-3">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(page => Math.max(0, page - 1))} disabled={loading || currentPage === 0}>
                  <ChevronLeft className="mr-2 h-4 w-4" />Previous
                </Button>
                <span className="text-sm text-muted-foreground">Page {currentPage + 1}</span>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(page => page + 1)} disabled={loading || !hasMore}>
                  Next<ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Table info summary */}
      {tableInfo && (
        <div className="text-xs text-muted-foreground flex gap-6 mt-2">
          <div>Total rows: {tableInfo.rows}</div>
          <div>Stale: {tableInfo.stale}</div>
          <div>Indexing: {tableInfo.indexing}</div>
        </div>
      )}

      {/* Conversation details with focused message */}
      {selectedFeedback && (
        <FeedbackConversationDetail
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
    </div>
  );
}
