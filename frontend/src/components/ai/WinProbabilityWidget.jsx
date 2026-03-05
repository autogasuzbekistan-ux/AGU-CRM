/**
 * AGU AI — Deal Win Probability Widget
 * Bitim kartasida yutish ehtimolini ko'rsatadi
 */
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { TrendingUp } from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

function ProbBar({ value }) {
  const pct = Math.round((value || 0) * 100);
  const color =
    pct >= 70 ? 'bg-green-500' :
    pct >= 40 ? 'bg-yellow-500' :
    'bg-red-500';
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function WinProbabilityWidget({ dealId, compact = false }) {
  const [result, setResult] = useState(null);

  const calcMutation = useMutation({
    mutationFn: () => api.get(`/ai/deals/${dealId}/win-probability`).then((r) => r.data.data),
    onSuccess: (data) => {
      setResult(data);
    },
    onError: () => toast.error('Ehtimol hisoblab bo\'lmadi'),
  });

  if (result) {
    const pct = Math.round((result.probability || 0) * 100);
    const color = pct >= 70 ? 'text-green-700' : pct >= 40 ? 'text-yellow-700' : 'text-red-700';

    if (compact) {
      return (
        <div className="mt-2" title={result.action_required || ''}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500">Yutish:</span>
            <span className={`text-xs font-bold ${color}`}>{pct}%</span>
          </div>
          <ProbBar value={result.probability} />
        </div>
      );
    }

    return (
      <div className="mt-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-600">🤖 Yutish ehtimoli</span>
          <span className={`text-sm font-bold ${color}`}>{pct}%</span>
        </div>
        <ProbBar value={result.probability} />
        {result.action_required && (
          <p className="text-xs text-gray-500 mt-2 italic">{result.action_required}</p>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); calcMutation.mutate(); }}
      disabled={calcMutation.isPending}
      className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 transition-colors mt-2"
      title="AI bilan yutish ehtimolini hisoblash"
    >
      <TrendingUp size={11} />
      {calcMutation.isPending ? 'Hisoblanmoqda...' : 'Ehtimol'}
    </button>
  );
}
