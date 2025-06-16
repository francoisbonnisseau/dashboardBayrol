import { useState, useEffect, useCallback } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useBotpressClient } from '../hooks/useBotpressClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MessageCircle, RefreshCw, ChevronRight, Eye } from 'lucide-react';
import ConversationDetail from './ConversationDetail';
import type { Conversation } from '../types';

export default function ConversationsList() {
  const { settings } = useSettings();
  const [selectedBotId, setSelectedBotId] = useState<string>('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextToken, setNextToken] = useState<string | undefined>(undefined);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  
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
      const response = await client.listConversations({
        sortField: 'updatedAt',
        sortDirection: 'desc',
        nextToken: token
      });
      
      if (append && response.conversations) {
        setConversations(prev => [...prev, ...response.conversations]);
      } else {
        setConversations(response.conversations || []);
      }
      
      setNextToken(response.meta?.nextToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch conversations');
      console.error('Error fetching conversations:', err);
    } finally {
      setLoading(false);
    }
  }, [client]);  
  
  // Fetch conversations when client changes
  useEffect(() => {
    if (client) {
      fetchConversations(undefined, false);
    }
  }, [client, fetchConversations]);

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
      
      {loading && conversations.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="w-full">
          {conversations.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                {!client ? 'Select a bot to view conversations' : 'No conversations found'}
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
                  {conversations.map((conversation) => (
                    <TableRow 
                      key={conversation.id}
                      className="cursor-pointer hover:bg-muted/50 h-10"
                      onClick={() => setSelectedConversation(conversation.id)}
                    >
                      <TableCell className="font-mono text-xs">
                        <div className="truncate max-w-[120px]" title={conversation.id}>
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
                    Load More
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
