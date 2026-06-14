import { useState } from 'react';
import { useAppState } from '../context/AppStateContext';
import { EquipmentCategory } from '../types';
import { formatMoney } from '../utils/dateUtils';

const categoryLabels: Record<EquipmentCategory | 'all', string> = {
  all: '全部',
  lighting: '灯光设备',
  set: '布景背景',
  prop: '道具',
};

export default function EquipmentPage() {
  const { state } = useAppState();
  const { equipments, orders } = state;
  const [category, setCategory] = useState<EquipmentCategory | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredEquipments = equipments.filter(eq => {
    if (category !== 'all' && eq.category !== category) return false;
    if (searchTerm && !eq.name.includes(searchTerm)) return false;
    return true;
  });

  const getUsedQuantity = (equipmentId: string) => {
    const now = new Date();
    let used = 0;
    
    for (const order of orders) {
      if (order.status === 'expired' || order.status === 'cancelled') continue;
      
      const orderEq = order.equipments.find(e => e.equipmentId === equipmentId);
      if (!orderEq) continue;
      
      const start = new Date(order.startTime);
      const end = new Date(order.endTime);
      
      if (now >= start && now <= end) {
        used += orderEq.quantity;
      }
    }
    
    return used;
  };

  const categories: (EquipmentCategory | 'all')[] = ['all', 'lighting', 'set', 'prop'];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">设备管理</h2>
        <p className="text-gray-500 mt-1">管理灯光、布景、道具等设备库存与使用情况</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex gap-2">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  category === cat
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {categoryLabels[cat]}
              </button>
            ))}
          </div>
          
          <div className="relative">
            <input
              type="text"
              placeholder="搜索设备..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredEquipments.map(equipment => {
        const usedQty = getUsedQuantity(equipment.id);
        const availableQty = equipment.quantity - usedQty;
        
        return (
          <div
            key={equipment.id}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-800">{equipment.name}</h3>
                <p className="text-sm text-gray-500 mt-1">{equipment.description}</p>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                availableQty > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {availableQty > 0 ? '可租' : '已租完'}
              </span>
            </div>
            
            <div className="flex flex-wrap gap-1 mb-3">
              {equipment.tags.map(tag => (
                <span
                  key={tag}
                  className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
            
            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              <div className="text-lg font-bold text-blue-600">
                {formatMoney(equipment.pricePerHour)}
                <span className="text-sm font-normal text-gray-500">/小时</span>
              </div>
              <div className="text-sm">
                <span className="text-gray-500">库存: </span>
                <span className="font-medium text-gray-800">{equipment.quantity}</span>
                <span className="text-gray-400 mx-1">/</span>
                <span className={availableQty > 0 ? 'text-green-600' : 'text-red-600'}>
                  {availableQty}可用
                </span>
              </div>
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}
