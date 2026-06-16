import { useState, useEffect, useMemo } from 'react';
import { useAppState } from '../context/AppStateContext';
import type { Order, DepositChannel, DepositType, OrderDamage, MaintenanceImpactOptionType } from '../types';
import { formatMoney, formatDateTime, formatTime, getDurationHours } from '../utils/dateUtils';
import { getStatusLabel, getStatusColor, getDepositChannelLabel } from './StatusBadge';
import { calculateFinalAmount, getDepositReleasePlan } from '../services/feeService';

interface OrderDetailModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
}

const DEPOSIT_TYPE_LABELS: Record<DepositType, string> = {
  studio: '棚位押金',
  equipment: '设备押金',
  overtime_risk: '超时风险冻结',
};

const DEPOSIT_STATUS_LABELS: Record<string, string> = {
  frozen: '冻结中',
  released: '已释放',
  partially_released: '部分释放',
  deducted: '已扣减',
};

const DEPOSIT_STATUS_COLORS: Record<string, string> = {
  frozen: 'bg-blue-100 text-blue-700',
  released: 'bg-green-100 text-green-700',
  partially_released: 'bg-amber-100 text-amber-700',
  deducted: 'bg-red-100 text-red-700',
};

const DAMAGE_STATUS_LABELS: Record<string, string> = {
  pending: '待认定',
  confirmed: '已认定',
  resolved: '已结清',
};

const DAMAGE_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-orange-100 text-orange-700',
  confirmed: 'bg-red-100 text-red-700',
  resolved: 'bg-green-100 text-green-700',
};

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

export default function OrderDetailModal({ order, isOpen, onClose }: OrderDetailModalProps) {
  const {
    state,
    confirmDeposit,
    collectFinalPayment,
    confirmOrder,
    startOrder,
    completeOrder,
    releaseDeposit,
    resolveDamage,
    cancelOrder,
    rescheduleOrder,
    handleMaintenanceImpact,
    addEquipmentToOrder,
    updateOrderDamages,
  } = useAppState();
  const { studios, equipments, assistants } = state;

  const [error, setError] = useState('');
  const [actualEndTime, setActualEndTime] = useState('');
  const [showDamageModal, setShowDamageModal] = useState(false);
  const [newDamage, setNewDamage] = useState({ equipmentId: '', description: '', cost: 0 });
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleStartTime, setRescheduleStartTime] = useState('');
  const [rescheduleEndTime, setRescheduleEndTime] = useState('');
  const [showFinalPayment, setShowFinalPayment] = useState(false);
  const [finalPaymentChannel, setFinalPaymentChannel] = useState<DepositChannel>('alipay');
  const [showAddEquipment, setShowAddEquipment] = useState(false);
  const [addEqSlotId, setAddEqSlotId] = useState<string | null>(null);
  const [addEqId, setAddEqId] = useState('');
  const [addEqQty, setAddEqQty] = useState(1);
  const [showResolveDamage, setShowResolveDamage] = useState<string | null>(null);
  const [resolveCost, setResolveCost] = useState(0);
  const [selectedMaintOption, setSelectedMaintOption] = useState<MaintenanceImpactOptionType | null>(null);
  const [activeSlotTab, setActiveSlotTab] = useState(0);

  useEffect(() => {
    if (order && order.actualEndTime && actualEndTime === '') {
      setActualEndTime(order.actualEndTime);
    }
  }, [order, actualEndTime]);

  useEffect(() => {
    setError('');
    setActiveSlotTab(0);
    setSelectedMaintOption(null);
  }, [order?.id]);

  if (!order || !isOpen) return null;

  const finalFees = calculateFinalAmount(order);
  const depositPlan = getDepositReleasePlan(order);
  const activeSlots = order.slots && order.slots.length > 0 ? order.slots : [];

  const handleConfirmDeposit = (channel: DepositChannel) => {
    const result = confirmDeposit(order.id, channel);
    if ('error' in result) setError(result.error);
    else setError('');
  };

  const handleConfirmOrder = () => {
    confirmOrder(order.id);
  };

  const handleStartOrder = () => {
    startOrder(order.id);
  };

  const handleCompleteOrder = () => {
    const result = completeOrder(order.id, actualEndTime || order.endTime);
    if ('error' in result) setError(result.error);
    else setShowDamageModal(true);
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
    if ('error' in result) setError(result.error);
    else { setShowReschedule(false); setError(''); }
  };

  const handleCollectFinalPayment = () => {
    const result = collectFinalPayment(order.id, finalPaymentChannel);
    if ('error' in result) setError(result.error);
    else { setShowFinalPayment(false); setError(''); }
  };

  const handleReleaseDeposit = (depositType: DepositType, releaseAmount?: number) => {
    const result = releaseDeposit(order.id, depositType, releaseAmount);
    if ('error' in result) setError(result.error);
    else setError('');
  };

  const handleResolveDamage = (damageId: string) => {
    const result = resolveDamage(order.id, damageId, resolveCost);
    if ('error' in result) setError(result.error);
    else { setShowResolveDamage(null); setError(''); }
  };

  const handleAddDamage = () => {
    if (!newDamage.equipmentId || !newDamage.description || newDamage.cost <= 0) return;
    const damages: OrderDamage[] = [...order.damages, {
      id: `dmg-${Date.now()}`,
      equipmentId: newDamage.equipmentId,
      description: newDamage.description,
      cost: newDamage.cost,
      status: 'pending',
      reportedAt: new Date().toISOString(),
      slotId: addEqSlotId || undefined,
    }];
    updateOrderDamages(order.id, damages);
    setNewDamage({ equipmentId: '', description: '', cost: 0 });
  };

  const handleAddEquipment = () => {
    if (!addEqId || addEqQty <= 0) return;
    const result = addEquipmentToOrder(order.id, addEqSlotId, addEqId, addEqQty);
    if ('error' in result) setError(result.error);
    else { setShowAddEquipment(false); setAddEqId(''); setAddEqQty(1); setError(''); }
  };

  const handleMaintenanceOption = () => {
    if (!selectedMaintOption) return;
    const optionData = order.maintenanceImpact?.options.find(o => o.type === selectedMaintOption);
    const result = handleMaintenanceImpact(order.id, selectedMaintOption, optionData ? {
      newStartTime: optionData.newStartTime,
      newEndTime: optionData.newEndTime,
      newStudioId: optionData.newStudioId,
      compensationAmount: optionData.compensationAmount,
    } : undefined);
    if ('error' in result) setError(result.error);
    else { setSelectedMaintOption(null); setError(''); }
  };

  const allSlotEquipments = useMemo(() => {
    const eqIds = new Set<string>();
    if (activeSlots.length > 0) {
      activeSlots.forEach(s => s.equipments.forEach(e => eqIds.add(e.equipmentId)));
    } else {
      order.equipments.forEach(e => eqIds.add(e.equipmentId));
    }
    return Array.from(eqIds);
  }, [activeSlots, order.equipments]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-5 border-b border-gray-200 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl font-bold text-gray-800">订单详情</h2>
              <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(order.status)}`}>
                {getStatusLabel(order.status)}
              </span>
              {order.priceLocked && (
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-300">
                  🔒 价格锁定
                </span>
              )}
              {order.finalPaymentCollected && (
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-300">
                  ✓ 尾款已收
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">订单号: {order.orderNo}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>
          )}

          {order.affectedByMaintenance && !order.maintenanceImpact?.selectedOption && (
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl">
              <div className="flex items-start gap-2 mb-3">
                <span className="text-orange-500 text-lg">⚠️</span>
                <div>
                  <p className="font-bold text-orange-700">受维护日影响 — 请选择处理方式</p>
                  <p className="text-sm text-orange-600 mt-1">该订单档期与维护计划冲突，请选择以下处理方式之一</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                {(order.maintenanceImpact?.options || []).map(opt => (
                  <button
                    key={opt.type}
                    onClick={() => setSelectedMaintOption(opt.type)}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                      selectedMaintOption === opt.type
                        ? 'border-orange-500 bg-orange-100'
                        : 'border-gray-200 bg-white hover:border-orange-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span>{MAINT_OPTION_ICONS[opt.type]}</span>
                      <span className="font-medium text-gray-800">{MAINT_OPTION_LABELS[opt.type]}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{opt.description}</p>
                    {opt.priceDiff !== 0 && (
                      <p className={`text-xs mt-1 ${opt.priceDiff < 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {opt.priceDiff > 0 ? '+' : ''}{formatMoney(opt.priceDiff)}
                      </p>
                    )}
                    {opt.type === 'compensation' && opt.compensationAmount && (
                      <p className="text-xs text-red-600 mt-1">赔付金额: {formatMoney(opt.compensationAmount)}</p>
                    )}
                    {opt.type === 'change_studio' && opt.newStudioId && (
                      <p className="text-xs text-blue-600 mt-1">
                        替换棚位: {studios.find(s => s.id === opt.newStudioId)?.name || opt.newStudioId}
                      </p>
                    )}
                    {opt.type === 'reschedule' && opt.newStartTime && (
                      <p className="text-xs text-blue-600 mt-1">
                        新档期: {formatDateTime(opt.newStartTime)} - {formatTime(opt.newEndTime || '')}
                      </p>
                    )}
                  </button>
                ))}
              </div>
              {selectedMaintOption && (
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={handleMaintenanceOption}
                    className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm"
                  >
                    确认选择: {MAINT_OPTION_LABELS[selectedMaintOption]}
                  </button>
                </div>
              )}
            </div>
          )}

          {order.maintenanceImpact?.selectedOption && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2">
                <span>✅</span>
                <div>
                  <p className="font-medium text-green-700">
                    维护影响已处理: {MAINT_OPTION_LABELS[order.maintenanceImpact.selectedOption]}
                  </p>
                  {order.maintenanceImpact.handledAt && (
                    <p className="text-xs text-green-600">处理时间: {formatDateTime(order.maintenanceImpact.handledAt)}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <InfoItem label="客户名称" value={order.customerName} />
            <InfoItem label="联系电话" value={order.customerPhone} />
            {order.photographer && <InfoItem label="摄影师" value={order.photographer} />}
            {activeSlots.length <= 1 && (
              <InfoItem label="棚位" value={studios.find(s => s.id === order.studioId)?.name || '-'} />
            )}
          </div>

          {activeSlots.length > 0 ? (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-800">预约时段 ({activeSlots.length}个)</h4>
                {order.status === 'in_progress' && (
                  <button
                    onClick={() => { setShowAddEquipment(true); setAddEqSlotId(null); }}
                    className="text-xs px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
                  >
                    + 追加设备
                  </button>
                )}
              </div>
              <div className="flex gap-1 mb-3 overflow-x-auto">
                {activeSlots.map((slot, i) => (
                  <button
                    key={slot.id}
                    onClick={() => setActiveSlotTab(i)}
                    className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-all ${
                      activeSlotTab === i
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {slot.sceneName || `时段${i + 1}`}
                    <span className="ml-1 text-xs opacity-70">
                      {studios.find(s => s.id === slot.studioId)?.name?.slice(0, 2)}
                    </span>
                  </button>
                ))}
              </div>
              {activeSlots.map((slot, i) => (
                <div key={slot.id} className={activeSlotTab === i ? '' : 'hidden'}>
                  <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800">
                          {studios.find(s => s.id === slot.studioId)?.name || '-'}
                        </span>
                        {slot.sceneName && (
                          <span className="text-sm text-gray-500">— {slot.sceneName}</span>
                        )}
                      </div>
                      {order.status === 'in_progress' && (
                        <button
                          onClick={() => { setShowAddEquipment(true); setAddEqSlotId(slot.id); }}
                          className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                        >
                          + 追加
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-500">开始:</span>
                        <p className="font-medium text-gray-800">{formatDateTime(slot.startTime)}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">结束:</span>
                        <p className="font-medium text-gray-800">{formatDateTime(slot.endTime)}</p>
                      </div>
                    </div>

                    {slot.phases && slot.phases.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1.5">资源占用时段</p>
                        <div className="flex gap-0.5 h-8 rounded-lg overflow-hidden">
                          {slot.phases.map((phase, pi) => {
                            const totalPhaseHours = slot.phases.reduce((s, p) => s + p.hours, 0);
                            const widthPct = totalPhaseHours > 0 ? (phase.hours / totalPhaseHours) * 100 : 33;
                            const bgColor = phase.type === 'setup' ? 'bg-amber-400' : phase.type === 'shooting' ? 'bg-blue-500' : 'bg-gray-400';
                            const label = phase.type === 'setup' ? '布置' : phase.type === 'shooting' ? '拍摄' : '清场';
                            return (
                              <div
                                key={pi}
                                className={`${bgColor} flex items-center justify-center text-white text-xs font-medium`}
                                style={{ width: `${widthPct}%` }}
                                title={`${label}: ${formatTime(phase.startTime)} - ${formatTime(phase.endTime)} (${phase.hours.toFixed(1)}h)`}
                              >
                                {label} {phase.hours.toFixed(1)}h
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex gap-3 mt-1">
                          <span className="text-xs flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block"></span> 布置期</span>
                          <span className="text-xs flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span> 拍摄期</span>
                          <span className="text-xs flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400 inline-block"></span> 清场期</span>
                        </div>
                      </div>
                    )}

                    {slot.sceneNotes && (
                      <p className="text-xs text-gray-500 bg-white rounded p-2">场景备注: {slot.sceneNotes}</p>
                    )}

                    {slot.equipments.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">时段设备</p>
                        <div className="flex flex-wrap gap-1.5">
                          {slot.equipments.map(eq => {
                            const eqInfo = equipments.find(e => e.id === eq.equipmentId);
                            return (
                              <span key={eq.equipmentId} className={`px-2 py-1 rounded text-xs ${eq.addedMidShoot ? 'bg-orange-100 text-orange-700 border border-orange-200' : 'bg-gray-100 text-gray-700'}`}>
                                {eqInfo?.name || eq.equipmentId} x{eq.quantity}
                                {eq.addedMidShoot && <span className="ml-1">(追加)</span>}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {slot.assistantIds.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">时段人员</p>
                        <div className="flex flex-wrap gap-1.5">
                          {slot.assistantIds.map(id => {
                            const asst = assistants.find(a => a.id === id);
                            return (
                              <span key={id} className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs">
                                {asst?.name} ({asst?.role})
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {slot.overtimeHours > 0 && (
                      <div className="p-2 bg-orange-50 rounded-lg text-sm">
                        <span className="text-orange-600 font-medium">超时 {slot.overtimeHours}h</span>
                        <span className="text-orange-500 ml-2">{formatMoney(slot.overtimeFee)}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t border-gray-200">
                      <div className="text-center">
                        <p className="text-gray-500">棚位费</p>
                        <p className="font-medium text-gray-800">{formatMoney(slot.baseAmount)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-gray-500">设备费</p>
                        <p className="font-medium text-gray-800">{formatMoney(slot.equipmentAmount)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-gray-500">人员费</p>
                        <p className="font-medium text-gray-800">{formatMoney(slot.assistantAmount)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
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
                  <p className="font-medium text-gray-800">{getDurationHours(order.startTime, order.endTime).toFixed(1)} 小时</p>
                </div>
                <div>
                  <span className="text-gray-500">布置/清场:</span>
                  <p className="font-medium text-gray-800">{order.setupTime}h / {order.teardownTime}h</p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-blue-50 rounded-xl p-4">
            <h4 className="font-medium text-gray-800 mb-3">费用明细</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">棚位费</span>
                <span>{formatMoney(finalFees.baseAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">设备费</span>
                <span>{formatMoney(finalFees.equipmentAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">人员费</span>
                <span>{formatMoney(finalFees.assistantAmount)}</span>
              </div>
              {finalFees.overtimeFee > 0 && (
                <div className="flex justify-between text-orange-600">
                  <span>超时费 ({finalFees.overtimeHours}小时)</span>
                  <span>{formatMoney(finalFees.overtimeFee)}</span>
                </div>
              )}
              {order.penaltyFee > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>违约金</span>
                  <span>{formatMoney(order.penaltyFee)}</span>
                </div>
              )}
              {finalFees.damageFee > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>设备损坏赔偿</span>
                  <span>{formatMoney(finalFees.damageFee)}</span>
                </div>
              )}
              <div className="border-t border-blue-200 pt-2 flex justify-between font-bold">
                <span>总计</span>
                <span className="text-blue-600 text-lg">{formatMoney(finalFees.totalAmount)}</span>
              </div>
            </div>
          </div>

          <div className="bg-indigo-50 rounded-xl p-4">
            <h4 className="font-medium text-gray-800 mb-3">押金分段</h4>
            {order.deposits.length > 0 ? (
              <div className="space-y-3">
                {order.deposits.map(dep => (
                  <div key={dep.id} className="bg-white rounded-lg p-3 border border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800 text-sm">{DEPOSIT_TYPE_LABELS[dep.type]}</span>
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${DEPOSIT_STATUS_COLORS[dep.status]}`}>
                          {DEPOSIT_STATUS_LABELS[dep.status]}
                        </span>
                      </div>
                      <span className="font-bold text-gray-800">{formatMoney(dep.amount)}</span>
                    </div>
                    {dep.channel && (
                      <p className="text-xs text-gray-500">支付方式: {getDepositChannelLabel(dep.channel)}</p>
                    )}
                    {dep.confirmedAt && (
                      <p className="text-xs text-gray-500">确认时间: {formatDateTime(dep.confirmedAt)}</p>
                    )}
                    {dep.status === 'partially_released' && dep.releasedAmount !== undefined && (
                      <p className="text-xs text-amber-600">
                        已释放: {formatMoney(dep.releasedAmount)} / 剩余冻结: {formatMoney(dep.amount - dep.releasedAmount)}
                      </p>
                    )}
                    {dep.status === 'deducted' && dep.deductionReason && (
                      <p className="text-xs text-red-600">扣减原因: {dep.deductionReason}</p>
                    )}
                    {dep.frozenReason && (
                      <p className="text-xs text-blue-600">冻结原因: {dep.frozenReason}</p>
                    )}
                    {dep.status === 'frozen' && order.status === 'completed' && (
                      <button
                        onClick={() => handleReleaseDeposit(dep.type)}
                        className="mt-2 px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                      >
                        释放{DEPOSIT_TYPE_LABELS[dep.type]}
                      </button>
                    )}
                  </div>
                ))}

                {order.damages.some(d => d.status === 'pending') && (
                  <div className="p-2 bg-orange-50 border border-orange-200 rounded-lg text-sm">
                    <span className="text-orange-600 font-medium">⚠ 设备损坏待认定，设备押金暂不释放</span>
                    <p className="text-xs text-orange-500 mt-1">
                      待认定赔偿: {formatMoney(order.damages.filter(d => d.status === 'pending').reduce((s, d) => s + d.cost, 0))}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">棚位押金 ({(15 * 100).toFixed(0)}%)</span>
                  <span className={order.depositConfirmedAt ? 'text-green-600' : 'text-gray-600'}>
                    {formatMoney(order.studioDepositAmount)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">设备押金 ({(30 * 100).toFixed(0)}%)</span>
                  <span className={order.depositConfirmedAt ? 'text-green-600' : 'text-gray-600'}>
                    {formatMoney(order.equipmentDepositAmount)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">超时风险冻结 ({(10 * 100).toFixed(0)}%)</span>
                  <span className={order.depositConfirmedAt ? 'text-green-600' : 'text-gray-600'}>
                    {formatMoney(order.overtimeRiskDepositAmount)}
                  </span>
                </div>
                <div className="border-t border-indigo-200 pt-2 flex justify-between text-sm font-medium">
                  <span>押金合计</span>
                  <span className={order.depositConfirmedAt ? 'text-green-600' : 'text-orange-500'}>
                    {formatMoney(order.depositAmount)}
                    {order.depositConfirmedAt ? ' (已付)' : ' (未付)'}
                  </span>
                </div>
                {order.damages.some(d => d.status === 'pending') && (
                  <div className="p-2 bg-orange-50 border border-orange-200 rounded-lg text-xs text-orange-600">
                    ⚠ 存在待认定损坏，设备押金暂不可全额释放
                  </div>
                )}
              </div>
            )}

            <div className="mt-3 pt-3 border-t border-indigo-200 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">待付尾款</span>
                <span className="font-medium text-gray-800">{formatMoney(finalFees.remainingAmount)}</span>
              </div>
              {!order.finalPaymentCollected && order.status !== 'temp' && order.status !== 'expired' && order.status !== 'cancelled' && (
                <button
                  onClick={() => setShowFinalPayment(true)}
                  className="w-full py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors"
                >
                  收取尾款
                </button>
              )}
              {order.finalPaymentCollected && order.finalPaymentAt && (
                <p className="text-xs text-green-600">尾款已收: {formatDateTime(order.finalPaymentAt)}</p>
              )}
            </div>
          </div>

          {order.damages.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-800 mb-2">损坏记录</h4>
              <div className="space-y-2">
                {order.damages.map(dmg => {
                  const eq = equipments.find(e => e.id === dmg.equipmentId);
                  return (
                    <div key={dmg.id} className="p-3 bg-red-50 rounded-lg border border-red-100">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-800 text-sm">{eq?.name || dmg.equipmentId}</span>
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${DAMAGE_STATUS_COLORS[dmg.status]}`}>
                            {DAMAGE_STATUS_LABELS[dmg.status]}
                          </span>
                        </div>
                        <span className="text-red-600 font-medium text-sm">{formatMoney(dmg.cost)}</span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">{dmg.description}</p>
                      <p className="text-xs text-gray-400 mt-0.5">上报时间: {formatDateTime(dmg.reportedAt)}</p>
                      {dmg.slotId && activeSlots.length > 0 && (
                        <p className="text-xs text-gray-400">
                          所属时段: {activeSlots.find(s => s.id === dmg.slotId)?.sceneName || dmg.slotId}
                        </p>
                      )}
                      {dmg.status === 'confirmed' && (
                        <button
                          onClick={() => { setShowResolveDamage(dmg.id); setResolveCost(dmg.cost); }}
                          className="mt-2 px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                        >
                          结清赔偿
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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

          {order.payments.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-800 mb-2">支付记录</h4>
              <div className="space-y-1">
                {order.payments.map(pay => (
                  <div key={pay.id} className="flex justify-between items-center p-2 bg-gray-50 rounded text-sm">
                    <div>
                      <span className="text-gray-600">
                        {pay.type === 'deposit' ? '押金' : pay.type === 'final' ? '尾款' : pay.type === 'additional' ? '追加' : '退款'}
                      </span>
                      {pay.depositType && <span className="text-gray-400 ml-1">({DEPOSIT_TYPE_LABELS[pay.depositType]})</span>}
                      <span className="text-gray-400 ml-2">{getDepositChannelLabel(pay.channel)}</span>
                    </div>
                    <span className={pay.type === 'refund' ? 'text-green-600' : 'text-gray-800'}>
                      {pay.type === 'refund' ? '-' : '+'}{formatMoney(pay.amount)}
                    </span>
                  </div>
                ))}
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
            <>
              <button
                onClick={() => setShowAddEquipment(true)}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
              >
                追加设备
              </button>
              <button
                onClick={handleCompleteOrder}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
              >
                完成结算
              </button>
            </>
          )}
          {(order.status === 'confirmed' || order.status === 'deposit_confirmed' || order.status === 'pending_deposit') && (
            <button
              onClick={() => setShowReschedule(true)}
              className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors text-sm"
            >
              改期
            </button>
          )}
          {order.status !== 'completed' && order.status !== 'cancelled' && order.status !== 'expired' && (
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
                  <input type="date" value={rescheduleDate} onChange={e => setRescheduleDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">开始时间</label>
                    <input type="time" value={rescheduleStartTime} onChange={e => setRescheduleStartTime(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">结束时间</label>
                    <input type="time" value={rescheduleEndTime} onChange={e => setRescheduleEndTime(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-5">
                <button onClick={() => setShowReschedule(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">取消</button>
                <button onClick={handleReschedule} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">确认改期</button>
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
                    {allSlotEquipments.map(eqId => {
                      const eqInfo = equipments.find(e => e.id === eqId);
                      return <option key={eqId} value={eqId}>{eqInfo?.name}</option>;
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
                <button onClick={() => setShowDamageModal(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">完成</button>
                <button onClick={handleAddDamage} className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600">添加</button>
              </div>
            </div>
          </div>
        )}

        {showFinalPayment && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-60">
            <div className="bg-white rounded-xl p-5 w-full max-w-md">
              <h3 className="text-lg font-bold mb-4">收取尾款</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">尾款金额</p>
                  <p className="text-2xl font-bold text-green-600">{formatMoney(finalFees.remainingAmount)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">收款方式</label>
                  <select
                    value={finalPaymentChannel}
                    onChange={e => setFinalPaymentChannel(e.target.value as DepositChannel)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="alipay">支付宝</option>
                    <option value="wechat">微信</option>
                    <option value="bank">银行转账</option>
                    <option value="cash">现金</option>
                  </select>
                </div>
                {order.priceLocked && (
                  <p className="text-xs text-amber-600">⚠ 收取尾款后价格将锁定，不可再修改</p>
                )}
              </div>
              <div className="flex justify-end gap-2 mt-5">
                <button onClick={() => setShowFinalPayment(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">取消</button>
                <button onClick={handleCollectFinalPayment} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">确认收款</button>
              </div>
            </div>
          </div>
        )}

        {showAddEquipment && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-60">
            <div className="bg-white rounded-xl p-5 w-full max-w-md">
              <h3 className="text-lg font-bold mb-4">追加设备</h3>
              <div className="space-y-3">
                {activeSlots.length > 1 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">追加到时段</label>
                    <select
                      value={addEqSlotId || ''}
                      onChange={e => setAddEqSlotId(e.target.value || null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">全局追加</option>
                      {activeSlots.map((slot, i) => (
                        <option key={slot.id} value={slot.id}>
                          {slot.sceneName || `时段${i + 1}`} ({studios.find(s => s.id === slot.studioId)?.name})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">设备</label>
                  <select
                    value={addEqId}
                    onChange={e => setAddEqId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">请选择</option>
                    {equipments.map(eq => (
                      <option key={eq.id} value={eq.id}>{eq.name} ({formatMoney(eq.pricePerHour)}/h)</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">数量</label>
                  <input
                    type="number"
                    min={1}
                    value={addEqQty}
                    onChange={e => setAddEqQty(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-5">
                <button onClick={() => setShowAddEquipment(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">取消</button>
                <button onClick={handleAddEquipment} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">确认追加</button>
              </div>
            </div>
          </div>
        )}

        {showResolveDamage && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-60">
            <div className="bg-white rounded-xl p-5 w-full max-w-md">
              <h3 className="text-lg font-bold mb-4">结清损坏赔偿</h3>
              <div className="space-y-3">
                <p className="text-sm text-gray-600">确认赔偿金额，将从设备押金中扣减</p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">赔偿金额 (元)</label>
                  <input
                    type="number"
                    value={resolveCost}
                    onChange={e => setResolveCost(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-5">
                <button onClick={() => setShowResolveDamage(null)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">取消</button>
                <button onClick={() => handleResolveDamage(showResolveDamage)} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">确认结清</button>
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
