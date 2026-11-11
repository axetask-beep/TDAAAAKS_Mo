// Visual building blocks for the Centre de contrôle and Progression screens.
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../theme';
import { Health, ScopeTask } from '../lib/insights';
import { PriorityBadge, StatusBadge } from './ui';

export const HEALTH_COLORS: Record<Health, string> = {
  sain: colors.success,
  surveiller: colors.warning,
  critique: colors.danger,
  termine: colors.primarySoft,
  arrete: colors.textMuted,
};

export const ORANGE = '#FB923C';

export const fmtShortDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '—';

// Same formatters as AXETASKS/src/components/command/Charts.tsx.
export const fmtHours = (min: number) => (min >= 60 ? `${Math.round((min / 60) * 10) / 10} h` : `${min} min`);
export const fmtDay = (key: string) => new Date(`${key}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

export function ProgressBar({ value, color = colors.primary, height = 6 }: { value: number; color?: string; height?: number }) {
  const pct = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0)) * 100;
  return (
    <View style={[styles.track, { height, borderRadius: height / 2 }]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}>
      <View style={{ width: `${pct}%`, height, borderRadius: height / 2, backgroundColor: color }} />
    </View>
  );
}

export function Section({
  icon,
  iconColor = colors.primarySoft,
  title,
  meta,
  children,
  flush,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  title: string;
  meta?: string;
  children: React.ReactNode;
  flush?: boolean;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIcon, { backgroundColor: `${iconColor}1F` }]}>
          <Ionicons name={icon} size={14} color={iconColor} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
        {meta ? <Text style={styles.sectionMeta} numberOfLines={1}>{meta}</Text> : null}
      </View>
      <View style={flush ? undefined : styles.sectionBody}>{children}</View>
    </View>
  );
}

export function KpiTile({
  label,
  value,
  hint,
  tone = colors.textPrimary,
  active,
  onPress,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={onPress ? { selected: !!active } : undefined}
      style={({ pressed }) => [styles.kpi, active && styles.kpiActive, pressed && { opacity: 0.8 }]}
    >
      <Text style={styles.kpiLabel} numberOfLines={1}>{label}</Text>
      <Text style={[styles.kpiValue, { color: tone }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      {hint ? <Text style={styles.kpiHint} numberOfLines={1}>{hint}</Text> : null}
    </Pressable>
  );
}

export function ScopeTaskRow({
  task,
  projectName,
  userName,
  reasons,
  onPress,
  last,
}: {
  task: ScopeTask;
  projectName: string;
  userName: string;
  reasons?: string[];
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, !last && styles.rowBorder, pressed && { backgroundColor: colors.surfaceAlt }]}>
      <View style={styles.flex1}>
        <Text style={styles.rowTitle} numberOfLines={1}>{task.title}</Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {projectName} · {userName}{task.end_at ? ` · ${fmtShortDate(task.end_at)}` : ''}
        </Text>
        {reasons?.length ? <Text style={styles.rowReasons} numberOfLines={2}>{reasons.join(' · ')}</Text> : null}
        <View style={styles.badges}>
          <PriorityBadge priority={task.priority} />
          <StatusBadge status={task.status} />
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <View style={styles.segmented} accessibilityRole="tablist">
      {options.map(([k, label]) => (
        <Pressable
          key={k}
          onPress={() => onChange(k)}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === k }}
          style={[styles.segment, value === k && styles.segmentActive]}
        >
          <Text style={[styles.segmentText, value === k && styles.segmentTextActive]} numberOfLines={1}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Muted({ children, style }: { children: React.ReactNode; style?: any }) {
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  flex1: { flex: 1, minWidth: 0 },
  track: { backgroundColor: colors.surfaceAlt, overflow: 'hidden', width: '100%' },
  section: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionIcon: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '800' },
  sectionMeta: { color: colors.textMuted, fontSize: 11, marginLeft: 'auto', flexShrink: 1 },
  sectionBody: { padding: spacing.md },
  kpi: {
    flexBasis: '31%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm + 2,
  },
  kpiActive: { borderColor: colors.primary, backgroundColor: `${colors.primary}1A` },
  kpiLabel: { color: colors.textSecondary, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  kpiValue: { fontSize: 24, fontWeight: '800', marginTop: 2, fontVariant: ['tabular-nums'] },
  kpiHint: { color: colors.textMuted, fontSize: 10, marginTop: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
  rowMeta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  rowReasons: { color: colors.primarySoft, fontSize: 11, marginTop: 3 },
  badges: { flexDirection: 'row', gap: 6, marginTop: 6 },
  segmented: { flexDirection: 'row', backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 3 },
  segment: { flex: 1, paddingVertical: 7, borderRadius: radius.sm, alignItems: 'center' },
  segmentActive: { backgroundColor: `${colors.primary}33` },
  segmentText: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  segmentTextActive: { color: colors.primarySoft },
  muted: { color: colors.textMuted, fontSize: 11, lineHeight: 16 },
});
