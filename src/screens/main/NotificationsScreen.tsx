import React, { useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNotifications } from '../../context/NotificationsContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { AppNotification, NotificationType } from '../../types';
import { colors, spacing, radius } from '../../theme';
import { EmptyState, LoadingScreen } from '../../components/ui';

const TYPE_META: Record<NotificationType, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  task_assigned: { icon: 'person-add-outline', color: colors.primarySoft },
  task_status_changed: { icon: 'refresh-outline', color: colors.indigo },
  task_comment: { icon: 'chatbubble-outline', color: colors.accentPink },
  task_due_today: { icon: 'calendar-outline', color: colors.warning },
  task_overdue: { icon: 'alarm-outline', color: colors.danger },
  workspace_added: { icon: 'briefcase-outline', color: colors.success },
  workspace_removed: { icon: 'person-remove-outline', color: colors.danger },
  workspace_role_changed: { icon: 'shield-checkmark-outline', color: colors.primarySoft },
  project_completed: { icon: 'trophy-outline', color: colors.success },
  project_playbook_reminder: { icon: 'flag-outline', color: colors.primarySoft },
  announcement: { icon: 'megaphone-outline', color: colors.warning },
  kudos: { icon: 'heart-outline', color: colors.accentPink },
};

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `il y a ${hrs} h`;
  const days = Math.floor(hrs / 24);
  return `il y a ${days} j`;
}

export default function NotificationsScreen({ navigation }: any) {
  const { notifications, unreadCount, loading, refresh, markRead, markAllRead, deleteOne, clearAll } = useNotifications();
  const { setCurrentWorkspaceId, workspaces } = useWorkspace();
  const insets = useSafeAreaInsets();

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const handleSelect = async (n: AppNotification) => {
    if (!n.is_read) await markRead(n.id);

    if (n.task_id) {
      navigation.navigate('TaskDetail', { taskId: n.task_id });
    } else if (n.workspace_id) {
      const stillMember = workspaces.some(w => w.id === n.workspace_id);
      if (stillMember) {
        setCurrentWorkspaceId(n.workspace_id);
        navigation.navigate('MainTabs', { screen: 'Workspaces' });
      }
    } else if (n.type === 'announcement') {
      navigation.navigate('Announcements');
    }
  };

  if (loading) return <LoadingScreen label="Chargement des notifications…" />;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.headerTitle}>Notifications</Text>
      </View>

      {notifications.length > 0 && (
        <View style={styles.actionsRow}>
          <Pressable style={styles.actionBtn} onPress={markAllRead} disabled={unreadCount === 0}>
            <Ionicons name="checkmark-done-outline" size={16} color={unreadCount === 0 ? colors.textMuted : colors.primarySoft} />
            <Text style={[styles.actionText, unreadCount === 0 && { color: colors.textMuted }]}>Tout marquer comme lu</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={clearAll}>
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
            <Text style={[styles.actionText, { color: colors.danger }]}>Tout effacer</Text>
          </Pressable>
        </View>
      )}

      <FlatList
        data={notifications}
        keyExtractor={n => n.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<EmptyState icon="🔔" title="Aucune notification" subtitle="Vous êtes à jour." />}
        renderItem={({ item }) => {
          const meta = TYPE_META[item.type] ?? TYPE_META.task_status_changed;
          return (
            <Pressable
              onPress={() => handleSelect(item)}
              style={[styles.row, !item.is_read && styles.rowUnread]}
            >
              <View style={[styles.iconWrap, { backgroundColor: `${meta.color}26` }]}>
                <Ionicons name={meta.icon} size={18} color={meta.color} />
              </View>
              <View style={styles.flex1}>
                <View style={styles.titleRow}>
                  {!item.is_read && <View style={styles.dot} />}
                  <Text style={[styles.title, !item.is_read && styles.titleUnread]} numberOfLines={1}>
                    {item.title}
                  </Text>
                </View>
                {item.message ? (
                  <Text style={styles.message} numberOfLines={2}>{item.message}</Text>
                ) : null}
                <Text style={styles.time}>{formatRelativeTime(item.created_at)}</Text>
              </View>
              <Pressable onPress={() => deleteOne(item.id)} hitSlop={8} style={styles.deleteBtn}>
                <Ionicons name="close" size={16} color={colors.textMuted} />
              </Pressable>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  headerTitle: { color: colors.textPrimary, fontSize: 22, fontWeight: '800' },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  actionText: { color: colors.primarySoft, fontSize: 12, fontWeight: '600' },
  listContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowUnread: { backgroundColor: `${colors.primary}0D`, borderColor: `${colors.primary}40` },
  iconWrap: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  flex1: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  title: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', flexShrink: 1 },
  titleUnread: { color: colors.textPrimary, fontWeight: '800' },
  message: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  time: { color: colors.textMuted, fontSize: 10, marginTop: 4 },
  deleteBtn: { padding: 2 },
});
