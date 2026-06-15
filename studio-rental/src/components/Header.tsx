import { useAppState } from '../context/AppStateContext';
import type { Role } from '../types';
import { getRoleLabel, getRoleColor } from './StatusBadge';

interface HeaderProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

const roleViews: Record<Role, { id: string; label: string; icon: string }[]> = {
  operator: [
    { id: 'calendar', label: '棚位日历', icon: '📅' },
    { id: 'orders', label: '订单管理', icon: '📋' },
    { id: 'equipment', label: '设备管理', icon: '💡' },
    { id: 'maintenance', label: '维护计划', icon: '🔧' },
    { id: 'scenarios', label: '场景演示', icon: '🎬' },
  ],
  photographer: [
    { id: 'calendar', label: '可约档期', icon: '📅' },
    { id: 'mybookings', label: '我的预约', icon: '📋' },
  ],
  finance: [
    { id: 'deposits', label: '押金管理', icon: '💰' },
    { id: 'settlements', label: '结算对账', icon: '📊' },
    { id: 'invoices', label: '发票管理', icon: '🧾' },
  ],
};

export default function Header({ currentView, onViewChange }: HeaderProps) {
  const { state, setRole } = useAppState();
  const { currentRole } = state;

  const views = roleViews[currentRole];

  return (
    <header className="bg-slate-800 text-white shadow-lg">
      <div className="px-4 py-3 flex items-center justify-between border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="text-2xl">🎬</div>
          <div>
            <h1 className="text-lg font-bold">影棚租赁管理系统</h1>
            <p className="text-xs text-slate-400">Studio Rental System</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">角色:</span>
            <div className="flex gap-1">
              {(['operator', 'photographer', 'finance'] as Role[]).map(role => (
                <button
                  key={role}
                  onClick={() => setRole(role)}
                  className={`px-3 py-1.5 text-xs rounded-md font-medium transition-all ${
                    currentRole === role
                      ? `${getRoleColor(role)} text-white`
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {getRoleLabel(role)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <nav className="px-4 py-2 flex gap-1">
        {views.map(view => (
          <button
            key={view.id}
            onClick={() => onViewChange(view.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
              currentView === view.id
                ? 'bg-slate-700 text-white'
                : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
            }`}
          >
            <span>{view.icon}</span>
            <span>{view.label}</span>
          </button>
        ))}
      </nav>
    </header>
  );
}
