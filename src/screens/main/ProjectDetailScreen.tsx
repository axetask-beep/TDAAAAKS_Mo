import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Alert, TextInput, ScrollView, RefreshControl, Linking } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { Project, Task, TaskStatus, TaskPriority, ProjectMember, Tag, User } from '../../types';
import { STATUS_CONFIG, STATUS_ORDER, PRIORITY_CONFIG, PRIORITY_ORDER, colors, spacing, radius } from '../../theme';
import { Avatar, Button, Chip, EmptyState, LoadingScreen, SectionTitle } from '../../components/ui';
import { TaskListItem } from '../../components/TaskListItem';
import { FormModal } from '../../components/FormModal';
import { StatusSheet } from '../../components/StatusSheet';
import { useQuickStatus } from '../../lib/useQuickStatus';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { formatDateShort } from '../../lib/format';
import { PROJECT_STATUS } from './EditProjectScreen';

type AssigneeFilter = 'all' | 'unassigned' | string;

export default function ProjectDetailScreen({ route, navigation }: any) {
  const { projectId, workspaceId, name } = route.params;
  const { user } = useAuth();
  const { workspaces } = useWorkspace();
  const isWorkspaceAdmin = user?.role === 'admin' || workspaces.find(w => w.id === workspaceId)?.my_role === 'admin';

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilter>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [editingLink, setEditingLink] = useState(false);
  const [linkDraft, setLinkDraft] = useState('');

  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [workspaceMembers, setWorkspaceMembers] = useState<User[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const { statusTask, openStatus, closeStatus, changeStatus } = useQuickStatus(setTasks);

  useEffect(() => {
    navigation.setOptions({
      title: project?.name || name,
      headerRight: () => (
        <View style={styles.headerActions}>
          <Pressable hitSlop={10} onPress={() => setMembersOpen(true)}>
            <Ionicons name="people-outline" size={22} color={colors.textPrimary} />
          </Pressable>
          {isWorkspaceAdmin && (
            <Pressable hitSlop={10} onPress={() => navigation.navigate('EditProject', { projectId, workspaceId })}>
              <Ionicons name="create-outline" size={22} color={colors.textPrimary} />
            </Pressable>
          )}
        </View>
      ),
    });
  }, [name, project?.name, isWorkspaceAdmin]);

  const load = useCallback(async () => {
    try {
      const [p, t] = await Promise.all([api.getProject(projectId), api.getProjectTasks(projectId)]);
      setProject(p);
      setTasks(t);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectId]);

  const loadMembers = useCallback(async () => {
    try {
      const [pm, wm, tg] = await Promise.all([
        api.getProjectMembers(projectId),
        api.getWorkspaceMembers(workspaceId),
        api.getWorkspaceTags(workspaceId),
      ]);
      setProjectMembers(pm);
      setWorkspaceMembers(wm.map(m => m.user).filter(Boolean) as User[]);
      setTags(tg);
    } catch (err) {
      console.error(err);
    }
  }, [projectId, workspaceId]);

  useFocusEffect(useCallback(() => { load(); loadMembers(); }, [load, loadMembers]));

  const addMember = async (userId: string) => {
    try {
      await api.addProjectMember(projectId, userId);
      loadMembers();
    } catch (err: any) {
      Alert.alert('Erreur', err.message || "Impossible d'ajouter ce membre au projet.");
    }
  };

  const removeMember = async (userId: string) => {
    try {
      await api.removeProjectMember(projectId, userId);
      loadMembers();
    } catch (err: any) {
      Alert.alert('Erreur', err.message || 'Impossible de retirer ce membre du projet.');
    }
  };

  const saveLink = async () => {
    try {
      setProject(await api.updateProject(projectId, { link: linkDraft.trim() || null }));
      setEditingLink(false);
    } catch (err: any) {
      Alert.alert('Erreur', err.message || "Impossible d'enregistrer le lien.");
    }
  };

  const matchesSecondary = (t: Task) => {
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    if (assigneeFilter === 'unassigned' && t.assignee_id) return false;
    if (assigneeFilter !== 'all' && assigneeFilter !== 'unassigned' && t.assignee_id !== assigneeFilter) return false;
    if (tagFilter !== 'all' && !t.tags?.some(tag => tag.id === tagFilter)) return false;
    const q = search.trim().toLowerCase();
    if (q && !(t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q))) return false;
    return true;
  };
  const base = tasks.filter(matchesSecondary);
  const filtered = statusFilter === 'all' ? base : base.filter(t => t.status === statusFilter);
  const activeFilterCount = [priorityFilter !== 'all', assigneeFilter !== 'all', tagFilter !== 'all'].filter(Boolean).length;
  const resetFilters = () => { setPriorityFilter('all'); setAssigneeFilter('all'); setTagFilter('all'); };

  const done = tasks.filter(t => t.status === 'termine').length;
  const progress = tasks.length ? done / tasks.length : 0;
  const projectStatus = PROJECT_STATUS.find(s => s.id === project?.status);
  const availableToAdd = workspaceMembers.filter(m => !projectMembers.some(pm => pm.user_id === m.id));

  if (loading) return <LoadingScreen label="Chargement des tâches…" />;

  const header = (
    <View>
      {/* Project link — set by an admin at any time, shown front and center */}
      {editingLink ? (
        <View style={styles.linkEditRow}>
          <TextInput
            autoFocus
            value={linkDraft}
            onChangeText={setLinkDraft}
            placeholder="https://..."
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            keyboardType="url"
            style={styles.linkInput}
          />
          <Button title="OK" onPress={saveLink} />
          <Pressable hitSlop={8} onPress={() => setEditingLink(false)}>
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </Pressable>
        </View>
      ) : project?.link ? (
        <View style={styles.linkWrap}>
          <Pressable style={styles.linkPill} onPress={() => Linking.openURL(project.link!)}>
            <Ionicons name="open-outline" size={16} color={colors.primarySoft} />
            <Text style={styles.linkText} numberOfLines={1}>{project.link}</Text>
          </Pressable>
          {isWorkspaceAdmin && (
            <Pressable hitSlop={8} onPress={() => { setLinkDraft(project.link || ''); setEditingLink(true); }}>
              <Ionicons name="create-outline" size={18} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
      ) : isWorkspaceAdmin ? (
        <View style={styles.linkWrap}>
          <Pressable style={styles.linkAdd} onPress={() => { setLinkDraft(''); setEditingLink(true); }}>
            <Ionicons name="link-outline" size={16} color={colors.textMuted} />
            <Text style={styles.linkAddText}>Ajouter le lien du projet</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Project summary */}
      <View style={styles.summary}>
        <View style={styles.summaryTop}>
          {projectStatus && (
            <View style={[styles.statusPill, { borderColor: `${projectStatus.color}66`, backgroundColor: `${projectStatus.color}1A` }]}>
              <Text style={[styles.statusPillText, { color: projectStatus.color }]}>{projectStatus.label}</Text>
            </View>
          )}
          {project?.end_at ? (
            <View style={styles.dateRow}>
              <Ionicons name="flag-outline" size={12} color={colors.textMuted} />
              <Text style={styles.dateText}>Fin : {formatDateShort(project.end_at)}</Text>
            </View>
          ) : null}
        </View>
        {project?.description ? <Text style={styles.description}>{project.description}</Text> : null}
        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <Text style={styles.progressText}>{done}/{tasks.length} terminées</Text>
        </View>
      </View>

      {/* Search + filters button */}
      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Rechercher une tâche…"
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
        <Pressable style={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnActive]} onPress={() => setFiltersOpen(true)}>
          <Ionicons name="options-outline" size={18} color={activeFilterCount > 0 ? colors.white : colors.textPrimary} />
          {activeFilterCount > 0 && <Text style={styles.filterBtnCount}>{activeFilterCount}</Text>}
        </Pressable>
      </View>

      {/* Status = the main axis, kept one tap away */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statusRow}>
        <Chip label={`Toutes (${base.length})`} active={statusFilter === 'all'} onPress={() => setStatusFilter('all')} />
        {STATUS_ORDER.map(s => (
          <Chip
            key={s}
            label={`${STATUS_CONFIG[s].label} (${base.filter(t => t.status === s).length})`}
            active={statusFilter === s}
            color={STATUS_CONFIG[s].color}
            onPress={() => setStatusFilter(s)}
          />
        ))}
      </ScrollView>

      {tasks.length > 0 && <Text style={styles.hint}>Appui long sur une tâche pour changer son statut</Text>}
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={filtered}
        keyExtractor={t => t.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <TaskListItem
            task={item}
            onPress={() => navigation.navigate('TaskDetail', { taskId: item.id })}
            onLongPress={() => openStatus(item)}
          />
        )}
        ListEmptyComponent={
          tasks.length === 0
            ? <EmptyState icon="🗒️" title="Aucune tâche" subtitle="Touchez + pour ajouter la première tâche de ce projet." />
            : <EmptyState icon="🔍" title="Aucun résultat" subtitle="Aucune tâche ne correspond à ces filtres." />
        }
      />

      <Pressable
        style={styles.fab}
        onPress={() => navigation.navigate('CreateTask', { projectId, workspaceId, status: statusFilter === 'all' ? undefined : statusFilter })}
      >
        <Ionicons name="add" size={28} color={colors.white} />
      </Pressable>

      <StatusSheet task={statusTask} onClose={closeStatus} onSelect={changeStatus} />

      {/* Secondary filters */}
      <FormModal visible={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filtres">
        <ScrollView style={styles.sheetScroll}>
          <SectionTitle>Priorité</SectionTitle>
          <View style={styles.wrapRow}>
            <Chip label="Toutes" active={priorityFilter === 'all'} onPress={() => setPriorityFilter('all')} />
            {PRIORITY_ORDER.map(p => (
              <Chip key={p} label={PRIORITY_CONFIG[p].label} color={PRIORITY_CONFIG[p].color} active={priorityFilter === p} onPress={() => setPriorityFilter(p)} />
            ))}
          </View>

          <SectionTitle>Assigné à</SectionTitle>
          <View style={styles.wrapRow}>
            <Chip label="Tous" active={assigneeFilter === 'all'} onPress={() => setAssigneeFilter('all')} />
            <Chip label="Non assigné" active={assigneeFilter === 'unassigned'} onPress={() => setAssigneeFilter('unassigned')} />
            {user && <Chip label="Moi" active={assigneeFilter === user.id} onPress={() => setAssigneeFilter(user.id)} />}
            {workspaceMembers.filter(m => m.id !== user?.id).map(m => (
              <Chip key={m.id} label={m.name} active={assigneeFilter === m.id} onPress={() => setAssigneeFilter(m.id)} />
            ))}
          </View>

          {tags.length > 0 && (
            <>
              <SectionTitle>Tag</SectionTitle>
              <View style={styles.wrapRow}>
                <Chip label="Tous" active={tagFilter === 'all'} onPress={() => setTagFilter('all')} />
                {tags.map(t => (
                  <Chip key={t.id} label={t.name} color={t.color} active={tagFilter === t.id} onPress={() => setTagFilter(t.id)} />
                ))}
              </View>
            </>
          )}
        </ScrollView>
        <View style={styles.sheetActions}>
          <View style={styles.flex1}><Button title="Réinitialiser" variant="secondary" onPress={resetFilters} /></View>
          <View style={styles.flex1}><Button title={`Voir ${filtered.length} tâche${filtered.length > 1 ? 's' : ''}`} onPress={() => setFiltersOpen(false)} /></View>
        </View>
      </FormModal>

      {/* Project members */}
      <FormModal visible={membersOpen} onClose={() => setMembersOpen(false)} title="Membres du projet">
        <ScrollView style={styles.sheetScroll}>
          {projectMembers.length === 0 ? (
            <Text style={styles.membersEmpty}>Aucun membre spécifique — tout l'espace a accès au projet.</Text>
          ) : (
            projectMembers.map(pm => (
              <View key={pm.id} style={styles.memberRow}>
                <Avatar user={pm.user} size={32} />
                <Text style={styles.memberName}>{pm.user?.name}</Text>
                {isWorkspaceAdmin && (
                  <Pressable onPress={() => removeMember(pm.user_id)} hitSlop={8}>
                    <Ionicons name="close-circle-outline" size={22} color={colors.danger} />
                  </Pressable>
                )}
              </View>
            ))
          )}
          {isWorkspaceAdmin && availableToAdd.length > 0 && (
            <>
              <SectionTitle>Ajouter au projet</SectionTitle>
              {availableToAdd.map(m => (
                <Pressable key={m.id} style={styles.memberRow} onPress={() => addMember(m.id)}>
                  <Avatar user={m} size={32} />
                  <Text style={styles.memberName}>{m.name}</Text>
                  <Ionicons name="add-circle-outline" size={22} color={colors.primarySoft} />
                </Pressable>
              ))}
            </>
          )}
        </ScrollView>
      </FormModal>
    </View>
  );
}

const styles = StyleSheet.create({
  linkWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.md },
  linkPill: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: `${colors.primary}80`,
    backgroundColor: `${colors.primary}26`,
  },
  linkText: { flexShrink: 1, color: colors.primarySoft, fontSize: 14, fontWeight: '700' },
  linkAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  linkAddText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  linkEditRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.md },
  linkInput: {
    flex: 1,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 13,
  },
  container: { flex: 1, backgroundColor: colors.background },
  flex1: { flex: 1 },
  headerActions: { flexDirection: 'row', gap: spacing.lg, marginRight: spacing.sm },
  listContent: { padding: spacing.lg, paddingBottom: 100 },
  summary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  summaryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusPill: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  statusPillText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  description: { color: colors.textSecondary, fontSize: 13, marginTop: spacing.sm, lineHeight: 18 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.success, borderRadius: 3 },
  progressText: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  searchRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 44,
  },
  searchInput: { flex: 1, color: colors.textPrimary, fontSize: 14, height: '100%' },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 2,
  },
  filterBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary, width: 56 },
  filterBtnCount: { color: colors.white, fontSize: 12, fontWeight: '800' },
  statusRow: { marginBottom: spacing.sm },
  hint: { color: colors.textMuted, fontSize: 11, marginBottom: spacing.sm },
  sheetScroll: { maxHeight: 440 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.sm, marginBottom: spacing.lg },
  sheetActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  membersEmpty: { color: colors.textMuted, fontSize: 13, fontStyle: 'italic', marginBottom: spacing.lg },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 8 },
  memberName: { flex: 1, color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.xl,
    width: 58,
    height: 58,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
});
