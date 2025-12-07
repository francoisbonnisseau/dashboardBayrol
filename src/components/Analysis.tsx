import { useState, useEffect, useCallback } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useBotpressClient } from '../hooks/useBotpressClient';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, ArrowRight, Brain, Search, Loader2, MessagesSquare } from 'lucide-react';
import { subDays } from 'date-fns';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

// Using the same table name as the SentimentAnalysis component
const TABLE_NAME = 'conversationsAnalysisTable';

interface SentimentRow {
  id: number;
  createdAt: string;
  updatedAt: string;
  date: string;
  topics?: string;
  summary?: string;
  resolved: boolean;
  sentiment: 'very negative' | 'negative' | 'neutral' | 'positive' | 'very positive';
  transcript?: string;
  escalations?: string[];
  conversationId: string;
}

interface ConversationMessage {
  id: string;
  direction: 'incoming' | 'outgoing';
  payload: { text: string };
  createdAt: string;
}

type AnalysisStep = 'select-data' | 'enter-prompt' | 'view-results';
type DataSelectionMethod = 'date-range' | 'sentiment' | 'topics';

export default function Analysis() {
  const { settings } = useSettings();
  const [selectedBotId, setSelectedBotId] = useState<string>('');
  const [step, setStep] = useState<AnalysisStep>('select-data');
  const [selectionMethod, setSelectionMethod] = useState<DataSelectionMethod>('date-range');
  
  // Data selection states
  const [startDate, setStartDate] = useState<Date | undefined>(subDays(new Date(), 7));
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [selectedSentiment, setSelectedSentiment] = useState<string>('negative');
  const [searchTopic, setSearchTopic] = useState<string>('');
  
  // Prompt and results states
  const [prompt, setPrompt] = useState<string>('');
  const [systemPrompt, setSystemPrompt] = useState<string>(
    'You are an expert conversation analyst. Analyze these customer service conversations and provide insights.'
  );
  const [analysisResults, setAnalysisResults] = useState<string>('');
  const [selectedConversations, setSelectedConversations] = useState<SentimentRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
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
    // Fetch conversations based on criteria
  const fetchFilteredConversations = useCallback(async () => {
    if (!client) return;
    setIsLoading(true);
    
    try {
      let filteredRows: SentimentRow[] = [];
      
      // First check if the table exists
      const tableResponse = await client.getTable({ 
        table: TABLE_NAME 
      });
      
      if (!tableResponse) {
        toast.error('Failed to fetch conversation data');
        setIsLoading(false);
        return;
      }
      
      // Get all rows (we'll filter them client-side for flexibility)
      const { rows: allRows } = await client.findTableRows({
        table: TABLE_NAME,
        limit: 1000
      });
      
      if (!allRows || allRows.length === 0) {
        toast.error('No conversation data available');
        setIsLoading(false);
        return;
      }
      
      // Format the rows to match our SentimentRow interface
      const formattedRows = allRows.map((row: any) => ({
        id: row.id,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        date: row.date,
        topics: row.topics || '',
        summary: row.summary || '',
        resolved: !!row.resolved,
        sentiment: row.sentiment || 'neutral',
        transcript: row.transcript || '',
        escalations: row.escalations || [],
        conversationId: row.conversationId || ''
      }));
      
      // Apply filtering based on selection method
      switch (selectionMethod) {
        case 'date-range':
          if (startDate && endDate) {
            filteredRows = formattedRows.filter(row => {
              const rowDate = new Date(row.date);
              return rowDate >= startDate && rowDate <= endDate;
            });
          }
          break;
          
        case 'sentiment':
          filteredRows = formattedRows.filter(row => 
            row.sentiment.toLowerCase().includes(selectedSentiment.toLowerCase())
          );
          break;
          
        case 'topics':
          if (searchTopic) {
            filteredRows = formattedRows.filter(row => 
              row.topics?.toLowerCase().includes(searchTopic.toLowerCase())
            );
          }
          break;
      }
      
      setSelectedConversations(filteredRows);
      toast.success(`Found ${filteredRows.length} conversations matching your criteria`);
      
    } catch (error) {
      console.error('Error fetching conversations:', error);
      toast.error('Failed to fetch conversations');
    } finally {
      setIsLoading(false);
    }
  }, [client, selectionMethod, startDate, endDate, selectedSentiment, searchTopic]);
    // Fetch full conversation details for all selected conversations
  const fetchConversationDetails = async (): Promise<{conversationId: string, messages: ConversationMessage[]}[]> => {
    if (!client || selectedConversations.length === 0) return [];
    
    const conversationsWithMessages = [];
    
    for (const conversation of selectedConversations) {
      try {
        // Using listMessages to get conversation messages
        const response = await client.listMessages({ 
          conversationId: conversation.conversationId
        });
        
        if (response && response.messages) {
          conversationsWithMessages.push({
            conversationId: conversation.conversationId,
            messages: response.messages as unknown as ConversationMessage[]
          });
        }
      } catch (error) {
        console.error(`Error fetching messages for conversation ${conversation.conversationId}:`, error);
      }
    }
    
    return conversationsWithMessages;
  };
  
  // Run AI analysis
  const runAnalysis = async () => {
    if (!client) return;
    if (selectedConversations.length === 0) {
      toast.error('No conversations selected for analysis');
      return;
    }
    if (!prompt.trim()) {
      toast.error('Please enter a prompt for the analysis');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Fetch full conversation details
      const conversationsWithMessages = await fetchConversationDetails();
      
      // Format conversations for the AI
      const conversationsText = conversationsWithMessages.map(conv => {
        const messages = conv.messages.map(msg => 
          `${msg.direction === 'incoming' ? 'User' : 'Bot'}: ${msg.payload.text}`
        ).join('\n');
        
        return `--- Conversation ${conv.conversationId} ---\n${messages}\n`;
      }).join('\n\n');
        // Create user prompt with context
      const user_prompt = `${prompt}\n\nHere are the conversations to analyze:\n\n${conversationsText}`;
        // Call Google AI
      const googleAI_response: any = await client.callAction({
        type: "google-ai:generateContent",
        input: {
          model: { id: 'models/gemini-2.0-flash' },
          systemPrompt: systemPrompt,
          messages: [
            {
              role: 'user',
              type: 'text',
              content: user_prompt
            }
          ],
          responseFormat: 'text'
        }
      });      // Handle the API response according to the example structure you provided
      if (googleAI_response) {
        let textContent = '';
        
        // First try to extract content from the choices array structure as shown in your example
        if (googleAI_response.output.choices) {
          console.log("Analysis completed")
          const firstChoice = googleAI_response.output.choices[0];
          if (firstChoice && firstChoice.content) {
            textContent = firstChoice.content;
          }
        } 
        // Last resort: stringify the whole response to see its structure
        else {
          console.log("API response structure:", googleAI_response);
          textContent = "Could not extract text content from API response. Please check console for details.";
        }
        
        if (textContent) {
          setAnalysisResults(textContent);
          setStep('view-results');
          toast.success('Analysis completed!');
        } else {
          console.error('Response structure:', JSON.stringify(googleAI_response, null, 2));
          toast.error('Failed to extract content from AI response');
        }
      } else {
        toast.error('Failed to get analysis results from AI');
      }
      
    } catch (error) {
      console.error('Error during analysis:', error);
      toast.error('Failed to complete analysis');
    } finally {
      setIsLoading(false);
    }
  };
  
  const goToNextStep = () => {
    if (step === 'select-data') {
      if (selectedConversations.length === 0) {
        fetchFilteredConversations().then(() => {
          setStep('enter-prompt');
        });
      } else {
        setStep('enter-prompt');
      }
    } else if (step === 'enter-prompt') {
      runAnalysis();
    }
  };
  
  const goToPreviousStep = () => {
    if (step === 'enter-prompt') {
      setStep('select-data');
    } else if (step === 'view-results') {
      setStep('enter-prompt');
    }
  };
  
  const resetAnalysis = () => {
    setStep('select-data');
    setSelectedConversations([]);
    setAnalysisResults('');
    setPrompt('');
  };
    // This variable is commented out because it's not currently being used
  // const selectedBot = settings.bots.find(bot => bot.botId === selectedBotId);

  return (
    <div className="w-full px-6 py-4 space-y-4">
      {/* Header Card */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground">Bot:</span>
              <Select value={selectedBotId} onValueChange={setSelectedBotId}>
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue placeholder="Select a bot" />
                </SelectTrigger>
                <SelectContent>
                  {settings.bots.map(bot => (
                    <SelectItem key={bot.id} value={bot.botId}>
                      {bot.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-muted-foreground">
              Analyze conversations using AI
            </p>
          </div>
        </CardContent>
      </Card>
      
      {/* Step Indicator */}
      <div className="flex items-center justify-center py-2">
        <div className="flex items-center w-full max-w-2xl">
          <div className={`flex-1 flex flex-col items-center gap-2 ${step === 'select-data' ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step === 'select-data' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
              1
            </div>
            <span className="text-xs font-medium">Select Data</span>
          </div>
          <div className={`flex-1 h-0.5 ${step !== 'select-data' ? 'bg-primary' : 'bg-muted'}`} />
          <div className={`flex-1 flex flex-col items-center gap-2 ${step === 'enter-prompt' ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step === 'enter-prompt' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
              2
            </div>
            <span className="text-xs font-medium">AI Prompt</span>
          </div>
          <div className={`flex-1 h-0.5 ${step === 'view-results' ? 'bg-primary' : 'bg-muted'}`} />
          <div className={`flex-1 flex flex-col items-center gap-2 ${step === 'view-results' ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step === 'view-results' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
              3
            </div>
            <span className="text-xs font-medium">Results</span>
          </div>
        </div>
      </div>
      
      {step === 'select-data' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Select Conversations for Analysis</CardTitle>
            <CardDescription>Choose a method to filter conversations for AI analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={selectionMethod} onValueChange={(value) => setSelectionMethod(value as DataSelectionMethod)} className="w-full">
              <TabsList className="w-full mb-6">
                <TabsTrigger value="date-range" className="flex-1">By Date Range</TabsTrigger>
                <TabsTrigger value="sentiment" className="flex-1">By Sentiment</TabsTrigger>
                <TabsTrigger value="topics" className="flex-1">By Topics</TabsTrigger>
              </TabsList>
              
              <TabsContent value="date-range" className="space-y-4">
                <div className="flex flex-wrap items-end gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Start Date
                    </label>
                    <DatePicker date={startDate} setDate={setStartDate} className="w-[160px]" />
                  </div>
                  <span className="text-muted-foreground pb-2">→</span>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      End Date
                    </label>
                    <DatePicker date={endDate} setDate={setEndDate} className="w-[160px]" />
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="sentiment" className="space-y-4">
                <div className="flex flex-col gap-1.5 max-w-xs">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Sentiment
                  </label>
                  <Select value={selectedSentiment} onValueChange={setSelectedSentiment}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select sentiment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="very negative">Very Negative</SelectItem>
                      <SelectItem value="negative">Negative</SelectItem>
                      <SelectItem value="neutral">Neutral</SelectItem>
                      <SelectItem value="positive">Positive</SelectItem>
                      <SelectItem value="very positive">Very Positive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>
              
              <TabsContent value="topics" className="space-y-4">
                <div className="flex flex-col gap-1.5 max-w-md">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Topic Keywords
                  </label>
                  <Input 
                    placeholder="Enter topic keywords..." 
                    value={searchTopic} 
                    onChange={(e) => setSearchTopic(e.target.value)} 
                    className="h-9"
                  />
                </div>
              </TabsContent>
            </Tabs>
            
            {selectedConversations.length > 0 && (
              <div className="mt-6 p-4 border rounded-md bg-secondary/20">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">Selected Conversations</h3>
                  <Badge variant="outline">{selectedConversations.length} conversations</Badge>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button 
              variant="outline" 
              onClick={fetchFilteredConversations}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              Find Conversations
            </Button>
            <Button 
              onClick={goToNextStep}
              disabled={isLoading}
            >
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>
      )}
      
      {step === 'enter-prompt' && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Enter AI Analysis Prompt</CardTitle>
            <CardDescription>
              Provide instructions for what you want the AI to analyze in these conversations
              <Badge variant="outline" className="ml-2">{selectedConversations.length} conversations selected</Badge>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>System Prompt (AI context)</Label>              <Textarea 
                value={systemPrompt} 
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSystemPrompt(e.target.value)} 
                className="min-h-24"
                placeholder="You are an expert conversation analyst. Analyze these customer service conversations and provide insights."
              />
              <p className="text-sm text-muted-foreground">This sets the context for how the AI should think about the task.</p>
            </div>
            
            <div className="space-y-2">
              <Label>Analysis Instructions</Label>              <Textarea 
                value={prompt} 
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPrompt(e.target.value)} 
                className="min-h-32"
                placeholder="Analyze these customer service conversations and identify the top 3 pain points mentioned by customers. For each pain point, provide examples and suggest improvements."
              />
              <p className="text-sm text-muted-foreground">Be specific about what insights you're looking for and how you want them presented.</p>
            </div>
            
            <div className="bg-secondary/20 p-4 rounded-md">
              <h3 className="font-medium mb-2">Example prompts:</h3>
              <ul className="ml-5 list-disc space-y-1">
                <li>Identify common topics that lead to negative customer sentiment and suggest improvements</li>
                <li>Analyze response time patterns and their effect on customer satisfaction</li>
                <li>Extract the top 5 frequently asked questions from these conversations</li>
              </ul>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button 
              variant="outline" 
              onClick={goToPreviousStep}
              disabled={isLoading}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button 
              onClick={goToNextStep}
              disabled={isLoading || !prompt.trim()}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  Run Analysis
                  <Brain className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      )}
      
      {step === 'view-results' && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Analysis Results</CardTitle>
            <CardDescription>
              AI analysis of {selectedConversations.length} conversations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-secondary/10 p-4 rounded-md mb-4">
              <div className="font-medium mb-2">Analysis prompt:</div>
              <div className="text-muted-foreground">{prompt}</div>
            </div>            <div className="prose max-w-none">
              <h3>Analysis Results</h3>
              <div className="bg-white border rounded-md p-6">                <div className="markdown-content prose prose-headings:font-semibold prose-headings:text-primary prose-p:text-gray-700 prose-strong:font-bold prose-strong:text-gray-900 prose-ul:list-disc prose-ul:pl-6">
                  <ReactMarkdown>
                    {analysisResults}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button 
              variant="outline" 
              onClick={goToPreviousStep}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Edit Prompt
            </Button>
            <Button 
              onClick={resetAnalysis}
              variant="default"
            >
              <MessagesSquare className="mr-2 h-4 w-4" />
              New Analysis
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
