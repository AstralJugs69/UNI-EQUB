import { MockBackend } from './mockBackend';

async function createVerifiedMember(backend: MockBackend, phone = '0911223344') {
  const registration = await backend.auth.register({
    fullName: 'Test Student',
    email: `test-${phone.slice(-4)}@uniequb.test`,
    phoneNumber: phone,
    password: 'secret123',
    studentIdImage: 'storage://students/test.png',
  });
  const user = registration.user;
  await backend.kyc.approve(user.userId);
  return user;
}

describe('MockBackend seedless auth flow', () => {
  it('starts empty and restores empty state after reset', async () => {
    const backend = new MockBackend();
    await expect(backend.auth.login({ phoneNumber: '0911000000', password: 'demo1234' }, 'Member')).rejects.toThrow('Invalid email or password.');

    await createVerifiedMember(backend);
    expect((await backend.reports.getAdminOverview()).pendingKycCount).toBe(0);

    backend.reset();
    expect(await backend.reports.getAdminOverview()).toEqual(expect.objectContaining({
      pendingKycCount: 0,
      pendingGroupCount: 0,
      activeGroupCount: 0,
    }));
  });

  it('registers a new user and then allows login', async () => {
    const backend = new MockBackend();
    const pending = await backend.auth.register({
      fullName: 'Test Student',
      email: 'test-student@uniequb.test',
      phoneNumber: '0911223344',
      password: 'secret123',
      studentIdImage: 'storage://students/test.png',
    });

    expect(pending.user.fullName).toBe('Test Student');
    expect(pending.user.kycStatus).toBe('Unverified');

    const session = await backend.auth.login({ phoneNumber: '0911223344', password: 'secret123' }, 'Member');
    expect(session.user.fullName).toBe('Test Student');
    expect(session.token).toContain('session-');
  });

  it('issues and verifies OTP challenges for pending registration flows', async () => {
    const backend = new MockBackend();
    const challenge = await backend.auth.requestOtp('0911223344');
    expect(challenge.challengeId).toContain('otp-');

    await expect(backend.auth.verifyOtp('0911223344', '4719')).resolves.toEqual({ pendingKycToken: 'mock-pending-kyc-0911223344' });
    await expect(backend.auth.verifyOtp('0911223344', '0000')).rejects.toThrow('No OTP challenge is active for this number.');
  });

  it('requires OTP only for the first registered member during testing', async () => {
    const backend = new MockBackend();
    const first = await backend.auth.register({
      fullName: 'First Student',
      email: 'first-student@uniequb.test',
      phoneNumber: '0911223301',
      password: 'secret123',
      studentIdImage: 'storage://students/first.png',
    });
    const second = await backend.auth.register({
      fullName: 'Second Student',
      email: 'second-student@uniequb.test',
      phoneNumber: '0911223302',
      password: 'secret123',
      studentIdImage: 'storage://students/second.png',
    });

    expect(first.requiresOtp).toBe(true);
    expect(first.pendingKycToken).toBeUndefined();
    expect(second.requiresOtp).toBe(false);
    expect(second.pendingKycToken).toBe('mock-pending-kyc-0911223302');
  });

  it('exposes active groups and member KYC resubmission state only from explicit setup', async () => {
    const backend = new MockBackend();
    const member = await createVerifiedMember(backend);
    const group = await backend.groups.createRequest(member.userId, {
      groupName: 'Explicit Test Equb',
      description: 'Created inside the test.',
      amount: 650,
      frequency: 'Weekly',
      maxMembers: 5,
    });

    await backend.groups.approve(group.Group_ID);
    await backend.groups.joinGroup(member.userId, group.Group_ID);
    const dashboard = await backend.groups.getDashboard(member.userId);
    expect(dashboard.activeGroups.map(item => item.Group_ID)).toContain(group.Group_ID);
    expect(dashboard.kycState.status).toBe('Verified');

    await backend.kyc.requestResubmission(member.userId);
    const needsResubmission = await backend.groups.getDashboard(member.userId);
    expect(needsResubmission.kycState.status).toBe('NeedsResubmission');
    expect(needsResubmission.kycState.canSubmit).toBe(true);
  });

  it('supports explicit formation, account slots, avatars, announcements, and simulation events', async () => {
    const backend = new MockBackend();
    const creator = await createVerifiedMember(backend, '0911223300');
    const participant = await createVerifiedMember(backend, '0911223301');

    const created = await backend.formation.createRequest(creator.userId, {
      groupName: 'Seedless Formation Circle',
      amount: 700,
      frequency: 'Weekly',
      minMembers: 2,
      maxMembers: 5,
      visibility: 'Public',
      termsVersion: 'phase2-v1',
    });
    const joined = await backend.formation.requestJoin(participant.userId, created.groupRequest.id, {
      groupTermsAccepted: true,
      acceptedTermsVersion: 'phase2-v1',
    });
    const joinRequest = joined.joinRequests.find(item => item.user_id === participant.userId);
    await backend.formation.acceptJoin(creator.userId, joinRequest!.id);
    await backend.formation.submitForApproval(creator.userId, created.groupRequest.id);
    const group = await backend.formation.adminApprove(created.groupRequest.id);

    const announcement = await backend.announcements.create({
      groupId: group.Group_ID,
      title: 'Round checkpoint',
      body: 'Test announcement.',
      priority: 'High',
      pinned: true,
    });
    expect((await backend.announcements.listForGroup({ groupId: group.Group_ID }))[0].id).toBe(announcement.id);

    const session = await backend.auth.login({ phoneNumber: '0911223300', password: 'secret123' }, 'Member');
    await backend.accounts.saveCurrent(session);
    expect((await backend.accounts.listSlots())[0].displayName).toBe('Test Student');

    const avatar = await backend.profile.ensureAvatarSeed(creator.userId);
    expect(avatar.seed).toBe(creator.userId);

    const result = await backend.simulation.runCommand({
      id: 'cmd-test',
      type: 'Refresh',
      payload: { entityType: 'EqubGroup', entityId: group.Group_ID },
      issuedAt: new Date().toISOString(),
    });
    expect(result.ok).toBe(true);
    expect(result.snapshot?.events[0].commandType).toBe('Refresh');
  });
});
