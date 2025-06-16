import { useState, useEffect, useCallback } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useBotpressClient } from '../hooks/useBotpressClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageCircle, Calendar, Hash, RefreshCw, ChevronRight, ChevronLeft, Eye } from 'lucide-react';
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
  }, [settings.bots, selectedBotId]);  const fetchConversations = useCallback(async (token?: string, append = false) => {
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
  }, [client]);  // Fetch conversations when client changes
  useEffect(() => {
    if (client) {
      fetchConversations(undefined, false);
    }
  }, [client, fetchConversations]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const selectedBot = settings.bots.find(bot => bot.botId === selectedBotId);

  if (!settings.bots.some(bot => bot.botId)) {
    return (
      <div className="container mx-auto py-6">
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
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-6 w-6" />
          <h1 className="text-3xl font-bold">Conversations</h1>
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

      {selectedBot && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              {selectedBot.name} Conversations
            </CardTitle>
            <CardDescription>
              Viewing conversations for {selectedBot.name}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-700">
              <span className="font-medium">Error:</span>
              {error}
            </div>
          </CardContent>
        </Card>
      )}      {loading && conversations.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4">
          {conversations.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                {!client ? 'Select a bot to view conversations' : 'No conversations found'}
              </CardContent>
            </Card>
          ) : (
            <>
              {conversations.map((conversation) => (
                <Card 
                  key={conversation.id} 
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setSelectedConversation(conversation.id)}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Hash className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono text-sm">{conversation.id}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span className="text-sm">{formatDate(conversation.updatedAt)}</span>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Channel:</span> {conversation.channel}
                      </div>
                      <div>
                        <span className="font-medium">Integration:</span> {conversation.integration}
                      </div>
                      <div>
                        <span className="font-medium">Created:</span> {formatDate(conversation.createdAt)}
                      </div>
                      <div>
                        <span className="font-medium">Updated:</span> {formatDate(conversation.updatedAt)}
                      </div>
                    </div>
                    
                    {Object.keys(conversation.tags).length > 0 && (
                      <div className="pt-2">
                        <span className="font-medium text-sm">Tags:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {Object.entries(conversation.tags).map(([key, value]) => (
                            <span
                              key={key}
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800"
                            >
                              {key}: {String(value)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="border-t pt-3">
                    <Button 
                      variant="ghost"
                      size="sm"
                      className="ml-auto flex items-center gap-1 text-blue-600 hover:text-blue-800"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedConversation(conversation.id);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                      View Messages
                    </Button>
                  </CardFooter>
                </Card>
              ))}
              
              {nextToken && (
                <div className="flex justify-center mt-4 mb-8">
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
            </>
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
