/**
 * AGU AI — Sentiment Badge
 * Suhbatdagi mijoz kayfiyatini ko'rsatadi
 */
import { useQuery } from '@tanstack/react-query';
import api from '../../api/axios';

const SENTIMENT_CONFIG = {
  positive:  { emoji: '😊', label: 'Ijobiy',  color: 'text-green-600 bg-green-50' },
  neutral:   { emoji: '😐', label: 'Neytral', color: 'text-gray-600 bg-gray-50' },
  negative:  { emoji: '😟', label: 'Salbiy',  color: 'text-red-600 bg-red-50' },
  frustrated:{ emoji: '😤', label: 'Asabiy',  color: 'text-orange-600 bg-orange-50' },
  happy:     { emoji: '😄', label: 'Xursand', color: 'text-yellow-600 bg-yellow-50' },
};

export default function SentimentBadge({ conversationId }) {
  const { data } = useQuery({
    queryKey: ['sentiment-trend', conversationId],
    queryFn: () =>
      api.get(`/ai/conversations/${conversationId}/sentiment-trend`).then((r) => r.data.data),
    enabled: !!conversationId,
    staleTime: 120_000,
    refetchInterval: 60_000,
  });

  if (!data?.overall) return null;

  const cfg = SENTIMENT_CONFIG[data.overall] || SENTIMENT_CONFIG.neutral;

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}
      title={`Kayfiyat: ${cfg.label}${data.alert ? ' ⚠️ ' + data.alert : ''}`}
    >
      {cfg.emoji} {cfg.label}
      {data.alert && <span className="text-orange-500">⚠️</span>}
    </span>
  );
}
