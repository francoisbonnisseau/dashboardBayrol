import { useState, useEffect, useRef } from 'react';
import { useBotpressClient } from '../hooks/useBotpressClient';
import {
  DetailPanel,
  Toolbar,
  LoadingState,
  ErrorState,
  EmptyState,
} from '@/components/dashboard';

import { Button } from '@/components/ui/button';
import { RefreshCw, User, Bot, Clock } from 'lucide-react';
import type { Message } from '../types';
import { formatBotpressError } from '@/lib/errorMessages';
import MessagePayloadContent from './MessagePayloadContent';

interface ConversationDetailProps {
  botId: string;
  conversationId: string;
  onClose: () => void;
  open: boolean;
}

export default function ConversationDetail({
  botId,
  conversationId,
  onClose,
  open,
}: ConversationDetailProps) {
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
  const groupedMessages = messages
    .slice()
    .reverse()
    .reduce((groups: Message[][], message) => {
      const lastGroup = groups[groups.length - 1];
      if (!lastGroup) {
        return [[message]];
      }

      const lastMessage = lastGroup[lastGroup.length - 1];
      const messageTime = new Date(message.createdAt).getTime();
      const lastMessageTime = new Date(lastMessage.createdAt).getTime();
      const sameDirection = message.direction === lastMessage.direction;
      const closeInTime =
        Math.abs(messageTime - lastMessageTime) < 2 * 60 * 1000; // 2 minutes

      if (sameDirection && closeInTime) {
        lastGroup.push(message);
        return groups;
      } else {
        return [...groups, [message]];
      }
    }, []);
  return (
    <DetailPanel
      size="wide"
      open={open}
      onOpenChange={(isOpen) => !isOpen && onClose()}
      title="Conversation details"
      description={conversationId}
    >
      <Toolbar
        actions={
          <Button variant="outline" onClick={fetchMessages} disabled={loading}>
            <RefreshCw className="size-4" />
            Refresh
          </Button>
        }
      />
      <div ref={messagesContainerRef}>
        {error && (
          <ErrorState
            title="Unable to load messages"
            description={error}
            onRetry={fetchMessages}
            retrying={loading}
          />
        )}

        {loading && !messages.length ? (
          <LoadingState variant="panel" />
        ) : messages.length === 0 ? (
          <EmptyState title="No messages found" />
        ) : (
          <div className="space-y-6">
            {groupedMessages.map((group, groupIndex) => {
              const direction = group[0].direction;
              return (
                <div
                  key={groupIndex}
                  className={`flex ${direction === 'incoming' ? 'justify-start' : 'justify-end'}`}
                >
                  <div
                    className={`max-w-[85%] space-y-2 ${direction === 'incoming' ? 'mr-auto' : 'ml-auto'}`}
                  >
                    {group.map((message, messageIndex) => (
                      <article
                        key={message.id}
                        className={`overflow-hidden ${
                          message.direction === 'incoming'
                            ? 'conversation-message-user'
                            : 'conversation-message-bot'
                        } ${messageIndex === 0 ? 'mb-1' : 'mt-1 mb-1'}`}
                      >
                        <div className="p-3">
                          {messageIndex === 0 && (
                            <div className="flex items-center justify-between mb-2 text-xs">
                              <div className="flex items-center">
                                {message.direction === 'incoming' ? (
                                  <User className="h-4 w-4 mr-1 text-foreground" />
                                ) : (
                                  <Bot className="h-4 w-4 mr-1 text-foreground" />
                                )}
                                <span
                                  className={`font-medium ${
                                    message.direction === 'incoming'
                                      ? 'text-foreground'
                                      : 'text-foreground'
                                  }`}
                                >
                                  {message.direction === 'incoming'
                                    ? 'User'
                                    : 'Bot'}
                                </span>
                              </div>
                              <div className="flex items-center text-muted-foreground">
                                <Clock className="h-3 w-3 mr-1" />
                                {formatDate(message.createdAt)}
                              </div>
                            </div>
                          )}

                          <MessagePayloadContent payload={message.payload} />
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
    </DetailPanel>
  );
}
