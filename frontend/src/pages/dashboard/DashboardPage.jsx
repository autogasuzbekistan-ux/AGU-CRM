import { useQuery } from '@tanstack/react-query';
import {
  Users, TrendingUp, DollarSign, UserPlus,
  MessageSquare, CheckSquare, ArrowUpRight, Zap,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import api from '../../api/axios';
import { formatUZS } from '../../utils/format';

export default function DashboardPage() {
  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get('/analytics/dashboard').then((r) => r.data.data),
    refetchInterval: 60_000,
  });

  const { data: trend } = useQuery({
    queryKey: ['sales-trend'],
    queryFn: () => api.get('/analytics/sales-trend?days=30').then((r) => r.data.data),
  });

  const { data: sources } = useQuery({
    queryKey: ['lead-sources'],
    queryFn: () => api.get('/analytics/lead-sources').then((r) => r.data.data),
  });

  const statCards = [
    {
      label: 'Umumiy mijozlar',
      value: stats?.totalContacts || 0,
      icon: Users,
      color: 'text-blue-600 bg-blue-50',
      trend: '+12%',
    },
    {
      label: 'Faol bitimlar',
      value: stats?.openDeals || 0,
      icon: TrendingUp,
      color: 'text-indigo-600 bg-indigo-50',
      trend: '+5%',
    },
    {
      label: 'Oylik daromad',
      value: formatUZS(stats?.monthlyRevenue || 0),
      icon: DollarSign,
      color: 'text-green-600 bg-green-50',
      trend: '+23%',
      isAmount: true,
    },
    {
      label: 'Bugungi leadlar',
      value: stats?.todayLeads || 0,
      icon: UserPlus,
      color: 'text-orange-600 bg-orange-50',
      trend: '',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Bugungi kun holati</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className="card p-5">
            <div className="flex items-start justify-between mb-4">
              <div className={`p-2.5 rounded-xl ${card.color}`}>
                <card.icon size={20} />
              </div>
              {card.trend && (
                <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                  <ArrowUpRight size={12} /> {card.trend}
                </span>
              )}
            </div>
            <p className="text-2xl font-bold text-gray-900">{card.value}</p>
            <p className="text-sm text-gray-500 mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Savdo trendi */}
        <div className="card p-5 xl:col-span-2">
          <h2 className="font-semibold text-gray-900 mb-4">Savdo trendi (30 kun)</h2>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={trend || []}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366F1" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => d?.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`} />
              <Tooltip
                formatter={(v) => [formatUZS(v), 'Daromad']}
                labelFormatter={(l) => `Sana: ${l}`}
              />
              <Area type="monotone" dataKey="revenue" stroke="#6366F1" strokeWidth={2} fill="url(#colorRevenue)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Lead manbalari */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Lead manbalari</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={sources || []} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="source" tick={{ fontSize: 11 }} width={70} />
              <Tooltip />
              <Bar dataKey="count" fill="#6366F1" radius={[0, 4, 4, 0]} name="Leadlar" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Kanallar */}
      <div className="card p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Faol integratsiyalar</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { name: 'Telegram', color: 'bg-blue-500', icon: '✈️' },
            { name: 'WhatsApp', color: 'bg-green-500', icon: '📱' },
            { name: 'Instagram', color: 'bg-pink-500', icon: '📸' },
            { name: 'Facebook', color: 'bg-blue-700', icon: '👥' },
          ].map((ch) => (
            <div key={ch.name} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
              <div className={`w-9 h-9 ${ch.color} rounded-xl flex items-center justify-center text-lg`}>
                {ch.icon}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{ch.name}</p>
                <p className="text-xs text-gray-400">Sozlash</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
