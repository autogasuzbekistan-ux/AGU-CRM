import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, User, Crown, Shield } from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const ROLE_CONFIG = {
  admin:    { label: 'Admin', color: 'badge-red', icon: Crown },
  manager:  { label: 'Menejer', color: 'badge-purple', icon: Shield },
  operator: { label: 'Operator', color: 'badge-blue', icon: User },
};

export default function UsersPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', role: 'operator', password: '' });
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(r => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/users', data),
    onSuccess: () => { qc.invalidateQueries(['users']); setShowCreate(false); toast.success('Foydalanuvchi qo\'shildi'); },
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }) => api.put(`/users/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries(['users']),
  });

  const users = data || [];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Foydalanuvchilar</h1>
          <p className="text-gray-500 text-sm mt-1">{users.length} ta foydalanuvchi</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary"><Plus size={16} /> Qo'shish</button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left py-3 px-4 font-medium text-gray-600">Foydalanuvchi</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600">Rol</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600">Bo'lim</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600">Holat</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600">Telegram</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600">Amal</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const roleCfg = ROLE_CONFIG[u.role] || ROLE_CONFIG.operator;
              return (
                <tr key={u.id} className={`border-b border-gray-50 hover:bg-gray-50/50 ${!u.is_active ? 'opacity-50' : ''}`}>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center font-medium text-primary-700 shrink-0">
                        {u.first_name?.[0]}{u.last_name?.[0]}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{u.first_name} {u.last_name}</p>
                        <p className="text-xs text-gray-400">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4"><span className={roleCfg.color}>{roleCfg.label}</span></td>
                  <td className="py-3 px-4 text-gray-500">{u.department || '—'}</td>
                  <td className="py-3 px-4">
                    <span className={`flex items-center gap-1 text-xs ${u.is_online ? 'text-green-600' : 'text-gray-400'}`}>
                      <span className={`w-2 h-2 rounded-full ${u.is_online ? 'bg-green-500' : 'bg-gray-300'}`} />
                      {u.is_online ? 'Online' : 'Offline'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-500 text-xs">{u.telegram_username ? `@${u.telegram_username}` : '—'}</td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => toggleActive.mutate({ id: u.id, isActive: !u.is_active })}
                      className={`text-xs px-3 py-1 rounded-lg ${u.is_active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                    >
                      {u.is_active ? 'Bloklash' : 'Faollashtirish'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">Yangi foydalanuvchi</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Ism</label><input className="input" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} /></div>
                <div><label className="label">Familiya</label><input className="input" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} /></div>
              </div>
              <div><label className="label">Email *</label><input className="input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <div><label className="label">Telefon</label><input className="input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              <div><label className="label">Rol</label>
                <select className="input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                  <option value="operator">Operator</option>
                  <option value="manager">Menejer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div><label className="label">Parol</label><input className="input" type="password" placeholder="Kamida 8 belgi" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></div>
            </div>
            <div className="flex gap-3 mt-6">
              <button className="btn-secondary flex-1" onClick={() => setShowCreate(false)}>Bekor</button>
              <button className="btn-primary flex-1" onClick={() => createMutation.mutate(form)} disabled={!form.email}>Qo'shish</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
