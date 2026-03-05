import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Settings, Building2, Lock } from 'lucide-react';
import api from '../../api/axios';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { user, updateUser } = useAuthStore();
  const [tab, setTab] = useState('organization');
  const [orgForm, setOrgForm] = useState({});
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });

  const { data: org } = useQuery({
    queryKey: ['org-current'],
    queryFn: () => api.get('/organizations/current').then(r => r.data.data),
    onSuccess: (data) => setOrgForm({ name: data.name, phone: data.phone, email: data.email, website: data.website, address: data.address, city: data.city, currency: data.currency, timezone: data.timezone }),
  });

  const updateOrg = useMutation({
    mutationFn: (data) => api.put('/organizations/current', data),
    onSuccess: () => toast.success('Sozlamalar saqlandi'),
  });

  const changePassword = useMutation({
    mutationFn: (data) => api.patch('/users/change-password', data),
    onSuccess: () => { setPwForm({ currentPassword: '', newPassword: '', confirm: '' }); toast.success('Parol yangilandi'); },
  });

  const tabs = [
    { id: 'organization', label: 'Tashkilot', icon: Building2 },
    { id: 'security', label: 'Xavfsizlik', icon: Lock },
  ];

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2"><Settings /> Sozlamalar</h1>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.id ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'organization' && (
        <div className="card p-6 space-y-4">
          <div><label className="label">Kompaniya nomi</label><input className="input" value={orgForm.name || ''} onChange={e => setOrgForm({ ...orgForm, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Telefon</label><input className="input" value={orgForm.phone || ''} onChange={e => setOrgForm({ ...orgForm, phone: e.target.value })} /></div>
            <div><label className="label">Email</label><input className="input" value={orgForm.email || ''} onChange={e => setOrgForm({ ...orgForm, email: e.target.value })} /></div>
          </div>
          <div><label className="label">Veb-sayt</label><input className="input" value={orgForm.website || ''} onChange={e => setOrgForm({ ...orgForm, website: e.target.value })} /></div>
          <div><label className="label">Manzil</label><input className="input" value={orgForm.address || ''} onChange={e => setOrgForm({ ...orgForm, address: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Valyuta</label>
              <select className="input" value={orgForm.currency || 'UZS'} onChange={e => setOrgForm({ ...orgForm, currency: e.target.value })}>
                <option value="UZS">UZS (So'm)</option>
                <option value="USD">USD (Dollar)</option>
                <option value="RUB">RUB (Rubl)</option>
                <option value="KZT">KZT (Tenge)</option>
              </select>
            </div>
            <div>
              <label className="label">Vaqt zonasi</label>
              <select className="input" value={orgForm.timezone || 'Asia/Tashkent'} onChange={e => setOrgForm({ ...orgForm, timezone: e.target.value })}>
                <option value="Asia/Tashkent">Toshkent (UTC+5)</option>
                <option value="Asia/Almaty">Almaty (UTC+5)</option>
                <option value="Asia/Bishkek">Bishkek (UTC+6)</option>
                <option value="Asia/Dushanbe">Dushanbe (UTC+5)</option>
                <option value="Asia/Ashgabat">Ashgabat (UTC+5)</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button onClick={() => updateOrg.mutate(orgForm)} className="btn-primary" disabled={updateOrg.isPending}>Saqlash</button>
          </div>
        </div>
      )}

      {tab === 'security' && (
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Parolni o'zgartirish</h2>
          <div><label className="label">Joriy parol</label><input type="password" className="input" value={pwForm.currentPassword} onChange={e => setPwForm({ ...pwForm, currentPassword: e.target.value })} /></div>
          <div><label className="label">Yangi parol</label><input type="password" className="input" value={pwForm.newPassword} onChange={e => setPwForm({ ...pwForm, newPassword: e.target.value })} /></div>
          <div><label className="label">Yangi parolni tasdiqlash</label><input type="password" className="input" value={pwForm.confirm} onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })} /></div>
          {pwForm.newPassword && pwForm.confirm && pwForm.newPassword !== pwForm.confirm && (
            <p className="text-red-500 text-sm">Parollar mos kelmaydi</p>
          )}
          <div className="flex justify-end">
            <button
              onClick={() => changePassword.mutate({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword })}
              className="btn-primary"
              disabled={!pwForm.currentPassword || !pwForm.newPassword || pwForm.newPassword !== pwForm.confirm}
            >
              Yangilash
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
