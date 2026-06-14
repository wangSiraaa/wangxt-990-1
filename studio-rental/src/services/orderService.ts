import { Order, OrderStatus, DepositChannel, OrderDamage, AppState } from '../types';
import { generateId, generateOrderNo, addHours } from '../utils/dateUtils';
import { calculateOrderFees, calculateOvertimeFee, calculatePenaltyFee, SETUP_DEFAULT_HOURS, TEARDOWN_DEFAULT_HOURS } from './feeService';
import { checkAllConflicts } from './conflictService';
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
  
  const order: Order = {
    id: generateId('order'),
    orderNo: generateOrderNo(),
    studioId: params.studioId,
    customerName: params.customerName,
    customerPhone: params.customerPhone,
    photographer: params.photographer,
    startTime: params.startTime,
    endTime: params.endTime,
    equipments: params.equipments,
    assistantIds: params.assistantIds,
    setupTime: params.setupTime ?? SETUP_DEFAULT_HOURS,
    teardownTime: params.teardownTime ?? TEARDOWN_DEFAULT_HOURS,
    baseAmount: fees.baseAmount,
    equipmentAmount: fees.equipmentAmount,
    assistantAmount: fees.assistantAmount,
    depositAmount: fees.depositAmount,
    overtimeHours: 0,
    overtimeFee: 0,
    penaltyFee: 0,
    damageFee: 0,
    damages: [],
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
  const updatedOrder: Order = {
    ...order,
    status: 'deposit_confirmed',
    depositChannel: channel,
    depositConfirmedAt: now.toISOString(),
    depositExpiresAt: undefined,
    tempExpiresAt: undefined,
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
  const updatedOrder: Order = {
    ...order,
    status: 'confirmed',
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
  
  const studio = state.studios.find(s => s.id === order.studioId);
  if (!studio) {
    return { error: '棚位不存在' };
  }
  
  const { overtimeHours, overtimeFee } = calculateOvertimeFee(
    order.endTime,
    actualEndTime,
    studio,
    order.equipments,
    state.equipments,
    state.assistants,
    order.assistantIds
  );
  
  const allDamages = [...order.damages, ...(damages || [])];
  const damageFee = allDamages.reduce((sum, d) => sum + d.cost, 0);
  
  const now = new Date();
  const updatedOrder: Order = {
    ...order,
    status: 'completed',
    actualEndTime,
    overtimeHours,
    overtimeFee,
    damages: allDamages,
    damageFee,
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
  
  const updatedOrder: Order = {
    ...order,
    status: 'cancelled',
    penaltyFee,
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
  
  const conflicts = checkAllConflicts(
    {
      studioId: order.studioId,
      startTime: newStartTime,
      endTime: newEndTime,
      equipments: order.equipments,
      assistantIds: order.assistantIds,
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
      studioId: order.studioId,
      startTime: newStartTime,
      endTime: newEndTime,
      equipments: order.equipments,
      assistantIds: order.assistantIds,
      setupTime: order.setupTime,
      teardownTime: order.teardownTime,
    },
    state.studios,
    state.equipments,
    state.assistants
  );
  
  const now = new Date();
  const updatedOrder: Order = {
    ...order,
    startTime: newStartTime,
    endTime: newEndTime,
    baseAmount: fees.baseAmount,
    equipmentAmount: fees.equipmentAmount,
    assistantAmount: fees.assistantAmount,
    depositAmount: fees.depositAmount,
    affectedByMaintenance: undefined,
    rescheduleOption: undefined,
    updatedAt: now.toISOString(),
  };
  
  const newOrders = [...state.orders];
  newOrders[orderIndex] = updatedOrder;
  
  const newState = { ...state, orders: newOrders };
  saveState(newState);
  
  return { order: updatedOrder, state: newState };
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
  
  const damageFee = damages.reduce((sum, d) => sum + d.cost, 0);
  
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
