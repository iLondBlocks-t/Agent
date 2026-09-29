import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuroraBackground } from '@/components/AuroraBackground';
import { ApprovalSheet } from '@/components/ApprovalSheet';
import { BottomNav } from '@/components/BottomNav';
import { Toast } from '@/components/Toast';
import { initNativeChannels } from '@/core/platform/native';
import { useStore } from '@/store/useStore';
import Agents from '@/screens/Agents';
import Dashboard from '@/screens/Dashboard';
import History from '@/screens/History';
import Projects from '@/screens/Projects';
import Providers from '@/screens/Providers';
import SettingsScreen from '@/screens/SettingsScreen';
import TaskScreen from '@/screens/TaskScreen';
import ToolsScreen from '@/screens/ToolsScreen';

export default function App() {
  const ready = useStore((s) => s.ready);
  const init = useStore((s) => s.init);
  const settings = useStore((s) => s.settings);
  const approvals = useStore((s) => s.approvals);
  const agents = useStore((s) => s.agents);
  const resolveApproval = useStore((s) => s.resolveApproval);

  useEffect(() => { void init(); void initNativeChannels(); }, [init]);

  useEffect(() => {
    const el = document.documentElement;
    el.dir = settings.language === 'ar' ? 'rtl' : 'ltr';
    el.lang = settings.language;
    document.body.classList.toggle('amoled', settings.amoled);
    document.body.classList.toggle('reduce-motion', settings.reduceMotion);
  }, [settings.language, settings.amoled, settings.reduceMotion]);

  const approval = approvals[0] ?? null;
  const agentName = agents.find((a) => a.id === approval?.agentId)?.name ?? 'وكيل';

  if (!ready) {
    return (
      <>
        <AuroraBackground />
        <div className="flex h-screen items-center justify-center">
          <div className="space-y-3 px-8 text-center">
            <div className="mx-auto h-14 w-14 animate-pulseGlow rounded-full grad-primary" />
            <p className="text-[15px] text-txt-lo">جارٍ التحميل…</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <HashRouter>
      <AuroraBackground />
      <Toast />
      <main className="mx-auto min-h-screen max-w-2xl">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/task/:id" element={<TaskScreen />} />
          <Route path="/agents" element={<Agents />} />
          <Route path="/providers" element={<Providers />} />
          <Route path="/tools" element={<ToolsScreen />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/history" element={<History />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <BottomNav />
      <ApprovalSheet approval={approval} agentName={agentName} onResolve={resolveApproval} />
    </HashRouter>
  );
}
