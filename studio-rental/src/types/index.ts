export type Role = 'operator' | 'photographer' | 'finance';

export interface Studio {
  id: string;
  name: string;
  description: string;
  basePricePerHour: number;
  area: number;
  maxPeople: number;
  features: string[];
  color: string;
}

export type EquipmentCategory = 'lighting' | 'set' | 'prop';

export interface Equipment {
  id: string;
  name: string;
  category: EquipmentCategory;
  pricePerHour: number;
  quantity: number;
  description: string;
  tags: string[];
  compatibleStudios: string[];
}

export interface Assistant {
  id: string;
  name: string;
  role: string;
  pricePerHour: number;
  skills: string[];
  avatar?: string;
}

export type OrderStatus = 
  | 'temp'
  | 'pending_deposit'
  | 'deposit_confirmed'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'expired';

export type DepositChannel = 'alipay' | 'wechat' | 'bank' | 'cash';

export type DepositType = 'studio' | 'equipment' | 'overtime_risk';

export type DepositStatus = 'frozen' | 'released' | 'partially_released' | 'deducted';

export interface OrderDeposit {
  id: string;
  type: DepositType;
  amount: number;
  status: DepositStatus;
  channel?: DepositChannel;
  confirmedAt?: string;
  releasedAt?: string;
  releasedAmount?: number;
  frozenReason?: string;
  deductionReason?: string;
  notes?: string;
}

export type TimePhaseType = 'setup' | 'shooting' | 'teardown';

export interface TimePhase {
  type: TimePhaseType;
  hours: number;
  startTime: string;
  endTime: string;
}

export interface BookingSlot {
  id: string;
  studioId: string;
  startTime: string;
  endTime: string;
  actualEndTime?: string;
  phases: TimePhase[];
  equipments: OrderEquipment[];
  assistantIds: string[];
  setupTime: number;
  teardownTime: number;
  sceneName?: string;
  sceneNotes?: string;
  overtimeHours: number;
  overtimeFee: number;
  baseAmount: number;
  equipmentAmount: number;
  assistantAmount: number;
}

export interface OrderEquipment {
  equipmentId: string;
  quantity: number;
  addedMidShoot?: boolean;
  addedAt?: string;
  slotId?: string;
}

export interface OrderDamage {
  id: string;
  equipmentId: string;
  description: string;
  cost: number;
  status: 'pending' | 'confirmed' | 'resolved';
  reportedAt: string;
  resolvedAt?: string;
  slotId?: string;
  deductFromDeposit?: boolean;
}

export type MaintenanceImpactOptionType = 'reschedule' | 'change_studio' | 'reduce_config' | 'compensation';

export interface MaintenanceImpactOption {
  type: MaintenanceImpactOptionType;
  label: string;
  description: string;
  priceDiff: number;
  compensationAmount?: number;
  newStartTime?: string;
  newEndTime?: string;
  newStudioId?: string;
}

export interface MaintenanceImpact {
  maintenanceId: string;
  affectedSlotIds: string[];
  options: MaintenanceImpactOption[];
  selectedOption?: MaintenanceImpactOptionType;
  handledAt?: string;
}

export interface PaymentRecord {
  id: string;
  type: 'deposit' | 'final' | 'additional' | 'refund';
  amount: number;
  channel: DepositChannel;
  confirmedAt: string;
  notes?: string;
  depositType?: DepositType;
}

export interface Order {
  id: string;
  orderNo: string;
  customerName: string;
  customerPhone: string;
  photographer?: string;
  
  studioId: string;
  startTime: string;
  endTime: string;
  actualEndTime?: string;
  
  slots: BookingSlot[];
  
  equipments: OrderEquipment[];
  assistantIds: string[];
  
  setupTime: number;
  teardownTime: number;
  
  baseAmount: number;
  equipmentAmount: number;
  assistantAmount: number;
  
  deposits: OrderDeposit[];
  depositAmount: number;
  depositChannel?: DepositChannel;
  depositConfirmedAt?: string;
  depositExpiresAt?: string;
  
  studioDepositAmount: number;
  equipmentDepositAmount: number;
  overtimeRiskDepositAmount: number;
  
  overtimeHours: number;
  overtimeFee: number;
  penaltyFee: number;
  damageFee: number;
  damages: OrderDamage[];
  
  payments: PaymentRecord[];
  finalPaymentCollected: boolean;
  finalPaymentAmount?: number;
  finalPaymentAt?: string;
  
  priceLocked: boolean;
  originalPrice?: number;
  priceAdjustmentReason?: string;
  
  invoiceRequired: boolean;
  invoiceInfo?: {
    title: string;
    taxNo: string;
  };
  
  status: OrderStatus;
  notes?: string;
  
  tempExpiresAt?: string;
  
  createdAt: string;
  updatedAt: string;
  
  affectedByMaintenance?: string;
  maintenanceImpact?: MaintenanceImpact;
  rescheduleOption?: {
    newStartTime: string;
    newEndTime: string;
    compensation: number;
  };
}

export interface MaintenanceDay {
  id: string;
  studioId: string;
  date: string;
  startTime?: string;
  endTime?: string;
  reason: string;
  createdAt: string;
  notifiedOrders: string[];
}

export interface AppState {
  studios: Studio[];
  equipments: Equipment[];
  assistants: Assistant[];
  orders: Order[];
  maintenanceDays: MaintenanceDay[];
  currentRole: Role;
  currentDate: string;
  selectedStudioId: string | null;
}

export interface ConflictInfo {
  type: 'studio' | 'equipment' | 'assistant' | 'maintenance';
  id: string;
  name: string;
  conflictingOrderId?: string;
  conflictingOrderNo?: string;
  startTime: string;
  endTime: string;
  slotId?: string;
  alternatives?: AlternativeOption[];
}

export interface AlternativeOption {
  type: 'studio' | 'equipment' | 'assistant' | 'timeslot';
  id: string;
  name: string;
  priceDiff: number;
  startTime?: string;
  endTime?: string;
}

export interface FeeCalculation {
  baseAmount: number;
  equipmentAmount: number;
  assistantAmount: number;
  depositAmount: number;
  studioDepositAmount: number;
  equipmentDepositAmount: number;
  overtimeRiskDepositAmount: number;
  overtimeFee: number;
  penaltyFee: number;
  damageFee: number;
  totalAmount: number;
  remainingAmount: number;
}

export interface CreateSlotParams {
  studioId: string;
  startTime: string;
  endTime: string;
  equipments?: { equipmentId: string; quantity: number }[];
  assistantIds?: string[];
  setupTime?: number;
  teardownTime?: number;
  sceneName?: string;
  sceneNotes?: string;
}
