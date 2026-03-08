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
