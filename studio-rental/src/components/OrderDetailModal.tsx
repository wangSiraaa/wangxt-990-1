import { useState } from 'react';
import { useAppState } from '../context/AppStateContext';
import { Order, OrderDamage, DepositChannel } from '../types';
import { formatMoney, formatDateTime, formatTime, getDurationHours } from '../utils/dateUtils';
import { getStatusLabel, getStatusColor, getDepositChannelLabel } from './StatusBadge';
import { calculateFinalAmount } from '../services/feeService';

interface OrderDetailModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function OrderDetailModal({ order, isOpen, onClose }: OrderDetailModalProps) {
  const { state, confirmDeposit, confirmOrder, startOrder, completeOrder, cancelOrder, rescheduleOrder, updateOrderDamages } = useAppState();
  const { studios, equipments, assistants } = state;
  
  const [showDamageModal, setShowDamageModal] = useState(false);
  const [newDamage, setNewDamage] = useState({ equipmentId: '', description: '', cost: 0 });
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleStartTime, setRescheduleStartTime] = useState('');
  const [rescheduleEndTime, setRescheduleEndTime] = useState('');
  const [showReschedule, setShowReschedule] = useState(false);
  const [error, setError] = useState('');
  const [actualEndTime, setActualEndTime] = useState(order?.endTime || '');

  if (!order || !isOpen) return null;

  const studio = studios.find(s => s.id === order.studioId);
  const finalFees = calculateFinalAmount(order);

  const handleConfirmDeposit = (channel: DepositChannel) => {
    const result = confirmDeposit(order.id, channel);
    if ('error' in result) {
      setError(result.error);
    } else {
      setError('');
    }
  };

  const handleConfirmOrder = () => {
    confirmOrder(order.id);
  };

  const handleStartOrder = () => {
    startOrder(order.id);
  };

  const handleCompleteOrder = () => {
    const result = completeOrder(order.id, actualEndTime || order.endTime);
    if ('error' in result) {
      setError(result.error);
    } else {
      setShowDamageModal(true);
    }
  };

  const handleCancelOrder = () => {
    if (window.confirm('确定要取消此订单吗？')) {
      cancelOrder(order.id);
    }
  };

  const handleReschedule = () => {
    const newStart = `${rescheduleDate}T${rescheduleStartTime}:00`;
    const newEnd = `${rescheduleDate}T${rescheduleEndTime}:00`;
    const result = rescheduleOrder(order.id, newStart, newEnd);
    if ('error' in result) {
      setError(result.error);
    } else {
      setShowReschedule(false);
      setError('');
    }
  };

  const handleAddDamage = () => {
    if (!newDamage.equipmentId || !newDamage.description || newDamage.cost <= 0) return;
    
    const damages = [...order.damages, {
      equipmentId: newDamage.equipmentId,
      description: newDamage.description,
      cost: newDamage.cost,
    }];
    
    updateOrderDamages(order.id, damages);
    setNewDamage({ equipmentId: '', description: '', cost: 0 });
  };

  const handleRemoveDamage = (index: number) => {
    const damages = order.damages.filter((_, i) => i !== index);
    updateOrderDamages(order.id, damages);
  };

  const durationHours = getDurationHours(order.startTime, order.endTime);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-5 border-b border-gray-200 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-gray-800">订单详情</h2>
              <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(order.status)}`}>
                {getStatusLabel(order.status)}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">订单号: {order.orderNo}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {order.affectedByMaintenance && (
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-start gap-2">
                <span className="text-orange-500">⚠️</span>
                <div>
                  <p className="font-medium text-orange-700">受维护日影响</p>
                  <p className="text-sm text-orange-600 mt-1">
                    该订单档期与维护计划冲突，请联系客户改期或协商赔偿。
                  </p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <InfoItem label="客户名称" value={order.customerName} />
            <InfoItem label="联系电话" value={order.customerPhone} />
            {order.photographer && <InfoItem label="摄影师" value={order.photographer />} />
            <InfoItem
              label="棚位"
              value={studio?.name || '-'}
            />
          </div>

          <div className="bg-gray-50 rounded-xl p-4">
            <h4 className="font-medium text-gray-800 mb-3">档期信息</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">开始时间:</span>
                <p className="font-medium text-gray-800">{formatDateTime(order.startTime)}</p>
              </div>
              <div>
                <span className="text-gray-500">结束时间:</span>
                <p className="font-medium text-gray-800">{formatDateTime(order.endTime)}</p>
              </div>
              <div>
                <span className="text-gray-500">拍摄时长:</span>
                <p className="font-medium text-gray-800">{durationHours.toFixed(1)} 小时</p>
              </div>
              <div>
                <span className="text-gray-500">布置/清场:</span>
                <p className="font-medium text-gray-800">{order.setupTime}h / {order.teardownTime}h</p>
              </div>
            </div>
          </div>

          {order.equipments.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-800 mb-2">租赁设备</h4>
              <div className="bg-gray-50 rounded-lg divide-y divide-gray-200">
                {order.equipments.map(eq => {
                  const equipment = equipments.find(e => e.id === eq.equipmentId);
                  return (
                    <div key={eq.equipmentId} className="p-3 flex justify-between items-center">
                      <div>
                        <span className="font-medium text-gray-800 text-sm">{equipment?.name || eq.equipmentId}</span>
                        <span className="text-gray-500 text-sm ml-2">x{eq.quantity}</span>
                      </div>
                      <span className="text-sm text-blue-600">
                        {formatMoney((equipment?.pricePerHour || 0) * eq.quantity * durationHours)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {order.assistantIds.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-800 mb-2">服务人员</h4>
              <div className="flex flex-wrap gap-2">
                {order.assistantIds.map(id => {
                  const asst = assistants.find(a => a.id === id);
                  return (
                    <span key={id} className="px-3 py-1.5 bg-gray-100 rounded-lg text-sm">
                      {asst?.name} <span className="text-gray-500">({asst?.role})</span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          <div className="bg-blue-50 rounded-xl p-4">
            <h4 className="font-medium text-gray-800 mb-3">费用明细</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">棚位费</span>
                <span>{formatMoney(order.baseAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">设备费</span>
                <span>{formatMoney(order.equipmentAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">人员费</span>
                <span>{formatMoney(order.assistantAmount)}</span>
              </div>
              {order.overtimeFee > 0 && (
                <div className="flex justify-between text-orange-600">
                  <span>超时费 ({order.overtimeHours}小时)</span>
                  <span>{formatMoney(order.overtimeFee)}</span>
                </div>
              )}
              {order.penaltyFee > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>违约金</span>
                  <span>{formatMoney(order.penaltyFee)}</span>
                </div>
              )}
              {order.damageFee > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>设备损坏赔偿</span>
                  <span>{formatMoney(order.damageFee)}</span>
                </div>
              )}
              <div className="border-t border-blue-200 pt-2 flex justify-between font-bold">
                <span>总计</span>
                <span className="text-blue-600 text-lg">{formatMoney(finalFees.totalAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">已付押金</span>
                <span className={order.depositConfirmedAt ? 'text-green-600' : 'text-orange-500'}>
                  {formatMoney(order.depositAmount)}
                  {order.depositConfirmedAt ? ' (已付)' : ' (未付)'}
                </span>
              </div>
              <div className="flex justify-between text-sm font-medium">
                <span className="text-gray-600">待付尾款</span>
                <span className="text-gray-800">{formatMoney(finalFees.remainingAmount)}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">押金支付方式:</span>
              <p className="font-medium text-gray-800">{getDepositChannelLabel(order.depositChannel)}</p>
            </div>
            {order.depositConfirmedAt && (
              <div>
                <span className="text-gray-500">押金确认时间:</span>
                <p className="font-medium text-gray-800">{formatDateTime(order.depositConfirmedAt)}</p>
              </div>
            )}
            {order.depositExpiresAt && (
              <div>
                <span className="text-gray-500">押金支付截止:</span>
                <p className="font-medium text-orange-600">{formatDateTime(order.depositExpiresAt)}</p>
              </div>
            )}
          </div>

          {order.invoiceRequired && (
            <div className="bg-gray-50 rounded-lg p-3">
              <h5 className="font-medium text-gray-800 text-sm mb-2">发票信息</h5>
              <p className="text-sm text-gray-600">抬头: {order.invoiceInfo?.title || '-'}</p>
              <p className="text-sm text-gray-600">税号: {order.invoiceInfo?.taxNo || '-'}</p>
            </div>
          )}

          {order.notes && (
            <div>
              <h5 className="font-medium text-gray-800 text-sm mb-1">备注</h5>
              <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{order.notes}</p>
            </div>
          )}

          {order.damages.length > 0 && (
            <div>
              <h5 className="font-medium text-gray-800 text-sm mb-2">设备损坏记录</h5>
              <div className="space-y-2">
                {order.damages.map((dmg, i) => {
                  const eq = equipments.find(e => e.id === dmg.equipmentId);
                  return (
                    <div key={i} className="flex justify-between items-center p-2 bg-red-50 rounded text-sm">
                      <span>{eq?.name || dmg.equipmentId}: {dmg.description}</span>
                      <span className="text-red-600 font-medium">{formatMoney(dmg.cost)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-200 bg-gray-50 flex flex-wrap gap-2 justify-end">
          {(order.status === 'temp' || order.status === 'pending_deposit') && (
            <button
              onClick={() => handleConfirmDeposit('alipay')}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
            >
              确认押金到账
            </button>
          )}
          
          {order.status === 'deposit_confirmed' && (
            <button
              onClick={handleConfirmOrder}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              确认订单
            </button>
          )}
          
          {order.status === 'confirmed' && (
            <button
              onClick={handleStartOrder}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
            >
              开始使用
            </button>
          )}
          
          {order.status === 'in_progress' && (
            <button
              onClick={() => setActualEndTime(order.endTime)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
              onClickCapture={handleCompleteOrder}
            >
              完成结算
            </button>
          )}
          
          {(order.status === 'confirmed' || order.status === 'deposit_confirmed' || order.status === 'pending_deposit') && (
            <button
              onClick={() => setShowReschedule(true)}
              className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors text-sm"
            >
              改期
            </button>
          )}
          
          {(order.status !== 'completed' && order.status !== 'cancelled' && order.status !== 'expired') && (
            <button
              onClick={handleCancelOrder}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm"
            >
              取消订单
            </button>
          )}
          
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm"
          >
            关闭
          </button>
        </div>

        {showReschedule && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-60">
            <div className="bg-white rounded-xl p-5 w-full max-w-md">
              <h3 className="text-lg font-bold mb-4">订单改期</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">新日期</label>
                  <input
                    type="date"
                    value={rescheduleDate}
                    onChange={e => setRescheduleDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">开始时间</label>
                    <input
                      type="time"
                      value={rescheduleStartTime}
                      onChange={e => setRescheduleStartTime(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">结束时间</label>
                    <input
                      type="time"
                      value={rescheduleEndTime}
                      onChange={e => setRescheduleEndTime(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-5">
                <button
                  onClick={() => setShowReschedule(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  取消
                </button>
                <button
                  onClick={handleReschedule}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  确认改期
                </button>
              </div>
            </div>
          </div>
        )}

        {showDamageModal && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-60">
            <div className="bg-white rounded-xl p-5 w-full max-w-md">
              <h3 className="text-lg font-bold mb-4">设备损坏登记</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">损坏设备</label>
                  <select
                    value={newDamage.equipmentId}
                    onChange={e => setNewDamage({ ...newDamage, equipmentId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">请选择</option>
                    {order.equipments.map(eq => {
                      const eqInfo = equipments.find(e => e.id === eq.equipmentId);
                      return (
                        <option key={eq.equipmentId} value={eq.equipmentId}>
                          {eqInfo?.name}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">损坏描述</label>
                  <textarea
                    value={newDamage.description}
                    onChange={e => setNewDamage({ ...newDamage, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">赔偿金额 (元)</label>
                  <input
                    type="number"
                    value={newDamage.cost}
                    onChange={e => setNewDamage({ ...newDamage, cost: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-5">
                <button
                  onClick={() => setShowDamageModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  完成
                </button>
                <button
                  onClick={handleAddDamage}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                >
                  添加
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-sm text-gray-500">{label}</span>
      <p className="font-medium text-gray-800">{value}</p>
    </div>
  );
}
