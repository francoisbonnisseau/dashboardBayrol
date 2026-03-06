import { useState, useEffect, useCallback } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useBotpressClient } from '../hooks/useBotpressClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DatePicker } from '@/components/ui/date-picker';
import { RefreshCw, MessageSquare, ThumbsUp, ThumbsDown, Download } from 'lucide-react';
import FeedbackConversationDetail from './FeedbackConversationDetail';
import { formatBotpressError } from '@/lib/errorMessages';

const TABLE_NAME = 'feedbacksTable';

interface FeedbackRow {
  id: number;
  createdAt: string;
  updatedAt: string;
  conversationId: string;
  userId: string;
  messageId: string;
  text: string;
  reaction: 'positive' | 'negative';
  comment: string;
  messageDate: string;
}

interface TableResponse {
  table: {
    id: string;
    name: string;
    factor: number;
    frozen: boolean;
    schema: any;
    tags: Record<string, any>;
    isComputeEnabled: boolean;
    createdAt: string;
    updatedAt: string;
  };
  rows: number;
  stale: number;
  indexing: number;
}

export default function Feedbacks() {
  const { settings } = useSettings();
  const [selectedBotId, setSelectedBotId] = useState<string>('');
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [tableInfo, setTableInfo] = useState<TableResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filter states
  const [reactionFilter, setReactionFilter] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  
  // Conversation detail states
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackRow | null>(null);
  const [conversationSheetOpen, setConversationSheetOpen] = useState<boolean>(false);
  
  const client = useBotpressClient(selectedBotId);
  
  // Set default bot if none selected
  useEffect(() => {
    if (!selectedBotId && settings.bots.length > 0) {
      const firstConfiguredBot = settings.bots.find(bot => bot.botId);
      if (firstConfiguredBot) {
        setSelectedBotId(firstConfiguredBot.botId);
      }
    }
  }, [settings.bots, selectedBotId]);
  
  // Fetch rows using Botpress client
  const fetchRows = useCallback(async () => {
    if (!client) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Build date filter
      const dateFilter: any = {};
      if (startDate) {
        dateFilter.$gte = startDate.toISOString();
      }
      if (endDate) {
        // Set end date to end of day
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        dateFilter.$lte = endOfDay.toISOString();
      }
      
      // Use the client.findTableRows method
      const { rows } = await client.findTableRows({
        table: TABLE_NAME,
        limit: 1000,
        offset: 0,
        filter: {
          // Filter by reaction if needed
          ...(reactionFilter && { reaction: { $eq: reactionFilter } }),
          // Filter by date range if needed
          ...((startDate || endDate) && { messageDate: dateFilter })
        },
        orderBy: 'messageDate',
        orderDirection: 'desc'
      });
      
      // Transform the rows to match our expected format
      const formattedRows = rows.map((row: any) => ({
        id: row.id,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        conversationId: row.conversationId || '',
        userId: row.userId || '',
        messageId: row.messageId || '',
        text: row.text || '',
        reaction: row.reaction || 'positive',
        comment: row.comment || '',
        messageDate: row.messageDate || row.createdAt
      }));
      
      setRows(formattedRows);
    } catch (err) {
      setError(formatBotpressError(err, 'Failed to fetch feedbacks'));
      console.error('Error fetching feedbacks:', err);
    } finally {
      setLoading(false);
    }
  }, [client, reactionFilter, startDate, endDate]);
  
  // Fetch table information
  const fetchTableInfo = useCallback(async () => {
    if (!client) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Use the client directly to get table information
      const data = await client.getTable({
        table: TABLE_NAME
      });
      setTableInfo(data as TableResponse);
      
      // Now fetch rows
      await fetchRows();
    } catch (err) {
      setError(formatBotpressError(err, 'Failed to fetch table information'));
      console.error('Error fetching table info:', err);
    } finally {
      setLoading(false);
    }
  }, [client, fetchRows]);

  // Fetch data when client or filters change
  useEffect(() => {
    if (client) {
      fetchRows();
    }
  }, [client, fetchRows, reactionFilter, startDate, endDate]);

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

  // Filtered rows based on reaction and date range
  const filteredRows = rows.filter(row => {
    // Apply reaction filter if selected
    if (reactionFilter && row.reaction !== reactionFilter) {
      return false;
    }
    
    // Apply date range filter
    if (startDate || endDate) {
      const rowDate = new Date(row.messageDate);
      
      if (startDate && rowDate < startDate) {
        return false;
      }
      
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        if (rowDate > endOfDay) {
          return false;
        }
      }
    }
    
    return true;
  });

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
    if (filteredRows.length === 0) return;
    
    setLoading(true);
    
    try {
      // Create JSON content
      const jsonContent = JSON.stringify(filteredRows, null, 2);
      
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
      console.error('Error downloading feedbacks:', error);
    } finally {
      setLoading(false);
    }
  }, [filteredRows, reactionFilter, startDate, endDate]);

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
                <Select value={selectedBotId} onValueChange={setSelectedBotId}>
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
                  disabled={loading || !client || filteredRows.length === 0}
                  size="sm"
                  variant="outline"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export ({filteredRows.length})
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
                  onValueChange={(value) => setReactionFilter(value === 'all' ? null : value)}
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
              
              {/* Clear filters */}
              {(startDate || endDate || reactionFilter) && (
                <Button
                  onClick={() => {
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
