// src/pages/NfcCards.tsx
import React, { useState, useMemo } from 'react';
import {
  CreditCard,
  User,
  Plus,
  Trash2,
  Edit2,
  Search,
  CheckCircle,
  Copy,
  AlertCircle,
} from 'lucide-react';
import { useNfcCards } from '../hooks/useNfcCards';
import { useDrivers } from '../hooks/useDrivers';
import {
  addOrUpdateNfcCard,
  deleteNfcCard,
  toggleNfcCardStatus,
} from '../firebase/nfcService';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import LoadingState from '../components/LoadingState';

export default function NfcCards() {
  const { cardList, loading } = useNfcCards();
  const { drivers } = useDrivers();
  const { addToast } = useToast();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    cardId: '',
    driverId: '',
    enabled: true,
    cardName: '',
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete confirmation
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Quick driver options from registered/active drivers
  const driverOptions = useMemo(() => {
    const list = Array.from(new Set(drivers.map((d) => d.driverId))).filter(Boolean);
    if (!list.includes('DRIVER_001')) list.unshift('DRIVER_001');
    return list;
  }, [drivers]);

  const filteredCards = useMemo(() => {
    return cardList.filter((card) => {
      const matchesSearch =
        card.id.toLowerCase().includes(search.toLowerCase()) ||
        card.driverId.toLowerCase().includes(search.toLowerCase()) ||
        (card.cardName && card.cardName.toLowerCase().includes(search.toLowerCase()));

      if (!matchesSearch) return false;

      if (filter === 'assigned') return !!card.driverId;
      if (filter === 'unassigned') return !card.driverId;
      return true;
    });
  }, [cardList, search, filter]);

  const handleOpenAdd = () => {
    setEditingCardId(null);
    setFormData({
      cardId: '',
      driverId: driverOptions[0] || 'DRIVER_001',
      enabled: true,
      cardName: '',
      notes: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (card: (typeof cardList)[0]) => {
    setEditingCardId(card.id);
    setFormData({
      cardId: card.id,
      driverId: card.driverId || '',
      enabled: card.enabled !== false,
      cardName: card.cardName || '',
      notes: card.notes || '',
    });
    setIsModalOpen(true);
  };

  const handleToggleEnabled = async (cardId: string, currentStatus?: boolean) => {
    try {
      const newStatus = !currentStatus;
      await toggleNfcCardStatus(cardId, newStatus);
      addToast({
        title: newStatus ? 'Card Enabled' : 'Card Disabled',
        message: `Card ${cardId} is now ${newStatus ? 'active' : 'disabled for PN532 hardware'} in Firebase RTDB`,
        type: newStatus ? 'success' : 'warning',
      });
    } catch (err) {
      addToast({
        title: 'Status Update Failed',
        message: (err as Error).message || 'Failed to update card status',
        type: 'error',
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.cardId.trim()) {
      addToast({
        title: 'Validation Error',
        message: 'NFC Card ID is required',
        type: 'error',
      });
      return;
    }

    try {
      setIsSubmitting(true);
      await addOrUpdateNfcCard(formData.cardId, {
        driverId: formData.driverId,
        enabled: formData.enabled,
        cardName: formData.cardName,
        notes: formData.notes,
      });

      addToast({
        title: editingCardId ? 'NFC Card Updated' : 'NFC Card Created',
        message: `Card ${formData.cardId} saved directly to Firebase RTDB (/nfc_cards/${formData.cardId})`,
        type: 'success',
      });

      setIsModalOpen(false);
    } catch (err) {
      addToast({
        title: 'Save Failed',
        message: (err as Error).message || 'Failed to update Firebase',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    try {
      setIsSubmitting(true);
      await deleteNfcCard(deleteTargetId);
      addToast({
        title: 'NFC Card Deleted',
        message: `Removed ${deleteTargetId} directly from Firebase RTDB`,
        type: 'info',
      });
      setDeleteTargetId(null);
    } catch (err) {
      addToast({
        title: 'Delete Failed',
        message: (err as Error).message || 'Failed to remove from Firebase',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    addToast({
      title: 'Copied to Clipboard',
      message: text,
      type: 'info',
    });
  };

  if (loading) return <LoadingState message="Loading NFC cards from Firebase..." />;

  const totalAssigned = cardList.filter((c) => !!c.driverId).length;
  const totalUnassigned = cardList.length - totalAssigned;

  return (
    <div className="space-y-6">
      {/* Header with Title and Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-100">NFC Cards</h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              Live Firebase Sync
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Manage physical NFC tags for driver authentication & truck check-ins
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium text-sm rounded-xl shadow-lg shadow-cyan-500/20 transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Add NFC Card</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Total Registered Cards</p>
            <p className="text-2xl font-bold text-slate-100 mt-1 font-mono">{cardList.length}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <CreditCard className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Assigned to Drivers</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1 font-mono">{totalAssigned}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Unassigned / Spare</p>
            <p className="text-2xl font-bold text-amber-400 mt-1 font-mono">{totalUnassigned}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Card UID, Driver ID, or Name..."
            className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition-colors font-medium ${
              filter === 'all' ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All ({cardList.length})
          </button>
          <button
            onClick={() => setFilter('assigned')}
            className={`px-3 py-1.5 rounded-lg transition-colors font-medium ${
              filter === 'assigned' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Assigned ({totalAssigned})
          </button>
          <button
            onClick={() => setFilter('unassigned')}
            className={`px-3 py-1.5 rounded-lg transition-colors font-medium ${
              filter === 'unassigned' ? 'bg-amber-500/20 text-amber-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Spare ({totalUnassigned})
          </button>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 overflow-hidden shadow-xl">
        {filteredCards.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto text-slate-400 mb-3">
              <CreditCard className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-200">No NFC cards found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {search || filter !== 'all'
                ? 'Try adjusting your search criteria or filter to find the card.'
                : 'Click "Add NFC Card" above to register your first card UID into Firebase.'}
            </p>
            {(!search && filter === 'all') && (
              <button
                onClick={handleOpenAdd}
                className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded-lg text-xs font-semibold transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add NFC Card
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50 bg-slate-900/40">
                  <th className="px-6 py-3.5 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    NFC Card ID (UID)
                  </th>
                  <th className="px-6 py-3.5 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Card Name / Notes
                  </th>
                  <th className="px-6 py-3.5 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Assigned Driver
                  </th>
                  <th className="px-6 py-3.5 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3.5 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {filteredCards.map((card) => {
                  const isAssigned = !!card.driverId;
                  return (
                    <tr key={card.id} className="hover:bg-slate-700/20 transition-colors group">
                      {/* Card ID */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shrink-0 shadow">
                            <CreditCard className="w-4 h-4 text-white" />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-200 font-mono tracking-wider">
                              {card.id}
                            </span>
                            <button
                              onClick={() => handleCopy(card.id)}
                              className="text-slate-500 hover:text-cyan-400 transition-colors p-1"
                              title="Copy Card ID"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Card Name / Notes */}
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-slate-200 font-medium">
                            {card.cardName || '—'}
                          </p>
                          {card.notes && (
                            <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                              {card.notes}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Driver ID */}
                      <td className="px-6 py-4">
                        {isAssigned ? (
                          <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-slate-900/60 rounded-lg border border-slate-700/60">
                            <User className="w-3.5 h-3.5 text-cyan-400" />
                            <span className="text-slate-200 font-mono text-xs font-semibold">
                              {card.driverId}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500 italic">Unassigned</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        {card.enabled === false ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                            Hardware Disabled
                          </span>
                        ) : isAssigned ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Active Driver
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-700/50 text-slate-400">
                            Spare
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleEnabled(card.id, card.enabled !== false)}
                            className={`px-2 py-1 text-xs rounded-lg border font-medium transition-colors ${
                              card.enabled === false
                                ? 'bg-red-500/20 text-red-400 border-red-500/40 hover:bg-red-500/30'
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                            }`}
                            title={card.enabled === false ? 'Click to Enable Card' : 'Click to Disable Card in Firebase'}
                          >
                            {card.enabled === false ? 'Enable' : 'Enabled'}
                          </button>
                          <button
                            onClick={() => handleOpenEdit(card)}
                            className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-700/50 rounded-lg transition-colors"
                            title="Edit Card"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTargetId(card.id)}
                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Delete Card"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCardId ? `Edit NFC Card ${editingCardId}` : 'Add New NFC Card'}
        subtitle="This directly modifies Firebase Realtime Database (/nfc_cards/{id})"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {!editingCardId && (
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-slate-400">Quick Fill:</span>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, cardId: 'D1AA8568', driverId: 'DRIVER_001', cardName: 'Truck Primary Tag' })}
                className="text-xs px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 transition-colors font-mono"
              >
                + D1AA8568 (DRIVER_001)
              </button>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              NFC Card ID (UID) <span className="text-cyan-400">*</span>
            </label>
            <input
              type="text"
              disabled={!!editingCardId}
              required
              value={formData.cardId}
              onChange={(e) => setFormData({ ...formData, cardId: e.target.value.toUpperCase() })}
              placeholder="e.g. D1AA8568 or 04A1B2C3"
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-200 font-mono placeholder-slate-500 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              The hex UID emitted when swiped on the truck's PN532 NFC reader.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Assigned Driver ID
            </label>
            <div className="space-y-2">
              <input
                type="text"
                value={formData.driverId}
                onChange={(e) => setFormData({ ...formData, driverId: e.target.value })}
                placeholder="e.g. DRV001 or DRIVER001"
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-200 font-mono placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              {driverOptions.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-slate-400">Quick pick:</span>
                  {driverOptions.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setFormData({ ...formData, driverId: opt })}
                      className={`text-[11px] font-mono px-2 py-0.5 rounded border transition-colors ${
                        formData.driverId === opt
                          ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40'
                          : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, driverId: '' })}
                    className="text-[11px] px-2 py-0.5 rounded border border-slate-700 bg-slate-800 text-slate-400 hover:text-amber-400"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Card Name / Label (Optional)
            </label>
            <input
              type="text"
              value={formData.cardName}
              onChange={(e) => setFormData({ ...formData, cardName: e.target.value })}
              placeholder="e.g. Operator Card - Shift A"
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="e.g. Issued on 2026-10-07 for East Pit operations"
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="nfcCardEnabled"
              checked={formData.enabled}
              onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
              className="w-4 h-4 rounded text-cyan-500 bg-slate-800 border-slate-700 focus:ring-0"
            />
            <label htmlFor="nfcCardEnabled" className="text-xs text-slate-300 cursor-pointer">
              Card Enabled for PN532 Hardware Authentication (/nfc_cards/{'{id}'}/enabled)
            </label>
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium text-sm rounded-xl shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Saving to Firebase...' : editingCardId ? 'Update Firebase' : 'Save to Firebase'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteTargetId}
        onClose={() => setDeleteTargetId(null)}
        title="Delete NFC Card"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            Are you sure you want to remove card{' '}
            <span className="font-mono font-bold text-red-400">{deleteTargetId}</span> from
            Firebase Realtime Database?
          </p>
          <p className="text-xs text-slate-500">
            This card will no longer authenticate drivers on any connected vehicle hardware.
          </p>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setDeleteTargetId(null)}
              className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleDelete}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-xl shadow-lg shadow-red-500/20 disabled:opacity-50"
            >
              {isSubmitting ? 'Deleting...' : 'Delete from Firebase'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
