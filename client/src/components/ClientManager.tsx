import React, { useState, useEffect } from 'react';
import { Client, ClientStats, VipLevel } from '../../types';
import { CLIENTS_API } from '../config';

const ClientManager: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [stats, setStats] = useState<ClientStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Form state for add/edit
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    company: '',
    notes: '',
    vip_level: 'standard' as VipLevel,
    preferred_party_size: 2,
  });

  const fetchClients = async () => {
    try {
      const response = await fetch(CLIENTS_API);
      if (!response.ok) throw new Error('Failed to fetch clients');
      const data = await response.json();
      setClients(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${CLIENTS_API}/stats`);
      if (!response.ok) throw new Error('Failed to fetch stats');
      const data = await response.json();
      setStats(data);
    } catch (err: any) {
      console.error('Failed to fetch stats:', err);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchClients(), fetchStats()]);
      setLoading(false);
    };
    loadData();
  }, []);

  const handleAddClient = async () => {
    try {
      const response = await fetch(CLIENTS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add client');
      }
      
      await fetchClients();
      await fetchStats();
      setShowAddModal(false);
      resetForm();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUpdateClient = async () => {
    if (!editingClient) return;
    
    try {
      const response = await fetch(`${CLIENTS_API}/${editingClient.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      
      if (!response.ok) throw new Error('Failed to update client');
      
      await fetchClients();
      await fetchStats();
      setEditingClient(null);
      resetForm();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteClient = async (id: number) => {
    if (!confirm('Are you sure you want to delete this client?')) return;
    
    try {
      const response = await fetch(`${CLIENTS_API}/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) throw new Error('Failed to delete client');
      
      await fetchClients();
      await fetchStats();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSyncToOpenTable = async (clientId: number) => {
    try {
      const response = await fetch(`${CLIENTS_API}/${clientId}/sync/opentable`, {
        method: 'POST',
      });
      
      const data = await response.json();
      if (data.note) {
        alert(data.note);
      }
      
      await fetchClients();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const resetForm = () => {
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      company: '',
      notes: '',
      vip_level: 'standard',
      preferred_party_size: 2,
    });
  };

  const openEditModal = (client: Client) => {
    setEditingClient(client);
    setFormData({
      first_name: client.first_name,
      last_name: client.last_name,
      email: client.email,
      phone: client.phone,
      company: client.company || '',
      notes: client.notes || '',
      vip_level: client.vip_level,
      preferred_party_size: client.preferred_party_size,
    });
  };

  const filteredClients = clients.filter(client => {
    const query = searchQuery.toLowerCase();
    return (
      client.first_name.toLowerCase().includes(query) ||
      client.last_name.toLowerCase().includes(query) ||
      client.email.toLowerCase().includes(query) ||
      (client.company?.toLowerCase().includes(query))
    );
  });

  const getVipBadge = (level: VipLevel) => {
    switch (level) {
      case 'platinum':
        return <span className="vip-badge platinum">💎 PLATINUM</span>;
      case 'vip':
        return <span className="vip-badge vip">⭐ VIP</span>;
      default:
        return <span className="vip-badge standard">Standard</span>;
    }
  };

  if (loading) {
    return (
      <div className="client-manager loading">
        <div className="loading-spinner">Loading clients...</div>
      </div>
    );
  }

  return (
    <div className="client-manager">
      {/* Header */}
      <div className="client-header">
        <div className="header-left">
          <h2>🎩 Client Management</h2>
          <p className="subtitle">Concierge booking model - book under client names</p>
        </div>
        <button className="add-client-btn" onClick={() => setShowAddModal(true)}>
          + Add Client
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* Stats Dashboard */}
      {stats && (
        <div className="client-stats-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.totalClients}</div>
            <div className="stat-label">Total Clients</div>
          </div>
          <div className="stat-card vip">
            <div className="stat-value">{stats.vipClients + stats.platinumClients}</div>
            <div className="stat-label">VIP/Platinum</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.totalBookings}</div>
            <div className="stat-label">Total Bookings</div>
          </div>
          <div className="stat-card revenue">
            <div className="stat-value">${stats.totalRevenue.toLocaleString()}</div>
            <div className="stat-label">Total Revenue</div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="search-bar">
        <input
          type="text"
          placeholder="Search clients by name, email, or company..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Client List */}
      <div className="client-list">
        {filteredClients.length === 0 ? (
          <div className="empty-state">
            <p>No clients found. Add your first client to start the concierge model!</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Client</th>
                <th>Contact</th>
                <th>Status</th>
                <th>Bookings</th>
                <th>Revenue</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((client) => (
                <tr key={client.id}>
                  <td className="client-name-cell">
                    <div className="client-name">
                      {client.first_name} {client.last_name}
                    </div>
                    {client.company && (
                      <div className="client-company">{client.company}</div>
                    )}
                    {getVipBadge(client.vip_level)}
                  </td>
                  <td className="contact-cell">
                    <div className="client-email">{client.email}</div>
                    <div className="client-phone">{client.phone}</div>
                  </td>
                  <td className="sync-status-cell">
                    <div className="sync-badges">
                      {client.synced_to_resy ? (
                        <span className="sync-badge synced">✓ Resy</span>
                      ) : (
                        <span className="sync-badge not-synced">Resy</span>
                      )}
                      {client.synced_to_opentable ? (
                        <span className="sync-badge synced">✓ OT</span>
                      ) : (
                        <span 
                          className="sync-badge not-synced clickable"
                          onClick={() => handleSyncToOpenTable(client.id)}
                          title="Click to sync to OpenTable"
                        >
                          OT (sync)
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="bookings-cell">
                    <span className="booking-count">{client.successful_bookings}</span>
                    <span className="booking-total">/ {client.total_bookings}</span>
                  </td>
                  <td className="revenue-cell">
                    ${client.total_revenue.toLocaleString()}
                  </td>
                  <td className="actions-cell">
                    <button 
                      className="action-btn edit"
                      onClick={() => openEditModal(client)}
                    >
                      Edit
                    </button>
                    <button 
                      className="action-btn delete"
                      onClick={() => handleDeleteClient(client.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || editingClient) && (
        <div className="modal-overlay" onClick={() => { setShowAddModal(false); setEditingClient(null); resetForm(); }}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>{editingClient ? 'Edit Client' : 'Add New Client'}</h3>
            
            <div className="form-grid">
              <div className="form-group">
                <label>First Name *</label>
                <input
                  type="text"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  placeholder="John"
                />
              </div>
              
              <div className="form-group">
                <label>Last Name *</label>
                <input
                  type="text"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  placeholder="Smith"
                />
              </div>
              
              <div className="form-group">
                <label>Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="john@example.com"
                />
              </div>
              
              <div className="form-group">
                <label>Phone *</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+1 (555) 123-4567"
                />
              </div>
              
              <div className="form-group">
                <label>Company</label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  placeholder="Acme Corp"
                />
              </div>
              
              <div className="form-group">
                <label>VIP Level</label>
                <select
                  value={formData.vip_level}
                  onChange={(e) => setFormData({ ...formData, vip_level: e.target.value as VipLevel })}
                >
                  <option value="standard">Standard</option>
                  <option value="vip">⭐ VIP</option>
                  <option value="platinum">💎 Platinum</option>
                </select>
              </div>
              
              <div className="form-group">
                <label>Preferred Party Size</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={formData.preferred_party_size}
                  onChange={(e) => setFormData({ ...formData, preferred_party_size: parseInt(e.target.value) || 2 })}
                />
              </div>
              
              <div className="form-group full-width">
                <label>Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Special preferences, dietary restrictions, etc."
                  rows={3}
                />
              </div>
            </div>
            
            <div className="modal-actions">
              <button 
                className="cancel-btn"
                onClick={() => { setShowAddModal(false); setEditingClient(null); resetForm(); }}
              >
                Cancel
              </button>
              <button 
                className="save-btn"
                onClick={editingClient ? handleUpdateClient : handleAddClient}
                disabled={!formData.first_name || !formData.last_name || !formData.email || !formData.phone}
              >
                {editingClient ? 'Update Client' : 'Add Client'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .client-manager {
          padding: 20px;
          max-width: 1400px;
          margin: 0 auto;
        }

        .client-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .client-header h2 {
          margin: 0;
          font-size: 1.8rem;
          color: #fff;
        }

        .subtitle {
          margin: 4px 0 0 0;
          color: #888;
          font-size: 0.9rem;
        }

        .add-client-btn {
          background: linear-gradient(135deg, #10B981, #059669);
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          color: white;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .add-client-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
        }

        .error-banner {
          background: #dc2626;
          color: white;
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .error-banner button {
          background: none;
          border: none;
          color: white;
          font-size: 1.2rem;
          cursor: pointer;
        }

        .client-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }

        .stat-card {
          background: linear-gradient(145deg, #1e293b, #0f172a);
          border: 1px solid #334155;
          border-radius: 12px;
          padding: 20px;
          text-align: center;
        }

        .stat-card.vip {
          border-color: #f59e0b;
          background: linear-gradient(145deg, #292524, #1c1917);
        }

        .stat-card.revenue {
          border-color: #10b981;
          background: linear-gradient(145deg, #14532d, #052e16);
        }

        .stat-value {
          font-size: 2rem;
          font-weight: 700;
          color: #fff;
          margin-bottom: 4px;
        }

        .stat-label {
          font-size: 0.85rem;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .search-bar {
          margin-bottom: 20px;
        }

        .search-bar input {
          width: 100%;
          padding: 12px 16px;
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 8px;
          color: #fff;
          font-size: 0.95rem;
        }

        .search-bar input::placeholder {
          color: #64748b;
        }

        .client-list table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
        }

        .client-list th {
          text-align: left;
          padding: 12px 16px;
          background: #1e293b;
          color: #94a3b8;
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 1px solid #334155;
        }

        .client-list td {
          padding: 16px;
          border-bottom: 1px solid #1e293b;
          vertical-align: middle;
        }

        .client-list tr:hover td {
          background: rgba(30, 41, 59, 0.5);
        }

        .client-name-cell .client-name {
          font-weight: 600;
          color: #fff;
          font-size: 1rem;
        }

        .client-company {
          color: #64748b;
          font-size: 0.85rem;
          margin-top: 2px;
        }

        .vip-badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 0.7rem;
          font-weight: 600;
          margin-top: 6px;
        }

        .vip-badge.platinum {
          background: linear-gradient(135deg, #a78bfa, #8b5cf6);
          color: white;
        }

        .vip-badge.vip {
          background: linear-gradient(135deg, #fbbf24, #f59e0b);
          color: #1c1917;
        }

        .vip-badge.standard {
          background: #334155;
          color: #94a3b8;
        }

        .contact-cell {
          font-size: 0.9rem;
        }

        .client-email {
          color: #38bdf8;
        }

        .client-phone {
          color: #94a3b8;
          margin-top: 2px;
        }

        .sync-badges {
          display: flex;
          gap: 6px;
        }

        .sync-badge {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 500;
        }

        .sync-badge.synced {
          background: #166534;
          color: #86efac;
        }

        .sync-badge.not-synced {
          background: #1e293b;
          color: #64748b;
        }

        .sync-badge.clickable {
          cursor: pointer;
          transition: all 0.2s;
        }

        .sync-badge.clickable:hover {
          background: #334155;
          color: #94a3b8;
        }

        .bookings-cell {
          font-size: 0.95rem;
        }

        .booking-count {
          color: #10b981;
          font-weight: 600;
        }

        .booking-total {
          color: #64748b;
        }

        .revenue-cell {
          color: #10b981;
          font-weight: 600;
        }

        .actions-cell {
          display: flex;
          gap: 8px;
        }

        .action-btn {
          padding: 6px 12px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.8rem;
          font-weight: 500;
          transition: all 0.2s;
        }

        .action-btn.edit {
          background: #1e40af;
          color: white;
        }

        .action-btn.edit:hover {
          background: #1d4ed8;
        }

        .action-btn.delete {
          background: #7f1d1d;
          color: #fca5a5;
        }

        .action-btn.delete:hover {
          background: #991b1b;
        }

        .empty-state {
          text-align: center;
          padding: 48px;
          color: #64748b;
          background: #1e293b;
          border-radius: 12px;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
        }

        .modal-content {
          background: #1e293b;
          border-radius: 16px;
          padding: 32px;
          width: 90%;
          max-width: 600px;
          max-height: 90vh;
          overflow-y: auto;
        }

        .modal-content h3 {
          margin: 0 0 24px 0;
          font-size: 1.5rem;
          color: #fff;
        }

        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-group.full-width {
          grid-column: 1 / -1;
        }

        .form-group label {
          color: #94a3b8;
          font-size: 0.85rem;
          font-weight: 500;
        }

        .form-group input,
        .form-group select,
        .form-group textarea {
          padding: 10px 12px;
          background: #0f172a;
          border: 1px solid #334155;
          border-radius: 6px;
          color: #fff;
          font-size: 0.95rem;
        }

        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: #3b82f6;
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 24px;
          padding-top: 16px;
          border-top: 1px solid #334155;
        }

        .cancel-btn {
          padding: 10px 20px;
          background: #334155;
          border: none;
          border-radius: 6px;
          color: #94a3b8;
          cursor: pointer;
          font-weight: 500;
        }

        .save-btn {
          padding: 10px 24px;
          background: linear-gradient(135deg, #10B981, #059669);
          border: none;
          border-radius: 6px;
          color: white;
          cursor: pointer;
          font-weight: 600;
        }

        .save-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .loading {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 400px;
        }

        .loading-spinner {
          color: #64748b;
          font-size: 1.1rem;
        }

        @media (max-width: 768px) {
          .client-stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .form-grid {
            grid-template-columns: 1fr;
          }

          .client-list {
            overflow-x: auto;
          }
        }
      `}</style>
    </div>
  );
};

export default ClientManager;

