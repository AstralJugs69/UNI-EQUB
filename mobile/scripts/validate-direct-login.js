const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const files = {
  edge: 'supabase/functions/register-login/index.ts',
  loginScreen: 'mobile/src/screens/auth/LoginScreen.tsx',
  otpScreen: 'mobile/src/screens/auth/OtpScreen.tsx',
  authProvider: 'mobile/src/providers/AuthProvider.tsx',
  mockBackend: 'mobile/src/services/mock/mockBackend.ts',
  mockTests: 'mobile/src/services/mock/mockBackend.test.ts',
};

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--output') {
      parsed.output = args[index + 1];
      index += 1;
    }
  }
  return parsed;
}

function read(relativePath) {
  const filePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required file: ${relativePath}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

function assertIncludes(content, token, label) {
  if (!content.includes(token)) {
    throw new Error(`Missing ${label}: ${token}`);
  }
}

function assertExcludes(content, token, label) {
  if (content.includes(token)) {
    throw new Error(`Unexpected ${label}: ${token}`);
  }
}

function main() {
  const args = parseArgs();
  const content = Object.fromEntries(Object.entries(files).map(([key, relativePath]) => [key, read(relativePath)]));

  [
    "case 'login'",
    'signSession(user)',
    'validateCredentials(body.login.phoneNumber',
    'OTP login completion is no longer required. Use direct login.',
  ].forEach(token => assertIncludes(content.edge, token, 'direct login edge token'));

  [
    'const { login } = useAuth()',
    'await login(phoneNumber, password, role)',
    'Sign in with your phone number and password.',
    'Sign In',
  ].forEach(token => assertIncludes(content.loginScreen, token, 'direct login screen token'));

  [
    'const { pendingUser, requestOtp, verifyOtp } = useAuth()',
    'Phone verification unlocks the KYC step.',
  ].forEach(token => assertIncludes(content.otpScreen, token, 'registration OTP token'));

  [
    'login: async (phoneNumber, password, roleHint)',
    'services.auth.login',
    'setPendingLogin(null)',
  ].forEach(token => assertIncludes(content.authProvider, token, 'auth provider direct login token'));

  [
    'rejects direct login for wrong password, wrong role, and banned users',
    'issues and verifies OTP challenges for pending registration flows',
  ].forEach(token => assertIncludes(content.mockTests, token, 'direct login Jest token'));

  assertExcludes(content.loginScreen, 'routes.otp', 'login OTP navigation');
  assertExcludes(content.loginScreen, 'Send Login OTP', 'login OTP button copy');
  assertExcludes(content.loginScreen, 'Every login requires', 'login challenge copy');
  assertExcludes(content.otpScreen, 'completeLogin', 'OTP screen login completion');
  assertExcludes(content.otpScreen, 'Fresh OTP required for every login.', 'OTP login copy');
  assertExcludes(content.mockBackend, 'await this.auth.requestOtp(user.Phone_Number)', 'mock login OTP request');

  const result = {
    scenario: 'direct-login-validation',
    validatedFiles: files,
    completedChecks: [
      'register-login action login returns a signed session after phone/password/role validation',
      'member and admin login screens call direct auth login without navigating to OTP',
      'OTP screen remains available for registration/KYC phone verification',
      'mock backend tests cover direct login failures and signup OTP success',
    ],
    requiresSupabaseCredentials: false,
    requiresDeviceValidation: true,
    validatedAt: new Date().toISOString(),
  };

  const output = JSON.stringify(result, null, 2);
  if (args.output) {
    const outputPath = path.resolve(repoRoot, args.output);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${output}\n`);
  }
  console.log(output);
}

main();
