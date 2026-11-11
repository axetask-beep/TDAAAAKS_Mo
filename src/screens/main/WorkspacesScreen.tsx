import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { colors, spacing, radius } from '../../theme';
import { Card, EmptyState, LoadingScreen } from '../../components/ui';
import CreateWorkspaceModal from '../../components/modals/CreateWorkspaceModal';

export default function WorkspacesScreen({ navigation }: any) {
  const { user } = useAuth();
  const { workspaces, loading, refreshWorkspaces, setCurrentWorkspaceId } = useWorkspace();
  const insets = useSafeAreaInsets();
  const [createOpen, setCreateOpen] = useState(false);
  const isAdmin = user?.role === 'admin';

  useFocusEffect(
    useCallback(() => {
      refreshWorkspaces();
    }, [refreshWorkspaces])
  );

  if (loading && workspaces.length === 0) return <LoadingScreen label="Chargement des espaces…" />;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.title}>Espaces de travail</Text>
        {isAdmin && (
          <Pressable style={styles.addButton} onPress={() => setCreateOpen(true)}>
            <Ionicons name="add" size={22} color={colors.white} />
          </Pressable>
        )}
      </View>

      <FlatList
        data={workspaces}
        keyExtractor={w => w.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <EmptyState icon="🗂️" title="Aucun espace de travail" subtitle="Créez votre premier espace pour commencer." />
        }
        renderItem={({ item }) => (
          <Card
            style={styles.card}
            onPress={() => {
              setCurrentWorkspaceId(item.id);
              navigation.navigate('WorkspaceDetail', { workspaceId: item.id, name: item.name });
            }}
          >
            <View style={styles.row}>
              {item.photo_url ? (
                <Image source={{ uri: item.photo_url }} style={styles.photo} />
              ) : (
                <View style={[styles.iconWrap, { backgroundColor: `${item.color || colors.primary}26` }]}>
                  <Ionicons name="briefcase-outline" size={18} color={item.color || colors.primary} />
                </View>
              )}
              <View style={styles.flex1}>
                <Text style={styles.wsName}>{item.name}</Text>
                <Text style={styles.wsMeta}>
                  {item.projects_count ?? 0} projet{(item.projects_count ?? 0) > 1 ? 's' : ''} · {item.member_count ?? 0} membre{(item.member_count ?? 0) > 1 ? 's' : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </View>
          </Card>
        )}
      />

      {isAdmin && (
        <CreateWorkspaceModal visible={createOpen} onClose={() => setCreateOpen(false)} onCreated={refreshWorkspaces} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: { color: colors.textPrimary, fontSize: 22, fontWeight: '800' },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  card: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center' },
  photo: { width: 40, height: 40, borderRadius: radius.md, marginRight: spacing.md, backgroundColor: colors.surfaceAlt },
  iconWrap: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  flex1: { flex: 1 },
  wsName: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  wsMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
});
