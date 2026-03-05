/**
 * AGU CRM — Ommaviy xabar (Broadcast) sahifasi
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Radio, Send, Eye, X, Megaphone, Users, CheckCircle, XCircle, Clock } from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const STATUS_CONFIG = {
  draft:     { label: 'Qoralama', color: 'badge-gray', icon: Clock },
  scheduled: { label: 'Rejalashtirilgan', color: 'badge-blue', icon: Clock },
  sending:   { label: 'Yuborilmoqda...', color: 'badge-yellow', icon: Send },
  sent:      { label: 'Yuborildi', color: 'badge-green', icon: CheckCircle },
  cancelled: { label: 'Bekor qilindi', color: 'badge-red', icon: XCircle },
};

const CHANNEL_ICONS = {
  telegram: '✈️ Telegram',
  whatsapp: '📱 WhatsApp',
  sms:      '📨 SMS',
  all:      '📡 Barcha kanallar',
};

function CreateModal({ onClose }) {
  const [form, setForm] = useState({
    title: '', message: '', channel: 'all',
    segment_filters: { tags: [] },
    scheduled_at: '',
  });
  const [preview, setPreview] = useState(null);
  const [tagInput, setTagInput] = useState('');
  const qc = useQueryClient();

  const previewMutation = useMutation({
    mutationFn: () => api.post('/broadcasts/preview', {
      channel: form.channel,
      segment_filters: form.segment_filters,
    }).then((r) => r.data.data),
    onSuccess: (data) => setPreview(data),
  });

  const createMutation = useMutation({
    mutationFn: () => api.post('/broadcasts', {
      ...form,
      scheduled_at: form.scheduled_at || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries(['broadcasts']);
      toast.success('Broadcast yaratildi');
      onClose();
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Xato'),
  });

  const addTag = () => {
    if (!tagInput.trim()) return;
    setForm((f) => ({
      ...f,
      segment_filters: { ...f.segment_filters, tags: [...(f.segment_filters.tags || []), tagInput.trim()] },
    }));
    setTagInput('');
  };

  const removeTag = (tag) => {
    setForm((f) => ({
      ...f,
      segment_filters: { ...f.segment_filters, tags: f.segment_filters.tags.filter((t) => t !== tag) },
    }));
  };

  const charCount = form.message.length;
  const smsPages = Math.ceil(charCount / 160);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="font-bold text-gray-900">Yangi ommaviy xabar</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="label">Sarlavha (ichki nom)</label>
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Masalan: Fevral aksiyasi" />
          </div>

          <div>
            <label className="label">Kanal</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(CHANNEL_ICONS).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setForm({ ...form, channel: val })}
                  className={`py-2 px-4 rounded-xl border text-sm font-medium transition-all ${
                    form.channel === val
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-primary-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">
              Xabar matni
              <span className="text-gray-400 font-normal ml-2">— {'{{ism}}'} o'zgaruvchisini ishlatish mumkin</span>
            </label>
            <textarea
              className="input h-32 resize-none"
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="Salom {{ism}}! Maxsus taklif: ..."
            />
            <div className="flex justify-between mt-1 text-xs text-gray-400">
              <span>{charCount} belgi</span>
              {form.channel === 'sms' && <span>{smsPages} SMS sahifa</span>}
            </div>
          </div>

          {/* Segment */}
          <div className="border border-gray-100 rounded-2xl p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-700">🎯 Segment (kim ga yuborish?)</p>

            <div>
              <label className="label text-xs">Teglar bo'yicha</label>
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  placeholder="Teg qo'shish..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addTag()}
                />
                <button onClick={addTag} className="btn-secondary px-3">+</button>
              </div>
              {form.segment_filters.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {form.segment_filters.tags.map((t) => (
                    <span key={t} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                      {t} <button onClick={() => removeTag(t)}>×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label text-xs">Manba</label>
                <select className="input" value={form.segment_filters.source || ''} onChange={(e) => setForm((f) => ({ ...f, segment_filters: { ...f.segment_filters, source: e.target.value || undefined } }))}>
                  <option value="">Barchasi</option>
                  <option value="telegram">Telegram</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="instagram">Instagram</option>
                  <option value="facebook">Facebook</option>
                  <option value="manual">Qo'lda</option>
                </select>
              </div>
              <div>
                <label className="label text-xs">Shahar</label>
                <input className="input" placeholder="Toshkent" value={form.segment_filters.city || ''} onChange={(e) => setForm((f) => ({ ...f, segment_filters: { ...f.segment_filters, city: e.target.value || undefined } }))} />
              </div>
            </div>

            <button
              onClick={() => previewMutation.mutate()}
              disabled={previewMutation.isPending}
              className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
            >
              <Eye size={14} />
              {previewMutation.isPending ? 'Hisoblanmoqda...' : 'Qancha kontakt oladi? (Preview)'}
            </button>
            {preview && (
              <div className="bg-blue-50 rounded-xl p-3 text-sm text-blue-800">
                <strong>{preview.total}</strong> ta kontaktga yuboriladi
                {preview.sample?.length > 0 && (
                  <span className="text-blue-600"> ({preview.sample.map((c) => c.first_name).join(', ')}...)</span>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="label">Rejaga olish (ixtiyoriy)</label>
            <input
              type="datetime-local"
              className="input"
              value={form.scheduled_at}
              onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
            />
            <p className="text-xs text-gray-400 mt-1">Bo'sh qoldiring — hozir yuborish uchun</p>
          </div>
        </div>

        <div className="border-t px-6 py-4 flex gap-3">
          <button className="btn-secondary flex-1" onClick={onClose}>Bekor</button>
          <button
            className="btn-primary flex-1"
            onClick={() => createMutation.mutate()}
            disabled={!form.title || !form.message || createMutation.isPending}
          >
            {createMutation.isPending ? 'Yaratilmoqda...' : 'Yaratish'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BroadcastPage() {
  const [showCreate, setShowCreate] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['broadcasts'],
    queryFn: () => api.get('/broadcasts').then((r) => r.data.data),
    refetchInterval: 10_000,
  });

  const sendMutation = useMutation({
    mutationFn: (id) => api.post(`/broadcasts/${id}/send`),
    onSuccess: () => { qc.invalidateQueries(['broadcasts']); toast.success('Broadcast boshlandi!'); },
  });

  const cancelMutation = useMutation({
    mutationFn: (id) => api.post(`/broadcasts/${id}/cancel`),
    onSuccess: () => { qc.invalidateQueries(['broadcasts']); toast.success('Bekor qilindi'); },
  });

  const broadcasts = data || [];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Megaphone size={24} className="text-blue-500" /> Ommaviy Xabar
          </h1>
          <p className="text-gray-500 text-sm mt-1">Segmentlangan xabarlar — {broadcasts.length} ta kampaniya</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus size={16} /> Yangi kampaniya
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Yuklanmoqda...</div>
      ) : broadcasts.length === 0 ? (
        <div className="card p-12 text-center">
          <Megaphone size={40} className="text-gray-300 mx-auto mb-4" />
          <p className="font-medium text-gray-600">Hali kampaniya yo'q</p>
          <p className="text-sm text-gray-400 mt-1">Telegram, WhatsApp yoki SMS orqali segmentlangan xabarlar yuboring</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary mt-4">
            <Plus size={16} /> Birinchi kampaniyani yarating
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {broadcasts.map((b) => {
            const cfg = STATUS_CONFIG[b.status] || STATUS_CONFIG.draft;
            return (
              <div key={b.id} className="card p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900">{b.title}</h3>
                      <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                      <span className="text-sm">{CHANNEL_ICONS[b.channel]}</span>
                    </div>

                    <p className="text-sm text-gray-600 line-clamp-2 mb-3">{b.message}</p>

                    {/* Stats */}
                    {b.status === 'sent' && (
                      <div className="flex gap-4 text-sm">
                        <span className="flex items-center gap-1 text-gray-600">
                          <Users size={13} /> {b.total_recipients} ta
                        </span>
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle size={13} /> {b.sent_count} yuborildi
                        </span>
                        {b.failed_count > 0 && (
                          <span className="flex items-center gap-1 text-red-500">
                            <XCircle size={13} /> {b.failed_count} xato
                          </span>
                        )}
                      </div>
                    )}

                    {b.status === 'sending' && (
                      <div className="flex items-center gap-2 text-sm text-yellow-700">
                        <div className="w-3 h-3 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                        {b.sent_count}/{b.total_recipients} yuborilmoqda...
                      </div>
                    )}

                    <p className="text-xs text-gray-400 mt-2">
                      {b.created_by_name} • {new Date(b.created_at).toLocaleString('uz-UZ')}
                    </p>
                  </div>

                  <div className="flex gap-2 shrink-0">
                    {b.status === 'draft' && (
                      <button
                        onClick={() => sendMutation.mutate(b.id)}
                        disabled={sendMutation.isPending}
                        className="flex items-center gap-1.5 text-sm px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors"
                      >
                        <Send size={14} /> Yuborish
                      </button>
                    )}
                    {['draft', 'scheduled', 'sending'].includes(b.status) && (
                      <button
                        onClick={() => cancelMutation.mutate(b.id)}
                        className="text-sm px-3 py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors"
                      >
                        Bekor
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
