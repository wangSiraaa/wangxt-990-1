import { AppState, Order, MaintenanceDay } from '../types';
import { 
  initialStudios, 
  initialEquipments, 
  initialAssistants, 
  generateInitialOrders,
  generateInitialMaintenanceDays 
} from '../data/initialData';

const STORAGE_KEY = 'studio_rental_app_state';

export function getInitialState(): AppState {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved) as AppState;
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
    const startTime = new Date(order.startTime);
    const endTime = new Date(order.endTime);
    
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
    if (order.studioId !== studioId) return false;
    if (order.status === 'expired' || order.status === 'cancelled') return false;
    
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
    if (order.studioId !== maintenanceDay.studioId) return false;
    if (order.status === 'expired' || order.status === 'cancelled' || order.status === 'completed') return false;
    
    const startDate = order.startTime.slice(0, 10);
    const endDate = order.endTime.slice(0, 10);
    
    return maintenanceDay.date >= startDate && maintenanceDay.date <= endDate;
  });
}
