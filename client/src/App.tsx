import { MotionConfig } from 'framer-motion';
import { WifiOff } from 'lucide-react';
import { RulesModal } from './components/Rules';
import { Final } from './screens/Final';
import { Home } from './screens/Home';
import { Lobby } from './screens/Lobby';
import { Table } from './screens/Table';
import { useStore } from './store';

export function App() {
  const view = useStore((s) => s.view);
  const conn = useStore((s) => s.conn);
  const everConnected = useStore((s) => s.everConnected);
  const toast = useStore((s) => s.toast);

  // Les animations suivent la préférence du système : moins de mouvement si on l'a demandé.
  return (
    <MotionConfig reducedMotion="user">
      {!view ? <Home /> : view.phase === 'lobby' ? <Lobby view={view} /> : view.phase === 'finished' ? <Final view={view} /> : <Table view={view} />}
      <RulesModal />
      {view && conn !== 'online' && everConnected && (
        <div className="conn-banner" role="status">
          <WifiOff size={16} /> Connexion perdue : reconnexion en cours…
        </div>
      )}
      {toast && (
        <div key={toast.id} className={`toast is-${toast.tone}`} role="status" onClick={() => useStore.setState({ toast: null })}>
          {toast.text}
        </div>
      )}
    </MotionConfig>
  );
}
