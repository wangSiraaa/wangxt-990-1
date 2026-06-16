import { useState, useMemo } from 'react';
import { useAppState } from '../context/AppStateContext';
import type { Equipment, ConflictInfo, DepositChannel, CreateSlotParams } from '../types';
import { formatMoney } from '../utils/dateUtils';
import { calculateMultiSlotOrderFees } from '../services/feeService';
import { checkMultiSlotConflicts } from '../services/conflictService';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialStudioId?: string;
  initialDate?: string;
  onSuccess?: (orderId: string) => void;
}

interface SlotFormData {
  studioId: string;
  date: string;
  startTime: string;
  endTime: string;
  equipments: { equipmentId: string; quantity: number }[];
  assistantIds: string[];
  setupTime: number;
  teardownTime: number;
  sceneName: string;
  sceneNotes: string;
}

type BookingStep = 'slots' | 'equipment' | 'assistant' | 'confirm';

function createEmptySlot(date?: string, studioId?: string): SlotFormData {
  return {
    studioId: studioId || '',
    date: date || new Date().toISOString().slice(0, 10),
    startTime: '09:00',
    endTime: '12:00',
    equipments: [],
    assistantIds: [],
    setupTime: 0.5,
    teardownTime: 0.5,
    sceneName: '',
    sceneNotes: '',
  };
}

export default function BookingModal({ isOpen, onClose, initialStudioId, initialDate, onSuccess }: BookingModalProps) {
  const { state, createMultiSlotTempOrder, setOrderToPendingDeposit } = useAppState();
  const { studios, equipments, assistants, orders, maintenanceDays } = state;

  const [step, setStep] = useState<BookingStep>('slots');
  const [slots, setSlots] = useState<SlotFormData[]>([
    createEmptySlot(initialDate, initialStudioId),
  ]);
  const [activeSlotIndex, setActiveSlotIndex] = useState(0);
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

  const activeSlot = slots[activeSlotIndex] || slots[0];

  const updateSlot = (index: number, updates: Partial<SlotFormData>) => {
    setSlots(prev => prev.map((s, i) => i === index ? { ...s, ...updates } : s));
  };

  const addSlot = () => {
    const lastSlot = slots[slots.length - 1];
    const nextDate = lastSlot?.date || new Date().toISOString().slice(0, 10);
    setSlots(prev => [...prev, createEmptySlot(nextDate)]);
    setActiveSlotIndex(slots.length);
  };

  const removeSlot = (index: number) => {
    if (slots.length <= 1) return;
    setSlots(prev => prev.filter((_, i) => i !== index));
    if (activeSlotIndex >= slots.length - 1) {
      setActiveSlotIndex(Math.max(0, slots.length - 2));
    }
  };

  const slotParams: CreateSlotParams[] = slots.map(s => ({
    studioId: s.studioId,
    startTime: `${s.date}T${s.startTime}:00`,
    endTime: `${s.date}T${s.endTime}:00`,
    equipments: s.equipments,
    assistantIds: s.assistantIds,
    setupTime: s.setupTime,
    teardownTime: s.teardownTime,
    sceneName: s.sceneName || undefined,
    sceneNotes: s.sceneNotes || undefined,
  }));

  const feeCalculation = useMemo(() => {
    const validSlots = slotParams.filter(s => s.studioId && s.startTime < s.endTime);
    if (validSlots.length === 0) return null;
    return calculateMultiSlotOrderFees(validSlots, studios, equipments, assistants);
  }, [slotParams, studios, equipments, assistants]);

  const conflicts: ConflictInfo[] = useMemo(() => {
    const validSlots = slotParams.filter(s => s.studioId && s.startTime < s.endTime);
    if (validSlots.length === 0) return [];
    return checkMultiSlotConflicts(
      { slots: validSlots },
      orders,
      studios,
      equipments,
      assistants,
      maintenanceDays
    );
  }, [slotParams, orders, studios, equipments, assistants, maintenanceDays]);

  const hasCriticalConflict = conflicts.some(c => c.type === 'studio' || c.type === 'maintenance');

  const filteredEquipments = useMemo(() => {
    if (!activeSlot?.studioId) return [];
    return equipments.filter(e => e.compatibleStudios.includes(activeSlot.studioId));
  }, [activeSlot, equipments]);

  const lightingEquipments = filteredEquipments.filter(e => e.category === 'lighting');
  const setEquipments = filteredEquipments.filter(e => e.category === 'set');
  const propEquipments = filteredEquipments.filter(e => e.category === 'prop');

  const handleEquipmentToggle = (equipmentId: string) => {
    const slot = activeSlot;
    const existing = slot.equipments.find(e => e.equipmentId === equipmentId);
    if (existing) {
      updateSlot(activeSlotIndex, { equipments: slot.equipments.filter(e => e.equipmentId !== equipmentId) });
    } else {
      updateSlot(activeSlotIndex, { equipments: [...slot.equipments, { equipmentId, quantity: 1 }] });
    }
  };

  const handleQuantityChange = (equipmentId: string, quantity: number) => {
    const slot = activeSlot;
    updateSlot(activeSlotIndex, {
      equipments: slot.equipments.map(e =>
        e.equipmentId === equipmentId ? { ...e, quantity: Math.max(1, quantity) } : e
      ),
    });
  };

  const handleAssistantToggle = (assistantId: string) => {
    const slot = activeSlot;
    if (slot.assistantIds.includes(assistantId)) {
      updateSlot(activeSlotIndex, { assistantIds: slot.assistantIds.filter(id => id !== assistantId) });
    } else {
      updateSlot(activeSlotIndex, { assistantIds: [...slot.assistantIds, assistantId] });
    }
  };

  const handleSubmit = async () => {
    setError('');
    setIsSubmitting(true);

    try {
      const validSlots = slotParams.filter(s => s.studioId && s.startTime < s.endTime);
      if (validSlots.length === 0) {
        setError('至少需要一个有效时段');
        setIsSubmitting(false);
        return;
      }

      const result = createMultiSlotTempOrder({
        customerName,
        customerPhone,
        photographer: photographer || undefined,
        slots: validSlots,
        invoiceRequired,
        invoiceInfo: invoiceRequired ? { title: invoiceTitle, taxNo: invoiceTaxNo } : undefined,
        notes: notes || undefined,
      });

      if ('error' in result) {
        setError(result.error);
        setIsSubmitting(false);
        return;
      }

      setOrderToPendingDeposit(result.order.id);
      onSuccess?.(result.order.id);
      onClose();
    } catch {
      setError('创建订单失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 'slots':
        return slots.every(s => s.studioId && s.date && s.startTime && s.endTime && `${s.date}T${s.startTime}:00` < `${s.date}T${s.endTime}:00`) && !hasCriticalConflict;
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

  const steps = [
    { id: 'slots', label: '时段' },
    { id: 'equipment', label: '设备' },
    { id: 'assistant', label: '人员' },
    { id: 'confirm', label: '确认' },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-5 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-800">新建预约</h2>
            <p className="text-sm text-gray-500 mt-0.5">支持多档期、跨棚换景预约</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500">✕</button>
        </div>

        <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between">
            {steps.map((s, i) => (
              <div key={s.id} className="flex items-center">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium ${step === s.id ? 'bg-blue-600 text-white' : steps.findIndex(st => st.id === step) > i ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                    {steps.findIndex(st => st.id === step) > i ? '✓' : i + 1}
                  </div>
                  <span className={`text-sm font-medium ${step === s.id ? 'text-blue-600' : 'text-gray-500'}`}>{s.label}</span>
                </div>
                {i < steps.length - 1 && <div className={`w-12 h-0.5 mx-3 ${steps.findIndex(st => st.id === step) > i ? 'bg-green-500' : 'bg-gray-200'}`} />}
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
                    {conflicts.map((c, i) => (
                      <li key={i} className="text-sm text-red-600">
                        {c.type === 'studio' && `棚位冲突: ${c.name}`}
                        {c.type === 'equipment' && `设备冲突: ${c.name}`}
                        {c.type === 'assistant' && `人员冲突: ${c.name}`}
                        {c.type === 'maintenance' && `维护日: ${c.name}`}
                        {c.conflictingOrderNo && ` (订单: ${c.conflictingOrderNo})`}
                        {c.alternatives && c.alternatives.length > 0 && (
                          <div className="mt-1 pl-3">
                            <span className="text-gray-500 text-xs">可用替代方案:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {c.alternatives.slice(0, 3).map((alt, j) => (
                                <button key={j} className="text-xs bg-white border border-gray-300 rounded px-2 py-0.5 hover:bg-gray-50">
                                  {alt.name}
                                  {alt.priceDiff !== 0 && <span className={alt.priceDiff > 0 ? 'text-red-500' : 'text-green-500'}> {alt.priceDiff > 0 ? '+' : ''}{alt.priceDiff}/h</span>}
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

          {step === 'slots' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-800">预约时段</h3>
                <button onClick={addSlot} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors font-medium flex items-center gap-1">
                  <span>+</span> 添加时段
                </button>
              </div>

              <div className="flex gap-2 flex-wrap">
                {slots.map((slot, i) => {
                  const studio = studios.find(s => s.id === slot.studioId);
                  return (
                    <button key={i} onClick={() => setActiveSlotIndex(i)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeSlotIndex === i ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                      <span>时段{i + 1}</span>
                      {studio && <span className="text-xs opacity-80">{studio.name.split(' - ')[0]}</span>}
                      {slots.length > 1 && (
                        <span onClick={(e) => { e.stopPropagation(); removeSlot(i); }} className="ml-1 text-xs opacity-60 hover:opacity-100">✕</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {activeSlot && (
                <div className="border border-gray-200 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-gray-800">时段 {activeSlotIndex + 1} 配置</h4>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">选择棚位</label>
                    <div className="grid grid-cols-2 gap-3">
                      {studios.map(studio => (
                        <button key={studio.id} onClick={() => updateSlot(activeSlotIndex, { studioId: studio.id })} className={`p-3 rounded-xl border-2 text-left transition-all ${activeSlot.studioId === studio.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: studio.color }} />
                            <span className="font-medium text-gray-800 text-sm">{studio.name}</span>
                          </div>
                          <span className="text-sm text-blue-600 font-bold">{formatMoney(studio.basePricePerHour)}<span className="text-xs font-normal text-gray-500">/h</span></span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">日期</label>
                      <input type="date" value={activeSlot.date} onChange={e => updateSlot(activeSlotIndex, { date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">开始</label>
                        <input type="time" value={activeSlot.startTime} onChange={e => updateSlot(activeSlotIndex, { startTime: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">结束</label>
                        <input type="time" value={activeSlot.endTime} onChange={e => updateSlot(activeSlotIndex, { endTime: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">布置时间 (h)</label>
                      <input type="number" value={activeSlot.setupTime} onChange={e => updateSlot(activeSlotIndex, { setupTime: Number(e.target.value) })} min="0" step="0.5" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">清场时间 (h)</label>
                      <input type="number" value={activeSlot.teardownTime} onChange={e => updateSlot(activeSlotIndex, { teardownTime: Number(e.target.value) })} min="0" step="0.5" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">场景名称</label>
                    <input type="text" value={activeSlot.sceneName} onChange={e => updateSlot(activeSlotIndex, { sceneName: e.target.value })} placeholder="如：产品拍摄 / 直播 / 人像" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                  </div>

                  {activeSlot.setupTime > 0 && activeSlot.studioId && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-2">资源占用时段</p>
                      <div className="flex gap-1">
                        <div className="flex-1 bg-amber-100 rounded px-2 py-1 text-center">
                          <p className="text-xs font-medium text-amber-700">布置期</p>
                          <p className="text-xs text-amber-600">{activeSlot.setupTime}h</p>
                        </div>
                        <div className="flex-1 bg-blue-100 rounded px-2 py-1 text-center">
                          <p className="text-xs font-medium text-blue-700">拍摄期</p>
                          <p className="text-xs text-blue-600">核心时段</p>
                        </div>
                        <div className="flex-1 bg-gray-200 rounded px-2 py-1 text-center">
                          <p className="text-xs font-medium text-gray-700">清场期</p>
                          <p className="text-xs text-gray-600">{activeSlot.teardownTime}h</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 'equipment' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-800">为各时段选择设备</h3>
                <div className="flex gap-2">
                  {slots.map((_, i) => (
                    <button key={i} onClick={() => setActiveSlotIndex(i)} className={`px-3 py-1 rounded text-sm ${activeSlotIndex === i ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                      时段{i + 1}
                    </button>
                  ))}
                </div>
              </div>
              <EquipmentSection title="灯光设备" equipments={lightingEquipments} selectedEquipments={activeSlot.equipments} onToggle={handleEquipmentToggle} onQuantityChange={handleQuantityChange} />
              <EquipmentSection title="布景背景" equipments={setEquipments} selectedEquipments={activeSlot.equipments} onToggle={handleEquipmentToggle} onQuantityChange={handleQuantityChange} />
              <EquipmentSection title="道具" equipments={propEquipments} selectedEquipments={activeSlot.equipments} onToggle={handleEquipmentToggle} onQuantityChange={handleQuantityChange} />
            </div>
          )}

          {step === 'assistant' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-800">为各时段选择人员</h3>
                <div className="flex gap-2">
                  {slots.map((_, i) => (
                    <button key={i} onClick={() => setActiveSlotIndex(i)} className={`px-3 py-1 rounded text-sm ${activeSlotIndex === i ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                      时段{i + 1}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {assistants.map(asst => {
                  const isSelected = activeSlot.assistantIds.includes(asst.id);
                  return (
                    <button key={asst.id} onClick={() => handleAssistantToggle(asst.id)} className={`p-4 rounded-xl border-2 text-left transition-all ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-800">{asst.name}</span>
                        <span className="text-sm text-gray-500">{asst.role}</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {asst.skills.map(skill => <span key={skill} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">{skill}</span>)}
                      </div>
                      <span className="font-bold text-blue-600">{formatMoney(asst.pricePerHour)}<span className="text-xs font-normal text-gray-500">/小时</span></span>
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
                  <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="请输入客户名称" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">联系电话 *</label>
                  <input type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="请输入联系电话" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">摄影师</label>
                  <input type="text" value={photographer} onChange={e => setPhotographer(e.target.value)} placeholder="可选" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">押金支付方式</label>
                  <select value={depositChannel} onChange={e => setDepositChannel(e.target.value as DepositChannel)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    <option value="alipay">支付宝</option>
                    <option value="wechat">微信支付</option>
                    <option value="bank">银行转账</option>
                    <option value="cash">现金</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="其他需求或说明" rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none" />
              </div>

              <div className="border-t border-gray-200 pt-4">
                <label className="flex items-center gap-2 mb-3">
                  <input type="checkbox" checked={invoiceRequired} onChange={e => setInvoiceRequired(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  <span className="text-sm font-medium text-gray-700">需要发票</span>
                </label>
                {invoiceRequired && (
                  <div className="grid grid-cols-2 gap-3 ml-6">
                    <input type="text" value={invoiceTitle} onChange={e => setInvoiceTitle(e.target.value)} placeholder="发票抬头" className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                    <input type="text" value={invoiceTaxNo} onChange={e => setInvoiceTaxNo(e.target.value)} placeholder="税号" className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                  </div>
                )}
              </div>

              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="font-semibold text-gray-800 mb-3">预约时段总览</h4>
                {slots.map((slot, i) => {
                  const studio = studios.find(s => s.id === slot.studioId);
                  return (
                    <div key={i} className="mb-2 p-3 bg-white rounded-lg border border-gray-200">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium text-blue-600">时段{i + 1}</span>
                        {studio && <span className="text-gray-600">{studio.name.split(' - ')[0]}</span>}
                        <span className="text-gray-500">{slot.date} {slot.startTime}-{slot.endTime}</span>
                        {slot.sceneName && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">{slot.sceneName}</span>}
                        <span className="text-xs text-gray-400">布置{slot.setupTime}h / 清场{slot.teardownTime}h</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {slot.equipments.map(eq => {
                          const eqInfo = equipments.find(e => e.id === eq.equipmentId);
                          return eqInfo ? <span key={eq.equipmentId} className="text-xs bg-gray-100 px-2 py-0.5 rounded">{eqInfo.name} x{eq.quantity}</span> : null;
                        })}
                        {slot.assistantIds.map(id => {
                          const asst = assistants.find(a => a.id === id);
                          return asst ? <span key={id} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{asst.name}</span> : null;
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {feeCalculation && (
                <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                  <h4 className="font-semibold text-gray-800 mb-3">费用明细</h4>
                  <div className="flex justify-between text-sm"><span className="text-gray-600">棚位费</span><span>{formatMoney(feeCalculation.baseAmount)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-600">设备费</span><span>{formatMoney(feeCalculation.equipmentAmount)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-600">人员费</span><span>{formatMoney(feeCalculation.assistantAmount)}</span></div>
                  <div className="border-t border-gray-200 pt-2 flex justify-between"><span className="font-medium">总金额</span><span className="font-bold text-lg text-blue-600">{formatMoney(feeCalculation.totalAmount)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-600">押金 - 棚位押金</span><span className="text-amber-600">{formatMoney(feeCalculation.studioDepositAmount)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-600">押金 - 设备押金</span><span className="text-amber-600">{formatMoney(feeCalculation.equipmentDepositAmount)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-600">押金 - 超时风险冻结</span><span className="text-amber-600">{formatMoney(feeCalculation.overtimeRiskDepositAmount)}</span></div>
                  <div className="flex justify-between text-sm font-medium"><span className="text-gray-600">押金合计</span><span className="text-orange-600">{formatMoney(feeCalculation.depositAmount)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-600">尾款</span><span className="text-gray-600">{formatMoney(feeCalculation.remainingAmount)}</span></div>
                </div>
              )}
            </div>
          )}

          {error && <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}
        </div>

        <div className="px-5 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <button onClick={() => { const idx = steps.findIndex(s => s.id === step); if (idx > 0) setStep(steps[idx - 1].id); }} disabled={step === 'slots'} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">上一步</button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors">取消</button>
            {step === 'confirm' ? (
              <button onClick={handleSubmit} disabled={!canProceed()} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed">{isSubmitting ? '提交中...' : '提交预约'}</button>
            ) : (
              <button onClick={() => { const idx = steps.findIndex(s => s.id === step); if (idx < steps.length - 1) setStep(steps[idx + 1].id); }} disabled={!canProceed()} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed">下一步</button>
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
            <div key={eq.id} className={`p-3 rounded-lg border transition-all cursor-pointer ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`} onClick={() => onToggle(eq.id)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
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
                      <button className="w-6 h-6 rounded bg-gray-200 hover:bg-gray-300 text-sm" onClick={() => onQuantityChange(eq.id, (selected?.quantity || 1) - 1)}>-</button>
                      <span className="w-6 text-center text-sm font-medium">{selected?.quantity || 1}</span>
                      <button className="w-6 h-6 rounded bg-gray-200 hover:bg-gray-300 text-sm" onClick={() => onQuantityChange(eq.id, (selected?.quantity || 1) + 1)} disabled={(selected?.quantity || 0) >= eq.quantity}>+</button>
                    </div>
                  )}
                  <span className="text-sm font-medium text-blue-600 w-20 text-right">{formatMoney(eq.pricePerHour)}/h</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
