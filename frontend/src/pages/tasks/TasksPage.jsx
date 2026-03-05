import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, CheckSquare, Square, Clock, AlertCircle } from 'lucide-react';
import api from '../../api/axios';
import { formatDate } from '../../utils/format';
import toast from 'react-hot-toast';

const TYPE_ICONS = { task: '📋', call: '📞', meeting: '🤝', email: '📧', follow_up: '🔄' };
const PRIORITY_COLORS = { low: 'text-gray-400', medium: 'text-blue-500', high: 'text-orange-500', urgent: 'text-red-600' };

export default function TasksPage() {
  const [filter, setFilter] = useState({ status: 'pending' });
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', type: 'task', priority: 'medium', dueDate: '' });
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['tasks', filter],
    queryFn: () => {
      const p = new URLSearchParams(filter).toString();
      return api.get(`/tasks?${p}`).then((r) => r.data.data);
    },
  });

  const completeMutation = useMutation({
    mutationFn: (id) => api.patch(`/tasks/${id}/complete`),
    onSuccess: () => { qc.invalidateQueries(['tasks']); toast.success('Vazifa bajarildi ✓'); },
  });

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/tasks', data),
    onSuccess: () => { qc.invalidateQueries(['tasks']); setShowCreate(false); setForm({ title: '', type: 'task', priority: 'medium', dueDate: '' }); },
  });

  const tasks = data || [];
  const pending = tasks.filter((t) => t.status !== 'completed');
  const completed = tasks.filter((t) => t.status === 'completed');

  const TaskItem = ({ task }) => (
    <div className={`flex items-start gap-4 p-4 rounded-xl border transition-all ${task.status === 'completed' ? 'bg-gray-50 border-gray-100 opacity-60' : 'bg-white border-gray-200 hover:border-primary-200'}`}>
      <button
        onClick={() => task.status !== 'completed' && completeMutation.mutate(task.id)}
        className="mt-0.5 shrink-0"
      >
        {task.status === 'completed'
          ? <CheckSquare size={20} className="text-green-500" />
          : <Square size={20} className="text-gray-300 hover:text-primary-500" />
        }
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`font-medium text-sm ${task.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
            {TYPE_ICONS[task.type]} {task.title}
          </p>
          <AlertCircle size={14} className={`shrink-0 mt-0.5 ${PRIORITY_COLORS[task.priority]}`} />
        </div>
        {task.contact_name && <p className="text-xs text-gray-500 mt-1">👤 {task.contact_name}</p>}
        {task.due_date && (
          <div className="flex items-center gap-1 mt-1">
            <Clock size={11} className="text-gray-400" />
            <span className={`text-xs ${new Date(task.due_date) < new Date() && task.status !== 'completed' ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
              {formatDate(task.due_date)}
            </span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vazifalar</h1>
          <p className="text-gray-500 text-sm mt-1">{pending.length} ta bajarilmagan</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary"><Plus size={16} /> Vazifa</button>
      </div>

      <div className="flex gap-2 mb-4">
        {[['pending', 'Bajarilmagan'], ['', 'Barchasi'], ['completed', 'Bajarilgan']].map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFilter({ status: val })}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter.status === val ? 'bg-primary-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Yuklanmoqda...</div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <CheckSquare size={48} className="mx-auto mb-4 text-gray-200" />
          <p>Vazifa topilmadi</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => <TaskItem key={task.id} task={task} />)}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">Yangi vazifa</h2>
            <div className="space-y-4">
              <div>
                <label className="label">Vazifa *</label>
                <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Tur</label>
                  <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                    {Object.entries(TYPE_ICONS).map(([k, v]) => <option key={k} value={k}>{v} {k}</option>)}
                  </select>
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
              <div>
                <label className="label">Muddat</label>
                <input type="datetime-local" className="input" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button className="btn-secondary flex-1" onClick={() => setShowCreate(false)}>Bekor</button>
              <button className="btn-primary flex-1" onClick={() => createMutation.mutate(form)} disabled={!form.title}>Saqlash</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
