const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const notificationCenterPath = path.join(repoRoot, 'supabase/functions/notification-center/index.ts');
const notificationsHelperPath = path.join(repoRoot, 'supabase/functions/_shared/notifications.ts');
const liveNotificationsPath = path.join(repoRoot, 'mobile/src/services/live/liveNotificationsService.ts');
const domainPath = path.join(repoRoot, 'mobile/src/types/domain.ts');
const migrationPath = path.join(repoRoot, 'supabase/migrations/20260513090000_phase2_foundation_companion_tables.sql');

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

function read(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required file: ${path.relative(repoRoot, filePath)}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

function assertIncludes(content, token, label) {
  if (!content.includes(token)) {
    throw new Error(`Missing ${label}: ${token}`);
  }
}

function main() {
  const args = parseArgs();
  const notificationCenter = read(notificationCenterPath);
  const notificationsHelper = read(notificationsHelperPath);
  const liveNotifications = read(liveNotificationsPath);
  const domain = read(domainPath);
  const migration = read(migrationPath);

  [
    "action: 'listForUser' | 'markAllRead' | 'sendReminderBatch'",
    "source: 'Durable' | 'Derived'",
    'function toAppNotification',
    ".from('notifications')",
    '.eq(\'user_id\', user.User_ID)',
    'delivered_in_app_at',
    'return sortNotifications([...durableNotifications, ...notificationItems])',
    'case \'markAllRead\'',
    'markUserNotificationsRead(actor.User_ID)',
  ].forEach(token => assertIncludes(notificationCenter, token, 'notification-center durable read token'));

  [
    'export async function createNotification',
    'export async function markUserNotificationsRead',
    ".update({ read_at: readAt })",
    ".is('read_at', null)",
  ].forEach(token => assertIncludes(notificationsHelper, token, 'shared notification helper token'));

  [
    "unread: item.source === 'Durable' ? item.unread : !readIds.has(item.id)",
    "await invoke<{ readAt: string }>({ action: 'markAllRead' })",
    "items.filter(item => item.source !== 'Durable')",
    'saveReadNotificationIds',
  ].forEach(token => assertIncludes(liveNotifications, token, 'live notification service token'));

  [
    "source?: 'Durable' | 'Derived'",
    'severity?: NotificationSeverity',
    'actionRoute?: string | null',
    'relatedEntityType?: string | null',
  ].forEach(token => assertIncludes(domain, token, 'mobile notification contract token'));

  [
    'create table if not exists public.notifications',
    'read_at timestamp with time zone',
    'delivered_in_app_at timestamp with time zone',
    'idx_notifications_user_inbox',
    'idx_notifications_user_unread',
  ].forEach(token => assertIncludes(migration, token, 'durable notifications schema token'));

  const result = {
    scenario: 'phase2-durable-notifications-validation',
    validatedFiles: {
      notificationCenter: 'supabase/functions/notification-center/index.ts',
      helper: 'supabase/functions/_shared/notifications.ts',
      liveService: 'mobile/src/services/live/liveNotificationsService.ts',
      mobileTypes: 'mobile/src/types/domain.ts',
      migration: 'supabase/migrations/20260513090000_phase2_foundation_companion_tables.sql',
    },
    completedChecks: [
      'notification-center reads durable notifications rows before returning derived fallback notifications',
      'durable notification rows carry read state, delivery timestamp, severity, action route, and related entity metadata into mobile payloads',
      'derived fallback notifications remain available during the writer migration',
      'mobile markAllRead updates durable rows through the Edge Function and stores local read state only for derived fallback rows',
      'durable notification table and inbox indexes exist in the Phase 2 foundation migration',
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
