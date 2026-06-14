import { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { AppState, Role, Order, MaintenanceDay } from '../types';
import { getInitialState, saveState, checkAndExpireTempOrders, updateOrdersStatusByTime } from '../store/storage';
import * as orderService from '../services/orderService';

interface AppStateContextType {
  state: AppState;
  setRole: (role: Role) => void;
  setCurrentDate: (date: string) => void;
  setSelectedStudioId: (id: string | null) => void;
  createTempOrder: (params: Parameters<typeof orderService.createTempOrder>[0]) => ReturnType<typeof orderService.createTempOrder>;
  confirmDeposit: (orderId: string, channel: Parameters<typeof orderService.confirmDeposit>[1]) => ReturnType<typeof orderService.confirmDeposit>;
  confirmOrder: (orderId: string) => ReturnType<typeof orderService.confirmOrder>;
  startOrder: (orderId: string) => ReturnType<typeof orderService.startOrder>;
  completeOrder: (orderId: string, actualEndTime: string, damages?: Parameters<typeof orderService.completeOrder>[2]) => ReturnType<typeof orderService.completeOrder>;
  cancelOrder: (orderId: string) => ReturnType<typeof orderService.cancelOrder>;
  rescheduleOrder: (orderId: string, newStartTime: string, newEndTime: string) => ReturnType<typeof orderService.rescheduleOrder>;
  setOrderToPendingDeposit: (orderId: string) => ReturnType<typeof orderService.setOrderToPendingDeposit>;
  updateOrderDamages: (orderId: string, damages: Parameters<typeof orderService.updateOrderDamages>[1]) => ReturnType<typeof orderService.updateOrderDamages>;
  addMaintenanceDay: (studioId: string, date: string, reason: string) => { maintenanceDay?: MaintenanceDay; error?: string };
  removeMaintenanceDay: (id: string) => boolean;
  refreshState: () => void;
  resetAllData: () => void;
}

const AppStateContext = createContext<AppStateContextType | null>(null);

type Action =
  | { type: 'SET_ROLE'; payload: Role }
  | { type: 'SET_CURRENT_DATE'; payload: string }
  | { type: 'SET_SELECTED_STUDIO'; payload: string | null }
  | { type: 'SET_STATE'; payload: AppState }
  | { type: 'REFRESH' };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_ROLE':
      return { ...state, currentRole: action.payload };
    case 'SET_CURRENT_DATE':
      return { ...state, currentDate: action.payload };
    case 'SET_SELECTED_STUDIO':
      return { ...state, selectedStudioId: action.payload };
    case 'SET_STATE':
      return action.payload;
    case 'REFRESH':
      return { ...state };
    default:
      return state;
  }
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, null, () => {
    const initial = getInitialState();
    return initial;
  });

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    const interval = setInterval(() => {
      const newState = checkAndExpireTempOrders(state);
      const finalState = updateOrdersStatusByTime(newState);
      if (finalState !== state) {
        dispatch({ type: 'SET_STATE', payload: finalState });
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [state]);

  const setRole = (role: Role) => {
    dispatch({ type: 'SET_ROLE', payload: role });
  };

  const setCurrentDate = (date: string) => {
    dispatch({ type: 'SET_CURRENT_DATE', payload: date });
  };

  const setSelectedStudioId = (id: string | null) => {
    dispatch({ type: 'SET_SELECTED_STUDIO', payload: id });
  };

  const createTempOrder = (params: Parameters<typeof orderService.createTempOrder>[0]) => {
    const result = orderService.createTempOrder(params, state);
    if ('state' in result) {
      dispatch({ type: 'SET_STATE', payload: result.state });
    }
    return result;
  };

  const confirmDeposit = (orderId: string, channel: Parameters<typeof orderService.confirmDeposit>[1]) => {
    const result = orderService.confirmDeposit(orderId, channel, state);
    if ('state' in result) {
      dispatch({ type: 'SET_STATE', payload: result.state });
    }
    return result;
  };

  const confirmOrder = (orderId: string) => {
    const result = orderService.confirmOrder(orderId, state);
    if ('state' in result) {
      dispatch({ type: 'SET_STATE', payload: result.state });
    }
    return result;
  };

  const startOrder = (orderId: string) => {
    const result = orderService.startOrder(orderId, state);
    if ('state' in result) {
      dispatch({ type: 'SET_STATE', payload: result.state });
    }
    return result;
  };

  const completeOrder = (orderId: string, actualEndTime: string, damages?: Parameters<typeof orderService.completeOrder>[2]) => {
    const result = orderService.completeOrder(orderId, actualEndTime, state, damages);
    if ('state' in result) {
      dispatch({ type: 'SET_STATE', payload: result.state });
    }
    return result;
  };

  const cancelOrder = (orderId: string) => {
    const result = orderService.cancelOrder(orderId, state);
    if ('state' in result) {
      dispatch({ type: 'SET_STATE', payload: result.state });
    }
    return result;
  };

  const rescheduleOrder = (orderId: string, newStartTime: string, newEndTime: string) => {
    const result = orderService.rescheduleOrder(orderId, newStartTime, newEndTime, state);
    if ('state' in result) {
      dispatch({ type: 'SET_STATE', payload: result.state });
    }
    return result;
  };

  const setOrderToPendingDeposit = (orderId: string) => {
    const result = orderService.setOrderToPendingDeposit(orderId, state);
    if ('state' in result) {
      dispatch({ type: 'SET_STATE', payload: result.state });
    }
    return result;
  };

  const updateOrderDamages = (orderId: string, damages: Parameters<typeof orderService.updateOrderDamages>[1]) => {
    const result = orderService.updateOrderDamages(orderId, damages, state);
    if ('state' in result) {
      dispatch({ type: 'SET_STATE', payload: result.state });
    }
    return result;
  };

  const addMaintenanceDay = (studioId: string, date: string, reason: string) => {
    const existing = state.maintenanceDays.find(m => m.studioId === studioId && m.date === date);
    if (existing) {
      return { error: '该日期已有维护计划' };
    }

    const newMaint: MaintenanceDay = {
      id: `maint-${Date.now()}`,
      studioId,
      date,
      reason,
      createdAt: new Date().toISOString(),
      notifiedOrders: [],
    };

    const affectedOrders = state.orders.filter(order => {
      if (order.studioId !== studioId) return false;
      if (order.status === 'expired' || order.status === 'cancelled' || order.status === 'completed') return false;
      
      const startDate = order.startTime.slice(0, 10);
      const endDate = order.endTime.slice(0, 10);
      return date >= startDate && date <= endDate;
    });

    const updatedOrders = state.orders.map(order => {
      if (affectedOrders.some(o => o.id === order.id)) {
        return {
          ...order,
          affectedByMaintenance: newMaint.id,
          updatedAt: new Date().toISOString(),
        };
      }
      return order;
    });

    const newState = {
      ...state,
      maintenanceDays: [...state.maintenanceDays, newMaint],
      orders: updatedOrders,
    };

    dispatch({ type: 'SET_STATE', payload: newState });
    return { maintenanceDay: newMaint };
  };

  const removeMaintenanceDay = (id: string): boolean => {
    const maint = state.maintenanceDays.find(m => m.id === id);
    if (!maint) return false;

    const updatedOrders = state.orders.map(order => {
      if (order.affectedByMaintenance === id) {
        return {
          ...order,
          affectedByMaintenance: undefined,
          rescheduleOption: undefined,
          updatedAt: new Date().toISOString(),
        };
      }
      return order;
    });

    const newState = {
      ...state,
      maintenanceDays: state.maintenanceDays.filter(m => m.id !== id),
      orders: updatedOrders,
    };

    dispatch({ type: 'SET_STATE', payload: newState });
    return true;
  };

  const refreshState = () => {
    dispatch({ type: 'REFRESH' });
  };

  const resetAllData = () => {
    localStorage.removeItem('studio_rental_app_state');
    const fresh = getInitialState();
    dispatch({ type: 'SET_STATE', payload: fresh });
  };

  const value: AppStateContextType = {
    state,
    setRole,
    setCurrentDate,
    setSelectedStudioId,
    createTempOrder,
    confirmDeposit,
    confirmOrder,
    startOrder,
    completeOrder,
    cancelOrder,
    rescheduleOrder,
    setOrderToPendingDeposit,
    updateOrderDamages,
    addMaintenanceDay,
    removeMaintenanceDay,
    refreshState,
    resetAllData,
  };

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within AppStateProvider');
  }
  return context;
}
