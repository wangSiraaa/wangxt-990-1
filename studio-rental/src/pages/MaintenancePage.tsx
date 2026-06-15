import { useState } from 'react';
import { useAppState } from '../context/AppStateContext';
import { formatDate } from '../utils/dateUtils';
import OrderDetailModal from '../components/OrderDetailModal';
import type { Order } from '../types';

export default function MaintenancePage() {
  const { state, addMaintenanceDay, removeMaintenanceDay } = useAppState();
  const { maintenanceDays, studios, orders } = state;
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedStudioId, setSelectedStudioId] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderDetail, setShowOrderDetail] = useState(false);

  const handleAddMaintenance = () => {
    setError('');
    
    if (!selectedStudioId || !selectedDate || !reason) {
      setError('请填写完整信息');
      return;
    }
    
    const result = addMaintenanceDay(selectedStudioId, selectedDate, reason);
    if (result.error) {
      setError(result.error);
    } else {
      setShowAddModal(false);
      setSelectedStudioId('');
      setSelectedDate('');
      setReason('');
    }
  };

  const handleRemove = (id: string) => {
    if (window.confirm('确定要删除此维护计划吗？受影响的订单将恢复正常状态。')) {
      removeMaintenanceDay(id);
    }
  };

  const getAffectedOrders = (maintId: string) => {
    return orders.filter(o => o.affectedByMaintenance === maintId);
  };

  const sortedMaintenanceDays = [...maintenanceDays].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">维护计划</h2>
          <p className="text-gray-500 mt-1">管理棚位维护日，受影响订单将自动标记并提示改期</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
        >
          <span>+</span>
          添加维护日
        </button>
      </div>

      <div className="space-y-4">
        {sortedMaintenanceDays.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <div className="text-4xl mb-3">🔧</div>
            <p className="text-gray-500">暂无维护计划</p>
          </div>
        ) : (
          sortedMaintenanceDays.map(maint => {
            const studio = studios.find(s => s.id === maint.studioId);
            const affectedOrders = getAffectedOrders(maint.id);
            
            return (
              <div
                key={maint.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-5"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div
                      className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold flex-col"
                      style={{ backgroundColor: studio?.color || '#6b7280' }}
                    >
                      <span className="text-xs opacity-80">
                        {new Date(maint.date).toLocaleDateString('zh-CN', { month: 'short' })}
                      </span>
                      <span className="text-xl">
                        {new Date(maint.date).getDate()}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">
                        {studio?.name}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">{maint.reason}</p>
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        {affectedOrders.length > 0 ? (
                          <span className="text-orange-600 font-medium">
                            ⚠️ 影响 {affectedOrders.length} 个订单
                          </span>
                        ) : (
                          <span className="text-green-600">✓ 无订单受影响</span>
                        )}
                        <span className="text-gray-400">|</span>
                        <span className="text-gray-500">
                          创建于 {formatDate(maint.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleRemove(maint.id)}
                    className="text-red-500 hover:text-red-700 text-sm font-medium"
                  >
                    删除
                  </button>
                </div>
                
                {affectedOrders.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">受影响订单</h4>
                    <div className="space-y-2">
                      {affectedOrders.map(order => (
                        <div
                          key={order.id}
                          className="flex items-center justify-between p-3 bg-orange-50 rounded-lg cursor-pointer hover:bg-orange-100 transition-colors"
                          onClick={() => {
                            setSelectedOrder(order);
                            setShowOrderDetail(true);
                          }}
                        >
                          <div>
                            <span className="font-medium text-gray-800 text-sm">
                              {order.orderNo}
                            </span>
                            <span className="text-gray-500 text-sm ml-2">
                              {order.customerName}
                            </span>
                          </div>
                          <div className="text-sm text-gray-600">
                            {formatDate(order.startTime)} - {formatDate(order.endTime)}
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      💡 点击订单可查看详情并进行改期或赔偿处理
                    </p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-5 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-800">添加维护日</h3>
            </div>
            
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">棚位</label>
                <select
                  value={selectedStudioId}
                  onChange={e => setSelectedStudioId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">请选择棚位</option>
                  {studios.map(studio => (
                    <option key={studio.id} value={studio.id}>
                      {studio.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">维护日期</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">维护原因</label>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="请输入维护原因"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>
              
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                  {error}
                </div>
              )}
            </div>
            
            <div className="px-5 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleAddMaintenance}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                添加
              </button>
            </div>
          </div>
        </div>
      )}

      {showOrderDetail && selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          isOpen={showOrderDetail}
          onClose={() => {
            setShowOrderDetail(false);
            setSelectedOrder(null);
          }}
        />
      )}
    </div>
  );
}
