import type { Order, Studio, Equipment, Assistant, OrderEquipment, FeeCalculation, OrderDamage, BookingSlot, CreateSlotParams } from '../types';
import { getDurationHours, addHours } from '../utils/dateUtils';

export const OVERTIME_RATE_MULTIPLIER = 1.5;
export const DEPOSIT_RATIO = 0.3;
export const STUDIO_DEPOSIT_RATIO = 0.15;
export const EQUIPMENT_DEPOSIT_RATIO = 0.3;
export const OVERTIME_RISK_DEPOSIT_RATIO = 0.1;
export const PENALTY_RATIO = 0.2;
export const SETUP_DEFAULT_HOURS = 0.5;
export const TEARDOWN_DEFAULT_HOURS = 0.5;

export interface FeeCalculationParams {
  studioId: string;
  startTime: string;
  endTime: string;
  equipments: OrderEquipment[];
  assistantIds: string[];
  setupTime?: number;
  teardownTime?: number;
}

export interface MultiSlotFeeParams {
  slots: CreateSlotParams[];
}

export function buildTimePhases(
  startTime: string,
  endTime: string,
  setupHours: number,
  teardownHours: number
) {
  const shootingStart = addHours(startTime, setupHours);
  const shootingEnd = addHours(endTime, -teardownHours);
  const shootingHours = Math.max(0, getDurationHours(shootingStart.toISOString(), shootingEnd.toISOString()));

  return [
    {
      type: 'setup' as const,
      hours: setupHours,
      startTime: startTime,
      endTime: shootingStart.toISOString(),
    },
    {
      type: 'shooting' as const,
      hours: shootingHours,
      startTime: shootingStart.toISOString(),
      endTime: shootingEnd.toISOString(),
    },
    {
      type: 'teardown' as const,
      hours: teardownHours,
      startTime: shootingEnd.toISOString(),
      endTime: endTime,
    },
  ];
}

export function calculateSlotFees(
  slot: CreateSlotParams,
  studios: Studio[],
  equipments: Equipment[],
  assistants: Assistant[]
): { baseAmount: number; equipmentAmount: number; assistantAmount: number } {
  const { studioId, startTime, endTime, equipments: eqList = [], assistantIds = [], setupTime = SETUP_DEFAULT_HOURS, teardownTime = TEARDOWN_DEFAULT_HOURS } = slot;

  const studio = studios.find(s => s.id === studioId);
  const baseHours = getDurationHours(startTime, endTime);
  const totalHours = baseHours + setupTime + teardownTime;
  const baseAmount = studio ? studio.basePricePerHour * totalHours : 0;

  let equipmentAmount = 0;
  for (const eq of eqList) {
    const equipment = equipments.find(e => e.id === eq.equipmentId);
    if (equipment) {
      equipmentAmount += equipment.pricePerHour * eq.quantity * baseHours;
    }
  }

  let assistantAmount = 0;
  for (const asstId of assistantIds) {
    const assistant = assistants.find(a => a.id === asstId);
    if (assistant) {
      assistantAmount += assistant.pricePerHour * baseHours;
    }
  }

  return {
    baseAmount: Math.round(baseAmount * 100) / 100,
    equipmentAmount: Math.round(equipmentAmount * 100) / 100,
    assistantAmount: Math.round(assistantAmount * 100) / 100,
  };
}

export function calculateOrderFees(
  params: FeeCalculationParams,
  studios: Studio[],
  equipments: Equipment[],
  assistants: Assistant[]
): FeeCalculation {
  const { studioId, startTime, endTime, equipments: eqList, assistantIds, setupTime = SETUP_DEFAULT_HOURS, teardownTime = TEARDOWN_DEFAULT_HOURS } = params;

  const studio = studios.find(s => s.id === studioId);
  const baseHours = getDurationHours(startTime, endTime);
  const totalHours = baseHours + setupTime + teardownTime;

  const baseAmount = studio ? studio.basePricePerHour * totalHours : 0;

  let equipmentAmount = 0;
  for (const eq of eqList) {
    const equipment = equipments.find(e => e.id === eq.equipmentId);
    if (equipment) {
      equipmentAmount += equipment.pricePerHour * eq.quantity * baseHours;
    }
  }

  let assistantAmount = 0;
  for (const asstId of assistantIds) {
    const assistant = assistants.find(a => a.id === asstId);
    if (assistant) {
      assistantAmount += assistant.pricePerHour * baseHours;
    }
  }

  const subtotal = baseAmount + equipmentAmount + assistantAmount;

  const studioDepositAmount = Math.ceil(baseAmount * STUDIO_DEPOSIT_RATIO / 100) * 100;
  const equipmentDepositAmount = Math.ceil(equipmentAmount * EQUIPMENT_DEPOSIT_RATIO / 100) * 100;
  const overtimeRiskDepositAmount = Math.ceil(subtotal * OVERTIME_RISK_DEPOSIT_RATIO / 100) * 100;
  const depositAmount = studioDepositAmount + equipmentDepositAmount + overtimeRiskDepositAmount;

  return {
    baseAmount: Math.round(baseAmount * 100) / 100,
    equipmentAmount: Math.round(equipmentAmount * 100) / 100,
    assistantAmount: Math.round(assistantAmount * 100) / 100,
    depositAmount,
    studioDepositAmount,
    equipmentDepositAmount,
    overtimeRiskDepositAmount,
    overtimeFee: 0,
    penaltyFee: 0,
    damageFee: 0,
    totalAmount: Math.round(subtotal * 100) / 100,
    remainingAmount: Math.round((subtotal - depositAmount) * 100) / 100,
  };
}

export function calculateMultiSlotOrderFees(
  slots: CreateSlotParams[],
  studios: Studio[],
  equipments: Equipment[],
  assistants: Assistant[]
): FeeCalculation {
  let totalBase = 0;
  let totalEquipment = 0;
  let totalAssistant = 0;

  for (const slot of slots) {
    const slotFees = calculateSlotFees(slot, studios, equipments, assistants);
    totalBase += slotFees.baseAmount;
    totalEquipment += slotFees.equipmentAmount;
    totalAssistant += slotFees.assistantAmount;
  }

  const subtotal = totalBase + totalEquipment + totalAssistant;

  const studioDepositAmount = Math.ceil(totalBase * STUDIO_DEPOSIT_RATIO / 100) * 100;
  const equipmentDepositAmount = Math.ceil(totalEquipment * EQUIPMENT_DEPOSIT_RATIO / 100) * 100;
  const overtimeRiskDepositAmount = Math.ceil(subtotal * OVERTIME_RISK_DEPOSIT_RATIO / 100) * 100;
  const depositAmount = studioDepositAmount + equipmentDepositAmount + overtimeRiskDepositAmount;

  return {
    baseAmount: Math.round(totalBase * 100) / 100,
    equipmentAmount: Math.round(totalEquipment * 100) / 100,
    assistantAmount: Math.round(totalAssistant * 100) / 100,
    depositAmount,
    studioDepositAmount,
    equipmentDepositAmount,
    overtimeRiskDepositAmount,
    overtimeFee: 0,
    penaltyFee: 0,
    damageFee: 0,
    totalAmount: Math.round(subtotal * 100) / 100,
    remainingAmount: Math.round((subtotal - depositAmount) * 100) / 100,
  };
}

export function calculateOvertimeFee(
  scheduledEnd: string,
  actualEnd: string,
  studio: Studio,
  equipments: OrderEquipment[],
  equipmentList: Equipment[],
  assistants: Assistant[],
  assistantIds: string[]
): { overtimeHours: number; overtimeFee: number } {
  const scheduled = new Date(scheduledEnd).getTime();
  const actual = new Date(actualEnd).getTime();

  if (actual <= scheduled) {
    return { overtimeHours: 0, overtimeFee: 0 };
  }

  const overtimeMs = actual - scheduled;
  const overtimeHours = Math.ceil(overtimeMs / (1000 * 60 * 60));

  let hourlyRate = studio.basePricePerHour;

  for (const eq of equipments) {
    const equipment = equipmentList.find(e => e.id === eq.equipmentId);
    if (equipment) {
      hourlyRate += equipment.pricePerHour * eq.quantity;
    }
  }

  for (const asstId of assistantIds) {
    const assistant = assistants.find(a => a.id === asstId);
    if (assistant) {
      hourlyRate += assistant.pricePerHour;
    }
  }

  const overtimeFee = overtimeHours * hourlyRate * OVERTIME_RATE_MULTIPLIER;

  return {
    overtimeHours,
    overtimeFee: Math.round(overtimeFee * 100) / 100,
  };
}

export function calculatePenaltyFee(
  order: Order,
  cancelHoursBefore: number
): number {
  const totalAmount = order.baseAmount + order.equipmentAmount + order.assistantAmount;

  if (cancelHoursBefore >= 72) {
    return 0;
  } else if (cancelHoursBefore >= 48) {
    return Math.round(totalAmount * 0.1 * 100) / 100;
  } else if (cancelHoursBefore >= 24) {
    return Math.round(totalAmount * 0.3 * 100) / 100;
  } else {
    return Math.round(totalAmount * PENALTY_RATIO * 100) / 100;
  }
}

export function calculateDamageFee(damages: OrderDamage[]): number {
  return damages
    .filter(d => d.status === 'confirmed' || d.status === 'resolved')
    .reduce((sum, d) => sum + d.cost, 0);
}

export function calculatePendingDamageFee(damages: OrderDamage[]): number {
  return damages
    .filter(d => d.status === 'pending')
    .reduce((sum, d) => sum + d.cost, 0);
}

export function validatePriceAdjustment(
  order: Order,
  newTotalAmount: number
): { allowed: boolean; reason?: string } {
  if (order.priceLocked || order.finalPaymentCollected) {
    if (newTotalAmount !== (order.baseAmount + order.equipmentAmount + order.assistantAmount + order.overtimeFee + order.penaltyFee + order.damageFee)) {
      return {
        allowed: false,
        reason: order.finalPaymentCollected
          ? '订单已收尾款，不能修改价格。如需调整，请先申请退款重开单。'
          : '订单价格已锁定，不能修改。',
      };
    }
  }
  return { allowed: true };
}

export function calculateFinalAmount(
  order: Order,
  actualEndTime?: string,
  additionalDamages?: OrderDamage[]
): FeeCalculation {
  let totalBase = 0;
  let totalEquipment = 0;
  let totalAssistant = 0;
  let totalOvertimeHours = 0;
  let totalOvertimeFee = 0;

  if (order.slots && order.slots.length > 0) {
    for (const slot of order.slots) {
      totalBase += slot.baseAmount;
      totalEquipment += slot.equipmentAmount;
      totalAssistant += slot.assistantAmount;
      totalOvertimeHours += slot.overtimeHours;
      totalOvertimeFee += slot.overtimeFee;
    }
  } else {
    totalBase = order.baseAmount;
    totalEquipment = order.equipmentAmount;
    totalAssistant = order.assistantAmount;
    totalOvertimeHours = order.overtimeHours;
    totalOvertimeFee = order.overtimeFee;
  }

  const penaltyFee = order.penaltyFee;

  const allDamages = [...order.damages, ...(additionalDamages || [])];
  const damageFee = calculateDamageFee(allDamages);

  const subtotal = totalBase + totalEquipment + totalAssistant;
  const totalAmount = subtotal + totalOvertimeFee + penaltyFee + damageFee;

  const studioDepositAmount = Math.ceil(totalBase * STUDIO_DEPOSIT_RATIO / 100) * 100;
  const equipmentDepositAmount = Math.ceil(totalEquipment * EQUIPMENT_DEPOSIT_RATIO / 100) * 100;
  const overtimeRiskDepositAmount = Math.ceil(subtotal * OVERTIME_RISK_DEPOSIT_RATIO / 100) * 100;
  const depositAmount = (order.depositAmount > 0) ? order.depositAmount : (studioDepositAmount + equipmentDepositAmount + overtimeRiskDepositAmount);

  const remainingAmount = Math.max(0, totalAmount - depositAmount);

  return {
    baseAmount: Math.round(totalBase * 100) / 100,
    equipmentAmount: Math.round(totalEquipment * 100) / 100,
    assistantAmount: Math.round(totalAssistant * 100) / 100,
    depositAmount,
    studioDepositAmount: order.studioDepositAmount || studioDepositAmount,
    equipmentDepositAmount: order.equipmentDepositAmount || equipmentDepositAmount,
    overtimeRiskDepositAmount: order.overtimeRiskDepositAmount || overtimeRiskDepositAmount,
    overtimeHours: totalOvertimeHours,
    overtimeFee: Math.round(totalOvertimeFee * 100) / 100,
    penaltyFee,
    damageFee,
    totalAmount: Math.round(totalAmount * 100) / 100,
    remainingAmount: Math.round(remainingAmount * 100) / 100,
  };
}

export function getDepositReleasePlan(order: Order): {
  studioDeposit: { amount: number; releasable: boolean; frozenAmount: number };
  equipmentDeposit: { amount: number; releasable: boolean; frozenAmount: number };
  overtimeRiskDeposit: { amount: number; releasable: boolean; frozenAmount: number };
} {
  const pendingDamageAmount = calculatePendingDamageFee(order.damages);
  const totalOvertime = order.overtimeFee;

  const studioFrozen = 0;
  const equipmentFrozen = Math.min(order.equipmentDepositAmount, pendingDamageAmount);
  const overtimeFrozen = Math.min(order.overtimeRiskDepositAmount, totalOvertime + Math.max(0, pendingDamageAmount - equipmentFrozen));

  return {
    studioDeposit: {
      amount: order.studioDepositAmount,
      releasable: order.status === 'completed',
      frozenAmount: studioFrozen,
    },
    equipmentDeposit: {
      amount: order.equipmentDepositAmount,
      releasable: order.status === 'completed' && pendingDamageAmount === 0,
      frozenAmount: equipmentFrozen,
    },
    overtimeRiskDeposit: {
      amount: order.overtimeRiskDepositAmount,
      releasable: order.status === 'completed' && totalOvertime === 0 && pendingDamageAmount <= equipmentFrozen,
      frozenAmount: overtimeFrozen,
    },
  };
}
