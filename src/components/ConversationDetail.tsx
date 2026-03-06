import { useState, useEffect, useRef } from 'react';
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
import { formatBotpressError } from '@/lib/errorMessages';

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  
  const client = useBotpressClient(botId);

  const fetchMessages = async () => {
    if (!client || !conversationId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await client.listMessages({ conversationId });
      setMessages(response.messages || []);
    } catch (err) {
      setError(formatBotpressError(err, 'Failed to fetch messages'));
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

  // Scroll to bottom when messages load
  useEffect(() => {
    if (messages.length > 0 && !loading) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };
  
  // Group messages that are sent close together in time (within 2 minutes)
  const groupedMessages = messages.slice().reverse().reduce((groups: Message[][], message) => {
    const lastGroup = groups[groups.length - 1];
    if (!lastGroup) {
      return [[message]];
    }
    
    const lastMessage = lastGroup[lastGroup.length - 1];
    const messageTime = new Date(message.createdAt).getTime();
    const lastMessageTime = new Date(lastMessage.createdAt).getTime();
    const sameDirection = message.direction === lastMessage.direction;
    const closeInTime = Math.abs(messageTime - lastMessageTime) < 2 * 60 * 1000; // 2 minutes
    
    if (sameDirection && closeInTime) {
      lastGroup.push(message);
      return groups;
    } else {
      return [...groups, [message]];
    }
  }, []);
  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent side="right" className="w-full md:max-w-xl lg:max-w-2xl xl:max-w-4xl p-0 overflow-hidden bg-white shadow-xl border-l !bg-opacity-100">
        <SheetHeader className="sticky top-0 z-10 bg-white p-4 border-b shadow-sm">
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
          <SheetDescription className="mt-2">Conversation identifier</SheetDescription>
          <div className="flex items-center justify-between mt-2 text-muted-foreground">
            <span className="font-mono text-xs">{conversationId}</span>
          </div>
        </SheetHeader>
        
        <div className="sheet-scrollable-content py-6 px-4 bg-white" ref={messagesContainerRef}>
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
            <div className="space-y-6">
              {groupedMessages.map((group, groupIndex) => {
                const direction = group[0].direction;
                return (
                  <div 
                    key={groupIndex}
                    className={`flex message-fade-in ${direction === 'incoming' ? 'justify-start' : 'justify-end'}`}
                  >
                    <div className={`max-w-[85%] space-y-2 ${direction === 'incoming' ? 'mr-auto' : 'ml-auto'}`}>
                      {group.map((message, messageIndex) => (
                        <Card 
                          key={message.id} 
                          className={`overflow-hidden ${
                            message.direction === 'incoming' 
                              ? 'conversation-message-user' 
                              : 'conversation-message-bot'
                          } ${messageIndex === 0 ? 'mb-1' : 'mt-1 mb-1'}`}
                        >
                          <CardContent className="p-3">
                            {messageIndex === 0 && (
                              <div className="flex items-center justify-between mb-2 text-xs">
                                <div className="flex items-center">
                                  {message.direction === 'incoming' ? (
                                    <User className="h-4 w-4 mr-1 text-blue-700" />
                                  ) : (
                                    <Bot className="h-4 w-4 mr-1 text-green-700" />
                                  )}
                                  <span className={`font-medium ${
                                    message.direction === 'incoming' ? 'text-blue-700' : 'text-green-700'
                                  }`}>
                                    {message.direction === 'incoming' ? 'User' : 'Bot'}
                                  </span>
                                </div>
                                <div className="flex items-center text-muted-foreground">
                                  <Clock className="h-3 w-3 mr-1" />
                                  {formatDate(message.createdAt)}
                                </div>
                              </div>
                            )}
                            
                            <div>
                              {message.payload.text ? (
                                <p className="text-sm whitespace-pre-wrap">{message.payload.text}</p>
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
                                  <pre className="mt-2 p-2 bg-gray-800 text-gray-100 rounded text-xs overflow-auto max-h-40">
                                    {JSON.stringify(message.payload, null, 2)}
                                  </pre>
                                </details>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
