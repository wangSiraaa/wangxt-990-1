import { Order, Studio, Equipment, Assistant, OrderEquipment, FeeCalculation, OrderDamage } from '../types';
import { getDurationHours } from '../utils/dateUtils';

export const OVERTIME_RATE_MULTIPLIER = 1.5;
export const DEPOSIT_RATIO = 0.3;
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
  const depositAmount = Math.ceil(subtotal * DEPOSIT_RATIO / 100) * 100;
  
  return {
    baseAmount: Math.round(baseAmount * 100) / 100,
    equipmentAmount: Math.round(equipmentAmount * 100) / 100,
    assistantAmount: Math.round(assistantAmount * 100) / 100,
    depositAmount,
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
  return damages.reduce((sum, d) => sum + d.cost, 0);
}

export function calculateFinalAmount(
  order: Order,
  actualEndTime?: string,
  additionalDamages?: OrderDamage[]
): {
  baseAmount: number;
  equipmentAmount: number;
  assistantAmount: number;
  depositAmount: number;
  overtimeHours: number;
  overtimeFee: number;
  penaltyFee: number;
  damageFee: number;
  totalAmount: number;
  remainingAmount: number;
} {
  const baseAmount = order.baseAmount;
  const equipmentAmount = order.equipmentAmount;
  const assistantAmount = order.assistantAmount;
  const depositAmount = order.depositAmount;
  const penaltyFee = order.penaltyFee;
  
  let overtimeHours = order.overtimeHours;
  let overtimeFee = order.overtimeFee;
  
  if (actualEndTime && actualEndTime > order.endTime) {
    const studio = {} as Studio;
    const result = calculateOvertimeFee(
      order.endTime,
      actualEndTime,
      studio,
      order.equipments,
      [],
      [],
      order.assistantIds
    );
    overtimeHours = result.overtimeHours;
    overtimeFee = result.overtimeFee;
  }
  
  const allDamages = [...order.damages, ...(additionalDamages || [])];
  const damageFee = calculateDamageFee(allDamages);
  
  const totalAmount = baseAmount + equipmentAmount + assistantAmount + overtimeFee + penaltyFee + damageFee;
  const remainingAmount = Math.max(0, totalAmount - depositAmount);
  
  return {
    baseAmount,
    equipmentAmount,
    assistantAmount,
    depositAmount,
    overtimeHours,
    overtimeFee,
    penaltyFee,
    damageFee,
    totalAmount: Math.round(totalAmount * 100) / 100,
    remainingAmount: Math.round(remainingAmount * 100) / 100,
  };
}
