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
import { formatBotpressError } from '@/lib/errorMessages';

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
  }, [settings.bots, selectedBotId]);  const fetchConversations = useCallback(async (token?: string, append = false) => {
    if (!client) return;

    setLoading(true);
    setError(null);
    
    try {
      // Use exact parameter names from API documentation
      const params: any = {
        sortField: 'updatedAt',
        sortDirection: 'desc'
      };

      // Add pagination token if provided
      if (token) {
        params.nextToken = token;
      }

      console.log('Fetching conversations with params:', params);
      
      const response = await client.listConversations(params);
      console.log('API Response:', { 
        conversationCount: response.conversations?.length || 0, 
        nextToken: response.meta?.nextToken 
      });
      
      const conversationsData = response.conversations || [];
      
      if (append) {
        setConversations(prev => [...prev, ...conversationsData]);
      } else {
        setConversations(conversationsData);
      }
      
      setNextToken(response.meta?.nextToken);
    } catch (err) {
      setError(formatBotpressError(err, 'Failed to fetch conversations'));
      console.error('Error fetching conversations:', err);
    } finally {
      setLoading(false);
    }
  }, [client]);

  // Smart loading function that automatically fetches more conversations if needed
  const smartFetchConversations = useCallback(async (targetCount = 10) => {
    if (!client) return;

    let allConversations: ConversationWithMessages[] = [];
    let currentToken: string | undefined = undefined;
    let iterations = 0;
    const maxIterations = 10; // Safety limit to prevent infinite loops

    setLoading(true);
    setError(null);
    
    try {
      while (iterations < maxIterations) {
        // Fetch a batch of conversations
        const params: any = {
          sortField: 'updatedAt',
          sortDirection: 'desc'
        };

        if (currentToken) {
          params.nextToken = currentToken;
        }

        console.log(`Smart fetch iteration ${iterations + 1}, fetching with token:`, currentToken);
        
        const response = await client.listConversations(params);
        const newConversations = response.conversations || [];
        
        if (newConversations.length === 0) {
          console.log('No more conversations available');
          break;
        }

        allConversations = [...allConversations, ...newConversations];
        currentToken = response.meta?.nextToken;
        
        // If date filtering is enabled, check how many conversations match
        if (useTimeFilter && (startDate || endDate)) {
          const matchingConversations = allConversations.filter(conversation => {
            const conversationDate = parseISO(conversation.createdAt);
            const afterStartDate = !startDate || !isBefore(conversationDate, startOfDay(startDate));
            const beforeEndDate = !endDate || !isAfter(conversationDate, endOfDay(endDate));
            return afterStartDate && beforeEndDate;
          });

          console.log(`Found ${matchingConversations.length} matching conversations out of ${allConversations.length} total`);
          
          // If we have enough matching conversations or no more data, stop
          if (matchingConversations.length >= targetCount || !currentToken) {
            break;
          }
        } else {
          // If no date filter, stop after we have enough conversations
          if (allConversations.length >= targetCount || !currentToken) {
            break;
          }
        }

        iterations++;
      }

      setConversations(allConversations);
      setNextToken(currentToken);
      
      console.log(`Smart fetch completed: ${allConversations.length} total conversations loaded in ${iterations + 1} iterations`);

    } catch (err) {
      setError(formatBotpressError(err, 'Failed to fetch conversations'));
      console.error('Error in smart fetch:', err);
    } finally {
      setLoading(false);
    }
  }, [client, useTimeFilter, startDate, endDate]);// Remove date dependencies to fix circular dependency  // Check if conversations have messages - fixed to avoid circular dependency
  const checkConversationsForMessages = useCallback(async (conversationsToCheck: ConversationWithMessages[]) => {
    if (!client || conversationsToCheck.length === 0) return;
    
    setFilterLoading(true);
    
    // Process conversations in batches to avoid overwhelming the API
    const batchSize = 5;
    const updatedConversations = [...conversationsToCheck];
    
    for (let i = 0; i < updatedConversations.length; i += batchSize) {
      const batch = updatedConversations.slice(i, i + batchSize).filter(c => !c.isChecked);
      if (batch.length === 0) continue;
      
      await Promise.all(
        batch.map(async (conversation) => {
          try {
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
            console.error(`Error checking messages for conversation ${conversation.id}:`, err);
            // Mark as checked with no messages on error to avoid repeated attempts
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
  }, [client]); // Remove conversations dependency to fix circular dependency
  // Fetch conversations when client changes or when manually refreshed
  useEffect(() => {
    if (client) {
      smartFetchConversations(10); // Try to get at least 10 conversations that match filters
    }
  }, [client, smartFetchConversations]);
  
  // Check for messages when conversations change - with proper parameter
  useEffect(() => {
    if (conversations.length > 0) {
      checkConversationsForMessages(conversations);
    }
  }, [conversations.length]); // Only depend on length to avoid infinite loops

  // Handle date filter changes - separate from data fetching
  useEffect(() => {
    // Only trigger refresh if we have conversations loaded and date filter is enabled
    if (conversations.length > 0 && useTimeFilter) {
      console.log('Date filters changed, applying client-side filtering');
    }
  }, [useTimeFilter, startDate, endDate]);

  // Manual refresh function for date filter changes
  const refreshWithDateFilter = useCallback(() => {
    if (client) {
      console.log('Manual refresh triggered');
      setConversations([]); // Clear existing conversations
      smartFetchConversations(10); // Use smart fetch instead of basic fetch
    }
  }, [client, smartFetchConversations]);

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

  const selectedBot = settings.bots.find(bot => bot.botId === selectedBotId);  // Filter conversations by date range and by messages
  const displayConversations = conversations
    .filter(conversation => {
      // Apply date filters if enabled
      if (useTimeFilter && (startDate || endDate)) {
        const conversationDate = parseISO(conversation.createdAt);
        
        // Check if conversation is within date range
        const afterStartDate = !startDate || !isBefore(conversationDate, startOfDay(startDate));
        const beforeEndDate = !endDate || !isAfter(conversationDate, endOfDay(endDate));
        
        // Log first few for debugging
        if (conversations.indexOf(conversation) < 3) {
          console.log(`Conversation ${conversation.id.substring(0, 8)}:`, {
            createdAt: conversation.createdAt,
            conversationDate: conversationDate.toISOString(),
            startDate: startDate?.toISOString(),
            endDate: endDate?.toISOString(),
            afterStartDate,
            beforeEndDate,
            inDateRange: afterStartDate && beforeEndDate
          });
        }
        
        if (!afterStartDate || !beforeEndDate) {
          return false;
        }
      }
      
      // Filter empty conversations if needed
      if (!showEmptyConversations && conversation.hasMessages !== true) {
        return false;
      }
      
      return true;
    });
  // Add debug logging to understand what's happening
  const conversationsInDateRange = conversations.filter(conversation => {
    if (!useTimeFilter || (!startDate && !endDate)) return true;
    const conversationDate = parseISO(conversation.createdAt);
    const afterStartDate = !startDate || !isBefore(conversationDate, startOfDay(startDate));
    const beforeEndDate = !endDate || !isAfter(conversationDate, endOfDay(endDate));
    return afterStartDate && beforeEndDate;
  });

  console.log('Filter Debug:', {
    totalConversations: conversations.length,
    useTimeFilter,
    startDate: startDate?.toISOString(),
    endDate: endDate?.toISOString(),
    showEmptyConversations,
    conversationsWithMessages: conversations.filter(c => c.hasMessages === true).length,
    conversationsInDateRange: conversationsInDateRange.length,
    conversationsInDateRangeWithMessages: conversationsInDateRange.filter(c => c.hasMessages === true).length,
    displayConversations: displayConversations.length,
    sampleConversationDates: conversations.slice(0, 3).map(c => ({ id: c.id.substring(0, 8), createdAt: c.createdAt }))
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
                onClick={refreshWithDateFilter}
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
                Last 3 months
              </Button>
                <Button
                onClick={refreshWithDateFilter}
                disabled={loading || !client}
                size="sm"
                variant="default"
                className="flex items-center gap-2 h-9"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Apply Filters
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
      )}      {!filterLoading && !showEmptyConversations && checkedCount === conversations.length && conversations.length > 0 && (
        <div className="bg-green-50 px-4 py-2 rounded-md flex items-center justify-between">
          <span className="text-sm text-green-700">
            Loaded {conversations.length} conversations • 
            {useTimeFilter && (startDate || endDate) && (
              <>
                {conversationsInDateRange.length} in date range • 
                {conversationsInDateRange.filter(c => c.hasMessages === true).length} in date range with messages • 
              </>
            )}
            Showing {displayConversations.length} after all filters •
            {conversations.filter(c => c.hasMessages).length} total have messages
            {useTimeFilter && (startDate || endDate) && (
              <span className="ml-2 text-xs">
                (Date: {startDate?.toLocaleDateString()} - {endDate?.toLocaleDateString()})
              </span>
            )}
          </span>
          {displayConversations.length === 0 && conversations.length > 0 && (
            <span className="text-xs text-orange-600 ml-2">
              Try adjusting date range or include empty conversations
            </span>
          )}
        </div>
      )}{error && (
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
        <div className="flex flex-col items-center justify-center py-12 gap-2">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {useTimeFilter && (startDate || endDate) 
              ? 'Smart loading conversations within date range...' 
              : 'Loading conversations...'
            }
          </span>
        </div>
      ) : (
        <div className="w-full">
          {displayConversations.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                {!client ? (
                  'Select a bot to view conversations'
                ) : filterLoading ? (
                  'Filtering conversations...'                ) : useTimeFilter && (startDate || endDate) ? (
                  <div className="flex flex-col items-center gap-2">
                    <CalendarRange className="h-12 w-12 text-muted-foreground/50" />
                    <p>No conversations found within the selected date range</p>
                    <p className="text-sm text-muted-foreground">
                      Date range: {startDate?.toLocaleDateString()} - {endDate?.toLocaleDateString()}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {conversations.length > 0 && (
                        <>Total loaded: {conversations.length} conversations (check console for date details)</>
                      )}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setStartDate(addMonths(new Date(), -1));
                          setEndDate(new Date());
                        }}
                      >
                        Reset to last 30 days                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setUseTimeFilter(false);
                        }}
                      >
                        Disable date filter
                      </Button>
                    </div>
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

          {/* Smart load more for date filtering */}
          {useTimeFilter && (startDate || endDate) && displayConversations.length < 5 && nextToken && (
            <div className="flex justify-center mt-4">
              <Button
                variant="default"
                onClick={() => smartFetchConversations(20)}
                disabled={loading}
                className="flex items-center gap-2"
              >
                {loading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Load More Conversations in Date Range
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
