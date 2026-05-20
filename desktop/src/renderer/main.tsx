import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { SimulationCommand, SimulationDevice } from './types';
import './styles.css';

const commandTypes = [
  'Refresh',
  'Navigate',
  'SelectActiveGroup',
  'PaymentReturn',
  'ShowBanner',
  'SpeedTime',
  'BackendLifecycle',
];

function makeCommand(type: string, payload: Record<string, unknown>): SimulationCommand {
  return {
    id: `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    payload,
    issuedAt: new Date().toISOString(),
  };
}

function App() {
  const [devices, setDevices] = useState<SimulationDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [commandType, setCommandType] = useState('Refresh');
  const [groupId, setGroupId] = useState('');
  const [routeName, setRouteName] = useState('GroupStatus');
  const [message, setMessage] = useState('Simulation command received.');
  const [timeScale, setTimeScale] = useState(4);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const selectedDevice = useMemo(() => devices.find(device => device.id === selectedDeviceId) ?? devices[0], [devices, selectedDeviceId]);

  async function refreshDevices() {
    setBusy(true);
    try {
      const next = await window.uniequbController.listDevices();
      setDevices(next);
      if (!selectedDeviceId && next[0]) {
        setSelectedDeviceId(next[0].id);
      }
      setLog(current => [`Found ${next.length} UniEqub ADB target(s).`, ...current].slice(0, 8));
    } catch (error) {
      setLog(current => [`ADB scan failed: ${error instanceof Error ? error.message : String(error)}`, ...current].slice(0, 8));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    refreshDevices();
    const timer = window.setInterval(refreshDevices, 5000);
    return () => window.clearInterval(timer);
  }, []);

  async function launchSelected() {
    if (!selectedDevice) {
      return;
    }
    setBusy(true);
    try {
      await window.uniequbController.launchApp(selectedDevice.id);
      setLog(current => [`Launched UniEqub on ${selectedDevice.id}.`, ...current].slice(0, 8));
      await refreshDevices();
    } finally {
      setBusy(false);
    }
  }

  async function sendSelected() {
    if (!selectedDevice) {
      return;
    }
    const payload: Record<string, unknown> = {};
    if (groupId.trim()) {
      payload.groupId = groupId.trim();
      payload.entityType = 'EqubGroup';
      payload.entityId = groupId.trim();
    }
    if (commandType === 'Navigate') {
      payload.routeName = routeName;
      payload.params = groupId.trim() ? { groupId: groupId.trim() } : {};
    }
    if (commandType === 'ShowBanner' || commandType === 'SpeedTime') {
      payload.message = message;
    }
    if (commandType === 'SpeedTime') {
      payload.timeScale = timeScale;
    }
    if (commandType === 'BackendLifecycle') {
      payload.action = 'advanceClock';
      payload.offsetSeconds = timeScale * 60;
      payload.timeScale = timeScale;
    }

    const command = makeCommand(commandType, payload);
    setBusy(true);
    try {
      await window.uniequbController.sendCommand(selectedDevice.id, command);
      setLog(current => [`Sent ${commandType} to ${selectedDevice.id}.`, ...current].slice(0, 8));
    } catch (error) {
      setLog(current => [`Command failed: ${error instanceof Error ? error.message : String(error)}`, ...current].slice(0, 8));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">ADB lifecycle controller</p>
          <h1>UniEqub Simulation Control</h1>
          <p>Discover devices, launch the app, and push signed simulation commands without Android Studio.</p>
        </div>
        <button onClick={refreshDevices} disabled={busy}>Refresh ADB</button>
      </section>

      <section className="grid">
        <div className="panel">
          <div className="panelHeader">
            <h2>Devices</h2>
            <span>{devices.length} target(s)</span>
          </div>
          <div className="deviceList">
            {devices.length ? devices.map(device => (
              <button
                key={device.id}
                className={`device ${selectedDevice?.id === device.id ? 'selected' : ''}`}
                onClick={() => setSelectedDeviceId(device.id)}
              >
                <strong>{device.model || device.id}</strong>
                <span>{device.id}</span>
                <em>{device.authorized ? device.appRunning ? 'running' : 'installed' : 'unauthorized'}</em>
              </button>
            )) : <p className="empty">No ADB-visible UniEqub devices yet.</p>}
          </div>
          <button className="secondary" onClick={launchSelected} disabled={!selectedDevice || busy}>Launch UniEqub</button>
        </div>

        <div className="panel">
          <div className="panelHeader">
            <h2>Knobs</h2>
            <span>{selectedDevice?.id ?? 'no device'}</span>
          </div>
          <label>
            Command
            <select value={commandType} onChange={event => setCommandType(event.target.value)}>
              {commandTypes.map(type => <option key={type}>{type}</option>)}
            </select>
          </label>
          <label>
            Group ID
            <input value={groupId} onChange={event => setGroupId(event.target.value)} placeholder="Optional group UUID" />
          </label>
          <label>
            Route
            <input value={routeName} onChange={event => setRouteName(event.target.value)} />
          </label>
          <label>
            Message
            <input value={message} onChange={event => setMessage(event.target.value)} />
          </label>
          <label>
            Time scale
            <input type="range" min="1" max="24" value={timeScale} onChange={event => setTimeScale(Number(event.target.value))} />
            <span>{timeScale}x</span>
          </label>
          <button onClick={sendSelected} disabled={!selectedDevice || busy}>Send Command</button>
        </div>

        <div className="panel wide">
          <div className="panelHeader">
            <h2>Activity</h2>
            <span>latest</span>
          </div>
          <div className="log">
            {log.map((line, index) => <p key={`${line}-${index}`}>{line}</p>)}
          </div>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
