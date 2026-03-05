import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, DollarSign } from 'lucide-react';
import api from '../../api/axios';
import { formatUZS } from '../../utils/format';
import toast from 'react-hot-toast';
import WinProbabilityWidget from '../../components/ai/WinProbabilityWidget';

export default function DealsPage() {
  const [pipelineId, setPipelineId] = useState(null);
  const qc = useQueryClient();

  const { data: pipelines } = useQuery({
    queryKey: ['pipelines'],
    queryFn: () => api.get('/pipelines').then((r) => r.data.data),
    onSuccess: (data) => { if (data[0] && !pipelineId) setPipelineId(data[0].id); },
  });

  const selectedPipeline = pipelines?.[0];
  const pid = pipelineId || selectedPipeline?.id;

  const { data: kanban, isLoading } = useQuery({
    queryKey: ['kanban', pid],
    queryFn: () => api.get(`/deals/kanban?pipelineId=${pid}`).then((r) => r.data.data),
    enabled: !!pid,
  });

  const moveStage = useMutation({
    mutationFn: ({ dealId, stageId }) => api.patch(`/deals/${dealId}/stage`, { stageId }),
    onSuccess: () => qc.invalidateQueries(['kanban', pid]),
  });

  const markWon = useMutation({
    mutationFn: (id) => api.patch(`/deals/${id}/won`),
    onSuccess: () => { qc.invalidateQueries(['kanban', pid]); toast.success('Bitim yutildi! 🎉'); },
  });

  const markLost = useMutation({
    mutationFn: (id) => api.patch(`/deals/${id}/lost`, { reason: 'Mijoz rad etdi' }),
    onSuccess: () => { qc.invalidateQueries(['kanban', pid]); toast.error('Bitim yo\'qotildi'); },
  });

  const stages = kanban || [];

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bitimlar (Kanban)</h1>
          <p className="text-gray-500 text-sm mt-1">
            Umumiy: {stages.reduce((s, st) => s + (st.deals?.length || 0), 0)} ta bitim
          </p>
        </div>
        <button className="btn-primary"><Plus size={16} /> Yangi bitim</button>
      </div>

      {/* Pipeline tabs */}
      {pipelines && pipelines.length > 1 && (
        <div className="flex gap-2 mb-4 shrink-0">
          {pipelines.map((p) => (
            <button
              key={p.id}
              onClick={() => setPipelineId(p.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                pid === p.id ? 'bg-primary-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {/* Kanban board */}
      <div className="flex gap-4 overflow-x-auto pb-4 flex-1">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">Yuklanmoqda...</div>
        ) : stages.map((stage) => (
          <div key={stage.id} className="flex-shrink-0 w-72">
            {/* Stage header */}
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                <span className="font-semibold text-sm text-gray-900">{stage.name}</span>
                <span className="badge badge-gray">{stage.deals?.length || 0}</span>
              </div>
              <span className="text-xs text-gray-500">{formatUZS(stage.total_amount || 0)}</span>
            </div>

            {/* Deals */}
            <div className="space-y-3">
              {stage.deals?.map((deal) => (
                <div key={deal.id} className="card p-4 cursor-pointer hover:shadow-md transition-shadow group">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-900 line-clamp-2">{deal.title}</h3>
                  </div>

                  {deal.contact_name && (
                    <p className="text-xs text-gray-500 mb-2">👤 {deal.contact_name}</p>
                  )}

                  {/* AI Win Probability */}
                  {!stage.is_won && !stage.is_lost && (
                    <WinProbabilityWidget dealId={deal.id} compact />
                  )}

                  <div className="flex items-center justify-between mt-3">
                    <span className="flex items-center gap-1 text-sm font-semibold text-gray-900">
                      <DollarSign size={12} className="text-green-600" />
                      {formatUZS(deal.amount)}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(deal.created_at).toLocaleDateString('uz-UZ')}
                    </span>
                  </div>

                  {/* Actions */}
                  {!stage.is_won && !stage.is_lost && (
                    <div className="flex gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => markWon.mutate(deal.id)}
                        className="flex-1 text-xs py-1 rounded-lg bg-green-50 text-green-700 hover:bg-green-100"
                      >
                        ✓ Yutildi
                      </button>
                      <button
                        onClick={() => markLost.mutate(deal.id)}
                        className="flex-1 text-xs py-1 rounded-lg bg-red-50 text-red-700 hover:bg-red-100"
                      >
                        ✗ Yo'qotildi
                      </button>
                    </div>
                  )}

                  {stage.is_won && <div className="mt-2 text-xs text-center text-green-600 font-medium">🎉 Yutildi</div>}
                  {stage.is_lost && <div className="mt-2 text-xs text-center text-red-500 font-medium">❌ Yo'qotildi</div>}
                </div>
              ))}

              {/* Empty state */}
              {(!stage.deals || stage.deals.length === 0) && (
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center">
                  <p className="text-xs text-gray-400">Hali bitim yo'q</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
