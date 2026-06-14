import { OrderStatus, Role } from '../types';

export function getStatusLabel(status: OrderStatus): string {
  const labels: Record<OrderStatus, string> = {
    temp: '临时占用',
    pending_deposit: '待付押金',
    deposit_confirmed: '押金已付',
    confirmed: '已确认',
    in_progress: '进行中',
    completed: '已完成',
    cancelled: '已取消',
    expired: '已过期',
  };
  return labels[status];
}

export function getStatusColor(status: OrderStatus): string {
  const colors: Record<OrderStatus, string> = {
    temp: 'bg-gray-100 text-gray-700 border-gray-300',
    pending_deposit: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    deposit_confirmed: 'bg-blue-100 text-blue-700 border-blue-300',
    confirmed: 'bg-green-100 text-green-700 border-green-300',
    in_progress: 'bg-purple-100 text-purple-700 border-purple-300',
    completed: 'bg-gray-100 text-gray-600 border-gray-300',
    cancelled: 'bg-red-100 text-red-700 border-red-300',
    expired: 'bg-gray-100 text-gray-500 border-gray-200',
  };
  return colors[status];
}

export function getRoleLabel(role: Role): string {
  const labels: Record<Role, string> = {
    operator: '运营',
    photographer: '摄影师',
    finance: '财务',
  };
  return labels[role];
}

export function getRoleColor(role: Role): string {
  const colors: Record<Role, string> = {
    operator: 'bg-indigo-500',
    photographer: 'bg-emerald-500',
    finance: 'bg-amber-500',
  };
  return colors[role];
}

export function getDepositChannelLabel(channel?: string): string {
  if (!channel) return '-';
  const labels: Record<string, string> = {
    alipay: '支付宝',
    wechat: '微信',
    bank: '银行转账',
    cash: '现金',
  };
  return labels[channel] || channel;
}
