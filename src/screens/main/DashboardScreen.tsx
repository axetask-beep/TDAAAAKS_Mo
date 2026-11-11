import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Image, TextInput, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../lib/api';
import { Task } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, radius } from '../../theme';
import { Avatar, Chip, EmptyState, LoadingScreen } from '../../components/ui';
import { TaskListItem } from '../../components/TaskListItem';
import { isOverdue, isDueToday } from '../../lib/format';
import { StatusSheet } from '../../components/StatusSheet';
import { useQuickStatus } from '../../lib/useQuickStatus';

type Filter = 'all' | 'overdue' | 'today' | 'in_progress' | 'urgent' | 'blocked';

export default function DashboardScreen({ navigation }: any) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const { statusTask, openStatus, closeStatus, changeStatus } = useQuickStatus(setTasks);

  const load = useCallback(async () => {
    try {
      const data = await api.getDashboardTasks();
      setTasks(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const filtered = tasks.filter(t => {
    const q = search.trim().toLowerCase();
    if (q && !(t.title.toLowerCase().includes(q) || t.project?.name?.toLowerCase().includes(q))) return false;
    if (filter === 'urgent') return t.priority === 'urgente' && t.status !== 'termine';
    if (filter === 'overdue') return isOverdue(t.end_at) && t.status !== 'termine';
    if (filter === 'today') return isDueToday(t.end_at) && t.status !== 'termine';
    if (filter === 'in_progress') return t.status === 'en_cours';
    if (filter === 'blocked') return t.status === 'bloque';
    return true;
  });

  const counts = {
    overdue: tasks.filter(t => isOverdue(t.end_at) && t.status !== 'termine').length,
    today: tasks.filter(t => isDueToday(t.end_at) && t.status !== 'termine').length,
    in_progress: tasks.filter(t => t.status === 'en_cours').length,
    blocked: tasks.filter(t => t.status === 'bloque').length,
    urgent: tasks.filter(t => t.priority === 'urgente' && t.status !== 'termine').length,
  };

  if (loading) return <LoadingScreen label="Chargement de vos tâches…" />;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Image source={require('../../../assets/axetask-mark.png')} style={styles.logo} resizeMode="contain" />
        <View style={styles.flex1}>
          <Text style={styles.greeting}>Bonjour, {user?.name?.split(' ')[0]}</Text>
          <Text style={styles.subtitle}>Vos tâches actives, tous espaces confondus</Text>
        </View>
        <Pressable onPress={() => navigation.navigate('Progress')} hitSlop={8} style={styles.headerBtn} accessibilityLabel="Ma progression">
          <Ionicons name="trophy-outline" size={18} color={colors.warning} />
        </Pressable>
        <Pressable onPress={() => navigation.navigate('Profile')} hitSlop={8} accessibilityLabel="Ouvrir le profil">
          <Avatar user={user} size={36} />
        </Pressable>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListHeaderComponent={
          <View>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={16} color={colors.textMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Rechercher une tâche ou un projet…"
              placeholderTextColor={colors.textMuted}
              style={styles.searchInput}
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch('')} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={colors.textMuted} />
              </Pressable>
            )}
          </View>
          <FlatList
            data={[
              { key: 'all', label: `Toutes (${tasks.length})` },
              { key: 'overdue', label: `En retard (${counts.overdue})` },
              { key: 'today', label: `Aujourd'hui (${counts.today})` },
              { key: 'in_progress', label: `En cours (${counts.in_progress})` },
              { key: 'urgent', label: `Urgentes (${counts.urgent})` },
              { key: 'blocked', label: `Bloquées (${counts.blocked})` },
            ]}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={i => i.key}
            style={styles.filterRow}
            contentContainerStyle={{ paddingHorizontal: spacing.lg }}
            renderItem={({ item }) => (
              <Chip
                label={item.label}
                active={filter === item.key}
                onPress={() => setFilter(item.key as Filter)}
                color={item.key === 'overdue' || item.key === 'urgent' ? colors.danger : item.key === 'today' ? colors.warning : colors.primary}
              />
            )}
          />
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: spacing.lg }}>
            <TaskListItem
              task={item}
              showProject
              onPress={() => navigation.navigate('TaskDetail', { taskId: item.id })}
              onLongPress={() => openStatus(item)}
            />
          </View>
        )}
        ListEmptyComponent={<EmptyState icon="✅" title="Rien à faire ici !" subtitle="Aucune tâche ne correspond à ce filtre." />}
        ListFooterComponent={filtered.length > 0 ? <Text style={styles.hint}>Appui long sur une tâche pour changer son statut</Text> : null}
      />
      <StatusSheet task={statusTask} onClose={closeStatus} onSelect={changeStatus} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  logo: { width: 48, height: 48 },
  headerBtn: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    backgroundColor: `${colors.warning}1A`, borderWidth: 1, borderColor: `${colors.warning}44`,
  },
  flex1: { flex: 1 },
  hint: { color: colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: spacing.sm },
  greeting: { color: colors.textPrimary, fontSize: 22, fontWeight: '800' },
  subtitle: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  filterRow: { marginBottom: spacing.md },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 44,
  },
  searchInput: { flex: 1, color: colors.textPrimary, fontSize: 14, height: '100%' },
  listContent: { paddingBottom: spacing.xxl },
});
