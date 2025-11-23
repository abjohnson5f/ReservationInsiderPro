import React, { useState, useEffect } from 'react';
import { MarketInsight } from '../types';
import { Sparkles, MonitorSmartphone, AlertTriangle, CalendarCheck, Globe, ExternalLink, Database, Server, Crosshair, Timer, Link2, Copy, CreditCard } from 'lucide-react';

interface StrategyPanelProps {
  insight: MarketInsight | null;
  restaurantName: string;
  loading: boolean;
}

const StrategyPanel: React.FC<StrategyPanelProps> = ({ insight, restaurantName, loading }) => {
  const [timeLeft, setTimeLeft] = useState<string>('--:--:--');
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  // Countdown Logic
  useEffect(() => {
    if (!insight?.releaseTime) return;

    const calculateTimeLeft = () => {
        const now = new Date();
        const [hours, minutes] = insight.releaseTime!.split(':').map(Number);
        
        // Create date object for the next occurrence of this time
        let target = new Date();
        target.setHours(hours, minutes, 0, 0);

        // If target is in the past, move to tomorrow
        if (target <= now) {
            target.setDate(target.getDate() + 1);
        }

        const diff = target.getTime() - now.getTime();
        
        const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const m = Math.floor((diff / (1000 * 60)) % 60);
        const s = Math.floor((diff / 1000) % 60);

        setTimeLeft(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
    };

    const timer = setInterval(calculateTimeLeft, 1000);
    calculateTimeLeft(); // Initial call

    return () => clearInterval(timer);
  }, [insight]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopySuccess(label);
    setTimeout(() => setCopySuccess(null), 2000);
  };

  if (loading) {
    return (
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 min-h-[500px] flex flex-col items-center justify-center text-center">
        <Crosshair className="w-10 h-10 text-slate-600 animate-spin mb-4" />
        <p className="text-slate-400 animate-pulse font-mono text-sm">Initializing Sniper Protocol...</p>
        <p className="text-xs text-slate-600 mt-2">Targeting {restaurantName} release windows...</p>
      </div>
    );
  }

  if (!insight) {
    return (
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 min-h-[500px] flex flex-col items-center justify-center text-center">
        <p className="text-slate-500">Select a restaurant to engage acquisition tools.</p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl border border-slate-700 p-6 min-h-[500px] shadow-xl relative overflow-hidden flex flex-col">
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-bold text-white">Alpha Strategy: <span className="text-amber-400">{restaurantName}</span></h2>
          </div>
          {insight.platform && (
              <span className="text-xs font-mono px-2 py-1 rounded bg-slate-950 border border-slate-800 text-slate-400">
                  {insight.platform}
              </span>
          )}
      </div>

      <div className="space-y-6 flex-grow">
        
        {/* SNIPER MODULE */}
        <div className="bg-slate-950 border border-amber-900/30 rounded-lg overflow-hidden relative group">
            <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
            <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs text-amber-500 font-bold uppercase flex items-center gap-2">
                        <Crosshair className="w-4 h-4" /> Acquisition Protocol
                    </h4>
                    {insight.releaseTime && (
                        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                            <span>DROP: {insight.releaseTime}</span>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                    {/* Countdown */}
                    <div className="bg-slate-900/50 p-3 rounded border border-slate-800 flex flex-col items-center justify-center">
                        <span className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Next Inventory Drop</span>
                        <div className="text-2xl font-mono font-bold text-white tracking-widest flex items-center gap-2">
                            <Timer className="w-4 h-4 text-emerald-500 animate-pulse" />
                            {timeLeft}
                        </div>
                    </div>

                    {/* Direct Links */}
                    <div className="flex flex-col gap-2 justify-center">
                        <a 
                            href={insight.bookingUrl || `https://www.google.com/search?q=${restaurantName}+reservation`} 
                            target="_blank" 
                            rel="noreferrer"
                            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2 rounded transition-colors shadow-lg shadow-emerald-900/20"
                        >
                            <ExternalLink className="w-3 h-3" />
                            DIRECT BREACH
                        </a>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => handleCopy('1234 5678 1234 5678', 'Card')} 
                                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-[10px] py-1.5 rounded flex items-center justify-center gap-1 transition-colors"
                            >
                                <CreditCard className="w-3 h-3" />
                                {copySuccess === 'Card' ? 'COPIED' : 'COPY CC'}
                            </button>
                             <button 
                                onClick={() => handleCopy('555-0199', 'Phone')}
                                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-[10px] py-1.5 rounded flex items-center justify-center gap-1 transition-colors"
                            >
                                <Copy className="w-3 h-3" />
                                {copySuccess === 'Phone' ? 'COPIED' : 'COPY TEL'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* Execution Plan */}
        <div className="bg-slate-950/50 p-4 rounded-lg border border-slate-800">
            <h4 className="text-xs text-slate-400 font-bold uppercase mb-2 flex items-center gap-2">
                <MonitorSmartphone className="w-3 h-3" /> Tactical Analysis
            </h4>
            <p className="text-sm text-slate-200 leading-relaxed font-medium">{insight.strategy}</p>
        </div>

        {/* Risk Factor */}
        <div className="bg-red-900/10 border border-red-900/30 p-3 rounded-lg flex gap-3 items-start">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
                <h4 className="text-xs text-red-400 font-bold uppercase mb-1">Liquidity Risk</h4>
                <p className="text-xs text-red-200/80 leading-normal">{insight.riskFactor}</p>
            </div>
        </div>
      </div>

      {/* Source Intelligence */}
      <div className="mt-6 pt-4 border-t border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[10px] text-slate-500 font-bold uppercase flex items-center gap-1">
                <Server className="w-3 h-3" /> Verified Intel
            </h4>
            <span className="text-[9px] text-emerald-500 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                Connected
            </span>
          </div>
          
          <div className="flex flex-col gap-2">
              {insight.sources && insight.sources.length > 0 ? (
                  insight.sources.slice(0, 3).map((source, idx) => (
                      <a 
                        key={idx} 
                        href={source.uri} 
                        target="_blank" 
                        rel="noreferrer"
                        className="group flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-800 hover:border-amber-500/30 hover:bg-slate-900 transition-all"
                      >
                          <div className="flex items-center gap-2 overflow-hidden">
                              <Database className="w-3 h-3 text-slate-600 group-hover:text-amber-500" />
                              <span className="text-[10px] text-slate-400 font-mono truncate max-w-[180px]">{source.title}</span>
                          </div>
                          <ExternalLink className="w-3 h-3 text-slate-600 group-hover:text-amber-500" />
                      </a>
                  ))
              ) : (
                  <div className="text-[10px] text-slate-600 italic">No external signals detected.</div>
              )}
          </div>
      </div>
    </div>
  );
};

export default StrategyPanel;