import { useState } from 'react';
import Race from './screens/Race';
import Receipt from './screens/Receipt';
import Jar from './screens/Jar';
import Grant from './screens/Grant';
import './App.css';

export default function App() {
  const [screen, setScreen] = useState('race');
  const [warrantId, setWarrantId] = useState(null);

  return (
    <div className="app">
      <nav className="nav">
        {['race', 'grant', 'receipt', 'jar'].map((s) => (
          <button
            key={s}
            type="button"
            className={screen === s ? 'active' : ''}
            onClick={() => setScreen(s)}
          >
            {s}
          </button>
        ))}
      </nav>
      {screen === 'race' && (
        <Race warrantId={warrantId} onWarrantId={setWarrantId} onGoto={setScreen} />
      )}
      {screen === 'grant' && <Grant warrantId={warrantId} onGoto={setScreen} />}
      {screen === 'receipt' && <Receipt warrantId={warrantId} onGoto={setScreen} />}
      {screen === 'jar' && <Jar onGoto={setScreen} />}
    </div>
  );
}
