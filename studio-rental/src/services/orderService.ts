import type { Order, DepositChannel, OrderDamage, AppState, BookingSlot, CreateSlotParams, OrderDeposit, DepositType, PaymentRecord, MaintenanceImpactOption, MaintenanceImpactOptionType, MaintenanceImpact, Studio, Equipment, Assistant } from '../types';
import { generateId, generateOrderNo, addHours } from '../utils/dateUtils';
import {
  calculateOrderFees,
  calculateMultiSlotOrderFees,
  calculateOvertimeFee,
  calculatePenaltyFee,
  calculateDamageFee,
  validatePriceAdjustment,
  buildTimePhases,
  calculateSlotFees,
  SETUP_DEFAULT_HOURS,
  TEARDOWN_DEFAULT_HOURS,
  STUDIO_DEPOSIT_RATIO,
  EQUIPMENT_DEPOSIT_RATIO,
} from './feeService';
import { checkAllConflicts, checkMultiSlotConflicts } from './conflictService';
import { saveState } from '../store/storage';

export interface CreateOrderParams {
  studioId: string;
  customerName: string;
  customerPhone: string;
  photographer?: string;
  startTime: string;
  endTime: string;
  equipments: { equipmentId: string; quantity: number }[];
  assistantIds: string[];
  setupTime?: number;
  teardownTime?: number;
  invoiceRequired: boolean;
  invoiceInfo?: { title: string; taxNo: string };
  notes?: string;
}

export interface CreateMultiSlotOrderParams {
  customerName: string;
  customerPhone: string;
  photographer?: string;
  slots: CreateSlotParams[];
  invoiceRequired: boolean;
  invoiceInfo?: { title: string; taxNo: string };
  notes?: string;
}

function buildSlotFromParams(params: CreateSlotParams, studios: any[], equipments: any[], assistants: any[]): BookingSlot {
  const setupTime = params.setupTime ?? SETUP_DEFAULT_HOURS;
  const teardownTime = params.teardownTime ?? TEARDOWN_DEFAULT_HOURS;
  const slotFees = calculateSlotFees(params, studios, equipments, assistants);
  const phases = buildTimePhases(params.startTime, params.endTime, setupTime, teardownTime);

  return {
    id: generateId('slot'),
    studioId: params.studioId,
    startTime: params.startTime,
    endTime: params.endTime,
    phases,
    equipments: (params.equipments || []).map(e => ({ ...e })),
    assistantIds: params.assistantIds || [],
    setupTime,
    teardownTime,
    sceneName: params.sceneName,
    sceneNotes: params.sceneNotes,
    overtimeHours: 0,
    overtimeFee: 0,
    baseAmount: slotFees.baseAmount,
    equipmentAmount: slotFees.equipmentAmount,
    assistantAmount: slotFees.assistantAmount,
  };
}

function buildDeposits(
  studioDepositAmount: number,
  equipmentDepositAmount: number,
  overtimeRiskDepositAmount: number
): OrderDeposit[] {
  const deposits: OrderDeposit[] = [];

  if (studioDepositAmount > 0) {
    deposits.push({
      id: generateId('dep'),
      type: 'studio',
      amount: studioDepositAmount,
      status: 'frozen',
      frozenReason: '棚位使用押金',
    });
  }

  if (equipmentDepositAmount > 0) {
    deposits.push({
      id: generateId('dep'),
      type: 'equipment',
      amount: equipmentDepositAmount,
      status: 'frozen',
      frozenReason: '设备使用押金',
    });
  }

  if (overtimeRiskDepositAmount > 0) {
    deposits.push({
      id: generateId('dep'),
      type: 'overtime_risk',
      amount: overtimeRiskDepositAmount,
      status: 'frozen',
      frozenReason: '超时风险冻结',
    });
  }

  return deposits;
}

function sortSlots(slots: BookingSlot[]): BookingSlot[] {
  return [...slots].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
}

export function createTempOrder(
  params: CreateOrderParams,
  state: AppState
): { order: Order; state: AppState } | { error: string } {
  const conflicts = checkAllConflicts(
    {
      studioId: params.studioId,
      startTime: params.startTime,
      endTime: params.endTime,
      equipments: params.equipments,
      assistantIds: params.assistantIds,
    },
    state.orders,
    state.studios,
    state.equipments,
    state.assistants,
    state.maintenanceDays
  );

  if (conflicts.length > 0) {
    const conflictNames = conflicts.map(c => `${c.type === 'studio' ? '棚位' : c.type === 'equipment' ? '设备' : c.type === 'assistant' ? '人员' : '维护'}: ${c.name}`).join(', ');
    return { error: `存在冲突: ${conflictNames}` };
  }

  const fees = calculateOrderFees(
    {
      studioId: params.studioId,
      startTime: params.startTime,
      endTime: params.endTime,
      equipments: params.equipments,
      assistantIds: params.assistantIds,
      setupTime: params.setupTime ?? SETUP_DEFAULT_HOURS,
      teardownTime: params.teardownTime ?? TEARDOWN_DEFAULT_HOURS,
    },
    state.studios,
    state.equipments,
    state.assistants
  );

  const now = new Date();
  const tempExpiresAt = addHours(now, 0.5);

  const slot = buildSlotFromParams(
    {
      studioId: params.studioId,
      startTime: params.startTime,
      endTime: params.endTime,
      equipments: params.equipments,
      assistantIds: params.assistantIds,
      setupTime: params.setupTime,
      teardownTime: params.teardownTime,
    },
    state.studios,
    state.equipments,
    state.assistants
  );

  const order: Order = {
    id: generateId('order'),
    orderNo: generateOrderNo(),
    studioId: params.studioId,
    customerName: params.customerName,
    customerPhone: params.customerPhone,
    photographer: params.photographer,
    startTime: params.startTime,
    endTime: params.endTime,
    slots: [slot],
    equipments: params.equipments,
    assistantIds: params.assistantIds,
    setupTime: params.setupTime ?? SETUP_DEFAULT_HOURS,
    teardownTime: params.teardownTime ?? TEARDOWN_DEFAULT_HOURS,
    baseAmount: fees.baseAmount,
    equipmentAmount: fees.equipmentAmount,
    assistantAmount: fees.assistantAmount,
    deposits: buildDeposits(fees.studioDepositAmount, fees.equipmentDepositAmount, fees.overtimeRiskDepositAmount),
    depositAmount: fees.depositAmount,
    studioDepositAmount: fees.studioDepositAmount,
    equipmentDepositAmount: fees.equipmentDepositAmount,
    overtimeRiskDepositAmount: fees.overtimeRiskDepositAmount,
    overtimeHours: 0,
    overtimeFee: 0,
    penaltyFee: 0,
    damageFee: 0,
    damages: [],
    payments: [],
    finalPaymentCollected: false,
    priceLocked: false,
    invoiceRequired: params.invoiceRequired,
    invoiceInfo: params.invoiceInfo,
    status: 'temp',
    notes: params.notes,
    tempExpiresAt: tempExpiresAt.toISOString(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  const newState = {
    ...state,
    orders: [...state.orders, order],
  };

  saveState(newState);

  return { order, state: newState };
}

export function createMultiSlotTempOrder(
  params: CreateMultiSlotOrderParams,
  state: AppState
): { order: Order; state: AppState } | { error: string } {
  if (!params.slots || params.slots.length === 0) {
    return { error: '至少需要一个档期时段' };
  }

  const conflicts = checkMultiSlotConflicts(
    { slots: params.slots },
    state.orders,
    state.studios,
    state.equipments,
    state.assistants,
    state.maintenanceDays
  );

  if (conflicts.length > 0) {
    const conflictNames = conflicts.map(c => `时段${c.slotId ? (parseInt(c.slotId.replace('slot-', '')) + 1) : 1} - ${c.type === 'studio' ? '棚位' : c.type === 'equipment' ? '设备' : c.type === 'assistant' ? '人员' : '维护'}: ${c.name}`).join('; ');
    return { error: `存在冲突: ${conflictNames}` };
  }

  const fees = calculateMultiSlotOrderFees(params.slots, state.studios, state.equipments, state.assistants);

  const slots = params.slots.map(s =>
    buildSlotFromParams(s, state.studios, state.equipments, state.assistants)
  );
  const sortedSlots = sortSlots(slots);

  const now = new Date();
  const tempExpiresAt = addHours(now, 0.5);

  const order: Order = {
    id: generateId('order'),
    orderNo: generateOrderNo(),
    studioId: sortedSlots[0]?.studioId || '',
    customerName: params.customerName,
    customerPhone: params.customerPhone,
    photographer: params.photographer,
    startTime: sortedSlots[0]?.startTime || '',
    endTime: sortedSlots[sortedSlots.length - 1]?.endTime || '',
    slots: sortedSlots,
    equipments: [],
    assistantIds: [],
    setupTime: 0,
    teardownTime: 0,
    baseAmount: fees.baseAmount,
    equipmentAmount: fees.equipmentAmount,
    assistantAmount: fees.assistantAmount,
    deposits: buildDeposits(fees.studioDepositAmount, fees.equipmentDepositAmount, fees.overtimeRiskDepositAmount),
    depositAmount: fees.depositAmount,
    studioDepositAmount: fees.studioDepositAmount,
    equipmentDepositAmount: fees.equipmentDepositAmount,
    overtimeRiskDepositAmount: fees.overtimeRiskDepositAmount,
    overtimeHours: 0,
    overtimeFee: 0,
    penaltyFee: 0,
    damageFee: 0,
    damages: [],
    payments: [],
    finalPaymentCollected: false,
    priceLocked: false,
    invoiceRequired: params.invoiceRequired,
    invoiceInfo: params.invoiceInfo,
    status: 'temp',
    notes: params.notes,
    tempExpiresAt: tempExpiresAt.toISOString(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  const newState = {
    ...state,
    orders: [...state.orders, order],
  };

  saveState(newState);

  return { order, state: newState };
}

export function confirmDeposit(
  orderId: string,
  channel: DepositChannel,
  state: AppState
): { order: Order; state: AppState } | { error: string } {
  const orderIndex = state.orders.findIndex(o => o.id === orderId);
  if (orderIndex === -1) {
    return { error: '订单不存在' };
  }

  const order = state.orders[orderIndex];
  if (order.status !== 'pending_deposit' && order.status !== 'temp') {
    return { error: '当前订单状态不能确认押金' };
  }

  const now = new Date();
  const paymentRecord: PaymentRecord = {
    id: generateId('pay'),
    type: 'deposit',
    amount: order.depositAmount,
    channel,
    confirmedAt: now.toISOString(),
    notes: '押金支付',
  };

  const updatedDeposits = order.deposits.map(dep => ({
    ...dep,
    channel,
    confirmedAt: now.toISOString(),
  }));

  const updatedOrder: Order = {
    ...order,
    status: 'deposit_confirmed',
    depositChannel: channel,
    depositConfirmedAt: now.toISOString(),
    depositExpiresAt: undefined,
    tempExpiresAt: undefined,
    deposits: updatedDeposits,
    payments: [...order.payments, paymentRecord],
    updatedAt: now.toISOString(),
  };

  const newOrders = [...state.orders];
  newOrders[orderIndex] = updatedOrder;

  const newState = { ...state, orders: newOrders };
  saveState(newState);

  return { order: updatedOrder, state: newState };
}

export function confirmOrder(
  orderId: string,
  state: AppState
): { order: Order; state: AppState } | { error: string } {
  const orderIndex = state.orders.findIndex(o => o.id === orderId);
  if (orderIndex === -1) {
    return { error: '订单不存在' };
  }

  const order = state.orders[orderIndex];
  if (order.status !== 'deposit_confirmed') {
    return { error: '押金未确认，不能确认订单' };
  }

  const now = new Date();
  const subtotal = order.baseAmount + order.equipmentAmount + order.assistantAmount;

  const updatedOrder: Order = {
    ...order,
    status: 'confirmed',
    originalPrice: subtotal,
    priceLocked: true,
    updatedAt: now.toISOString(),
  };

  const newOrders = [...state.orders];
  newOrders[orderIndex] = updatedOrder;

  const newState = { ...state, orders: newOrders };
  saveState(newState);

  return { order: updatedOrder, state: newState };
}

export function collectFinalPayment(
  orderId: string,
  channel: DepositChannel,
  state: AppState
): { order: Order; state: AppState } | { error: string } {
  const orderIndex = state.orders.findIndex(o => o.id === orderId);
  if (orderIndex === -1) {
    return { error: '订单不存在' };
  }

  const order = state.orders[orderIndex];
  if (order.finalPaymentCollected) {
    return { error: '尾款已收取' };
  }

  const totalAmount = order.baseAmount + order.equipmentAmount + order.assistantAmount + order.overtimeFee + order.penaltyFee + order.damageFee;
  const remainingAmount = Math.max(0, totalAmount - order.depositAmount);

  if (remainingAmount <= 0) {
    return { error: '无待收尾款' };
  }

  const now = new Date();
  const paymentRecord: PaymentRecord = {
    id: generateId('pay'),
    type: 'final',
    amount: remainingAmount,
    channel,
    confirmedAt: now.toISOString(),
    notes: '尾款支付',
  };

  const updatedOrder: Order = {
    ...order,
    finalPaymentCollected: true,
    finalPaymentAmount: remainingAmount,
    finalPaymentAt: now.toISOString(),
    priceLocked: true,
    payments: [...order.payments, paymentRecord],
    updatedAt: now.toISOString(),
  };

  const newOrders = [...state.orders];
  newOrders[orderIndex] = updatedOrder;

  const newState = { ...state, orders: newOrders };
  saveState(newState);

  return { order: updatedOrder, state: newState };
}

export function startOrder(
  orderId: string,
  state: AppState
): { order: Order; state: AppState } | { error: string } {
  const orderIndex = state.orders.findIndex(o => o.id === orderId);
  if (orderIndex === -1) {
    return { error: '订单不存在' };
  }

  const order = state.orders[orderIndex];
  if (order.status !== 'confirmed') {
    return { error: '订单未确认，不能开始' };
  }

  const now = new Date();
  const updatedOrder: Order = {
    ...order,
    status: 'in_progress',
    updatedAt: now.toISOString(),
  };

  const newOrders = [...state.orders];
  newOrders[orderIndex] = updatedOrder;

  const newState = { ...state, orders: newOrders };
  saveState(newState);

  return { order: updatedOrder, state: newState };
}

export function addEquipmentToOrder(
  orderId: string,
  slotId: string | null,
  equipmentId: string,
  quantity: number,
  state: AppState
): { order: Order; state: AppState } | { error: string } {
  const orderIndex = state.orders.findIndex(o => o.id === orderId);
  if (orderIndex === -1) {
    return { error: '订单不存在' };
  }

  const order = state.orders[orderIndex];
  if (order.status !== 'in_progress') {
    return { error: '仅进行中的订单可追加设备' };
  }

  const now = new Date();
  const eq = state.equipments.find(e => e.id === equipmentId);
  if (!eq) {
    return { error: '设备不存在' };
  }

  let newTotalEquipment = order.equipmentAmount;
  let updatedSlots = order.slots;
  let updatedEquipments = [...order.equipments];

  if (slotId && order.slots.length > 0) {
    updatedSlots = order.slots.map(slot => {
      if (slot.id === slotId) {
        const existing = slot.equipments.find(e => e.equipmentId === equipmentId);
        let newEqs;
        if (existing) {
          newEqs = slot.equipments.map(e =>
            e.equipmentId === equipmentId ? { ...e, quantity: e.quantity + quantity } : e
          );
        } else {
          newEqs = [...slot.equipments, { equipmentId, quantity, addedMidShoot: true, addedAt: now.toISOString(), slotId }];
        }
        const addHours2 = (date: string, h: number) => {
          const d = new Date(date);
          d.setHours(d.getHours() + h);
          return d;
        };
        const remainingHours = Math.max(0, (new Date(slot.endTime).getTime() - now.getTime()) / (1000 * 60 * 60));
        const addFee = eq.pricePerHour * quantity * remainingHours;
        newTotalEquipment += addFee;
        return {
          ...slot,
          equipments: newEqs,
          equipmentAmount: slot.equipmentAmount + addFee,
        };
      }
      return slot;
    });
  } else {
    const existing = updatedEquipments.find(e => e.equipmentId === equipmentId);
    if (existing) {
      updatedEquipments = updatedEquipments.map(e =>
        e.equipmentId === equipmentId ? { ...e, quantity: e.quantity + quantity } : e
      );
    } else {
      updatedEquipments.push({ equipmentId, quantity, addedMidShoot: true, addedAt: now.toISOString() });
    }
  }

  const validation = validatePriceAdjustment(order, order.baseAmount + newTotalEquipment + order.assistantAmount);
  if (!validation.allowed) {
    return { error: validation.reason || '价格调整不被允许' };
  }

  const updatedDepositAmount = newTotalEquipment > order.equipmentAmount
    ? order.equipmentDepositAmount + Math.ceil((newTotalEquipment - order.equipmentAmount) * 0.3 / 100) * 100
    : order.equipmentDepositAmount;

  const updatedOrder: Order = {
    ...order,
    equipments: updatedEquipments,
    slots: updatedSlots,
    equipmentAmount: Math.round(newTotalEquipment * 100) / 100,
    equipmentDepositAmount: updatedDepositAmount,
    depositAmount: order.studioDepositAmount + updatedDepositAmount + order.overtimeRiskDepositAmount,
    updatedAt: now.toISOString(),
  };

  const newOrders = [...state.orders];
  newOrders[orderIndex] = updatedOrder;

  const newState = { ...state, orders: newOrders };
  saveState(newState);

  return { order: updatedOrder, state: newState };
}

export function completeOrder(
  orderId: string,
  actualEndTime: string,
  state: AppState,
  damages?: OrderDamage[]
): { order: Order; state: AppState } | { error: string } {
  const orderIndex = state.orders.findIndex(o => o.id === orderId);
  if (orderIndex === -1) {
    return { error: '订单不存在' };
  }

  const order = state.orders[orderIndex];
  if (order.status !== 'in_progress') {
    return { error: '订单未开始，不能完成' };
  }

  let totalOvertimeHours = 0;
  let totalOvertimeFee = 0;
  let updatedSlots = order.slots;

  if (order.slots && order.slots.length > 0) {
    updatedSlots = order.slots.map((slot, idx) => {
      const studio = state.studios.find(s => s.id === slot.studioId);
      if (!studio) return slot;

      const isLastSlot = idx === order.slots.length - 1;
      const slotEnd = isLastSlot ? actualEndTime : slot.endTime;

      const result = calculateOvertimeFee(
        slot.endTime,
        slotEnd,
        studio,
        slot.equipments,
        state.equipments,
        state.assistants,
        slot.assistantIds
      );

      totalOvertimeHours += result.overtimeHours;
      totalOvertimeFee += result.overtimeFee;

      return {
        ...slot,
        actualEndTime: slotEnd,
        overtimeHours: result.overtimeHours,
        overtimeFee: result.overtimeFee,
      };
    });
  } else {
    const studio = state.studios.find(s => s.id === order.studioId);
    if (studio) {
      const result = calculateOvertimeFee(
        order.endTime,
        actualEndTime,
        studio,
        order.equipments,
        state.equipments,
        state.assistants,
        order.assistantIds
      );
      totalOvertimeHours = result.overtimeHours;
      totalOvertimeFee = result.overtimeFee;
    }
  }

  const allDamages = [...order.damages, ...(damages || [])];
  const damageFee = calculateDamageFee(allDamages);

  const now = new Date();

  let updatedDeposits = order.deposits.map(dep => {
    if (dep.type === 'overtime_risk' && totalOvertimeFee > 0) {
      const deductAmount = Math.min(dep.amount, totalOvertimeFee);
      return {
        ...dep,
        status: 'partially_released' as const,
        releasedAmount: dep.amount - deductAmount,
        deductionReason: deductAmount > 0 ? `超时扣费 ¥${deductAmount.toFixed(2)}` : undefined,
        releasedAt: now.toISOString(),
      };
    }
    if (dep.type === 'studio') {
      return {
        ...dep,
        status: 'released' as const,
        releasedAmount: dep.amount,
        releasedAt: now.toISOString(),
      };
    }
    return dep;
  });

  const pendingDamages = allDamages.filter(d => d.status === 'pending');
  if (pendingDamages.length > 0) {
    updatedDeposits = updatedDeposits.map(dep => {
      if (dep.type === 'equipment') {
        return {
          ...dep,
          frozenReason: `设备损坏待认定，冻结 ¥${dep.amount.toFixed(2)}`,
          status: 'frozen' as const,
        };
      }
      return dep;
    });
  } else {
    updatedDeposits = updatedDeposits.map(dep => {
      if (dep.type === 'equipment' && dep.status === 'frozen') {
        return {
          ...dep,
          status: 'released' as const,
          releasedAmount: dep.amount,
          releasedAt: now.toISOString(),
        };
      }
      return dep;
    });
  }

  const updatedOrder: Order = {
    ...order,
    status: 'completed',
    actualEndTime,
    slots: updatedSlots,
    overtimeHours: totalOvertimeHours,
    overtimeFee: totalOvertimeFee,
    damages: allDamages,
    damageFee,
    deposits: updatedDeposits,
    updatedAt: now.toISOString(),
  };

  const newOrders = [...state.orders];
  newOrders[orderIndex] = updatedOrder;

  const newState = { ...state, orders: newOrders };
  saveState(newState);

  return { order: updatedOrder, state: newState };
}

export function releaseDeposit(
  orderId: string,
  depositType: DepositType,
  releaseAmount?: number,
  state: AppState
): { order: Order; state: AppState } | { error: string } {
  const orderIndex = state.orders.findIndex(o => o.id === orderId);
  if (orderIndex === -1) {
    return { error: '订单不存在' };
  }

  const order = state.orders[orderIndex];
  if (order.status !== 'completed') {
    return { error: '仅已完成订单可释放押金' };
  }

  const pendingDamages = order.damages.filter(d => d.status === 'pending');
  if (depositType === 'equipment' && pendingDamages.length > 0) {
    return { error: `存在${pendingDamages.length}项设备损坏待认定，暂不能释放设备押金` };
  }

  const now = new Date();
  const updatedDeposits = order.deposits.map(dep => {
    if (dep.type !== depositType) return dep;
    const amount = releaseAmount ?? dep.amount;
    return {
      ...dep,
      status: (amount >= dep.amount ? 'released' : 'partially_released') as 'released' | 'partially_released',
      releasedAmount: amount,
      releasedAt: now.toISOString(),
    };
  });

  const updatedOrder: Order = {
    ...order,
    deposits: updatedDeposits,
    updatedAt: now.toISOString(),
  };

  const newOrders = [...state.orders];
  newOrders[orderIndex] = updatedOrder;

  const newState = { ...state, orders: newOrders };
  saveState(newState);

  return { order: updatedOrder, state: newState };
}

export function resolveDamage(
  orderId: string,
  damageId: string,
  confirmedCost: number,
  state: AppState
): { order: Order; state: AppState } | { error: string } {
  const orderIndex = state.orders.findIndex(o => o.id === orderId);
  if (orderIndex === -1) {
    return { error: '订单不存在' };
  }

  const order = state.orders[orderIndex];
  const now = new Date();

  const updatedDamages = order.damages.map(d => {
    if (d.id !== damageId) return d;
    return {
      ...d,
      status: 'confirmed' as const,
      cost: confirmedCost,
      resolvedAt: now.toISOString(),
    };
  });

  const damageFee = calculateDamageFee(updatedDamages);

  const updatedDeposits = order.deposits.map(dep => {
    if (dep.type !== 'equipment') return dep;
    const deductAmount = Math.min(dep.amount, damageFee);
    return {
      ...dep,
      status: deductAmount >= dep.amount ? 'deducted' as const : 'partially_released' as const,
      releasedAmount: dep.amount - deductAmount,
      deductionReason: `设备损坏赔偿扣除 ¥${deductAmount.toFixed(2)}`,
      releasedAt: now.toISOString(),
    };
  });

  const updatedOrder: Order = {
    ...order,
    damages: updatedDamages,
    damageFee,
    deposits: updatedDeposits,
    updatedAt: now.toISOString(),
  };

  const newOrders = [...state.orders];
  newOrders[orderIndex] = updatedOrder;

  const newState = { ...state, orders: newOrders };
  saveState(newState);

  return { order: updatedOrder, state: newState };
}

export function cancelOrder(
  orderId: string,
  state: AppState
): { order: Order; state: AppState } | { error: string } {
  const orderIndex = state.orders.findIndex(o => o.id === orderId);
  if (orderIndex === -1) {
    return { error: '订单不存在' };
  }

  const order = state.orders[orderIndex];
  if (order.status === 'completed' || order.status === 'cancelled' || order.status === 'expired') {
    return { error: '当前订单状态不能取消' };
  }

  const now = new Date();
  const startTime = new Date(order.startTime);
  const hoursBeforeStart = (startTime.getTime() - now.getTime()) / (1000 * 60 * 60);

  const penaltyFee = calculatePenaltyFee(order, Math.max(0, hoursBeforeStart));

  const updatedDeposits = order.deposits.map(dep => {
    if (penaltyFee > 0) {
      const deductAmount = Math.min(dep.amount, penaltyFee);
      return {
        ...dep,
        status: deductAmount >= dep.amount ? 'deducted' as const : 'partially_released' as const,
        releasedAmount: dep.amount - deductAmount,
        deductionReason: `取消费扣除 ¥${deductAmount.toFixed(2)}`,
        releasedAt: now.toISOString(),
      };
    }
    return {
      ...dep,
      status: 'released' as const,
      releasedAmount: dep.amount,
      releasedAt: now.toISOString(),
    };
  });

  const updatedOrder: Order = {
    ...order,
    status: 'cancelled',
    penaltyFee,
    deposits: updatedDeposits,
    updatedAt: now.toISOString(),
  };

  const newOrders = [...state.orders];
  newOrders[orderIndex] = updatedOrder;

  const newState = { ...state, orders: newOrders };
  saveState(newState);

  return { order: updatedOrder, state: newState };
}

export function rescheduleOrder(
  orderId: string,
  newStartTime: string,
  newEndTime: string,
  state: AppState
): { order: Order; state: AppState } | { error: string } {
  const orderIndex = state.orders.findIndex(o => o.id === orderId);
  if (orderIndex === -1) {
    return { error: '订单不存在' };
  }

  const order = state.orders[orderIndex];
  if (order.status === 'completed' || order.status === 'cancelled' || order.status === 'expired') {
    return { error: '当前订单状态不能改期' };
  }
  if (order.status === 'in_progress') {
    return { error: '进行中的订单不能改期' };
  }
  if (order.finalPaymentCollected) {
    return { error: '已收尾款的订单不能改期，请先申请退款重开单' };
  }

  const now = new Date();

  if (!order.slots || order.slots.length === 0) {
    const checkStudioId = order.studioId;
    const checkEquipments = order.equipments;
    const checkAssistants = order.assistantIds;

    const conflicts = checkAllConflicts(
      {
        studioId: checkStudioId,
        startTime: newStartTime,
        endTime: newEndTime,
        equipments: checkEquipments,
        assistantIds: checkAssistants,
        excludeOrderId: orderId,
      },
      state.orders,
      state.studios,
      state.equipments,
      state.assistants,
      state.maintenanceDays
    );

    if (conflicts.length > 0) {
      const conflictNames = conflicts.map(c => c.name).join(', ');
      return { error: `新档期存在冲突: ${conflictNames}` };
    }

    const fees = calculateOrderFees(
      {
        studioId: checkStudioId,
        startTime: newStartTime,
        endTime: newEndTime,
        equipments: checkEquipments,
        assistantIds: checkAssistants,
        setupTime: order.setupTime,
        teardownTime: order.teardownTime,
      },
      state.studios,
      state.equipments,
      state.assistants
    );

    const validation = validatePriceAdjustment(order, fees.totalAmount);
    if (!validation.allowed) {
      return { error: validation.reason || '价格调整不被允许' };
    }

    const updatedOrder: Order = {
      ...order,
      startTime: newStartTime,
      endTime: newEndTime,
      baseAmount: fees.baseAmount,
      equipmentAmount: fees.equipmentAmount,
      assistantAmount: fees.assistantAmount,
      depositAmount: fees.depositAmount,
      studioDepositAmount: fees.studioDepositAmount,
      equipmentDepositAmount: fees.equipmentDepositAmount,
      overtimeRiskDepositAmount: fees.overtimeRiskDepositAmount,
      affectedByMaintenance: undefined,
      maintenanceImpact: undefined,
      rescheduleOption: undefined,
      updatedAt: now.toISOString(),
    };

    const newOrders = [...state.orders];
    newOrders[orderIndex] = updatedOrder;

    const newState = { ...state, orders: newOrders };
    saveState(newState);

    return { order: updatedOrder, state: newState };
  }

  const timeDiffMs = new Date(newStartTime).getTime() - new Date(order.slots[0].startTime).getTime();

  const newSlots = order.slots.map(slot => {
    const slotNewStart = new Date(slot.startTime).getTime() + timeDiffMs;
    const slotNewEnd = new Date(slot.endTime).getTime() + timeDiffMs;
    return {
      ...slot,
      startTime: new Date(slotNewStart).toISOString(),
      endTime: new Date(slotNewEnd).toISOString(),
      phases: buildTimePhases(
        new Date(slotNewStart).toISOString(),
        new Date(slotNewEnd).toISOString(),
        slot.setupTime,
        slot.teardownTime
      ),
    };
  });

  const slotParams = newSlots.map(slot => ({
    studioId: slot.studioId,
    startTime: slot.startTime,
    endTime: slot.endTime,
    equipments: slot.equipments,
    assistantIds: slot.assistantIds,
    setupTime: slot.setupTime,
    teardownTime: slot.teardownTime,
  }));

  const conflicts = checkMultiSlotConflicts(
    { slots: slotParams, excludeOrderId: orderId },
    state.orders,
    state.studios,
    state.equipments,
    state.assistants,
    state.maintenanceDays
  );

  if (conflicts.length > 0) {
    const conflictNames = conflicts.map(c =>
      `时段${c.slotId ? (parseInt(c.slotId.replace('slot-', '')) + 1) : 1} - ${c.name}`
    ).join('; ');
    return { error: `新档期存在冲突: ${conflictNames}` };
  }

  const newFees = calculateMultiSlotOrderFees(slotParams, state.studios, state.equipments, state.assistants);

  const validation = validatePriceAdjustment(order, newFees.totalAmount);
  if (!validation.allowed) {
    return { error: validation.reason || '价格调整不被允许' };
  }

  const sortedSlots = sortSlots(newSlots);

  const updatedOrder: Order = {
    ...order,
    startTime: sortedSlots[0]?.startTime || newStartTime,
    endTime: sortedSlots[sortedSlots.length - 1]?.endTime || newEndTime,
    slots: sortedSlots,
    baseAmount: newFees.baseAmount,
    equipmentAmount: newFees.equipmentAmount,
    assistantAmount: newFees.assistantAmount,
    depositAmount: newFees.depositAmount,
    studioDepositAmount: newFees.studioDepositAmount,
    equipmentDepositAmount: newFees.equipmentDepositAmount,
    overtimeRiskDepositAmount: newFees.overtimeRiskDepositAmount,
    affectedByMaintenance: undefined,
    maintenanceImpact: undefined,
    rescheduleOption: undefined,
    updatedAt: now.toISOString(),
  };

  const newOrders = [...state.orders];
  newOrders[orderIndex] = updatedOrder;

  const newState = { ...state, orders: newOrders };
  saveState(newState);

  return { order: updatedOrder, state: newState };
}

export function handleMaintenanceImpact(
  orderId: string,
  optionType: MaintenanceImpactOptionType,
  optionData?: Partial<MaintenanceImpactOption>,
  state: AppState
): { order: Order; state: AppState } | { error: string } {
  const orderIndex = state.orders.findIndex(o => o.id === orderId);
  if (orderIndex === -1) {
    return { error: '订单不存在' };
  }

  const order = state.orders[orderIndex];
  if (!order.affectedByMaintenance) {
    return { error: '订单未受维护影响' };
  }

  const now = new Date();
  const maintImpact = order.maintenanceImpact;

  switch (optionType) {
    case 'reschedule':
      if (!optionData?.newStartTime || !optionData?.newEndTime) {
        return { error: '改期需要新的起止时间' };
      }
      const rescheduleResult = rescheduleOrder(orderId, optionData.newStartTime, optionData.newEndTime, state);
      if ('error' in rescheduleResult) {
        return rescheduleResult;
      }
      const updatedOrderReschedule: Order = {
        ...rescheduleResult.order,
        maintenanceImpact: {
          maintenanceId: order.affectedByMaintenance,
          affectedSlotIds: [],
          options: maintImpact?.options || [],
          selectedOption: 'reschedule',
          handledAt: now.toISOString(),
        },
      };
      const newOrdersReschedule = [...state.orders];
      newOrdersReschedule[orderIndex] = updatedOrderReschedule;
      const newStateReschedule = { ...state, orders: newOrdersReschedule };
      saveState(newStateReschedule);
      return { order: updatedOrderReschedule, state: newStateReschedule };

    case 'change_studio':
      if (!optionData?.newStudioId) {
        return { error: '换棚需要指定新棚位' };
      }
      if (order.finalPaymentCollected) {
        return { error: '已收尾款订单不能换棚，请先申请退款重开单' };
      }
      {
        const newStudio = state.studios.find(s => s.id === optionData.newStudioId);
        if (!newStudio) return { error: '新棚位不存在' };

        let updatedSlots = order.slots;
        let newBaseAmount = order.baseAmount;
        let newStudioDeposit = order.studioDepositAmount;

        if (order.slots && order.slots.length > 0) {
          const affectedSlotIds = maintImpact?.affectedSlotIds || [];
          updatedSlots = order.slots.map(slot => {
            if (affectedSlotIds.includes(slot.id) || affectedSlotIds.length === 0) {
              const originalStudio = state.studios.find(s => s.id === slot.studioId);
              const hours = getDuration(slot.startTime, slot.endTime);
              const originalBase = originalStudio ? originalStudio.basePricePerHour * hours : slot.baseAmount;
              const newBase = newStudio.basePricePerHour * hours;
              const baseDiff = newBase - originalBase;
              newBaseAmount += baseDiff;
              return {
                ...slot,
                studioId: optionData.newStudioId!,
                baseAmount: Math.round(newBase * 100) / 100,
              };
            }
            return slot;
          });
          newStudioDeposit = Math.ceil(newBaseAmount * STUDIO_DEPOSIT_RATIO / 100) * 100;
        }

        const validation = validatePriceAdjustment(order, newBaseAmount + order.equipmentAmount + order.assistantAmount);
        if (!validation.allowed) {
          return { error: validation.reason || '价格调整不被允许' };
        }

        const updatedOrder: Order = {
          ...order,
          studioId: optionData.newStudioId,
          slots: updatedSlots,
          baseAmount: Math.round(newBaseAmount * 100) / 100,
          studioDepositAmount: newStudioDeposit,
          depositAmount: newStudioDeposit + order.equipmentDepositAmount + order.overtimeRiskDepositAmount,
          affectedByMaintenance: undefined,
          maintenanceImpact: {
            maintenanceId: order.affectedByMaintenance,
            affectedSlotIds: [],
            options: maintImpact?.options || [],
            selectedOption: 'change_studio',
            handledAt: now.toISOString(),
          },
          updatedAt: now.toISOString(),
        };

        const newOrders = [...state.orders];
        newOrders[orderIndex] = updatedOrder;
        const newState = { ...state, orders: newOrders };
        saveState(newState);
        return { order: updatedOrder, state: newState };
      }

    case 'reduce_config': {
      if (order.finalPaymentCollected) {
        return { error: '已收尾款订单不能减配，请先申请退款重开单' };
      }
      const affectedSlotIds = maintImpact?.affectedSlotIds || [];
      let totalSaving = 0;
      let updatedEquipments = [...order.equipments];
      let updatedSlots = [...order.slots];

      if (order.slots && order.slots.length > 0) {
        updatedSlots = order.slots.map(slot => {
          if (affectedSlotIds.includes(slot.id) || affectedSlotIds.length === 0) {
            if (slot.equipments.length > 0) {
              const lowestPriceEq = slot.equipments.reduce((lowest, eq) => {
                const eqInfo = state.equipments.find(e => e.id === eq.equipmentId);
                const eqPrice = eqInfo ? eqInfo.pricePerHour * eq.quantity : Infinity;
                const lowestInfo = state.equipments.find(e => e.id === lowest.equipmentId);
                const lowestPrice = lowestInfo ? lowestInfo.pricePerHour * lowest.quantity : Infinity;
                return eqPrice < lowestPrice ? eq : lowest;
              });
              const eqInfo = state.equipments.find(e => e.id === lowestPriceEq.equipmentId);
              if (eqInfo) {
                const hours = getDuration(slot.startTime, slot.endTime);
                const saving = eqInfo.pricePerHour * lowestPriceEq.quantity * hours;
                totalSaving += saving;
                const newEquipments = slot.equipments.filter(e => e.equipmentId !== lowestPriceEq.equipmentId);
                return {
                  ...slot,
                  equipments: newEquipments,
                  equipmentAmount: Math.round((slot.equipmentAmount - saving) * 100) / 100,
                };
              }
            }
          }
          return slot;
        });
      }

      const newEquipmentAmount = Math.max(0, order.equipmentAmount - totalSaving);
      const newEquipmentDeposit = Math.ceil(newEquipmentAmount * EQUIPMENT_DEPOSIT_RATIO / 100) * 100;

      const newTotal = order.baseAmount + newEquipmentAmount + order.assistantAmount;
      const validation = validatePriceAdjustment(order, newTotal);
      if (!validation.allowed) {
        return { error: validation.reason || '价格调整不被允许' };
      }

      const updatedOrder: Order = {
        ...order,
        equipments: updatedEquipments,
        slots: updatedSlots,
        equipmentAmount: Math.round(newEquipmentAmount * 100) / 100,
        equipmentDepositAmount: newEquipmentDeposit,
        depositAmount: order.studioDepositAmount + newEquipmentDeposit + order.overtimeRiskDepositAmount,
        affectedByMaintenance: undefined,
        maintenanceImpact: {
          maintenanceId: order.affectedByMaintenance,
          affectedSlotIds: [],
          options: maintImpact?.options || [],
          selectedOption: 'reduce_config',
          handledAt: now.toISOString(),
        },
        updatedAt: now.toISOString(),
      };

      const newOrders = [...state.orders];
      newOrders[orderIndex] = updatedOrder;
      const newState = { ...state, orders: newOrders };
      saveState(newState);
      return { order: updatedOrder, state: newState };
    }

    case 'compensation': {
      const compensationAmount = optionData?.compensationAmount || 0;
      const updatedOrder: Order = {
        ...order,
        penaltyFee: -compensationAmount,
        affectedByMaintenance: undefined,
        maintenanceImpact: {
          maintenanceId: order.affectedByMaintenance,
          affectedSlotIds: [],
          options: maintImpact?.options || [],
          selectedOption: 'compensation',
          handledAt: now.toISOString(),
        },
        updatedAt: now.toISOString(),
      };
      const newOrders = [...state.orders];
      newOrders[orderIndex] = updatedOrder;
      const newState = { ...state, orders: newOrders };
      saveState(newState);
      return { order: updatedOrder, state: newState };
    }

    default:
      return { error: '未知处理选项' };
  }
}

export function updateOrderDamages(
  orderId: string,
  damages: OrderDamage[],
  state: AppState
): { order: Order; state: AppState } | { error: string } {
  const orderIndex = state.orders.findIndex(o => o.id === orderId);
  if (orderIndex === -1) {
    return { error: '订单不存在' };
  }

  const order = state.orders[orderIndex];
  const damageFee = calculateDamageFee(damages);

  const updatedOrder: Order = {
    ...order,
    damages,
    damageFee,
    updatedAt: new Date().toISOString(),
  };

  const newOrders = [...state.orders];
  newOrders[orderIndex] = updatedOrder;

  const newState = { ...state, orders: newOrders };
  saveState(newState);

  return { order: updatedOrder, state: newState };
}

export function setOrderToPendingDeposit(
  orderId: string,
  state: AppState
): { order: Order; state: AppState } | { error: string } {
  const orderIndex = state.orders.findIndex(o => o.id === orderId);
  if (orderIndex === -1) {
    return { error: '订单不存在' };
  }

  const order = state.orders[orderIndex];
  if (order.status !== 'temp') {
    return { error: '只有临时订单可以转为待支付' };
  }

  const now = new Date();
  const depositExpiresAt = addHours(now, 12);

  const updatedOrder: Order = {
    ...order,
    status: 'pending_deposit',
    tempExpiresAt: undefined,
    depositExpiresAt: depositExpiresAt.toISOString(),
    updatedAt: now.toISOString(),
  };

  const newOrders = [...state.orders];
  newOrders[orderIndex] = updatedOrder;

  const newState = { ...state, orders: newOrders };
  saveState(newState);

  return { order: updatedOrder, state: newState };
}

export function generateMaintenanceImpactOptions(
  order: Order,
  maintenanceId: string,
  state: AppState
): MaintenanceImpact {
  const { studios, equipments, assistants, maintenanceDays, orders } = state;
  const affectedSlotIds = getAffectedSlotIds(order, maintenanceId, maintenanceDays);

  const options: MaintenanceImpactOption[] = [];

  const rescheduleOption = generateRescheduleOption(order, affectedSlotIds, studios, equipments, assistants, maintenanceDays, orders);
  if (rescheduleOption) {
    options.push(rescheduleOption);
  }

  const changeStudioOption = generateChangeStudioOption(order, affectedSlotIds, studios, equipments, maintenanceDays, orders);
  if (changeStudioOption) {
    options.push(changeStudioOption);
  }

  const reduceConfigOption = generateReduceConfigOption(order, affectedSlotIds, equipments, assistants);
  if (reduceConfigOption) {
    options.push(reduceConfigOption);
  }

  const compensationOption = generateCompensationOption(order, affectedSlotIds);
  options.push(compensationOption);

  return {
    maintenanceId,
    affectedSlotIds,
    options,
  };
}

function getAffectedSlotIds(order: Order, maintenanceId: string, maintenanceDays: any[]): string[] {
  const maint = maintenanceDays.find(m => m.id === maintenanceId);
  if (!maint || !order.slots || order.slots.length === 0) return [];

  return order.slots
    .filter(slot => {
      if (slot.studioId !== maint.studioId) return false;
      const startDate = slot.startTime.slice(0, 10);
      const endDate = slot.endTime.slice(0, 10);
      return maint.date >= startDate && maint.date <= endDate;
    })
    .map(slot => slot.id);
}

function generateRescheduleOption(
  order: Order,
  affectedSlotIds: string[],
  studios: Studio[],
  equipments: Equipment[],
  assistants: Assistant[],
  maintenanceDays: any[],
  orders: Order[]
): MaintenanceImpactOption | null {
  if (!order.slots || order.slots.length === 0) return null;

  const firstSlot = order.slots[0];
  const lastSlot = order.slots[order.slots.length - 1];
  const totalDurationHours = (new Date(lastSlot.endTime).getTime() - new Date(firstSlot.startTime).getTime()) / (1000 * 60 * 60);

  let bestNewStart: string | null = null;
  let daysOffset = 1;
  const maxDaysToSearch = 7;

  while (daysOffset <= maxDaysToSearch) {
    const newStartTime = addDays(firstSlot.startTime, daysOffset);
    const newEndTime = addDays(lastSlot.endTime, daysOffset);

    let hasConflict = false;
    for (const slot of order.slots) {
      const slotNewStart = addDays(slot.startTime, daysOffset);
      const slotNewEnd = addDays(slot.endTime, daysOffset);
      const studio = studios.find(s => s.id === slot.studioId);
      if (!studio) continue;

      const startDate = slotNewStart.slice(0, 10);
      const onMaintenance = maintenanceDays.some(m =>
        m.studioId === slot.studioId && m.date === startDate
      );
      if (onMaintenance) {
        hasConflict = true;
        break;
      }

      for (const otherOrder of orders) {
        if (otherOrder.id === order.id) continue;
        if (otherOrder.status === 'expired' || otherOrder.status === 'cancelled') continue;
        if (!otherOrder.slots || otherOrder.slots.length === 0) continue;

        for (const otherSlot of otherOrder.slots) {
          if (otherSlot.studioId !== slot.studioId) continue;
          if (isOverlapping(slotNewStart, slotNewEnd, otherSlot.startTime, otherSlot.endTime)) {
            hasConflict = true;
            break;
          }
        }
        if (hasConflict) break;
      }
      if (hasConflict) break;
    }

    if (!hasConflict) {
      bestNewStart = newStartTime;
      break;
    }
    daysOffset++;
  }

  if (!bestNewStart) {
    return {
      type: 'reschedule',
      label: '改期',
      description: '暂未找到可用档期，请联系客服协商',
      priceDiff: 0,
    };
  }

  return {
    type: 'reschedule',
    label: '改期',
    description: `顺延${daysOffset}天，保持原有配置`,
    priceDiff: 0,
    newStartTime: bestNewStart,
    newEndTime: addDays(lastSlot.endTime, daysOffset),
  };
}

function generateChangeStudioOption(
  order: Order,
  affectedSlotIds: string[],
  studios: Studio[],
  equipments: Equipment[],
  maintenanceDays: any[],
  orders: Order[]
): MaintenanceImpactOption | null {
  if (!order.slots || order.slots.length === 0) return null;

  const affectedSlots = order.slots.filter(s => affectedSlotIds.includes(s.id));
  if (affectedSlots.length === 0) return null;

  let bestStudio: Studio | null = null;
  let minPriceDiff = Infinity;

  for (const studio of studios) {
    if (studio.id === affectedSlots[0].studioId) continue;

    let allSlotsAvailable = true;
    for (const slot of affectedSlots) {
      const startDate = slot.startTime.slice(0, 10);
      const onMaintenance = maintenanceDays.some(m =>
        m.studioId === studio.id && m.date === startDate
      );
      if (onMaintenance) {
        allSlotsAvailable = false;
        break;
      }

      for (const otherOrder of orders) {
        if (otherOrder.id === order.id) continue;
        if (otherOrder.status === 'expired' || otherOrder.status === 'cancelled') continue;
        if (!otherOrder.slots || otherOrder.slots.length === 0) continue;

        for (const otherSlot of otherOrder.slots) {
          if (otherSlot.studioId !== studio.id) continue;
          if (isOverlapping(slot.startTime, slot.endTime, otherSlot.startTime, otherSlot.endTime)) {
            allSlotsAvailable = false;
            break;
          }
        }
        if (!allSlotsAvailable) break;
      }
      if (!allSlotsAvailable) break;
    }

    if (allSlotsAvailable) {
      const originalStudio = studios.find(s => s.id === affectedSlots[0].studioId);
      const originalHours = getDuration(affectedSlots[0].startTime, affectedSlots[0].endTime);
      const priceDiff = (studio.basePricePerHour - (originalStudio?.basePricePerHour || 0)) * originalHours;
      
      if (priceDiff < minPriceDiff) {
        minPriceDiff = priceDiff;
        bestStudio = studio;
      }
    }
  }

  if (!bestStudio) {
    return {
      type: 'change_studio',
      label: '换棚',
      description: '暂无可替换棚位，请联系客服',
      priceDiff: 0,
    };
  }

  return {
    type: 'change_studio',
    label: '换棚',
    description: `更换至 ${bestStudio.name}`,
    priceDiff: Math.round(minPriceDiff * 100) / 100,
    newStudioId: bestStudio.id,
  };
}

function generateReduceConfigOption(
  order: Order,
  affectedSlotIds: string[],
  equipments: Equipment[],
  assistants: Assistant[]
): MaintenanceImpactOption | null {
  if (!order.slots || order.slots.length === 0) return null;

  const affectedSlots = order.slots.filter(s => affectedSlotIds.includes(s.id));
  if (affectedSlots.length === 0) return null;

  let totalSaving = 0;
  let reduceItems: string[] = [];

  for (const slot of affectedSlots) {
    const hours = getDuration(slot.startTime, slot.endTime);
    
    if (slot.equipments.length > 0) {
      const lowestPriceEq = slot.equipments.reduce((lowest, eq) => {
        const eqInfo = equipments.find(e => e.id === eq.equipmentId);
        const eqPrice = eqInfo ? eqInfo.pricePerHour * eq.quantity : Infinity;
        const lowestInfo = equipments.find(e => e.id === lowest.equipmentId);
        const lowestPrice = lowestInfo ? lowestInfo.pricePerHour * lowest.quantity : Infinity;
        return eqPrice < lowestPrice ? eq : lowest;
      });
      const eqInfo = equipments.find(e => e.id === lowestPriceEq.equipmentId);
      if (eqInfo) {
        totalSaving += eqInfo.pricePerHour * lowestPriceEq.quantity * hours;
        reduceItems.push(eqInfo.name);
      }
    }

    if (slot.assistantIds.length > 0) {
      for (const asstId of slot.assistantIds) {
        const asst = assistants.find(a => a.id === asstId);
        if (asst) {
          totalSaving += asst.pricePerHour * hours;
          reduceItems.push(asst.name);
        }
      }
    }
  }

  if (totalSaving <= 0 || reduceItems.length === 0) {
    return {
      type: 'reduce_config',
      label: '减配',
      description: '无可减配项目',
      priceDiff: 0,
    };
  }

  return {
    type: 'reduce_config',
    label: '减配',
    description: `减少 ${reduceItems.slice(0, 2).join('、')} 等${reduceItems.length}项配置`,
    priceDiff: -Math.round(totalSaving * 100) / 100,
  };
}

function generateCompensationOption(
  order: Order,
  affectedSlotIds: string[]
): MaintenanceImpactOption {
  if (!order.slots || order.slots.length === 0) {
    return {
      type: 'compensation',
      label: '赔付',
      description: '维持原安排，运营赔付违约金',
      priceDiff: 0,
      compensationAmount: Math.round(order.baseAmount * 0.2 * 100) / 100,
    };
  }

  const affectedSlots = order.slots.filter(s => affectedSlotIds.includes(s.id));
  const affectedAmount = affectedSlots.reduce((sum, slot) => sum + slot.baseAmount + slot.equipmentAmount + slot.assistantAmount, 0);
  const compensationAmount = Math.round(affectedAmount * 0.3 * 100) / 100;

  return {
    type: 'compensation',
    label: '赔付',
    description: '维持原安排，运营赔付违约金',
    priceDiff: 0,
    compensationAmount,
  };
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function isOverlapping(start1: string, end1: string, start2: string, end2: string): boolean {
  const s1 = new Date(start1).getTime();
  const e1 = new Date(end1).getTime();
  const s2 = new Date(start2).getTime();
  const e2 = new Date(end2).getTime();
  return s1 < e2 && s2 < e1;
}

function getDuration(startTime: string, endTime: string): number {
  return (new Date(endTime).getTime() - new Date(startTime).getTime()) / (1000 * 60 * 60);
}
