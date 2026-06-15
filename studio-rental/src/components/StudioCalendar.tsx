import { useState } from 'react';
import { useAppState } from '../context/AppStateContext';
import { getWeeksOfMonth, getMonthName, formatDate, formatTime, isSameDay } from '../utils/dateUtils';
import { getStatusColor } from './StatusBadge';
import type { Order } from '../types';
import { isStudioOnMaintenance } from '../store/storage';

interface StudioCalendarProps {
  onDateSelect?: (date: string, studioId: string) => void;
  onOrderClick?: (order: Order) => void;
  showBookingButton?: boolean;
  onBookClick?: (studioId: string, date: string) => void;
}

export default function StudioCalendar({ 
  onDateSelect, 
  onOrderClick, 
  showBookingButton = false,
  onBookClick 
}: StudioCalendarProps) {
  const { state } = useAppState();
  const { studios, orders, maintenanceDays, currentDate } = state;
  
  const [viewDate, setViewDate] = useState(new Date(currentDate));
  const [selectedStudioId, setSelectedStudioId] = useState<string | null>(studios[0]?.id || null);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const weeks = getWeeksOfMonth(year, month);

  const prevMonth = () => {
    setViewDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setViewDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setViewDate(new Date());
  };

  const getStudioOrdersForDate = (studioId: string, date: Date | null) => {
    if (!date) return [];
    const dateStr = formatDate(date);
    
    return orders.filter(order => {
      if (order.studioId !== studioId) return false;
      if (order.status === 'expired' || order.status === 'cancelled') return false;
      
      const startDate = order.startTime.slice(0, 10);
      const endDate = order.endTime.slice(0, 10);
      
      return dateStr >= startDate && dateStr <= endDate;
    });
  };

  const isToday = (date: Date | null) => {
    if (!date) return false;
    return isSameDay(date, new Date());
  };

  const isSelected = (date: Date | null) => {
    if (!date) return false;
    return formatDate(date) === formatDate(currentDate);
  };

  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={prevMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              ←
            </button>
            <h2 className="text-lg font-semibold min-w-[140px] text-center">
              {year}年 {getMonthName(month)}
            </h2>
            <button
              onClick={nextMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              →
            </button>
            <button
              onClick={goToToday}
              className="ml-2 px-3 py-1 text-sm bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors"
            >
              今天
            </button>
          </div>

          <div className="flex gap-2">
            {studios.map(studio => (
              <button
                key={studio.id}
                onClick={() => setSelectedStudioId(studio.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  selectedStudioId === studio.id
                    ? 'text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                style={selectedStudioId === studio.id ? { backgroundColor: studio.color } : {}}
              >
                {studio.name.split(' - ')[0]}
              </button>
            ))}
          </div>
        </div>

        {selectedStudioId && (
          <div className="text-sm text-gray-500">
            {studios.find(s => s.id === selectedStudioId)?.name}
          </div>
        )}
      </div>

      <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
        {weekDays.map((day, i) => (
          <div
            key={day}
            className={`py-2 text-center text-sm font-medium ${
              i === 0 || i === 6 ? 'text-red-500' : 'text-gray-600'
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      <div className="divide-y divide-gray-100">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7">
            {week.map((date, dayIndex) => {
              const ordersForDay = selectedStudioId
                ? getStudioOrdersForDate(selectedStudioId, date)
                : [];
              
              const onMaintenance = date && selectedStudioId
                ? isStudioOnMaintenance(maintenanceDays, selectedStudioId, date)
                : false;

              return (
                <div
                  key={dayIndex}
                  className={`min-h-[100px] p-1 border-r border-gray-100 last:border-r-0 ${
                    !date ? 'bg-gray-50' : 'hover:bg-blue-50/30 cursor-pointer'
                  } ${isSelected(date) ? 'bg-blue-50' : ''}`}
                  onClick={() => {
                    if (date && onDateSelect) {
                      onDateSelect(formatDate(date), selectedStudioId || '');
                    }
                  }}
                >
                  {date && (
                    <>
                      <div className="flex items-center justify-between">
                        <span
                          className={`inline-flex items-center justify-center w-7 h-7 text-sm rounded-full ${
                            isToday(date)
                              ? 'bg-blue-600 text-white font-bold'
                              : dayIndex === 0 || dayIndex === 6
                              ? 'text-red-500'
                              : 'text-gray-700'
                          }`}
                        >
                          {date.getDate()}
                        </span>
                        {onMaintenance && (
                          <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">
                            维护
                          </span>
                        )}
                      </div>

                      <div className="mt-1 space-y-1">
                        {ordersForDay.slice(0, 3).map(order => {
                          const isStartDay = isSameDay(order.startTime, date);
                          
                          return (
                            <div
                              key={order.id}
                              className={`text-xs px-1.5 py-0.5 rounded truncate cursor-pointer ${getStatusColor(order.status)} border`}
                              onClick={(e) => {
                                e.stopPropagation();
                                onOrderClick?.(order);
                              }}
                              title={`${order.customerName} - ${formatTime(order.startTime)} - ${formatTime(order.endTime)}`}
                            >
                              {isStartDay && (
                                <span className="opacity-70">{formatTime(order.startTime)} </span>
                              )}
                              {order.customerName}
                            </div>
                          );
                        })}
                        {ordersForDay.length > 3 && (
                          <div className="text-xs text-gray-400 px-1">
                            +{ordersForDay.length - 3} 更多
                          </div>
                        )}
                      </div>

                      {showBookingButton && !onMaintenance && ordersForDay.length === 0 && date >= new Date() && (
                        <button
                          className="w-full mt-1 text-xs py-1 bg-green-50 text-green-600 rounded hover:bg-green-100 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            onBookClick?.(selectedStudioId || '', formatDate(date));
                          }}
                        >
                          + 预约
                        </button>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="p-3 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-green-100 border border-green-300"></span>
            可预约
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-blue-100 border border-blue-300"></span>
            已确认
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-yellow-100 border border-yellow-300"></span>
            待付押金
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-purple-100 border border-purple-300"></span>
            进行中
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-orange-100 border border-orange-300"></span>
            维护日
          </span>
        </div>
      </div>
    </div>
  );
}
