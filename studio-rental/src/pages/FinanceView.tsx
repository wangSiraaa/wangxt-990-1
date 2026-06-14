import { useState } from 'react';
import { useAppState } from '../context/AppStateContext';
import { formatMoney, formatDateTime } from '../utils/dateUtils';
import { getStatusLabel, getStatusColor, getDepositChannelLabel } from '../components/StatusBadge';
import { Order, DepositChannel } from '../types';
import OrderDetailModal from '../components/OrderDetailModal';

type FinanceTab = 'deposits' | 'settlements' | 'invoices';

export default function FinanceView() {
  const { state, confirmDeposit } = useAppState();
  const { orders } = state;
  
  const [activeTab, setActiveTab] = useState<FinanceTab>('deposits');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const pendingDepositOrders = orders.filter(
    o => (o.status === 'pending_deposit' || o.status === 'temp')
  );

  const confirmedOrders = orders.filter(
    o => o.status === 'deposit_confirmed' || o.status === 'confirmed' || o.status === 'in_progress'
  );

  const completedOrders = orders.filter(
    o => o.status === 'completed'
  );

  const pendingSettlement = completedOrders.filter(
    o => o.depositConfirmedAt && (o.overtimeFee > 0 || o.damageFee > 0)
  );

  const invoiceOrders = orders.filter(o => o.invoiceRequired);

  const totalDeposits = orders.reduce((sum, o) => sum + (o.depositConfirmedAt ? o.depositAmount : 0), 0);
  const totalRevenue = completedOrders.reduce((sum, o) => {
    const total = o.baseAmount + o.equipmentAmount + o.assistantAmount + o.overtimeFee + o.damageFee;
    return sum + total;
  }, 0);

  const handleConfirmDeposit = (orderId: string, channel: DepositChannel) => {
    confirmDeposit(orderId, channel);
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
        <p className="text-gray-500 mt-1">押金收取、尾款结算、发票管理</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-2xl">
              💰
            </div>
            <div>
              <p className="text-sm text-gray-500">已收押金</p>
              <p className="text-2xl font-bold text-gray-800">{formatMoney(totalDeposits)}</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">
            待确认: {pendingDepositOrders.length} 笔
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center text-2xl">
              📈
            </div>
            <div>
              <p className="text-sm text-gray-500">已完成订单收入</p>
              <p className="text-2xl font-bold text-gray-800">{formatMoney(totalRevenue)}</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">
            共 {completedOrders.length} 单
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-2xl">
              📋
            </div>
            <div>
              <p className="text-sm text-gray-500">待开票</p>
              <p className="text-2xl font-bold text-gray-800">{invoiceOrders.length}</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">
            需开票订单
          </p>
        </div>
      </div>

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
            <div className="space-y-4">
              <h3 className="font-medium text-gray-800">待确认押金</h3>
              
              {pendingDepositOrders.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-3xl mb-2">✅</p>
                  <p>暂无待确认押金</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingDepositOrders.map(order => (
                    <div
                      key={order.id}
                      className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-800">{order.orderNo}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${getStatusColor(order.status)}`}>
                              {getStatusLabel(order.status)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">
                            {order.customerName} - {formatDateTime(order.startTime)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-amber-600">
                            {formatMoney(order.depositAmount)}
                          </p>
                          <p className="text-xs text-gray-400">押金金额</p>
                        </div>
                      </div>
                      
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => handleConfirmDeposit(order.id, 'alipay')}
                          className="flex-1 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors"
                        >
                          确认支付宝到账
                        </button>
                        <button
                          onClick={() => handleConfirmDeposit(order.id, 'wechat')}
                          className="flex-1 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600 transition-colors"
                        >
                          确认微信到账
                        </button>
                        <button
                          onClick={() => {
                            setSelectedOrder(order);
                            setShowDetail(true);
                          }}
                          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition-colors"
                        >
                          详情
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <h3 className="font-medium text-gray-800 mt-6 pt-6 border-t border-gray-200">
                已支付押金 ({confirmedOrders.length})
              </h3>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 text-gray-600 font-medium">订单号</th>
                      <th className="text-left py-2 text-gray-600 font-medium">客户</th>
                      <th className="text-left py-2 text-gray-600 font-medium">支付方式</th>
                      <th className="text-left py-2 text-gray-600 font-medium">押金金额</th>
                      <th className="text-left py-2 text-gray-600 font-medium">确认时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {confirmedOrders.map(order => (
                      <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 text-blue-600 cursor-pointer"
                            onClick={() => {
                              setSelectedOrder(order);
                              setShowDetail(true);
                            }}>
                          {order.orderNo}
                        </td>
                        <td className="py-2">{order.customerName}</td>
                        <td className="py-2">{getDepositChannelLabel(order.depositChannel)}</td>
                        <td className="py-2 font-medium">{formatMoney(order.depositAmount)}</td>
                        <td className="py-2 text-gray-500">
                          {order.depositConfirmedAt ? formatDateTime(order.depositConfirmedAt) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'settlements' && (
            <div className="space-y-4">
              <h3 className="font-medium text-gray-800">待结算订单</h3>
              
              {pendingSettlement.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-3xl mb-2">📊</p>
                  <p>暂无待结算订单</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingSettlement.map(order => {
                    const total = order.baseAmount + order.equipmentAmount + order.assistantAmount + order.overtimeFee + order.damageFee;
                    const remaining = total - order.depositAmount;
                    
                    return (
                      <div
                        key={order.id}
                        className="p-4 border border-gray-200 rounded-lg"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-800">{order.orderNo}</span>
                          <span className="text-sm text-gray-500">{order.customerName}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-gray-500">总金额</p>
                            <p className="font-medium">{formatMoney(total)}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">已收押金</p>
                            <p className="font-medium text-green-600">{formatMoney(order.depositAmount)}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">应收尾款</p>
                            <p className="font-bold text-amber-600">{formatMoney(remaining)}</p>
                          </div>
                        </div>
                        {(order.overtimeFee > 0 || order.damageFee > 0) && (
                          <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500">
                            含超时费 {formatMoney(order.overtimeFee)}
                            {order.damageFee > 0 && ` · 损坏赔偿 ${formatMoney(order.damageFee)}`}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
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
                    const total = order.baseAmount + order.equipmentAmount + order.assistantAmount + order.overtimeFee + order.damageFee;
                    
                    return (
                      <div
                        key={order.id}
                        className="p-4 border border-gray-200 rounded-lg"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <span className="font-medium text-gray-800">{order.orderNo}</span>
                            <span className={`ml-2 text-xs px-2 py-0.5 rounded-full border ${getStatusColor(order.status)}`}>
                              {getStatusLabel(order.status)}
                            </span>
                          </div>
                          <span className="font-medium text-blue-600">{formatMoney(total)}</span>
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
          onClose={() => {
            setShowDetail(false);
            setSelectedOrder(null);
          }}
        />
      )}
    </div>
  );
}
