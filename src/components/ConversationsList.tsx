import { useState, useEffect, useCallback } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useBotpressClient } from '../hooks/useBotpressClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MessageCircle, RefreshCw, ChevronRight, Eye, AlertCircle, CalendarRange } from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';
import { addMonths, startOfDay, endOfDay, isAfter, isBefore, parseISO } from 'date-fns';
import ConversationDetail from './ConversationDetail';
import type { Conversation } from '../types';

interface ConversationWithMessages extends Conversation {
  hasMessages?: boolean;
  isChecked?: boolean;
}

export default function ConversationsList() {
  const { settings } = useSettings();
  const [selectedBotId, setSelectedBotId] = useState<string>('');
  const [conversations, setConversations] = useState<ConversationWithMessages[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterLoading, setFilterLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextToken, setNextToken] = useState<string | undefined>(undefined);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [showEmptyConversations, setShowEmptyConversations] = useState<boolean>(false);
  
  // Date filter states
  const [startDate, setStartDate] = useState<Date | undefined>(() => {
    // Default to 1 month ago
    return addMonths(new Date(), -1);
  });
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [useTimeFilter, setUseTimeFilter] = useState<boolean>(true);
  
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
    const fetchConversations = useCallback(async (token?: string, append = false) => {
    if (!client) return;

    setLoading(true);
    setError(null);
    
    try {
      // Prepare API request parameters
      const params: any = {
        sortField: 'updatedAt',
        sortDirection: 'desc',
        nextToken: token
      };

      // Add date filters to API request if enabled and dates are set
      // Note: This assumes the Botpress API supports these parameters
      // If it doesn't, the client-side filtering will still work
      if (useTimeFilter) {
        if (startDate) {
          params.startDate = startOfDay(startDate).toISOString();
        }
        if (endDate) {
          params.endDate = endOfDay(endDate).toISOString(); 
        }
      }
      
      const response = await client.listConversations(params);
      
      const conversationsData = response.conversations || [];
        if (append) {
        setConversations(prev => [...prev, ...conversationsData]);
      } else {
        setConversations(conversationsData);
        // Reset all conversations with hasMessages to undefined
      }
      
      setNextToken(response.meta?.nextToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch conversations');
      console.error('Error fetching conversations:', err);
    } finally {
      setLoading(false);
    }
  }, [client, useTimeFilter, startDate, endDate]);
    // Check if conversations have messages
  const checkConversationsForMessages = useCallback(async () => {
    if (!client || conversations.length === 0) return;
    
    setFilterLoading(true);
    
    // Process conversations in batches to avoid overwhelming the API
    const batchSize = 5;
    const updatedConversations = [...conversations];
    
    for (let i = 0; i < updatedConversations.length; i += batchSize) {
      const batch = updatedConversations.slice(i, i + batchSize).filter(c => !c.isChecked);
      if (batch.length === 0) continue;
      
      await Promise.all(
        batch.map(async (conversation) => {
          try {
            // Botpress API might not support 'limit' param directly, so we'll just check if any messages exist
            const response = await client.listMessages({ 
              conversationId: conversation.id
            });
            
            const index = updatedConversations.findIndex(c => c.id === conversation.id);
            if (index !== -1) {
              updatedConversations[index] = {
                ...updatedConversations[index],
                hasMessages: (response.messages && response.messages.length > 0),
                isChecked: true
              };
            }
          } catch (err) {
            console.error(`Error checking messages for conversation ${conversation.id}:`, err);            // Mark as checked with no messages on error to avoid repeated attempts
            const index = updatedConversations.findIndex(c => c.id === conversation.id);
            if (index !== -1) {
              updatedConversations[index] = {
                ...updatedConversations[index],
                hasMessages: false,
                isChecked: true
              };
            }
          }
        })
      );      
      // Update state after each batch to show progress
      setConversations([...updatedConversations]);
    }
    
    setFilterLoading(false);
  }, [client, conversations]);
  
  // Fetch conversations when client or date filters change
  useEffect(() => {
    if (client) {
      fetchConversations(undefined, false);
    }
  }, [client, fetchConversations, useTimeFilter, startDate, endDate]);
  
  // Check for messages when conversations change
  useEffect(() => {
    if (conversations.length > 0) {
      checkConversationsForMessages();
    }
  }, [conversations, checkConversationsForMessages]);

  const formatDate = (dateString: string) => {
    // Return date in format: Jan 24, 2023, 15:30
    const date = new Date(dateString);
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const selectedBot = settings.bots.find(bot => bot.botId === selectedBotId);
  // Filter conversations by date range and by messages
  const displayConversations = conversations
    .filter(conversation => {
      // Apply date filters if enabled
      if (useTimeFilter && (startDate || endDate)) {
        const conversationDate = parseISO(conversation.createdAt);
        
        if (startDate && isBefore(conversationDate, startOfDay(startDate))) {
          return false;
        }
        
        if (endDate && isAfter(conversationDate, endOfDay(endDate))) {
          return false;
        }
      }
      
      // Filter empty conversations if needed
      if (!showEmptyConversations && conversation.hasMessages !== true) {
        return false;
      }
      
      return true;
    });

  // Calculate loading and filtering progress
  const checkedCount = conversations.filter(c => c.isChecked).length;
  const filterProgress = conversations.length > 0 ? Math.round((checkedCount / conversations.length) * 100) : 0;
  
  if (!settings.bots.some(bot => bot.botId)) {
    return (
      <div className="w-full px-6 py-6">
        <Card>
          <CardHeader>
            <CardTitle>No Bots Configured</CardTitle>
            <CardDescription>
              Please configure at least one bot in the settings to view conversations.
            </CardDescription>
          </CardHeader>
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
            <MessageCircle className="h-6 w-6" />
            <h1 className="text-2xl font-bold">Conversations</h1>
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
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEmptyConversations(!showEmptyConversations)}
                className="flex items-center gap-1"
              >
                {showEmptyConversations ? "Hide Empty" : "Show All"}
              </Button>
              
              <Button
                onClick={() => fetchConversations(undefined, false)}
                disabled={loading || !client}
                size="sm"
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>
          {/* Date filter controls */}
        <div className="flex flex-wrap items-center gap-4 border rounded-md p-4 bg-muted/10">
          <div className="flex items-center gap-2 mr-2">
            <div className="flex items-center">
              <input 
                type="checkbox" 
                id="dateFilterToggle"
                checked={useTimeFilter} 
                onChange={() => setUseTimeFilter(!useTimeFilter)} 
                className="mr-2 h-4 w-4 rounded border-gray-300 text-primary"
              />
              <label 
                htmlFor="dateFilterToggle" 
                className={`text-sm font-medium cursor-pointer ${useTimeFilter ? "text-primary" : "text-muted-foreground"}`}
              >
                Filter by date range
              </label>
            </div>
          </div>
          
          <div className="flex flex-wrap flex-1 gap-4 items-center">
            <div className="flex gap-3 items-center">
              <div className="w-40">
                <DatePicker
                  date={startDate}
                  setDate={setStartDate}
                  placeholder="From date"
                  disabled={!useTimeFilter}
                  className="h-9"
                />
              </div>
              <span className="text-muted-foreground">to</span>
              <div className="w-40">
                <DatePicker
                  date={endDate}
                  setDate={setEndDate}
                  placeholder="To date"
                  disabled={!useTimeFilter}
                  className="h-9"
                />
              </div>
            </div>
            
            <div className="flex gap-2 ml-auto">
              <Button
                variant="outline"
                size="sm"
                disabled={!useTimeFilter}
                onClick={() => {
                  setStartDate(addMonths(new Date(), -1));
                  setEndDate(new Date());
                }}
                className="whitespace-nowrap h-9"
              >
                Last 30 days
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!useTimeFilter}
                onClick={() => {
                  setStartDate(addMonths(new Date(), -3));
                  setEndDate(new Date());
                }}
                className="whitespace-nowrap h-9"
              >
                Last 90 days
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!useTimeFilter || (!startDate && !endDate)}
                onClick={() => {
                  setStartDate(undefined);
                  setEndDate(undefined);
                }}
                className="whitespace-nowrap h-9"
              >
                Clear dates
              </Button>
            </div>
          </div>
        </div>
      </div>
        {filterLoading && (
        <div className="bg-blue-50 px-4 py-2 rounded-md flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
            <span>Filtering conversations... {filterProgress}%</span>
          </div>
          <span className="text-xs text-blue-600">Only conversations with messages will be shown by default</span>
        </div>
      )}
      
      {!filterLoading && !showEmptyConversations && checkedCount === conversations.length && conversations.length > 0 && (
        <div className="bg-green-50 px-4 py-2 rounded-md flex items-center justify-between">
          <span className="text-sm text-green-700">
            Showing {conversations.filter(c => c.hasMessages).length} of {conversations.length} conversations with messages
          </span>
        </div>
      )}      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-700">
              <span className="font-medium">Error:</span>
              {error}
            </div>
          </CardContent>
        </Card>
      )}
      
      {loading && conversations.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="w-full">
          {displayConversations.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                {!client ? (
                  'Select a bot to view conversations'
                ) : filterLoading ? (
                  'Filtering conversations...'
                ) : useTimeFilter && (startDate || endDate) ? (
                  <div className="flex flex-col items-center gap-2">
                    <CalendarRange className="h-12 w-12 text-muted-foreground/50" />
                    <p>No conversations found within the selected date range</p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setStartDate(addMonths(new Date(), -1));
                        setEndDate(new Date());
                      }}
                    >
                      Reset to last 30 days
                    </Button>
                  </div>
                ) : (
                  'No conversations found with messages'
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <Table className="compact-table">
                <TableHeader className="bg-muted/30 h-10">
                  <TableRow>
                    <TableHead className="w-1/6 py-2">ID</TableHead>
                    <TableHead className="w-1/3 py-2">Created</TableHead>
                    <TableHead className="w-1/3 py-2">Updated</TableHead>
                    <TableHead className="w-1/6 text-right py-2">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayConversations.map((conversation) => (
                    <TableRow 
                      key={conversation.id}
                      className={`cursor-pointer hover:bg-muted/50 h-10 ${conversation.hasMessages === false ? 'text-muted-foreground' : ''}`}
                      onClick={() => setSelectedConversation(conversation.id)}
                    >
                      <TableCell className="font-mono text-xs">
                        <div className="truncate max-w-[120px] flex items-center gap-1" title={conversation.id}>
                          {conversation.hasMessages === false && <AlertCircle className="h-3 w-3 text-muted-foreground" />}
                          {conversation.id.substring(0, 8)}...
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(conversation.createdAt)}</TableCell>
                      <TableCell className="text-sm">{formatDate(conversation.updatedAt)}</TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost"
                          size="sm"
                          className="flex items-center gap-1 text-blue-600 hover:text-blue-800 h-7 px-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedConversation(conversation.id);
                          }}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span className="sr-only sm:not-sr-only">View</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          
          {nextToken && (
            <div className="flex justify-center mt-4">
              <Button
                variant="outline"
                onClick={() => fetchConversations(nextToken, true)}
                disabled={loading}
                className="flex items-center gap-2"
              >
        {loading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Load More {!showEmptyConversations && "(With Messages Only)"}
                    <ChevronRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      )}
      
      {/* Conversation Detail Sidebar */}
      {selectedConversation && selectedBotId && (
        <ConversationDetail 
          botId={selectedBotId}
          conversationId={selectedConversation}
          onClose={() => setSelectedConversation(null)}
          open={!!selectedConversation}
        />
      )}
    </div>
  );
}
