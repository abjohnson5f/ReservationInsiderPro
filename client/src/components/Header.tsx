import React, { useState, useEffect } from 'react';
import { TrendingUp, Activity, ShieldAlert } from 'lucide-react';

interface HeaderProps {
  portfolioValue?: number;
}

const Header: React.FC<HeaderProps> = ({ portfolioValue = 0 }) => {
  const [globalVolume, setGlobalVolume] = useState<number>(0);

  useEffect(() => {
    // Simulate global market activity based on portfolio value + randomness
    // In production, this could pull from an aggregated market_data table
    const baseVolume = portfolioValue * 100; // Multiplier for market effect
    const volatility = Math.random() * 50000; // Add market noise
    setGlobalVolume(Math.floor(baseVolume + volatility + 250000)); // Minimum floor
    
    // Update every 30 seconds to show "live" activity
    const interval = setInterval(() => {
      const newVolatility = Math.random() * 50000;
      setGlobalVolume(Math.floor(baseVolume + newVolatility + 250000));
    }, 30000);

    return () => clearInterval(interval);
  }, [portfolioValue]);

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
                <span className="text-sm text-slate-300">24h VOL: <span className="text-white font-mono">${globalVolume.toLocaleString()}</span></span>
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