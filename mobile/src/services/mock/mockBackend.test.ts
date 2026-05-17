import { MockBackend } from './mockBackend';

describe('MockBackend auth flow', () => {
  it('registers a new user and then allows login', async () => {
    const backend = new MockBackend();
    const pending = await backend.auth.register({
      fullName: 'Test Student',
      phoneNumber: '0911223344',
      password: 'secret123',
      studentIdImage: 'storage://students/test.png',
    });

    expect(pending.fullName).toBe('Test Student');
    expect(pending.kycStatus).toBe('Unverified');

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

  it('requires OTP to complete a normal login challenge', async () => {
    const backend = new MockBackend();
    const challenge = await backend.auth.beginLogin({ phoneNumber: '0911000000', password: 'demo1234' }, 'Member');
    expect(challenge.challengeToken).toContain('login-challenge-');

    const session = await backend.auth.completeLogin(challenge.challengeToken, '4719');
    expect(session.user.userId).toBe('user-dawit');
  });
});

describe('MockBackend automatic draw flow', () => {
  it('seeds the in-app demo queues and restores them after reset', async () => {
    const backend = new MockBackend();

    const memberSession = await backend.auth.login({ phoneNumber: '0911000000', password: 'demo1234' }, 'Member');
    expect(memberSession.user.userId).toBe('user-dawit');

    const adminSession = await backend.auth.login({ phoneNumber: '0999000000', password: 'admin1234' }, 'Admin');
    expect(adminSession.user.userId).toBe('user-admin');

    const publicRequests = await backend.formation.listPublic('user-dawit');
    expect(publicRequests.some(item => item.id === 'formation-demo-public')).toBe(true);

    const pendingBeforeApproval = await backend.formation.listPendingApproval();
    expect(pendingBeforeApproval.some(item => item.id === 'formation-demo-review')).toBe(true);

    await backend.formation.adminApprove('formation-demo-review');
    const pendingAfterApproval = await backend.formation.listPendingApproval();
    expect(pendingAfterApproval.some(item => item.id === 'formation-demo-review')).toBe(false);

    backend.reset();
    const pendingAfterReset = await backend.formation.listPendingApproval();
    expect(pendingAfterReset.some(item => item.id === 'formation-demo-review')).toBe(true);
  });

  it('supports the Phase 2 formation service contract before UI migration', async () => {
    const backend = new MockBackend();
    const created = await backend.formation.createRequest('user-dawit', {
      groupName: 'Phase 2 Formation Circle',
      description: 'Formation service contract coverage.',
      amount: 700,
      frequency: 'Weekly',
      minMembers: 2,
      maxMembers: 5,
      visibility: 'Public',
      termsVersion: 'phase2-v1',
    });

    expect(created.groupRequest.status).toBe('Forming');
    expect(created.accepted_participant_count).toBe(1);

    const publicRequests = await backend.formation.listPublic('user-miki');
    expect(publicRequests.some(item => item.id === created.groupRequest.id)).toBe(true);

    const creatorRequests = await backend.formation.listMine('user-dawit');
    expect(creatorRequests.some(item => item.id === created.groupRequest.id)).toBe(true);

    const joined = await backend.formation.requestJoin('user-miki', created.groupRequest.id, {
      groupTermsAccepted: true,
      acceptedTermsVersion: 'phase2-v1',
    });
    const joinRequest = joined.joinRequests.find(item => item.user_id === 'user-miki');
    expect(joinRequest?.status).toBe('Requested');

    const accepted = await backend.formation.acceptJoin('user-dawit', joinRequest!.id);
    expect(accepted.accepted_participant_count).toBe(2);

    const submitted = await backend.formation.submitForApproval('user-dawit', created.groupRequest.id);
    expect(submitted.groupRequest.status).toBe('PendingApproval');
  });

  it('supports private creator invitations through the Phase 2 formation service', async () => {
    const backend = new MockBackend();
    const created = await backend.formation.createRequest('user-dawit', {
      groupName: 'Private Formation Circle',
      amount: 600,
      frequency: 'Monthly',
      minMembers: 2,
      maxMembers: 4,
      visibility: 'Private',
      inviteMode: 'InviteCodeAndDirect',
      termsVersion: 'phase2-v1',
    });

    const response = await backend.formation.invite('user-dawit', {
      requestId: created.groupRequest.id,
      invitedPhoneOrStudentId: '0911000002',
    });

    expect(response.invitation.status).toBe('Pending');
    expect(response.detail.invitations.some(item => item.id === response.invitation.id)).toBe(true);
  });

  it('exposes pending Phase 2 formation requests for admin approval', async () => {
    const backend = new MockBackend();
    const created = await backend.formation.createRequest('user-dawit', {
      groupName: 'Admin Review Formation Circle',
      amount: 900,
      frequency: 'Weekly',
      minMembers: 2,
      maxMembers: 5,
      visibility: 'Public',
      termsVersion: 'phase2-v1',
    });
    const joined = await backend.formation.requestJoin('user-miki', created.groupRequest.id, {
      groupTermsAccepted: true,
      acceptedTermsVersion: 'phase2-v1',
    });
    const joinRequest = joined.joinRequests.find(item => item.user_id === 'user-miki');
    await backend.formation.acceptJoin('user-dawit', joinRequest!.id);
    await backend.formation.submitForApproval('user-dawit', created.groupRequest.id);

    const pending = await backend.formation.listPendingApproval();
    expect(pending.some(item => item.id === created.groupRequest.id)).toBe(true);

    const approvedGroup = await backend.formation.adminApprove(created.groupRequest.id);
    expect(approvedGroup.Status).toBe('Active');
  });

  it('keeps the legacy group creation request path pending during Phase 2 migration', async () => {
    const backend = new MockBackend();
    const group = await backend.groups.createRequest('user-dawit', {
      groupName: 'Legacy Dorm Equb',
      description: 'Compatibility path while Phase 2 formation UI is adopted.',
      amount: 750,
      frequency: 'Monthly',
      maxMembers: 6,
    });

    expect(group.Status).toBe('Pending');
    expect(group.Virtual_Acc_Ref).toBe('');

    const pending = await backend.groups.listPendingApprovals();
    expect(pending.some(item => item.group.Group_ID === group.Group_ID)).toBe(true);
  });

  it('creates a pending payout automatically when the last payment completes a round', async () => {
    const backend = new MockBackend();
    const result = await backend.payments.payContribution('user-dawit', 'group-dorm', 'Telebirr');
    expect(result.autoDrawTriggered).toBe(true);

    const wallet = await backend.payments.getWallet('user-dawit');
    expect(wallet.readyPayout).toBe(5000);

    const notifications = await backend.notifications.listForUser('user-dawit');
    expect(notifications.some(item => item.title === 'Winner selected automatically')).toBe(true);
  });

  it('blocks contribution payments after a group is frozen', async () => {
    const backend = new MockBackend();
    await backend.groups.freeze('group-dorm');
    await expect(backend.payments.payContribution('user-dawit', 'group-dorm', 'Telebirr')).rejects.toThrow(
      'Only active groups can accept contributions.',
    );
  });

  it('walks through a numbered USSD contribution session before reconciling payment', async () => {
    const backend = new MockBackend();

    const session = await backend.payments.startContributionUssd('user-dawit', 'group-dorm');
    expect(session.stage).toBe('AwaitMenu');

    const withReference = await backend.payments.submitContributionUssd('user-dawit', session.sessionId, '1');
    expect(withReference.stage).toBe('AwaitReference');

    const withAmount = await backend.payments.submitContributionUssd('user-dawit', session.sessionId, 'UEQ-0832');
    expect(withAmount.stage).toBe('AwaitAmount');

    const withConfirm = await backend.payments.submitContributionUssd('user-dawit', session.sessionId, '500');
    expect(withConfirm.stage).toBe('AwaitConfirm');

    const withPin = await backend.payments.submitContributionUssd('user-dawit', session.sessionId, '1');
    expect(withPin.stage).toBe('AwaitPin');

    const completed = await backend.payments.submitContributionUssd('user-dawit', session.sessionId, '123456');
    expect(completed.stage).toBe('Completed');
    expect(completed.paymentResult?.method).toBe('MockUSSD');

    const wallet = await backend.payments.getWallet('user-dawit');
    expect(wallet.readyPayout).toBe(5000);
  });
});
