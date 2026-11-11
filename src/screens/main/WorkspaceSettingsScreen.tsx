// Mirrors AXETASKS/src/components/settings/SettingsView.tsx: the
// "Membres de l'Espace", "Tags & Labels" and "Détails de l'Espace" tabs.
// The web view's "Gestion des Profils & Admin" (global users) tab already
// exists on mobile as TeamManagementScreen, and "Sons & Alertes" has no
// mobile equivalent (no Web Audio API here) so both are left out.
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Alert, Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { WorkspaceMember, Tag, WorkspaceRole, User } from '../../types';
import { colors, spacing, radius } from '../../theme';
import { Avatar, Button, TextField, Card, LoadingScreen } from '../../components/ui';
import { pickAndResizeImageAsDataUrl } from '../../lib/image';

const PRESET_COLORS = ['#2563EB', '#3B82F6', '#60A5FA', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

type Tab = 'members' | 'tags' | 'workspace';

export default function WorkspaceSettingsScreen({ route, navigation }: any) {
  const { workspaceId, name } = route.params;
  const { user } = useAuth();
  const { workspaces, refreshWorkspaces } = useWorkspace();

  const myRole = workspaces.find(w => w.id === workspaceId)?.my_role;
  const isGlobalAdmin = user?.role === 'admin';
  const isWorkspaceAdmin = isGlobalAdmin || myRole === 'admin';

  const [tab, setTab] = useState<Tab>('members');
  const [loading, setLoading] = useState(true);

  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);

  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [inviteSearch, setInviteSearch] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('member');
  const [invitingId, setInvitingId] = useState<string | null>(null);

  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#2563EB');
  const [creatingTag, setCreatingTag] = useState(false);

  const [wsName, setWsName] = useState(name);
  const [wsColor, setWsColor] = useState('#2563EB');
  const [wsPhotoUrl, setWsPhotoUrl] = useState<string | null>(null);
  const [pickingPhoto, setPickingPhoto] = useState(false);
  const [savingWs, setSavingWs] = useState(false);

  const load = useCallback(async () => {
    try {
      const [mems, tgs, usrs] = await Promise.all([
        api.getWorkspaceMembers(workspaceId),
        api.getWorkspaceTags(workspaceId),
        api.getUsers(),
      ]);
      setMembers(mems);
      setTags(tgs);
      setAllUsers(usrs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useFocusEffect(
    useCallback(() => {
      const ws = workspaces.find(w => w.id === workspaceId);
      if (ws) {
        setWsName(ws.name);
        setWsColor(ws.color);
        setWsPhotoUrl(ws.photo_url || null);
      }
    }, [workspaces, workspaceId])
  );

  const onInvite = async (target: User) => {
    setInvitingId(target.id);
    try {
      await api.addWorkspaceMember(workspaceId, target.id, inviteRole);
      load();
    } catch (err: any) {
      Alert.alert('Erreur', err.message || "Impossible d'ajouter ce membre.");
    } finally {
      setInvitingId(null);
    }
  };

  const memberIds = new Set(members.map(m => m.user_id));
  const q = inviteSearch.trim().toLowerCase();
  const invitableUsers = allUsers.filter(u =>
    !memberIds.has(u.id) && (!q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
  );

  const onChangeMemberRole = (member: WorkspaceMember) => {
    if (!isWorkspaceAdmin || member.user_id === user?.id) return;
    const nextRole: WorkspaceRole = member.role === 'admin' ? 'member' : 'admin';
    Alert.alert(
      'Changer le rôle',
      `Rendre ${member.user?.name} ${nextRole === 'admin' ? 'administrateur' : 'membre'} de cet espace ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            try {
              await api.updateWorkspaceMember(member.id, nextRole);
              load();
            } catch (err: any) {
              Alert.alert('Erreur', err.message || 'Impossible de modifier le rôle.');
            }
          },
        },
      ]
    );
  };

  const onRemoveMember = (member: WorkspaceMember) => {
    Alert.alert(
      "Retirer le membre",
      `Voulez-vous retirer ${member.user?.name} de cet espace de travail ? Il perdra l'accès à tous les projets de cet espace.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.removeWorkspaceMember(member.id);
              load();
            } catch (err: any) {
              Alert.alert('Erreur', err.message || 'Impossible de retirer ce membre.');
            }
          },
        },
      ]
    );
  };

  const onCreateTag = async () => {
    if (!newTagName.trim()) return;
    setCreatingTag(true);
    try {
      await api.createWorkspaceTag(workspaceId, newTagName.trim(), newTagColor);
      setNewTagName('');
      load();
    } catch (err: any) {
      Alert.alert('Erreur', err.message || 'Impossible de créer ce tag.');
    } finally {
      setCreatingTag(false);
    }
  };

  const onDeleteTag = (tag: Tag) => {
    Alert.alert('Supprimer le tag', `Supprimer le tag "${tag.name}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteWorkspaceTag(tag.id);
            load();
          } catch (err) {
            console.error(err);
          }
        },
      },
    ]);
  };

  const onPickWorkspacePhoto = async () => {
    setPickingPhoto(true);
    try {
      const dataUrl = await pickAndResizeImageAsDataUrl();
      if (dataUrl) setWsPhotoUrl(dataUrl);
    } catch (err: any) {
      Alert.alert('Erreur', err.message || "Impossible de traiter l'image.");
    } finally {
      setPickingPhoto(false);
    }
  };

  const onSaveWorkspace = async () => {
    if (!wsName.trim()) return;
    setSavingWs(true);
    try {
      await api.updateWorkspace(workspaceId, { name: wsName.trim(), color: wsColor, photo_url: wsPhotoUrl || undefined });
      await refreshWorkspaces();
      navigation.setOptions({ title: wsName.trim() });
      Alert.alert('Espace mis à jour', 'Les modifications ont été enregistrées.');
    } catch (err: any) {
      Alert.alert('Erreur', err.message || "Impossible de mettre à jour l'espace.");
    } finally {
      setSavingWs(false);
    }
  };

  const onDeleteWorkspace = () => {
    Alert.alert(
      `Supprimer "${wsName}"`,
      'Cette action est DÉFINITIVE. Tous les projets, tâches et données associés seront détruits définitivement.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer définitivement',
          style: 'destructive',
          onPress: async () => {
            try {
              setSavingWs(true);
              await api.deleteWorkspace(workspaceId);
              await refreshWorkspaces();
              navigation.navigate('MainTabs', { screen: 'Workspaces' });
            } catch (err: any) {
              Alert.alert('Erreur', err.message || "Erreur lors de la suppression de l'espace.");
            } finally {
              setSavingWs(false);
            }
          },
        },
      ]
    );
  };

  if (loading) return <LoadingScreen label="Chargement des paramètres…" />;

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        <Pressable style={[styles.tab, tab === 'members' && styles.tabActive]} onPress={() => setTab('members')}>
          <Ionicons name="people-outline" size={14} color={tab === 'members' ? colors.primarySoft : colors.textMuted} />
          <Text style={[styles.tabText, tab === 'members' && styles.tabTextActive]}>Membres ({members.length})</Text>
        </Pressable>
        <Pressable style={[styles.tab, tab === 'tags' && styles.tabActive]} onPress={() => setTab('tags')}>
          <Ionicons name="pricetag-outline" size={14} color={tab === 'tags' ? colors.primarySoft : colors.textMuted} />
          <Text style={[styles.tabText, tab === 'tags' && styles.tabTextActive]}>Tags ({tags.length})</Text>
        </Pressable>
        {isWorkspaceAdmin && (
          <Pressable style={[styles.tab, tab === 'workspace' && styles.tabActive]} onPress={() => setTab('workspace')}>
            <Ionicons name="briefcase-outline" size={14} color={tab === 'workspace' ? colors.primarySoft : colors.textMuted} />
            <Text style={[styles.tabText, tab === 'workspace' && styles.tabTextActive]}>Espace</Text>
          </Pressable>
        )}
      </View>

      {tab === 'members' && (
        <FlatList
          data={members}
          keyExtractor={m => m.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            isWorkspaceAdmin ? (
              <Card style={styles.formCard}>
                <Text style={styles.formTitle}>Ajouter un utilisateur à l'espace</Text>
                <TextField
                  placeholder="Filtrer par nom ou email..."
                  value={inviteSearch}
                  onChangeText={setInviteSearch}
                  autoCapitalize="none"
                />
                <View style={styles.roleRow}>
                  <Pressable
                    style={[styles.roleChip, inviteRole === 'member' && styles.roleChipActive]}
                    onPress={() => setInviteRole('member')}
                  >
                    <Text style={[styles.roleChipText, inviteRole === 'member' && styles.roleChipTextActive]}>Membre</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.roleChip, inviteRole === 'admin' && styles.roleChipActive]}
                    onPress={() => setInviteRole('admin')}
                  >
                    <Text style={[styles.roleChipText, inviteRole === 'admin' && styles.roleChipTextActive]}>Admin</Text>
                  </Pressable>
                </View>
                {invitableUsers.length === 0 ? (
                  <Text style={styles.emptyText}>Tous les utilisateurs sont déjà membres de cet espace.</Text>
                ) : invitableUsers.map(u => (
                  <View key={u.id} style={styles.memberRow}>
                    <Avatar user={u} size={32} />
                    <View style={styles.flex1}>
                      <Text style={styles.memberName}>{u.name}</Text>
                      <Text style={styles.memberEmail}>{u.email}</Text>
                    </View>
                    <Button title="Ajouter à l'espace" onPress={() => onInvite(u)} loading={invitingId === u.id} disabled={!!invitingId} />
                  </View>
                ))}
              </Card>
            ) : (
              <View style={styles.noticeBox}>
                <Ionicons name="shield-outline" size={16} color={colors.primarySoft} />
                <Text style={styles.noticeText}>Seuls les administrateurs de cet espace peuvent inviter ou modifier les rôles.</Text>
              </View>
            )
          }
          ListEmptyComponent={<Text style={styles.emptyText}>Aucun membre pour l'instant.</Text>}
          renderItem={({ item }) => (
            <Card style={styles.rowCard}>
              <View style={styles.memberRow}>
                <Avatar user={item.user} size={36} />
                <View style={styles.flex1}>
                  <Text style={styles.memberName}>{item.user?.name}{item.user_id === user?.id ? '  (Vous)' : ''}</Text>
                  <Text style={styles.memberEmail}>{item.user?.email}</Text>
                  <Text style={styles.memberFunction}>Fonction : {item.user?.job_function?.name || '—'}</Text>
                </View>
                <Pressable
                  disabled={!isWorkspaceAdmin || item.user_id === user?.id}
                  style={[styles.rolePill, item.role === 'admin' && styles.rolePillAdmin]}
                  onPress={() => onChangeMemberRole(item)}
                >
                  <Text style={[styles.roleText, item.role === 'admin' && styles.roleTextAdmin]}>
                    {item.role === 'admin' ? 'Admin' : 'Membre'}
                  </Text>
                </Pressable>
                {isWorkspaceAdmin && item.user_id !== user?.id && (
                  <Pressable onPress={() => onRemoveMember(item)} hitSlop={8} style={styles.deleteBtn}>
                    <Ionicons name="trash-outline" size={16} color={colors.danger} />
                  </Pressable>
                )}
              </View>
            </Card>
          )}
        />
      )}

      {tab === 'tags' && (
        <FlatList
          data={tags}
          keyExtractor={t => t.id}
          numColumns={1}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <Card style={styles.formCard}>
              <Text style={styles.formTitle}>Créer un tag</Text>
              <TextField
                placeholder="Nom du tag (ex: Bug, Urgent...)"
                value={newTagName}
                onChangeText={setNewTagName}
              />
              <View style={styles.colorRow}>
                {PRESET_COLORS.map(c => (
                  <Pressable
                    key={c}
                    onPress={() => setNewTagColor(c)}
                    style={[styles.colorSwatch, { backgroundColor: c }, newTagColor === c && styles.colorSwatchActive]}
                  />
                ))}
              </View>
              <Button title="Créer le tag" onPress={onCreateTag} loading={creatingTag} fullWidth />
            </Card>
          }
          ListEmptyComponent={<Text style={styles.emptyText}>Aucun tag créé pour l'instant.</Text>}
          renderItem={({ item }) => (
            <View style={[styles.tagChip, { backgroundColor: `${item.color}26`, borderColor: `${item.color}66` }]}>
              <View style={[styles.tagDot, { backgroundColor: item.color }]} />
              <Text style={[styles.tagText, { color: item.color }]}>{item.name}</Text>
              <Pressable onPress={() => onDeleteTag(item)} hitSlop={8}>
                <Ionicons name="close" size={14} color={item.color} />
              </Pressable>
            </View>
          )}
        />
      )}

      {tab === 'workspace' && isWorkspaceAdmin && (
        <View style={styles.listContent}>
          <Card style={styles.formCard}>
            <Text style={styles.formTitle}>Personnalisation de l'espace</Text>
            <Pressable style={styles.photoPicker} onPress={onPickWorkspacePhoto} disabled={pickingPhoto}>
              {wsPhotoUrl ? (
                <Image source={{ uri: wsPhotoUrl }} style={styles.photoPreview} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Ionicons name="image-outline" size={20} color={colors.textMuted} />
                </View>
              )}
              <Text style={styles.photoPickerText}>{pickingPhoto ? 'Chargement…' : 'Changer la photo'}</Text>
            </Pressable>
            <TextField label="Nom de l'espace" value={wsName} onChangeText={setWsName} />
            <Text style={styles.colorLabel}>Couleur thématique</Text>
            <View style={styles.colorRow}>
              {PRESET_COLORS.map(c => (
                <Pressable
                  key={c}
                  onPress={() => setWsColor(c)}
                  style={[styles.colorSwatchLg, { backgroundColor: c }, wsColor === c && styles.colorSwatchActive]}
                />
              ))}
            </View>
            <Button title="Enregistrer les modifications" onPress={onSaveWorkspace} loading={savingWs} fullWidth />
          </Card>

          <View style={styles.dangerZone}>
            <Text style={styles.dangerTitle}>Zone dangereuse</Text>
            <Text style={styles.dangerText}>
              La suppression d'un espace de travail est définitive. Tous les projets, tâches, tags et membres qui y sont rattachés seront détruits de manière permanente.
            </Text>
            <Button title="Supprimer l'espace de travail" variant="danger" onPress={onDeleteWorkspace} loading={savingWs} fullWidth />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  tabs: {
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.sm,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  tabActive: { backgroundColor: `${colors.primary}26` },
  tabText: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  tabTextActive: { color: colors.primarySoft },
  listContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
  formCard: { marginBottom: spacing.lg, gap: spacing.sm },
  formTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: '700', marginBottom: spacing.xs },
  photoPicker: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  photoPreview: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  photoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPickerText: { color: colors.primarySoft, fontSize: 12, fontWeight: '700' },
  roleRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  roleChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  roleChipActive: { backgroundColor: `${colors.primary}26`, borderColor: colors.primary },
  roleChipText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  roleChipTextActive: { color: colors.primarySoft },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  noticeText: { flex: 1, color: colors.textMuted, fontSize: 12 },
  emptyText: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: spacing.xl, fontStyle: 'italic' },
  rowCard: { marginBottom: spacing.sm },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex1: { flex: 1 },
  memberName: { color: colors.textPrimary, fontSize: 13, fontWeight: '700' },
  memberEmail: { color: colors.textMuted, fontSize: 11, marginTop: 1 },
  memberFunction: { color: colors.primarySoft, fontSize: 10, fontWeight: '600', marginTop: 1 },
  rolePill: { backgroundColor: colors.surfaceAlt, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  rolePillAdmin: { backgroundColor: `${colors.primary}26` },
  roleText: { color: colors.textSecondary, fontSize: 11, fontWeight: '700' },
  roleTextAdmin: { color: colors.primarySoft },
  deleteBtn: { marginLeft: spacing.sm },
  colorRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md, flexWrap: 'wrap' },
  colorLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: spacing.xs },
  colorSwatch: { width: 24, height: 24, borderRadius: radius.sm },
  colorSwatchLg: { width: 30, height: 30, borderRadius: radius.sm },
  colorSwatchActive: { borderWidth: 2, borderColor: colors.white },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    marginBottom: spacing.sm,
  },
  tagDot: { width: 6, height: 6, borderRadius: 3 },
  tagText: { fontSize: 12, fontWeight: '700' },
  dangerZone: {
    backgroundColor: `${colors.danger}0D`,
    borderWidth: 1,
    borderColor: `${colors.danger}33`,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  dangerTitle: { color: colors.danger, fontSize: 13, fontWeight: '800', textTransform: 'uppercase' },
  dangerText: { color: colors.danger, opacity: 0.85, fontSize: 12, lineHeight: 17 },
});
