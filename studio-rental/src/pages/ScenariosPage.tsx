import { useState } from 'react';
import { useAppState } from '../context/AppStateContext';
import type { Order, DepositChannel, BookingSlot, OrderDeposit, OrderDamage, PaymentRecord } from '../types';
import { formatMoney, addDays, addHours, generateId, generateOrderNo, formatDate } from '../utils/dateUtils';
import { calculateOrderFees, calculateMultiSlotOrderFees, buildTimePhases, STUDIO_DEPOSIT_RATIO, EQUIPMENT_DEPOSIT_RATIO, OVERTIME_RISK_DEPOSIT_RATIO } from '../services/feeService';


interface ScenarioResult {
  success: boolean;
  message: string;
  details?: string;
}

export default function ScenariosPage() {
  const { state, resetAllData, setState } = useAppState();
  const { studios, equipments, assistants } = state;
  
  const [results, setResults] = useState<Record<string, ScenarioResult>>({});
  const [runningScenario, setRunningScenario] = useState<string | null>(null);

  const runScenario = async (scenarioId: string) => {
    setRunningScenario(scenarioId);
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    let result: ScenarioResult = { success: false, message: '未知场景' };
    
    switch (scenarioId) {
      case 'concurrent-booking':
        result = runConcurrentBookingScenario();
        break;
      case 'equipment-conflict':
        result = runEquipmentConflictScenario();
        break;
      case 'deposit-unpaid':
        result = runDepositUnpaidScenario();
        break;
      case 'overtime-fee':
        result = runOvertimeFeeScenario();
        break;
      case 'maintenance-reschedule':
        result = runMaintenanceRescheduleScenario();
        break;
      case 'cross-day-multi-studio':
        result = runCrossDayMultiStudioScenario();
        break;
      case 'equipment-conflict-alt':
        result = runEquipmentConflictAltScenario();
        break;
      case 'overtime-deposit':
        result = runOvertimeDepositScenario();
        break;
      case 'damage-deposit-freeze':
        result = runDamageDepositFreezeScenario();
        break;
      default:
        break;
    }
    
    setResults(prev => ({ ...prev, [scenarioId]: result }));
    setRunningScenario(null);
  };

  const runConcurrentBookingScenario = (): ScenarioResult => {
    const studio = studios[0];
    if (!studio) return { success: false, message: '没有可用棚位' };
    
    const today = new Date();
    const tomorrow = addDays(today, 1);
    const startStr = `${formatDate(tomorrow)}T10:00:00`;
    const endStr = `${formatDate(tomorrow)}T12:00:00`;
    
    const fees = calculateOrderFees(
      { studioId: studio.id, startTime: startStr, endTime: endStr, equipments: [], assistantIds: [] },
      studios, equipments, assistants
    );
    
    const now = new Date();
    const tempExpires = addHours(now, 0.5);
    
    const order1: Order = {
      id: generateId('order'),
      orderNo: generateOrderNo(),
      studioId: studio.id,
      customerName: '并发客户A',
      customerPhone: '13800000001',
      startTime: startStr,
      endTime: endStr,
      equipments: [],
      assistantIds: [],
      setupTime: 0.5,
      teardownTime: 0.5,
      baseAmount: fees.baseAmount,
      equipmentAmount: fees.equipmentAmount,
      assistantAmount: fees.assistantAmount,
      depositAmount: fees.depositAmount,
      overtimeHours: 0,
      overtimeFee: 0,
      penaltyFee: 0,
      damageFee: 0,
      damages: [],
      invoiceRequired: false,
      status: 'temp',
      tempExpiresAt: tempExpires.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    
    const order2: Order = {
      id: generateId('order'),
      orderNo: generateOrderNo(),
      studioId: studio.id,
      customerName: '并发客户B',
      customerPhone: '13800000002',
      startTime: startStr,
      endTime: endStr,
      equipments: [],
      assistantIds: [],
      setupTime: 0.5,
      teardownTime: 0.5,
      baseAmount: fees.baseAmount,
      equipmentAmount: fees.equipmentAmount,
      assistantAmount: fees.assistantAmount,
      depositAmount: fees.depositAmount,
      overtimeHours: 0,
      overtimeFee: 0,
      penaltyFee: 0,
      damageFee: 0,
      damages: [],
      invoiceRequired: false,
      status: 'temp',
      tempExpiresAt: tempExpires.toISOString(),
      createdAt: new Date(now.getTime() + 100).toISOString(),
      updatedAt: new Date(now.getTime() + 100).toISOString(),
    };
    
    const newOrders = [...state.orders, order1, order2];
    const newState = { ...state, orders: newOrders };
    setState(newState);
    
    return {
      success: true,
      message: '并发抢档场景已创建',
      details: `创建了2个临时订单抢占同一时段(${studio.name} 10:00-12:00)。两个订单都处于"临时占用"状态，先支付押金的客户将获得档期，另一个将因冲突无法确认。临时占用有效期30分钟。`,
    };
  };

  const runEquipmentConflictScenario = (): ScenarioResult => {
    const studio = studios[0];
    const lightEq = equipments.find(e => e.category === 'lighting' && e.quantity < 5);
    if (!studio || !lightEq) return { success: false, message: '数据不足' };
    
    const today = new Date();
    const day3 = addDays(today, 3);
    const startStr = `${formatDate(day3)}T09:00:00`;
    const endStr = `${formatDate(day3)}T18:00:00`;
    
    const allLights = equipments.filter(e => e.category === 'lighting' && e.compatibleStudios.includes(studio.id));
    const eqList = allLights.slice(0, 3).map(e => ({ equipmentId: e.id, quantity: Math.ceil(e.quantity / 2) }));
    
    const fees = calculateOrderFees(
      { studioId: studio.id, startTime: startStr, endTime: endStr, equipments: eqList, assistantIds: [] },
      studios, equipments, assistants
    );
    
    const now = new Date();
    
    const order1: Order = {
      id: generateId('order'),
      orderNo: generateOrderNo(),
      studioId: studio.id,
      customerName: '设备占用客户',
      customerPhone: '13800000003',
      startTime: startStr,
      endTime: endStr,
      equipments: allLights.slice(0, 2).map(e => ({ equipmentId: e.id, quantity: e.quantity })),
      assistantIds: [],
      setupTime: 1,
      teardownTime: 1,
      baseAmount: fees.baseAmount,
      equipmentAmount: fees.equipmentAmount,
      assistantAmount: fees.assistantAmount,
      depositAmount: fees.depositAmount,
      depositChannel: 'alipay' as DepositChannel,
      depositConfirmedAt: now.toISOString(),
      overtimeHours: 0,
      overtimeFee: 0,
      penaltyFee: 0,
      damageFee: 0,
      damages: [],
      invoiceRequired: false,
      status: 'confirmed',
      createdAt: new Date(now.getTime() - 86400000).toISOString(),
      updatedAt: new Date(now.getTime() - 86400000).toISOString(),
    };
    
    const newOrders = [...state.orders, order1];
    const newState = { ...state, orders: newOrders };
    setState(newState);
    
    return {
      success: true,
      message: '设备冲突场景已创建',
      details: `创建了一个全天订单(${studio.name} 09:00-18:00)，占用了全部的2种主力灯光设备。您可以尝试在同一时段预约同一棚位并选择相同灯光设备，系统会检测到冲突并推荐替代方案。`,
    };
  };

  const runDepositUnpaidScenario = (): ScenarioResult => {
    const studio = studios[1];
    if (!studio) return { success: false, message: '没有可用棚位' };
    
    const today = new Date();
    const day5 = addDays(today, 5);
    const startStr = `${formatDate(day5)}T14:00:00`;
    const endStr = `${formatDate(day5)}T17:00:00`;
    
    const fees = calculateOrderFees(
      { studioId: studio.id, startTime: startStr, endTime: endStr, equipments: [], assistantIds: [] },
      studios, equipments, assistants
    );
    
    const now = new Date();
    const depositExpires = new Date(now.getTime() + 1800000);
    
    const order: Order = {
      id: generateId('order'),
      orderNo: generateOrderNo(),
      studioId: studio.id,
      customerName: '未付押金客户',
      customerPhone: '13800000004',
      startTime: startStr,
      endTime: endStr,
      equipments: [],
      assistantIds: [],
      setupTime: 0.5,
      teardownTime: 0.5,
      baseAmount: fees.baseAmount,
      equipmentAmount: fees.equipmentAmount,
      assistantAmount: fees.assistantAmount,
      depositAmount: fees.depositAmount,
      depositExpiresAt: depositExpires.toISOString(),
      overtimeHours: 0,
      overtimeFee: 0,
      penaltyFee: 0,
      damageFee: 0,
      damages: [],
      invoiceRequired: false,
      status: 'pending_deposit',
      createdAt: new Date(now.getTime() - 3600000).toISOString(),
      updatedAt: new Date(now.getTime() - 3600000).toISOString(),
    };
    
    const newOrders = [...state.orders, order];
    const newState = { ...state, orders: newOrders };
    setState(newState);
    
    return {
      success: true,
      message: '押金未付场景已创建',
      details: `创建了一个待付押金订单(${studio.name})，押金支付截止时间为30分钟后。如果超时未支付，订单将自动变为"已过期"状态，棚位释放给其他客户。可在财务-押金管理中查看并确认到账。`,
    };
  };

  const runOvertimeFeeScenario = (): ScenarioResult => {
    const studio = studios[0];
    const asst = assistants[0];
    if (!studio || !asst) return { success: false, message: '数据不足' };
    
    const today = new Date();
    const startStr = `${formatDate(today)}T08:00:00`;
    const scheduledEnd = `${formatDate(today)}T12:00:00`;
    const actualEnd = `${formatDate(today)}T14:30:00`;
    
    const eqList = equipments
      .filter(e => e.category === 'lighting' && e.compatibleStudios.includes(studio.id))
      .slice(0, 2)
      .map(e => ({ equipmentId: e.id, quantity: 2 }));
    
    const fees = calculateOrderFees(
      { studioId: studio.id, startTime: startStr, endTime: scheduledEnd, equipments: eqList, assistantIds: [asst.id] },
      studios, equipments, assistants
    );
    
    const overtimeHours = 2.5;
    const hourlyRate = studio.basePricePerHour + 
      eqList.reduce((sum, e) => {
        const eq = equipments.find(x => x.id === e.equipmentId);
        return sum + (eq?.pricePerHour || 0) * e.quantity;
      }, 0) +
      (assistants.find(a => a.id === asst.id)?.pricePerHour || 0);
    
    const overtimeFee = overtimeHours * hourlyRate * 1.5;
    
    const now = new Date();
    
    const order: Order = {
      id: generateId('order'),
      orderNo: generateOrderNo(),
      studioId: studio.id,
      customerName: '超时拍摄客户',
      customerPhone: '13800000005',
      photographer: '张摄影师',
      startTime: startStr,
      endTime: scheduledEnd,
      actualEndTime: actualEnd,
      equipments: eqList,
      assistantIds: [asst.id],
      setupTime: 0.5,
      teardownTime: 0.5,
      baseAmount: fees.baseAmount,
      equipmentAmount: fees.equipmentAmount,
      assistantAmount: fees.assistantAmount,
      depositAmount: fees.depositAmount,
      depositChannel: 'wechat' as DepositChannel,
      depositConfirmedAt: new Date(now.getTime() - 86400000).toISOString(),
      overtimeHours: Math.ceil(overtimeHours),
      overtimeFee: Math.round(overtimeFee * 100) / 100,
      penaltyFee: 0,
      damageFee: 0,
      damages: [],
      invoiceRequired: true,
      invoiceInfo: {
        title: '超时拍摄有限公司',
        taxNo: '91110000MA00000000',
      },
      status: 'completed',
      notes: '客户要求延时拍摄',
      createdAt: new Date(now.getTime() - 86400000).toISOString(),
      updatedAt: now.toISOString(),
    };
    
    const newOrders = [...state.orders, order];
    const newState = { ...state, orders: newOrders };
    setState(newState);
    
    return {
      success: true,
      message: '超时扣费场景已创建',
      details: `创建了一个已完成订单，原定时长4小时(08:00-12:00)，实际使用6.5小时(至14:30)，超时2.5小时。超时费用按1.5倍费率计算，共${formatMoney(Math.round(overtimeFee * 100) / 100)}。可在订单详情中查看费用明细。`,
    };
  };

  const runMaintenanceRescheduleScenario = (): ScenarioResult => {
    const studio = studios[2];
    if (!studio) return { success: false, message: '没有可用棚位' };
    
    const today = new Date();
    const day7 = addDays(today, 7);
    const day7Str = formatDate(day7);
    
    const ordersToCreate: Order[] = [];
    
    const times = [
      { start: '09:00', end: '12:00', customer: '维护影响客户A' },
      { start: '14:00', end: '18:00', customer: '维护影响客户B' },
    ];
    
    const now = new Date();
    
    for (const t of times) {
      const startStr = `${day7Str}T${t.start}:00`;
      const endStr = `${day7Str}T${t.end}:00`;
      
      const fees = calculateOrderFees(
        { studioId: studio.id, startTime: startStr, endTime: endStr, equipments: [], assistantIds: [] },
        studios, equipments, assistants
      );
      
      ordersToCreate.push({
        id: generateId('order'),
        orderNo: generateOrderNo(),
        studioId: studio.id,
        customerName: t.customer,
        customerPhone: `138000000${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`,
        startTime: startStr,
        endTime: endStr,
        equipments: [],
        assistantIds: [],
        setupTime: 0.5,
        teardownTime: 0.5,
        baseAmount: fees.baseAmount,
        equipmentAmount: fees.equipmentAmount,
        assistantAmount: fees.assistantAmount,
        depositAmount: fees.depositAmount,
        depositChannel: 'alipay' as DepositChannel,
        depositConfirmedAt: new Date(now.getTime() - 172800000).toISOString(),
        overtimeHours: 0,
        overtimeFee: 0,
        penaltyFee: 0,
        damageFee: 0,
        damages: [],
        invoiceRequired: false,
        status: 'confirmed',
        createdAt: new Date(now.getTime() - 259200000).toISOString(),
        updatedAt: new Date(now.getTime() - 172800000).toISOString(),
      });
    }
    
    const maintId = generateId('maint');
    const newMaintenance = {
      id: maintId,
      studioId: studio.id,
      date: day7Str,
      reason: '设备定期检修与场景维护',
      createdAt: now.toISOString(),
      notifiedOrders: [],
    };
    
    const updatedOrders = ordersToCreate.map(o => ({
      ...o,
      affectedByMaintenance: maintId,
    }));
    
    const newState = {
      ...state,
      orders: [...state.orders, ...updatedOrders],
      maintenanceDays: [...state.maintenanceDays, newMaintenance],
    };
    setState(newState);
    
    return {
      success: true,
      message: '维护日改期场景已创建',
      details: `为${studio.name}在第7天添加了维护日，同时创建了2个受影响的已确认订单。这些订单会被标记为"受维护影响"，您可以在维护计划页面查看并处理改期或赔偿。也可以在订单详情中进行改期操作。`,
    };
  };

  const runCrossDayMultiStudioScenario = (): ScenarioResult => {
    if (studios.length < 2) return { success: false, message: '需要至少2个棚位' };
    const studio1 = studios[0];
    const studio2 = studios[1];
    const eq1 = equipments.find(e => e.category === 'lighting' && e.compatibleStudios.includes(studio1.id));
    const eq2 = equipments.find(e => e.category === 'set' && e.compatibleStudios.includes(studio2.id));
    const asst = assistants[0];
    if (!eq1 || !eq2 || !asst) return { success: false, message: '设备或助理数据不足' };

    const today = new Date();
    const day2 = addDays(today, 2);
    const day3 = addDays(today, 3);
    const day2Str = formatDate(day2);
    const day3Str = formatDate(day3);

    const slot1: BookingSlot = {
      id: generateId('slot'),
      studioId: studio1.id,
      startTime: `${day2Str}T09:00:00`,
      endTime: `${day2Str}T12:00:00`,
      phases: buildTimePhases(`${day2Str}T09:00:00`, `${day2Str}T12:00:00`, 0.5, 0.5),
      equipments: [{ equipmentId: eq1.id, quantity: 2 }],
      assistantIds: [asst.id],
      setupTime: 0.5,
      teardownTime: 0.5,
      sceneName: '产品拍摄',
      overtimeHours: 0,
      overtimeFee: 0,
      baseAmount: studio1.basePricePerHour * 3,
      equipmentAmount: eq1.pricePerHour * 2 * 3,
      assistantAmount: asst.pricePerHour * 3,
    };

    const slot2: BookingSlot = {
      id: generateId('slot'),
      studioId: studio2.id,
      startTime: `${day3Str}T18:00:00`,
      endTime: `${day3Str}T22:00:00`,
      phases: buildTimePhases(`${day3Str}T18:00:00`, `${day3Str}T22:00:00`, 1, 0.5),
      equipments: [{ equipmentId: eq2.id, quantity: 1 }],
      assistantIds: [asst.id],
      setupTime: 1,
      teardownTime: 0.5,
      sceneName: '晚间直播',
      overtimeHours: 0,
      overtimeFee: 0,
      baseAmount: studio2.basePricePerHour * 4,
      equipmentAmount: eq2.pricePerHour * 1 * 4,
      assistantAmount: asst.pricePerHour * 4,
    };

    const totalBase = slot1.baseAmount + slot2.baseAmount;
    const totalEquip = slot1.equipmentAmount + slot2.equipmentAmount;
    const totalAsst = slot1.assistantAmount + slot2.assistantAmount;
    const subtotal = totalBase + totalEquip + totalAsst;
    const studioDeposit = Math.ceil(totalBase * STUDIO_DEPOSIT_RATIO / 100) * 100;
    const equipDeposit = Math.ceil(totalEquip * EQUIPMENT_DEPOSIT_RATIO / 100) * 100;
    const riskDeposit = Math.ceil(subtotal * OVERTIME_RISK_DEPOSIT_RATIO / 100) * 100;
    const totalDeposit = studioDeposit + equipDeposit + riskDeposit;

    const now = new Date();
    const deposits: OrderDeposit[] = [
      { id: generateId('dep'), type: 'studio', amount: studioDeposit, status: 'frozen', channel: 'wechat', confirmedAt: now.toISOString() },
      { id: generateId('dep'), type: 'equipment', amount: equipDeposit, status: 'frozen', channel: 'wechat', confirmedAt: now.toISOString() },
      { id: generateId('dep'), type: 'overtime_risk', amount: riskDeposit, status: 'frozen', channel: 'wechat', confirmedAt: now.toISOString() },
    ];

    const order: Order = {
      id: generateId('order'),
      orderNo: generateOrderNo(),
      studioId: studio1.id,
      customerName: '跨日换景客户',
      customerPhone: '13800000101',
      photographer: '王摄影师',
      startTime: slot1.startTime,
      endTime: slot2.endTime,
      slots: [slot1, slot2],
      equipments: [...slot1.equipments, ...slot2.equipments],
      assistantIds: [asst.id],
      setupTime: 0.5,
      teardownTime: 0.5,
      baseAmount: totalBase,
      equipmentAmount: totalEquip,
      assistantAmount: totalAsst,
      deposits,
      depositAmount: totalDeposit,
      depositChannel: 'wechat',
      depositConfirmedAt: now.toISOString(),
      studioDepositAmount: studioDeposit,
      equipmentDepositAmount: equipDeposit,
      overtimeRiskDepositAmount: riskDeposit,
      overtimeHours: 0,
      overtimeFee: 0,
      penaltyFee: 0,
      damageFee: 0,
      damages: [],
      payments: [{ id: generateId('pay'), type: 'deposit', amount: totalDeposit, channel: 'wechat', confirmedAt: now.toISOString() }],
      finalPaymentCollected: false,
      invoiceRequired: false,
      status: 'confirmed',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    const newState = { ...state, orders: [...state.orders, order] };
    setState(newState);

    return {
      success: true,
      message: '跨日换棚场景已创建',
      details: `创建了一个跨2天的多时段订单：第1天在${studio1.name}拍产品(09:00-12:00,布置0.5h+清场0.5h)，第2天在${studio2.name}拍直播(18:00-22:00,布置1h+清场0.5h)。押金分3段：棚位${formatMoney(studioDeposit)}+设备${formatMoney(equipDeposit)}+超时风险${formatMoney(riskDeposit)}。可在订单详情查看多时段卡片和三段资源占用可视化。`,
    };
  };

  const runEquipmentConflictAltScenario = (): ScenarioResult => {
    const studio = studios[0];
    const altStudio = studios[1];
    if (!studio || !altStudio) return { success: false, message: '需要至少2个棚位' };
    const lights = equipments.filter(e => e.category === 'lighting' && e.compatibleStudios.includes(studio.id));
    if (lights.length === 0) return { success: false, message: '没有灯光设备' };
    const asst = assistants[0];
    if (!asst) return { success: false, message: '没有助理数据' };

    const today = new Date();
    const day2 = addDays(today, 2);
    const day2Str = formatDate(day2);

    const slot: BookingSlot = {
      id: generateId('slot'),
      studioId: studio.id,
      startTime: `${day2Str}T09:00:00`,
      endTime: `${day2Str}T18:00:00`,
      phases: buildTimePhases(`${day2Str}T09:00:00`, `${day2Str}T18:00:00`, 1, 1),
      equipments: lights.slice(0, 3).map(e => ({ equipmentId: e.id, quantity: e.quantity })),
      assistantIds: [asst.id],
      setupTime: 1,
      teardownTime: 1,
      sceneName: '全设备占用拍摄',
      overtimeHours: 0,
      overtimeFee: 0,
      baseAmount: studio.basePricePerHour * 9,
      equipmentAmount: lights.slice(0, 3).reduce((s, e) => s + e.pricePerHour * e.quantity * 9, 0),
      assistantAmount: asst.pricePerHour * 9,
    };

    const subtotal = slot.baseAmount + slot.equipmentAmount + slot.assistantAmount;
    const studioDeposit = Math.ceil(slot.baseAmount * STUDIO_DEPOSIT_RATIO / 100) * 100;
    const equipDeposit = Math.ceil(slot.equipmentAmount * EQUIPMENT_DEPOSIT_RATIO / 100) * 100;
    const riskDeposit = Math.ceil(subtotal * OVERTIME_RISK_DEPOSIT_RATIO / 100) * 100;
    const totalDeposit = studioDeposit + equipDeposit + riskDeposit;

    const now = new Date();
    const deposits: OrderDeposit[] = [
      { id: generateId('dep'), type: 'studio', amount: studioDeposit, status: 'frozen', channel: 'alipay', confirmedAt: now.toISOString() },
      { id: generateId('dep'), type: 'equipment', amount: equipDeposit, status: 'frozen', channel: 'alipay', confirmedAt: now.toISOString() },
      { id: generateId('dep'), type: 'overtime_risk', amount: riskDeposit, status: 'frozen', channel: 'alipay', confirmedAt: now.toISOString() },
    ];

    const order: Order = {
      id: generateId('order'),
      orderNo: generateOrderNo(),
      studioId: studio.id,
      customerName: '设备全占客户',
      customerPhone: '13800000102',
      startTime: slot.startTime,
      endTime: slot.endTime,
      slots: [slot],
      equipments: slot.equipments,
      assistantIds: [asst.id],
      setupTime: 1,
      teardownTime: 1,
      baseAmount: slot.baseAmount,
      equipmentAmount: slot.equipmentAmount,
      assistantAmount: slot.assistantAmount,
      deposits,
      depositAmount: totalDeposit,
      depositChannel: 'alipay',
      depositConfirmedAt: now.toISOString(),
      studioDepositAmount: studioDeposit,
      equipmentDepositAmount: equipDeposit,
      overtimeRiskDepositAmount: riskDeposit,
      overtimeHours: 0,
      overtimeFee: 0,
      penaltyFee: 0,
      damageFee: 0,
      damages: [],
      payments: [{ id: generateId('pay'), type: 'deposit', amount: totalDeposit, channel: 'alipay', confirmedAt: now.toISOString() }],
      finalPaymentCollected: false,
      invoiceRequired: false,
      status: 'confirmed',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    const newState = { ...state, orders: [...state.orders, order] };
    setState(newState);

    return {
      success: true,
      message: '设备冲突替代场景已创建',
      details: `创建了一个全天订单(${studio.name} 09:00-18:00)，占用了${lights.slice(0, 3).map(e => e.name).join('、')}的全部库存。请尝试在同一时段预约同一棚位并选择相同灯光，系统会检测冲突并推荐替代方案（如${altStudio.name}的兼容设备或其他时段）。押金已分3段冻结。`,
    };
  };

  const runOvertimeDepositScenario = (): ScenarioResult => {
    const studio = studios[0];
    const asst = assistants[0];
    const eq = equipments.find(e => e.category === 'lighting' && e.compatibleStudios.includes(studio.id));
    if (!studio || !asst || !eq) return { success: false, message: '数据不足' };

    const today = new Date();
    const todayStr = formatDate(today);
    const scheduledEnd = `${todayStr}T12:00:00`;
    const actualEnd = `${todayStr}T14:30:00`;

    const slot: BookingSlot = {
      id: generateId('slot'),
      studioId: studio.id,
      startTime: `${todayStr}T08:00:00`,
      endTime: scheduledEnd,
      actualEndTime: actualEnd,
      phases: buildTimePhases(`${todayStr}T08:00:00`, scheduledEnd, 0.5, 0.5),
      equipments: [{ equipmentId: eq.id, quantity: 2 }],
      assistantIds: [asst.id],
      setupTime: 0.5,
      teardownTime: 0.5,
      sceneName: '超时拍摄',
      overtimeHours: 2.5,
      overtimeFee: Math.round(2.5 * (studio.basePricePerHour + eq.pricePerHour * 2 + asst.pricePerHour) * 1.5 * 100) / 100,
      baseAmount: studio.basePricePerHour * 4,
      equipmentAmount: eq.pricePerHour * 2 * 4,
      assistantAmount: asst.pricePerHour * 4,
    };

    const subtotal = slot.baseAmount + slot.equipmentAmount + slot.assistantAmount + slot.overtimeFee;
    const studioDeposit = Math.ceil(slot.baseAmount * STUDIO_DEPOSIT_RATIO / 100) * 100;
    const equipDeposit = Math.ceil(slot.equipmentAmount * EQUIPMENT_DEPOSIT_RATIO / 100) * 100;
    const riskDeposit = Math.ceil(subtotal * OVERTIME_RISK_DEPOSIT_RATIO / 100) * 100;
    const totalDeposit = studioDeposit + equipDeposit + riskDeposit;

    const now = new Date();
    const deposits: OrderDeposit[] = [
      { id: generateId('dep'), type: 'studio', amount: studioDeposit, status: 'released', channel: 'wechat', confirmedAt: now.toISOString(), releasedAt: now.toISOString(), releasedAmount: studioDeposit },
      { id: generateId('dep'), type: 'equipment', amount: equipDeposit, status: 'released', channel: 'wechat', confirmedAt: now.toISOString(), releasedAt: now.toISOString(), releasedAmount: equipDeposit },
      { id: generateId('dep'), type: 'overtime_risk', amount: riskDeposit, status: 'deducted', channel: 'wechat', confirmedAt: now.toISOString(), releasedAt: now.toISOString(), releasedAmount: riskDeposit - slot.overtimeFee, deductionReason: '超时扣费', deductFromDeposit: true },
    ];

    const payments: PaymentRecord[] = [
      { id: generateId('pay'), type: 'deposit', amount: totalDeposit, channel: 'wechat', confirmedAt: new Date(now.getTime() - 86400000).toISOString() },
      { id: generateId('pay'), type: 'final', amount: subtotal + slot.overtimeFee - totalDeposit, channel: 'wechat', confirmedAt: new Date(now.getTime() - 3600000).toISOString() },
    ];

    const order: Order = {
      id: generateId('order'),
      orderNo: generateOrderNo(),
      studioId: studio.id,
      customerName: '超时扣费客户',
      customerPhone: '13800000103',
      photographer: '李摄影师',
      startTime: `${todayStr}T08:00:00`,
      endTime: scheduledEnd,
      actualEndTime: actualEnd,
      slots: [slot],
      equipments: slot.equipments,
      assistantIds: [asst.id],
      setupTime: 0.5,
      teardownTime: 0.5,
      baseAmount: slot.baseAmount,
      equipmentAmount: slot.equipmentAmount,
      assistantAmount: slot.assistantAmount,
      deposits,
      depositAmount: totalDeposit,
      depositChannel: 'wechat',
      depositConfirmedAt: new Date(now.getTime() - 86400000).toISOString(),
      studioDepositAmount: studioDeposit,
      equipmentDepositAmount: equipDeposit,
      overtimeRiskDepositAmount: riskDeposit,
      overtimeHours: 2.5,
      overtimeFee: slot.overtimeFee,
      penaltyFee: 0,
      damageFee: 0,
      damages: [],
      payments,
      finalPaymentCollected: true,
      finalPaymentAmount: subtotal + slot.overtimeFee - totalDeposit,
      finalPaymentAt: new Date(now.getTime() - 3600000).toISOString(),
      priceLocked: true,
      invoiceRequired: true,
      invoiceInfo: { title: '超时拍摄有限公司', taxNo: '91110000MA00000000' },
      status: 'completed',
      createdAt: new Date(now.getTime() - 86400000).toISOString(),
      updatedAt: now.toISOString(),
    };

    const newState = { ...state, orders: [...state.orders, order] };
    setState(newState);

    return {
      success: true,
      message: '超时扣费+押金分段场景已创建',
      details: `创建了一个已完成订单：原定08:00-12:00(4h)，实际到14:30(超时2.5h)。超时费按1.5倍= ${formatMoney(slot.overtimeFee)}，从超时风险冻结押金${formatMoney(riskDeposit)}中扣除。棚位押金${formatMoney(studioDeposit)}和设备押金${formatMoney(equipDeposit)}已释放，超时风险押金已部分扣减。尾款已收，价格锁定🔒。`,
    };
  };

  const runDamageDepositFreezeScenario = (): ScenarioResult => {
    const studio = studios[0];
    const asst = assistants[0];
    const eq = equipments.find(e => e.category === 'lighting' && e.compatibleStudios.includes(studio.id));
    const eq2 = equipments.find(e => e.category === 'set' && e.compatibleStudios.includes(studio.id));
    if (!studio || !asst || !eq) return { success: false, message: '数据不足' };

    const today = new Date();
    const todayStr = formatDate(today);

    const slot: BookingSlot = {
      id: generateId('slot'),
      studioId: studio.id,
      startTime: `${todayStr}T10:00:00`,
      endTime: `${todayStr}T16:00:00`,
      phases: buildTimePhases(`${todayStr}T10:00:00`, `${todayStr}T16:00:00`, 0.5, 0.5),
      equipments: [{ equipmentId: eq.id, quantity: 2 }, ...(eq2 ? [{ equipmentId: eq2.id, quantity: 1 }] : [])],
      assistantIds: [asst.id],
      setupTime: 0.5,
      teardownTime: 0.5,
      sceneName: '损坏赔偿拍摄',
      overtimeHours: 0,
      overtimeFee: 0,
      baseAmount: studio.basePricePerHour * 6,
      equipmentAmount: eq.pricePerHour * 2 * 6 + (eq2 ? eq2.pricePerHour * 6 : 0),
      assistantAmount: asst.pricePerHour * 6,
    };

    const subtotal = slot.baseAmount + slot.equipmentAmount + slot.assistantAmount;
    const studioDeposit = Math.ceil(slot.baseAmount * STUDIO_DEPOSIT_RATIO / 100) * 100;
    const equipDeposit = Math.ceil(slot.equipmentAmount * EQUIPMENT_DEPOSIT_RATIO / 100) * 100;
    const riskDeposit = Math.ceil(subtotal * OVERTIME_RISK_DEPOSIT_RATIO / 100) * 100;
    const totalDeposit = studioDeposit + equipDeposit + riskDeposit;

    const now = new Date();

    const damages: OrderDamage[] = [
      {
        id: generateId('dmg'),
        equipmentId: eq.id,
        description: `${eq.name}灯管破裂，需要更换`,
        cost: Math.ceil(eq.pricePerHour * 20),
        status: 'pending',
        reportedAt: now.toISOString(),
        slotId: slot.id,
        deductFromDeposit: true,
      },
      {
        id: generateId('dmg'),
        equipmentId: eq2?.id || eq.id,
        description: eq2 ? `${eq2.name}边角磕碰划伤` : `${eq.name}支架变形`,
        cost: Math.ceil((eq2 || eq).pricePerHour * 5),
        status: 'confirmed',
        reportedAt: new Date(now.getTime() - 3600000).toISOString(),
        slotId: slot.id,
        deductFromDeposit: true,
      },
    ];

    const totalDamageCost = damages.reduce((s, d) => s + d.cost, 0);

    const deposits: OrderDeposit[] = [
      { id: generateId('dep'), type: 'studio', amount: studioDeposit, status: 'released', channel: 'bank', confirmedAt: new Date(now.getTime() - 172800000).toISOString(), releasedAt: now.toISOString(), releasedAmount: studioDeposit },
      { id: generateId('dep'), type: 'equipment', amount: equipDeposit, status: 'frozen', channel: 'bank', confirmedAt: new Date(now.getTime() - 172800000).toISOString(), frozenReason: `设备损坏待认定：${damages.filter(d => d.status === 'pending').map(d => d.description).join('；')}` },
      { id: generateId('dep'), type: 'overtime_risk', amount: riskDeposit, status: 'released', channel: 'bank', confirmedAt: new Date(now.getTime() - 172800000).toISOString(), releasedAt: now.toISOString(), releasedAmount: riskDeposit },
    ];

    const payments: PaymentRecord[] = [
      { id: generateId('pay'), type: 'deposit', amount: totalDeposit, channel: 'bank', confirmedAt: new Date(now.getTime() - 172800000).toISOString() },
      { id: generateId('pay'), type: 'final', amount: subtotal - totalDeposit, channel: 'bank', confirmedAt: new Date(now.getTime() - 86400000).toISOString() },
    ];

    const order: Order = {
      id: generateId('order'),
      orderNo: generateOrderNo(),
      studioId: studio.id,
      customerName: '损坏赔偿客户',
      customerPhone: '13800000104',
      photographer: '赵摄影师',
      startTime: `${todayStr}T10:00:00`,
      endTime: `${todayStr}T16:00:00`,
      slots: [slot],
      equipments: slot.equipments,
      assistantIds: [asst.id],
      setupTime: 0.5,
      teardownTime: 0.5,
      baseAmount: slot.baseAmount,
      equipmentAmount: slot.equipmentAmount,
      assistantAmount: slot.assistantAmount,
      deposits,
      depositAmount: totalDeposit,
      depositChannel: 'bank',
      depositConfirmedAt: new Date(now.getTime() - 172800000).toISOString(),
      studioDepositAmount: studioDeposit,
      equipmentDepositAmount: equipDeposit,
      overtimeRiskDepositAmount: riskDeposit,
      overtimeHours: 0,
      overtimeFee: 0,
      penaltyFee: 0,
      damageFee: totalDamageCost,
      damages,
      payments,
      finalPaymentCollected: true,
      finalPaymentAmount: subtotal - totalDeposit,
      finalPaymentAt: new Date(now.getTime() - 86400000).toISOString(),
      priceLocked: true,
      invoiceRequired: false,
      status: 'completed',
      notes: '拍摄结束后发现设备损坏，设备押金暂不释放',
      createdAt: new Date(now.getTime() - 259200000).toISOString(),
      updatedAt: now.toISOString(),
    };

    const newState = { ...state, orders: [...state.orders, order] };
    setState(newState);

    return {
      success: true,
      message: '损坏赔偿+押金冻结场景已创建',
      details: `创建了一个已完成订单，含2项设备损坏记录：(1)${damages[0].description}，待认定(pending)；(2)${damages[1].description}，已确认(confirmed)。总赔偿金额${formatMoney(totalDamageCost)}。棚位押金${formatMoney(studioDeposit)}和超时风险押金${formatMoney(riskDeposit)}已释放，但设备押金${formatMoney(equipDeposit)}因有待认定损坏而冻结。可在订单详情或财务管理中处理损坏认定和押金释放。`,
    };
  };

  const handleReset = () => {
    if (window.confirm('确定要重置所有数据吗？这将清除所有订单和维护记录。')) {
      resetAllData();
      setResults({});
    }
  };

  const scenarios = [
    {
      id: 'concurrent-booking',
      title: '并发抢档',
      description: '模拟两个客户同时预约同一档期，验证临时占用和先到先得机制',
      icon: '⚡',
      color: 'from-purple-500 to-pink-500',
    },
    {
      id: 'equipment-conflict',
      title: '设备冲突',
      description: '创建设备全满的订单，验证冲突检测和替代方案推荐',
      icon: '💡',
      color: 'from-amber-500 to-orange-500',
    },
    {
      id: 'deposit-unpaid',
      title: '押金未付',
      description: '创建待付押金订单，验证超时自动过期机制',
      icon: '💰',
      color: 'from-green-500 to-emerald-500',
    },
    {
      id: 'overtime-fee',
      title: '超时扣费',
      description: '创建超时使用的已完成订单，验证超时费计算逻辑',
      icon: '⏰',
      color: 'from-blue-500 to-cyan-500',
    },
    {
      id: 'maintenance-reschedule',
      title: '维护日改期',
      description: '添加维护日并影响已有订单，验证改期和赔偿流程',
      icon: '🔧',
      color: 'from-red-500 to-rose-500',
    },
    {
      id: 'cross-day-multi-studio',
      title: '跨日换棚',
      description: '跨2天多棚位订单：第1天拍产品、第2天换棚拍直播，含布置/拍摄/清场三段资源占用',
      icon: '🎬',
      color: 'from-indigo-500 to-violet-500',
    },
    {
      id: 'equipment-conflict-alt',
      title: '设备冲突替代',
      description: '占满全部灯光库存，触发冲突检测与替代设备/棚位推荐，含分段押金',
      icon: '🔄',
      color: 'from-teal-500 to-cyan-500',
    },
    {
      id: 'overtime-deposit',
      title: '超时扣费',
      description: '超时2.5h按1.5倍扣费，超时风险押金扣减，棚位/设备押金独立释放，价格锁定',
      icon: '⏱️',
      color: 'from-orange-500 to-amber-500',
    },
    {
      id: 'damage-deposit-freeze',
      title: '损坏冻结押金',
      description: '设备损坏待认定，设备押金冻结不释放，棚位和超时风险押金可独立释放',
      icon: '🔒',
      color: 'from-rose-600 to-pink-600',
    },
  ];

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">场景演示</h2>
          <p className="text-gray-500 mt-1">一键创建测试场景，快速验证系统各功能模块</p>
        </div>
        <button
          onClick={handleReset}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
        >
          重置数据
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {scenarios.map(scenario => {
          const result = results[scenario.id];
          const isRunning = runningScenario === scenario.id;
          
          return (
            <div
              key={scenario.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
            >
              <div className={`h-2 bg-gradient-to-r ${scenario.color}`} />
              
              <div className="p-5">
                <div className="flex items-start gap-3 mb-3">
                  <div className="text-3xl">{scenario.icon}</div>
                  <div>
                    <h3 className="font-semibold text-gray-800">{scenario.title}</h3>
                    <p className="text-sm text-gray-500 mt-0.5">{scenario.description}</p>
                  </div>
                </div>
                
                {result && (
                  <div className={`p-3 rounded-lg mb-3 text-sm ${
                    result.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                  }`}>
                    <p className="font-medium">{result.success ? '✓ ' : '✗ '}{result.message}</p>
                    {result.details && (
                      <p className="mt-2 text-xs opacity-80 leading-relaxed">{result.details}</p>
                    )}
                  </div>
                )}
                
                <button
                  onClick={() => runScenario(scenario.id)}
                  disabled={isRunning}
                  className={`w-full py-2.5 rounded-lg font-medium transition-all ${
                    isRunning
                      ? 'bg-gray-200 text-gray-500 cursor-wait'
                      : 'bg-gradient-to-r text-white hover:opacity-90 ' + scenario.color
                  }`}
                >
                  {isRunning ? '运行中...' : result ? '重新运行' : '运行场景'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-5">
        <h3 className="font-semibold text-blue-800 mb-3">📖 使用说明</h3>
        <ul className="text-sm text-blue-700 space-y-2">
          <li>• <strong>并发抢档</strong>: 创建两个同时段的临时订单，先支付押金的客户确认订单，另一个会因冲突无法确认。临时占用有效期30分钟。</li>
          <li>• <strong>设备冲突</strong>: 创建一个占用全部灯光设备的订单。您可以新建预约并选择相同设备来触发冲突检测和替代方案推荐。</li>
          <li>• <strong>押金未付</strong>: 创建一个30分钟后过期的待付押金订单。可在财务视图的押金管理中确认到账。</li>
          <li>• <strong>超时扣费(旧)</strong>: 创建一个已完成的超时订单，展示超时费的计算（按1.5倍费率）。</li>
          <li>• <strong>维护日改期</strong>: 添加维护日并自动标记受影响订单。可在维护计划页面查看处理。</li>
          <li>• <strong>跨日换棚</strong> ⭐: 创建跨2天多棚位订单，第1天棚A拍产品、第2天棚B拍直播，含布置期/拍摄期/清场期三段资源占用可视化，押金分3段(棚位/设备/超时风险)。</li>
          <li>• <strong>设备冲突替代</strong> ⭐: 占满全部灯光库存，新预约触发冲突检测推荐替代设备/棚位，含分段押金。</li>
          <li>• <strong>超时扣费</strong> ⭐: 超时2.5h按1.5倍扣费，超时风险押金扣减，棚位/设备押金独立释放，尾款已收价格锁定。</li>
          <li>• <strong>损坏冻结押金</strong> ⭐: 设备损坏待认定，设备押金冻结不释放，棚位和超时风险押金可独立释放。订单已结束但押金不全额释放。</li>
        </ul>
      </div>
    </div>
  );
}
