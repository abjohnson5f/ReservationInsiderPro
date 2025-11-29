import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { ChartDataPoint } from '../types';
import { Info, Activity } from 'lucide-react';

interface TrendChartProps {
  data: ChartDataPoint[];
  loading: boolean;
}

const TrendChart: React.FC<TrendChartProps> = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="h-64 w-full shrink-0 bg-slate-800/50 rounded-xl animate-pulse flex items-center justify-center border border-slate-700">
        <span className="text-slate-500 font-mono text-sm">Loading Market Data...</span>
      </div>
    );
  }

  if (data.length === 0) {
    return (
        <div className="h-64 w-full shrink-0 bg-slate-800/50 rounded-xl flex items-center justify-center border border-slate-700 border-dashed">
          <span className="text-slate-500 font-mono text-sm">Select a restaurant to view trends</span>
        </div>
    );
  }

  // Calculate average to set a baseline
  const avgValue = data.reduce((acc, curr) => acc + curr.value, 0) / data.length;

  return (
    <div className="h-64 w-full shrink-0 bg-slate-800/30 rounded-xl p-4 border border-slate-700/50 backdrop-blur-sm flex flex-col">
      <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-amber-500" />
            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider font-mono">7-Day Price Velocity</h3>
          </div>
          
          <div className="group/tooltip relative">
            <Info className="w-3.5 h-3.5 text-slate-600 hover:text-slate-400 cursor-help" />
            <div className="absolute right-0 top-full mt-2 w-64 bg-slate-950 border border-slate-800 p-3 rounded shadow-xl text-[10px] text-slate-300 z-50 hidden group-hover/tooltip:block pointer-events-none leading-relaxed">
                <strong className="block text-amber-500 mb-1">MOMENTUM INDICATOR</strong>
                Tracks the speed at which resale prices are changing. 
                <br/><br/>
                <span className="text-emerald-400">Steep Upward Slope:</span> Panic buying. Squeeze supply.
                <br/>
                <span className="text-red-400">Downward Slope:</span> Market saturation. Sell immediately.
            </div>
          </div>
      </div>

      <div className="flex-grow min-h-0">
        <ResponsiveContainer width="100%" height="100%">
            <AreaChart
            data={data}
            margin={{
                top: 5,
                right: 5,
                left: -20, // Pull axis closer
                bottom: 0,
            }}
            >
            <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f5b029" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#f5b029" stopOpacity={0}/>
                </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} opacity={0.5} />
            <XAxis 
                dataKey="day" 
                stroke="#64748b" 
                tick={{fontSize: 10, fontFamily: 'monospace'}} 
                tickLine={false}
                axisLine={false}
                dy={10}
            />
            <YAxis 
                stroke="#64748b" 
                tick={{fontSize: 10, fontFamily: 'monospace'}} 
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `$${value}`}
            />
            <Tooltip 
                contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                itemStyle={{ color: '#f5b029' }}
                formatter={(value: number) => [`$${value}`, 'Avg Price']}
                cursor={{ stroke: '#475569', strokeWidth: 1, strokeDasharray: '4 4' }}
            />
            <ReferenceLine y={avgValue} stroke="#475569" strokeDasharray="3 3" strokeOpacity={0.5} />
            <Area 
                type="monotone" 
                dataKey="value" 
                stroke="#f5b029" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorValue)" 
                activeDot={{ r: 4, fill: '#fff', stroke: '#f5b029', strokeWidth: 2 }}
            />
            </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default TrendChart;