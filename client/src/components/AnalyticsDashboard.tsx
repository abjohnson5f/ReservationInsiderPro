/**
 * Analytics Dashboard Component
 * 
 * Displays Phase 2+3 features:
 * - Acquisition History
 * - Drop Pattern Learning
 * - Success Rate Stats
 * - Competition Monitor
 * - Dynamic Pricing
 */

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Target,
  Clock,
  CheckCircle2,
  XCircle,
  DollarSign,
  Users,
  BarChart3,
  RefreshCw,
  AlertTriangle,
  Zap,
  Eye,
  Calendar,
  Award,
} from 'lucide-react';

const API_BASE = 'http://localhost:3000/api/analytics';

interface SuccessStats {
  totalAttempts: number;
  successfulAttempts: number;
  successRate: number;
  byPlatform: Array<{ platform: string; attempts: number; successes: number; rate: number }>;
  byRestaurant: Array<{ name: string; attempts: number; successes: number; rate: number }>;
}

interface DropPattern {
  id: number;
  restaurant_name: string;
  platform: string;
  days_in_advance: number;
  drop_time: string;
  drop_timezone: string;
  confidence: number;
  successful_acquisitions: number;
  total_attempts: number;
  last_confirmed: string;
}

interface AcquisitionAttempt {
  restaurantName: string;
  platform: string;
  targetDate: string;
  attemptTime: string;
  success: boolean;
  confirmationCode?: string;
  error?: string;
}

interface CompetitorStats {
  sellerName: string;
  totalListings: number;
  avgPrice: number;
  avgDaysToSell: number;
  topRestaurants: string[];
}

interface PricingStats {
  avgSalePrice: number;
  avgListingPrice: number;
  topRestaurants: Array<{ name: string; avgPrice: number; salesCount: number }>;
}

const AnalyticsDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'patterns' | 'history' | 'competition' | 'pricing'>('overview');
  const [loading, setLoading] = useState(true);
  const [successStats, setSuccessStats] = useState<SuccessStats | null>(null);
  const [patterns, setPatterns] = useState<DropPattern[]>([]);
  const [history, setHistory] = useState<AcquisitionAttempt[]>([]);
  const [competitors, setCompetitors] = useState<CompetitorStats[]>([]);
  const [pricingStats, setPricingStats] = useState<PricingStats | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all data in parallel
      const [statsRes, patternsRes, historyRes, competitorsRes, pricingRes] = await Promise.all([
        fetch(`${API_BASE}/success-stats`).then(r => r.json()).catch(() => null),
        fetch(`${API_BASE}/patterns`).then(r => r.json()).catch(() => ({ patterns: [] })),
        fetch(`${API_BASE}/attempts?limit=20`).then(r => r.json()).catch(() => ({ history: [] })),
        fetch(`${API_BASE}/competition/stats`).then(r => r.json()).catch(() => ({ stats: [] })),
        fetch(`${API_BASE}/pricing/stats`).then(r => r.json()).catch(() => null),
      ]);

      if (statsRes?.success) setSuccessStats(statsRes);
      if (patternsRes?.patterns) setPatterns(patternsRes.patterns);
      if (historyRes?.history) setHistory(historyRes.history);
      if (competitorsRes?.stats) setCompetitors(competitorsRes.stats);
      if (pricingRes?.success) setPricingStats(pricingRes);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const initTables = async () => {
    try {
      await Promise.all([
        fetch(`${API_BASE}/patterns/init`, { method: 'POST' }),
        fetch(`${API_BASE}/competition/init`, { method: 'POST' }),
      ]);
      alert('Tables initialized successfully!');
      fetchData();
    } catch (error) {
      console.error('Failed to init tables:', error);
    }
  };

  const getPlatformColor = (platform: string) => {
    const colors: Record<string, string> = {
      resy: 'text-rose-400 bg-rose-500/20',
      opentable: 'text-red-400 bg-red-500/20',
      sevenrooms: 'text-purple-400 bg-purple-500/20',
      tock: 'text-teal-400 bg-teal-500/20',
    };
    return colors[platform.toLowerCase()] || 'text-slate-400 bg-slate-500/20';
  };

  if (loading) {
    return (
      <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-8 text-center">
        <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mx-auto mb-4" />
        <p className="text-slate-400">Loading analytics...</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/20 rounded-lg">
            <BarChart3 className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Analytics Dashboard</h3>
            <p className="text-xs text-slate-500">Patterns, history, competition & pricing</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={initTables}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg"
          >
            Init Tables
          </button>
          <button
            onClick={fetchData}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs rounded-lg flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-950/50">
        {[
          { id: 'overview', label: 'Overview', icon: TrendingUp },
          { id: 'patterns', label: 'Drop Patterns', icon: Clock },
          { id: 'history', label: 'History', icon: Target },
          { id: 'competition', label: 'Competition', icon: Eye },
          { id: 'pricing', label: 'Pricing', icon: DollarSign },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-3 text-sm border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-amber-500 text-amber-500'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
                  <Target className="w-4 h-4" />
                  Total Attempts
                </div>
                <div className="text-3xl font-bold text-white">{successStats?.totalAttempts || 0}</div>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                <div className="flex items-center gap-2 text-emerald-400 text-sm mb-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Successful
                </div>
                <div className="text-3xl font-bold text-emerald-400">{successStats?.successfulAttempts || 0}</div>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                <div className="flex items-center gap-2 text-amber-400 text-sm mb-2">
                  <Zap className="w-4 h-4" />
                  Success Rate
                </div>
                <div className="text-3xl font-bold text-amber-400">
                  {(successStats?.successRate || 0).toFixed(1)}%
                </div>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                <div className="flex items-center gap-2 text-blue-400 text-sm mb-2">
                  <Award className="w-4 h-4" />
                  Known Patterns
                </div>
                <div className="text-3xl font-bold text-blue-400">{patterns.length}</div>
              </div>
            </div>

            {/* Platform Breakdown */}
            {successStats?.byPlatform && successStats.byPlatform.length > 0 && (
              <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700">
                <h4 className="text-sm font-medium text-white mb-4">Success by Platform</h4>
                <div className="grid grid-cols-4 gap-3">
                  {successStats.byPlatform.map(p => (
                    <div key={p.platform} className="bg-slate-900/50 rounded-lg p-3">
                      <div className={`text-xs font-bold uppercase px-2 py-1 rounded inline-block ${getPlatformColor(p.platform)}`}>
                        {p.platform}
                      </div>
                      <div className="mt-2 text-2xl font-bold text-white">{p.rate.toFixed(1)}%</div>
                      <div className="text-xs text-slate-500">{p.successes}/{p.attempts} attempts</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Activity */}
            <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700">
              <h4 className="text-sm font-medium text-white mb-4">Recent Activity</h4>
              <div className="space-y-2">
                {history.slice(0, 5).map((h, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
                    <div className="flex items-center gap-3">
                      {h.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400" />
                      )}
                      <div>
                        <div className="text-sm text-white">{h.restaurantName}</div>
                        <div className="text-xs text-slate-500">
                          {new Date(h.attemptTime).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${getPlatformColor(h.platform)}`}>
                      {h.platform}
                    </span>
                  </div>
                ))}
                {history.length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-4">No acquisition attempts yet</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Patterns Tab */}
        {activeTab === 'patterns' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-slate-400">
                Learned drop patterns from successful acquisitions
              </p>
            </div>
            
            {patterns.length > 0 ? (
              <div className="space-y-2">
                {patterns.map(p => (
                  <div key={p.id} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium text-white">{p.restaurant_name}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs px-2 py-0.5 rounded ${getPlatformColor(p.platform)}`}>
                            {p.platform}
                          </span>
                          <span className="text-xs text-slate-500">
                            {p.days_in_advance} days ahead @ {p.drop_time}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-white">{p.confidence}% confidence</div>
                        <div className="text-xs text-slate-500">
                          {p.successful_acquisitions}/{p.total_attempts} successful
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-amber-500 to-emerald-500"
                        style={{ width: `${p.confidence}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No drop patterns learned yet</p>
                <p className="text-xs mt-1">Patterns are recorded after successful acquisitions</p>
              </div>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            {history.length > 0 ? (
              <div className="space-y-2">
                {history.map((h, i) => (
                  <div 
                    key={i} 
                    className={`bg-slate-800/50 rounded-lg p-4 border ${
                      h.success ? 'border-emerald-800/50' : 'border-slate-700'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-start gap-3">
                        {h.success ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-400 mt-0.5" />
                        )}
                        <div>
                          <div className="font-medium text-white">{h.restaurantName}</div>
                          <div className="text-xs text-slate-500 mt-1">
                            Target: {h.targetDate}
                          </div>
                          {h.confirmationCode && (
                            <div className="text-xs text-emerald-400 mt-1">
                              Confirmation: {h.confirmationCode}
                            </div>
                          )}
                          {h.error && (
                            <div className="text-xs text-red-400 mt-1">
                              Error: {h.error}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs px-2 py-1 rounded ${getPlatformColor(h.platform)}`}>
                          {h.platform}
                        </span>
                        <div className="text-xs text-slate-500 mt-2">
                          {new Date(h.attemptTime).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No acquisition history yet</p>
              </div>
            )}
          </div>
        )}

        {/* Competition Tab */}
        {activeTab === 'competition' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-400">
              Track other AppointmentTrader sellers
            </p>
            
            {competitors.length > 0 ? (
              <div className="space-y-2">
                {competitors.map((c, i) => (
                  <div key={i} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium text-white flex items-center gap-2">
                          <Users className="w-4 h-4 text-slate-400" />
                          {c.sellerName}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {c.topRestaurants.slice(0, 3).map((r, j) => (
                            <span key={j} className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded">
                              {r}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-white">{c.totalListings}</div>
                        <div className="text-xs text-slate-500">listings</div>
                        <div className="text-sm text-emerald-400 mt-1">${c.avgPrice.toFixed(0)} avg</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <Eye className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No competitor data yet</p>
                <p className="text-xs mt-1">Add competitor listings to start tracking</p>
              </div>
            )}
          </div>
        )}

        {/* Pricing Tab */}
        {activeTab === 'pricing' && (
          <div className="space-y-4">
            {pricingStats && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                    <div className="text-sm text-slate-400 mb-1">Avg Sale Price</div>
                    <div className="text-2xl font-bold text-emerald-400">
                      ${pricingStats.avgSalePrice.toFixed(0)}
                    </div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                    <div className="text-sm text-slate-400 mb-1">Avg Listing Price</div>
                    <div className="text-2xl font-bold text-amber-400">
                      ${pricingStats.avgListingPrice.toFixed(0)}
                    </div>
                  </div>
                </div>
                
                {pricingStats.topRestaurants.length > 0 && (
                  <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700">
                    <h4 className="text-sm font-medium text-white mb-4">Top Restaurants by Sales</h4>
                    <div className="space-y-2">
                      {pricingStats.topRestaurants.map((r, i) => (
                        <div key={i} className="flex justify-between items-center py-2 border-b border-slate-800 last:border-0">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500">{i + 1}.</span>
                            <span className="text-white">{r.name}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-slate-400">{r.salesCount} sales</span>
                            <span className="text-emerald-400 font-medium">${r.avgPrice.toFixed(0)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
            
            {/* Price Suggestion Tool */}
            <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700">
              <h4 className="text-sm font-medium text-white mb-4">Quick Price Check</h4>
              <PriceSuggestionTool />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Price Suggestion Tool Component
const PriceSuggestionTool: React.FC = () => {
  const [restaurant, setRestaurant] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('19:00');
  const [partySize, setPartySize] = useState(2);
  const [suggestion, setSuggestion] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const getSuggestion = async () => {
    if (!restaurant || !date) return;
    
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/pricing/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantName: restaurant,
          reservationDate: date,
          reservationTime: time,
          partySize,
          platform: 'resy',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuggestion(data);
      }
    } catch (error) {
      console.error('Failed to get suggestion:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <input
          type="text"
          placeholder="Restaurant name"
          value={restaurant}
          onChange={e => setRestaurant(e.target.value)}
          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm"
        />
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm [color-scheme:dark]"
        />
        <input
          type="time"
          value={time}
          onChange={e => setTime(e.target.value)}
          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm [color-scheme:dark]"
        />
        <select
          value={partySize}
          onChange={e => setPartySize(parseInt(e.target.value))}
          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm"
        >
          {[1,2,3,4,5,6].map(n => (
            <option key={n} value={n}>{n} guests</option>
          ))}
        </select>
      </div>
      <button
        onClick={getSuggestion}
        disabled={loading || !restaurant || !date}
        className="w-full py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 text-white rounded-lg text-sm font-medium"
      >
        {loading ? 'Calculating...' : 'Get Price Suggestion'}
      </button>
      
      {suggestion && (
        <div className="mt-4 p-4 bg-slate-900 rounded-lg border border-amber-500/30">
          <div className="text-center">
            <div className="text-3xl font-bold text-amber-400">${suggestion.suggestedPrice}</div>
            <div className="text-sm text-slate-400 mt-1">
              Range: ${suggestion.minPrice} - ${suggestion.maxPrice}
            </div>
            <div className={`text-xs mt-2 px-2 py-1 rounded inline-block ${
              suggestion.confidence === 'high' 
                ? 'bg-emerald-500/20 text-emerald-400' 
                : suggestion.confidence === 'medium'
                ? 'bg-amber-500/20 text-amber-400'
                : 'bg-slate-500/20 text-slate-400'
            }`}>
              {suggestion.confidence} confidence
            </div>
          </div>
          <div className="mt-4 space-y-1">
            {suggestion.reasoning?.map((r: string, i: number) => (
              <div key={i} className="text-xs text-slate-500">• {r}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsDashboard;

