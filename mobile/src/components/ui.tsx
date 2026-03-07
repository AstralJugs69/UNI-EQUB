import React, { PropsWithChildren } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { StyleProp, TextInputProps, ViewStyle } from 'react-native';
import { palette, radii, shadows, spacing } from '../theme/tokens';

export function ScreenScroll({ children, contentStyle }: PropsWithChildren<{ contentStyle?: StyleProp<ViewStyle> }>) {
  return (
    <ScrollView contentContainerStyle={[styles.screen, contentStyle]} showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  );
}

export function Panel({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

export function HeroPanel({ children }: PropsWithChildren) {
  return <View style={[styles.panel, styles.heroPanel]}>{children}</View>;
}

export function TitleBlock({ title, subtitle, align = 'left' }: { title: string; subtitle?: string; align?: 'left' | 'center' }) {
  return (
    <View style={align === 'center' ? styles.centered : undefined}>
      <Text style={[styles.title, align === 'center' && styles.centerText]}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, align === 'center' && styles.centerText]}>{subtitle}</Text> : null}
    </View>
  );
}

export function InputField({ label, multiline, ...props }: TextInputProps & { label: string; multiline?: boolean }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrap, multiline && styles.textareaWrap]}>
        <TextInput
          placeholderTextColor={palette.muted}
          style={[styles.input, multiline && styles.textarea]}
          multiline={multiline}
          {...props}
        />
      </View>
    </View>
  );
}

export function SplitPhoneField({ value, onChangeText }: { value: string; onChangeText: (value: string) => void }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>Phone Number</Text>
      <View style={styles.splitRow}>
        <View style={[styles.inputWrap, styles.countryCodeWrap]}>
          <Text style={styles.countryCode}>+251</Text>
        </View>
        <View style={[styles.inputWrap, styles.flexOne]}>
          <TextInput value={value} onChangeText={onChangeText} placeholder="911 00 00 00" placeholderTextColor={palette.muted} style={styles.input} />
        </View>
      </View>
    </View>
  );
}

export function PrimaryButton({ label, onPress, variant = 'primary', disabled = false, loading = false }: { label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger'; disabled?: boolean; loading?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled || loading} style={({ pressed }) => [styles.button, styles[variant], (disabled || loading) && styles.disabledButton, pressed && !disabled && !loading && styles.pressed]}>
      <View style={styles.buttonContent}>
        {loading ? <ActivityIndicator color={variant === 'primary' ? palette.surface : palette.text} /> : null}
        <Text style={[styles.buttonText, variant !== 'primary' && styles.darkButtonText]}>{label}</Text>
      </View>
    </Pressable>
  );
}

export function Pill({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'active' | 'good' | 'warn' | 'bad' }) {
  return <Text style={[styles.pill, styles[`pill_${tone}`]]}>{label}</Text>;
}

export function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.keyValue}>
      <Text style={styles.keyLabel}>{label}</Text>
      <Text style={styles.keyValueText}>{value}</Text>
    </View>
  );
}

export function InfoRow({ title, subtitle, right }: { title: string; subtitle?: string; right?: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.flexOne}>
        <Text style={styles.infoTitle}>{title}</Text>
        {subtitle ? <Text style={styles.infoSubtitle}>{subtitle}</Text> : null}
      </View>
      {right ? <Text style={styles.infoRight}>{right}</Text> : null}
    </View>
  );
}

export function TopBar({ title, subtitle, onBack, rightLabel }: { title: string; subtitle?: string; onBack?: () => void; rightLabel?: string }) {
  return (
    <View style={styles.topBar}>
      <Pressable onPress={onBack} style={[styles.iconButton, !onBack && styles.iconGhost]}>
        <Text style={styles.iconText}>{onBack ? '<' : ''}</Text>
      </Pressable>
      <View style={styles.flexOne}>
        {subtitle ? <Text style={styles.topSubtitle}>{subtitle}</Text> : null}
        <Text style={styles.topTitle}>{title}</Text>
      </View>
      <View style={styles.rightWrap}>{rightLabel ? <Pill label={rightLabel} tone="active" /> : null}</View>
    </View>
  );
}

export function BottomNav({ items, activeKey, onPress }: { items: Array<{ key: string; label: string }>; activeKey: string; onPress: (key: string) => void }) {
  return (
    <View style={styles.bottomNav}>
      {items.map(item => (
        <Pressable key={item.key} onPress={() => onPress(item.key)} style={styles.navButton}>
          <Text style={[styles.navLabel, activeKey === item.key && styles.navLabelActive]}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export const uiStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md },
  twoCol: { flexDirection: 'row', gap: spacing.md },
  flexOne: { flex: 1 },
});

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 110,
    gap: spacing.md,
    backgroundColor: '#fcfcfd',
    minHeight: '100%',
  },
  panel: {
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.md,
    ...shadows.card,
  },
  heroPanel: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  centered: { alignItems: 'center' },
  centerText: { textAlign: 'center' },
  title: { fontSize: 28, fontWeight: '800', color: palette.text, letterSpacing: -0.8 },
  subtitle: { marginTop: 6, fontSize: 14, lineHeight: 20, color: palette.muted },
  fieldGroup: { gap: 8 },
  label: { fontSize: 12, fontWeight: '700', color: palette.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
  inputWrap: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.md,
    backgroundColor: palette.surface,
    paddingHorizontal: spacing.md,
    minHeight: 50,
    justifyContent: 'center',
  },
  input: { color: palette.text, fontSize: 16, paddingVertical: 10 },
  textareaWrap: { minHeight: 110, alignItems: 'flex-start' },
  textarea: { minHeight: 90, textAlignVertical: 'top', width: '100%' },
  splitRow: { flexDirection: 'row', gap: spacing.sm },
  countryCodeWrap: { width: 82, alignItems: 'center' },
  countryCode: { fontSize: 16, fontWeight: '700', color: palette.text },
  flexOne: { flex: 1 },
  button: {
    minHeight: 52,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  primary: { backgroundColor: palette.primary },
  secondary: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  danger: { backgroundColor: palette.surface, borderWidth: 1, borderColor: '#f2c7c7' },
  disabledButton: { opacity: 0.6 },
  pressed: { opacity: 0.9 },
  buttonContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  buttonText: { color: palette.surface, fontWeight: '800', fontSize: 15 },
  darkButtonText: { color: palette.text },
  pill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: '800',
    overflow: 'hidden',
  },
  pill_neutral: { backgroundColor: palette.surfaceSoft, color: palette.muted },
  pill_active: { backgroundColor: '#eaf4ff', color: palette.primaryDark },
  pill_good: { backgroundColor: '#e4f8ea', color: palette.success },
  pill_warn: { backgroundColor: '#fff1dd', color: palette.warning },
  pill_bad: { backgroundColor: '#fde8e8', color: palette.danger },
  keyValue: {
    flex: 1,
    backgroundColor: palette.surfaceSoft,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
  },
  keyLabel: { color: palette.muted, fontSize: 12, marginBottom: 4 },
  keyValueText: { fontWeight: '800', fontSize: 16, color: palette.text },
  infoRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.md,
    padding: spacing.md,
    backgroundColor: palette.surface,
  },
  infoTitle: { fontSize: 15, fontWeight: '700', color: palette.text },
  infoSubtitle: { fontSize: 13, color: palette.muted, marginTop: 2 },
  infoRight: { fontSize: 13, fontWeight: '800', color: palette.primaryDark },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconButton: { width: 40, height: 40, borderRadius: 14, backgroundColor: palette.surfaceSoft, alignItems: 'center', justifyContent: 'center' },
  iconGhost: { opacity: 0 },
  iconText: { fontSize: 18, fontWeight: '800', color: palette.text },
  topSubtitle: { fontSize: 12, color: palette.muted, marginBottom: 2 },
  topTitle: { fontSize: 20, fontWeight: '800', color: palette.text },
  rightWrap: { minWidth: 76, alignItems: 'flex-end' },
  bottomNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    backgroundColor: palette.surface,
    flexDirection: 'row',
    paddingHorizontal: spacing.sm,
    paddingVertical: 14,
  },
  navButton: { flex: 1, alignItems: 'center' },
  navLabel: { fontSize: 12, fontWeight: '800', color: '#94a3b8' },
  navLabelActive: { color: palette.primaryDark },
});

