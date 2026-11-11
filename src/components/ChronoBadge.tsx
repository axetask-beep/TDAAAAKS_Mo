// Mirrors AXETASKS/src/components/common/ChronoWidget.tsx: a badge-only
// display (icon + elapsed/overtime text, green/red/gray), no interactive
// controls — the task chrono is fully automatic, driven by start_at/end_at/
// completed_at (see lib/chrono.ts). Unrelated to the (deleted) personal
// work-session stopwatch.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { computeChronoState, formatDuration, CHRONO_LABELS } from '../lib/chrono';
import { colors, radius, spacing } from '../theme';

export function ChronoBadge({
  startAt,
  endAt,
  completedAt,
  stoppedAt,
}: {
  startAt?: string | null;
  endAt?: string | null;
  completedAt?: string | null;
  stoppedAt?: string | null;
}) {
  const [now, setNow] = useState(() => new Date());
  const isFrozen = !!completedAt || !!stoppedAt;

  useEffect(() => {
    if (isFrozen) return;
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, [isFrozen]);

  const state = computeChronoState(startAt, endAt, completedAt, now, stoppedAt);
  if (state.status === 'none') return null;

  const isRed = state.status === 'overtime' || state.status === 'completed_overtime' || state.status === 'stopped_overtime';
  const isDone = state.status === 'completed' || state.status === 'completed_overtime';
  const isStopped = state.status === 'stopped' || state.status === 'stopped_overtime';
  const isPending = state.status === 'pending';

  const tint = isPending || (isStopped && !isRed)
    ? colors.textSecondary
    : isRed
    ? colors.danger
    : colors.success;

  const icon = isPending ? 'time-outline' : isStopped ? 'square' : isRed ? 'alert-circle-outline' : isDone ? 'checkmark-circle-outline' : 'time-outline';

  return (
    <View style={[styles.badge, { borderColor: `${tint}66`, backgroundColor: `${tint}22` }]}>
      <Ionicons name={icon as any} size={12} color={tint} />
      <Text style={[styles.text, { color: tint }]}>
        {isPending ? CHRONO_LABELS.pending : formatDuration(state.elapsedMs)}
        {state.overtimeMs > 0 ? ` (+${formatDuration(state.overtimeMs)})` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  text: { fontSize: 11, fontWeight: '700' },
});
