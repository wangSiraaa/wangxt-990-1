import { useState } from 'react';
import { useAppState } from '../context/AppStateContext';
import { formatDate, formatMoney } from '../utils/dateUtils';
import { getStatusLabel, getStatusColor } from '../components/StatusBadge';
import OrderDetailModal from '../components/OrderDetailModal';
import type { Order, MaintenanceImpactOptionType, DepositChannel } from '../types';

const MAINT_OPTION_LABELS: Record<MaintenanceImpactOptionType, string> = {
  reschedule: '改期',
  change_studio: '换棚',
  reduce_config: '减配',
  compensation: '赔付',
};

const MAINT_OPTION_ICONS: Record<MaintenanceImpactOptionType, string> = {
  reschedule: '📅',
  change_studio: '🏠',
  reduce_config: '📉',
  compensation: '💰',
};

const MAINT_OPTION_DESCS: Record<MaintenanceImpactOptionType, string> = {
  reschedule: '将订单移至新的档期时间',
  change_studio: '更换到其他可用棚位',
  reduce_config: '减少设备/人员配置',
  compensation: '维持原安排，运营赔付差价',
};

export default function MaintenancePage() {
  const { state, addMaintenanceDay, removeMaintenanceDay, handleMaintenanceImpact } = useAppState();
  const { maintenanceDays, studios, orders, equipments } = state;

  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedStudioId, setSelectedStudioId] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderDetail, setShowOrderDetail] = useState(false);
  const [handlingOrderId, setHandlingOrderId] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<MaintenanceImpactOptionType | null>(null);

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

  const handleSelectOption = (orderId: string, optionType: MaintenanceImpactOptionType) => {
    setSelectedOption(optionType);
    setHandlingOrderId(orderId);
  };

  const handleConfirmOption = (orderId: string) => {
    if (!selectedOption) return;
    const order = orders.find(o => o.id === orderId);
    const optionData = order?.maintenanceImpact?.options.find(o => o.type === selectedOption);
    const result = handleMaintenanceImpact(orderId, selectedOption, optionData ? {
      newStartTime: optionData.newStartTime,
      newEndTime: optionData.newEndTime,
      newStudioId: optionData.newStudioId,
      compensationAmount: optionData.compensationAmount,
    } : undefined);
    if ('error' in result) {
      setError(result.error);
    } else {
      setHandlingOrderId(null);
      setSelectedOption(null);
      setError('');
    }
  };

  const sortedMaintenanceDays = [...maintenanceDays].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">维护计划</h2>
          <p className="text-gray-500 mt-1">管理棚位维护日，受影响订单可改期/换棚/减配/赔付</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
        >
          <span>+</span>
          添加维护日
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>
      )}

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
              <div key={maint.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
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
                      <h3 className="font-semibold text-gray-800">{studio?.name}</h3>
                      <p className="text-sm text-gray-500 mt-1">{maint.reason}</p>
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        {affectedOrders.length > 0 ? (
                          <span className="text-orange-600 font-medium">⚠️ 影响 {affectedOrders.length} 个订单</span>
                        ) : (
                          <span className="text-green-600">✓ 无订单受影响</span>
                        )}
                        <span className="text-gray-400">|</span>
                        <span className="text-gray-500">创建于 {formatDate(maint.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => handleRemove(maint.id)} className="text-red-500 hover:text-red-700 text-sm font-medium">删除</button>
                </div>

                {affectedOrders.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">受影响订单</h4>
                    <div className="space-y-3">
                      {affectedOrders.map(order => {
                        const isHandled = order.maintenanceImpact?.selectedOption;
                        const isHandling = handlingOrderId === order.id;

                        return (
                          <div key={order.id} className="bg-orange-50 rounded-lg overflow-hidden">
                            <div
                              className="flex items-center justify-between p-3 cursor-pointer hover:bg-orange-100 transition-colors"
                              onClick={() => { setSelectedOrder(order); setShowOrderDetail(true); }}
                            >
                              <div className="flex items-center gap-3">
                                <span className="font-medium text-gray-800 text-sm">{order.orderNo}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full border ${getStatusColor(order.status)}`}>
                                  {getStatusLabel(order.status)}
                                </span>
                                <span className="text-gray-500 text-sm">{order.customerName}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-500">
                                  {formatDate(order.startTime)} - {formatDate(order.endTime)}
                                </span>
                                {order.finalPaymentCollected && (
                                  <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">尾款已收</span>
                                )}
                                {order.priceLocked && (
                                  <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">🔒</span>
                                )}
                              </div>
                            </div>

                            {isHandled ? (
                              <div className="px-3 py-2 bg-green-50 border-t border-green-100">
                                <div className="flex items-center gap-2">
                                  <span>✅</span>
                                  <span className="text-sm text-green-700 font-medium">
                                    已处理: {MAINT_OPTION_LABELS[order.maintenanceImpact!.selectedOption!]}
                                  </span>
                                  {order.maintenanceImpact!.handledAt && (
                                    <span className="text-xs text-green-500">
                                      ({new Date(order.maintenanceImpact!.handledAt).toLocaleString('zh-CN')})
                                    </span>
                                  )}
                                  {order.maintenanceImpact!.selectedOption === 'compensation' && order.maintenanceImpact!.options.find(o => o.type === 'compensation')?.compensationAmount && (
                                    <span className="text-xs text-red-600">
                                      赔付: {formatMoney(order.maintenanceImpact!.options.find(o => o.type === 'compensation')!.compensationAmount!)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="p-3 border-t border-orange-100">
                                <p className="text-sm text-orange-700 font-medium mb-2">请选择处理方式:</p>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                  {([
                                    'reschedule',
                                    'change_studio',
                                    'reduce_config',
                                    'compensation',
                                  ] as MaintenanceImpactOptionType[]).map(optType => {
                                    const optData = order.maintenanceImpact?.options.find(o => o.type === optType);
                                    return (
                                      <button
                                        key={optType}
                                        onClick={(e) => { e.stopPropagation(); handleSelectOption(order.id, optType); }}
                                        className={`p-2.5 rounded-lg border-2 text-left transition-all ${
                                          isHandling && selectedOption === optType
                                            ? 'border-blue-500 bg-blue-50'
                                            : 'border-gray-200 bg-white hover:border-blue-300'
                                        } ${optData ? '' : 'opacity-50'}`}
                                      >
                                        <div className="flex items-center gap-1.5 mb-1">
                                          <span className="text-base">{MAINT_OPTION_ICONS[optType]}</span>
                                          <span className="font-medium text-gray-800 text-sm">{MAINT_OPTION_LABELS[optType]}</span>
                                        </div>
                                        <p className="text-xs text-gray-500">{optData?.description || MAINT_OPTION_DESCS[optType]}</p>
                                        {optData?.priceDiff !== 0 && optData && (
                                          <p className={`text-xs mt-0.5 ${optData.priceDiff < 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {optData.priceDiff > 0 ? '+' : ''}{formatMoney(optData.priceDiff)}
                                          </p>
                                        )}
                                        {optType === 'compensation' && optData?.compensationAmount && (
                                          <p className="text-xs text-red-600 mt-0.5">赔付: {formatMoney(optData.compensationAmount)}</p>
                                        )}
                                        {optType === 'change_studio' && optData?.newStudioId && (
                                          <p className="text-xs text-blue-600 mt-0.5">
                                            → {studios.find(s => s.id === optData.newStudioId)?.name}
                                          </p>
                                        )}
                                        {optType === 'reschedule' && optData?.newStartTime && (
                                          <p className="text-xs text-blue-600 mt-0.5">
                                            → {formatDate(optData.newStartTime)}
                                          </p>
                                        )}
                                        {order.finalPaymentCollected && (optType === 'reduce_config' || optType === 'reschedule') && optData?.priceDiff && optData.priceDiff < 0 && (
                                          <p className="text-xs text-amber-600 mt-0.5">⚠ 尾款已收，不可降价</p>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                                {isHandling && selectedOption && (
                                  <div className="mt-3 flex items-center justify-between">
                                    <span className="text-sm text-gray-600">
                                      已选择: <strong>{MAINT_OPTION_ICONS[selectedOption]} {MAINT_OPTION_LABELS[selectedOption]}</strong>
                                    </span>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleConfirmOption(order.id); }}
                                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                                    >
                                      确认处理
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
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
                    <option key={studio.id} value={studio.id}>{studio.name}</option>
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
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>
              )}
            </div>
            <div className="px-5 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors">取消</button>
              <button onClick={handleAddMaintenance} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">添加</button>
            </div>
          </div>
        </div>
      )}

      {showOrderDetail && selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          isOpen={showOrderDetail}
          onClose={() => { setShowOrderDetail(false); setSelectedOrder(null); }}
        />
      )}
    </div>
  );
}
