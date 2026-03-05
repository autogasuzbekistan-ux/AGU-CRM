import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Filter, UserPlus, Clock, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const STATUS_CONFIG = {
  new:        { label: 'Yangi', color: 'badge-blue', icon: UserPlus },
  processing: { label: 'Jarayonda', color: 'badge-yellow', icon: Clock },
  qualified:  { label: 'Malakali', color: 'badge-purple', icon: CheckCircle },
  converted:  { label: 'Konvertlandi', color: 'badge-green', icon: CheckCircle },
  rejected:   { label: 'Rad etildi', color: 'badge-red', icon: XCircle },
};

const SOURCE_ICONS = {
  telegram: '✈️', whatsapp: '📱', instagram: '📸',
  facebook: '👥', manual: '✏️', website: '🌐', referral: '🤝',
};

export default function LeadsPage() {
  const [filter, setFilter] = useState({ status: '', source: '' });
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium' });
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['leads', filter],
    queryFn: () => {
      const params = new URLSearchParams(filter).toString();
      return api.get(`/leads?${params}`).then((r) => r.data);
    },
  });

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/leads', data),
    onSuccess: () => {
      qc.invalidateQueries(['leads']);
      setShowCreate(false);
      setForm({ title: '', description: '', priority: 'medium' });
      toast.success('Lead yaratildi');
    },
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }) => api.patch(`/leads/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries(['leads']),
  });

  const leads = data?.data || [];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leadlar</h1>
          <p className="text-gray-500 text-sm mt-1">{data?.meta?.total || 0} ta lead</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus size={16} /> Yangi lead
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <select
          className="input w-auto"
          value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value })}
        >
          <option value="">Barcha status</option>
          {Object.entries(STATUS_CONFIG).map(([key, val]) => (
            <option key={key} value={key}>{val.label}</option>
          ))}
        </select>
        <select
          className="input w-auto"
          value={filter.source}
          onChange={(e) => setFilter({ ...filter, source: e.target.value })}
        >
          <option value="">Barcha manba</option>
          {Object.keys(SOURCE_ICONS).map((s) => (
            <option key={s} value={s}>{SOURCE_ICONS[s]} {s}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left py-3 px-4 font-medium text-gray-600">Sarlavha</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600">Manba</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600">Operator</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600">Sana</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600">Amal</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">Yuklanmoqda...</td></tr>
            ) : leads.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">Lead topilmadi</td></tr>
            ) : leads.map((lead) => {
              const cfg = STATUS_CONFIG[lead.status] || STATUS_CONFIG.new;
              return (
                <tr key={lead.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="py-3 px-4">
                    <div>
                      <p className="font-medium text-gray-900">{lead.title}</p>
                      {lead.contact_name && <p className="text-xs text-gray-400">{lead.contact_name}</p>}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-lg" title={lead.source}>{SOURCE_ICONS[lead.source] || '❓'}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={cfg.color}>{cfg.label}</span>
                  </td>
                  <td className="py-3 px-4 text-gray-600">{lead.assigned_name || '—'}</td>
                  <td className="py-3 px-4 text-gray-400 text-xs">
                    {new Date(lead.created_at).toLocaleDateString('uz-UZ')}
                  </td>
                  <td className="py-3 px-4">
                    {lead.status === 'new' && (
                      <button
                        onClick={() => updateStatus.mutate({ id: lead.id, status: 'processing' })}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Boshlash
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">Yangi lead</h2>
            <div className="space-y-4">
              <div>
                <label className="label">Sarlavha *</label>
                <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <label className="label">Tavsif</label>
                <textarea className="input h-24 resize-none" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div>
                <label className="label">Ustuvorlik</label>
                <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  <option value="low">Past</option>
                  <option value="medium">O'rta</option>
                  <option value="high">Yuqori</option>
                  <option value="urgent">Shoshilinch</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button className="btn-secondary flex-1" onClick={() => setShowCreate(false)}>Bekor</button>
              <button className="btn-primary flex-1" onClick={() => createMutation.mutate(form)} disabled={!form.title || createMutation.isPending}>
                {createMutation.isPending ? 'Yaratilmoqda...' : 'Yaratish'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
