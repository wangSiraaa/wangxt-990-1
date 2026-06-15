import { useState } from 'react';
import { useAppState } from '../context/AppStateContext';
import type { Order, DepositChannel } from '../types';
import { formatMoney, addDays, addHours, generateId, generateOrderNo, formatDate } from '../utils/dateUtils';
import { calculateOrderFees } from '../services/feeService';
import { saveState } from '../store/storage';

interface ScenarioResult {
  success: boolean;
  message: string;
  details?: string;
}

export default function ScenariosPage() {
  const { state, resetAllData } = useAppState();
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
    saveState(newState);
    
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
    saveState(newState);
    
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
    saveState(newState);
    
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
    saveState(newState);
    
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
    saveState(newState);
    
    return {
      success: true,
      message: '维护日改期场景已创建',
      details: `为${studio.name}在第7天添加了维护日，同时创建了2个受影响的已确认订单。这些订单会被标记为"受维护影响"，您可以在维护计划页面查看并处理改期或赔偿。也可以在订单详情中进行改期操作。`,
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
          <li>• <strong>超时扣费</strong>: 创建一个已完成的超时订单，展示超时费的计算（按1.5倍费率）。</li>
          <li>• <strong>维护日改期</strong>: 添加维护日并自动标记受影响订单。可在维护计划页面查看处理。</li>
        </ul>
      </div>
    </div>
  );
}
