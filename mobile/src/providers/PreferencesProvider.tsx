import React, { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance } from 'react-native';
import { loadLocalAppPreferences, saveLocalAppPreferences } from '../services/storage';
import { palette } from '../theme/tokens';

export type AppLanguage = 'English' | 'Amharic';
export type AppThemeName = 'Light' | 'Dark' | 'System';

type PreferenceColors = typeof palette;

interface PreferencesContextValue {
  language: AppLanguage;
  theme: AppThemeName;
  isDark: boolean;
  colors: PreferenceColors;
  t: (key: string) => string;
  setLanguage: (language: AppLanguage) => Promise<void>;
  setTheme: (theme: AppThemeName) => Promise<void>;
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
  'profile.verificationSecuritySubtitle': 'መለያዎ ተረጋግጧል እና ደህንነቱ የተጠበቀ ነው',
  'profile.preferences': 'ምርጫዎች',
  'profile.preferencesSubtitle': 'የመተግበሪያውን ተሞክሮ ያስተካክሉ',
  'profile.notifications': 'ማሳወቂያዎች',
  'profile.language': 'ቋንቋ',
  'profile.theme': 'ገጽታ',
  'profile.privacy': 'ግላዊነት',
  'profile.help': 'የእገዛ ማዕከል',
  'profile.terms': 'ደንቦች እና ግላዊነት',
  'profile.logout': 'ውጣ',
  'profile.saved': 'ተቀምጧል',
  'profile.editProfile': 'መገለጫ አስተካክል',
  'profile.close': 'ዝጋ',
  'profile.university': 'ዩኒቨርሲቲ',
  'profile.year': 'ዓመት',
  'profile.email': 'ኢሜይል',
  'profile.phone': 'ስልክ',
  'profile.memberId': 'የአባል መታወቂያ',
  'profile.joined': 'የተቀላቀሉበት',
  'profile.notSet': 'አልተዘጋጀም',
  'profile.kycStatus': 'የKYC ሁኔታ',
  'profile.emailAddress': 'ኢሜይል አድራሻ',
  'profile.addEmailAddress': 'ኢሜይል አክል',
  'profile.resetPassword': 'የይለፍ ቃል ቀይር',
  'profile.resetPasswordRight': 'OTP ሲያስፈልግ',
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
  'profile.verificationSecuritySubtitle': 'Your account is secure and verified',
  'profile.preferences': 'Preferences',
  'profile.preferencesSubtitle': 'Customize your app experience',
  'profile.notifications': 'Notifications',
  'profile.language': 'Language',
  'profile.theme': 'Theme',
  'profile.privacy': 'Privacy',
  'profile.help': 'Help Center',
  'profile.terms': 'Terms & privacy',
  'profile.logout': 'Log out',
  'profile.saved': 'Saved',
  'profile.editProfile': 'Edit profile',
  'profile.close': 'Close',
  'profile.university': 'University',
  'profile.year': 'Year',
  'profile.email': 'Email',
  'profile.phone': 'Phone',
  'profile.memberId': 'Member ID',
  'profile.joined': 'Joined',
  'profile.notSet': 'Not set',
  'profile.kycStatus': 'KYC status',
  'profile.emailAddress': 'Email address',
  'profile.addEmailAddress': 'Add email address',
  'profile.resetPassword': 'Reset password',
  'profile.resetPasswordRight': 'OTP when required',
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
  const [localPreferences, setLocalPreferences] = useState<{ language: AppLanguage; theme: AppThemeName }>({
    language: 'English',
    theme: 'Light',
  });
  const systemScheme = Appearance.getColorScheme();
  const language = normalizeLanguage(localPreferences.language);
  const theme = normalizeTheme(localPreferences.theme);
  const isDark = theme === 'Dark' || (theme === 'System' && systemScheme === 'dark');

  useEffect(() => {
    let mounted = true;
    loadLocalAppPreferences()
      .then(preferences => {
        if (mounted) {
          setLocalPreferences({
            language: normalizeLanguage(preferences.language),
            theme: normalizeTheme(preferences.theme),
          });
        }
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  const value = useMemo<PreferencesContextValue>(() => {
    async function persistPreferences(next: { language?: AppLanguage; theme?: AppThemeName }) {
      const preferences = {
        language: normalizeLanguage(next.language ?? localPreferences.language),
        theme: normalizeTheme(next.theme ?? localPreferences.theme),
      };
      setLocalPreferences(preferences);
      await saveLocalAppPreferences(preferences);
    }

    return {
      language,
      theme,
      isDark,
      colors: isDark ? darkPalette : palette,
      t: (key: string) => (language === 'Amharic' ? amharic[key] ?? english[key] ?? key : english[key] ?? key),
      setLanguage: (nextLanguage: AppLanguage) => persistPreferences({ language: nextLanguage }),
      setTheme: (nextTheme: AppThemeName) => persistPreferences({ theme: nextTheme }),
    };
  }, [isDark, language, localPreferences.language, localPreferences.theme, theme]);

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
      setLanguage: async () => undefined,
      setTheme: async () => undefined,
    };
  }
  return context;
}
