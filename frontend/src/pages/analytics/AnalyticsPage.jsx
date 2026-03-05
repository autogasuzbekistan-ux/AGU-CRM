import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import api from '../../api/axios';
import { formatUZS } from '../../utils/format';

const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#3B82F6'];

export default function AnalyticsPage() {
  const { data: trend } = useQuery({ queryKey: ['trend-90'], queryFn: () => api.get('/analytics/sales-trend?days=90').then(r => r.data.data) });
  const { data: sources } = useQuery({ queryKey: ['sources'], queryFn: () => api.get('/analytics/lead-sources').then(r => r.data.data) });
  const { data: channels } = useQuery({ queryKey: ['channels'], queryFn: () => api.get('/analytics/channels').then(r => r.data.data) });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tahlil</h1>
        <p className="text-gray-500 text-sm mt-1">Biznes ko'rsatkichlari</p>
      </div>

      {/* Sales trend */}
      <div className="card p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Savdo trendi (90 kun)</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={trend || []}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => d?.slice(5)} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`} />
            <Tooltip formatter={(v) => [formatUZS(v), 'Daromad']} />
            <Legend />
            <Line type="monotone" dataKey="revenue" stroke="#6366F1" strokeWidth={2} dot={false} name="Daromad" />
            <Line type="monotone" dataKey="count" stroke="#10B981" strokeWidth={2} dot={false} name="Bitimlar" yAxisId="right" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lead sources */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Lead manbalari</h2>
          <div className="flex items-center gap-6">
            <PieChart width={160} height={160}>
              <Pie data={sources || []} dataKey="count" nameKey="source" cx="50%" cy="50%" outerRadius={70} innerRadius={45}>
                {(sources || []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
            <div className="space-y-2">
              {(sources || []).map((s, i) => (
                <div key={s.source} className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-gray-700 capitalize">{s.source}</span>
                  <span className="font-semibold ml-auto">{s.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Channels */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Kanallar faoliyati</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={channels || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="channel" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="conversations" fill="#6366F1" name="Jami" radius={[4, 4, 0, 0]} />
              <Bar dataKey="resolved" fill="#10B981" name="Yopilgan" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
