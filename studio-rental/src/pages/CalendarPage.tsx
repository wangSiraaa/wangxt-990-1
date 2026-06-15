import { useState } from 'react';
import StudioCalendar from '../components/StudioCalendar';
import BookingModal from '../components/BookingModal';
import OrderDetailModal from '../components/OrderDetailModal';
import type { Order } from '../types';

export default function CalendarPage() {
  const [showBooking, setShowBooking] = useState(false);
  const [initialStudioId, setInitialStudioId] = useState('');
  const [initialDate, setInitialDate] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showDetail, setShowDetail] = useState(false);

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
        <h2 className="text-2xl font-bold text-gray-800">棚位日历</h2>
        <p className="text-gray-500 mt-1">查看各棚位档期情况，点击日期可新建预约</p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <StudioCalendar
          showBookingButton={true}
          onBookClick={handleBookClick}
          onOrderClick={handleOrderClick}
        />
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
