/**
 * Identity Manager Component
 * 
 * Manages multiple booking identities for platform rotation.
 * Shows usage stats and allows adding/editing identities.
 */

import React, { useState, useEffect } from 'react';
import { BookingIdentity, IdentityStats } from '../../types';
import { 
  Users, Plus, Edit2, Trash2, Check, X, Shield, 
  AlertTriangle, ChevronDown, ChevronUp, Eye, EyeOff 
} from 'lucide-react';

const API_BASE = 'http://localhost:3000/api';

interface IdentityManagerProps {
  onNotify?: (message: string, type: 'success' | 'error' | 'info') => void;
}

const IdentityManager: React.FC<IdentityManagerProps> = ({ onNotify }) => {
  const [identities, setIdentities] = useState<BookingIdentity[]>([]);
  const [stats, setStats] = useState<IdentityStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showSecrets, setShowSecrets] = useState(false);
  
  // Form state for adding/editing
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    resy_auth_token: '',
    resy_payment_id: '',
    opentable_csrf_token: '',
    opentable_gpid: '',
    sevenrooms_first_name: '',
    sevenrooms_last_name: '',
    sevenrooms_email: '',
    sevenrooms_phone: '',
    tock_auth_token: '',
    tock_email: '',
    tock_phone: '',
    monthly_limit: 6
  });

  useEffect(() => {
    fetchIdentities();
    fetchStats();
  }, []);

  const fetchIdentities = async () => {
    try {
      const res = await fetch(`${API_BASE}/identities`);
      const data = await res.json();
      if (data.success) {
        setIdentities(data.identities);
      }
    } catch (error) {
      console.error('Failed to fetch identities:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/identities/stats`);
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const url = editingId 
        ? `${API_BASE}/identities/${editingId}`
        : `${API_BASE}/identities`;
      
      const method = editingId ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const data = await res.json();
      
      if (data.success) {
        onNotify?.(
          editingId ? 'Identity updated successfully' : 'Identity created successfully',
          'success'
        );
        resetForm();
        fetchIdentities();
        fetchStats();
      } else {
        onNotify?.(data.error || 'Failed to save identity', 'error');
      }
    } catch (error) {
      onNotify?.('Network error', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to remove this identity?')) return;
    
    try {
      const res = await fetch(`${API_BASE}/identities/${id}`, { method: 'DELETE' });
      const data = await res.json();
      
      if (data.success) {
        onNotify?.('Identity removed', 'info');
        fetchIdentities();
        fetchStats();
      }
    } catch (error) {
      onNotify?.('Failed to delete identity', 'error');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '', email: '', phone: '',
      resy_auth_token: '', resy_payment_id: '',
      opentable_csrf_token: '', opentable_gpid: '',
      sevenrooms_first_name: '', sevenrooms_last_name: '',
      sevenrooms_email: '', sevenrooms_phone: '',
      tock_auth_token: '', tock_email: '', tock_phone: '',
      monthly_limit: 6
    });
    setShowAddForm(false);
    setEditingId(null);
  };

  const getPlatformStatus = (identity: BookingIdentity) => {
    return {
      resy: !!identity.resy_auth_token && identity.resy_auth_token !== 'null',
      opentable: !!identity.opentable_csrf_token && identity.opentable_csrf_token !== 'null',
      sevenrooms: !!identity.sevenrooms_email && identity.sevenrooms_email !== 'null',
      tock: !!identity.tock_auth_token && identity.tock_auth_token !== 'null'
    };
  };

  const getUsageColor = (used: number, limit: number) => {
    const ratio = used / limit;
    if (ratio >= 0.9) return 'text-red-400';
    if (ratio >= 0.7) return 'text-amber-400';
    return 'text-emerald-400';
  };

  if (loading) {
    return (
      <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-8 text-center">
        <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full mx-auto"></div>
        <p className="text-slate-400 mt-4">Loading identities...</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-500/20 rounded-lg">
            <Users className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Booking Identities</h3>
            <p className="text-xs text-slate-500">Rotate identities to stay under platform limits</p>
          </div>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-3 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Identity
        </button>
      </div>

      {/* Stats Overview */}
      {stats.length > 0 && (
        <div className="p-4 border-b border-slate-800 bg-slate-950/50">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map((stat, i) => (
              <div key={i} className="bg-slate-900 rounded-lg p-3 border border-slate-800">
                <div className="text-xs text-slate-500 mb-1">{stat.identity}</div>
                <div className={`text-2xl font-bold ${getUsageColor(stat.total, stat.limit * 4)}`}>
                  {stat.total}/{stat.limit * 4}
                </div>
                <div className="text-xs text-slate-600 mt-1">
                  R:{stat.resy} O:{stat.opentable} S:{stat.sevenrooms} T:{stat.tock}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Identity List */}
      <div className="divide-y divide-slate-800">
        {identities.length === 0 ? (
          <div className="p-8 text-center">
            <Shield className="w-12 h-12 text-slate-700 mx-auto mb-4" />
            <p className="text-slate-400">No identities configured yet</p>
            <p className="text-xs text-slate-600 mt-1">Add your first booking identity to get started</p>
          </div>
        ) : (
          identities.map((identity) => {
            const platforms = getPlatformStatus(identity);
            const isExpanded = expandedId === identity.id;
            
            return (
              <div key={identity.id} className="p-4">
                <div 
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : identity.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white font-bold">
                      {identity.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-white">{identity.name}</div>
                      <div className="text-xs text-slate-500">{identity.email}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    {/* Platform indicators */}
                    <div className="flex gap-1.5">
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${platforms.resy ? 'bg-red-500/20 text-red-400' : 'bg-slate-800 text-slate-600'}`}>RESY</span>
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${platforms.opentable ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-800 text-slate-600'}`}>OT</span>
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${platforms.sevenrooms ? 'bg-purple-500/20 text-purple-400' : 'bg-slate-800 text-slate-600'}`}>7R</span>
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${platforms.tock ? 'bg-teal-500/20 text-teal-400' : 'bg-slate-800 text-slate-600'}`}>TOCK</span>
                    </div>
                    
                    {/* Usage */}
                    <div className={`text-sm font-mono ${getUsageColor(identity.bookings_this_month, identity.monthly_limit * 4)}`}>
                      {identity.bookings_this_month}/{identity.monthly_limit * 4}
                    </div>
                    
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                  </div>
                </div>
                
                {/* Expanded details */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-slate-800">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div className="bg-slate-950 rounded-lg p-3">
                        <div className="text-xs text-slate-500 mb-1">Resy</div>
                        <div className="text-white font-medium">{identity.resy_bookings_month}/{identity.monthly_limit}</div>
                      </div>
                      <div className="bg-slate-950 rounded-lg p-3">
                        <div className="text-xs text-slate-500 mb-1">OpenTable</div>
                        <div className="text-white font-medium">{identity.opentable_bookings_month}/{identity.monthly_limit}</div>
                      </div>
                      <div className="bg-slate-950 rounded-lg p-3">
                        <div className="text-xs text-slate-500 mb-1">SevenRooms</div>
                        <div className="text-white font-medium">{identity.sevenrooms_bookings_month}/{identity.monthly_limit}</div>
                      </div>
                      <div className="bg-slate-950 rounded-lg p-3">
                        <div className="text-xs text-slate-500 mb-1">Tock</div>
                        <div className="text-white font-medium">{identity.tock_bookings_month}/{identity.monthly_limit}</div>
                      </div>
                    </div>
                    
                    <div className="flex justify-end gap-2 mt-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingId(identity.id);
                          setShowAddForm(true);
                          // Would need to fetch full identity data here in production
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-3 h-3" />
                        Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(identity.id);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                        Remove
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add/Edit Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">
                {editingId ? 'Edit Identity' : 'Add New Identity'}
              </h3>
              <button onClick={resetForm} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-4 space-y-6">
              {/* Basic Info */}
              <div>
                <h4 className="text-sm font-medium text-slate-300 mb-3">Basic Information</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Name *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Email *</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Monthly Limit (per platform)</label>
                    <input
                      type="number"
                      value={formData.monthly_limit}
                      onChange={(e) => setFormData({...formData, monthly_limit: parseInt(e.target.value)})}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                      min={1}
                      max={20}
                    />
                  </div>
                </div>
              </div>

              {/* Show/Hide Secrets Toggle */}
              <button
                type="button"
                onClick={() => setShowSecrets(!showSecrets)}
                className="flex items-center gap-2 text-sm text-slate-400 hover:text-white"
              >
                {showSecrets ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {showSecrets ? 'Hide Credentials' : 'Show Credentials'}
              </button>

              {showSecrets && (
                <>
                  {/* Resy Credentials */}
                  <div>
                    <h4 className="text-sm font-medium text-red-400 mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-400"></span>
                      Resy Credentials
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Auth Token</label>
                        <input
                          type="password"
                          value={formData.resy_auth_token}
                          onChange={(e) => setFormData({...formData, resy_auth_token: e.target.value})}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm font-mono focus:ring-2 focus:ring-red-500 focus:border-transparent"
                          placeholder="eyJ..."
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Payment ID</label>
                        <input
                          type="text"
                          value={formData.resy_payment_id}
                          onChange={(e) => setFormData({...formData, resy_payment_id: e.target.value})}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm font-mono focus:ring-2 focus:ring-red-500 focus:border-transparent"
                          placeholder="pm_..."
                        />
                      </div>
                    </div>
                  </div>

                  {/* OpenTable Credentials */}
                  <div>
                    <h4 className="text-sm font-medium text-orange-400 mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-orange-400"></span>
                      OpenTable Credentials
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">CSRF Token</label>
                        <input
                          type="password"
                          value={formData.opentable_csrf_token}
                          onChange={(e) => setFormData({...formData, opentable_csrf_token: e.target.value})}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm font-mono focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">GPID</label>
                        <input
                          type="text"
                          value={formData.opentable_gpid}
                          onChange={(e) => setFormData({...formData, opentable_gpid: e.target.value})}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm font-mono focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>

                  {/* SevenRooms Credentials */}
                  <div>
                    <h4 className="text-sm font-medium text-purple-400 mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                      SevenRooms Credentials
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">First Name</label>
                        <input
                          type="text"
                          value={formData.sevenrooms_first_name}
                          onChange={(e) => setFormData({...formData, sevenrooms_first_name: e.target.value})}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Last Name</label>
                        <input
                          type="text"
                          value={formData.sevenrooms_last_name}
                          onChange={(e) => setFormData({...formData, sevenrooms_last_name: e.target.value})}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Email</label>
                        <input
                          type="email"
                          value={formData.sevenrooms_email}
                          onChange={(e) => setFormData({...formData, sevenrooms_email: e.target.value})}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Phone</label>
                        <input
                          type="tel"
                          value={formData.sevenrooms_phone}
                          onChange={(e) => setFormData({...formData, sevenrooms_phone: e.target.value})}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Tock Credentials */}
                  <div>
                    <h4 className="text-sm font-medium text-teal-400 mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-teal-400"></span>
                      Tock Credentials
                    </h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Auth Token</label>
                        <input
                          type="password"
                          value={formData.tock_auth_token}
                          onChange={(e) => setFormData({...formData, tock_auth_token: e.target.value})}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm font-mono focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Email</label>
                        <input
                          type="email"
                          value={formData.tock_email}
                          onChange={(e) => setFormData({...formData, tock_email: e.target.value})}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Phone</label>
                        <input
                          type="tel"
                          value={formData.tock_phone}
                          onChange={(e) => setFormData({...formData, tock_phone: e.target.value})}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Warning */}
              <div className="flex items-start gap-3 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-200">
                  <strong>Security Note:</strong> Credentials are stored in your database. 
                  Make sure your database connection is secure and never share these tokens.
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <Check className="w-4 h-4" />
                  {editingId ? 'Update Identity' : 'Create Identity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default IdentityManager;

