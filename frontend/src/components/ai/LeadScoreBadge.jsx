/**
 * AGU AI — Lead Score Badge
 * Lead kartasida AI balini ko'rsatadi va hisoblaydi
 */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const GRADE_COLORS = {
  A: 'bg-green-100 text-green-800 border-green-300',
  B: 'bg-blue-100 text-blue-800 border-blue-300',
  C: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  D: 'bg-orange-100 text-orange-800 border-orange-300',
  F: 'bg-red-100 text-red-800 border-red-300',
};

export default function LeadScoreBadge({ leadId, existingScore }) {
  const [result, setResult] = useState(existingScore || null);
  const qc = useQueryClient();

  const scoreMutation = useMutation({
    mutationFn: () => api.post(`/ai/leads/${leadId}/score`).then((r) => r.data.data),
    onSuccess: (data) => {
      setResult(data);
      qc.invalidateQueries(['leads']);
      toast.success(`AI ball: ${data.score}/100 (${data.grade})`);
    },
    onError: () => toast.error('AI baholashda xato'),
  });

  if (result) {
    const grade = result.grade || 'C';
    return (
      <span
        className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-semibold ${
          GRADE_COLORS[grade] || GRADE_COLORS.C
        }`}
        title={result.recommendation || ''}
      >
        ✨ {result.score} ({grade})
      </span>
    );
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); scoreMutation.mutate(); }}
      disabled={scoreMutation.isPending}
      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition-colors"
      title="AI baholash"
    >
      <Sparkles size={10} />
      {scoreMutation.isPending ? '...' : 'AI ball'}
    </button>
  );
}
