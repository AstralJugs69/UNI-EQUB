import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { ContributionObligationRecord, GroupRecord, MembershipRecord, RoundRecord, SimulationCommand, SimulationDevice, SimulationSnapshot, UserRecord } from './types';
import './styles.css';

type UnknownRecord = Record<string, unknown>;

const emptySnapshot: SimulationSnapshot = {
  generatedAt: new Date(0).toISOString(),
  groups: [],
  rounds: [],
  memberships: [],
  users: [],
  obligations: [],
  transactions: [],
  events: [],
};

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' ? value as UnknownRecord : {};
}

function unwrapSnapshotResponse(value: unknown): SimulationSnapshot {
  const root = asRecord(value);
  const data = asRecord(root.data ?? root);
  const candidate = asRecord(data.snapshot ?? root.snapshot ?? data);
  return {
    generatedAt: typeof candidate.generatedAt === 'string' ? candidate.generatedAt : new Date().toISOString(),
    groups: Array.isArray(candidate.groups) ? candidate.groups as GroupRecord[] : [],
    rounds: Array.isArray(candidate.rounds) ? candidate.rounds as RoundRecord[] : [],
    memberships: Array.isArray(candidate.memberships) ? candidate.memberships as MembershipRecord[] : [],
    users: Array.isArray(candidate.users) ? candidate.users as UserRecord[] : [],
    obligations: Array.isArray(candidate.obligations) ? candidate.obligations as ContributionObligationRecord[] : [],
    transactions: Array.isArray(candidate.transactions) ? candidate.transactions as Array<Record<string, unknown>> : [],
    events: Array.isArray(candidate.events) ? candidate.events as SimulationSnapshot['events'] : [],
  };
}

function unwrapResultResponse(value: unknown) {
  const root = asRecord(value);
  const data = asRecord(root.data ?? root);
  const result = asRecord(data.result ?? root.result ?? data);
  return {
    message: typeof result.message === 'string' ? result.message : 'Simulation action completed.',
    snapshot: result.snapshot ? unwrapSnapshotResponse({ snapshot: result.snapshot }) : null,
  };
}

class ErrorBoundary extends React.Component<React.PropsWithChildren, { error: string }> {
  state = { error: '' };

  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) };
  }

  render() {
    if (this.state.error) {
      return (
        <main className="shell">
          <section className="panel errorPanel">
            <h1>Controller UI recovered</h1>
            <p>{this.state.error}</p>
            <button onClick={() => window.location.reload()}>Reload Controller</button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}

function makeCommand(type: string, payload: Record<string, unknown>): SimulationCommand {
  return {
    id: `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    payload,
    issuedAt: new Date().toISOString(),
  };
}

function formatMoney(value: number) {
  return `${Number(value ?? 0).toLocaleString()} ETB`;
}

function timeLeft(deadline?: string | null) {
  if (!deadline) {
    return 'not scheduled';
  }
  const remainingMs = new Date(deadline).getTime() - Date.now();
  if (!Number.isFinite(remainingMs)) {
    return 'not scheduled';
  }
  if (remainingMs <= 0) {
    return 'due now';
  }
  const hours = Math.ceil(remainingMs / 3_600_000);
  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  return days ? `${days}d ${rest}h` : `${hours}h`;
}

function memberName(users: UserRecord[], userId: string) {
  return users.find(user => user.User_ID === userId)?.Full_Name ?? userId.slice(0, 8);
}

function currentRound(snapshot: SimulationSnapshot | null, groupId: string) {
  return snapshot?.rounds
    .filter(round => round.Group_ID === groupId && round.Status === 'Open')
    .sort((a, b) => Number(b.Round_Number) - Number(a.Round_Number))[0] ?? null;
}

function groupMembers(snapshot: SimulationSnapshot | null, groupId: string) {
  return snapshot?.memberships.filter(membership => membership.Group_ID === groupId && membership.Status === 'Active') ?? [];
}

function roundObligations(snapshot: SimulationSnapshot | null, round: RoundRecord | null) {
  return round ? snapshot?.obligations.filter(obligation => obligation.round_id === round.Round_ID) ?? [] : [];
}

function firstDeadline(obligations: ContributionObligationRecord[]) {
  const times = obligations
    .filter(obligation => !['Paid', 'Waived', 'RefundPending'].includes(obligation.status))
    .map(obligation => obligation.due_at)
    .filter((value): value is string => !!value)
    .map(value => new Date(value).getTime())
    .filter(Number.isFinite);
  return times.length ? new Date(Math.min(...times)).toISOString() : null;
}

function App() {
  const [devices, setDevices] = useState<SimulationDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [snapshot, setSnapshot] = useState<SimulationSnapshot | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [drawSeed, setDrawSeed] = useState('');
  const [skipDays, setSkipDays] = useState(1);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [adminToken, setAdminToken] = useState('');
  const [adminName, setAdminName] = useState('');
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const selectedDevice = useMemo(() => devices.find(device => device.id === selectedDeviceId) ?? devices[0], [devices, selectedDeviceId]);
  const selectedGroup = useMemo(() => snapshot?.groups.find(group => group.Group_ID === selectedGroupId) ?? snapshot?.groups[0] ?? null, [selectedGroupId, snapshot?.groups]);
  const round = useMemo(() => selectedGroup ? currentRound(snapshot, selectedGroup.Group_ID) : null, [selectedGroup, snapshot]);
  const members = useMemo(() => selectedGroup ? groupMembers(snapshot, selectedGroup.Group_ID) : [], [selectedGroup, snapshot]);
  const obligations = useMemo(() => roundObligations(snapshot, round), [round, snapshot]);
  const selectedUser = selectedUserId || members[0]?.User_ID || '';
  const paidCount = obligations.filter(obligation => ['Paid', 'Waived', 'RefundPending'].includes(obligation.status)).length;
  const deadline = firstDeadline(obligations);

  function appendLog(line: string) {
    setLog(current => [`${new Date().toLocaleTimeString()} - ${line}`, ...current].slice(0, 12));
  }

  async function refreshDevices() {
    try {
      const next = await window.uniequbController.listDevices();
      setDevices(next);
      if (!selectedDeviceId && next[0]) {
        setSelectedDeviceId(next[0].id);
      }
    } catch (error) {
      appendLog(`ADB scan failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function refreshSnapshot(token = adminToken) {
    if (!token) {
      return;
    }
    try {
      const response = await window.uniequbController.getSnapshot(token);
      const nextSnapshot = unwrapSnapshotResponse(response);
      setSnapshot(nextSnapshot);
      if (!selectedGroupId && nextSnapshot.groups[0]) {
        setSelectedGroupId(nextSnapshot.groups[0].Group_ID);
      }
      appendLog(`Loaded ${nextSnapshot.groups.length} active group(s).`);
    } catch (error) {
      setSnapshot(emptySnapshot);
      appendLog(`Group load failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  useEffect(() => {
    refreshDevices();
    const timer = window.setInterval(refreshDevices, 5000);
    return () => window.clearInterval(timer);
  }, []);

  async function login() {
    setBusy(true);
    try {
      const session = await window.uniequbController.loginAdmin({ phoneNumber, password });
      setAdminToken(session.token);
      setAdminName(session.user.fullName);
      appendLog(`Signed in as ${session.user.fullName}.`);
      await refreshSnapshot(session.token);
    } catch (error) {
      appendLog(`Admin login failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function launchSelected() {
    if (!selectedDevice) {
      return;
    }
    setBusy(true);
    try {
      await window.uniequbController.launchApp(selectedDevice.id);
      appendLog(`Launched UniEqub on ${selectedDevice.id}.`);
      await refreshDevices();
    } finally {
      setBusy(false);
    }
  }

  async function refreshApp(groupId?: string) {
    if (!selectedDevice) {
      return;
    }
    const command = groupId
      ? makeCommand('SelectActiveGroup', { groupId, entityType: 'EqubGroup', entityId: groupId })
      : makeCommand('Refresh', {});
    await window.uniequbController.sendCommand(selectedDevice.id, command);
  }

  async function runAction(action: string, extra: Record<string, unknown> = {}) {
    if (!adminToken || !selectedGroup) {
      appendLog('Select an active group and sign in as admin first.');
      return;
    }
    setBusy(true);
    try {
      const command = makeCommand('BackendLifecycle', {
        action,
        groupId: selectedGroup.Group_ID,
        entityType: 'EqubGroup',
        entityId: selectedGroup.Group_ID,
        ...extra,
      });
      const response = unwrapResultResponse(await window.uniequbController.runBackendCommand(adminToken, command));
      setSnapshot(response.snapshot ?? snapshot);
      appendLog(response.message);
      await refreshApp(selectedGroup.Group_ID);
    } catch (error) {
      appendLog(`Action failed: ${error instanceof Error ? error.message : String(error)}`);
      await refreshApp(selectedGroup.Group_ID);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Active-group lifecycle controller</p>
          <h1>UniEqub Simulation Control</h1>
          <p>Operate active Equb groups, record simulated contributions, advance due dates, and refresh connected Android devices through ADB.</p>
        </div>
        <button onClick={() => refreshSnapshot()} disabled={!adminToken || busy}>Refresh Groups</button>
      </section>

      <section className="grid">
        <div className="panel">
          <div className="panelHeader">
            <h2>Admin access</h2>
            <span>{adminName || 'required'}</span>
          </div>
          <label>
            Admin phone
            <input value={phoneNumber} onChange={event => setPhoneNumber(event.target.value)} placeholder="+251..." />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Admin password" />
          </label>
          <button onClick={login} disabled={busy || !phoneNumber || !password}>Sign In And Load Groups</button>
        </div>

        <div className="panel">
          <div className="panelHeader">
            <h2>ADB devices</h2>
            <span>{devices.length} target(s)</span>
          </div>
          <div className="deviceList">
            {devices.length ? devices.map(device => (
              <button key={device.id} className={`device ${selectedDevice?.id === device.id ? 'selected' : ''}`} onClick={() => setSelectedDeviceId(device.id)}>
                <strong>{device.model || device.id}</strong>
                <span>{device.id}</span>
                <em>{device.authorized ? device.appRunning ? 'running' : 'installed' : 'unauthorized'}</em>
              </button>
            )) : <p className="empty">No ADB-visible UniEqub devices yet.</p>}
          </div>
          <button className="secondary" onClick={launchSelected} disabled={!selectedDevice || busy}>Launch UniEqub</button>
        </div>

        <div className="panel wide">
          <div className="panelHeader">
            <h2>Active groups</h2>
            <span>{snapshot?.groups.length ?? 0} active</span>
          </div>
          <div className="groupGrid">
            {snapshot?.groups.length ? snapshot.groups.map((group: GroupRecord) => {
              const groupRound = currentRound(snapshot, group.Group_ID);
              const groupObligations = roundObligations(snapshot, groupRound);
              const groupPaidCount = groupObligations.filter(obligation => ['Paid', 'Waived', 'RefundPending'].includes(obligation.status)).length;
              return (
                <button key={group.Group_ID} className={`groupCard ${selectedGroup?.Group_ID === group.Group_ID ? 'selected' : ''}`} onClick={() => setSelectedGroupId(group.Group_ID)}>
                  <strong>{group.Group_Name}</strong>
                  <span>{formatMoney(group.Amount)} - {group.Frequency}</span>
                  <em>{groupPaidCount}/{groupObligations.length || group.Max_Members} paid - {timeLeft(firstDeadline(groupObligations))}</em>
                </button>
              );
            }) : <p className="empty">No active groups found. The simulator intentionally ignores forming, frozen, rejected, and completed groups.</p>}
          </div>
        </div>

        <div className="panel">
          <div className="panelHeader">
            <h2>Selected group</h2>
            <span>{selectedGroup?.Status ?? 'none'}</span>
          </div>
          {selectedGroup ? (
            <div className="facts">
              <p><strong>{selectedGroup.Group_Name}</strong></p>
              <p>Round {round?.Round_Number ?? '-'} - {paidCount}/{obligations.length || members.length} paid</p>
              <p>Deadline: {timeLeft(deadline)}</p>
              <p>Draw seed: {drawSeed || 'not recorded'}</p>
            </div>
          ) : <p className="empty">Pick an active group.</p>}
          <button className="secondary" onClick={() => selectedGroup && refreshApp(selectedGroup.Group_ID)} disabled={!selectedDevice || !selectedGroup}>Open On Device</button>
        </div>

        <div className="panel">
          <div className="panelHeader">
            <h2>Members and payments</h2>
            <span>{members.length} members</span>
          </div>
          <label>
            Member
            <select value={selectedUser} onChange={event => setSelectedUserId(event.target.value)}>
              {members.map((membership: MembershipRecord) => (
                <option key={membership.User_ID} value={membership.User_ID}>{memberName(snapshot?.users ?? [], membership.User_ID)}</option>
              ))}
            </select>
          </label>
          <button onClick={() => runAction('createTestPayment', { userId: selectedUser, method: 'Simulation' })} disabled={!selectedUser || busy}>Pay For Member</button>
          <button className="secondary" onClick={() => runAction('removeMember', { userId: selectedUser })} disabled={!selectedUser || busy}>Remove Member</button>
        </div>

        <div className="panel">
          <div className="panelHeader">
            <h2>Lifecycle levers</h2>
            <span>active only</span>
          </div>
          <label>
            Skip time
            <select value={skipDays} onChange={event => setSkipDays(Number(event.target.value))}>
              <option value={1}>1 day</option>
              <option value={2}>2 days</option>
            </select>
          </label>
          <button onClick={() => runAction('skipTime', { days: skipDays })} disabled={busy}>Skip Time</button>
          <label>
            Draw winning seed
            <input value={drawSeed} onChange={event => setDrawSeed(event.target.value)} placeholder="Seed / witness note" />
          </label>
          <button className="secondary" onClick={() => runAction('recordDrawSeed', { drawSeed })} disabled={busy || !drawSeed}>Record Draw Seed</button>
          <button className="secondary" onClick={() => runAction('finalizeRound', { drawSeed, winnerUserId: selectedUser || undefined })} disabled={busy || !selectedUser}>Finalize With Winner</button>
        </div>

        <div className="panel wide">
          <div className="panelHeader">
            <h2>Activity</h2>
            <span>latest</span>
          </div>
          <div className="log">{log.map((line, index) => <p key={`${line}-${index}`}>{line}</p>)}</div>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<ErrorBoundary><App /></ErrorBoundary>);
