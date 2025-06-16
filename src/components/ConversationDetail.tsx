import { useState, useEffect } from 'react';
import { useBotpressClient } from '../hooks/useBotpressClient';
import { 
  Sheet, 
  SheetContent, 
  SheetDescription, 
  SheetHeader, 
  SheetTitle
} from '@/components/ui/sheet';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  MessageCircle, 
  ArrowLeft, 
  RefreshCw, 
  User, 
  Bot, 
  Clock,
  ExternalLink
} from 'lucide-react';
import type { Message } from '../types';

interface ConversationDetailProps {
  botId: string; 
  conversationId: string;
  onClose: () => void;
  open: boolean;
}

export default function ConversationDetail({ botId, conversationId, onClose, open }: ConversationDetailProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const client = useBotpressClient(botId);

  const fetchMessages = async () => {
    if (!client || !conversationId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await client.listMessages({ conversationId });
      setMessages(response.messages || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch messages');
      console.error('Error fetching messages:', err);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    if (open && client && conversationId) {
      fetchMessages();
    }
  }, [client, conversationId, open]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent side="right" className="w-full md:max-w-md lg:max-w-lg">
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <SheetTitle className="flex items-center">
              <MessageCircle className="mr-2 h-5 w-5" />
              Conversation Details
            </SheetTitle>
            <Button variant="ghost" size="icon" onClick={fetchMessages} disabled={loading} className="h-8 w-8">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <SheetDescription>
            <div className="flex items-center justify-between mt-2">
              <span className="font-mono text-xs">{conversationId}</span>
            </div>
          </SheetDescription>
        </SheetHeader>
        
        <div className="mt-6">
          {error && (
            <div className="rounded-md bg-red-50 p-4 mb-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <div className="mt-2 text-sm text-red-700">{error}</div>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              No messages found in this conversation.
            </div>
          ) : (
            <div className="space-y-4">
              {messages.slice().reverse().map((message) => (
                <Card 
                  key={message.id} 
                  className={`overflow-hidden ${
                    message.direction === 'incoming' ? 'border-blue-200 bg-blue-50' : 'border-green-200 bg-green-50'
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center">
                        {message.direction === 'incoming' ? (
                          <User className="h-4 w-4 mr-1 text-blue-700" />
                        ) : (
                          <Bot className="h-4 w-4 mr-1 text-green-700" />
                        )}
                        <span className={`text-sm font-medium ${
                          message.direction === 'incoming' ? 'text-blue-700' : 'text-green-700'
                        }`}>
                          {message.direction === 'incoming' ? 'User' : 'Bot'}
                        </span>
                      </div>
                      <div className="flex items-center text-muted-foreground text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        {formatDate(message.createdAt)}
                      </div>
                    </div>
                    
                    <div className="mt-2">
                      {message.payload.text ? (
                        <p className="text-sm">{message.payload.text}</p>
                      ) : (
                        <div className="text-xs text-muted-foreground italic">
                          Complex message type: {message.payload.type || 'unknown'}
                        </div>
                      )}
                    </div>
                    
                    {message.payload.type && message.payload.type !== 'text' && (
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <details>
                          <summary className="text-xs cursor-pointer text-blue-600 hover:text-blue-800">
                            <span className="flex items-center">
                              <ExternalLink className="h-3 w-3 mr-1" />
                              View full payload
                            </span>
                          </summary>
                          <pre className="mt-2 p-2 bg-gray-800 text-gray-100 rounded text-xs overflow-auto">
                            {JSON.stringify(message.payload, null, 2)}
                          </pre>
                        </details>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
