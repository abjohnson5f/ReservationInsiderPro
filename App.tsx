
import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import CitySelector from './components/CitySelector';
import RestaurantCard from './components/RestaurantCard';
import TrendChart from './components/TrendChart';
import StrategyPanel from './components/StrategyPanel';
import Notification from './components/Notification';
import PortfolioManager from './components/PortfolioManager';
import { City, Restaurant, MarketInsight, ChartDataPoint, PortfolioItem } from './types';
import { fetchTopRestaurants, fetchMarketInsight, generateTrendData } from './services/geminiService';
import { Globe, Radar, SearchX, LayoutDashboard, LineChart } from 'lucide-react';

// High-quality seed data to demonstrate the platform's capabilities
const MOCK_PORTFOLIO_DATA: PortfolioItem[] = [
  {
    id: 'seed-1',
    restaurantName: 'Carbone',
    date: '2024-06-20',
    time: '19:30',
    guests: 4,
    costBasis: 40,
    listPrice: 650,
    status: 'LISTED',
    platform: 'Resy'
  },
  {
    id: 'seed-2',
    restaurantName: 'Don Angie',
    date: '2024-06-18',
    time: '20:00',
    guests: 2,
    costBasis: 10,
    listPrice: 250,
    soldPrice: 225,
    status: 'SOLD',
    platform: 'Resy',
    guestName: 'Michael Chen'
  },
  {
    id: 'seed-3',
    restaurantName: '4 Charles Prime Rib',
    date: '2024-06-25',
    time: '17:30',
    guests: 2,
    costBasis: 0,
    listPrice: 300,
    status: 'ACQUIRED',
    platform: 'Resy'
  },
  {
    id: 'seed-4',
    restaurantName: 'Atomix',
    date: '2024-06-12',
    time: '20:45',
    guests: 2,
    costBasis: 750, // Prepaid tasting menu cost
    listPrice: 1200,
    soldPrice: 1150,
    status: 'TRANSFERRED',
    platform: 'Tock',
    guestName: 'Sarah Williams'
  },
  {
    id: 'seed-5',
    restaurantName: 'Misi',
    date: '2024-06-22',
    time: '19:00',
    guests: 2,
    costBasis: 0,
    listPrice: 180,
    soldPrice: 180,
    status: 'PENDING',
    platform: 'Resy',
    guestName: 'Waiting for Input'
  }
];

const App: React.FC = () => {
  // View State
  const [activeView, setActiveView] = useState<'market' | 'portfolio'>('market');

  // State for available cities, initialized with defaults
  const [availableCities, setAvailableCities] = useState<string[]>(Object.values(City).slice(0, 5));
  const [selectedCity, setSelectedCity] = useState<string>(City.NYC);
  
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [insight, setInsight] = useState<MarketInsight | null>(null);
  const [trendData, setTrendData] = useState<ChartDataPoint[]>([]);
  
  const [loadingRestaurants, setLoadingRestaurants] = useState(false);
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [loadingTrend, setLoadingTrend] = useState(false);

  // --- PORTFOLIO STATE (Lifted for Persistence) ---
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);

  // Notification State
  const [notification, setNotification] = useState<{message: string, visible: boolean, type: 'info'|'warning'|'success'}>({ 
      message: '', 
      visible: false, 
      type: 'info' 
  });

  // Load Portfolio from LocalStorage on mount, or seed if empty
  useEffect(() => {
    const saved = localStorage.getItem('reservation_portfolio');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.length > 0) {
            setPortfolioItems(parsed);
        } else {
            setPortfolioItems([]); 
        }
      } catch (e) {
        console.error("Failed to load portfolio", e);
      }
    } else {
        // First time load - SEED DATA
        setPortfolioItems(MOCK_PORTFOLIO_DATA);
    }
  }, []);

  // Save Portfolio to LocalStorage whenever it changes
  useEffect(() => {
    if (portfolioItems.length > 0 || localStorage.getItem('reservation_portfolio')) {
        localStorage.setItem('reservation_portfolio', JSON.stringify(portfolioItems));
    }
  }, [portfolioItems]);

  // Load restaurants when city changes
  useEffect(() => {
    if (activeView === 'market') {
        const loadRestaurants = async () => {
        setLoadingRestaurants(true);
        // Reset selection
        setSelectedRestaurant(null);
        setInsight(null);
        setTrendData([]);

        const data = await fetchTopRestaurants(selectedCity);
        setRestaurants(data);
        setLoadingRestaurants(false);
        };
        loadRestaurants();
    }
  }, [selectedCity, activeView]);

  // Handle adding a new city
  const handleAddCity = (newCity: string) => {
    // Capitalize first letter for display consistency
    const formattedCity = newCity.charAt(0).toUpperCase() + newCity.slice(1);
    
    // If it already exists, just select it
    if (availableCities.includes(formattedCity)) {
      setSelectedCity(formattedCity);
      return;
    }

    setAvailableCities(prev => [...prev, formattedCity]);
    setSelectedCity(formattedCity);
  };

  // Handle removing a city
  const handleRemoveCity = (cityToRemove: string) => {
    if (availableCities.length <= 1) return; // Prevent empty list

    setAvailableCities(prev => {
        const newList = prev.filter(c => c !== cityToRemove);
        
        // If we removed the currently selected city, failover to the first in the new list
        if (selectedCity === cityToRemove && newList.length > 0) {
            setSelectedCity(newList[0]);
        }
        
        return newList;
    });
  };

  // Load details when restaurant selected
  const handleRestaurantSelect = useCallback(async (res: Restaurant) => {
    if (selectedRestaurant?.name === res.name) return;
    
    setSelectedRestaurant(res);
    
    // Parallel fetch for data and strategy
    setLoadingInsight(true);
    setLoadingTrend(true);
    
    // We don't await here to prevent blocking, we use .then
    fetchMarketInsight(res.name, selectedCity).then(data => {
        setInsight(data);
        setLoadingInsight(false);
    });

    generateTrendData(res.name).then(data => {
        setTrendData(data);
        setLoadingTrend(false);
    });

  }, [selectedRestaurant, selectedCity]);

  // --- PORTFOLIO ACTIONS ---

  const handleAddToPortfolio = (restaurant: Restaurant) => {
    const newItem: PortfolioItem = {
      id: Math.random().toString(36).substr(2, 9),
      restaurantName: restaurant.name,
      date: new Date().toISOString().split('T')[0], // Default to today
      time: '19:00', // Default prime time
      guests: 2,
      costBasis: 0, // User needs to update this
      listPrice: restaurant.estimatedResaleValue,
      status: 'WATCHING', // Default status for tracked market signals
      platform: 'Unknown'
    };

    setPortfolioItems(prev => [newItem, ...prev]);
    setNotification({
      visible: true,
      message: `Tracking ${restaurant.name} in Watchlist`,
      type: 'success'
    });
  };

  const handleManualAddAsset = (item: PortfolioItem) => {
    setPortfolioItems(prev => [item, ...prev]);
    setNotification({
      visible: true,
      message: 'New asset logged successfully',
      type: 'success'
    });
  };

  const handleUpdateAsset = (updatedItem: PortfolioItem) => {
    setPortfolioItems(prev => prev.map(item => item.id === updatedItem.id ? updatedItem : item));
  };

  const handleDeleteAsset = (itemId: string) => {
    setPortfolioItems(prev => prev.filter(item => item.id !== itemId));
    setNotification({
      visible: true,
      message: 'Asset removed from portfolio',
      type: 'info'
    });
  };
  
  const pendingCount = portfolioItems.filter(i => i.status === 'PENDING').length;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col text-slate-200 font-sans">
      <Header />
      
      <main className="max-w-7xl w-full mx-auto px-4 py-6">
        
        {/* Navigation Tabs */}
        <div className="flex justify-center mb-8">
            <div className="bg-slate-900/80 backdrop-blur p-1 rounded-full border border-slate-800 flex gap-1">
                <button 
                    onClick={() => setActiveView('market')}
                    className={`
                        flex items-center gap-2 px-6 py-2 rounded-full text-sm font-medium transition-all duration-200
                        ${activeView === 'market' 
                            ? 'bg-slate-800 text-white shadow-lg shadow-black/20 ring-1 ring-slate-700' 
                            : 'text-slate-500 hover:text-slate-300'}
                    `}
                >
                    <LineChart className="w-4 h-4" />
                    Market Intelligence
                </button>
                <button 
                    onClick={() => setActiveView('portfolio')}
                    className={`
                        flex items-center gap-2 px-6 py-2 rounded-full text-sm font-medium transition-all duration-200
                        ${activeView === 'portfolio' 
                            ? 'bg-slate-800 text-white shadow-lg shadow-black/20 ring-1 ring-slate-700' 
                            : 'text-slate-500 hover:text-slate-300'}
                    `}
                >
                    <LayoutDashboard className="w-4 h-4" />
                    Command Center
                    {pendingCount > 0 && (
                      <span className="bg-amber-500 text-slate-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1 animate-pulse">
                        {pendingCount}
                      </span>
                    )}
                </button>
            </div>
        </div>

        {activeView === 'portfolio' ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                <PortfolioManager 
                  items={portfolioItems}
                  onUpdateItem={handleUpdateAsset}
                  onAddItem={handleManualAddAsset}
                  onDeleteItem={handleDeleteAsset}
                />
            </div>
        ) : (
            /* Market Intelligence View */
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                {/* Controls */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-2xl font-bold text-white">Market Overview</h2>
                        <div className="text-xs text-slate-500 font-mono flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${loadingRestaurants ? 'bg-amber-500 animate-ping' : 'bg-emerald-500 animate-pulse'}`}></span>
                            {loadingRestaurants ? 'SCANNING NETWORK' : 'LIVE ANALYSIS'}
                        </div>
                    </div>
                    
                    {/* Constrained width container to enforce visual limit of ~5 cities */}
                    <div className="max-w-3xl relative">
                        <div className="absolute right-0 top-0 bottom-0 w-12 fade-mask-r pointer-events-none z-10"></div>
                        <CitySelector 
                            cities={availableCities}
                            selectedCity={selectedCity} 
                            onSelectCity={setSelectedCity} 
                            onAddCity={handleAddCity}
                            onRemoveCity={handleRemoveCity}
                            isLoading={loadingRestaurants} 
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left Column: Restaurant List */}
                <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-4 min-h-[500px] relative rounded-xl border border-slate-800 bg-slate-900/50">
                    
                    {/* Header for list */}
                    <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900 rounded-t-xl">
                        <span className="text-sm text-slate-400 font-medium">Top Opportunities</span>
                        <span className="text-xs text-slate-600 bg-slate-950 px-2 py-1 rounded border border-slate-800">Sorted by Potential</span>
                    </div>
                    
                    {/* List Container */}
                    <div className="flex-grow p-4 space-y-3 pb-4">
                        {loadingRestaurants ? (
                            // Scanning State Overlay
                            <div className="absolute inset-0 z-10 bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center rounded-xl">
                                <div className="relative mb-6">
                                    <div className="absolute inset-0 bg-amber-500 blur-xl opacity-20 animate-pulse rounded-full"></div>
                                    <Globe className="w-12 h-12 text-amber-500 animate-[spin_3s_linear_infinite] relative z-10" />
                                    <div className="absolute inset-0 border-2 border-amber-500/30 rounded-full animate-ping"></div>
                                </div>
                                <h3 className="text-lg font-bold text-white tracking-tight">Initializing Market Scan</h3>
                                <p className="text-sm text-slate-400 font-mono mt-2">Targeting: <span className="text-amber-500">{selectedCity}</span></p>
                                
                                <div className="mt-8 space-y-3 w-full max-w-[200px]">
                                    <div className="flex justify-between text-[10px] text-slate-500 font-mono uppercase">
                                        <span>Scraping Sources</span>
                                        <span className="text-amber-500 animate-pulse">Running...</span>
                                    </div>
                                    <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-amber-500 animate-[translateX_1.5s_ease-in-out_infinite] w-1/2 rounded-full"></div>
                                    </div>
                                </div>
                            </div>
                        ) : restaurants.length > 0 ? (
                            restaurants.map((res, index) => (
                                <RestaurantCard 
                                    key={index} 
                                    restaurant={res} 
                                    isSelected={selectedRestaurant?.name === res.name}
                                    onClick={() => handleRestaurantSelect(res)}
                                    onTrack={() => handleAddToPortfolio(res)}
                                />
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                                <SearchX className="w-10 h-10 mb-4 opacity-50" />
                                <p className="text-sm">No high-value targets found.</p>
                                <p className="text-xs mt-1 opacity-60">Try a different city.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: Details & Charts - No fixed height, flows naturally */}
                <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-6 pb-10">
                    {selectedRestaurant ? (
                    <>
                        <TrendChart data={trendData} loading={loadingTrend} />
                        <StrategyPanel 
                            insight={insight} 
                            restaurantName={selectedRestaurant.name}
                            loading={loadingInsight}
                        />
                    </>
                    ) : (
                        <div className="min-h-[500px] flex flex-col items-center justify-center text-center p-8 border border-slate-800 rounded-xl border-dashed bg-slate-900/30">
                            <Radar className="w-16 h-16 text-slate-700 mb-6" />
                            <h3 className="text-xl font-bold text-slate-300">Awaiting Selection</h3>
                            <p className="text-slate-500 max-w-md mt-2">Select a restaurant from the live feed to decrypt its trading strategy, view volatility charts, and access liquidity signals.</p>
                        </div>
                    )}
                </div>

                </div>
            </div>
        )}
      </main>

      {/* System Notifications */}
      <Notification 
        message={notification.message} 
        isVisible={notification.visible} 
        type={notification.type === 'success' ? 'info' : notification.type as any} // simple mapping
        onClose={() => setNotification(prev => ({ ...prev, visible: false }))} 
      />
    </div>
  );
};

export default App;
