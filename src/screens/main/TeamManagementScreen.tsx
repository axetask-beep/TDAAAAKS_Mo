import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Alert, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { User, JobFunction } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, radius } from '../../theme';
import { Avatar, Card, LoadingScreen, TextField } from '../../components/ui';
import CreateUserModal from '../../components/modals/CreateUserModal';

const ONLINE_WINDOW_MS = 90_000;

function isOnline(u?: Pick<User, 'last_seen_at'>): boolean {
  if (!u?.last_seen_at) return false;
  return Date.now() - new Date(u.last_seen_at).getTime() < ONLINE_WINDOW_MS;
}

export default function TeamManagementScreen({ navigation }: any) {
  const { user: me } = useAuth();
  const isGlobalAdmin = me?.role === 'admin';
  const [users, setUsers] = useState<User[]>([]);
  const [jobFunctions, setJobFunctions] = useState<JobFunction[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newFunctionName, setNewFunctionName] = useState('');
  const [creatingFunction, setCreatingFunction] = useState(false);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  useEffect(() => {
    navigation.setOptions({ title: isGlobalAdmin ? "Gestion de l'équipe" : "L'équipe" });
  }, [isGlobalAdmin]);

  const load = useCallback(async () => {
    try {
      const [userList, fnList] = await Promise.all([api.getUsers(), api.getJobFunctions()]);
      setUsers(userList);
      setJobFunctions(fnList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleRole = (u: User) => {
    const nextRole = u.role === 'admin' ? 'member' : 'admin';
    Alert.alert(
      'Changer le rôle',
      `Rendre ${u.name} ${nextRole === 'admin' ? 'administrateur' : 'membre'} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            try {
              await api.updateUserRole(u.id, nextRole);
              load();
            } catch (err: any) {
              Alert.alert('Erreur', err.message || 'Impossible de modifier le rôle.');
            }
          },
        },
      ]
    );
  };

  const assignFunction = async (userId: string, functionId: string | null) => {
    try {
      await api.setUserFunction(userId, functionId);
      load();
    } catch (err: any) {
      Alert.alert('Erreur', err.message || "Impossible d'assigner cette fonction.");
    }
  };

  const removeUser = (u: User) => {
    if (u.id === me?.id) return;
    Alert.alert('Supprimer ce compte', `Supprimer définitivement le compte de ${u.name} ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteUser(u.id);
            load();
          } catch (err: any) {
            Alert.alert('Erreur', err.message || 'Suppression impossible.');
          }
        },
      },
    ]);
  };

  const createFunction = async () => {
    if (!newFunctionName.trim()) return;
    setCreatingFunction(true);
    try {
      await api.createJobFunction(newFunctionName.trim());
      setNewFunctionName('');
      load();
    } catch (err: any) {
      Alert.alert('Erreur', err.message || 'Impossible de créer cette fonction.');
    } finally {
      setCreatingFunction(false);
    }
  };

  const deleteFunction = (fn: JobFunction) => {
    Alert.alert('Supprimer la fonction', `Supprimer la fonction "${fn.name}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteJobFunction(fn.id);
            load();
          } catch (err: any) {
            Alert.alert('Erreur', err.message || 'Suppression impossible.');
          }
        },
      },
    ]);
  };

  if (loading) return <LoadingScreen label="Chargement de l'équipe…" />;

  return (
    <View style={styles.container}>
      <FlatList
        data={users}
        keyExtractor={u => u.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          isGlobalAdmin ? (
            <Card style={styles.functionsCard}>
              <Text style={styles.functionsTitle}>Fonctions / Postes de l'entreprise</Text>
              <View style={styles.functionsList}>
                {jobFunctions.map(fn => (
                  <View key={fn.id} style={styles.functionTag}>
                    <Text style={styles.functionTagText}>{fn.name}</Text>
                    <Pressable onPress={() => deleteFunction(fn)} hitSlop={8}>
                      <Ionicons name="close" size={12} color={colors.textMuted} />
                    </Pressable>
                  </View>
                ))}
                {jobFunctions.length === 0 && <Text style={styles.emptyFunctions}>Aucune fonction définie.</Text>}
              </View>
              <View style={styles.addFunctionRow}>
                <TextField
                  placeholder="Ex: DEV, Monteur vidéo…"
                  value={newFunctionName}
                  onChangeText={setNewFunctionName}
                  containerStyle={{ flex: 1, marginBottom: 0 }}
                />
                <Pressable onPress={createFunction} style={styles.addFunctionBtn} disabled={creatingFunction}>
                  <Ionicons name="add" size={18} color={colors.white} />
                </Pressable>
              </View>
            </Card>
          ) : (
            <Text style={styles.readOnlyTitle}>Répertoire des utilisateurs de l'application</Text>
          )
        }
        renderItem={({ item }) => {
          const expanded = expandedUserId === item.id;
          const online = isOnline(item);

          if (!isGlobalAdmin) {
            // Read-only directory for regular members: identity, function and
            // live status only — no role/function/delete controls.
            return (
              <Card style={styles.card}>
                <View style={styles.row}>
                  <Avatar user={item} size={40} />
                  <View style={styles.flex1}>
                    <Text style={styles.name}>{item.name}{item.id === me?.id ? '  (Vous)' : ''}</Text>
                    <Text style={styles.email}>{item.email}</Text>
                    <Text style={styles.function}>{item.job_function?.name || 'Aucune fonction'}</Text>
                  </View>
                  <View style={[styles.statusPill, online ? styles.statusPillOnline : styles.statusPillOffline]}>
                    <View style={[styles.statusDot, { backgroundColor: online ? colors.success : colors.textMuted }]} />
                    <Text style={[styles.statusPillText, online && styles.statusPillTextOnline]}>
                      {online ? 'En ligne' : 'Hors ligne'}
                    </Text>
                  </View>
                </View>
              </Card>
            );
          }

          return (
            <Card style={styles.card}>
              <Pressable style={styles.row} onPress={() => setExpandedUserId(expanded ? null : item.id)}>
                <Avatar user={item} size={40} />
                <View style={styles.flex1}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name}>{item.name}</Text>
                    <View style={[styles.statusPill, online ? styles.statusPillOnline : styles.statusPillOffline]}>
                      <View style={[styles.statusDot, { backgroundColor: online ? colors.success : colors.textMuted }]} />
                      <Text style={[styles.statusPillText, online && styles.statusPillTextOnline]}>
                        {online ? 'En ligne' : 'Hors ligne'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.email}>{item.email}</Text>
                  {item.job_function ? <Text style={styles.function}>{item.job_function.name}</Text> : null}
                </View>
                <Pressable style={[styles.rolePill, item.role === 'admin' && styles.rolePillAdmin]} onPress={() => toggleRole(item)}>
                  <Text style={[styles.roleText, item.role === 'admin' && styles.roleTextAdmin]}>
                    {item.role === 'admin' ? 'Admin' : 'Membre'}
                  </Text>
                </Pressable>
                {item.id !== me?.id && (
                  <Pressable onPress={() => removeUser(item)} hitSlop={8} style={{ marginLeft: spacing.sm }}>
                    <Ionicons name="trash-outline" size={18} color={colors.danger} />
                  </Pressable>
                )}
              </Pressable>

              {expanded && (
                <View style={styles.functionPickerRow}>
                  <Text style={styles.functionPickerLabel}>Fonction :</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <Pressable
                      style={[styles.functionOption, !item.function_id && styles.functionOptionActive]}
                      onPress={() => assignFunction(item.id, null)}
                    >
                      <Text style={styles.functionOptionText}>Aucune</Text>
                    </Pressable>
                    {jobFunctions.map(fn => (
                      <Pressable
                        key={fn.id}
                        style={[styles.functionOption, item.function_id === fn.id && styles.functionOptionActive]}
                        onPress={() => assignFunction(item.id, fn.id)}
                      >
                        <Text style={styles.functionOptionText}>{fn.name}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
            </Card>
          );
        }}
      />

      {isGlobalAdmin && (
        <>
          <Pressable style={styles.fab} onPress={() => setCreateOpen(true)}>
            <Ionicons name="person-add-outline" size={22} color={colors.white} />
          </Pressable>

          <CreateUserModal visible={createOpen} onClose={() => setCreateOpen(false)} onCreated={load} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  listContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
  functionsCard: { marginBottom: spacing.lg, gap: spacing.sm },
  functionsTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: '700' },
  functionsList: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  functionTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  functionTagText: { color: colors.textSecondary, fontSize: 11, fontWeight: '600' },
  emptyFunctions: { color: colors.textMuted, fontSize: 12, fontStyle: 'italic' },
  addFunctionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  addFunctionBtn: { width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  readOnlyTitle: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: spacing.md,
  },
  card: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex1: { flex: 1 },
  name: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
  email: { color: colors.textMuted, fontSize: 12 },
  function: { color: colors.primarySoft, fontSize: 11, fontWeight: '600', marginTop: 1 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderWidth: 1,
  },
  statusPillOnline: { backgroundColor: `${colors.success}1A`, borderColor: `${colors.success}55` },
  statusPillOffline: { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusPillText: { color: colors.textMuted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  statusPillTextOnline: { color: colors.success },
  rolePill: { backgroundColor: colors.surfaceAlt, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  rolePillAdmin: { backgroundColor: `${colors.primary}26` },
  roleText: { color: colors.textSecondary, fontSize: 11, fontWeight: '700' },
  roleTextAdmin: { color: colors.primarySoft },
  functionPickerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderColor: colors.border },
  functionPickerLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  functionOption: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    marginRight: spacing.xs,
  },
  functionOptionActive: { borderColor: colors.primary, backgroundColor: `${colors.primary}26` },
  functionOptionText: { color: colors.textPrimary, fontSize: 11, fontWeight: '600' },
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
