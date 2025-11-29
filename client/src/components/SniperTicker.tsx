import React, { useState, useEffect } from 'react';
import { PortfolioItem } from '../types';
import { Crosshair, Timer, AlertCircle, ExternalLink, ChevronUp, ChevronDown } from 'lucide-react';

interface SniperTickerProps {
  items: PortfolioItem[];
  onAlert?: (message: string) => void;
}

interface TickerItem {
  id: string;
  name: string;
  timeLeft: string;
  secondsRemaining: number;
  isUrgent: boolean;
  dropTime: string;
}

const SniperTicker: React.FC<SniperTickerProps> = ({ items, onAlert }) => {
  const [tickerItems, setTickerItems] = useState<TickerItem[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);
  const [lastAlertTime, setLastAlertTime] = useState<number>(0);

  // Enhanced: Calculate time left using full date/time/timezone
  const calculateTimeLeft = (item: PortfolioItem) => {
    const now = new Date();
    let target: Date;

    if (item.nextDropDate && item.nextDropTime && item.dropTimezone) {
        // NEW: Use full date/time/timezone
        const dateTimeString = `${item.nextDropDate}T${item.nextDropTime}:00`;
        target = new Date(dateTimeString);
        
        // Simple timezone offset mapping
        const timezoneOffsets: Record<string, number> = {
            'America/Los_Angeles': -8,
            'America/New_York': -5,
            'America/Chicago': -6,
            'Europe/London': 0,
            'Europe/Paris': 1,
            'Asia/Tokyo': 9
        };
        
        const offset = timezoneOffsets[item.dropTimezone] || 0;
        const localOffset = -now.getTimezoneOffset() / 60;
        const hoursDiff = offset - localOffset;
        target.setHours(target.getHours() - hoursDiff);
    } else if (item.dropTime) {
        // FALLBACK: Old logic
        const [hours, minutes] = item.dropTime.split(':').map(Number);
        target = new Date();
        target.setHours(hours, minutes, 0, 0);
        if (target <= now) {
            target.setDate(target.getDate() + 1);
        }
    } else {
        return { display: '--:--:--', seconds: 0 };
    }

    const diff = target.getTime() - now.getTime();
    
    if (diff < 0) {
        return { display: '00:00:00', seconds: 0 };
    }
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const m = Math.floor((diff / (1000 * 60)) % 60);
    const s = Math.floor((diff / 1000) % 60);

    const display = days > 0 
        ? `${days}d ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
        : `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

    return {
        display,
        seconds: diff / 1000
    };
  };

  useEffect(() => {
    const updateTicker = () => {
        const watching = items.filter(i => i.status === 'WATCHING' && (i.dropTime || i.nextDropDate));
        
        const processed = watching.map(item => {
            const { display, seconds } = calculateTimeLeft(item);
            return {
                id: item.id,
                name: item.restaurantName,
                timeLeft: display,
                secondsRemaining: seconds,
                isUrgent: seconds < 300, // Less than 5 minutes
                dropTime: item.nextDropTime || item.dropTime || '--:--'
            };
        });

        // Sort by soonest
        const sorted = processed.sort((a, b) => a.secondsRemaining - b.secondsRemaining);
        setTickerItems(sorted);

        // Handle Alerts (Throttled to once per minute to avoid spam)
        const now = Date.now();
        const urgentItem = sorted.find(i => i.isUrgent);
        
        if (urgentItem && onAlert && (now - lastAlertTime > 60000)) {
            onAlert(`SNIPER ALERT: ${urgentItem.name} drops in ${urgentItem.timeLeft}!`);
            setLastAlertTime(now);
        }
    };

    const timer = setInterval(updateTicker, 1000);
    updateTicker(); // Initial run

    return () => clearInterval(timer);
  }, [items, lastAlertTime, onAlert]);

  if (tickerItems.length === 0) return null;

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-40 transition-all duration-300 transform ${isExpanded ? 'translate-y-0' : 'translate-y-[calc(100%-32px)]'}`}>
        {/* Toggle Tab */}
        <div className="absolute -top-8 left-1/2 -translate-x-1/2">
            <button 
                onClick={() => setIsExpanded(!isExpanded)}
                className="bg-slate-900 border-t border-x border-slate-700 text-slate-400 hover:text-amber-500 px-4 py-1 rounded-t-lg text-xs font-bold uppercase flex items-center gap-2 shadow-lg"
            >
                {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
                Active Snipers ({tickerItems.length})
            </button>
        </div>

        {/* Main Bar */}
        <div className="bg-slate-950/95 backdrop-blur-md border-t border-slate-800 shadow-2xl p-4 pb-6">
            <div className="max-w-7xl mx-auto">
                <div className="flex overflow-x-auto gap-4 pb-2 scrollbar-hide">
                    {tickerItems.map(item => (
                        <div 
                            key={item.id}
                            className={`
                                flex-shrink-0 min-w-[200px] p-3 rounded-lg border flex items-center justify-between group
                                ${item.isUrgent 
                                    ? 'bg-red-900/20 border-red-500/50 animate-pulse-slow' 
                                    : 'bg-slate-900 border-slate-800'}
                            `}
                        >
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-xs font-bold ${item.isUrgent ? 'text-red-400' : 'text-slate-400'}`}>
                                        {item.name}
                                    </span>
                                    {item.isUrgent && <AlertCircle className="w-3 h-3 text-red-500" />}
                                </div>
                                <div className={`font-mono text-xl font-bold tracking-widest ${item.isUrgent ? 'text-red-100' : 'text-white'}`}>
                                    {item.timeLeft}
                                </div>
                            </div>
                            
                            <div className="flex flex-col gap-1">
                                <span className="text-[9px] text-slate-600 font-mono text-right">DROP {item.dropTime}</span>
                                <a 
                                    href={`https://www.google.com/search?q=${item.name}+reservation`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1.5 bg-slate-800 hover:bg-emerald-600 text-slate-400 hover:text-white rounded transition-colors"
                                    title="Launch Breach"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                </a>
                            </div>
                        </div>
                    ))}
                    
                    {/* Add New Placeholder */}
                    <div className="flex-shrink-0 min-w-[100px] flex items-center justify-center border border-dashed border-slate-800 rounded-lg text-slate-600 text-xs font-mono uppercase">
                        Monitoring...
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};

export default SniperTicker;


