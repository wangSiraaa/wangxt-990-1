import type { AppState, Order, MaintenanceDay, BookingSlot, TimePhase } from '../types';
import { 
  initialStudios, 
  initialEquipments, 
  initialAssistants, 
  generateInitialOrders,
  generateInitialMaintenanceDays 
} from '../data/initialData';
import { buildTimePhases } from '../services/feeService';

const STORAGE_KEY = 'studio_rental_app_state';

function migrateOrderData(order: Order): Order {
  let migrated = { ...order };

  if (!migrated.slots || migrated.slots.length === 0) {
    const phases = buildTimePhases(
      migrated.startTime,
      migrated.endTime,
      migrated.setupTime || 0.5,
      migrated.teardownTime || 0.5
    );
    migrated.slots = [{
      id: `slot-${Math.random().toString(36).slice(2, 9)}`,
      studioId: migrated.studioId,
      startTime: migrated.startTime,
      endTime: migrated.endTime,
      phases,
      equipments: migrated.equipments?.map(e => ({ ...e })) || [],
      assistantIds: migrated.assistantIds ? [...migrated.assistantIds] : [],
      setupTime: migrated.setupTime || 0.5,
      teardownTime: migrated.teardownTime || 0.5,
      overtimeHours: migrated.overtimeHours || 0,
      overtimeFee: migrated.overtimeFee || 0,
      baseAmount: migrated.baseAmount || 0,
      equipmentAmount: migrated.equipmentAmount || 0,
      assistantAmount: migrated.assistantAmount || 0,
    } as BookingSlot];
  } else {
    migrated.slots = migrated.slots.map(slot => {
      let updatedSlot = { ...slot };
      if (!updatedSlot.phases || updatedSlot.phases.length === 0) {
        updatedSlot.phases = buildTimePhases(
          updatedSlot.startTime,
          updatedSlot.endTime,
          updatedSlot.setupTime || 0.5,
          updatedSlot.teardownTime || 0.5
        ) as TimePhase[];
      }
      if (!updatedSlot.equipments) updatedSlot.equipments = [];
      if (!updatedSlot.assistantIds) updatedSlot.assistantIds = [];
      if (updatedSlot.overtimeHours === undefined) updatedSlot.overtimeHours = 0;
      if (updatedSlot.overtimeFee === undefined) updatedSlot.overtimeFee = 0;
      return updatedSlot;
    });
  }

  if (!migrated.deposits) migrated.deposits = [];
  if (!migrated.damages) migrated.damages = [];
  if (!migrated.payments) migrated.payments = [];
  if (migrated.priceLocked === undefined) migrated.priceLocked = false;
  if (migrated.overtimeHours === undefined) migrated.overtimeHours = 0;
  if (migrated.overtimeFee === undefined) migrated.overtimeFee = 0;
  if (migrated.penaltyFee === undefined) migrated.penaltyFee = 0;
  if (migrated.damageFee === undefined) migrated.damageFee = 0;
  if (!migrated.equipments) migrated.equipments = [];
  if (!migrated.assistantIds) migrated.assistantIds = [];

  return migrated;
}

function migrateState(state: AppState): AppState {
  let hasChanges = false;
  const migratedOrders = state.orders.map(order => {
    const needsMigration = 
      !order.slots || 
      !order.deposits || 
      !order.damages || 
      !order.payments;
    if (needsMigration) {
      hasChanges = true;
      return migrateOrderData(order);
    }
    return order;
  });

  if (hasChanges) {
    const newState = { ...state, orders: migratedOrders };
    saveState(newState);
    return newState;
  }
  return state;
}

export function getInitialState(): AppState {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const state = JSON.parse(saved) as AppState;
      return migrateState(state);
    } catch (e) {
      console.error('Failed to parse saved state:', e);
    }
  }
  
  const now = new Date();
  const currentDate = now.toISOString().slice(0, 10);
  
  return {
    studios: initialStudios,
    equipments: initialEquipments,
    assistants: initialAssistants,
    orders: generateInitialOrders(),
    maintenanceDays: generateInitialMaintenanceDays(),
    currentRole: 'operator',
    currentDate,
    selectedStudioId: null,
  };
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save state:', e);
  }
}

export function clearState(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function resetState(): AppState {
  clearState();
  return getInitialState();
}

export function checkAndExpireTempOrders(state: AppState): AppState {
  const now = new Date();
  let hasChanges = false;
  
  const updatedOrders = state.orders.map(order => {
    if (order.status === 'temp' && order.tempExpiresAt) {
      const expiresAt = new Date(order.tempExpiresAt);
      if (now > expiresAt) {
        hasChanges = true;
        return { ...order, status: 'expired' as const, updatedAt: now.toISOString() };
      }
    }
    
    if (order.status === 'pending_deposit' && order.depositExpiresAt) {
      const expiresAt = new Date(order.depositExpiresAt);
      if (now > expiresAt) {
        hasChanges = true;
        return { ...order, status: 'expired' as const, updatedAt: now.toISOString() };
      }
    }
    
    return order;
  });
  
  if (hasChanges) {
    const newState = { ...state, orders: updatedOrders };
    saveState(newState);
    return newState;
  }
  
  return state;
}

export function updateOrdersStatusByTime(state: AppState): AppState {
  const now = new Date();
  let hasChanges = false;

  const updatedOrders = state.orders.map(order => {
    const actualStartTime = order.slots && order.slots.length > 0
      ? order.slots[0].startTime
      : order.startTime;
    const actualEndTime = order.slots && order.slots.length > 0
      ? order.slots[order.slots.length - 1].endTime
      : order.endTime;

    const startTime = new Date(actualStartTime);
    const endTime = new Date(actualEndTime);

    if (order.status === 'confirmed' && now >= startTime && now < endTime) {
      hasChanges = true;
      return { ...order, status: 'in_progress' as const, updatedAt: now.toISOString() };
    }

    if (order.status === 'in_progress' && now >= endTime) {
      hasChanges = true;
      return { ...order, status: 'completed' as const, updatedAt: now.toISOString() };
    }

    return order;
  });

  if (hasChanges) {
    const newState = { ...state, orders: updatedOrders };
    saveState(newState);
    return newState;
  }

  return state;
}

export function getOrdersByStudioAndDate(
  orders: Order[],
  studioId: string,
  date: Date | string
): Order[] {
  const dateStr = typeof date === 'string' ? date : date.toISOString().slice(0, 10);

  return orders.filter(order => {
    if (order.status === 'expired' || order.status === 'cancelled') return false;

    if (order.slots && order.slots.length > 0) {
      return order.slots.some(slot => {
        if (slot.studioId !== studioId) return false;
        const startDate = slot.startTime.slice(0, 10);
        const endDate = slot.endTime.slice(0, 10);
        return dateStr >= startDate && dateStr <= endDate;
      });
    }

    if (order.studioId !== studioId) return false;
    const startDate = order.startTime.slice(0, 10);
    const endDate = order.endTime.slice(0, 10);
    return dateStr >= startDate && dateStr <= endDate;
  });
}

export function isStudioOnMaintenance(
  maintenanceDays: MaintenanceDay[],
  studioId: string,
  date: Date | string
): boolean {
  const dateStr = typeof date === 'string' ? date : date.toISOString().slice(0, 10);
  
  return maintenanceDays.some(m => m.studioId === studioId && m.date === dateStr);
}

export function getMaintenanceDaysByStudio(
  maintenanceDays: MaintenanceDay[],
  studioId: string
): MaintenanceDay[] {
  return maintenanceDays.filter(m => m.studioId === studioId);
}

export function getAffectedOrdersByMaintenance(
  orders: Order[],
  maintenanceDay: MaintenanceDay
): Order[] {
  return orders.filter(order => {
    if (order.status === 'expired' || order.status === 'cancelled' || order.status === 'completed') return false;

    const checkSlots = order.slots && order.slots.length > 0 ? order.slots : [
      { studioId: order.studioId, startTime: order.startTime, endTime: order.endTime }
    ];

    return checkSlots.some(slot => {
      if (slot.studioId !== maintenanceDay.studioId) return false;
      const startDate = slot.startTime.slice(0, 10);
      const endDate = slot.endTime.slice(0, 10);
      return maintenanceDay.date >= startDate && maintenanceDay.date <= endDate;
    });
  });
}
