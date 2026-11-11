// Date + time pills with a clear button, shared by task/project forms.
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors, spacing, radius } from '../theme';
import { formatDate, formatTime } from '../lib/format';

export function DateTimeField({
  label,
  value,
  onChange,
  withTime = true,
  defaultHour = 9,
}: {
  label: string;
  value: Date | null;
  onChange: (value: Date | null) => void;
  withTime?: boolean;
  defaultHour?: number;
}) {
  const [mode, setMode] = useState<'date' | 'time' | null>(null);

  const base = () => {
    if (value) return value;
    const d = new Date();
    d.setHours(defaultHour, 0, 0, 0);
    return d;
  };

  const onPicked = (_: any, selected?: Date) => {
    const current = mode;
    setMode(Platform.OS === 'ios' ? current : null);
    if (!selected || !current) return;
    const b = base();
    onChange(current === 'date'
      ? new Date(selected.getFullYear(), selected.getMonth(), selected.getDate(), b.getHours(), b.getMinutes())
      : new Date(b.getFullYear(), b.getMonth(), b.getDate(), selected.getHours(), selected.getMinutes()));
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <Pressable style={[styles.pill, styles.flex2]} onPress={() => setMode(mode === 'date' ? null : 'date')}>
          <Ionicons name="calendar-outline" size={15} color={value ? colors.primarySoft : colors.textMuted} />
          <Text style={[styles.pillText, !value && styles.placeholder]}>{value ? formatDate(value.toISOString()) : 'Choisir une date'}</Text>
        </Pressable>
        {withTime && (
          <Pressable style={[styles.pill, styles.flex1]} onPress={() => setMode(mode === 'time' ? null : 'time')}>
            <Ionicons name="time-outline" size={15} color={value ? colors.primarySoft : colors.textMuted} />
            <Text style={[styles.pillText, !value && styles.placeholder]}>{value ? formatTime(value.toISOString()) : '--:--'}</Text>
          </Pressable>
        )}
        {value && (
          <Pressable style={styles.clear} onPress={() => { setMode(null); onChange(null); }} hitSlop={6}>
            <Ionicons name="close" size={16} color={colors.textMuted} />
          </Pressable>
        )}
      </View>
      {mode && (
        <DateTimePicker
          value={base()}
          mode={mode}
          is24Hour
          display={Platform.OS === 'ios' ? (mode === 'date' ? 'inline' : 'spinner') : 'default'}
          onChange={onPicked}
          themeVariant="dark"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  label: { color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.4 },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  flex1: { flex: 1 },
  flex2: { flex: 2 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
  },
  pillText: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
  placeholder: { color: colors.textMuted, fontWeight: '500' },
  clear: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
