
import React, { useState, useEffect } from 'react';
import { PortfolioItem, AssetStatus } from '../types';
import { 
  Briefcase, 
  DollarSign, 
  Clock, 
  CheckCircle2, 
  MessageSquare, 
  AlertCircle,
  X,
  Save,
  Plus,
  Wallet,
  ChevronDown,
  Copy,
  HelpCircle,
  Trash2,
  AlertTriangle
} from 'lucide-react';

interface PortfolioManagerProps {
  items: PortfolioItem[];
  onUpdateItem: (item: PortfolioItem) => void;
  onAddItem: (item: PortfolioItem) => void;
  onDeleteItem: (itemId: string) => void;
}

const PortfolioManager: React.FC<PortfolioManagerProps> = ({ items, onUpdateItem, onAddItem, onDeleteItem }) => {
  const [selectedItem, setSelectedItem] = useState<PortfolioItem | null>(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSoldModal, setShowSoldModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [soldPriceInput, setSoldPriceInput] = useState<number>(0);
  const [itemToSell, setItemToSell] = useState<PortfolioItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<PortfolioItem | null>(null);
  
  // State for dropdowns
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  // Form State for New Asset
  const [newAsset, setNewAsset] = useState<Partial<PortfolioItem>>({
    restaurantName: '',
    date: '',
    time: '',
    guests: 2,
    costBasis: 0,
    listPrice: 0,
    platform: 'Resy',
    status: 'ACQUIRED'
  });

  // Stats Calculation
  const totalRevenue = items.reduce((acc, item) => acc + (item.soldPrice || 0), 0);
  const totalCost = items.reduce((acc, item) => acc + item.costBasis, 0);
  const netProfit = totalRevenue - totalCost;
  // Only count assets we actually OWN (Acquired or Listed) in the inventory value
  const activeValue = items
    .filter(i => i.status === 'LISTED' || i.status === 'ACQUIRED')
    .reduce((acc, i) => acc + i.listPrice, 0);

  const toggleDropdown = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenDropdownId(openDropdownId === id ? null : id);
  };

  const handleOpenTransfer = (item: PortfolioItem) => {
    setSelectedItem(item);
    setShowTransferModal(true);
  };

  const handleStatusChange = (item: PortfolioItem, newStatus: AssetStatus) => {
    setOpenDropdownId(null); // Close dropdown
    
    // If moving to PENDING or SOLD, and no price is set, ask for it
    if ((newStatus === 'PENDING' || newStatus === 'SOLD') && !item.soldPrice) {
      setItemToSell(item);
      setSoldPriceInput(item.listPrice); // Default to list price
      setShowSoldModal(true);
    } else {
      onUpdateItem({ ...item, status: newStatus });
    }
  };
  
  const [targetStatus, setTargetStatus] = useState<AssetStatus>('SOLD');

  const handleStatusClick = (item: PortfolioItem, status: AssetStatus) => {
      setOpenDropdownId(null);
      if ((status === 'PENDING' || status === 'SOLD') && !item.soldPrice) {
          setItemToSell(item);
          setTargetStatus(status);
          setSoldPriceInput(item.listPrice);
          setShowSoldModal(true);
      } else {
          onUpdateItem({ ...item, status });
      }
  }

  const confirmSale = () => {
    if (itemToSell) {
      onUpdateItem({ 
          ...itemToSell, 
          status: targetStatus, 
          soldPrice: soldPriceInput 
      });
      setShowSoldModal(false);
      setItemToSell(null);
    }
  };

  const handleDeleteClick = (item: PortfolioItem) => {
      setItemToDelete(item);
      setShowDeleteModal(true);
  };

  const confirmDelete = () => {
      if (itemToDelete) {
          onDeleteItem(itemToDelete.id);
          setShowDeleteModal(false);
          setItemToDelete(null);
      }
  };

  const handleSaveAsset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAsset.restaurantName || !newAsset.date || !newAsset.time) return;

    const asset: PortfolioItem = {
      id: Math.random().toString(36).substr(2, 9),
      restaurantName: newAsset.restaurantName || 'Unknown',
      date: newAsset.date || '',
      time: newAsset.time || '',
      guests: newAsset.guests || 2,
      costBasis: newAsset.costBasis || 0,
      listPrice: newAsset.listPrice || 0,
      platform: newAsset.platform || 'Resy',
      status: 'ACQUIRED' // Default for new log
    };

    onAddItem(asset);
    setShowAddModal(false);
    // Reset form
    setNewAsset({
      restaurantName: '',
      date: '',
      time: '',
      guests: 2,
      costBasis: 0,
      listPrice: 0,
      platform: 'Resy',
      status: 'ACQUIRED'
    });
  };

  const getStatusColor = (status: AssetStatus) => {
    switch (status) {
      case 'WATCHING': return 'bg-slate-800 border-slate-600 text-slate-400 border-dashed';
      case 'ACQUIRED': return 'bg-slate-800 text-slate-300 border-slate-700';
      case 'LISTED': return 'bg-amber-900/30 text-amber-400 border-amber-900/50';
      case 'PENDING': return 'bg-indigo-900/30 text-indigo-400 border-indigo-900/50';
      case 'SOLD': return 'bg-emerald-900/30 text-emerald-400 border-emerald-900/50';
      case 'TRANSFERRED': return 'bg-purple-900/30 text-purple-400 border-purple-900/50';
    }
  };

  const generateTransferScript = (item: PortfolioItem) => {
    return `Hi, I have a reservation at ${item.restaurantName} for ${item.guests} guests on ${item.date} at ${item.time}.

I would like to transfer this reservation to my colleague, ${item.guestName || '[GUEST NAME]'}, who will be dining instead of me.

Please update the host notes accordingly. Thank you.`;
  };

  return (
    <div className="space-y-6" onClick={() => setOpenDropdownId(null)}>
      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex flex-col">
          <span className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-1">Net Profit (MTD)</span>
          <div className="flex items-center gap-2 text-2xl font-mono font-bold text-white">
            <span className="text-emerald-500">+</span>${netProfit.toLocaleString()}
          </div>
        </div>
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex flex-col">
          <span className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-1">Active Inventory</span>
          <div className="flex items-center gap-2 text-2xl font-mono font-bold text-white">
            <Wallet className="w-5 h-5 text-amber-500" />
            ${activeValue.toLocaleString()}
          </div>
        </div>
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex flex-col">
          <span className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-1">Total Listings</span>
          <div className="flex items-center gap-2 text-2xl font-mono font-bold text-white">
            {items.filter(i => i.status === 'LISTED').length}
          </div>
        </div>
        <div 
            onClick={(e) => { e.stopPropagation(); setShowAddModal(true); }}
            className="bg-emerald-900/10 p-4 rounded-xl border border-emerald-900/30 flex items-center justify-center cursor-pointer hover:bg-emerald-900/20 transition-colors group"
        >
            <div className="flex flex-col items-center">
                <Plus className="w-6 h-6 text-emerald-500 mb-1 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-bold text-emerald-400">LOG NEW ASSET</span>
            </div>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-amber-500" />
            Portfolio Holdings
          </h3>
        </div>
        <div className="overflow-x-auto pb-24"> 
          <table className="w-full text-left text-sm text-slate-400">
            <thead className="bg-slate-950 text-xs uppercase font-medium text-slate-500">
              <tr>
                <th className="px-6 py-4">Asset</th>
                <th className="px-6 py-4">Details</th>
                <th className="px-6 py-4">Cost Basis</th>
                <th className="px-6 py-4">List Price</th>
                <th className="px-6 py-4 flex items-center gap-2">
                    Status
                    <div className="group/tooltip relative">
                        <HelpCircle className="w-3.5 h-3.5 text-slate-600 cursor-help" />
                        <div className="absolute left-0 top-full mt-2 w-56 bg-slate-950 border border-slate-800 p-3 rounded shadow-xl text-[10px] text-slate-300 z-50 hidden group-hover/tooltip:block pointer-events-none normal-case leading-relaxed">
                            <span className="block mb-1"><strong className="text-indigo-400">PENDING:</strong> Buyer paid. Transfer needed immediately.</span>
                            <span className="block"><strong className="text-emerald-400">SOLD:</strong> Name change complete. Deal closed.</span>
                        </div>
                    </div>
                </th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {items.length === 0 ? (
                  <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-600">
                          No assets tracked. Log a new asset or track one from the Market Intelligence feed.
                      </td>
                  </tr>
              ) : items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-white">{item.restaurantName}</div>
                    <div className="text-xs opacity-60">{item.platform}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3 h-3" />
                      {item.date} @ {item.time}
                    </div>
                    <div className="text-xs mt-1">{item.guests} Guests</div>
                  </td>
                  <td className="px-6 py-4 font-mono text-slate-300">
                      <input 
                        type="number" 
                        onClick={(e) => e.stopPropagation()}
                        className="bg-transparent w-20 border-b border-transparent hover:border-slate-600 focus:border-emerald-500 outline-none"
                        value={item.costBasis}
                        onChange={(e) => onUpdateItem({...item, costBasis: parseFloat(e.target.value) || 0})}
                      />
                  </td>
                  <td className="px-6 py-4 font-mono text-white">
                    {(item.status === 'SOLD' || item.status === 'TRANSFERRED' || item.status === 'PENDING') && item.soldPrice ? (
                        <span className="text-emerald-400 flex items-center gap-1">
                            ${item.soldPrice} <CheckCircle2 className="w-3 h-3" />
                        </span>
                    ) : (
                        <span>${item.listPrice}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 relative">
                    <div className="inline-block">
                        <button 
                            onClick={(e) => toggleDropdown(item.id, e)}
                            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase border ${getStatusColor(item.status)} hover:brightness-110 transition-all`}
                        >
                            {item.status}
                            <ChevronDown className="w-3 h-3" />
                        </button>
                        
                        {/* Dropdown Menu - Click Triggered */}
                        {openDropdownId === item.id && (
                            <div className="absolute left-6 top-10 mt-1 w-36 bg-slate-950 border border-slate-700 rounded shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100">
                                {['WATCHING', 'ACQUIRED', 'LISTED', 'PENDING', 'SOLD', 'TRANSFERRED'].map((s) => (
                                    <button
                                        key={s}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleStatusClick(item, s as AssetStatus);
                                        }}
                                        className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-white first:rounded-t last:rounded-b"
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                        {item.status === 'PENDING' && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleOpenTransfer(item); }}
                                className="text-xs bg-amber-900/30 hover:bg-amber-900/50 text-amber-500 hover:text-amber-400 px-3 py-1.5 rounded border border-amber-900/50 flex items-center gap-1 animate-pulse"
                            >
                                <AlertCircle className="w-3 h-3" />
                                Action Needed
                            </button>
                        )}
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteClick(item); }}
                            className="p-2 text-slate-600 hover:text-red-400 hover:bg-red-900/10 rounded transition-colors"
                            title="Delete Asset"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transfer Protocol Modal */}
      {showTransferModal && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setShowTransferModal(false)}>
            <div className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b border-slate-800 flex justify-between items-center">
                    <h3 className="font-bold text-white flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-amber-500" />
                        Transfer Protocol
                    </h3>
                    <button onClick={() => setShowTransferModal(false)} className="text-slate-500 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="bg-amber-900/20 border border-amber-900/50 p-3 rounded text-xs text-amber-200 leading-relaxed">
                        <span className="font-bold block mb-1">CX WARNING:</span>
                        Always call the restaurant to verbally confirm the name change. Use this script for email confirmation immediately after the call.
                    </div>
                    
                    <div>
                        <label className="text-xs text-slate-500 font-bold uppercase mb-2 block">Buyer Name</label>
                        <input 
                            type="text" 
                            className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white text-sm focus:ring-1 focus:ring-amber-500 outline-none"
                            defaultValue={selectedItem.guestName} 
                        />
                    </div>

                    <div>
                        <label className="text-xs text-slate-500 font-bold uppercase mb-2 block">Generated Script</label>
                        <textarea 
                            readOnly
                            className="w-full h-32 bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-300 text-sm font-mono focus:ring-1 focus:ring-amber-500 outline-none resize-none"
                            value={generateTransferScript(selectedItem)}
                        />
                    </div>
                </div>
                <div className="p-5 border-t border-slate-800 flex justify-end gap-3">
                    <button 
                        onClick={() => setShowTransferModal(false)}
                        className="px-4 py-2 text-sm text-slate-400 hover:text-white"
                    >
                        Cancel
                    </button>
                    <button 
                        className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium flex items-center gap-2"
                        onClick={() => {
                            setShowTransferModal(false);
                            // Optionally update status to TRANSFERRED here automatically?
                            // For now let user do it manually via dropdown
                        }}
                    >
                        <Copy className="w-4 h-4" />
                        Copy to Clipboard
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Add Asset Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setShowAddModal(false)}>
            <div className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b border-slate-800 flex justify-between items-center">
                    <h3 className="font-bold text-white flex items-center gap-2">
                        <Plus className="w-4 h-4 text-emerald-500" />
                        Log New Asset
                    </h3>
                    <button onClick={() => setShowAddModal(false)} className="text-slate-500 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <form onSubmit={handleSaveAsset} className="p-6 space-y-4">
                    <div>
                        <label className="text-xs text-slate-500 font-bold uppercase mb-1 block">Restaurant</label>
                        <input 
                            type="text" 
                            required
                            placeholder="e.g. Carbone"
                            className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white text-sm focus:ring-1 focus:ring-emerald-500 outline-none"
                            value={newAsset.restaurantName}
                            onChange={e => setNewAsset({...newAsset, restaurantName: e.target.value})}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-slate-500 font-bold uppercase mb-1 block">Date</label>
                            <input 
                                type="date" 
                                required
                                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white text-sm focus:ring-1 focus:ring-emerald-500 outline-none [color-scheme:dark]"
                                value={newAsset.date}
                                onChange={e => setNewAsset({...newAsset, date: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="text-xs text-slate-500 font-bold uppercase mb-1 block">Time</label>
                            <input 
                                type="time" 
                                required
                                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white text-sm focus:ring-1 focus:ring-emerald-500 outline-none [color-scheme:dark]"
                                value={newAsset.time}
                                onChange={e => setNewAsset({...newAsset, time: e.target.value})}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label className="text-xs text-slate-500 font-bold uppercase mb-1 block">Guest Count</label>
                            <input 
                                type="number" 
                                min="1"
                                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white text-sm focus:ring-1 focus:ring-emerald-500 outline-none"
                                value={newAsset.guests}
                                onChange={e => setNewAsset({...newAsset, guests: parseInt(e.target.value)})}
                            />
                        </div>
                        <div>
                            <label className="text-xs text-slate-500 font-bold uppercase mb-1 block">Source Platform</label>
                            <select 
                                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white text-sm focus:ring-1 focus:ring-emerald-500 outline-none"
                                value={newAsset.platform}
                                onChange={e => setNewAsset({...newAsset, platform: e.target.value})}
                            >
                                <option value="Resy">Resy</option>
                                <option value="OpenTable">OpenTable</option>
                                <option value="Tock">Tock</option>
                                <option value="SevenRooms">SevenRooms</option>
                                <option value="AppointmentTrader">Appointment Trader</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-2">
                        <div>
                            <label className="text-xs text-slate-500 font-bold uppercase mb-1 block">Cost Basis ($)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-2 text-slate-500 text-sm">$</span>
                                <input 
                                    type="number" 
                                    min="0"
                                    className="w-full bg-slate-950 border border-slate-700 rounded pl-6 pr-3 py-2 text-white text-sm focus:ring-1 focus:ring-emerald-500 outline-none"
                                    value={newAsset.costBasis}
                                    onChange={e => setNewAsset({...newAsset, costBasis: parseFloat(e.target.value)})}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-slate-500 font-bold uppercase mb-1 block">Target List Price ($)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-2 text-slate-500 text-sm">$</span>
                                <input 
                                    type="number" 
                                    min="0"
                                    className="w-full bg-slate-950 border border-slate-700 rounded pl-6 pr-3 py-2 text-white text-sm focus:ring-1 focus:ring-emerald-500 outline-none"
                                    value={newAsset.listPrice}
                                    onChange={e => setNewAsset({...newAsset, listPrice: parseFloat(e.target.value)})}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                        <button 
                            type="button"
                            onClick={() => setShowAddModal(false)}
                            className="px-4 py-2 text-sm text-slate-400 hover:text-white"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit"
                            className="px-6 py-2 text-sm bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium flex items-center gap-2 shadow-lg shadow-emerald-900/20"
                        >
                            <Save className="w-4 h-4" />
                            Log Asset
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* Sold Price Modal */}
      {showSoldModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setShowSoldModal(false)}>
            <div className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                <div className="p-5">
                    <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-emerald-500" />
                        Confirm Transaction Price
                    </h3>
                    <label className="text-xs text-slate-500 font-bold uppercase mb-2 block">Final Transaction Amount</label>
                    <div className="relative mb-6">
                        <span className="absolute left-3 top-2 text-slate-500 text-lg">$</span>
                        <input 
                            type="number" 
                            autoFocus
                            className="w-full bg-slate-950 border border-slate-700 rounded pl-6 pr-3 py-2 text-white text-lg focus:ring-1 focus:ring-emerald-500 outline-none"
                            value={soldPriceInput}
                            onChange={e => setSoldPriceInput(parseFloat(e.target.value))}
                        />
                    </div>
                    <div className="flex justify-end gap-3">
                        <button 
                            onClick={() => {
                                setShowSoldModal(false);
                                setItemToSell(null);
                            }}
                            className="px-4 py-2 text-sm text-slate-400 hover:text-white"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={confirmSale}
                            className="px-6 py-2 text-sm bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold"
                        >
                            Confirm Sale
                        </button>
                    </div>
                </div>
            </div>
          </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && itemToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setShowDeleteModal(false)}>
            <div className="bg-slate-900 rounded-xl border border-red-900/50 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                <div className="p-5">
                    <h3 className="font-bold text-white mb-2 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                        Confirm Deletion
                    </h3>
                    <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                        Are you sure you want to remove <strong className="text-white">{itemToDelete.restaurantName}</strong> from your portfolio? This action cannot be undone.
                    </p>
                    <div className="flex justify-end gap-3">
                        <button 
                            onClick={() => {
                                setShowDeleteModal(false);
                                setItemToDelete(null);
                            }}
                            className="px-4 py-2 text-sm text-slate-400 hover:text-white"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={confirmDelete}
                            className="px-6 py-2 text-sm bg-red-600 hover:bg-red-500 text-white rounded font-bold shadow-lg shadow-red-900/20"
                        >
                            Delete Asset
                        </button>
                    </div>
                </div>
            </div>
          </div>
      )}
    </div>
  );
};

export default PortfolioManager;
