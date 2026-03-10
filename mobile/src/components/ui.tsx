import React, { PropsWithChildren } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { StyleProp, TextInputProps, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from './Icon';
import { iconSize, palette, radii, shadows, spacing, typography } from '../theme/tokens';

type Tone = 'neutral' | 'active' | 'good' | 'warn' | 'bad';
type BannerTone = 'info' | 'success' | 'warning' | 'danger';
type ButtonVariant = 'primary' | 'secondary' | 'danger';

export function AppScreen({
  children,
  contentStyle,
  footer,
  scroll = true,
  backgroundColor = palette.background,
}: PropsWithChildren<{
  contentStyle?: StyleProp<ViewStyle>;
  footer?: React.ReactNode;
  scroll?: boolean;
  backgroundColor?: string;
}>) {
  const body = scroll ? (
    <ScrollView contentContainerStyle={[styles.screenContent, contentStyle]} showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.screenContent, styles.screenFill, contentStyle]}>{children}</View>
  );

  return (
    <SafeAreaView style={[styles.screenRoot, { backgroundColor }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={backgroundColor} />
      {body}
      {footer ? <View style={styles.footerWrap}>{footer}</View> : null}
    </SafeAreaView>
  );
}

export function ScreenScroll({
  children,
  contentStyle,
}: PropsWithChildren<{ contentStyle?: StyleProp<ViewStyle> }>) {
  return <AppScreen contentStyle={contentStyle}>{children}</AppScreen>;
}

export function SectionCard({
  children,
  style,
  variant = 'default',
}: PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  variant?: 'default' | 'soft' | 'raised';
}>) {
  return (
    <View
      style={[
        styles.sectionCard,
        variant === 'soft' && styles.sectionCardSoft,
        variant === 'raised' && styles.sectionCardRaised,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Panel({
  children,
  style,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <SectionCard style={style}>{children}</SectionCard>;
}

export function HeroCard({
  children,
  style,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return (
    <View style={[styles.heroCard, style]}>
      <View style={styles.heroGlow} />
      <View style={styles.heroShade} />
      <View style={styles.heroContent}>{children}</View>
    </View>
  );
}

export function HeroPanel({ children }: PropsWithChildren) {
  return <HeroCard>{children}</HeroCard>;
}

export function TopAppBar({
  title,
  subtitle,
  onBack,
  rightLabel,
  trailing,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightLabel?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <View style={styles.appBar}>
      <Pressable
        onPress={onBack}
        disabled={!onBack}
        android_ripple={{ color: '#d9e4f7', borderless: false }}
        style={[styles.backButton, !onBack && styles.backButtonGhost]}
      >
        <Icon name="arrow-back" size={iconSize.md} color={palette.text} />
      </Pressable>
      <View style={styles.appBarTextWrap}>
        {subtitle ? <Text style={styles.appBarSubtitle}>{subtitle}</Text> : null}
        <Text style={styles.appBarTitle}>{title}</Text>
      </View>
      <View style={styles.appBarRight}>
        {trailing ?? (rightLabel ? <Pill label={rightLabel} tone="active" /> : null)}
      </View>
    </View>
  );
}

export function TopBar(props: Parameters<typeof TopAppBar>[0]) {
  return <TopAppBar {...props} />;
}

export function TitleBlock({
  title,
  subtitle,
  align = 'left',
}: {
  title: string;
  subtitle?: string;
  align?: 'left' | 'center';
}) {
  return (
    <View style={align === 'center' ? styles.centered : undefined}>
      <Text style={[styles.titleBlockTitle, align === 'center' && styles.centerText]}>{title}</Text>
      {subtitle ? <Text style={[styles.titleBlockSubtitle, align === 'center' && styles.centerText]}>{subtitle}</Text> : null}
    </View>
  );
}

export function StatusBanner({
  tone = 'info',
  title,
  body,
  style,
}: {
  tone?: BannerTone;
  title: string;
  body?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.banner, styles[`banner_${tone}`], style]}>
      <Icon
        name={tone === 'success' ? 'check-circle' : tone === 'warning' ? 'warning' : tone === 'danger' ? 'error' : 'info'}
        color={tone === 'success' ? palette.success : tone === 'warning' ? palette.warning : tone === 'danger' ? palette.danger : palette.info}
        size={iconSize.md}
      />
      <View style={styles.bannerTextWrap}>
        <Text style={styles.bannerTitle}>{title}</Text>
        {body ? <Text style={styles.bannerBody}>{body}</Text> : null}
      </View>
    </View>
  );
}

export function InlineError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }
  return <Text style={styles.inlineError}>{message}</Text>;
}

export function LoadingState({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <AppScreen scroll={false} contentStyle={styles.loadingWrap}>
      <ActivityIndicator size="large" color={palette.primary} />
      <Text style={styles.loadingTitle}>{title}</Text>
      {subtitle ? <Text style={styles.loadingSubtitle}>{subtitle}</Text> : null}
    </AppScreen>
  );
}

export function EmptyState({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: string;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <SectionCard style={styles.emptyState}>
      <View style={styles.emptyIconWrap}>
        <Icon name={icon} size={iconSize.lg} color={palette.primaryDark} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
      {action ? <View style={styles.emptyAction}>{action}</View> : null}
    </SectionCard>
  );
}

export function MetricTile({
  label,
  value,
  helper,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  helper?: string;
  tone?: Tone;
}) {
  return (
    <View style={[styles.metricTile, tone === 'active' && styles.metricTileActive]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      {helper ? <Text style={styles.metricHelper}>{helper}</Text> : null}
    </View>
  );
}

export function KeyValue({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return <MetricTile label={label} value={value} />;
}

export function AppButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  icon,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      android_ripple={{ color: variant === 'primary' ? '#4d8fe4' : '#dce6f3' }}
      style={({ pressed }) => [
        styles.button,
        styles[`button_${variant}`],
        (disabled || loading) && styles.buttonDisabled,
        pressed && !disabled && !loading && styles.buttonPressed,
      ]}
    >
      <View style={styles.buttonInner}>
        {loading ? (
          <ActivityIndicator color={variant === 'primary' ? palette.white : palette.text} />
        ) : icon ? (
          <Icon name={icon} size={iconSize.sm} color={variant === 'primary' ? palette.white : palette.text} />
        ) : null}
        <Text style={[styles.buttonLabel, variant !== 'primary' && styles.buttonLabelDark]}>{label}</Text>
      </View>
    </Pressable>
  );
}

export function PrimaryCTA(props: Omit<Parameters<typeof AppButton>[0], 'variant'>) {
  return <AppButton {...props} variant="primary" />;
}

export function SecondaryCTA(props: Omit<Parameters<typeof AppButton>[0], 'variant'>) {
  return <AppButton {...props} variant="secondary" />;
}

export function PrimaryButton(props: Parameters<typeof AppButton>[0]) {
  return <AppButton {...props} />;
}

export function SegmentedTabs({
  options,
  selectedKey,
  onSelect,
}: {
  options: Array<{ key: string; label: string }>;
  selectedKey: string;
  onSelect: (key: string) => void;
}) {
  return (
    <View style={styles.segmentedTabs}>
      {options.map(option => {
        const selected = option.key === selectedKey;
        return (
          <Pressable
            key={option.key}
            onPress={() => onSelect(option.key)}
            android_ripple={{ color: '#dbe5f7' }}
            style={[styles.segmentItem, selected && styles.segmentItemSelected]}
          >
            <Text style={[styles.segmentLabel, selected && styles.segmentLabelSelected]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Pill({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: Tone;
}) {
  return <Text style={[styles.pill, styles[`pill_${tone}`]]}>{label}</Text>;
}

export function ListRow({
  title,
  subtitle,
  right,
  leadingIcon,
  onPress,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  leadingIcon?: string;
  onPress?: () => void;
}) {
  const content = (
    <View style={styles.listRow}>
      {leadingIcon ? (
        <View style={styles.listRowIconWrap}>
          <Icon name={leadingIcon} size={iconSize.md} color={palette.primaryDark} />
        </View>
      ) : null}
      <View style={styles.listRowText}>
        <Text style={styles.listRowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.listRowSubtitle}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.listRowRight}>{right}</View> : null}
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable onPress={onPress} android_ripple={{ color: '#e1ebf8' }} style={styles.listRowPressable}>
      {content}
    </Pressable>
  );
}

export function InfoRow({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: string;
}) {
  return <ListRow title={title} subtitle={subtitle} right={right ? <Text style={styles.listRowValue}>{right}</Text> : undefined} />;
}

export function InputField({
  label,
  error,
  helper,
  multiline,
  leadingIcon,
  ...props
}: TextInputProps & {
  label: string;
  error?: string;
  helper?: string;
  multiline?: boolean;
  leadingIcon?: string;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputWrap, multiline && styles.textareaWrap, !!error && styles.inputWrapError]}>
        {leadingIcon ? <Icon name={leadingIcon} size={iconSize.md} color={palette.textSoft} /> : null}
        <TextInput
          placeholderTextColor={palette.textSoft}
          style={[styles.input, multiline && styles.textarea]}
          multiline={multiline}
          selectionColor={palette.inputFocused}
          {...props}
        />
      </View>
      {error ? <InlineError message={error} /> : helper ? <Text style={styles.fieldHelper}>{helper}</Text> : null}
    </View>
  );
}

export function SplitPhoneField({
  value,
  onChangeText,
  error,
}: {
  value: string;
  onChangeText: (value: string) => void;
  error?: string;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>Phone Number</Text>
      <View style={styles.phoneRow}>
        <View style={[styles.inputWrap, styles.countryWrap]}>
          <Text style={styles.countryCode}>+251</Text>
        </View>
        <View style={[styles.inputWrap, styles.phoneInputWrap, !!error && styles.inputWrapError]}>
          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder="911 00 00 00"
            placeholderTextColor={palette.textSoft}
            style={styles.input}
            keyboardType="phone-pad"
          />
        </View>
      </View>
      {error ? <InlineError message={error} /> : null}
    </View>
  );
}

export function BottomNav({
  items,
  activeKey,
  onPress,
}: {
  items: Array<{ key: string; label: string; icon?: string }>;
  activeKey: string;
  onPress: (key: string) => void;
}) {
  return (
    <SafeAreaView edges={['bottom']} style={styles.bottomNavWrap}>
      <View style={styles.bottomNav}>
        {items.map(item => {
          const selected = item.key === activeKey;
          return (
            <Pressable
              key={item.key}
              onPress={() => onPress(item.key)}
              android_ripple={{ color: '#e2ebf8', borderless: false }}
              style={styles.bottomNavItem}
            >
              <Icon
                name={item.icon ?? 'circle'}
                size={iconSize.md}
                color={selected ? palette.primaryDark : palette.textSoft}
              />
              <Text style={[styles.bottomNavLabel, selected && styles.bottomNavLabelActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

export const uiStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  twoCol: { flexDirection: 'row', gap: spacing.sm },
  flexOne: { flex: 1 },
  centeredRow: { flexDirection: 'row', alignItems: 'center' },
});

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
  },
  screenContent: {
    minHeight: '100%',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  screenFill: {
    flex: 1,
  },
  footerWrap: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: palette.background,
  },
  appBar: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: palette.surfaceAlt,
    borderWidth: 1,
    borderColor: palette.border,
  },
  backButtonGhost: {
    opacity: 0,
  },
  appBarTextWrap: {
    flex: 1,
    gap: spacing.xxs,
  },
  appBarSubtitle: {
    fontSize: typography.eyebrow,
    color: palette.textMuted,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  appBarTitle: {
    fontSize: typography.title,
    color: palette.text,
    fontWeight: '800',
  },
  appBarRight: {
    minWidth: 72,
    alignItems: 'flex-end',
  },
  sectionCard: {
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadows.card,
  },
  sectionCardSoft: {
    backgroundColor: palette.surfaceAlt,
  },
  sectionCardRaised: {
    backgroundColor: palette.surfaceRaised,
  },
  heroCard: {
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: palette.primaryDark,
    ...shadows.hero,
  },
  heroGlow: {
    position: 'absolute',
    top: -36,
    right: -18,
    width: 180,
    height: 180,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  heroShade: {
    position: 'absolute',
    bottom: -60,
    left: -30,
    width: 170,
    height: 170,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(204,123,55,0.26)',
  },
  heroContent: {
    padding: spacing.lg,
    gap: spacing.xs,
  },
  centered: {
    alignItems: 'center',
  },
  centerText: {
    textAlign: 'center',
  },
  titleBlockTitle: {
    fontSize: typography.hero,
    fontWeight: '800',
    color: palette.text,
    letterSpacing: -0.8,
  },
  titleBlockSubtitle: {
    marginTop: spacing.xs,
    fontSize: typography.body,
    lineHeight: 22,
    color: palette.textMuted,
  },
  banner: {
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  banner_info: {
    backgroundColor: palette.infoSurface,
    borderColor: palette.info,
  },
  banner_success: {
    backgroundColor: palette.successSurface,
    borderColor: palette.success,
  },
  banner_warning: {
    backgroundColor: palette.warningSurface,
    borderColor: palette.warning,
  },
  banner_danger: {
    backgroundColor: palette.dangerSurface,
    borderColor: palette.danger,
  },
  bannerTextWrap: {
    flex: 1,
    gap: spacing.xxs,
  },
  bannerTitle: {
    color: palette.text,
    fontWeight: '700',
    fontSize: typography.body,
  },
  bannerBody: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  inlineError: {
    color: palette.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loadingTitle: {
    fontSize: typography.title,
    fontWeight: '800',
    color: palette.text,
  },
  loadingSubtitle: {
    color: palette.textMuted,
    fontSize: typography.body,
    textAlign: 'center',
    maxWidth: 280,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyIconWrap: {
    width: 52,
    height: 52,
    borderRadius: radii.pill,
    backgroundColor: palette.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    marginTop: spacing.sm,
    fontSize: typography.title,
    fontWeight: '800',
    color: palette.text,
    textAlign: 'center',
  },
  emptySubtitle: {
    marginTop: spacing.xs,
    color: palette.textMuted,
    textAlign: 'center',
    lineHeight: 21,
  },
  emptyAction: {
    marginTop: spacing.md,
    width: '100%',
  },
  metricTile: {
    flex: 1,
    borderRadius: radii.lg,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.md,
    gap: spacing.xxs,
  },
  metricTileActive: {
    backgroundColor: palette.primarySoft,
    borderColor: '#BCD1F6',
  },
  metricLabel: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  metricValue: {
    color: palette.text,
    fontSize: 22,
    fontWeight: '800',
  },
  metricHelper: {
    color: palette.textMuted,
    fontSize: 13,
  },
  button: {
    minHeight: 52,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  button_primary: {
    backgroundColor: palette.primary,
  },
  button_secondary: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.borderStrong,
  },
  button_danger: {
    backgroundColor: palette.dangerSurface,
    borderWidth: 1,
    borderColor: '#E9BEB9',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonPressed: {
    opacity: 0.92,
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  buttonLabel: {
    color: palette.white,
    fontSize: typography.body,
    fontWeight: '800',
  },
  buttonLabelDark: {
    color: palette.text,
  },
  segmentedTabs: {
    flexDirection: 'row',
    borderRadius: radii.lg,
    backgroundColor: palette.surfaceSoft,
    padding: spacing.xxs,
    borderWidth: 1,
    borderColor: palette.border,
    gap: spacing.xxs,
  },
  segmentItem: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
  },
  segmentItemSelected: {
    backgroundColor: palette.surface,
    ...shadows.subtle,
  },
  segmentLabel: {
    color: palette.textMuted,
    fontWeight: '700',
  },
  segmentLabelSelected: {
    color: palette.primaryDark,
  },
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs + 2,
    borderRadius: radii.pill,
    fontSize: typography.eyebrow,
    fontWeight: '800',
    overflow: 'hidden',
  },
  pill_neutral: {
    backgroundColor: palette.surfaceSoft,
    color: palette.textMuted,
  },
  pill_active: {
    backgroundColor: palette.primarySoft,
    color: palette.primaryDark,
  },
  pill_good: {
    backgroundColor: palette.successSurface,
    color: palette.success,
  },
  pill_warn: {
    backgroundColor: palette.warningSurface,
    color: palette.warning,
  },
  pill_bad: {
    backgroundColor: palette.dangerSurface,
    color: palette.danger,
  },
  listRowPressable: {
    borderRadius: radii.md,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  listRowIconWrap: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: palette.primarySoft,
  },
  listRowText: {
    flex: 1,
    gap: spacing.xxs,
  },
  listRowTitle: {
    color: palette.text,
    fontSize: typography.body,
    fontWeight: '700',
  },
  listRowSubtitle: {
    color: palette.textMuted,
    lineHeight: 19,
  },
  listRowRight: {
    alignItems: 'flex-end',
  },
  listRowValue: {
    color: palette.primaryDark,
    fontWeight: '800',
  },
  fieldGroup: {
    gap: spacing.xs,
  },
  fieldLabel: {
    color: palette.textMuted,
    fontSize: typography.eyebrow,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  inputWrap: {
    minHeight: 54,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    backgroundColor: palette.surface,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  inputWrapError: {
    borderColor: palette.inputError,
  },
  input: {
    flex: 1,
    color: palette.text,
    fontSize: typography.body,
    paddingVertical: spacing.sm,
  },
  textareaWrap: {
    minHeight: 124,
    alignItems: 'flex-start',
  },
  textarea: {
    minHeight: 100,
    width: '100%',
    textAlignVertical: 'top',
  },
  fieldHelper: {
    color: palette.textMuted,
    fontSize: 13,
  },
  phoneRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  countryWrap: {
    width: 84,
    justifyContent: 'center',
  },
  countryCode: {
    color: palette.text,
    fontSize: typography.body,
    fontWeight: '700',
  },
  phoneInputWrap: {
    flex: 1,
  },
  bottomNavWrap: {
    backgroundColor: palette.bottomNav,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  bottomNav: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  bottomNavItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
    minHeight: 52,
    borderRadius: radii.md,
  },
  bottomNavLabel: {
    color: palette.textSoft,
    fontSize: 12,
    fontWeight: '700',
  },
  bottomNavLabelActive: {
    color: palette.primaryDark,
  },
});
