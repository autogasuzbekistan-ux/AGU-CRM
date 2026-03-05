/**
 * AGU CRM — Avtomatizatsiya qoidalari sahifasi
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Zap, ToggleLeft, ToggleRight, Trash2, Edit2, Play, X } from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const ACTION_LABELS = {
  send_message:       '💬 Mijozga xabar',
  create_task:        '✅ Vazifa yaratish',
  send_notification:  '🔔 Bildirishnoma',
  add_tag:            '🏷️ Teg qo\'shish',
  update_lead_status: '🔄 Lead holati',
  update_deal_stage:  '📊 Bosqich o\'zgartirish',
};

const STATUS_COLORS = {
  true:  'bg-green-100 text-green-800',
  false: 'bg-gray-100 text-gray-500',
};

function RuleFormModal({ rule, onClose, onSave }) {
  const [form, setForm] = useState({
    name: rule?.name || '',
    description: rule?.description || '',
    trigger_event: rule?.trigger_event || 'lead_created',
    trigger_conditions: JSON.stringify(rule?.trigger_conditions || {}, null, 2),
    actions: JSON.stringify(rule?.actions || [
      { type: 'send_notification', message: 'Yangi event!' }
    ], null, 2),
    delay_minutes: rule?.delay_minutes || 0,
    is_active: rule?.is_active !== false,
  });
  const [error, setError] = useState('');

  const { data: meta } = useQuery({
    queryKey: ['automation-meta'],
    queryFn: () => api.get('/automations/meta/events').then((r) => r.data),
    staleTime: Infinity,
  });

  const handleSubmit = () => {
    try {
      const conditions = JSON.parse(form.trigger_conditions || '{}');
      const actions = JSON.parse(form.actions || '[]');
      if (!form.name || !form.trigger_event) throw new Error('Nom va trigger majburiy');
      if (!Array.isArray(actions)) throw new Error('Actions massiv bo\'lishi kerak');
      onSave({ ...form, trigger_conditions: conditions, actions, delay_minutes: parseInt(form.delay_minutes) || 0 });
    } catch (e) {
      setError(e.message);
    }
  };

  const events = meta?.data || [];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="font-bold text-gray-900">{rule ? 'Qoidani tahrirlash' : 'Yangi qoida'}</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>

        <div className="p-6 space-y-4">
          {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>}

          <div>
            <label className="label">Qoida nomi *</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Masalan: Yangi leadga xabar yuborish" />
          </div>

          <div>
            <label className="label">Trigger event *</label>
            <select className="input" value={form.trigger_event} onChange={(e) => setForm({ ...form, trigger_event: e.target.value })}>
              {events.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
            </select>
          </div>

          <div>
            <label className="label">
              Shartlar (JSON)
              <span className="text-gray-400 font-normal ml-2">— bo'sh qoldiring = barcha holatlarda ishlaydi</span>
            </label>
            <textarea
              className="input font-mono text-xs h-24 resize-none"
              value={form.trigger_conditions}
              onChange={(e) => setForm({ ...form, trigger_conditions: e.target.value })}
              placeholder='{"status": "new", "source": "telegram"}'
            />
          </div>

          <div>
            <label className="label">
              Amallar (JSON massiv) *
            </label>
            <div className="flex flex-wrap gap-1 mb-2">
              {(meta?.action_types || []).map((a) => (
                <span key={a.value} className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full cursor-help" title={a.label}>
                  {a.value}
                </span>
              ))}
            </div>
            <textarea
              className="input font-mono text-xs h-40 resize-none"
              value={form.actions}
              onChange={(e) => setForm({ ...form, actions: e.target.value })}
              placeholder='[{"type": "send_message", "text": "Salom {{contact_name}}!"}, {"type": "create_task", "title": "Qo\'ng\'iroq qilish", "due_hours": 2}]'
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Kechikish (daqiqa)</label>
              <input type="number" className="input" min="0" value={form.delay_minutes} onChange={(e) => setForm({ ...form, delay_minutes: e.target.value })} />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="w-4 h-4" />
                <span className="text-sm font-medium text-gray-700">Faol</span>
              </label>
            </div>
          </div>

          {/* Namunalar */}
          <details className="mt-2">
            <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">📖 Namunalar ko'rsatish</summary>
            <div className="mt-3 space-y-3 text-xs">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="font-semibold mb-1">Yangi leadga xabar + vazifa</p>
                <pre className="text-gray-600 whitespace-pre-wrap">{JSON.stringify([
                  { type: 'send_message', text: 'Salom {{contact_name}}! Menejerimiz tez orada siz bilan bog\'lanadi.' },
                  { type: 'create_task', title: 'Yangi leadga qo\'ng\'iroq qilish', due_hours: 2 },
                  { type: 'send_notification', message: 'Yangi lead: {{contact_name}}' }
                ], null, 2)}</pre>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="font-semibold mb-1">Bitim yutilganda</p>
                <pre className="text-gray-600 whitespace-pre-wrap">{JSON.stringify([
                  { type: 'send_message', text: 'Tabriklaymiz! Buyurtmangiz tasdiqlandi. Tez orada yetkazib beramiz.' },
                  { type: 'add_tag', tags: ['mijoz', 'sotib-olgan'] }
                ], null, 2)}</pre>
              </div>
            </div>
          </details>
        </div>

        <div className="border-t px-6 py-4 flex gap-3">
          <button className="btn-secondary flex-1" onClick={onClose}>Bekor</button>
          <button className="btn-primary flex-1" onClick={handleSubmit}>
            {rule ? 'Saqlash' : 'Yaratish'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AutomationPage() {
  const [showForm, setShowForm] = useState(false);
  const [editRule, setEditRule] = useState(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['automations'],
    queryFn: () => api.get('/automations').then((r) => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/automations', data),
    onSuccess: () => { qc.invalidateQueries(['automations']); setShowForm(false); toast.success('Qoida yaratildi'); },
    onError: (e) => toast.error(e.response?.data?.message || 'Xato'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/automations/${id}`, data),
    onSuccess: () => { qc.invalidateQueries(['automations']); setEditRule(null); toast.success('Yangilandi'); },
  });

  const toggleMutation = useMutation({
    mutationFn: (id) => api.patch(`/automations/${id}/toggle`),
    onSuccess: () => qc.invalidateQueries(['automations']),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/automations/${id}`),
    onSuccess: () => { qc.invalidateQueries(['automations']); toast.success('O\'chirildi'); },
  });

  const rules = data || [];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Zap size={24} className="text-yellow-500" /> Avtomatizatsiya
          </h1>
          <p className="text-gray-500 text-sm mt-1">Pipeline trigger qoidalari — {rules.length} ta</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          <Plus size={16} /> Yangi qoida
        </button>
      </div>

      {/* Rules list */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Yuklanmoqda...</div>
      ) : rules.length === 0 ? (
        <div className="card p-12 text-center">
          <Zap size={40} className="text-gray-300 mx-auto mb-4" />
          <p className="font-medium text-gray-600">Hali qoida yo'q</p>
          <p className="text-sm text-gray-400 mt-1">Lead yaratilganda, bitim yutilganda — avtomatik amallar bajaring</p>
          <button onClick={() => setShowForm(true)} className="btn-primary mt-4">
            <Plus size={16} /> Birinchi qoidani yarating
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <div key={rule.id} className={`card p-5 border-l-4 ${rule.is_active ? 'border-green-400' : 'border-gray-200'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-semibold text-gray-900">{rule.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[rule.is_active]}`}>
                      {rule.is_active ? 'Faol' : 'Nofaol'}
                    </span>
                    {rule.delay_minutes > 0 && (
                      <span className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                        ⏱ {rule.delay_minutes} daq kechikish
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap">
                    <span>🎯 <strong>Trigger:</strong> {rule.trigger_event}</span>
                    <span>⚡ <strong>Amallar:</strong> {(rule.actions || []).map((a) => ACTION_LABELS[a.type] || a.type).join(', ')}</span>
                    <span>▶️ {rule.run_count} marta ishga tushdi</span>
                  </div>

                  {rule.description && (
                    <p className="text-xs text-gray-400 mt-1">{rule.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => toggleMutation.mutate(rule.id)}
                    className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                    title={rule.is_active ? 'O\'chirish' : 'Yoqish'}
                  >
                    {rule.is_active
                      ? <ToggleRight size={20} className="text-green-600" />
                      : <ToggleLeft size={20} className="text-gray-400" />}
                  </button>
                  <button
                    onClick={() => setEditRule(rule)}
                    className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
                  >
                    <Edit2 size={15} />
                  </button>
                  <button
                    onClick={() => { if (confirm('O\'chirishni tasdiqlaysizmi?')) deleteMutation.mutate(rule.id); }}
                    className="p-2 rounded-lg hover:bg-red-50 transition-colors text-gray-400 hover:text-red-500"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {showForm && (
        <RuleFormModal
          onClose={() => setShowForm(false)}
          onSave={(data) => createMutation.mutate(data)}
        />
      )}
      {editRule && (
        <RuleFormModal
          rule={editRule}
          onClose={() => setEditRule(null)}
          onSave={(data) => updateMutation.mutate({ id: editRule.id, ...data })}
        />
      )}
    </div>
  );
}
