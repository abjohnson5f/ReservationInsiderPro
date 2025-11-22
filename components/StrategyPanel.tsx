import React from 'react';
import { MarketInsight } from '../types';
import { Sparkles, MonitorSmartphone, AlertTriangle, CalendarCheck, Globe, ExternalLink, Database, Server } from 'lucide-react';

interface StrategyPanelProps {
  insight: MarketInsight | null;
  restaurantName: string;
  loading: boolean;
}

const StrategyPanel: React.FC<StrategyPanelProps> = ({ insight, restaurantName, loading }) => {
  if (loading) {
    return (
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 min-h-[500px] flex flex-col items-center justify-center text-center">
        <Sparkles className="w-8 h-8 text-slate-600 animate-spin mb-4" />
        <p className="text-slate-400 animate-pulse font-mono text-sm">Initializing scraping agents for {restaurantName}...</p>
        <p className="text-xs text-slate-600 mt-2">Querying Reddit, AppointmentTrader, Resy...</p>
      </div>
    );
  }

  if (!insight) {
    return (
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 min-h-[500px] flex flex-col items-center justify-center text-center">
        <p className="text-slate-500">Select a restaurant to generate a real-time trading strategy.</p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl border border-slate-700 p-6 min-h-[500px] shadow-xl relative overflow-hidden flex flex-col">
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

      <div className="flex items-center gap-2 mb-6">
        <Sparkles className="w-5 h-5 text-amber-500" />
        <h2 className="text-lg font-bold text-white">Alpha Strategy: <span className="text-amber-400">{restaurantName}</span></h2>
      </div>

      <div className="space-y-6 flex-grow">
        <div className="bg-slate-950/50 p-4 rounded-lg border border-slate-800">
            <h4 className="text-xs text-slate-400 font-bold uppercase mb-2 flex items-center gap-2">
                <MonitorSmartphone className="w-3 h-3" /> Execution Plan
            </h4>
            <p className="text-sm text-slate-200 leading-relaxed font-medium">{insight.strategy}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800">
                <h4 className="text-xs text-slate-400 font-bold uppercase mb-2 flex items-center gap-2">
                    <CalendarCheck className="w-3 h-3" /> Peak Liquidity
                </h4>
                <div className="flex flex-wrap gap-1">
                    {insight.peakTimes.map((time, i) => (
                        <span key={i} className="text-xs bg-emerald-900/30 text-emerald-400 px-2 py-1 rounded border border-emerald-900/50">
                            {time}
                        </span>
                    ))}
                </div>
            </div>
             <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800">
                <h4 className="text-xs text-slate-400 font-bold uppercase mb-2">Platform</h4>
                <span className="text-sm text-white font-mono">{insight.platform}</span>
            </div>
        </div>

        <div className="bg-red-900/10 border border-red-900/30 p-3 rounded-lg flex gap-3 items-start">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
                <h4 className="text-xs text-red-400 font-bold uppercase mb-1">Risk Analysis</h4>
                <p className="text-xs text-red-200/80 leading-normal">{insight.riskFactor}</p>
            </div>
        </div>
      </div>

      {/* Source Intelligence */}
      <div className="mt-6 pt-4 border-t border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[10px] text-slate-500 font-bold uppercase flex items-center gap-1">
                <Server className="w-3 h-3" /> Live Data Feed
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