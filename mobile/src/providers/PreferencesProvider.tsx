import React, { createContext, PropsWithChildren, useContext, useMemo } from 'react';
import { Appearance } from 'react-native';
import { useProfileQuery } from '../hooks/useAppQueries';
import { useAuth } from './AuthProvider';
import { palette } from '../theme/tokens';

type AppLanguage = 'English' | 'Amharic';
type AppThemeName = 'Light' | 'Dark' | 'System';

type PreferenceColors = typeof palette;

interface PreferencesContextValue {
  language: AppLanguage;
  theme: AppThemeName;
  isDark: boolean;
  colors: PreferenceColors;
  t: (key: string) => string;
}

const amharic: Record<string, string> = {
  'tab.home': 'መነሻ',
  'tab.explore': 'ፈልግ',
  'tab.history': 'ታሪክ',
  'tab.wallet': 'ቦርሳ',
  'tab.alerts': 'ማሳወቂያ',
  'tab.profile': 'መገለጫ',
  'tab.overview': 'አጠቃላይ',
  'tab.groups': 'ቡድኖች',
  'tab.reports': 'ሪፖርቶች',
  'profile.accountOverview': 'የመለያ አጠቃላይ',
  'profile.accountOverviewSubtitle': 'ዋና የመለያ መረጃዎች',
  'profile.verificationSecurity': 'ማረጋገጫ እና ደህንነት',
  'profile.preferences': 'ምርጫዎች',
  'profile.notifications': 'ማሳወቂያዎች',
  'profile.language': 'ቋንቋ',
  'profile.theme': 'ገጽታ',
  'profile.privacy': 'ግላዊነት',
  'profile.help': 'የእርዳታ ማዕከል',
  'profile.terms': 'ደንቦች እና ግላዊነት',
  'profile.logout': 'ውጣ',
  'profile.saved': 'ተቀምጧል',
};

const english: Record<string, string> = {
  'tab.home': 'Home',
  'tab.explore': 'Explore',
  'tab.history': 'History',
  'tab.wallet': 'Wallet',
  'tab.alerts': 'Alerts',
  'tab.profile': 'Profile',
  'tab.overview': 'Overview',
  'tab.groups': 'Groups',
  'tab.reports': 'Reports',
  'profile.accountOverview': 'Account overview',
  'profile.accountOverviewSubtitle': 'Your key account details at a glance',
  'profile.verificationSecurity': 'Verification & security',
  'profile.preferences': 'Preferences',
  'profile.notifications': 'Notifications',
  'profile.language': 'Language',
  'profile.theme': 'Theme',
  'profile.privacy': 'Privacy',
  'profile.help': 'Help Center',
  'profile.terms': 'Terms & privacy',
  'profile.logout': 'Log out',
  'profile.saved': 'Saved',
};

const darkPalette: PreferenceColors = {
  ...palette,
  background: '#0F172A',
  backgroundSoft: '#111827',
  surface: '#172033',
  surfaceAlt: '#1F2937',
  surfaceSoft: '#263246',
  surfaceRaised: '#1E293B',
  border: '#334155',
  borderStrong: '#475569',
  text: '#E5E7EB',
  textMuted: '#B6C2D2',
  textSoft: '#92A0B5',
  primary: '#4D8DEA',
  primaryDark: '#8AB8FF',
  primarySoft: '#1D355B',
  accentSoft: '#4A2D1D',
  successSurface: '#153C2C',
  warningSurface: '#493518',
  dangerSurface: '#4A2327',
  infoSurface: '#172F52',
  appBar: '#111827',
  bottomNav: '#121A2A',
  shadow: '#000000',
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function normalizeLanguage(value?: string | null): AppLanguage {
  return value === 'Amharic' ? 'Amharic' : 'English';
}

function normalizeTheme(value?: string | null): AppThemeName {
  return value === 'Dark' || value === 'System' ? value : 'Light';
}

export function PreferencesProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const { data: profile } = useProfileQuery();
  const systemScheme = Appearance.getColorScheme();
  const language = normalizeLanguage(session ? profile?.language : 'English');
  const theme = normalizeTheme(session ? profile?.theme : 'Light');
  const isDark = theme === 'Dark' || (theme === 'System' && systemScheme === 'dark');

  const value = useMemo<PreferencesContextValue>(() => ({
    language,
    theme,
    isDark,
    colors: isDark ? darkPalette : palette,
    t: (key: string) => (language === 'Amharic' ? amharic[key] ?? english[key] ?? key : english[key] ?? key),
  }), [isDark, language, theme]);

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function useAppPreferences() {
  const context = useContext(PreferencesContext);
  if (!context) {
    return {
      language: 'English' as AppLanguage,
      theme: 'Light' as AppThemeName,
      isDark: false,
      colors: palette,
      t: (key: string) => english[key] ?? key,
    };
  }
  return context;
}
