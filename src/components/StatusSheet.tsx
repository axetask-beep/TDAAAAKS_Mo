// Quick status change from a list (long-press a task). A sheet rather than
// Alert.alert: Android alerts can't hold more than 3 buttons.
import React from 'react';
import { Text, StyleSheet, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Task, TaskStatus } from '../types';
import { STATUS_CONFIG, STATUS_ORDER, colors, spacing, radius } from '../theme';
import { FormModal } from './FormModal';

export function StatusSheet({
  task,
  onClose,
  onSelect,
}: {
  task: Task | null;
  onClose: () => void;
  onSelect: (task: Task, status: TaskStatus) => void;
}) {
  return (
    <FormModal visible={!!task} onClose={onClose} title="Changer le statut">
      {task ? <Text style={styles.taskTitle} numberOfLines={2}>{task.title}</Text> : null}
      {STATUS_ORDER.map(s => {
        const cfg = STATUS_CONFIG[s];
        const active = task?.status === s;
        return (
          <Pressable
            key={s}
            style={[styles.row, active && { borderColor: cfg.color, backgroundColor: `${cfg.color}1A` }]}
            onPress={() => { if (task) onSelect(task, s); onClose(); }}
          >
            <View style={[styles.dot, { backgroundColor: cfg.color }]} />
            <Text style={[styles.label, active && { color: cfg.color }]}>{cfg.label}</Text>
            {active && <Ionicons name="checkmark" size={18} color={cfg.color} />}
          </Pressable>
        );
      })}
    </FormModal>
  );
}

const styles = StyleSheet.create({
  taskTitle: { color: colors.textSecondary, fontSize: 13, marginBottom: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  label: { flex: 1, color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
});
