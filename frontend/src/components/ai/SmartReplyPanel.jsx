/**
 * AGU AI — Smart Reply Panel
 * Suhbat oynasida AI tavsiya javoblarini ko'rsatadi
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../../api/axios';

const TYPE_COLORS = {
  greeting:  'bg-blue-50 text-blue-700 border-blue-200',
  info:      'bg-gray-50 text-gray-700 border-gray-200',
  solution:  'bg-green-50 text-green-700 border-green-200',
  question:  'bg-yellow-50 text-yellow-700 border-yellow-200',
  follow_up: 'bg-purple-50 text-purple-700 border-purple-200',
  escalate:  'bg-red-50 text-red-700 border-red-200',
};

export default function SmartReplyPanel({ conversationId, onSelect }) {
  const [open, setOpen] = useState(false);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['smart-reply', conversationId],
    queryFn: () => api.get(`/ai/conversations/${conversationId}/smart-reply`).then((r) => r.data.data),
    enabled: open && !!conversationId,
    staleTime: 60_000,
  });

  const suggestions = data?.suggestions || [];

  return (
    <div className="border-t border-gray-100 bg-white">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-purple-700 hover:bg-purple-50 transition-colors"
      >
        <Sparkles size={13} className="text-purple-500" />
        <span>AGU AI — Aqlli javoblar</span>
        <span className="flex-1" />
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>

      {open && (
        <div className="px-4 pb-3">
          {isLoading || isRefetching ? (
            <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
              <RefreshCw size={12} className="animate-spin" />
              AI tahlil qilmoqda...
            </div>
          ) : suggestions.length === 0 ? (
            <p className="text-xs text-gray-400 py-2">Tavsiya topilmadi</p>
          ) : (
            <div className="space-y-1.5">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => onSelect(s.text)}
                  className={`w-full text-left text-xs px-3 py-2 rounded-lg border transition-all hover:shadow-sm ${
                    TYPE_COLORS[s.type] || TYPE_COLORS.info
                  }`}
                >
                  {s.text}
                </button>
              ))}
              <button
                onClick={() => refetch()}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mt-1"
              >
                <RefreshCw size={10} /> Yangilash
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
