import { useState } from 'react';
import { Toaster } from 'sonner';
import { Header } from './Header';
import { Pipeline } from '../pipeline/Pipeline';
import { Dashboard } from '../dashboard/Dashboard';
import { FunnelView } from '../funnel/FunnelView';
import { CalendarView } from '../calendar/CalendarView';
import { GridView } from '../grid/GridView';
import { ActivityLog } from '../activity/ActivityLog';
import { QuickCapture } from '../items/QuickCapture';
import { SpaceForm } from '../spaces/SpaceForm';
import { SettingsModal } from '../settings/SettingsModal';
import { useQuickCapture } from '../../hooks/useQuickCapture';
import type { View } from '../../types';

export function Layout() {
  const quickCapture = useQuickCapture();
  const [showSpaceForm, setShowSpaceForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [view, setView] = useState<View>('dashboard');

  const renderView = () => {
    switch (view) {
      case 'dashboard': return <Dashboard />;
      case 'kanban': return <Pipeline />;
      case 'funnel': return <FunnelView />;
      case 'calendar': return <CalendarView />;
      case 'grid': return <GridView />;
      case 'log': return <ActivityLog />;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-950">
      <Header
        onQuickCapture={quickCapture.open}
        onAddSpace={() => setShowSpaceForm(true)}
        onSettings={() => setShowSettings(true)}
        view={view}
        onViewChange={setView}
      />
      <main className="flex-1 overflow-hidden">
        {renderView()}
      </main>

      <QuickCapture isOpen={quickCapture.isOpen} onClose={quickCapture.close} />
      <SpaceForm isOpen={showSpaceForm} onClose={() => setShowSpaceForm(false)} />
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />

      <Toaster
        position="bottom-right"
        theme="system"
        toastOptions={{
          className: 'dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700',
        }}
      />
    </div>
  );
}
