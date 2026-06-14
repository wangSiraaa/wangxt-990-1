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

export interface OrderEquipment {
  equipmentId: string;
  quantity: number;
}

export interface OrderDamage {
  equipmentId: string;
  description: string;
  cost: number;
}

export interface Order {
  id: string;
  orderNo: string;
  studioId: string;
  customerName: string;
  customerPhone: string;
  photographer?: string;
  
  startTime: string;
  endTime: string;
  actualEndTime?: string;
  
  equipments: OrderEquipment[];
  assistantIds: string[];
  
  setupTime: number;
  teardownTime: number;
  
  baseAmount: number;
  equipmentAmount: number;
  assistantAmount: number;
  depositAmount: number;
  depositChannel?: DepositChannel;
  depositConfirmedAt?: string;
  depositExpiresAt?: string;
  
  overtimeHours: number;
  overtimeFee: number;
  penaltyFee: number;
  damageFee: number;
  damages: OrderDamage[];
  
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
  overtimeFee: number;
  penaltyFee: number;
  damageFee: number;
  totalAmount: number;
  remainingAmount: number;
}
