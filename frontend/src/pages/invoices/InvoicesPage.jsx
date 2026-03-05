/**
 * AGU CRM — Hisob-faktura (Invoice) sahifasi
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, FileText, Send, CheckCircle, X, ExternalLink, Copy } from 'lucide-react';
import api from '../../api/axios';
import { formatUZS } from '../../utils/format';
import toast from 'react-hot-toast';

const STATUS_CONFIG = {
  draft:     { label: 'Qoralama',   color: 'badge-gray' },
  sent:      { label: 'Yuborildi',  color: 'badge-blue' },
  paid:      { label: 'To\'landi',  color: 'badge-green' },
  cancelled: { label: 'Bekor',      color: 'badge-red' },
  expired:   { label: 'Muddati o\'tdi', color: 'badge-yellow' },
};

const PROVIDER_ICONS = {
  payme:    '💳 Payme',
  click:    '🖱️ Click',
  cash:     '💵 Naqd',
  transfer: '🏦 O\'tkazma',
  manual:   '✏️ Qo\'lda',
};

function CreateInvoiceModal({ onClose }) {
  const [form, setForm] = useState({
    title: '', amount: '', currency: 'UZS',
    deal_id: '', contact_id: '', payment_provider: 'payme',
    notes: '', due_date: '',
    items: [{ name: '', qty: 1, price: '', total: '' }],
  });
  const qc = useQueryClient();

  const { data: contacts } = useQuery({
    queryKey: ['contacts-list'],
    queryFn: () => api.get('/contacts?limit=100').then((r) => r.data.data),
    staleTime: 60_000,
  });

  const { data: deals } = useQuery({
    queryKey: ['deals-list'],
    queryFn: () => api.get('/deals?limit=100').then((r) => r.data.data),
    staleTime: 60_000,
  });

  const updateItem = (i, field, val) => {
    const items = [...form.items];
    items[i] = { ...items[i], [field]: val };
    if (field === 'qty' || field === 'price') {
      items[i].total = (parseFloat(items[i].qty || 0) * parseFloat(items[i].price || 0)).toFixed(0);
    }
    const totalAmount = items.reduce((s, it) => s + parseFloat(it.total || 0), 0);
    setForm({ ...form, items, amount: totalAmount > 0 ? totalAmount : form.amount });
  };

  const createMutation = useMutation({
    mutationFn: () => api.post('/invoices', {
      ...form,
      amount: parseFloat(form.amount),
      deal_id: form.deal_id || undefined,
      contact_id: form.contact_id || undefined,
      due_date: form.due_date || undefined,
    }),
    onSuccess: () => { qc.invalidateQueries(['invoices']); toast.success('Faktura yaratildi'); onClose(); },
    onError: (e) => toast.error(e.response?.data?.message || 'Xato'),
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="font-bold text-gray-900">Yangi hisob-faktura</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="label">Sarlavha *</label>
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Masalan: Mahsulot yetkazib berish" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Kontakt</label>
              <select className="input" value={form.contact_id} onChange={(e) => setForm({ ...form, contact_id: e.target.value })}>
                <option value="">Tanlang...</option>
                {(contacts || []).map((c) => (
                  <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Bitim</label>
              <select className="input" value={form.deal_id} onChange={(e) => setForm({ ...form, deal_id: e.target.value })}>
                <option value="">Tanlang...</option>
                {(deals || []).map((d) => (
                  <option key={d.id} value={d.id}>{d.title}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Mahsulotlar/Xizmatlar</label>
              <button
                onClick={() => setForm({ ...form, items: [...form.items, { name: '', qty: 1, price: '', total: '' }] })}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                + Qo'shish
              </button>
            </div>
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">Nomi</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600 w-16">Miqdor</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600 w-28">Narx</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600 w-28">Jami</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((item, i) => (
                    <tr key={i} className="border-t border-gray-50">
                      <td className="py-1 px-2">
                        <input className="input py-1" value={item.name} onChange={(e) => updateItem(i, 'name', e.target.value)} placeholder="Mahsulot nomi" />
                      </td>
                      <td className="py-1 px-2">
                        <input type="number" className="input py-1" value={item.qty} onChange={(e) => updateItem(i, 'qty', e.target.value)} min="1" />
                      </td>
                      <td className="py-1 px-2">
                        <input type="number" className="input py-1" value={item.price} onChange={(e) => updateItem(i, 'price', e.target.value)} placeholder="0" />
                      </td>
                      <td className="py-1 px-2">
                        <span className="text-gray-600">{Number(item.total || 0).toLocaleString('uz-UZ')}</span>
                      </td>
                      <td className="py-1 px-2">
                        <button onClick={() => setForm({ ...form, items: form.items.filter((_, j) => j !== i) })} className="text-gray-300 hover:text-red-400">×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Umumiy summa (UZS) *</label>
              <input type="number" className="input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0" />
            </div>
            <div>
              <label className="label">To'lov usuli</label>
              <select className="input" value={form.payment_provider} onChange={(e) => setForm({ ...form, payment_provider: e.target.value })}>
                {Object.entries(PROVIDER_ICONS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label">To'lov muddati</label>
            <input type="date" className="input" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          </div>

          <div>
            <label className="label">Izoh</label>
            <textarea className="input h-16 resize-none" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>

        <div className="border-t px-6 py-4 flex gap-3">
          <button className="btn-secondary flex-1" onClick={onClose}>Bekor</button>
          <button
            className="btn-primary flex-1"
            onClick={() => createMutation.mutate()}
            disabled={!form.title || !form.amount || createMutation.isPending}
          >
            {createMutation.isPending ? 'Yaratilmoqda...' : 'Yaratish'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function InvoicesPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', filterStatus],
    queryFn: () => api.get(`/invoices?${filterStatus ? `status=${filterStatus}` : ''}`).then((r) => r.data.data),
  });

  const sendMutation = useMutation({
    mutationFn: (id) => api.post(`/invoices/${id}/send`),
    onSuccess: () => { qc.invalidateQueries(['invoices']); toast.success('Faktura yuborildi'); },
    onError: (e) => toast.error(e.response?.data?.message || 'Xato'),
  });

  const markPaidMutation = useMutation({
    mutationFn: (id) => api.patch(`/invoices/${id}/mark-paid`),
    onSuccess: () => { qc.invalidateQueries(['invoices']); toast.success('To\'landi deb belgilandi'); },
  });

  const invoices = data || [];
  const totalPaid = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + parseFloat(i.amount || 0), 0);
  const totalPending = invoices.filter((i) => ['draft', 'sent'].includes(i.status)).reduce((s, i) => s + parseFloat(i.amount || 0), 0);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText size={24} className="text-green-500" /> Hisob-fakturalar
          </h1>
          <p className="text-gray-500 text-sm mt-1">{invoices.length} ta faktura</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus size={16} /> Yangi faktura
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">To'langan</p>
          <p className="text-xl font-bold text-green-600">{formatUZS(totalPaid)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">Kutilmoqda</p>
          <p className="text-xl font-bold text-blue-600">{formatUZS(totalPending)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">Jami faktura</p>
          <p className="text-xl font-bold text-gray-900">{invoices.length}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {['', 'draft', 'sent', 'paid', 'cancelled'].map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-all ${
              filterStatus === s ? 'bg-primary-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {s === '' ? 'Barchasi' : STATUS_CONFIG[s]?.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left py-3 px-4 font-medium text-gray-600">Raqam</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600">Sarlavha</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600">Kontakt</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600">Summa</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600">Muddat</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600">Amal</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">Yuklanmoqda...</td></tr>
            ) : invoices.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">Faktura topilmadi</td></tr>
            ) : invoices.map((inv) => {
              const cfg = STATUS_CONFIG[inv.status] || STATUS_CONFIG.draft;
              const isOverdue = inv.due_date && new Date(inv.due_date) < new Date() && inv.status !== 'paid';
              return (
                <tr key={inv.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="py-3 px-4 font-mono text-xs text-gray-500">{inv.invoice_number}</td>
                  <td className="py-3 px-4">
                    <p className="font-medium text-gray-900">{inv.title}</p>
                    <p className="text-xs text-gray-400">{PROVIDER_ICONS[inv.payment_provider]}</p>
                  </td>
                  <td className="py-3 px-4 text-gray-600">{inv.contact_name || '—'}</td>
                  <td className="py-3 px-4 font-semibold text-gray-900">{formatUZS(inv.amount)}</td>
                  <td className="py-3 px-4"><span className={cfg.color}>{cfg.label}</span></td>
                  <td className="py-3 px-4">
                    {inv.due_date ? (
                      <span className={`text-xs ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                        {isOverdue && '⚠️ '}
                        {new Date(inv.due_date).toLocaleDateString('uz-UZ')}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1">
                      {inv.payment_url && (
                        <>
                          <a href={inv.payment_url} target="_blank" rel="noopener noreferrer"
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600" title="To'lov havolasi">
                            <ExternalLink size={13} />
                          </a>
                          <button
                            onClick={() => { navigator.clipboard.writeText(inv.payment_url); toast.success('Nusxalandi'); }}
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500" title="Nusxalash"
                          >
                            <Copy size={13} />
                          </button>
                        </>
                      )}
                      {inv.status === 'draft' && (
                        <button
                          onClick={() => sendMutation.mutate(inv.id)}
                          className="p-1.5 rounded-lg hover:bg-primary-50 text-primary-600" title="Yuborish"
                        >
                          <Send size={13} />
                        </button>
                      )}
                      {['draft', 'sent'].includes(inv.status) && (
                        <button
                          onClick={() => markPaidMutation.mutate(inv.id)}
                          className="p-1.5 rounded-lg hover:bg-green-50 text-green-600" title="To'landi deb belgilash"
                        >
                          <CheckCircle size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showCreate && <CreateInvoiceModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
