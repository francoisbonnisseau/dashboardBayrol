import { MessageCircle, Settings as SettingsIcon, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NavigationProps {
  activeView: 'conversations' | 'sentiment' | 'settings';
  onViewChange: (view: 'conversations' | 'sentiment' | 'settings') => void;
}

export default function Navigation({ activeView, onViewChange }: NavigationProps) {
  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">      <div className="w-full px-6">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <MessageCircle className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold">Botpress Dashboard</span>
            </div>
              <div className="flex items-center space-x-1">
              <Button
                variant={activeView === 'conversations' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onViewChange('conversations')}
                className="flex items-center gap-2"
              >
                <MessageCircle className="h-4 w-4" />
                Conversations
              </Button>
              
              <Button
                variant={activeView === 'sentiment' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onViewChange('sentiment')}
                className="flex items-center gap-2"
              >
                <BarChart3 className="h-4 w-4" />
                Sentiment
              </Button>
              
              <Button
                variant={activeView === 'settings' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onViewChange('settings')}
                className="flex items-center gap-2"
              >
                <SettingsIcon className="h-4 w-4" />
                Settings
              </Button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
