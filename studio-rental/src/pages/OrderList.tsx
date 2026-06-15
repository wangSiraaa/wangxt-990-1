import { useState } from 'react';
import { useAppState } from '../context/AppStateContext';
import type { Order, OrderStatus } from '../types';
import { formatDateTime, formatMoney } from '../utils/dateUtils';
import { getStatusLabel, getStatusColor } from '../components/StatusBadge';
import OrderDetailModal from '../components/OrderDetailModal';
import BookingModal from '../components/BookingModal';

interface OrderListProps {
  filter?: 'all' | 'active' | 'completed' | 'cancelled';
}

export default function OrderList({ filter = 'all' }: OrderListProps) {
  const { state } = useAppState();
  const { orders, studios } = state;
  
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showBooking, setShowBooking] = useState(false);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>(filter === 'all' ? 'all' : filter as OrderStatus | 'all');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredOrders = orders
    .filter(order => {
      if (statusFilter !== 'all' && order.status !== statusFilter) return false;
      if (searchTerm && !order.customerName.includes(searchTerm) && !order.orderNo.includes(searchTerm)) return false;
      return true;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const statusOptions: (OrderStatus | 'all')[] = [
    'all',
    'temp',
    'pending_deposit',
    'deposit_confirmed',
    'confirmed',
    'in_progress',
    'completed',
    'cancelled',
    'expired',
  ];

  const getStatusFilterLabel = (s: OrderStatus | 'all') => {
    if (s === 'all') return '全部';
    return getStatusLabel(s);
  };

  const activeCount = orders.filter(o => 
    o.status === 'confirmed' || o.status === 'in_progress' || o.status === 'deposit_confirmed'
  ).length;

  const pendingDepositCount = orders.filter(o => o.status === 'pending_deposit' || o.status === 'temp').length;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">订单管理</h2>
          <p className="text-gray-500 mt-1">
            共 {orders.length} 个订单，进行中 {activeCount} 个，待付押金 {pendingDepositCount} 个
          </p>
        </div>
        <button
          onClick={() => setShowBooking(true)}
          className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
        >
          <span>+</span>
          新建预约
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between flex-wrap gap-4">
          <div className="flex gap-2 flex-wrap">
            {statusOptions.map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === status
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {getStatusFilterLabel(status)}
              </button>
            ))}
          </div>
          
          <div className="relative">
            <input
              type="text"
              placeholder="搜索订单号或客户名..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">订单号</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">客户</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">棚位</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">档期</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">金额</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    暂无订单数据
                  </td>
                </tr>
              ) : (
                filteredOrders.map(order => {
                  const studio = studios.find(s => s.id === order.studioId);
                  const totalAmount = order.baseAmount + order.equipmentAmount + order.assistantAmount + order.overtimeFee + order.penaltyFee + order.damageFee;
                  
                  return (
                    <tr 
                      key={order.id} 
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => {
                        setSelectedOrder(order);
                        setShowDetail(true);
                      }}
                    >
                      <td className="px-4 py-3">
                        <span className="font-medium text-blue-600">{order.orderNo}</span>
                        {order.affectedByMaintenance && (
                          <span className="ml-2 text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded">
                            受维护影响
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{order.customerName}</div>
                        <div className="text-xs text-gray-500">{order.customerPhone}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {studio && (
                            <div 
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: studio.color }}
                            />
                          )}
                          <span className="text-sm text-gray-700">{studio?.name.split(' - ')[0]}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        <div>{formatDateTime(order.startTime)}</div>
                        <div className="text-gray-400">至 {formatDateTime(order.endTime)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{formatMoney(totalAmount)}</div>
                        <div className="text-xs text-gray-500">
                          押金 {formatMoney(order.depositAmount)}
                          {order.depositConfirmedAt ? (
                            <span className="text-green-600 ml-1">✓</span>
                          ) : (
                            <span className="text-orange-500 ml-1">待付</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(order.status)}`}>
                          {getStatusLabel(order.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          onClick={e => {
                            e.stopPropagation();
                            setSelectedOrder(order);
                            setShowDetail(true);
                          }}
                        >
                          查看
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
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

      {showBooking && (
        <BookingModal
          isOpen={showBooking}
          onClose={() => setShowBooking(false)}
          onSuccess={() => {
            setShowBooking(false);
          }}
        />
      )}
    </div>
  );
}
