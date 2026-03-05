import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, CheckCircle, XCircle, Zap } from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const INTEGRATIONS_INFO = {
  telegram: { name: 'Telegram Bot', icon: '✈️', color: 'bg-blue-500', description: 'Telegram orqali mijozlar bilan muloqot' },
  whatsapp: { name: 'WhatsApp Business', icon: '📱', color: 'bg-green-500', description: 'WhatsApp Business API integratsiyasi' },
  instagram: { name: 'Instagram', icon: '📸', color: 'bg-pink-500', description: 'Instagram DM va izohlari' },
  facebook: { name: 'Facebook', icon: '👥', color: 'bg-blue-700', description: 'Facebook Messenger va Lead Ads' },
};

export default function IntegrationsPage() {
  const [showAdd, setShowAdd] = useState(null); // 'telegram' | 'whatsapp' etc.
  const [form, setForm] = useState({});
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['integrations'],
    queryFn: () => api.get('/integrations').then(r => r.data.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/integrations/${id}`),
    onSuccess: () => { qc.invalidateQueries(['integrations']); toast.success('Integratsiya o\'chirildi'); },
  });

  const addTelegram = useMutation({
    mutationFn: (data) => api.post('/integrations/telegram', data),
    onSuccess: () => { qc.invalidateQueries(['integrations']); setShowAdd(null); setForm({}); toast.success('Telegram bot qo\'shildi!'); },
  });

  const addWhatsApp = useMutation({
    mutationFn: (data) => api.post('/integrations/whatsapp', data),
    onSuccess: () => { qc.invalidateQueries(['integrations']); setShowAdd(null); setForm({}); toast.success('WhatsApp qo\'shildi!'); },
  });

  const addFacebook = useMutation({
    mutationFn: (data) => api.post('/integrations/facebook', data),
    onSuccess: () => { qc.invalidateQueries(['integrations']); setShowAdd(null); setForm({}); toast.success('Facebook qo\'shildi!'); },
  });

  const addInstagram = useMutation({
    mutationFn: (data) => api.post('/integrations/instagram', data),
    onSuccess: () => { qc.invalidateQueries(['integrations']); setShowAdd(null); setForm({}); toast.success('Instagram qo\'shildi!'); },
  });

  const activeTypes = new Set((data || []).map(i => i.type));

  const handleAdd = () => {
    if (showAdd === 'telegram') addTelegram.mutate({ botToken: form.botToken, name: form.name });
    else if (showAdd === 'whatsapp') addWhatsApp.mutate({ accessToken: form.accessToken, phoneNumberId: form.phoneNumberId, businessAccountId: form.businessAccountId });
    else if (showAdd === 'facebook') addFacebook.mutate({ accessToken: form.accessToken, pageId: form.pageId, name: form.name });
    else if (showAdd === 'instagram') addInstagram.mutate({ accessToken: form.accessToken, instagramAccountId: form.instagramAccountId });
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Zap /> Integratsiyalar</h1>
        <p className="text-gray-500 text-sm mt-1">Ijtimoiy tarmoqlar va messenjerlarni ulang</p>
      </div>

      {/* Available integrations */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {Object.entries(INTEGRATIONS_INFO).map(([type, info]) => {
          const active = data?.find(i => i.type === type);
          return (
            <div key={type} className="card p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 ${info.color} rounded-xl flex items-center justify-center text-xl`}>{info.icon}</div>
                  <div>
                    <p className="font-semibold text-gray-900">{info.name}</p>
                    {active ? (
                      <div className="flex items-center gap-1 text-xs text-green-600">
                        <CheckCircle size={12} /> Ulangan: {active.name}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <XCircle size={12} /> Ulanmagan
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <p className="text-sm text-gray-500 mb-4">{info.description}</p>
              <div className="flex gap-2">
                {!active ? (
                  <button onClick={() => { setShowAdd(type); setForm({}); }} className="btn-primary flex-1 justify-center text-sm py-2">
                    <Plus size={14} /> Ulash
                  </button>
                ) : (
                  <button onClick={() => deleteMutation.mutate(active.id)} className="btn-danger flex-1 justify-center text-sm py-2">
                    <Trash2 size={14} /> O'chirish
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">{INTEGRATIONS_INFO[showAdd]?.name} ulash</h2>

            <div className="space-y-4">
              {showAdd === 'telegram' && (
                <>
                  <div>
                    <label className="label">Bot Token *</label>
                    <input className="input font-mono text-sm" placeholder="1234567890:ABCdef..." value={form.botToken || ''} onChange={e => setForm({ ...form, botToken: e.target.value })} />
                    <p className="text-xs text-gray-400 mt-1">@BotFather dan oling</p>
                  </div>
                  <div>
                    <label className="label">Bot nomi</label>
                    <input className="input" placeholder="Asosiy bot" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} />
                  </div>
                </>
              )}

              {showAdd === 'whatsapp' && (
                <>
                  <div><label className="label">Access Token *</label><input className="input" value={form.accessToken || ''} onChange={e => setForm({ ...form, accessToken: e.target.value })} /></div>
                  <div><label className="label">Phone Number ID *</label><input className="input" value={form.phoneNumberId || ''} onChange={e => setForm({ ...form, phoneNumberId: e.target.value })} /></div>
                  <div><label className="label">Business Account ID</label><input className="input" value={form.businessAccountId || ''} onChange={e => setForm({ ...form, businessAccountId: e.target.value })} /></div>
                </>
              )}

              {showAdd === 'facebook' && (
                <>
                  <div><label className="label">Page Access Token *</label><input className="input" value={form.accessToken || ''} onChange={e => setForm({ ...form, accessToken: e.target.value })} /></div>
                  <div><label className="label">Page ID *</label><input className="input" value={form.pageId || ''} onChange={e => setForm({ ...form, pageId: e.target.value })} /></div>
                  <div><label className="label">Sahifa nomi</label><input className="input" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                </>
              )}

              {showAdd === 'instagram' && (
                <>
                  <div><label className="label">Access Token *</label><input className="input" value={form.accessToken || ''} onChange={e => setForm({ ...form, accessToken: e.target.value })} /></div>
                  <div><label className="label">Instagram Account ID *</label><input className="input" value={form.instagramAccountId || ''} onChange={e => setForm({ ...form, instagramAccountId: e.target.value })} /></div>
                </>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button className="btn-secondary flex-1" onClick={() => setShowAdd(null)}>Bekor</button>
              <button className="btn-primary flex-1" onClick={handleAdd}>Ulash</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
