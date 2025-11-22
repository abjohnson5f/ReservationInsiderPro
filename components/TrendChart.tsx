import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ChartDataPoint } from '../types';

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

  return (
    <div className="h-64 w-full shrink-0 bg-slate-800/30 rounded-xl p-4 border border-slate-700/50 backdrop-blur-sm">
      <h3 className="text-slate-400 text-xs font-bold mb-4 uppercase tracking-wider font-mono">7-Day Price Velocity</h3>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{
            top: 10,
            right: 10,
            left: 0,
            bottom: 0,
          }}
        >
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f5b029" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#f5b029" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis 
            dataKey="day" 
            stroke="#94a3b8" 
            tick={{fontSize: 12}} 
            tickLine={false}
            axisLine={false}
          />
          <YAxis 
            stroke="#94a3b8" 
            tick={{fontSize: 12}} 
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `$${value}`}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff' }}
            itemStyle={{ color: '#f5b029' }}
            formatter={(value: number) => [`$${value}`, 'Avg Price']}
          />
          <Area 
            type="monotone" 
            dataKey="value" 
            stroke="#f5b029" 
            strokeWidth={2}
            fillOpacity={1} 
            fill="url(#colorValue)" 
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TrendChart;