import { useState, useEffect, useCallback } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useBotpressClient } from '../hooks/useBotpressClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { RefreshCw, BarChart3, ThumbsUp, ThumbsDown, CheckCircle2, XCircle, Download } from 'lucide-react';
import ConversationDetail from './ConversationDetail';

const TABLE_NAME = 'Int_Connor_Conversations_Table';

interface SentimentRow {
  id: number;
  createdAt: string;
  updatedAt: string;
  topics?: string;
  summary?: string;
  resolved: boolean;
  sentiment: 'very negative' | 'negative' | 'neutral' | 'positive' | 'very positive';
  transcript?: string;
  escalations?: string[];
  conversationId: string;
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

// Interface definitions removed

export default function SentimentAnalysis() {
  const { settings } = useSettings();
  const [selectedBotId, setSelectedBotId] = useState<string>('');
  const [rows, setRows] = useState<SentimentRow[]>([]);
  const [tableInfo, setTableInfo] = useState<TableResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
    // Filter states
  const [sentimentFilter, setSentimentFilter] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState<boolean>(false);
  // Conversation detail states
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
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
  
  // Fetch rows using Botpress client - Define first to avoid circular reference
  const fetchRows = useCallback(async () => {
    if (!client) return;
    
    setLoading(true);
    setError(null);
    
    try {      // Use the client.findTableRows method directly as shown in the demo code
      const { rows } = await client.findTableRows({
        table: TABLE_NAME,
        limit: 1000,
        offset: 0,
        filter: {
          // Filter by sentiment if needed
          ...(sentimentFilter && { sentiment: { $eq: sentimentFilter } }),
          // Filter by resolved status if needed
          ...(!showResolved && { resolved: { $eq: false } })
        },
        orderBy: 'createdAt',
        orderDirection: 'desc'
      });
        // Transform the rows to match our expected format
      const formattedRows = rows.map((row: any) => ({
        id: row.id,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        topics: row.topics || '',
        summary: row.summary || '',
        resolved: !!row.resolved,
        sentiment: row.sentiment || 'neutral',
        transcript: row.transcript || '',
        escalations: row.escalations || [],
        conversationId: row.conversationId || ''
      }));
      
      setRows(formattedRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch rows');
      console.error('Error fetching rows:', err);    } finally {
      setLoading(false);
    }
  }, [client, sentimentFilter, showResolved]);
  
  // Fetch table information
  const fetchTableInfo = useCallback(async () => {
    if (!client) return;
    
    setLoading(true);
    setError(null);
    
    try {      // Use the client directly to get table information
      const data = await client.getTable({
        table: TABLE_NAME
      });
      setTableInfo(data as TableResponse);
      
      // Now fetch rows
      await fetchRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch table information');
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
  }, [client, fetchRows, sentimentFilter, showResolved]);

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

  // Filtered rows based on sentiment and resolved status
  const filteredRows = rows.filter(row => {
    // Apply sentiment filter if selected
    if (sentimentFilter && row.sentiment !== sentimentFilter) {
      return false;
    }
    
    // Apply resolved filter
    if (!showResolved && row.resolved) {
      return false;
    }
    
    return true;
  });

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
  
  const selectedBot = settings.bots.find(bot => bot.botId === selectedBotId);  // Download conversations in JSON format with simplified structure
  const downloadConversations = useCallback(async () => {
    if (!client || filteredRows.length === 0) return;
    
    setLoading(true);
    
    try {
      // Fetch full conversation details for each filtered conversation
      const conversationsData = [];
      
      for (const row of filteredRows) {
        try {
          // Get messages for this conversation
          const response = await client.listMessages({ 
            conversationId: row.conversationId,
            limit: 1000 // Get all messages
          });
            if (response && response.messages && response.messages.length > 1) {
            // Only include conversations with more than one message
            const conversation: Record<string, string> = {};
            let messageIndex = 1;
            
            // Reverse messages to get chronological order (oldest first)
            const orderedMessages = [...response.messages].reverse();
            
            // Build conversation object with user/bot alternating structure
            orderedMessages.forEach((message: any) => {
              const role = message.direction === 'incoming' ? 'user' : 'bot';
              const key = `${role}${messageIndex}`;
              conversation[key] = message.payload?.text || '';
              
              // Increment index for alternating messages
              if (message.direction === 'outgoing') {
                messageIndex++;
              }
            });
            
            conversationsData.push({
              date: row.createdAt,
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
      const filename = `conversations_${dateStr}${sentimentStr}${resolvedStr}.json`;
      
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Error downloading conversations:', error);
    } finally {
      setLoading(false);
    }
  }, [client, filteredRows, sentimentFilter, showResolved]);

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
      <div className="flex flex-col gap-4">
        {/* Header with bot selection */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            <h1 className="text-2xl font-bold">Sentiment Analysis</h1>
            {selectedBot && (
              <span className="text-muted-foreground ml-2">
                for <span className="font-medium">{selectedBot.name}</span>
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            <Select value={selectedBotId} onValueChange={setSelectedBotId}>
              <SelectTrigger className="w-48">
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
            
            <Button
              onClick={fetchTableInfo}
              disabled={loading || !client}
              size="sm"
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-4 border rounded-md p-4 bg-muted/10">
          <div className="flex items-center gap-2 mr-4">
            <span className="text-sm font-medium">Filter by:</span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm">Sentiment:</span>
              <Select 
                value={sentimentFilter || 'all'} 
                onValueChange={(value) => setSentimentFilter(value === 'all' ? null : value)}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Any sentiment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any sentiment</SelectItem>
                  <SelectItem value="very negative">Very Negative</SelectItem>
                  <SelectItem value="negative">Negative</SelectItem>
                  <SelectItem value="neutral">Neutral</SelectItem>
                  <SelectItem value="positive">Positive</SelectItem>
                  <SelectItem value="very positive">Very Positive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-2">
              <Checkbox 
                id="showResolved" 
                checked={showResolved}
                onCheckedChange={(checked) => setShowResolved(!!checked)}
              />
              <label htmlFor="showResolved" className="text-sm cursor-pointer">
                Show Resolved
              </label>
            </div>
            
            <Button
              onClick={downloadConversations}
              disabled={loading || !client || filteredRows.length === 0}
              size="sm"
              variant="outline"
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Download ({filteredRows.length})
            </Button>
          </div>
        </div>
      </div>
      
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
              </CardContent>
            </Card>
          ) : (
            <div className="border rounded-md overflow-hidden">              <Table className="w-full">
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="w-[20%]">Date</TableHead>
                    <TableHead className="w-[25%]">Topics</TableHead>
                    <TableHead className="w-[10%]">Resolved</TableHead>
                    <TableHead className="w-[25%]">Sentiment</TableHead>
                    <TableHead className="w-[20%]">ConversationId</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>                  {filteredRows.map((row) => (
                    <TableRow 
                      key={row.id} 
                      className="hover:bg-muted/50 cursor-pointer" 
                      onClick={() => handleRowClick(row.conversationId)}
                    >                      <TableCell className="text-sm">{formatDate(row.updatedAt)}</TableCell>
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
