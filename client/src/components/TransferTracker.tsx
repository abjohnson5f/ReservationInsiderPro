/**
 * Transfer Tracker Component
 * 
 * Manages the complete transfer workflow:
 * ACQUIRED -> LISTED -> SOLD -> TRANSFER_PENDING -> TRANSFERRED -> COMPLETED
 * 
 * Includes AT listing generation and one-click copy functionality.
 */

import React, { useState, useEffect } from 'react';
import { Transfer, ATListing, TransferStats, TransferMethod } from '../../types';
import { 
  Package, DollarSign, Clock, CheckCircle2, AlertTriangle, 
  Copy, ExternalLink, ArrowRight, User, Phone, Mail,
  ChevronDown, ChevronUp, Clipboard, RefreshCw, TrendingUp
} from 'lucide-react';

const API_BASE = 'http://localhost:3000/api';

interface TransferTrackerProps {
  onNotify?: (message: string, type: 'success' | 'error' | 'info') => void;
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string; icon: React.ReactNode }> = {
  ACQUIRED: { color: 'text-emerald-400', bg: 'bg-emerald-500/20', label: 'Acquired', icon: <CheckCircle2 className="w-4 h-4" /> },
  LISTED: { color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'Listed on AT', icon: <Package className="w-4 h-4" /> },
  SOLD: { color: 'text-amber-400', bg: 'bg-amber-500/20', label: 'Sold', icon: <DollarSign className="w-4 h-4" /> },
  TRANSFER_PENDING: { color: 'text-orange-400', bg: 'bg-orange-500/20', label: 'Transfer Pending', icon: <Clock className="w-4 h-4" /> },
  TRANSFERRED: { color: 'text-purple-400', bg: 'bg-purple-500/20', label: 'Transferred', icon: <ArrowRight className="w-4 h-4" /> },
  COMPLETED: { color: 'text-slate-400', bg: 'bg-slate-500/20', label: 'Completed', icon: <CheckCircle2 className="w-4 h-4" /> }
};

const TRANSFER_METHODS: { value: TransferMethod; label: string; description: string }[] = [
  { value: 'NAME_CHANGE', label: 'Name Change', description: 'Change reservation name (Resy)' },
  { value: 'CANCEL_REBOOK', label: 'Cancel & Rebook', description: 'Cancel and buyer rebooks immediately' },
  { value: 'PLATFORM_TRANSFER', label: 'Platform Transfer', description: 'Use platform transfer feature' },
  { value: 'SHOW_UP_TOGETHER', label: 'Show Up Together', description: 'Meet buyer at restaurant' }
];

const TransferTracker: React.FC<TransferTrackerProps> = ({ onNotify }) => {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [stats, setStats] = useState<TransferStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filter, setFilter] = useState<string>('all');
  
  // Modal states
  const [showSoldModal, setShowSoldModal] = useState(false);
  const [showListingModal, setShowListingModal] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null);
  const [atListing, setAtListing] = useState<ATListing | null>(null);
  
  // Form data
  const [soldForm, setSoldForm] = useState({
    buyer_name: '',
    buyer_email: '',
    buyer_phone: '',
    sale_price: 0,
    transfer_method: 'NAME_CHANGE' as TransferMethod
  });
  const [listingPrice, setListingPrice] = useState(0);

  useEffect(() => {
    fetchTransfers();
    fetchStats();
  }, [filter]);

  const fetchTransfers = async () => {
    try {
      let url = `${API_BASE}/transfers?upcoming=true`;
      if (filter !== 'all') url += `&status=${filter}`;
      
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setTransfers(data.transfers);
      }
    } catch (error) {
      console.error('Failed to fetch transfers:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/transfers/stats`);
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const generateATListing = async (transferId: number) => {
    try {
      const res = await fetch(`${API_BASE}/transfers/${transferId}/at-listing`);
      const data = await res.json();
      if (data.success) {
        setAtListing(data.listing);
        setListingPrice(data.listing.price_suggestion);
        setShowListingModal(true);
      }
    } catch (error) {
      onNotify?.('Failed to generate listing', 'error');
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      onNotify?.(`${label} copied to clipboard`, 'success');
    } catch (error) {
      onNotify?.('Failed to copy', 'error');
    }
  };

  const markAsListed = async () => {
    if (!selectedTransfer) return;
    
    try {
      const res = await fetch(`${API_BASE}/transfers/${selectedTransfer.id}/listed`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing_price: listingPrice })
      });
      
      const data = await res.json();
      if (data.success) {
        onNotify?.('Marked as listed on AppointmentTrader', 'success');
        setShowListingModal(false);
        fetchTransfers();
        fetchStats();
      }
    } catch (error) {
      onNotify?.('Failed to update status', 'error');
    }
  };

  const markAsSold = async () => {
    if (!selectedTransfer) return;
    
    try {
      const res = await fetch(`${API_BASE}/transfers/${selectedTransfer.id}/sold`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(soldForm)
      });
      
      const data = await res.json();
      if (data.success) {
        onNotify?.('Transfer marked as sold!', 'success');
        setShowSoldModal(false);
        fetchTransfers();
        fetchStats();
      }
    } catch (error) {
      onNotify?.('Failed to update status', 'error');
    }
  };

  const updateStatus = async (id: number, status: string) => {
    try {
      const res = await fetch(`${API_BASE}/transfers/${id}/${status}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await res.json();
      if (data.success) {
        onNotify?.(`Status updated to ${status.replace('-', ' ')}`, 'success');
        fetchTransfers();
        fetchStats();
      }
    } catch (error) {
      onNotify?.('Failed to update status', 'error');
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const getTimeUntil = (deadline: string) => {
    const now = new Date();
    const dl = new Date(deadline);
    const diff = dl.getTime() - now.getTime();
    
    if (diff < 0) return { text: 'Overdue!', urgent: true };
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) return { text: `${days}d ${hours % 24}h`, urgent: days < 1 };
    return { text: `${hours}h`, urgent: hours < 12 };
  };

  if (loading) {
    return (
      <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-8 text-center">
        <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full mx-auto"></div>
        <p className="text-slate-400 mt-4">Loading transfers...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Revenue Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-4">
            <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
              <DollarSign className="w-4 h-4" />
              Total Revenue
            </div>
            <div className="text-2xl font-bold text-emerald-400">${stats.total_revenue.toLocaleString()}</div>
          </div>
          <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-4">
            <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
              <Package className="w-4 h-4" />
              Total Sales
            </div>
            <div className="text-2xl font-bold text-white">{stats.total_sales}</div>
          </div>
          <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-4">
            <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
              <TrendingUp className="w-4 h-4" />
              Avg Sale Price
            </div>
            <div className="text-2xl font-bold text-blue-400">${Math.round(stats.avg_sale_price)}</div>
          </div>
          <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-4">
            <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
              <Clock className="w-4 h-4" />
              Pending Transfers
            </div>
            <div className="text-2xl font-bold text-amber-400">
              {(stats.by_status['SOLD'] || 0) + (stats.by_status['TRANSFER_PENDING'] || 0)}
            </div>
          </div>
        </div>
      )}

      {/* Transfer List */}
      <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <Package className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Transfer Workflow</h3>
              <p className="text-xs text-slate-500">Track reservations from acquisition to completion</p>
            </div>
          </div>
          
          {/* Filter */}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white"
          >
            <option value="all">All Status</option>
            <option value="ACQUIRED">Acquired</option>
            <option value="LISTED">Listed</option>
            <option value="SOLD">Sold</option>
            <option value="TRANSFER_PENDING">Transfer Pending</option>
          </select>
        </div>

        {/* List */}
        <div className="divide-y divide-slate-800">
          {transfers.length === 0 ? (
            <div className="p-8 text-center">
              <Package className="w-12 h-12 text-slate-700 mx-auto mb-4" />
              <p className="text-slate-400">No transfers yet</p>
              <p className="text-xs text-slate-600 mt-1">Acquired reservations will appear here</p>
            </div>
          ) : (
            transfers.map((transfer) => {
              const statusConfig = STATUS_CONFIG[transfer.status];
              const isExpanded = expandedId === transfer.id;
              const deadline = transfer.transfer_deadline ? getTimeUntil(transfer.transfer_deadline) : null;
              
              return (
                <div key={transfer.id} className="p-4">
                  <div 
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : transfer.id)}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${statusConfig.bg}`}>
                        <span className={statusConfig.color}>{statusConfig.icon}</span>
                      </div>
                      <div>
                        <div className="font-medium text-white">{transfer.restaurant_name}</div>
                        <div className="text-xs text-slate-500">
                          {formatDate(transfer.reservation_date)} at {formatTime(transfer.reservation_time)} · {transfer.party_size} guests
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      {/* Price */}
                      {transfer.sale_price ? (
                        <div className="text-right">
                          <div className="text-emerald-400 font-bold">${transfer.sale_price}</div>
                          <div className="text-[10px] text-slate-500">SOLD</div>
                        </div>
                      ) : transfer.listing_price ? (
                        <div className="text-right">
                          <div className="text-blue-400 font-medium">${transfer.listing_price}</div>
                          <div className="text-[10px] text-slate-500">ASKING</div>
                        </div>
                      ) : null}
                      
                      {/* Deadline warning */}
                      {deadline && (
                        <div className={`text-xs font-mono ${deadline.urgent ? 'text-red-400' : 'text-amber-400'}`}>
                          {deadline.urgent && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                          {deadline.text}
                        </div>
                      )}
                      
                      {/* Status badge */}
                      <span className={`px-2 py-1 text-xs font-medium rounded ${statusConfig.bg} ${statusConfig.color}`}>
                        {statusConfig.label}
                      </span>
                      
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                    </div>
                  </div>
                  
                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-slate-800 space-y-4">
                      {/* Buyer info if sold */}
                      {transfer.buyer_name && (
                        <div className="bg-slate-950 rounded-lg p-3">
                          <div className="text-xs text-slate-500 mb-2">Buyer Information</div>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 text-sm text-white">
                              <User className="w-4 h-4 text-slate-500" />
                              {transfer.buyer_name}
                            </div>
                            {transfer.buyer_email && (
                              <div className="flex items-center gap-2 text-sm text-slate-400">
                                <Mail className="w-4 h-4 text-slate-500" />
                                {transfer.buyer_email}
                              </div>
                            )}
                            {transfer.buyer_phone && (
                              <div className="flex items-center gap-2 text-sm text-slate-400">
                                <Phone className="w-4 h-4 text-slate-500" />
                                {transfer.buyer_phone}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Actions based on status */}
                      <div className="flex flex-wrap gap-2">
                        {transfer.status === 'ACQUIRED' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTransfer(transfer);
                              generateATListing(transfer.id);
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-lg transition-colors"
                          >
                            <Clipboard className="w-3 h-3" />
                            Generate AT Listing
                          </button>
                        )}
                        
                        {transfer.status === 'LISTED' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTransfer(transfer);
                              setSoldForm({
                                buyer_name: '',
                                buyer_email: '',
                                buyer_phone: '',
                                sale_price: transfer.listing_price || 0,
                                transfer_method: 'NAME_CHANGE'
                              });
                              setShowSoldModal(true);
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded-lg transition-colors"
                          >
                            <DollarSign className="w-3 h-3" />
                            Mark as Sold
                          </button>
                        )}
                        
                        {transfer.status === 'SOLD' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateStatus(transfer.id, 'transfer-pending');
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white text-xs rounded-lg transition-colors"
                          >
                            <Clock className="w-3 h-3" />
                            Start Transfer
                          </button>
                        )}
                        
                        {transfer.status === 'TRANSFER_PENDING' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateStatus(transfer.id, 'transferred');
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs rounded-lg transition-colors"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            Mark Transferred
                          </button>
                        )}
                        
                        {transfer.status === 'TRANSFERRED' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateStatus(transfer.id, 'completed');
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-white text-xs rounded-lg transition-colors"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            Complete
                          </button>
                        )}
                        
                        {transfer.at_listing_url && (
                          <a
                            href={transfer.at_listing_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition-colors"
                          >
                            <ExternalLink className="w-3 h-3" />
                            View on AT
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* AT Listing Modal */}
      {showListingModal && atListing && selectedTransfer && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-lg">
            <div className="p-4 border-b border-slate-800">
              <h3 className="text-lg font-semibold text-white">AppointmentTrader Listing</h3>
              <p className="text-xs text-slate-500">Copy this text to list on AT</p>
            </div>
            
            <div className="p-4 space-y-4">
              {/* Title */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-slate-500">Title</label>
                  <button
                    onClick={() => copyToClipboard(atListing.title, 'Title')}
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    Copy
                  </button>
                </div>
                <div className="bg-slate-950 rounded-lg p-3 text-sm text-white border border-slate-800">
                  {atListing.title}
                </div>
              </div>
              
              {/* Description */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-slate-500">Description</label>
                  <button
                    onClick={() => copyToClipboard(atListing.description, 'Description')}
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    Copy
                  </button>
                </div>
                <div className="bg-slate-950 rounded-lg p-3 text-sm text-white border border-slate-800 whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {atListing.description}
                </div>
              </div>
              
              {/* Price */}
              <div>
                <label className="block text-xs text-slate-500 mb-1">Asking Price</label>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">$</span>
                  <input
                    type="number"
                    value={listingPrice}
                    onChange={(e) => setListingPrice(parseInt(e.target.value))}
                    className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                  />
                  <span className="text-xs text-slate-500">Suggested: ${atListing.price_suggestion}</span>
                </div>
              </div>
              
              {/* Copy All */}
              <button
                onClick={() => copyToClipboard(`${atListing.title}\n\n${atListing.description}\n\nAsking: $${listingPrice}`, 'Full listing')}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
              >
                <Copy className="w-4 h-4" />
                Copy Full Listing
              </button>
            </div>
            
            <div className="p-4 border-t border-slate-800 flex justify-between">
              <button
                onClick={() => setShowListingModal(false)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={markAsListed}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-lg"
              >
                Mark as Listed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sold Modal */}
      {showSoldModal && selectedTransfer && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-md">
            <div className="p-4 border-b border-slate-800">
              <h3 className="text-lg font-semibold text-white">Record Sale</h3>
              <p className="text-xs text-slate-500">{selectedTransfer.restaurant_name}</p>
            </div>
            
            <form onSubmit={(e) => { e.preventDefault(); markAsSold(); }} className="p-4 space-y-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Buyer Name *</label>
                <input
                  type="text"
                  value={soldForm.buyer_name}
                  onChange={(e) => setSoldForm({...soldForm, buyer_name: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Buyer Email</label>
                  <input
                    type="email"
                    value={soldForm.buyer_email}
                    onChange={(e) => setSoldForm({...soldForm, buyer_email: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Buyer Phone</label>
                  <input
                    type="tel"
                    value={soldForm.buyer_phone}
                    onChange={(e) => setSoldForm({...soldForm, buyer_phone: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs text-slate-500 mb-1">Sale Price *</label>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">$</span>
                  <input
                    type="number"
                    value={soldForm.sale_price}
                    onChange={(e) => setSoldForm({...soldForm, sale_price: parseInt(e.target.value)})}
                    className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs text-slate-500 mb-1">Transfer Method *</label>
                <select
                  value={soldForm.transfer_method}
                  onChange={(e) => setSoldForm({...soldForm, transfer_method: e.target.value as TransferMethod})}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                >
                  {TRANSFER_METHODS.map((method) => (
                    <option key={method.value} value={method.value}>
                      {method.label} - {method.description}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowSoldModal(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-lg"
                >
                  Record Sale
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransferTracker;

