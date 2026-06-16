import type { Order, Equipment, Assistant, Studio, ConflictInfo, AlternativeOption, MaintenanceDay, BookingSlot, CreateSlotParams } from '../types';
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

export interface MultiSlotConflictCheckParams {
  slots: CreateSlotParams[];
  excludeOrderId?: string;
}

function getSlotOccupancyWindow(slot: { startTime: string; endTime: string; setupTime?: number; teardownTime?: number }) {
  const setupStart = addHours(slot.startTime, -(slot.setupTime || 0)).toISOString();
  const teardownEnd = addHours(slot.endTime, (slot.teardownTime || 0)).toISOString();
  return { setupStart, teardownEnd };
}

function getOrderOccupancyWindows(order: Order): { studioId: string; setupStart: string; teardownEnd: string }[] {
  if (order.slots && order.slots.length > 0) {
    return order.slots.map(slot => {
      const { setupStart, teardownEnd } = getSlotOccupancyWindow(slot);
      return { studioId: slot.studioId, setupStart, teardownEnd };
    });
  }
  const { setupStart, teardownEnd } = getSlotOccupancyWindow({
    startTime: order.startTime,
    endTime: order.endTime,
    setupTime: order.setupTime,
    teardownTime: order.teardownTime,
  });
  return [{ studioId: order.studioId, setupStart, teardownEnd }];
}

function isOrderActive(order: Order): boolean {
  if (order.status === 'expired' || order.status === 'cancelled') return false;
  if (order.status === 'temp' && new Date(order.tempExpiresAt || 0) < new Date()) return false;
  return true;
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

export function checkMultiSlotConflicts(
  params: MultiSlotConflictCheckParams,
  orders: Order[],
  studios: Studio[],
  equipments: Equipment[],
  assistants: Assistant[],
  maintenanceDays: MaintenanceDay[]
): ConflictInfo[] {
  const conflicts: ConflictInfo[] = [];
  const { slots, excludeOrderId } = params;

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const slotParams: ConflictCheckParams = {
      studioId: slot.studioId,
      startTime: slot.startTime,
      endTime: slot.endTime,
      equipments: slot.equipments || [],
      assistantIds: slot.assistantIds || [],
      excludeOrderId,
    };

    const slotConflicts = checkAllConflicts(slotParams, orders, studios, equipments, assistants, maintenanceDays);
    slotConflicts.forEach(c => {
      conflicts.push({ ...c, slotId: `slot-${i}` });
    });

    for (let j = i + 1; j < slots.length; j++) {
      const otherSlot = slots[j];
      if (slot.studioId === otherSlot.studioId) {
        const win1 = getSlotOccupancyWindow({ ...slot, setupTime: slot.setupTime || 0.5, teardownTime: slot.teardownTime || 0.5 });
        const win2 = getSlotOccupancyWindow({ ...otherSlot, setupTime: otherSlot.setupTime || 0.5, teardownTime: otherSlot.teardownTime || 0.5 });
        if (isOverlapping(win1.setupStart, win1.teardownEnd, win2.setupStart, win2.teardownEnd)) {
          const studio = studios.find(s => s.id === slot.studioId);
          conflicts.push({
            type: 'studio',
            id: slot.studioId,
            name: `${studio?.name || '棚位'} 档期内冲突 (时段${i + 1}与时段${j + 1})`,
            startTime: slot.startTime,
            endTime: slot.endTime,
            slotId: `slot-${i}`,
          });
        }
      }
    }
  }

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

  const { setupStart, teardownEnd } = getSlotOccupancyWindow({
    startTime,
    endTime,
    setupTime: 0.5,
    teardownTime: 0.5,
  });

  const conflictingOrder = orders.find(order => {
    if (order.id === excludeOrderId) return false;
    if (!isOrderActive(order)) return false;

    const windows = getOrderOccupancyWindows(order);
    return windows.some(w =>
      w.studioId === studioId && isOverlapping(setupStart, teardownEnd, w.setupStart, w.teardownEnd)
    );
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
      if (!isOrderActive(order)) return false;
      const windows = getOrderOccupancyWindows(order);
      return windows.some(w =>
        w.studioId === studio.id && isOverlapping(startTime, endTime, w.setupStart, w.teardownEnd)
      );
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
  _studios: Studio[]
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
      if (!isOrderActive(order)) continue;

      const orderTimeSlots: { start: string; end: string; eqs: { equipmentId: string; quantity: number }[] }[] = [];

      if (order.slots && order.slots.length > 0) {
        for (const slot of order.slots) {
          orderTimeSlots.push({
            start: slot.startTime,
            end: slot.endTime,
            eqs: slot.equipments,
          });
        }
      } else {
        orderTimeSlots.push({
          start: order.startTime,
          end: order.endTime,
          eqs: order.equipments,
        });
      }

      for (const ts of orderTimeSlots) {
        const orderEq = ts.eqs.find(e => e.equipmentId === reqEq.equipmentId);
        if (!orderEq) continue;
        if (isOverlapping(startTime, endTime, ts.start, ts.end)) {
          usedQuantity += orderEq.quantity;
          conflictingOrderId = order.id;
          conflictingOrderNo = order.orderNo;
        }
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
      if (!isOrderActive(order)) continue;

      const orderTimeSlots: { start: string; end: string; eqs: { equipmentId: string; quantity: number }[] }[] = [];
      if (order.slots && order.slots.length > 0) {
        for (const slot of order.slots) {
          orderTimeSlots.push({ start: slot.startTime, end: slot.endTime, eqs: slot.equipments });
        }
      } else {
        orderTimeSlots.push({ start: order.startTime, end: order.endTime, eqs: order.equipments });
      }

      for (const ts of orderTimeSlots) {
        const orderEq = ts.eqs.find(e => e.equipmentId === eq.id);
        if (!orderEq) continue;
        if (isOverlapping(startTime, endTime, ts.start, ts.end)) {
          usedQuantity += orderEq.quantity;
        }
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
      if (!isOrderActive(order)) return false;

      const timeSlots: { start: string; end: string; ids: string[] }[] = [];
      if (order.slots && order.slots.length > 0) {
        for (const slot of order.slots) {
          timeSlots.push({ start: slot.startTime, end: slot.endTime, ids: slot.assistantIds });
        }
      } else {
        timeSlots.push({ start: order.startTime, end: order.endTime, ids: order.assistantIds });
      }

      return timeSlots.some(ts =>
        ts.ids.includes(asstId) && isOverlapping(startTime, endTime, ts.start, ts.end)
      );
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
      if (!isOrderActive(order)) return false;

      const timeSlots: { start: string; end: string; ids: string[] }[] = [];
      if (order.slots && order.slots.length > 0) {
        for (const slot of order.slots) {
          timeSlots.push({ start: slot.startTime, end: slot.endTime, ids: slot.assistantIds });
        }
      } else {
        timeSlots.push({ start: order.startTime, end: order.endTime, ids: order.assistantIds });
      }

      return timeSlots.some(ts =>
        ts.ids.includes(asst.id) && isOverlapping(startTime, endTime, ts.start, ts.end)
      );
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
      const windows = getOrderOccupancyWindows(order);
      return windows.some(w =>
        w.studioId === studioId && isOverlapping(startTime, endTime, w.setupStart, w.teardownEnd)
      );
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
