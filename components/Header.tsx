import React from 'react';
import { TrendingUp, Activity, ShieldAlert } from 'lucide-react';

const Header: React.FC = () => {
  return (
    <header className="w-full bg-slate-900 border-b border-slate-800 p-4 sticky top-0 z-50 backdrop-blur-md bg-opacity-80">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="bg-amber-500 p-2 rounded-lg">
            <TrendingUp className="text-slate-900 w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">ReservationInsider<span className="text-amber-500">Pro</span></h1>
            <p className="text-xs text-slate-400 font-mono">MARKET INTELLIGENCE UNIT</p>
          </div>
        </div>
        
        <div className="flex gap-4 items-center">
            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 border border-slate-700" title="Estimated Global Trading Volume (24h)">
                <Activity className="w-4 h-4 text-emerald-400" />
                <span className="text-sm text-slate-300">24h VOL: <span className="text-white font-mono">$342,850</span></span>
            </div>
            <button className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white">
                <ShieldAlert className="w-5 h-5" />
            </button>
        </div>
      </div>
    </header>
  );
};

export default Header;