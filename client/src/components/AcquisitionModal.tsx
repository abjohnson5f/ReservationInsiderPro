/**
 * Acquisition Modal - PRODUCTION BOOKING UI
 * 
 * This component provides a full booking workflow:
 * 1. Search for a restaurant (get venueId)
 * 2. Check available slots
 * 3. Execute acquisition via Resy API
 */

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Search, 
  Crosshair, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle,
  Clock,
  Users,
  Calendar,
  Zap,
  RefreshCw,
  Settings2,
  ExternalLink
} from 'lucide-react';
import { ResySlot, ResyVenue, AcquisitionResult } from '../../types';

const API_BASE = 'http://localhost:3000/api/sniper';

interface AcquisitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRestaurantName?: string;
  initialDate?: string;
  initialTime?: string;
  initialGuests?: number;
  onSuccess?: (result: AcquisitionResult) => void;
}

type Step = 'search' | 'slots' | 'acquiring' | 'result';

const AcquisitionModal: React.FC<AcquisitionModalProps> = ({
  isOpen,
  onClose,
  initialRestaurantName = '',
  initialDate = '',
  initialTime = '19:00',
  initialGuests = 2,
  onSuccess,
}) => {
  // State
  const [step, setStep] = useState<Step>('search');
  const [searchQuery, setSearchQuery] = useState(initialRestaurantName);
  const [venues, setVenues] = useState<ResyVenue[]>([]);
  const [selectedVenue, setSelectedVenue] = useState<ResyVenue | null>(null);
  const [slots, setSlots] = useState<ResySlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<ResySlot | null>(null);
  const [date, setDate] = useState(initialDate || new Date().toISOString().split('T')[0]);
  const [partySize, setPartySize] = useState(initialGuests);
  const [preferredTime, setPreferredTime] = useState(initialTime);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AcquisitionResult | null>(null);
  const [configStatus, setConfigStatus] = useState<{ready: boolean; hasAuth: boolean; hasPayment: boolean} | null>(null);

  // Check configuration on mount
  useEffect(() => {
    if (isOpen) {
      checkConfig();
    }
  }, [isOpen]);

  // Reset state when opened with new initial values
  useEffect(() => {
    if (isOpen) {
      setSearchQuery(initialRestaurantName);
      setDate(initialDate || new Date().toISOString().split('T')[0]);
      setPreferredTime(initialTime);
      setPartySize(initialGuests);
      setStep('search');
      setResult(null);
      setError(null);
    }
  }, [isOpen, initialRestaurantName, initialDate, initialTime, initialGuests]);

  const checkConfig = async () => {
    try {
      const response = await fetch(`${API_BASE}/resy/status`);
      const data = await response.json();
      setConfigStatus(data);
    } catch (err) {
      console.error('Failed to check config:', err);
    }
  };

  const searchVenues = async () => {
    if (!searchQuery.trim()) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE}/resy/search?query=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      
      if (data.success) {
        setVenues(data.venues);
        if (data.venues.length === 0) {
          setError('No venues found. Try a different search term.');
        }
      } else {
        setError(data.error || 'Search failed');
      }
    } catch (err: any) {
      setError('Failed to connect to server');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSlots = async (venue: ResyVenue) => {
    setSelectedVenue(venue);
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `${API_BASE}/resy/slots?venueId=${venue.id}&date=${date}&partySize=${partySize}`
      );
      const data = await response.json();
      
      if (data.success) {
        setSlots(data.slots);
        setStep('slots');
        if (data.slots.length === 0) {
          setError('No slots available for this date. Try a different date.');
        }
      } else {
        setError(data.error || 'Failed to fetch slots');
      }
    } catch (err: any) {
      setError('Failed to connect to server');
    } finally {
      setIsLoading(false);
    }
  };

  const executeAcquisition = async (slot?: ResySlot) => {
    if (!selectedVenue) return;
    
    setStep('acquiring');
    setIsLoading(true);
    setError(null);
    
    try {
      let response;
      
      if (slot) {
        // Book specific slot
        response = await fetch(`${API_BASE}/resy/book-slot`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            configId: slot.config_id,
            date,
            partySize,
          }),
        });
      } else {
        // Auto-select best slot
        response = await fetch(`${API_BASE}/resy/acquire`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            venueId: selectedVenue.id,
            date,
            partySize,
            preferredTime,
            timeFlexibility: 60,
          }),
        });
      }
      
      const data = await response.json();
      setResult(data);
      setStep('result');
      
      if (data.success && onSuccess) {
        onSuccess(data);
      }
    } catch (err: any) {
      setResult({ success: false, error: 'Network error - failed to connect' });
      setStep('result');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div 
        className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-2xl shadow-2xl animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-gradient-to-r from-slate-900 to-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <Crosshair className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h3 className="font-bold text-white">Acquisition Control</h3>
              <p className="text-xs text-slate-500">Resy Direct API • Production Mode</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white p-2">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Configuration Warning */}
        {configStatus && !configStatus.ready && (
          <div className="mx-5 mt-5 p-4 bg-amber-900/30 border border-amber-800 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-bold text-amber-400 mb-1">Configuration Required</p>
                <p className="text-amber-200/80 text-xs leading-relaxed">
                  {!configStatus.hasAuth && (
                    <>Add <code className="bg-slate-800 px-1 rounded">RESY_AUTH_TOKEN</code> to your .env file. </>
                  )}
                  {!configStatus.hasPayment && (
                    <>Add <code className="bg-slate-800 px-1 rounded">RESY_PAYMENT_ID</code> to your .env file.</>
                  )}
                </p>
                <a 
                  href="https://resy.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs text-amber-400 hover:text-amber-300 inline-flex items-center gap-1 mt-2"
                >
                  Get credentials from Resy <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1">
          
          {/* Step 1: Search */}
          {step === 'search' && (
            <div className="space-y-4">
              {/* Search Input */}
              <div>
                <label className="text-xs text-slate-500 font-bold uppercase mb-2 block">Search Restaurant</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      placeholder="e.g., Carbone, Don Angie, 4 Charles..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-10 pr-4 py-3 text-white placeholder:text-slate-600 focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && searchVenues()}
                    />
                  </div>
                  <button
                    onClick={searchVenues}
                    disabled={isLoading || !searchQuery.trim()}
                    className="px-6 py-3 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    Search
                  </button>
                </div>
              </div>

              {/* Date & Party Size */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-slate-500 font-bold uppercase mb-2 block flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Date
                  </label>
                  <input
                    type="date"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-amber-500 outline-none [color-scheme:dark]"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-bold uppercase mb-2 block flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Preferred Time
                  </label>
                  <input
                    type="time"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-amber-500 outline-none [color-scheme:dark]"
                    value={preferredTime}
                    onChange={(e) => setPreferredTime(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-bold uppercase mb-2 block flex items-center gap-1">
                    <Users className="w-3 h-3" /> Party Size
                  </label>
                  <select
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-amber-500 outline-none"
                    value={partySize}
                    onChange={(e) => setPartySize(parseInt(e.target.value))}
                  >
                    {[1,2,3,4,5,6,7,8].map(n => (
                      <option key={n} value={n}>{n} {n === 1 ? 'guest' : 'guests'}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-400 text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  {error}
                </div>
              )}

              {/* Venue Results */}
              {venues.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs text-slate-500 font-bold uppercase">Select Venue ({venues.length} found)</label>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {venues.map((venue) => (
                      <button
                        key={venue.id}
                        onClick={() => fetchSlots(venue)}
                        className="w-full p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-amber-500/50 rounded-lg text-left transition-all group"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-bold text-white group-hover:text-amber-400 transition-colors">{venue.name}</h4>
                            <p className="text-xs text-slate-500">{venue.neighborhood}, {venue.city}</p>
                            {venue.cuisine && (
                              <p className="text-xs text-slate-600 mt-1">{venue.cuisine}</p>
                            )}
                          </div>
                          <div className="text-xs text-slate-600 font-mono">
                            ID: {venue.id}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Available Slots */}
          {step === 'slots' && selectedVenue && (
            <div className="space-y-4">
              {/* Selected Venue Info */}
              <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-white">{selectedVenue.name}</h4>
                    <p className="text-xs text-slate-500">{selectedVenue.neighborhood}, {selectedVenue.city}</p>
                  </div>
                  <button
                    onClick={() => {
                      setStep('search');
                      setSlots([]);
                      setSelectedVenue(null);
                    }}
                    className="text-xs text-slate-500 hover:text-white"
                  >
                    Change
                  </button>
                </div>
                <div className="flex gap-4 mt-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {date}</span>
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {partySize} guests</span>
                </div>
              </div>

              {/* Quick Acquire Button */}
              <button
                onClick={() => executeAcquisition()}
                disabled={!configStatus?.ready || isLoading}
                className="w-full p-4 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 disabled:from-slate-700 disabled:to-slate-700 text-white rounded-lg font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-900/30"
              >
                <Zap className="w-5 h-5" />
                Quick Acquire (Best Available Slot)
              </button>

              {/* Slots List */}
              {slots.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs text-slate-500 font-bold uppercase">
                      Or Select Specific Slot ({slots.length} available)
                    </label>
                    <button
                      onClick={() => fetchSlots(selectedVenue)}
                      className="text-xs text-slate-500 hover:text-amber-400 flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" /> Refresh
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                    {slots.map((slot, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setSelectedSlot(slot);
                          executeAcquisition(slot);
                        }}
                        disabled={!configStatus?.ready}
                        className="p-3 bg-slate-800 hover:bg-amber-900/30 border border-slate-700 hover:border-amber-500 rounded-lg text-center transition-all disabled:opacity-50"
                      >
                        <div className="font-mono font-bold text-white">{slot.time}</div>
                        <div className="text-[10px] text-slate-500">{slot.table_type}</div>
                        {slot.deposit && (
                          <div className="text-[10px] text-amber-500 mt-1">${slot.deposit} deposit</div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  {isLoading ? (
                    <Loader2 className="w-8 h-8 animate-spin mx-auto" />
                  ) : (
                    <>
                      <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>No slots available for this date</p>
                    </>
                  )}
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-400 text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Acquiring */}
          {step === 'acquiring' && (
            <div className="text-center py-12">
              <div className="relative inline-block mb-6">
                <div className="absolute inset-0 bg-amber-500 blur-xl opacity-30 animate-pulse rounded-full"></div>
                <Loader2 className="w-16 h-16 text-amber-500 animate-spin relative" />
              </div>
              <h4 className="text-xl font-bold text-white mb-2">Acquiring Reservation...</h4>
              <p className="text-slate-500">Connecting to Resy API</p>
              <div className="mt-6 space-y-2 text-xs text-slate-600 font-mono">
                <div className="animate-pulse">→ Authenticating...</div>
                <div className="animate-pulse" style={{animationDelay: '0.5s'}}>→ Securing slot...</div>
                <div className="animate-pulse" style={{animationDelay: '1s'}}>→ Confirming booking...</div>
              </div>
            </div>
          )}

          {/* Step 4: Result */}
          {step === 'result' && result && (
            <div className="text-center py-8">
              {result.success ? (
                <>
                  <div className="relative inline-block mb-6">
                    <div className="absolute inset-0 bg-emerald-500 blur-xl opacity-30 rounded-full"></div>
                    <CheckCircle2 className="w-16 h-16 text-emerald-500 relative" />
                  </div>
                  <h4 className="text-2xl font-bold text-white mb-2">Reservation Confirmed! 🎉</h4>
                  <p className="text-emerald-400 font-mono mb-4">
                    {result.confirmation || result.resy_token || 'Success'}
                  </p>
                  <div className="bg-slate-800 p-4 rounded-lg inline-block text-left">
                    <div className="text-sm text-slate-400">
                      <p><strong className="text-white">{selectedVenue?.name}</strong></p>
                      <p>{date} • {partySize} guests</p>
                      {result.reservation_id && (
                        <p className="font-mono text-xs mt-2 text-slate-500">ID: {result.reservation_id}</p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="relative inline-block mb-6">
                    <div className="absolute inset-0 bg-red-500 blur-xl opacity-30 rounded-full"></div>
                    <AlertTriangle className="w-16 h-16 text-red-500 relative" />
                  </div>
                  <h4 className="text-xl font-bold text-white mb-2">Acquisition Failed</h4>
                  <p className="text-red-400 mb-4">{result.error}</p>
                  <button
                    onClick={() => {
                      setStep('slots');
                      setResult(null);
                    }}
                    className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm"
                  >
                    Try Again
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex justify-between items-center">
          <div className="text-xs text-slate-600 flex items-center gap-2">
            <Settings2 className="w-3 h-3" />
            {configStatus?.ready ? (
              <span className="text-emerald-500">API Connected</span>
            ) : (
              <span className="text-amber-500">Configuration Needed</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AcquisitionModal;

