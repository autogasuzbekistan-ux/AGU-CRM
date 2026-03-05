/**
 * AGU AI — Suhbat xulosasi modal
 */
import { useQuery } from '@tanstack/react-query';
import { X, RefreshCw, Tag, Target, CheckSquare, TrendingUp } from 'lucide-react';
import api from '../../api/axios';

export default function ConversationSummaryModal({ conversationId, onClose }) {
  const { data, isLoading } = useQuery({
    queryKey: ['conv-summary', conversationId],
    queryFn: () =>
      api.get(`/ai/conversations/${conversationId}/summary`).then((r) => r.data.data),
    staleTime: 300_000,
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-2">
            <span className="text-lg">✨</span>
            <h2 className="font-bold text-gray-900">AGU AI — Suhbat xulosasi</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-gray-400">
              <RefreshCw size={16} className="animate-spin" />
              <span>AI xulosa tayyorlamoqda...</span>
            </div>
          ) : !data ? (
            <p className="text-center text-gray-400 py-8">Ma'lumot olishda xato</p>
          ) : (
            <>
              {/* Title */}
              {data.title && (
                <div>
                  <h3 className="text-base font-semibold text-gray-900">{data.title}</h3>
                </div>
              )}

              {/* Summary text */}
              {data.summary_text && (
                <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-800">
                  {data.summary_text}
                </div>
              )}

              {/* Key points */}
              {data.key_points?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                    <Target size={12} /> Asosiy fikrlar
                  </p>
                  <ul className="space-y-1">
                    {data.key_points.map((p, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-blue-400 mt-0.5">•</span> {p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Client needs */}
              {data.client_needs?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    🎯 Mijoz ehtiyojlari
                  </p>
                  <ul className="space-y-1">
                    {data.client_needs.map((n, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-green-400 mt-0.5">✓</span> {n}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Commitments */}
              {data.commitments_made?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                    <CheckSquare size={12} /> Kelishuvlar
                  </p>
                  <ul className="space-y-1">
                    {data.commitments_made.map((c, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-purple-400 mt-0.5">→</span> {c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Next action */}
              {data.next_action && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-yellow-700 mb-1">⏭️ Keyingi qadam</p>
                  <p className="text-sm text-yellow-800">{data.next_action}</p>
                </div>
              )}

              {/* Deal potential + tags */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                {data.deal_potential && (
                  <div className="flex items-center gap-1.5">
                    <TrendingUp size={14} className="text-green-600" />
                    <span className="text-sm text-gray-700">
                      Bitim ehtimoli: <strong className="text-green-700">{data.deal_potential}</strong>
                    </span>
                  </div>
                )}
                {data.suggested_tags?.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    <Tag size={12} className="text-gray-400" />
                    {data.suggested_tags.map((t) => (
                      <span key={t} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
