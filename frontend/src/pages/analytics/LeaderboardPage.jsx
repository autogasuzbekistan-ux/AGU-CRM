import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Trophy, TrendingUp, MessageSquare, CheckSquare, Medal } from 'lucide-react';
import api from '../../api/axios';
import { formatUZS } from '../../utils/format';

const MEDALS = ['🥇', '🥈', '🥉'];
const PERIOD_LABELS = { daily: 'Bugun', weekly: 'Bu hafta', monthly: 'Bu oy' };

export default function LeaderboardPage() {
  const [period, setPeriod] = useState('monthly');

  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard', period],
    queryFn: () => api.get(`/users/leaderboard?period=${period}`).then((r) => r.data.data),
    refetchInterval: 30_000,
  });

  const operators = data || [];
  const top3 = operators.slice(0, 3);
  const rest = operators.slice(3);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Trophy className="text-yellow-500" /> Operatorlar reytingi
          </h1>
          <p className="text-gray-500 text-sm mt-1">Raqobat va natijalar</p>
        </div>

        {/* Period selector */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {Object.entries(PERIOD_LABELS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                period === key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Yuklanmoqda...</div>
      ) : operators.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Trophy size={48} className="mx-auto mb-4 text-gray-200" />
          <p>Bu davr uchun ma'lumot yo'q</p>
        </div>
      ) : (
        <>
          {/* Top 3 podium */}
          {top3.length > 0 && (
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[top3[1], top3[0], top3[2]].filter(Boolean).map((op, i) => {
                const actualRank = op?.rank;
                const height = actualRank === 1 ? 'pt-4' : actualRank === 2 ? 'pt-8' : 'pt-12';
                return (
                  <div key={op.id} className={`card p-5 text-center ${height} ${actualRank === 1 ? 'border-yellow-200 bg-yellow-50/50' : ''}`}>
                    <div className="text-3xl mb-2">{MEDALS[actualRank - 1]}</div>
                    <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-3 text-xl font-bold text-primary-700">
                      {op.first_name?.[0]}{op.last_name?.[0]}
                    </div>
                    <p className="font-bold text-gray-900 text-sm">{op.first_name} {op.last_name}</p>
                    <p className="text-primary-600 font-bold mt-1">{formatUZS(op.revenue || 0)}</p>
                    <div className="mt-3 grid grid-cols-2 gap-1 text-xs text-gray-500">
                      <span>✅ {op.deals_won || 0}</span>
                      <span>📨 {op.leads_received || 0}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Full table */}
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="py-3 px-4 text-left font-medium text-gray-600 w-12">#</th>
                  <th className="py-3 px-4 text-left font-medium text-gray-600">Operator</th>
                  <th className="py-3 px-4 text-right font-medium text-gray-600">Daromad</th>
                  <th className="py-3 px-4 text-right font-medium text-gray-600">Bitimlar</th>
                  <th className="py-3 px-4 text-right font-medium text-gray-600">Leadlar</th>
                  <th className="py-3 px-4 text-right font-medium text-gray-600">Xabarlar</th>
                  <th className="py-3 px-4 text-right font-medium text-gray-600">Vazifalar</th>
                </tr>
              </thead>
              <tbody>
                {operators.map((op) => (
                  <tr key={op.id} className={`border-b border-gray-50 hover:bg-gray-50/50 ${op.rank <= 3 ? 'font-medium' : ''}`}>
                    <td className="py-3 px-4 text-center">
                      {op.rank <= 3 ? MEDALS[op.rank - 1] : <span className="text-gray-400">{op.rank}</span>}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-sm font-medium text-primary-700">
                          {op.first_name?.[0]}{op.last_name?.[0]}
                        </div>
                        <span className="text-gray-900">{op.first_name} {op.last_name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right text-green-700 font-semibold">{formatUZS(op.revenue || 0)}</td>
                    <td className="py-3 px-4 text-right text-gray-700">{op.deals_won || 0} / {(op.deals_won || 0) + (op.deals_lost || 0)}</td>
                    <td className="py-3 px-4 text-right text-gray-600">{op.leads_received || 0}</td>
                    <td className="py-3 px-4 text-right text-gray-600">{op.messages_sent || 0}</td>
                    <td className="py-3 px-4 text-right text-gray-600">{op.tasks_completed || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
