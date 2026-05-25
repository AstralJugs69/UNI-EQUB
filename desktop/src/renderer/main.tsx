import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { ContributionObligationRecord, GroupRecord, MembershipRecord, RoundRecord, SimulationCommand, SimulationDevice, SimulationSnapshot, UserRecord, WinnerExitWindowRecord } from './types';
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
  groupRequests: [],
  joinRequests: [],
  freezeEvents: [],
  resolutionPolls: [],
  winnerExitWindows: [],
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
    groupRequests: Array.isArray(candidate.groupRequests) ? candidate.groupRequests as Array<Record<string, unknown>> : [],
    joinRequests: Array.isArray(candidate.joinRequests) ? candidate.joinRequests as Array<Record<string, unknown>> : [],
    freezeEvents: Array.isArray(candidate.freezeEvents) ? candidate.freezeEvents as Array<Record<string, unknown>> : [],
    resolutionPolls: Array.isArray(candidate.resolutionPolls) ? candidate.resolutionPolls as Array<Record<string, unknown>> : [],
    winnerExitWindows: Array.isArray(candidate.winnerExitWindows) ? candidate.winnerExitWindows as WinnerExitWindowRecord[] : [],
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

function memberObligation(obligations: ContributionObligationRecord[], userId: string) {
  return obligations.find(obligation => obligation.user_id === userId) ?? null;
}

function statusTone(status?: string | null) {
  switch (status) {
    case 'Paid':
    case 'Waived':
    case 'RefundPending':
      return 'good';
    case 'Late':
      return 'warn';
    case 'Defaulted':
      return 'bad';
    default:
      return 'neutral';
  }
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
  const [formName, setFormName] = useState('Controller Demo Equb');
  const [formAmount, setFormAmount] = useState(650);
  const [formMaxMembers, setFormMaxMembers] = useState(5);
  const [formFrequency, setFormFrequency] = useState('Weekly');
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
  const selectableMembers = useMemo(() => snapshot?.users.filter(user => user.Role === 'Member' && user.KYC_Status === 'Verified') ?? [], [snapshot?.users]);
  const selectedGroupIsActive = selectedGroup?.Status === 'Active';
  const paidCount = obligations.filter(obligation => ['Paid', 'Waived', 'RefundPending'].includes(obligation.status)).length;
  const deadline = firstDeadline(obligations);
  const winnerExitWindow = selectedGroup
    ? snapshot?.winnerExitWindows.find(window => window.group_id === selectedGroup.Group_ID && window.status === 'Open') ?? null
    : null;

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
    const needsGroup = !['formActiveGroup', 'formJoinWindowGroup'].includes(action);
    if (!adminToken || (needsGroup && !selectedGroup)) {
      appendLog(needsGroup ? 'Select a group and sign in as admin first.' : 'Sign in as admin first.');
      return;
    }
    setBusy(true);
    try {
      const command = makeCommand('BackendLifecycle', {
        action,
        ...(selectedGroup ? { groupId: selectedGroup.Group_ID } : {}),
        entityType: 'EqubGroup',
        ...(selectedGroup ? { entityId: selectedGroup.Group_ID } : {}),
        ...extra,
      });
      const response = unwrapResultResponse(await window.uniequbController.runBackendCommand(adminToken, command));
      setSnapshot(response.snapshot ?? snapshot);
      appendLog(response.message);
      if (selectedGroup) {
        await refreshApp(selectedGroup.Group_ID);
      } else if (selectedDevice) {
        await window.uniequbController.sendCommand(selectedDevice.id, makeCommand('Refresh', {}));
      }
    } catch (error) {
      appendLog(`Action failed: ${error instanceof Error ? error.message : String(error)}`);
      if (selectedGroup) {
        await refreshApp(selectedGroup.Group_ID);
      } else if (selectedDevice) {
        await window.uniequbController.sendCommand(selectedDevice.id, makeCommand('Refresh', {}));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">High-authority lifecycle controller</p>
          <h1>UniEqub Simulation Control</h1>
          <p>Form, activate, freeze, poll, disband, and manipulate Equb groups while connected Android devices reload from database truth through ADB.</p>
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
            <h2>Groups</h2>
            <span>{snapshot?.groups.length ?? 0} total</span>
          </div>
          <div className="groupGrid">
            {snapshot?.groups.length ? snapshot.groups.map((group: GroupRecord) => {
              const groupRound = currentRound(snapshot, group.Group_ID);
              const groupObligations = roundObligations(snapshot, groupRound);
              const groupPaidCount = groupObligations.filter(obligation => ['Paid', 'Waived', 'RefundPending'].includes(obligation.status)).length;
              const groupWinnerExitWindow = snapshot?.winnerExitWindows.find(window => window.group_id === group.Group_ID && window.status === 'Open');
              return (
                <button key={group.Group_ID} className={`groupCard ${selectedGroup?.Group_ID === group.Group_ID ? 'selected' : ''}`} onClick={() => setSelectedGroupId(group.Group_ID)}>
                  <strong>{group.Group_Name}</strong>
                  <span>{formatMoney(group.Amount)} - {group.Frequency}</span>
                  <em>{groupWinnerExitWindow ? 'Winner decision' : group.Status} - {groupPaidCount}/{groupObligations.length || group.Max_Members} paid - {groupWinnerExitWindow ? timeLeft(groupWinnerExitWindow.closes_at) : timeLeft(firstDeadline(groupObligations))}</em>
                </button>
              );
            }) : <p className="empty">No groups found. Use the controller formation panel or the seeding engine to create one.</p>}
          </div>
        </div>

        <div className="panel wide controlDeck">
          <div className="panelHeader">
            <h2>Formation authority</h2>
            <span>{selectableMembers.length} verified member(s)</span>
          </div>
          <div className="formGrid">
            <label>
              Group name
              <input value={formName} onChange={event => setFormName(event.target.value)} />
            </label>
            <label>
              Contribution
              <input type="number" min={1} value={formAmount} onChange={event => setFormAmount(Number(event.target.value))} />
            </label>
            <label>
              Max members
              <input type="number" min={2} max={20} value={formMaxMembers} onChange={event => setFormMaxMembers(Number(event.target.value))} />
            </label>
            <label>
              Frequency
              <select value={formFrequency} onChange={event => setFormFrequency(event.target.value)}>
                <option>Daily</option>
                <option>Weekly</option>
                <option>Bi-weekly</option>
                <option>Monthly</option>
              </select>
            </label>
          </div>
          <div className="buttonRow">
            <button onClick={() => runAction('formActiveGroup', { groupName: formName, amount: formAmount, maxMembers: formMaxMembers, frequency: formFrequency })} disabled={busy || selectableMembers.length < 2}>Form Active Group</button>
            <button className="secondary" onClick={() => runAction('formJoinWindowGroup', { groupName: formName, amount: formAmount, maxMembers: formMaxMembers, frequency: formFrequency })} disabled={busy || selectableMembers.length < 2}>Form Join-Window Group</button>
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
              <p>{winnerExitWindow ? 'Winner exit window' : 'Deadline'}: {timeLeft(winnerExitWindow?.closes_at ?? deadline)}</p>
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
          <button onClick={() => runAction('createTestPayment', { userId: selectedUser, method: 'Simulation' })} disabled={!selectedGroupIsActive || !selectedUser || busy}>Pay For Member</button>
          <button className="secondary" onClick={() => runAction('payAllMembers', { method: 'SimulationBatch' })} disabled={!selectedGroupIsActive || !members.length || busy}>Pay Everyone</button>
          <button className="secondary" onClick={() => runAction('payAllMembersAndContinue', { method: 'SimulationBatch' })} disabled={!selectedGroupIsActive || !members.length || busy}>Pay Everyone + Draw</button>
          <button className="dangerGhost" onClick={() => runAction('removeMember', { userId: selectedUser })} disabled={!selectedUser || busy}>Remove Member</button>
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
          <button onClick={() => runAction('skipTime', { days: skipDays })} disabled={!selectedGroupIsActive || busy}>Skip Time</button>
          <label>
            Draw winning seed
            <input value={drawSeed} onChange={event => setDrawSeed(event.target.value)} placeholder="Seed / witness note" />
          </label>
          <button className="secondary" onClick={() => runAction('recordDrawSeed', { drawSeed })} disabled={!selectedGroupIsActive || busy || !drawSeed}>Record Draw Seed</button>
          <button className="secondary" onClick={() => runAction('finalizeRound', { drawSeed, winnerUserId: selectedUser || undefined })} disabled={!selectedGroupIsActive || busy || !selectedUser}>Finalize With Winner</button>
        </div>

        <div className="panel wide controlDeck">
          <div className="panelHeader">
            <h2>High-authority group controls</h2>
            <span>database-backed</span>
          </div>
          <div className="controlGrid">
            <div className="controlCard">
              <h3>State override</h3>
              <p>Force the selected group through major lifecycle states without going through member/admin screens.</p>
              <button onClick={() => runAction('activateGroupNow')} disabled={!selectedGroup || busy}>Activate Now</button>
              <button className="secondary" onClick={() => runAction('freezeGroup')} disabled={!selectedGroup || busy}>Freeze Group</button>
              <button className="dangerGhost" onClick={() => runAction('disbandGroup')} disabled={!selectedGroup || busy}>Disband + Refund Tickets</button>
            </div>
            <div className="controlCard">
              <h3>Batch contribution paths</h3>
              <p>Use these to put a whole active group into realistic payment states without tapping through every phone.</p>
              <button onClick={() => runAction('payAllMembers', { method: 'SimulationBatch' })} disabled={!selectedGroupIsActive || !members.length || busy}>Pay Everyone</button>
              <button onClick={() => runAction('payAllMembersAndContinue', { method: 'SimulationBatch' })} disabled={!selectedGroupIsActive || !members.length || busy}>Pay Everyone And Continue Draw</button>
            </div>
            <div className="controlCard">
              <h3>Hold one member back</h3>
              <p>Pay everyone except the selected member, then optionally open their grace period so late/default handling can be tested.</p>
              <button onClick={() => runAction('payAllExceptMember', { userId: selectedUser, method: 'SimulationBatch' })} disabled={!selectedGroupIsActive || !selectedUser || busy}>Pay All Except Selected</button>
              <button onClick={() => runAction('payAllExceptMemberAndContinue', { userId: selectedUser, method: 'SimulationBatch' })} disabled={!selectedGroupIsActive || !selectedUser || busy}>Pay All Except Selected + Start Grace</button>
            </div>
            <div className="controlCard">
              <h3>Polling and recovery</h3>
              <p>Jump straight into a frozen-group vote, close it, or resolve a frozen case from the controller.</p>
              <button onClick={() => runAction('forceResolutionPoll')} disabled={!selectedGroup || busy}>Freeze + Open Poll</button>
              <button className="secondary" onClick={() => runAction('closeResolutionPoll')} disabled={!selectedGroup || busy}>Close Open Poll</button>
              <button className="secondary" onClick={() => runAction('resumeFrozenGroup')} disabled={!selectedGroup || busy}>Resume Frozen Group</button>
              <button className="dangerGhost" onClick={() => runAction('resolveFreezeRefund')} disabled={!selectedGroup || busy}>Resolve With Refund</button>
            </div>
            <div className="controlCard">
              <h3>Winner exit window</h3>
              <p>Control the post-draw winner choice. These actions only apply when an active group is waiting for the winner decision.</p>
              <button onClick={() => runAction('winnerExitContinue', { windowId: winnerExitWindow?.id })} disabled={!selectedGroupIsActive || !winnerExitWindow || busy}>Continue Next Round</button>
              <button className="secondary" onClick={() => runAction('expireWinnerExitWindow')} disabled={!selectedGroupIsActive || !winnerExitWindow || busy}>Expire Window</button>
              <button className="dangerGhost" onClick={() => runAction('winnerExitLeave', { windowId: winnerExitWindow?.id })} disabled={!selectedGroupIsActive || !winnerExitWindow || busy}>Exit Winner</button>
            </div>
            <div className="controlCard">
              <h3>Deadline and recovery</h3>
              <p>Push unpaid members into late/default states and let the app reload from the refreshed source-of-truth snapshot.</p>
              <button onClick={() => runAction('markRoundUnpaidLate')} disabled={!selectedGroupIsActive || !round || busy}>Mark Unpaid Late</button>
              <button onClick={() => runAction('defaultSelectedMember', { userId: selectedUser })} disabled={!selectedGroupIsActive || !selectedUser || busy}>Default Selected Now</button>
              <button className="secondary" onClick={() => runAction('processContributionDeadlines')} disabled={busy}>Run Deadline Sweep</button>
            </div>
          </div>
        </div>

        <div className="panel wide">
          <div className="panelHeader">
            <h2>Round roster</h2>
            <span>{paidCount}/{obligations.length || members.length} settled</span>
          </div>
          <div className="memberTable">
            {members.length ? members.map((membership: MembershipRecord) => {
              const obligation = memberObligation(obligations, membership.User_ID);
              const selected = selectedUser === membership.User_ID;
              return (
                <button key={membership.User_ID} className={`memberRow ${selected ? 'selected' : ''}`} onClick={() => setSelectedUserId(membership.User_ID)}>
                  <span>
                    <strong>{memberName(snapshot?.users ?? [], membership.User_ID)}</strong>
                    <small>{membership.User_ID}</small>
                  </span>
                  <em className={statusTone(obligation?.status)}>{obligation?.status ?? 'No obligation'}</em>
                  <small>{obligation?.due_at ? `Due ${timeLeft(obligation.due_at)}` : 'No deadline'}</small>
                </button>
              );
            }) : <p className="empty">No active members in the selected group.</p>}
          </div>
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
