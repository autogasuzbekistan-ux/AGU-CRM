import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Phone, MessageCircle, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import { formatPhone } from '../../utils/format';
import toast from 'react-hot-toast';

const SOURCE_ICONS = { telegram: '✈️', whatsapp: '📱', instagram: '📸', facebook: '👥', manual: '✏️' };

export default function ContactsPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState({ status: '', source: '' });
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', email: '', source: 'manual' });
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['contacts', filter, search, page],
    queryFn: () => {
      const p = new URLSearchParams({ ...filter, search, page, limit: 25 }).toString();
      return api.get(`/contacts?${p}`).then((r) => r.data);
    },
  });

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/contacts', data),
    onSuccess: () => {
      qc.invalidateQueries(['contacts']);
      setShowCreate(false);
      setForm({ firstName: '', lastName: '', phone: '', email: '', source: 'manual' });
      toast.success('Mijoz qo\'shildi');
    },
  });

  const contacts = data?.data || [];
  const total = data?.meta?.total || 0;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mijozlar</h1>
          <p className="text-gray-500 text-sm mt-1">{total} ta mijoz</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus size={16} /> Yangi mijoz
        </button>
      </div>

      {/* Search & filter */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Ism, telefon, email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select className="input w-auto" value={filter.source} onChange={(e) => setFilter({ ...filter, source: e.target.value })}>
          <option value="">Barcha manba</option>
          {Object.entries(SOURCE_ICONS).map(([k, v]) => <option key={k} value={k}>{v} {k}</option>)}
        </select>
        <select className="input w-auto" value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}>
          <option value="">Barcha status</option>
          <option value="active">Faol</option>
          <option value="inactive">Faol emas</option>
        </select>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="w-12 h-12 bg-gray-200 rounded-full mb-3" />
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
            </div>
          ))
        ) : contacts.map((c) => (
          <Link to={`/contacts/${c.id}`} key={c.id} className="card p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold shrink-0">
                {c.first_name?.[0] || c.company_name?.[0] || '?'}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-gray-900 truncate">
                  {c.first_name} {c.last_name}
                </p>
                {c.company_name && <p className="text-xs text-gray-400 truncate">{c.company_name}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              {c.phone && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Phone size={12} className="text-gray-400 shrink-0" />
                  <span className="truncate">{formatPhone(c.phone)}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  {SOURCE_ICONS[c.source] || '❓'} {c.source}
                </span>
                {c.total_deals > 0 && (
                  <span className="badge badge-blue text-xs">{c.total_deals} bitim</span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Pagination */}
      {total > 25 && (
        <div className="flex justify-center gap-2 mt-6">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary">← Oldingi</button>
          <span className="px-4 py-2 text-sm text-gray-600">{page} / {Math.ceil(total / 25)}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page * 25 >= total} className="btn-secondary">Keyingi →</button>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">Yangi mijoz</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Ism</label>
                  <input className="input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
                </div>
                <div>
                  <label className="label">Familiya</label>
                  <input className="input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label">Telefon</label>
                <input className="input" placeholder="+998901234567" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <label className="label">Manba</label>
                <select className="input" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
                  {Object.entries(SOURCE_ICONS).map(([k, v]) => <option key={k} value={k}>{v} {k}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button className="btn-secondary flex-1" onClick={() => setShowCreate(false)}>Bekor</button>
              <button className="btn-primary flex-1" onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Saqlanmoqda...' : 'Saqlash'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
