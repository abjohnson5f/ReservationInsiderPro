
import React from 'react';
import { Restaurant } from '../types';
import { ArrowUpRight, ArrowDownRight, ArrowRight, Flame, Clock, CheckCircle2, Info, SignalHigh, SignalMedium, SignalLow, Target } from 'lucide-react';

interface RestaurantCardProps {
  restaurant: Restaurant;
  isSelected: boolean;
  onClick: () => void;
  onTrack: () => void;
}

const RestaurantCard: React.FC<RestaurantCardProps> = ({ restaurant, isSelected, onClick, onTrack }) => {
  const getDiffColor = (level: string) => {
    switch (level) {
      case 'Impossible': return 'text-purple-400 bg-purple-400/10 border-purple-400/20';
      case 'High': return 'text-red-400 bg-red-400/10 border-red-400/20';
      case 'Medium': return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
      default: return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
        case 'UP': return <ArrowUpRight className="w-4 h-4 text-emerald-400" />;
        case 'DOWN': return <ArrowDownRight className="w-4 h-4 text-red-400" />;
        default: return <ArrowRight className="w-4 h-4 text-slate-500" />;
    }
  };

  const getConfidenceIcon = (conf?: string) => {
      switch(conf) {
          case 'High': return <SignalHigh className="w-3 h-3 text-emerald-500" />;
          case 'Medium': return <SignalMedium className="w-3 h-3 text-amber-500" />;
          case 'Low': return <SignalLow className="w-3 h-3 text-red-500" />;
          default: return <SignalMedium className="w-3 h-3 text-slate-500" />;
      }
  }

  return (
    <div 
      onClick={onClick}
      className={`
        group relative p-5 rounded-xl border transition-all duration-300 cursor-pointer overflow-hidden
        ${isSelected 
          ? 'bg-slate-800 border-amber-500 shadow-lg shadow-amber-900/20' 
          : 'bg-slate-900 border-slate-800 hover:border-slate-600 hover:bg-slate-800/50'}
      `}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1 pr-4">
          <div className="flex items-center gap-2 mb-1">
             <h3 className="text-lg font-bold text-white group-hover:text-amber-500 transition-colors truncate">{restaurant.name}</h3>
             {restaurant.popularityScore > 90 && <Flame className="w-4 h-4 text-orange-500 animate-pulse shrink-0" />}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">{restaurant.cuisine}</p>
            {restaurant.sources && restaurant.sources.length > 0 && (
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-slate-800/50 border border-slate-700/50">
                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
                    <span className="text-[9px] text-slate-500">VERIFIED</span>
                </div>
            )}
            {restaurant.dataConfidence && (
                 <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-slate-800/50 border border-slate-700/50" title={`Data Confidence: ${restaurant.dataConfidence}`}>
                    {getConfidenceIcon(restaurant.dataConfidence)}
                    <span className="text-[9px] text-slate-500">{restaurant.dataConfidence.toUpperCase()} CONF.</span>
                 </div>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
            <div className="flex items-center justify-end gap-1" title={`Market Trend: ${restaurant.trend}`}>
                {getTrendIcon(restaurant.trend)}
                <span className="text-xl font-mono font-bold text-white">${restaurant.estimatedResaleValue}</span>
            </div>
            <div className="flex items-center justify-end gap-1 relative">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">Est. Avg Resale</span>
                <div className="group/tooltip relative">
                    <Info className="w-3 h-3 text-slate-600 hover:text-slate-400 cursor-help" />
                    <div className="absolute right-0 bottom-full mb-2 w-48 bg-slate-950 border border-slate-800 p-2 rounded shadow-xl text-[10px] text-slate-300 z-10 hidden group-hover/tooltip:block pointer-events-none">
                        Weighted average of current listings and recent sales found on Appointment Trader and other exchanges.
                    </div>
                </div>
            </div>
            {/* Price Range Indicator */}
            {(restaurant.priceLow !== undefined && restaurant.priceHigh !== undefined) && (
                <div className="text-[10px] text-slate-400 mt-1 font-mono">
                    ${restaurant.priceLow} - ${restaurant.priceHigh}
                </div>
            )}
        </div>
      </div>

      <p className="text-sm text-slate-300 mb-4 line-clamp-2 opacity-80 min-h-[40px]">{restaurant.description}</p>

      <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-800 group-hover:border-slate-700 transition-colors">
        <div className={`text-xs px-2 py-1 rounded border ${getDiffColor(restaurant.difficultyLevel)} font-medium`}>
            {restaurant.difficultyLevel.toUpperCase()} DEMAND
        </div>
        
        {/* Track Action */}
        <button 
            onClick={(e) => {
                e.stopPropagation();
                onTrack();
            }}
            className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-amber-500 text-slate-300 hover:text-slate-900 rounded border border-slate-700 hover:border-amber-400 transition-all text-xs font-bold shadow-lg shadow-black/50"
        >
            <Target className="w-3 h-3" />
            TRACK SIGNAL
        </button>
      </div>

      {/* Active Selection Indicator */}
      {isSelected && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500"></div>
      )}
    </div>
  );
};

export default RestaurantCard;
