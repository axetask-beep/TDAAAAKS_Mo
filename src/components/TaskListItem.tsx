import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Task } from '../types';
import { colors, spacing, radius } from '../theme';
import { formatDateShort, isOverdue, isDueToday } from '../lib/format';
import { Card, StatusBadge, PriorityBadge, Avatar } from './ui';

export function TaskListItem({ task, onPress, onLongPress, showProject }: { task: Task; onPress: () => void; onLongPress?: () => void; showProject?: boolean }) {
  const overdue = isOverdue(task.end_at) && task.status !== 'termine';
  const dueToday = isDueToday(task.end_at) && task.status !== 'termine';

  return (
    <Card onPress={onPress} onLongPress={onLongPress} style={styles.card}>
      <View style={styles.row}>
        <View style={styles.flex1}>
          <Text style={styles.title} numberOfLines={2}>{task.title}</Text>
          {showProject && (task.project?.name || task.workspace?.name) ? (
            <Text style={styles.breadcrumb} numberOfLines={1}>
              {task.workspace?.name}{task.workspace?.name && task.project?.name ? ' · ' : ''}{task.project?.name}
            </Text>
          ) : null}
        </View>
        <Avatar user={task.assignee} size={28} />
      </View>

      <View style={styles.metaRow}>
        <StatusBadge status={task.status} />
        <PriorityBadge priority={task.priority} />
        {task.end_at ? (
          <View style={[styles.dueChip, overdue && styles.dueOverdue, dueToday && styles.dueToday]}>
            <Ionicons
              name="calendar-outline"
              size={11}
              color={overdue ? colors.danger : dueToday ? colors.warning : colors.textMuted}
            />
            <Text style={[styles.dueText, overdue && { color: colors.danger }, dueToday && { color: colors.warning }]}>
              {formatDateShort(task.end_at)}
            </Text>
          </View>
        ) : null}
        {task.subtasks && task.subtasks.length > 0 ? (
          <View style={styles.dueChip}>
            <Ionicons name="checkbox-outline" size={11} color={colors.textMuted} />
            <Text style={styles.dueText}>
              {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length}
            </Text>
          </View>
        ) : null}
        {(task.tags || []).slice(0, 3).map(tag => (
          <View key={tag.id} style={[styles.tagChip, { borderColor: `${tag.color}66`, backgroundColor: `${tag.color}1A` }]}>
            <Text style={[styles.tagText, { color: tag.color }]} numberOfLines={1}>{tag.name}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm },
  flex1: { flex: 1, marginRight: spacing.sm },
  title: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  breadcrumb: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.xs },
  dueChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  dueOverdue: { backgroundColor: `${colors.danger}1A` },
  dueToday: { backgroundColor: `${colors.warning}1A` },
  dueText: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  tagChip: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2, maxWidth: 110 },
  tagText: { fontSize: 10, fontWeight: '700' },
});
