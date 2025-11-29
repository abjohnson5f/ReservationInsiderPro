/**
 * Acquisition Modal - MULTI-PLATFORM BOOKING UI
 * 
 * Supports: Resy, OpenTable, SevenRooms, Tock
 * 
 * Features:
 * - Platform selector with config status
 * - Credential validation per platform
 * - Unified search and booking flow
 * - CONCIERGE MODE: Book under client's name (no transfer needed!)
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
  ExternalLink,
  Shield,
  XCircle,
  User,
  Briefcase
} from 'lucide-react';
import { ResySlot, ResyVenue, AcquisitionResult, Client } from '../../types';
import { SNIPER_API, CLIENTS_API } from '../config';

const API_BASE = SNIPER_API;

type Platform = 'resy' | 'opentable' | 'sevenrooms' | 'tock';
type BookingMode = 'standard' | 'concierge';

interface PlatformConfig {
  name: string;
  label: string;
  color: string;
  bg: string;
  icon: string;
  idField: string;
  idPlaceholder: string;
  searchable: boolean;
}

const PLATFORMS: Record<Platform, PlatformConfig> = {
  resy: {
    name: 'resy',
    label: 'Resy',
    color: 'text-rose-400',
    bg: 'bg-rose-500/20',
    icon: '🍷',
    idField: 'Venue ID',
    idPlaceholder: 'e.g., 834',
    searchable: true,
  },
  opentable: {
    name: 'opentable',
    label: 'OpenTable',
    color: 'text-red-400',
    bg: 'bg-red-500/20',
    icon: '🍽️',
    idField: 'Restaurant ID',
    idPlaceholder: 'e.g., 1234567',
    searchable: false,
  },
  sevenrooms: {
    name: 'sevenrooms',
    label: 'SevenRooms',
    color: 'text-purple-400',
    bg: 'bg-purple-500/20',
    icon: '✨',
    idField: 'Venue Slug',
    idPlaceholder: 'e.g., carbone-nyc',
    searchable: false,
  },
  tock: {
    name: 'tock',
    label: 'Tock',
    color: 'text-teal-400',
    bg: 'bg-teal-500/20',
    icon: '🎫',
    idField: 'Venue Slug',
    idPlaceholder: 'e.g., alinea',
    searchable: false,
  },
};

interface PlatformStatus {
  ready: boolean;
  details?: any;
  required?: string[];
}

interface AcquisitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRestaurantName?: string;
  initialDate?: string;
  initialTime?: string;
  initialGuests?: number;
  initialPlatform?: Platform;
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
  initialPlatform = 'resy',
  onSuccess,
}) => {
  // Platform state
  const [platform, setPlatform] = useState<Platform>(initialPlatform);
  const [platformStatuses, setPlatformStatuses] = useState<Record<Platform, PlatformStatus>>({
    resy: { ready: false },
    opentable: { ready: false },
    sevenrooms: { ready: false },
    tock: { ready: false },
  });
  const [validating, setValidating] = useState<Platform | null>(null);
  const [validationResults, setValidationResults] = useState<Record<Platform, { success: boolean; message: string } | null>>({
    resy: null,
    opentable: null,
    sevenrooms: null,
    tock: null,
  });

  // CONCIERGE MODE STATE
  // Book under client's name instead of our identity
  const [bookingMode, setBookingMode] = useState<BookingMode>('standard');
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [loadingClients, setLoadingClients] = useState(false);

  // Search/booking state
  const [step, setStep] = useState<Step>('search');
  const [searchQuery, setSearchQuery] = useState(initialRestaurantName);
  const [venues, setVenues] = useState<ResyVenue[]>([]);
  const [selectedVenue, setSelectedVenue] = useState<ResyVenue | null>(null);
  const [slots, setSlots] = useState<ResySlot[]>([]);
  const [date, setDate] = useState(initialDate || new Date().toISOString().split('T')[0]);
  const [partySize, setPartySize] = useState(initialGuests);
  const [preferredTime, setPreferredTime] = useState(initialTime);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AcquisitionResult | null>(null);
  
  // Platform-specific IDs (for non-searchable platforms)
  const [platformId, setPlatformId] = useState('');

  // Fetch all platform statuses on mount
  useEffect(() => {
    if (isOpen) {
      fetchAllPlatformStatuses();
      fetchClients();
    }
  }, [isOpen]);

  // Fetch clients for concierge mode
  const fetchClients = async () => {
    setLoadingClients(true);
    try {
      const response = await fetch(CLIENTS_API);
      if (response.ok) {
        const data = await response.json();
        setClients(data);
      }
    } catch (err) {
      console.error('Failed to fetch clients:', err);
    } finally {
      setLoadingClients(false);
    }
  };

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setSearchQuery(initialRestaurantName);
      setDate(initialDate || new Date().toISOString().split('T')[0]);
      setPreferredTime(initialTime);
      setPartySize(initialGuests);
      setPlatform(initialPlatform);
      setStep('search');
      setResult(null);
      setError(null);
      setVenues([]);
      setSelectedVenue(null);
      setSlots([]);
      setPlatformId('');
      setBookingMode('standard');
      setSelectedClientId(null);
    }
  }, [isOpen, initialRestaurantName, initialDate, initialTime, initialGuests, initialPlatform]);

  const fetchAllPlatformStatuses = async () => {
    try {
      const response = await fetch(`${API_BASE}/platforms/status`);
      const data = await response.json();
      
      if (data.platforms) {
        setPlatformStatuses({
          resy: data.platforms.resy,
          opentable: data.platforms.opentable,
          sevenrooms: data.platforms.sevenrooms,
          tock: data.platforms.tock,
        });
      }
    } catch (err) {
      console.error('Failed to fetch platform statuses:', err);
    }
  };

  const validateCredentials = async (p: Platform) => {
    setValidating(p);
    setValidationResults(prev => ({ ...prev, [p]: null }));
    
    try {
      const response = await fetch(`${API_BASE}/${p}/status`);
      const data = await response.json();
      
      setValidationResults(prev => ({
        ...prev,
        [p]: {
          success: data.ready,
          message: data.message || (data.ready ? 'Credentials valid' : 'Configuration incomplete'),
        },
      }));
      
      // Refresh status
      await fetchAllPlatformStatuses();
    } catch (err: any) {
      setValidationResults(prev => ({
        ...prev,
        [p]: {
          success: false,
          message: 'Failed to validate: ' + err.message,
        },
      }));
    } finally {
      setValidating(null);
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

  const fetchSlots = async (venue?: ResyVenue) => {
    setIsLoading(true);
    setError(null);
    
    try {
      let url: string;
      
      switch (platform) {
        case 'resy':
          if (!venue) return;
          setSelectedVenue(venue);
          url = `${API_BASE}/resy/slots?venueId=${venue.id}&date=${date}&partySize=${partySize}`;
          break;
        case 'opentable':
          url = `${API_BASE}/opentable/slots?restaurantId=${platformId}&date=${date}&time=${preferredTime}&partySize=${partySize}`;
          break;
        case 'sevenrooms':
          url = `${API_BASE}/sevenrooms/slots?venueSlug=${platformId}&date=${date}&time=${preferredTime}&partySize=${partySize}`;
          break;
        case 'tock':
          url = `${API_BASE}/tock/slots?venueSlug=${platformId}&date=${date}&partySize=${partySize}`;
          break;
      }
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success) {
        setSlots(data.slots || []);
        setStep('slots');
        if ((data.slots || []).length === 0) {
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
    setStep('acquiring');
    setIsLoading(true);
    setError(null);
    
    // Validate concierge mode has a client selected
    if (bookingMode === 'concierge' && !selectedClientId) {
      setError('Please select a client for concierge booking');
      setStep('slots');
      setIsLoading(false);
      return;
    }
    
    try {
      // Use unified acquisition endpoint for all platforms
      // This handles both standard and concierge modes
      const url = `${API_BASE}/acquire`;
      
      let body: any = {
        platform,
        restaurantName: selectedVenue?.name || platformId,
        date,
        partySize,
        time: slot?.time || preferredTime,
        timeFlexibility: 60,
        bookingMode,
      };
      
      // Add platform-specific IDs
      switch (platform) {
        case 'resy':
          body.resyVenueId = selectedVenue?.id || parseInt(platformId);
          break;
        case 'opentable':
          body.openTableId = parseInt(platformId);
          break;
        case 'sevenrooms':
          body.sevenRoomsSlug = platformId;
          break;
        case 'tock':
          body.tockSlug = platformId;
          break;
      }
      
      // Add concierge mode parameters
      if (bookingMode === 'concierge' && selectedClientId) {
        body.clientId = selectedClientId;
        const selectedClient = clients.find(c => c.id === selectedClientId);
        if (selectedClient) {
          body.clientInfo = {
            firstName: selectedClient.first_name,
            lastName: selectedClient.last_name,
            email: selectedClient.email,
            phone: selectedClient.phone,
          };
        }
      }
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
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

  const currentPlatform = PLATFORMS[platform];
  const currentStatus = platformStatuses[platform];

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div 
        className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-3xl shadow-2xl animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-hidden flex flex-col"
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
              <p className="text-xs text-slate-500">Multi-Platform • Production Mode</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white p-2">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Platform Selector */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/50">
          <label className="text-xs text-slate-500 font-bold uppercase mb-3 block">Select Platform</label>
          <div className="grid grid-cols-4 gap-2">
            {(Object.keys(PLATFORMS) as Platform[]).map((p) => {
              const config = PLATFORMS[p];
              const status = platformStatuses[p];
              const validation = validationResults[p];
              const isSelected = platform === p;
              
              return (
                <button
                  key={p}
                  onClick={() => {
                    setPlatform(p);
                    setStep('search');
                    setVenues([]);
                    setSlots([]);
                    setSelectedVenue(null);
                    setError(null);
                  }}
                  className={`relative p-3 rounded-lg border transition-all ${
                    isSelected 
                      ? `${config.bg} border-current ${config.color}` 
                      : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <div className="text-lg mb-1">{config.icon}</div>
                  <div className={`text-sm font-medium ${isSelected ? config.color : 'text-white'}`}>
                    {config.label}
                  </div>
                  
                  {/* Status indicator */}
                  <div className="absolute top-2 right-2">
                    {status?.ready ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-slate-600" />
                    )}
                  </div>
                  
                  {/* Validation loading */}
                  {validating === p && (
                    <div className="absolute inset-0 bg-slate-900/80 rounded-lg flex items-center justify-center">
                      <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          
          {/* Validate Credentials Button */}
          <div className="mt-3 flex items-center justify-between">
            <div className="text-xs text-slate-500">
              {currentStatus?.ready ? (
                <span className="text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> {currentPlatform.label} Ready
                </span>
              ) : (
                <span className="text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {currentPlatform.label} Not Configured
                </span>
              )}
            </div>
            <button
              onClick={() => validateCredentials(platform)}
              disabled={validating !== null}
              className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 flex items-center gap-2 transition-colors"
            >
              <Shield className="w-3 h-3" />
              Test Credentials
            </button>
          </div>
          
          {/* Validation Result */}
          {validationResults[platform] && (
            <div className={`mt-2 p-2 rounded-lg text-xs ${
              validationResults[platform]!.success 
                ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-800'
                : 'bg-red-900/30 text-red-400 border border-red-800'
            }`}>
              {validationResults[platform]!.message}
            </div>
          )}
        </div>

        {/* Booking Mode Toggle */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/30">
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs text-slate-500 font-bold uppercase">Booking Mode</label>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              {bookingMode === 'concierge' && (
                <span className="text-emerald-400 flex items-center gap-1">
                  <Briefcase className="w-3 h-3" /> No transfer needed!
                </span>
              )}
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => setBookingMode('standard')}
              className={`flex-1 p-3 rounded-lg border transition-all ${
                bookingMode === 'standard'
                  ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
              }`}
            >
              <User className="w-4 h-4 mx-auto mb-1" />
              <div className="text-sm font-medium">Standard</div>
              <div className="text-[10px] opacity-70">Book under your identity</div>
            </button>
            <button
              onClick={() => setBookingMode('concierge')}
              className={`flex-1 p-3 rounded-lg border transition-all ${
                bookingMode === 'concierge'
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
              }`}
            >
              <Briefcase className="w-4 h-4 mx-auto mb-1" />
              <div className="text-sm font-medium">🎩 Concierge</div>
              <div className="text-[10px] opacity-70">Book under client's name</div>
            </button>
          </div>
          
          {/* Client Selection (Concierge Mode) */}
          {bookingMode === 'concierge' && (
            <div className="mt-4">
              <label className="text-xs text-slate-500 font-bold uppercase mb-2 block">
                Select Client
              </label>
              {loadingClients ? (
                <div className="flex items-center justify-center p-4 text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading clients...
                </div>
              ) : clients.length === 0 ? (
                <div className="p-3 bg-amber-900/30 border border-amber-800 rounded-lg text-amber-400 text-sm">
                  <AlertTriangle className="w-4 h-4 inline mr-2" />
                  No clients found. Add clients in the Client Manager tab first.
                </div>
              ) : (
                <select
                  value={selectedClientId || ''}
                  onChange={(e) => setSelectedClientId(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="">-- Select a client --</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.first_name} {client.last_name} 
                      {client.company && ` (${client.company})`}
                      {client.vip_level !== 'standard' && ` - ${client.vip_level.toUpperCase()}`}
                    </option>
                  ))}
                </select>
              )}
              
              {selectedClientId && (
                <div className="mt-2 p-3 bg-slate-800 rounded-lg border border-slate-700">
                  {(() => {
                    const client = clients.find(c => c.id === selectedClientId);
                    if (!client) return null;
                    return (
                      <div className="text-sm">
                        <div className="font-medium text-white">
                          {client.first_name} {client.last_name}
                          {client.vip_level === 'platinum' && <span className="ml-2 text-purple-400">💎</span>}
                          {client.vip_level === 'vip' && <span className="ml-2 text-amber-400">⭐</span>}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          {client.email} • {client.phone}
                        </div>
                        <div className="text-xs text-emerald-400 mt-2">
                          ✓ Reservation will be under this name - no transfer needed
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Configuration Warning */}
        {!currentStatus?.ready && (
          <div className="mx-5 mt-5 p-4 bg-amber-900/30 border border-amber-800 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-bold text-amber-400 mb-1">Configuration Required for {currentPlatform.label}</p>
                <p className="text-amber-200/80 text-xs leading-relaxed">
                  Add the following to your Identity Manager or .env file:
                </p>
                <ul className="text-xs text-amber-200/60 mt-2 space-y-1">
                  {currentStatus?.required?.map((req, i) => (
                    <li key={i}>• <code className="bg-slate-800 px-1 rounded">{req}</code></li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1">
          
          {/* Step 1: Search */}
          {step === 'search' && (
            <div className="space-y-4">
              {/* For searchable platforms (Resy) */}
              {currentPlatform.searchable ? (
                <>
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
                </>
              ) : (
                /* For non-searchable platforms */
                <div>
                  <label className="text-xs text-slate-500 font-bold uppercase mb-2 block">
                    {currentPlatform.idField}
                  </label>
                  <input
                    type="text"
                    placeholder={currentPlatform.idPlaceholder}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder:text-slate-600 focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                    value={platformId}
                    onChange={(e) => setPlatformId(e.target.value)}
                  />
                  <p className="text-xs text-slate-600 mt-1">
                    Find this in the restaurant's URL on {currentPlatform.label}
                  </p>
                </div>
              )}

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

              {/* Find Slots button for non-searchable platforms */}
              {!currentPlatform.searchable && platformId && (
                <button
                  onClick={() => fetchSlots()}
                  disabled={isLoading || !platformId.trim() || !currentStatus?.ready}
                  className="w-full py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 disabled:from-slate-700 disabled:to-slate-700 text-white rounded-lg font-bold flex items-center justify-center gap-2"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  Find Available Slots
                </button>
              )}

              {/* Error */}
              {error && (
                <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-400 text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  {error}
                </div>
              )}

              {/* Venue Results (Resy only) */}
              {venues.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs text-slate-500 font-bold uppercase">Select Venue ({venues.length} found)</label>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {venues.map((venue) => (
                      <button
                        key={venue.id}
                        onClick={() => fetchSlots(venue)}
                        disabled={!currentStatus?.ready}
                        className="w-full p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-amber-500/50 rounded-lg text-left transition-all group disabled:opacity-50"
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
          {step === 'slots' && (
            <div className="space-y-4">
              {/* Selected Venue/Restaurant Info */}
              <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm px-2 py-0.5 rounded ${currentPlatform.bg} ${currentPlatform.color}`}>
                        {currentPlatform.icon} {currentPlatform.label}
                      </span>
                    </div>
                    <h4 className="font-bold text-white mt-2">
                      {selectedVenue?.name || platformId}
                    </h4>
                    {selectedVenue && (
                      <p className="text-xs text-slate-500">{selectedVenue.neighborhood}, {selectedVenue.city}</p>
                    )}
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
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {preferredTime}</span>
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {partySize} guests</span>
                </div>
              </div>

              {/* Quick Acquire Button */}
              <button
                onClick={() => executeAcquisition()}
                disabled={!currentStatus?.ready || isLoading}
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
                      onClick={() => fetchSlots(selectedVenue || undefined)}
                      className="text-xs text-slate-500 hover:text-amber-400 flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" /> Refresh
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                    {slots.map((slot, idx) => (
                      <button
                        key={idx}
                        onClick={() => executeAcquisition(slot)}
                        disabled={!currentStatus?.ready}
                        className="p-3 bg-slate-800 hover:bg-amber-900/30 border border-slate-700 hover:border-amber-500 rounded-lg text-center transition-all disabled:opacity-50"
                      >
                        <div className="font-mono font-bold text-white">{slot.time}</div>
                        <div className="text-[10px] text-slate-500">{slot.table_type || 'Standard'}</div>
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
                <div className={`absolute inset-0 ${currentPlatform.color.replace('text-', 'bg-')} blur-xl opacity-30 animate-pulse rounded-full`}></div>
                <Loader2 className={`w-16 h-16 ${currentPlatform.color} animate-spin relative`} />
              </div>
              <h4 className="text-xl font-bold text-white mb-2">Acquiring Reservation...</h4>
              <p className="text-slate-500">Connecting to {currentPlatform.label} API</p>
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
                  <h4 className="text-2xl font-bold text-white mb-2">
                    {bookingMode === 'concierge' ? '🎩 Concierge Booking Confirmed!' : 'Reservation Confirmed!'} 🎉
                  </h4>
                  <p className="text-emerald-400 font-mono mb-4">
                    {result.confirmation || result.confirmationCode || result.resy_token || 'Success'}
                  </p>
                  <div className="bg-slate-800 p-4 rounded-lg inline-block text-left">
                    <div className="text-sm text-slate-400">
                      <p><strong className="text-white">{selectedVenue?.name || platformId}</strong></p>
                      <p>{date} at {result.bookedTime || preferredTime} • {partySize} guests</p>
                      <p className="text-xs mt-2 text-slate-600">Platform: {currentPlatform.label}</p>
                      
                      {/* Concierge mode details */}
                      {bookingMode === 'concierge' && (result as any).bookedUnderName && (
                        <div className="mt-3 pt-3 border-t border-slate-700">
                          <p className="text-emerald-400 flex items-center gap-1">
                            <Briefcase className="w-3 h-3" />
                            Booked under: <strong>{(result as any).bookedUnderName}</strong>
                          </p>
                          <p className="text-xs text-emerald-300 mt-1">
                            ✓ No transfer needed - reservation is already in client's name
                          </p>
                        </div>
                      )}
                      
                      {/* Standard mode - needs transfer */}
                      {bookingMode === 'standard' && (result as any).identityName && (
                        <div className="mt-3 pt-3 border-t border-slate-700">
                          <p className="text-blue-400">
                            Booked under: <strong>{(result as any).identityName}</strong>
                          </p>
                          <p className="text-xs text-amber-400 mt-1">
                            ⚠️ Transfer required to complete sale on AppointmentTrader
                          </p>
                        </div>
                      )}
                      
                      {(result as any).transferId && (
                        <p className="text-xs text-slate-500 mt-2">
                          Transfer ID: #{(result as any).transferId}
                        </p>
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
            {currentStatus?.ready ? (
              <span className="text-emerald-500">{currentPlatform.label} Connected</span>
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
