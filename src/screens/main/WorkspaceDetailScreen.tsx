import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { Project } from '../../types';
import { colors, spacing, radius } from '../../theme';
import { Card, EmptyState, LoadingScreen } from '../../components/ui';
import CreateProjectModal from '../../components/modals/CreateProjectModal';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';

const PROJECT_STATUS_LABEL: Record<string, string> = {
  active: 'Actif',
  planned: 'Planifié',
  completed: 'Terminé',
  archived: 'Archivé',
};

export default function WorkspaceDetailScreen({ route, navigation }: any) {
  const { workspaceId, name } = route.params;
  const { user } = useAuth();
  const { workspaces } = useWorkspace();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const myRole = workspaces.find(w => w.id === workspaceId)?.my_role;
  const isWorkspaceAdmin = user?.role === 'admin' || myRole === 'admin';

  useEffect(() => {
    navigation.setOptions({
      title: name,
      headerRight: () => (
        <Pressable
          hitSlop={10}
          style={{ marginRight: spacing.sm }}
          onPress={() => navigation.navigate('WorkspaceSettings', { workspaceId, name })}
        >
          <Ionicons name="settings-outline" size={22} color={colors.textPrimary} />
        </Pressable>
      ),
    });
  }, [name, workspaceId]);

  const load = useCallback(async () => {
    try {
      const data = await api.getWorkspaceProjects(workspaceId);
      setProjects(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <LoadingScreen label="Chargement des projets…" />;

  return (
    <View style={styles.container}>
      <FlatList
        data={projects}
        keyExtractor={p => p.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<EmptyState icon="📁" title="Aucun projet" subtitle={isWorkspaceAdmin ? 'Touchez + pour créer le premier projet.' : "Aucun projet ne vous est encore ouvert dans cet espace."} />}
        renderItem={({ item }) => (
          <Card
            style={styles.card}
            onPress={() => navigation.navigate('ProjectDetail', { projectId: item.id, workspaceId, name: item.name })}
          >
            <View style={styles.row}>
              <View style={styles.flex1}>
                <Text style={styles.name}>{item.name}</Text>
                {item.description ? <Text style={styles.description} numberOfLines={1}>{item.description}</Text> : null}
                <View style={styles.metaRow}>
                  <View style={styles.statusPill}>
                    <Text style={styles.statusText}>{PROJECT_STATUS_LABEL[item.status] || item.status}</Text>
                  </View>
                  <Text style={styles.count}>{item.active_tasks_count ?? 0} tâches actives</Text>
                </View>
                {item.tasks_count ? (
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${Math.round(((item.completed_tasks_count ?? 0) / item.tasks_count) * 100)}%` }]} />
                  </View>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </View>
          </Card>
        )}
      />

      {isWorkspaceAdmin && (
        <>
          <Pressable style={styles.fab} onPress={() => setCreateOpen(true)}>
            <Ionicons name="add" size={26} color={colors.white} />
          </Pressable>

          <CreateProjectModal
            visible={createOpen}
            onClose={() => setCreateOpen(false)}
            workspaceId={workspaceId}
            onCreated={load}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  listContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
  card: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center' },
  flex1: { flex: 1, marginRight: spacing.sm },
  name: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  description: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, gap: spacing.sm },
  statusPill: { backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  statusText: { color: colors.textSecondary, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  count: { color: colors.textMuted, fontSize: 11 },
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: colors.surfaceAlt, overflow: 'hidden', marginTop: spacing.sm },
  progressFill: { height: '100%', backgroundColor: colors.success },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 52,
    height: 52,
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
