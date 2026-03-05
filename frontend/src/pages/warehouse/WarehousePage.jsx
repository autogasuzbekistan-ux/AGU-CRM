import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Package, AlertTriangle, TrendingDown } from 'lucide-react';
import api from '../../api/axios';
import { formatUZS } from '../../utils/format';

export default function WarehousePage() {
  const [tab, setTab] = useState('stock');

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => api.get('/warehouse').then((r) => r.data.data),
  });

  const [selectedWh, setSelectedWh] = useState(null);
  const whId = selectedWh || warehouses?.[0]?.id;

  const { data: stockData } = useQuery({
    queryKey: ['stock', whId],
    queryFn: () => api.get(`/warehouse/${whId}/stock`).then((r) => r.data),
    enabled: !!whId,
    refetchInterval: 30_000,
  });

  const stock = stockData?.data || [];
  const meta = stockData?.meta || {};
  const lowStock = stock.filter((s) => s.low_stock);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ombor</h1>
          <p className="text-gray-500 text-sm mt-1">Real vaqt qoldig'i</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-50 rounded-xl"><Package size={18} className="text-blue-600" /></div>
            <span className="text-sm font-medium text-gray-600">Jami mahsulot</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stock.length}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-50 rounded-xl"><TrendingDown size={18} className="text-green-600" /></div>
            <span className="text-sm font-medium text-gray-600">Ombor qiymati</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatUZS(meta.totalValue || 0)}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-red-50 rounded-xl"><AlertTriangle size={18} className="text-red-600" /></div>
            <span className="text-sm font-medium text-gray-600">Kam qoldiq</span>
          </div>
          <p className="text-2xl font-bold text-red-600">{meta.lowStockCount || 0}</p>
        </div>
      </div>

      {/* Ombor tanlash */}
      {warehouses && warehouses.length > 1 && (
        <div className="flex gap-2 mb-4">
          {warehouses.map((wh) => (
            <button
              key={wh.id}
              onClick={() => setSelectedWh(wh.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                whId === wh.id ? 'bg-primary-600 text-white border-primary-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              📦 {wh.name}
            </button>
          ))}
        </div>
      )}

      {/* Low stock warning */}
      {lowStock.length > 0 && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <AlertTriangle size={18} className="text-red-600 shrink-0" />
          <p className="text-sm text-red-700">
            <strong>{lowStock.length} ta mahsulot</strong> kam qoldi: {lowStock.slice(0, 3).map((s) => s.name).join(', ')}
            {lowStock.length > 3 && ` va yana ${lowStock.length - 3} ta`}
          </p>
        </div>
      )}

      {/* Stock table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left py-3 px-4 font-medium text-gray-600">Mahsulot</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600">SKU</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600">Kategoriya</th>
              <th className="text-right py-3 px-4 font-medium text-gray-600">Jami</th>
              <th className="text-right py-3 px-4 font-medium text-gray-600">Mavjud</th>
              <th className="text-right py-3 px-4 font-medium text-gray-600">Narx</th>
              <th className="text-right py-3 px-4 font-medium text-gray-600">Qiymat</th>
              <th className="text-center py-3 px-4 font-medium text-gray-600">Holat</th>
            </tr>
          </thead>
          <tbody>
            {stock.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">Mahsulot topilmadi</td></tr>
            ) : stock.map((item) => (
              <tr key={item.product_id} className={`border-b border-gray-50 hover:bg-gray-50/50 ${item.low_stock ? 'bg-red-50/30' : ''}`}>
                <td className="py-3 px-4 font-medium text-gray-900">{item.name}</td>
                <td className="py-3 px-4 text-gray-400 font-mono text-xs">{item.sku || '—'}</td>
                <td className="py-3 px-4 text-gray-500">{item.category || '—'}</td>
                <td className="py-3 px-4 text-right text-gray-700">{item.quantity} {item.unit}</td>
                <td className={`py-3 px-4 text-right font-medium ${item.low_stock ? 'text-red-600' : 'text-green-600'}`}>
                  {item.available} {item.unit}
                </td>
                <td className="py-3 px-4 text-right text-gray-700">{formatUZS(item.price)}</td>
                <td className="py-3 px-4 text-right text-gray-700">{formatUZS(item.total_value)}</td>
                <td className="py-3 px-4 text-center">
                  {item.low_stock ? (
                    <span className="badge badge-red">⚠ Kam</span>
                  ) : (
                    <span className="badge badge-green">✓ Normal</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
