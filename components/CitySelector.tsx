import React, { useState, useRef, useEffect } from 'react';
import { Loader2, Plus, Search, X } from 'lucide-react';

interface CitySelectorProps {
  cities: string[];
  selectedCity: string;
  onSelectCity: (city: string) => void;
  onAddCity: (city: string) => void;
  onRemoveCity: (city: string) => void;
  isLoading: boolean;
}

const CitySelector: React.FC<CitySelectorProps> = ({ cities, selectedCity, onSelectCity, onAddCity, onRemoveCity, isLoading }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newCity, setNewCity] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAdding]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCity.trim()) {
      onAddCity(newCity.trim());
      setNewCity('');
      setIsAdding(false);
    }
  };

  const handleCancel = () => {
    setIsAdding(false);
    setNewCity('');
  };

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-4 px-1">
      {cities.map((city) => {
        const isSelected = selectedCity === city;
        return (
          <div
            key={city}
            className={`
              group relative flex items-center gap-2 whitespace-nowrap px-4 h-9 rounded-full text-sm font-medium transition-all duration-200 border shrink-0 cursor-pointer
              ${isSelected 
                ? 'bg-amber-500 text-slate-900 border-amber-500 shadow-[0_0_15px_rgba(245,176,41,0.3)]' 
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:border-slate-600 hover:text-white'}
              ${isLoading && !isSelected ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}
              ${isLoading && isSelected ? 'cursor-wait' : ''}
            `}
            onClick={() => !isLoading && onSelectCity(city)}
          >
            {city}
            {isSelected && isLoading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
                <button
                    onClick={(e) => {
                        e.stopPropagation(); // Prevent selecting the city when deleting
                        onRemoveCity(city);
                    }}
                    className={`
                        ml-1 p-0.5 rounded-full hover:bg-black/20 transition-colors
                        ${isSelected ? 'text-slate-800/60 hover:text-slate-900' : 'text-slate-600 hover:text-white opacity-0 group-hover:opacity-100'}
                    `}
                    title="Remove city"
                >
                    <X className="w-3 h-3" />
                </button>
            )}
          </div>
        );
      })}

      {/* Add City Button / Input */}
      {isAdding ? (
        <form 
          onSubmit={handleSubmit} 
          className="relative m-0 flex items-center gap-2 bg-slate-800 border border-amber-500/50 rounded-full px-4 h-9 shrink-0 animate-in fade-in duration-200"
        >
          <Search className="w-3 h-3 text-amber-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={newCity}
            onChange={(e) => setNewCity(e.target.value)}
            placeholder="City..."
            className="bg-transparent border-none text-white text-sm focus:ring-0 w-28 p-0 placeholder:text-slate-600 leading-5"
            onKeyDown={(e) => {
              if (e.key === 'Escape') handleCancel();
            }}
          />
          <button 
            type="button" 
            onClick={handleCancel}
            className="p-0.5 hover:bg-slate-700 rounded-full text-slate-500 hover:text-white transition-colors shrink-0"
          >
            <X className="w-3 h-3" />
          </button>
        </form>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          disabled={isLoading}
          className="m-0 flex items-center justify-center w-9 h-9 rounded-full bg-slate-900 border border-slate-800 text-slate-500 hover:text-amber-500 hover:border-amber-500/50 transition-all shrink-0"
          title="Add a new city to scan"
        >
          <Plus className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default CitySelector;