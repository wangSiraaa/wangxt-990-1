import { useState, useMemo } from 'react';
import { useAppState } from '../context/AppStateContext';
import type { Equipment, ConflictInfo, DepositChannel } from '../types';
import { formatMoney } from '../utils/dateUtils';
import { calculateOrderFees } from '../services/feeService';
import { checkAllConflicts } from '../services/conflictService';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialStudioId?: string;
  initialDate?: string;
  onSuccess?: (orderId: string) => void;
}

type BookingStep = 'studio' | 'datetime' | 'equipment' | 'assistant' | 'confirm';

export default function BookingModal({ isOpen, onClose, initialStudioId, initialDate, onSuccess }: BookingModalProps) {
  const { state, createTempOrder, setOrderToPendingDeposit } = useAppState();
  const { studios, equipments, assistants, orders, maintenanceDays } = state;

  const [step, setStep] = useState<BookingStep>('datetime');
  const [selectedStudioId, setSelectedStudioId] = useState(initialStudioId || '');
  const [startDate, setStartDate] = useState(initialDate || new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('12:00');
  const [selectedEquipments, setSelectedEquipments] = useState<{ equipmentId: string; quantity: number }[]>([]);
  const [selectedAssistantIds, setSelectedAssistantIds] = useState<string[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [photographer, setPhotographer] = useState('');
  const [notes, setNotes] = useState('');
  const [invoiceRequired, setInvoiceRequired] = useState(false);
  const [invoiceTitle, setInvoiceTitle] = useState('');
  const [invoiceTaxNo, setInvoiceTaxNo] = useState('');
  const [depositChannel, setDepositChannel] = useState<DepositChannel>('alipay');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const startDateTime = `${startDate}T${startTime}:00`;
  const endDateTime = `${startDate}T${endTime}:00`;

  const feeCalculation = useMemo(() => {
    if (!selectedStudioId) return null;
    return calculateOrderFees(
      {
        studioId: selectedStudioId,
        startTime: startDateTime,
        endTime: endDateTime,
        equipments: selectedEquipments,
        assistantIds: selectedAssistantIds,
      },
      studios,
      equipments,
      assistants
    );
  }, [selectedStudioId, startDateTime, endDateTime, selectedEquipments, selectedAssistantIds, studios, equipments, assistants]);

  const conflicts: ConflictInfo[] = useMemo(() => {
    if (!selectedStudioId) return [];
    return checkAllConflicts(
      {
        studioId: selectedStudioId,
        startTime: startDateTime,
        endTime: endDateTime,
        equipments: selectedEquipments,
        assistantIds: selectedAssistantIds,
      },
      orders,
      studios,
      equipments,
      assistants,
      maintenanceDays
    );
  }, [selectedStudioId, startDateTime, endDateTime, selectedEquipments, selectedAssistantIds, orders, studios, equipments, assistants, maintenanceDays]);

  const hasCriticalConflict = conflicts.some(c => c.type === 'studio' || c.type === 'maintenance');

  const filteredEquipments = useMemo(() => {
    if (!selectedStudioId) return [];
    return equipments.filter(e => e.compatibleStudios.includes(selectedStudioId));
  }, [selectedStudioId, equipments]);

  const lightingEquipments = filteredEquipments.filter(e => e.category === 'lighting');
  const setEquipments = filteredEquipments.filter(e => e.category === 'set');
  const propEquipments = filteredEquipments.filter(e => e.category === 'prop');

  const handleEquipmentToggle = (equipmentId: string) => {
    setSelectedEquipments(prev => {
      const existing = prev.find(e => e.equipmentId === equipmentId);
      if (existing) {
        return prev.filter(e => e.equipmentId !== equipmentId);
      }
      return [...prev, { equipmentId, quantity: 1 }];
    });
  };

  const handleQuantityChange = (equipmentId: string, quantity: number) => {
    setSelectedEquipments(prev =>
      prev.map(e =>
        e.equipmentId === equipmentId
          ? { ...e, quantity: Math.max(1, quantity) }
          : e
      )
    );
  };

  const handleAssistantToggle = (assistantId: string) => {
    setSelectedAssistantIds(prev =>
      prev.includes(assistantId)
        ? prev.filter(id => id !== assistantId)
        : [...prev, assistantId]
    );
  };

  const handleSubmit = async () => {
    setError('');
    setIsSubmitting(true);

    try {
      const result = createTempOrder({
        studioId: selectedStudioId,
        customerName,
        customerPhone,
        photographer: photographer || undefined,
        startTime: startDateTime,
        endTime: endDateTime,
        equipments: selectedEquipments,
        assistantIds: selectedAssistantIds,
        invoiceRequired,
        invoiceInfo: invoiceRequired ? { title: invoiceTitle, taxNo: invoiceTaxNo } : undefined,
        notes: notes || undefined,
      });

      if ('error' in result) {
        setError(result.error);
        setIsSubmitting(false);
        return;
      }

      if (depositChannel) {
        setOrderToPendingDeposit(result.order.id);
      }

      onSuccess?.(result.order.id);
      onClose();
    } catch (e) {
      setError('创建订单失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 'studio':
        return selectedStudioId;
      case 'datetime':
        return startDate && startTime && endTime && startDateTime < endDateTime && !hasCriticalConflict;
      case 'equipment':
        return true;
      case 'assistant':
        return true;
      case 'confirm':
        return customerName && customerPhone && !hasCriticalConflict && !isSubmitting;
      default:
        return false;
    }
  };

  const nextStep = () => {
    switch (step) {
      case 'studio':
        setStep('datetime');
        break;
      case 'datetime':
        setStep('equipment');
        break;
      case 'equipment':
        setStep('assistant');
        break;
      case 'assistant':
        setStep('confirm');
        break;
    }
  };

  const prevStep = () => {
    switch (step) {
      case 'datetime':
        setStep('studio');
        break;
      case 'equipment':
        setStep('datetime');
        break;
      case 'assistant':
        setStep('equipment');
        break;
      case 'confirm':
        setStep('assistant');
        break;
    }
  };

  const steps = [
    { id: 'datetime', label: '时间' },
    { id: 'equipment', label: '设备' },
    { id: 'assistant', label: '人员' },
    { id: 'confirm', label: '确认' },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-5 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-800">新建预约</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {studios.find(s => s.id === selectedStudioId)?.name || '请选择棚位'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between">
            {steps.map((s, i) => (
              <div key={s.id} className="flex items-center">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium ${
                      step === s.id
                        ? 'bg-blue-600 text-white'
                        : steps.findIndex(st => st.id === step) > i
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {steps.findIndex(st => st.id === step) > i ? '✓' : i + 1}
                  </div>
                  <span className={`text-sm font-medium ${step === s.id ? 'text-blue-600' : 'text-gray-500'}`}>
                    {s.label}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`w-12 h-0.5 mx-3 ${
                    steps.findIndex(st => st.id === step) > i ? 'bg-green-500' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {conflicts.length > 0 && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-2">
                <span className="text-red-500">⚠️</span>
                <div>
                  <p className="font-medium text-red-700 text-sm">存在冲突</p>
                  <ul className="mt-1 space-y-1">
                    {conflicts.map((conflict, i) => (
                      <li key={i} className="text-sm text-red-600">
                        {conflict.type === 'studio' && `棚位冲突: ${conflict.name}`}
                        {conflict.type === 'equipment' && `设备冲突: ${conflict.name}`}
                        {conflict.type === 'assistant' && `人员冲突: ${conflict.name}`}
                        {conflict.type === 'maintenance' && `维护日: ${conflict.name}`}
                        {conflict.conflictingOrderNo && ` (订单: ${conflict.conflictingOrderNo})`}
                        {conflict.alternatives && conflict.alternatives.length > 0 && (
                          <div className="mt-1 pl-3">
                            <span className="text-gray-500 text-xs">可用替代方案:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {conflict.alternatives.slice(0, 3).map((alt, j) => (
                                <button
                                  key={j}
                                  className="text-xs bg-white border border-gray-300 rounded px-2 py-0.5 hover:bg-gray-50"
                                  onClick={() => {
                                    if (alt.type === 'studio') {
                                      setSelectedStudioId(alt.id);
                                    } else if (alt.type === 'equipment') {
                                      setSelectedEquipments(prev => [
                                        ...prev.filter(e => e.equipmentId !== conflict.id),
                                        { equipmentId: alt.id, quantity: 1 }
                                      ]);
                                    } else if (alt.type === 'assistant') {
                                      setSelectedAssistantIds(prev => [
                                        ...prev.filter(id => id !== conflict.id),
                                        alt.id
                                      ]);
                                    }
                                  }}
                                >
                                  {alt.name}
                                  {alt.priceDiff !== 0 && (
                                    <span className={alt.priceDiff > 0 ? 'text-red-500' : 'text-green-500'}>
                                      {' '}{alt.priceDiff > 0 ? '+' : ''}{alt.priceDiff}/h
                                    </span>
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {step === 'datetime' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-800 mb-3">选择棚位</h3>
              <div className="grid grid-cols-2 gap-3">
                {studios.map(studio => (
                  <button
                    key={studio.id}
                    onClick={() => setSelectedStudioId(studio.id)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      selectedStudioId === studio.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: studio.color }}
                      />
                      <span className="font-medium text-gray-800">{studio.name}</span>
                    </div>
                    <p className="text-sm text-gray-500 mb-2">{studio.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-blue-600">
                        {formatMoney(studio.basePricePerHour)}
                        <span className="text-xs font-normal text-gray-500">/小时</span>
                      </span>
                      <span className="text-xs text-gray-500">
                        {studio.area}㎡ · 最多{studio.maxPeople}人
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-4 mt-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">日期</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">开始时间</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={e => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">结束时间</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={e => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {feeCalculation && (
                <div className="p-4 bg-gray-50 rounded-lg mt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">基础费用预估</span>
                    <span className="font-bold text-lg text-blue-600">
                      {formatMoney(feeCalculation.totalAmount)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'equipment' && (
            <div className="space-y-6">
              <EquipmentSection
                title="灯光设备"
                equipments={lightingEquipments}
                selectedEquipments={selectedEquipments}
                onToggle={handleEquipmentToggle}
                onQuantityChange={handleQuantityChange}
              />
              <EquipmentSection
                title="布景背景"
                equipments={setEquipments}
                selectedEquipments={selectedEquipments}
                onToggle={handleEquipmentToggle}
                onQuantityChange={handleQuantityChange}
              />
              <EquipmentSection
                title="道具"
                equipments={propEquipments}
                selectedEquipments={selectedEquipments}
                onToggle={handleEquipmentToggle}
                onQuantityChange={handleQuantityChange}
              />
            </div>
          )}

          {step === 'assistant' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-800">选择服务人员</h3>
              <p className="text-sm text-gray-500">可选配灯光师、化妆师、置景师等专业人员</p>
              
              <div className="grid grid-cols-2 gap-3">
                {assistants.map(asst => {
                  const isSelected = selectedAssistantIds.includes(asst.id);
                  const hasConflict = conflicts.some(
                    c => c.type === 'assistant' && c.id === asst.id
                  );
                  
                  return (
                    <button
                      key={asst.id}
                      onClick={() => handleAssistantToggle(asst.id)}
                      disabled={hasConflict && !isSelected}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50'
                          : hasConflict
                          ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-800">{asst.name}</span>
                        <span className="text-sm text-gray-500">{asst.role}</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {asst.skills.map(skill => (
                          <span
                            key={skill}
                            className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-blue-600">
                          {formatMoney(asst.pricePerHour)}
                          <span className="text-xs font-normal text-gray-500">/小时</span>
                        </span>
                        {hasConflict && (
                          <span className="text-xs text-red-500">已预约</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 'confirm' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">客户名称 *</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    placeholder="请输入客户名称"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">联系电话 *</label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                    placeholder="请输入联系电话"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">摄影师</label>
                  <input
                    type="text"
                    value={photographer}
                    onChange={e => setPhotographer(e.target.value)}
                    placeholder="可选"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">押金支付方式</label>
                  <select
                    value={depositChannel}
                    onChange={e => setDepositChannel(e.target.value as DepositChannel)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="alipay">支付宝</option>
                    <option value="wechat">微信支付</option>
                    <option value="bank">银行转账</option>
                    <option value="cash">现金</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="其他需求或说明"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              <div className="border-t border-gray-200 pt-4">
                <label className="flex items-center gap-2 mb-3">
                  <input
                    type="checkbox"
                    checked={invoiceRequired}
                    onChange={e => setInvoiceRequired(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">需要发票</span>
                </label>
                {invoiceRequired && (
                  <div className="grid grid-cols-2 gap-3 ml-6">
                    <input
                      type="text"
                      value={invoiceTitle}
                      onChange={e => setInvoiceTitle(e.target.value)}
                      placeholder="发票抬头"
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <input
                      type="text"
                      value={invoiceTaxNo}
                      onChange={e => setInvoiceTaxNo(e.target.value)}
                      placeholder="税号"
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                )}
              </div>

              {feeCalculation && (
                <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                  <h4 className="font-semibold text-gray-800 mb-3">费用明细</h4>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">棚位费</span>
                    <span>{formatMoney(feeCalculation.baseAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">设备费</span>
                    <span>{formatMoney(feeCalculation.equipmentAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">人员费</span>
                    <span>{formatMoney(feeCalculation.assistantAmount)}</span>
                  </div>
                  <div className="border-t border-gray-200 pt-2 flex justify-between">
                    <span className="font-medium">总金额</span>
                    <span className="font-bold text-lg text-blue-600">
                      {formatMoney(feeCalculation.totalAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">需付押金 (30%)</span>
                    <span className="text-orange-600 font-medium">
                      {formatMoney(feeCalculation.depositAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">尾款</span>
                    <span className="text-gray-600">
                      {formatMoney(feeCalculation.remainingAmount)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <button
            onClick={prevStep}
            disabled={step === 'datetime'}
            className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            上一步
          </button>
          
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
            >
              取消
            </button>
            {step === 'confirm' ? (
              <button
                onClick={handleSubmit}
                disabled={!canProceed()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? '提交中...' : '提交预约'}
              </button>
            ) : (
              <button
                onClick={nextStep}
                disabled={!canProceed()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                下一步
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface EquipmentSectionProps {
  title: string;
  equipments: Equipment[];
  selectedEquipments: { equipmentId: string; quantity: number }[];
  onToggle: (id: string) => void;
  onQuantityChange: (id: string, quantity: number) => void;
}

function EquipmentSection({ title, equipments, selectedEquipments, onToggle, onQuantityChange }: EquipmentSectionProps) {
  if (equipments.length === 0) return null;

  return (
    <div>
      <h4 className="font-medium text-gray-800 mb-2">{title}</h4>
      <div className="grid grid-cols-1 gap-2">
        {equipments.map(eq => {
          const selected = selectedEquipments.find(e => e.equipmentId === eq.id);
          const isSelected = !!selected;
          
          return (
            <div
              key={eq.id}
              className={`p-3 rounded-lg border transition-all cursor-pointer ${
                isSelected
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => onToggle(eq.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                    isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                  }`}>
                    {isSelected && <span className="text-white text-xs">✓</span>}
                  </div>
                  <div>
                    <div className="font-medium text-gray-800 text-sm">{eq.name}</div>
                    <div className="text-xs text-gray-500">库存: {eq.quantity} 件</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isSelected && (
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <button
                        className="w-6 h-6 rounded bg-gray-200 hover:bg-gray-300 text-sm"
                        onClick={() => onQuantityChange(eq.id, (selected?.quantity || 1) - 1)}
                      >
                        -
                      </button>
                      <span className="w-6 text-center text-sm font-medium">
                        {selected?.quantity || 1}
                      </span>
                      <button
                        className="w-6 h-6 rounded bg-gray-200 hover:bg-gray-300 text-sm"
                        onClick={() => onQuantityChange(eq.id, (selected?.quantity || 1) + 1)}
                        disabled={(selected?.quantity || 0) >= eq.quantity}
                      >
                        +
                      </button>
                    </div>
                  )}
                  <span className="text-sm font-medium text-blue-600 w-20 text-right">
                    {formatMoney(eq.pricePerHour)}/h
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
