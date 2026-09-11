import { useSentimentRows, useSentimentTable } from '@/queries/useSentimentRows';
import { getAllSentimentRows } from '@/api/botpress/sentiment';
import { useState, useEffect, useCallback } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useBotpressClient } from '../hooks/useBotpressClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DatePicker } from '@/components/ui/date-picker';
import {
  RefreshCw,
  BarChart3,
  ThumbsUp,
  ThumbsDown,
  CheckCircle2,
  XCircle,
  Download,
  ChevronLeft,
  ChevronRight,
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
  const [startDate, setStartDate] = useState<Date | undefined>(initialStartDate);
  const [endDate, setEndDate] = useState<Date | undefined>(initialEndDate);
  const [currentPage, setCurrentPage] = useState(0);

  // Conversation detail states
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [conversationSheetOpen, setConversationSheetOpen] = useState<boolean>(false);
  
  const client = useBotpressClient(selectedBotId);
  
  const rowsQuery = useSentimentRows(client, settings.workspaceId, selectedBotId, {page: currentPage, sentiment: sentimentFilter, showResolved, startDate, endDate});
  const tableQuery = useSentimentTable(client, settings.workspaceId, selectedBotId);
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

  // Get color based on sentiment
  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'very negative':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'negative':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'neutral':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'positive':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'very positive':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
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
  };  // Handle row click to show conversation
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
      const exportRows = await getAllSentimentRows(client, {sentiment: sentimentFilter, showResolved, startDate, endDate});
      // Fetch full conversation details for each filtered conversation
      const conversationsData = [];
      
      for (const row of exportRows) {
        try {
          // Get messages for this conversation
          const response = await client.listMessages({ 
            conversationId: row.conversationId
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
              conversation: conversation
            });
          }
        } catch (error) {
          console.error(`Error fetching messages for conversation ${row.conversationId}:`, error);
          // Skip conversations that can't be fetched
        }
      }
      
      // Create JSON content
      const jsonContent = JSON.stringify(conversationsData, null, 2);
      
      // Create and download file
      const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      
      // Create filename with current date and filter info
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD format
      const sentimentStr = sentimentFilter ? `_${sentimentFilter.replace(' ', '-')}` : '_all-sentiments';
      const resolvedStr = showResolved ? '_including-resolved' : '_unresolved-only';
      
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

  if (!settings.bots.some(bot => bot.botId)) {
    return (
      <div className="w-full px-6 py-6">
        <Card>
          <CardContent className="pt-6 text-center">
            Please configure at least one bot in the settings to view sentiment analysis.
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
                <Select
                  value={selectedBotId}
                  onValueChange={(botId) => {
                    setCurrentPage(0);
                    setSelectedConversationId(null);
                    setSelectedBotId(botId);
                  }}
                >
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
                  onClick={downloadConversations}
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
              {/* Sentiment filter */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Sentiment
                </label>
                <Select 
                  value={sentimentFilter || 'all'} 
                  onValueChange={(value) => {
                    setCurrentPage(0);
                    setSentimentFilter(value === 'all' ? null : value);
                  }}
                >
                  <SelectTrigger className="w-[150px] h-9">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All sentiments</SelectItem>
                    <SelectItem value="very negative">Very Negative</SelectItem>
                    <SelectItem value="negative">Negative</SelectItem>
                    <SelectItem value="neutral">Neutral</SelectItem>
                    <SelectItem value="positive">Positive</SelectItem>
                    <SelectItem value="very positive">Very Positive</SelectItem>
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
                    setDate={(date) => {
                      setCurrentPage(0);
                      setStartDate(date);
                    }}
                    placeholder="Start"
                    className="w-[140px]"
                  />
                  <span className="text-muted-foreground">→</span>
                  <DatePicker
                    date={endDate}
                    setDate={(date) => {
                      setCurrentPage(0);
                      setEndDate(date);
                    }}
                    placeholder="End"
                    className="w-[140px]"
                  />
                </div>
              </div>
              
              {/* Show resolved toggle */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Status
                </label>
                <Button
                  variant="outline"
                  size="sm"
                  className={`h-9 ${showResolved 
                    ? 'bg-green-50 border-green-300 text-green-700 hover:bg-green-100 hover:text-green-800' 
                    : 'bg-red-50 border-red-300 text-red-700 hover:bg-red-100 hover:text-red-800'}`}
                  onClick={() => {
                    setCurrentPage(0);
                    setShowResolved(!showResolved);
                  }}
                >
                  {showResolved ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Including Resolved
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 mr-2" />
                      Unresolved Only
                    </>
                  )}
                </Button>
              </div>
              
              {/* Clear filters */}
              {(startDate || endDate || sentimentFilter || showResolved) && (
                <Button
                  onClick={() => {
                    setCurrentPage(0);
                    setStartDate(subDays(new Date(), 2));
                    setEndDate(new Date());
                    setSentimentFilter(null);
                    setShowResolved(false);
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
                {!client ? 'Select a bot to view sentiment analysis' : loading ? 'Loading data...' : 'No conversation data found'}
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
                    <TableHead className="w-[25%]">Topics</TableHead>
                    <TableHead className="w-[10%]">Resolved</TableHead>
                    <TableHead className="w-[25%]">Sentiment</TableHead>
                    <TableHead className="w-[20%]">ConversationId</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((row) => (
                    <TableRow 
                      key={row.id} 
                      className="hover:bg-muted/50 cursor-pointer" 
                      onClick={() => handleRowClick(row.conversationId)}
                    >
                      <TableCell className="text-sm">{formatDate(row.date)}</TableCell>
                      <TableCell className="font-medium">
                        <div className="max-w-[200px] truncate" title={row.topics || ''}>
                          {row.topics || '—'}
                        </div>
                      </TableCell>
                      <TableCell>
                        {row.resolved ? 
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="h-4 w-4" />
                            <span className="sr-only sm:not-sr-only text-xs">Yes</span>
                          </span> : 
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <XCircle className="h-4 w-4" />
                            <span className="sr-only sm:not-sr-only text-xs">No</span>
                          </span>
                        }
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`${getSentimentColor(row.sentiment)} flex items-center gap-1 w-fit`}>
                          {getSentimentIcon(row.sentiment)}
                          {row.sentiment}
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((page) => Math.max(0, page - 1))}
                  disabled={loading || currentPage === 0}
                >
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {currentPage + 1}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((page) => page + 1)}
                  disabled={loading || !hasMore}
                >
                  Next
                  <ChevronRight className="ml-2 h-4 w-4" />
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
        {/* Conversation details using the unified ConversationDetail component */}
      {selectedConversationId && (
        <ConversationDetail
          botId={selectedBotId}
          conversationId={selectedConversationId}
          open={conversationSheetOpen}
          onClose={() => {
            setConversationSheetOpen(false);
            setSelectedConversationId(null);
          }}
        />
      )}
    </div>
  );
}
