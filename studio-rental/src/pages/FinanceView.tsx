import { useState } from 'react';
import { useAppState } from '../context/AppStateContext';
import { formatMoney, formatDateTime } from '../utils/dateUtils';
import { getStatusLabel, getStatusColor, getDepositChannelLabel } from '../components/StatusBadge';
import { calculateFinalAmount, getDepositReleasePlan } from '../services/feeService';
import type { Order, DepositChannel, DepositType } from '../types';
import OrderDetailModal from '../components/OrderDetailModal';

type FinanceTab = 'deposits' | 'settlements' | 'invoices';

const DEPOSIT_TYPE_LABELS: Record<DepositType, string> = {
  studio: '棚位押金',
  equipment: '设备押金',
  overtime_risk: '超时风险冻结',
};

const DEPOSIT_STATUS_LABELS: Record<string, string> = {
  frozen: '冻结中',
  released: '已释放',
  partially_released: '部分释放',
  deducted: '已扣减',
};

const DEPOSIT_STATUS_COLORS: Record<string, string> = {
  frozen: 'bg-blue-100 text-blue-700',
  released: 'bg-green-100 text-green-700',
  partially_released: 'bg-amber-100 text-amber-700',
  deducted: 'bg-red-100 text-red-700',
};

export default function FinanceView() {
  const { state, confirmDeposit, collectFinalPayment, releaseDeposit, resolveDamage } = useAppState();
  const { orders, equipments } = state;

  const [activeTab, setActiveTab] = useState<FinanceTab>('deposits');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showFinalPayment, setShowFinalPayment] = useState<string | null>(null);
  const [finalPayChannel, setFinalPayChannel] = useState<DepositChannel>('alipay');

  const pendingDepositOrders = orders.filter(
    o => o.status === 'pending_deposit' || o.status === 'temp'
  );

  const confirmedOrders = orders.filter(
    o => o.status === 'deposit_confirmed' || o.status === 'confirmed' || o.status === 'in_progress'
  );

  const completedOrders = orders.filter(o => o.status === 'completed');

  const ordersWithDeposits = orders.filter(o =>
    o.deposits.length > 0 || (o.depositConfirmedAt && o.status !== 'cancelled' && o.status !== 'expired')
  );

  const ordersWithPendingDamages = orders.filter(o =>
    o.damages.some(d => d.status === 'pending')
  );

  const ordersPendingFinalPayment = orders.filter(o =>
    !o.finalPaymentCollected &&
    o.depositConfirmedAt &&
    o.status !== 'temp' &&
    o.status !== 'expired' &&
    o.status !== 'cancelled'
  );

  const invoiceOrders = orders.filter(o => o.invoiceRequired);

  const totalDeposits = orders.reduce((sum, o) => sum + (o.depositConfirmedAt ? o.depositAmount : 0), 0);
  const totalRevenue = completedOrders.reduce((sum, o) => {
    const fees = calculateFinalAmount(o);
    return sum + fees.totalAmount;
  }, 0);

  const totalFrozenDeposits = orders.reduce((sum, o) => {
    return sum + o.deposits
      .filter(d => d.status === 'frozen' || d.status === 'partially_released')
      .reduce((s, d) => s + (d.status === 'partially_released' ? d.amount - (d.releasedAmount || 0) : d.amount), 0);
  }, 0);

  const totalPendingDamageAmount = orders.reduce((sum, o) => {
    return sum + o.damages.filter(d => d.status === 'pending').reduce((s, d) => s + d.cost, 0);
  }, 0);

  const handleConfirmDeposit = (orderId: string, channel: DepositChannel) => {
    confirmDeposit(orderId, channel);
  };

  const handleCollectFinal = (orderId: string) => {
    const result = collectFinalPayment(orderId, finalPayChannel);
    if ('error' in result) {
      alert(result.error);
    } else {
      setShowFinalPayment(null);
    }
  };

  const handleReleaseDeposit = (orderId: string, depositType: DepositType) => {
    const result = releaseDeposit(orderId, depositType);
    if ('error' in result) {
      alert(result.error);
    }
  };

  const tabs: { id: FinanceTab; label: string; icon: string }[] = [
    { id: 'deposits', label: '押金管理', icon: '💰' },
    { id: 'settlements', label: '结算对账', icon: '📊' },
    { id: 'invoices', label: '发票管理', icon: '🧾' },
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">财务管理</h2>
        <p className="text-gray-500 mt-1">押金分段管理、尾款收取、损坏冻结、结算对账</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-2xl">💰</div>
            <div>
              <p className="text-sm text-gray-500">已收押金</p>
              <p className="text-2xl font-bold text-gray-800">{formatMoney(totalDeposits)}</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">待确认: {pendingDepositOrders.length} 笔</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-2xl">❄️</div>
            <div>
              <p className="text-sm text-gray-500">冻结押金</p>
              <p className="text-2xl font-bold text-blue-600">{formatMoney(totalFrozenDeposits)}</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">含待认定损坏: {formatMoney(totalPendingDamageAmount)}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center text-2xl">📈</div>
            <div>
              <p className="text-sm text-gray-500">已完成收入</p>
              <p className="text-2xl font-bold text-gray-800">{formatMoney(totalRevenue)}</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">共 {completedOrders.length} 单</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center text-2xl">⏳</div>
            <div>
              <p className="text-sm text-gray-500">待收尾款</p>
              <p className="text-2xl font-bold text-orange-600">{ordersPendingFinalPayment.length} 笔</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">待开票: {invoiceOrders.length} 单</p>
        </div>
      </div>

      {ordersWithPendingDamages.length > 0 && (
        <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-orange-500">⚠️</span>
            <span className="font-bold text-orange-700">损坏待认定 — 设备押金冻结中</span>
          </div>
          <div className="space-y-2">
            {ordersWithPendingDamages.map(order => (
              <div key={order.id} className="flex items-center justify-between bg-white rounded-lg p-3 border border-orange-100">
                <div>
                  <span className="font-medium text-gray-800 text-sm">{order.orderNo}</span>
                  <span className="text-gray-500 text-sm ml-2">— {order.customerName}</span>
                  {order.damages.filter(d => d.status === 'pending').map(dmg => {
                    const eq = equipments.find(e => e.id === dmg.equipmentId);
                    return (
                      <span key={dmg.id} className="ml-2 text-xs text-orange-600">
                        {eq?.name}: {dmg.description} ({formatMoney(dmg.cost)})
                      </span>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-orange-600">
                    冻结设备押金: {formatMoney(order.equipmentDepositAmount)}
                  </span>
                  <button
                    onClick={() => { setSelectedOrder(order); setShowDetail(true); }}
                    className="px-3 py-1 bg-orange-100 text-orange-700 rounded text-xs hover:bg-orange-200"
                  >
                    去处理
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                activeTab === tab.id
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {activeTab === 'deposits' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-medium text-gray-800 mb-3">待确认押金</h3>
                {pendingDepositOrders.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-3xl mb-2">✅</p>
                    <p>暂无待确认押金</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingDepositOrders.map(order => (
                      <div key={order.id} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-800">{order.orderNo}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full border ${getStatusColor(order.status)}`}>
                                {getStatusLabel(order.status)}
                              </span>
                            </div>
                            <p className="text-sm text-gray-500 mt-1">{order.customerName} - {formatDateTime(order.startTime)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-amber-600">{formatMoney(order.depositAmount)}</p>
                            <div className="text-xs text-gray-400 mt-1 space-y-0.5">
                              <p>棚位: {formatMoney(order.studioDepositAmount)} | 设备: {formatMoney(order.equipmentDepositAmount)} | 超时风险: {formatMoney(order.overtimeRiskDepositAmount)}</p>
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <button onClick={() => handleConfirmDeposit(order.id, 'alipay')} className="flex-1 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600">支付宝</button>
                          <button onClick={() => handleConfirmDeposit(order.id, 'wechat')} className="flex-1 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600">微信</button>
                          <button onClick={() => handleConfirmDeposit(order.id, 'bank')} className="flex-1 py-2 bg-purple-500 text-white rounded-lg text-sm hover:bg-purple-600">银行转账</button>
                          <button onClick={() => { setSelectedOrder(order); setShowDetail(true); }} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">详情</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="font-medium text-gray-800 mb-3 pt-4 border-t border-gray-200">
                  押金分段状态 ({ordersWithDeposits.length})
                </h3>
                {ordersWithDeposits.length === 0 ? (
                  <div className="text-center py-6 text-gray-500">暂无押金记录</div>
                ) : (
                  <div className="space-y-3">
                    {ordersWithDeposits.map(order => {
                      const releasePlan = getDepositReleasePlan(order);
                      const hasPendingDamage = order.damages.some(d => d.status === 'pending');
                      return (
                        <div key={order.id} className="p-4 border border-gray-200 rounded-lg">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-800 text-sm">{order.orderNo}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full border ${getStatusColor(order.status)}`}>
                                {getStatusLabel(order.status)}
                              </span>
                              <span className="text-sm text-gray-500">— {order.customerName}</span>
                              {order.priceLocked && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">🔒</span>}
                            </div>
                            <button
                              onClick={() => { setSelectedOrder(order); setShowDetail(true); }}
                              className="text-xs text-blue-600 hover:text-blue-800"
                            >
                              查看详情 →
                            </button>
                          </div>

                          {order.deposits.length > 0 ? (
                            <div className="grid grid-cols-3 gap-3">
                              {order.deposits.map(dep => (
                                <div key={dep.id} className={`p-3 rounded-lg border ${dep.status === 'frozen' ? 'bg-blue-50 border-blue-200' : dep.status === 'released' ? 'bg-green-50 border-green-200' : dep.status === 'partially_released' ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-medium text-gray-700">{DEPOSIT_TYPE_LABELS[dep.type]}</span>
                                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${DEPOSIT_STATUS_COLORS[dep.status]}`}>
                                      {DEPOSIT_STATUS_LABELS[dep.status]}
                                    </span>
                                  </div>
                                  <p className="text-lg font-bold text-gray-800">{formatMoney(dep.amount)}</p>
                                  {dep.status === 'partially_released' && dep.releasedAmount !== undefined && (
                                    <p className="text-xs text-amber-600 mt-1">
                                      已释放 {formatMoney(dep.releasedAmount)}
                                    </p>
                                  )}
                                  {dep.status === 'frozen' && order.status === 'completed' && (
                                    <button
                                      onClick={() => handleReleaseDeposit(order.id, dep.type)}
                                      className="mt-2 w-full py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                                    >
                                      释放
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="grid grid-cols-3 gap-3">
                              <div className={`p-3 rounded-lg border ${releasePlan.studioDeposit.releasable ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
                                <span className="text-xs font-medium text-gray-700">棚位押金</span>
                                <p className="text-lg font-bold text-gray-800">{formatMoney(releasePlan.studioDeposit.amount)}</p>
                                {releasePlan.studioDeposit.releasable ? (
                                  <span className="text-xs text-green-600">✓ 可释放</span>
                                ) : (
                                  <span className="text-xs text-blue-600">冻结中</span>
                                )}
                              </div>
                              <div className={`p-3 rounded-lg border ${hasPendingDamage ? 'bg-orange-50 border-orange-200' : releasePlan.equipmentDeposit.releasable ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
                                <span className="text-xs font-medium text-gray-700">设备押金</span>
                                <p className="text-lg font-bold text-gray-800">{formatMoney(releasePlan.equipmentDeposit.amount)}</p>
                                {hasPendingDamage ? (
                                  <span className="text-xs text-orange-600">⚠ 损坏待认定</span>
                                ) : releasePlan.equipmentDeposit.releasable ? (
                                  <span className="text-xs text-green-600">✓ 可释放</span>
                                ) : (
                                  <span className="text-xs text-blue-600">冻结中</span>
                                )}
                              </div>
                              <div className={`p-3 rounded-lg border ${releasePlan.overtimeRiskDeposit.releasable ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
                                <span className="text-xs font-medium text-gray-700">超时风险冻结</span>
                                <p className="text-lg font-bold text-gray-800">{formatMoney(releasePlan.overtimeRiskDeposit.amount)}</p>
                                {releasePlan.overtimeRiskDeposit.releasable ? (
                                  <span className="text-xs text-green-600">✓ 可释放</span>
                                ) : (
                                  <span className="text-xs text-blue-600">冻结中</span>
                                )}
                              </div>
                            </div>
                          )}

                          {hasPendingDamage && (
                            <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded text-xs text-orange-600">
                              ⚠ 存在待认定损坏，设备押金暂不释放
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'settlements' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-medium text-gray-800 mb-3">待收尾款</h3>
                {ordersPendingFinalPayment.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-3xl mb-2">✅</p>
                    <p>暂无待收尾款</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {ordersPendingFinalPayment.map(order => {
                      const fees = calculateFinalAmount(order);
                      return (
                        <div key={order.id} className="p-4 border border-gray-200 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <span className="font-medium text-gray-800">{order.orderNo}</span>
                              <span className={`ml-2 text-xs px-2 py-0.5 rounded-full border ${getStatusColor(order.status)}`}>
                                {getStatusLabel(order.status)}
                              </span>
                              <span className="text-sm text-gray-500 ml-2">{order.customerName}</span>
                              {order.priceLocked && <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">🔒</span>}
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-gray-500">总金额</p>
                              <p className="font-medium">{formatMoney(fees.totalAmount)}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">已收押金</p>
                              <p className="font-medium text-green-600">{formatMoney(order.depositAmount)}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">应收尾款</p>
                              <p className="font-bold text-amber-600">{formatMoney(fees.remainingAmount)}</p>
                            </div>
                          </div>
                          {(fees.overtimeFee > 0 || fees.damageFee > 0) && (
                            <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500">
                              含超时费 {formatMoney(fees.overtimeFee)}
                              {fees.damageFee > 0 && ` · 损坏赔偿 ${formatMoney(fees.damageFee)}`}
                            </div>
                          )}
                          <div className="mt-3 flex gap-2">
                            <button
                              onClick={() => setShowFinalPayment(order.id)}
                              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                            >
                              收取尾款
                            </button>
                            <button
                              onClick={() => { setSelectedOrder(order); setShowDetail(true); }}
                              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
                            >
                              查看详情
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <h3 className="font-medium text-gray-800 mb-3 pt-4 border-t border-gray-200">已结算订单</h3>
                {completedOrders.length === 0 ? (
                  <div className="text-center py-6 text-gray-500">
                    <p className="text-3xl mb-2">📊</p>
                    <p>暂无已结算订单</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {completedOrders.map(order => {
                      const fees = calculateFinalAmount(order);
                      const hasFrozenDeposits = order.deposits.some(d => d.status === 'frozen' || d.status === 'partially_released');
                      return (
                        <div key={order.id} className="p-4 border border-gray-200 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-800">{order.orderNo}</span>
                              <span className="text-sm text-gray-500">{order.customerName}</span>
                              {order.finalPaymentCollected && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">✓ 尾款已收</span>}
                              {hasFrozenDeposits && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">❄ 有冻结押金</span>}
                            </div>
                            <span className="font-medium">{formatMoney(fees.totalAmount)}</span>
                          </div>
                          <div className="flex gap-4 text-xs text-gray-500">
                            <span>押金: {formatMoney(order.depositAmount)}</span>
                            {order.finalPaymentCollected && order.finalPaymentAmount && (
                              <span>尾款: {formatMoney(order.finalPaymentAmount)}</span>
                            )}
                            {fees.overtimeFee > 0 && <span className="text-orange-600">超时: {formatMoney(fees.overtimeFee)}</span>}
                            {fees.damageFee > 0 && <span className="text-red-600">损坏: {formatMoney(fees.damageFee)}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'invoices' && (
            <div>
              <h3 className="font-medium text-gray-800 mb-4">需开票订单</h3>
              {invoiceOrders.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-3xl mb-2">🧾</p>
                  <p>暂无开票需求</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {invoiceOrders.map(order => {
                    const fees = calculateFinalAmount(order);
                    return (
                      <div key={order.id} className="p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <span className="font-medium text-gray-800">{order.orderNo}</span>
                            <span className={`ml-2 text-xs px-2 py-0.5 rounded-full border ${getStatusColor(order.status)}`}>
                              {getStatusLabel(order.status)}
                            </span>
                          </div>
                          <span className="font-medium text-blue-600">{formatMoney(fees.totalAmount)}</span>
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <p><span className="text-gray-400">抬头:</span> {order.invoiceInfo?.title}</p>
                          <p><span className="text-gray-400">税号:</span> {order.invoiceInfo?.taxNo}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showDetail && selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          isOpen={showDetail}
          onClose={() => { setShowDetail(false); setSelectedOrder(null); }}
        />
      )}

      {showFinalPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-5 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-800">收取尾款</h3>
            </div>
            <div className="p-5 space-y-4">
              {(() => {
                const order = orders.find(o => o.id === showFinalPayment);
                if (!order) return null;
                const fees = calculateFinalAmount(order);
                return (
                  <>
                    <div>
                      <p className="text-sm text-gray-600">订单号: {order.orderNo}</p>
                      <p className="text-sm text-gray-600">客户: {order.customerName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">尾款金额</p>
                      <p className="text-3xl font-bold text-green-600">{formatMoney(fees.remainingAmount)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">收款方式</label>
                      <select
                        value={finalPayChannel}
                        onChange={e => setFinalPayChannel(e.target.value as DepositChannel)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      >
                        <option value="alipay">支付宝</option>
                        <option value="wechat">微信</option>
                        <option value="bank">银行转账</option>
                        <option value="cash">现金</option>
                      </select>
                    </div>
                    {order.priceLocked && (
                      <p className="text-xs text-amber-600">⚠ 收取尾款后价格锁定，不可修改</p>
                    )}
                  </>
                );
              })()}
            </div>
            <div className="px-5 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
              <button onClick={() => setShowFinalPayment(null)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">取消</button>
              <button onClick={() => handleCollectFinal(showFinalPayment)} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">确认收款</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
