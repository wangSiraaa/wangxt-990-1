import { Order, Equipment, Assistant, Studio, ConflictInfo, AlternativeOption, MaintenanceDay } from '../types';
import { isOverlapping, addHours, formatDate } from '../utils/dateUtils';
import { isStudioOnMaintenance, getOrdersByStudioAndDate } from '../store/storage';

export interface ConflictCheckParams {
  studioId: string;
  startTime: string;
  endTime: string;
  equipments: { equipmentId: string; quantity: number }[];
  assistantIds: string[];
  excludeOrderId?: string;
}

export function checkAllConflicts(
  params: ConflictCheckParams,
  orders: Order[],
  studios: Studio[],
  equipments: Equipment[],
  assistants: Assistant[],
  maintenanceDays: MaintenanceDay[]
): ConflictInfo[] {
  const conflicts: ConflictInfo[] = [];
  
  const studioConflict = checkStudioConflict(params, orders, maintenanceDays, studios);
  if (studioConflict) {
    conflicts.push(studioConflict);
  }
  
  const equipmentConflicts = checkEquipmentConflicts(params, orders, equipments, studios);
  conflicts.push(...equipmentConflicts);
  
  const assistantConflicts = checkAssistantConflicts(params, orders, assistants);
  conflicts.push(...assistantConflicts);
  
  return conflicts;
}

export function checkStudioConflict(
  params: ConflictCheckParams,
  orders: Order[],
  maintenanceDays: MaintenanceDay[],
  studios: Studio[]
): ConflictInfo | null {
  const { studioId, startTime, endTime, excludeOrderId } = params;
  
  const studio = studios.find(s => s.id === studioId);
  if (!studio) {
    return {
      type: 'studio',
      id: studioId,
      name: '未知棚位',
      startTime,
      endTime,
    };
  }
  
  const setupStart = addHours(startTime, -0.5).toISOString();
  const teardownEnd = addHours(endTime, 0.5).toISOString();
  
  const conflictingOrder = orders.find(order => {
    if (order.id === excludeOrderId) return false;
    if (order.studioId !== studioId) return false;
    if (order.status === 'expired' || order.status === 'cancelled') return false;
    if (order.status === 'temp' && new Date(order.tempExpiresAt || 0) < new Date()) return false;
    
    const orderSetupStart = addHours(order.startTime, -order.setupTime / 60).toISOString();
    const orderTeardownEnd = addHours(order.endTime, order.teardownTime / 60).toISOString();
    
    return isOverlapping(setupStart, teardownEnd, orderSetupStart, orderTeardownEnd);
  });
  
  if (conflictingOrder) {
    const alternatives = findStudioAlternatives(studioId, startTime, endTime, orders, studios, maintenanceDays);
    return {
      type: 'studio',
      id: studioId,
      name: studio.name,
      conflictingOrderId: conflictingOrder.id,
      conflictingOrderNo: conflictingOrder.orderNo,
      startTime,
      endTime,
      alternatives,
    };
  }
  
  const startDate = formatDate(startTime);
  const endDate = formatDate(endTime);
  
  if (isStudioOnMaintenance(maintenanceDays, studioId, startDate) ||
      isStudioOnMaintenance(maintenanceDays, studioId, endDate)) {
    return {
      type: 'maintenance',
      id: studioId,
      name: studio.name + ' (维护日)',
      startTime,
      endTime,
    };
  }
  
  return null;
}

export function findStudioAlternatives(
  studioId: string,
  startTime: string,
  endTime: string,
  orders: Order[],
  studios: Studio[],
  maintenanceDays: MaintenanceDay[]
): AlternativeOption[] {
  const alternatives: AlternativeOption[] = [];
  const originalStudio = studios.find(s => s.id === studioId);
  
  for (const studio of studios) {
    if (studio.id === studioId) continue;
    
    const hasConflict = orders.some(order => {
      if (order.studioId !== studio.id) return false;
      if (order.status === 'expired' || order.status === 'cancelled') return false;
      if (order.status === 'temp' && new Date(order.tempExpiresAt || 0) < new Date()) return false;
      
      const orderSetupStart = addHours(order.startTime, -order.setupTime / 60).toISOString();
      const orderTeardownEnd = addHours(order.endTime, order.teardownTime / 60).toISOString();
      
      return isOverlapping(startTime, endTime, orderSetupStart, orderTeardownEnd);
    });
    
    const startDate = formatDate(startTime);
    const onMaintenance = isStudioOnMaintenance(maintenanceDays, studio.id, startDate);
    
    if (!hasConflict && !onMaintenance) {
      const priceDiff = studio.basePricePerHour - (originalStudio?.basePricePerHour || 0);
      alternatives.push({
        type: 'studio',
        id: studio.id,
        name: studio.name,
        priceDiff,
      });
    }
  }
  
  return alternatives;
}

export function checkEquipmentConflicts(
  params: ConflictCheckParams,
  orders: Order[],
  equipments: Equipment[],
  studios: Studio[]
): ConflictInfo[] {
  const conflicts: ConflictInfo[] = [];
  const { startTime, endTime, equipments: reqEquipments, excludeOrderId } = params;
  
  for (const reqEq of reqEquipments) {
    const equipment = equipments.find(e => e.id === reqEq.equipmentId);
    if (!equipment) continue;
    
    let usedQuantity = 0;
    let conflictingOrderId: string | undefined;
    let conflictingOrderNo: string | undefined;
    
    for (const order of orders) {
      if (order.id === excludeOrderId) continue;
      if (order.status === 'expired' || order.status === 'cancelled') continue;
      if (order.status === 'temp' && new Date(order.tempExpiresAt || 0) < new Date()) continue;
      
      const orderEq = order.equipments.find(e => e.equipmentId === reqEq.equipmentId);
      if (!orderEq) continue;
      
      if (isOverlapping(startTime, endTime, order.startTime, order.endTime)) {
        usedQuantity += orderEq.quantity;
        conflictingOrderId = order.id;
        conflictingOrderNo = order.orderNo;
      }
    }
    
    if (usedQuantity + reqEq.quantity > equipment.quantity) {
      const alternatives = findEquipmentAlternatives(
        reqEq.equipmentId,
        reqEq.quantity,
        startTime,
        endTime,
        orders,
        equipments
      );
      
      conflicts.push({
        type: 'equipment',
        id: reqEq.equipmentId,
        name: equipment.name,
        conflictingOrderId,
        conflictingOrderNo,
        startTime,
        endTime,
        alternatives,
      });
    }
  }
  
  return conflicts;
}

export function findEquipmentAlternatives(
  equipmentId: string,
  quantity: number,
  startTime: string,
  endTime: string,
  orders: Order[],
  equipments: Equipment[]
): AlternativeOption[] {
  const alternatives: AlternativeOption[] = [];
  const originalEq = equipments.find(e => e.id === equipmentId);
  if (!originalEq) return alternatives;
  
  for (const eq of equipments) {
    if (eq.id === equipmentId) continue;
    if (eq.category !== originalEq.category) continue;
    
    let usedQuantity = 0;
    for (const order of orders) {
      if (order.status === 'expired' || order.status === 'cancelled') continue;
      if (order.status === 'temp' && new Date(order.tempExpiresAt || 0) < new Date()) continue;
      
      const orderEq = order.equipments.find(e => e.equipmentId === eq.id);
      if (!orderEq) continue;
      
      if (isOverlapping(startTime, endTime, order.startTime, order.endTime)) {
        usedQuantity += orderEq.quantity;
      }
    }
    
    if (usedQuantity + quantity <= eq.quantity) {
      const priceDiff = eq.pricePerHour - originalEq.pricePerHour;
      alternatives.push({
        type: 'equipment',
        id: eq.id,
        name: eq.name,
        priceDiff,
      });
    }
  }
  
  return alternatives;
}

export function checkAssistantConflicts(
  params: ConflictCheckParams,
  orders: Order[],
  assistants: Assistant[]
): ConflictInfo[] {
  const conflicts: ConflictInfo[] = [];
  const { startTime, endTime, assistantIds, excludeOrderId } = params;
  
  for (const asstId of assistantIds) {
    const assistant = assistants.find(a => a.id === asstId);
    if (!assistant) continue;
    
    const conflictingOrder = orders.find(order => {
      if (order.id === excludeOrderId) return false;
      if (order.status === 'expired' || order.status === 'cancelled') return false;
      if (order.status === 'temp' && new Date(order.tempExpiresAt || 0) < new Date()) return false;
      
      if (!order.assistantIds.includes(asstId)) return false;
      return isOverlapping(startTime, endTime, order.startTime, order.endTime);
    });
    
    if (conflictingOrder) {
      const alternatives = findAssistantAlternatives(
        asstId,
        startTime,
        endTime,
        orders,
        assistants
      );
      
      conflicts.push({
        type: 'assistant',
        id: asstId,
        name: assistant.name,
        conflictingOrderId: conflictingOrder.id,
        conflictingOrderNo: conflictingOrder.orderNo,
        startTime,
        endTime,
        alternatives,
      });
    }
  }
  
  return conflicts;
}

export function findAssistantAlternatives(
  assistantId: string,
  startTime: string,
  endTime: string,
  orders: Order[],
  assistants: Assistant[]
): AlternativeOption[] {
  const alternatives: AlternativeOption[] = [];
  const originalAsst = assistants.find(a => a.id === assistantId);
  if (!originalAsst) return alternatives;
  
  for (const asst of assistants) {
    if (asst.id === assistantId) continue;
    if (asst.role !== originalAsst.role) continue;
    
    const hasConflict = orders.some(order => {
      if (order.status === 'expired' || order.status === 'cancelled') return false;
      if (order.status === 'temp' && new Date(order.tempExpiresAt || 0) < new Date()) return false;
      
      if (!order.assistantIds.includes(asst.id)) return false;
      return isOverlapping(startTime, endTime, order.startTime, order.endTime);
    });
    
    if (!hasConflict) {
      const priceDiff = asst.pricePerHour - originalAsst.pricePerHour;
      alternatives.push({
        type: 'assistant',
        id: asst.id,
        name: asst.name,
        priceDiff,
      });
    }
  }
  
  return alternatives;
}

export function findAlternativeTimeslots(
  studioId: string,
  targetDate: string,
  durationHours: number,
  orders: Order[],
  maintenanceDays: MaintenanceDay[],
  operatingStart = 8,
  operatingEnd = 22
): AlternativeOption[] {
  const alternatives: AlternativeOption[] = [];
  
  if (isStudioOnMaintenance(maintenanceDays, studioId, targetDate)) {
    return alternatives;
  }
  
  const dayOrders = getOrdersByStudioAndDate(orders, studioId, targetDate);
  
  for (let hour = operatingStart; hour <= operatingEnd - durationHours; hour++) {
    const startTime = `${targetDate}T${String(hour).padStart(2, '0')}:00:00`;
    const endHour = hour + durationHours;
    const endTime = `${targetDate}T${String(endHour).padStart(2, '0')}:00:00`;
    
    const hasConflict = dayOrders.some(order => {
      const orderSetupStart = addHours(order.startTime, -order.setupTime / 60).toISOString();
      const orderTeardownEnd = addHours(order.endTime, order.teardownTime / 60).toISOString();
      return isOverlapping(startTime, endTime, orderSetupStart, orderTeardownEnd);
    });
    
    if (!hasConflict) {
      alternatives.push({
        type: 'timeslot',
        id: `${targetDate}-${hour}`,
        name: `${hour}:00 - ${endHour}:00`,
        priceDiff: 0,
        startTime,
        endTime,
      });
    }
  }
  
  return alternatives;
}
