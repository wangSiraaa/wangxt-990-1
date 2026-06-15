import { useState } from 'react';
import { useAppState } from '../context/AppStateContext';
import StudioCalendar from '../components/StudioCalendar';
import BookingModal from '../components/BookingModal';
import OrderDetailModal from '../components/OrderDetailModal';
import type { Order } from '../types';
import { formatDateTime, formatMoney } from '../utils/dateUtils';
import { getStatusLabel, getStatusColor } from '../components/StatusBadge';

export default function PhotographerView() {
  const { state } = useAppState();
  const { orders, studios } = state;
  
  const [showBooking, setShowBooking] = useState(false);
  const [initialStudioId, setInitialStudioId] = useState('');
  const [initialDate, setInitialDate] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const myBookings = orders.filter(o => 
    o.status !== 'expired' && o.status !== 'cancelled'
  ).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  const handleBookClick = (studioId: string, date: string) => {
    setInitialStudioId(studioId);
    setInitialDate(date);
    setShowBooking(true);
  };

  const handleOrderClick = (order: Order) => {
    setSelectedOrder(order);
    setShowDetail(true);
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">可约档期</h2>
        <p className="text-gray-500 mt-1">查看各棚位可用时段，快速预约拍摄</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <StudioCalendar
            showBookingButton={true}
            onBookClick={handleBookClick}
            onOrderClick={handleOrderClick}
          />
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-800 mb-4">我的预约</h3>
            
            {myBookings.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">暂无预约</p>
            ) : (
              <div className="space-y-3">
                {myBookings.slice(0, 5).map(order => {
                  const studio = studios.find(s => s.id === order.studioId);
                  const totalAmount = order.baseAmount + order.equipmentAmount + order.assistantAmount;
                  
                  return (
                    <div
                      key={order.id}
                      className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => handleOrderClick(order)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: studio?.color }}
                          />
                          <span className="font-medium text-sm text-gray-800">
                            {studio?.name.split(' - ')[0]}
                          </span>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${getStatusColor(order.status)}`}>
                          {getStatusLabel(order.status)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mb-1">
                        {formatDateTime(order.startTime)}
                      </p>
                      <p className="text-sm font-medium text-blue-600">
                        {formatMoney(totalAmount)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
            
            <button
              onClick={() => setShowBooking(true)}
              className="w-full mt-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              + 新建预约
            </button>
          </div>

          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl p-5 text-white">
            <h3 className="font-semibold mb-2">快速指南</h3>
            <ul className="text-sm text-blue-100 space-y-1">
              <li>• 点击日历中的空白日期可快速预约</li>
              <li>• 选择设备和人员后需支付押金确认</li>
              <li>• 押金未支付的预约将在12小时后自动取消</li>
              <li>• 如需改期请提前24小时操作</li>
            </ul>
          </div>
        </div>
      </div>

      {showBooking && (
        <BookingModal
          isOpen={showBooking}
          initialStudioId={initialStudioId}
          initialDate={initialDate}
          onClose={() => setShowBooking(false)}
          onSuccess={() => setShowBooking(false)}
        />
      )}

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
