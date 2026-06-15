import { useState } from 'react';
import { AppStateProvider, useAppState } from './context/AppStateContext';
import Header from './components/Header';
import CalendarPage from './pages/CalendarPage';
import OrderList from './pages/OrderList';
import EquipmentPage from './pages/EquipmentPage';
import MaintenancePage from './pages/MaintenancePage';
import PhotographerView from './pages/PhotographerView';
import FinanceView from './pages/FinanceView';
import ScenariosPage from './pages/ScenariosPage';


function AppContent() {
  const { state } = useAppState();
  const { currentRole } = state;
  
  const [currentView, setCurrentView] = useState('calendar');

  const renderView = () => {
    if (currentRole === 'photographer') {
      switch (currentView) {
        case 'calendar':
          return <PhotographerView />;
        case 'mybookings':
          return <OrderList filter="active" />;
        default:
          return <PhotographerView />;
      }
    }
    
    if (currentRole === 'finance') {
      switch (currentView) {
        case 'deposits':
        case 'settlements':
        case 'invoices':
          return <FinanceView />;
        default:
          return <FinanceView />;
      }
    }
    
    switch (currentView) {
      case 'calendar':
        return <CalendarPage />;
      case 'orders':
        return <OrderList />;
      case 'equipment':
        return <EquipmentPage />;
      case 'maintenance':
        return <MaintenancePage />;
      case 'scenarios':
        return <ScenariosPage />;
      default:
        return <CalendarPage />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Header currentView={currentView} onViewChange={setCurrentView} />
      <main className="max-w-7xl mx-auto">
        {renderView()}
      </main>
    </div>
  );
}

function App() {
  return (
    <AppStateProvider>
      <AppContent />
    </AppStateProvider>
  );
}

export default App;
