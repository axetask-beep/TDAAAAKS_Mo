// Mirrors AXETASKS/src/components/time/TimeTrackingView.tsx: a "Vue
// d'ensemble" tab (per-member time allocation, drilling workspace → project
// → tasks, with an admin-only "tous les membres" table) and a secondary
// "Historique" tab (every started task with its real chrono time, CSV export).
// The web version's CSV export triggers a browser download via a Blob URL;
// here the same CSV is written to a file (expo-file-system) and handed to
// the OS share sheet (expo-sharing) since there's no download folder.
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Pressable, TextInput, Alert, Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { api } from '../../lib/api';
import { TimeAllocationWorkspace, TimeAllocationTask, User } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { colors, spacing, radius } from '../../theme';
import { Card, Chip, EmptyState, LoadingScreen, Avatar } from '../../components/ui';
import { formatDate } from '../../lib/format';

type MainTab = 'overview' | 'history';
type Period = 'all' | 'week' | 'month';

function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function TimeTrackingScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const { workspaces } = useWorkspace();
  const isAdmin = user?.role === 'admin';
  const [mainTab, setMainTab] = useState<MainTab>('overview');

  /* ---------- OVERVIEW (allocation) ---------- */
  const [scope, setScope] = useState<'me' | 'all'>('me');
  const [myAllocation, setMyAllocation] = useState<TimeAllocationWorkspace[]>([]);
  const [allAllocation, setAllAllocation] = useState<{ user: User; workspaces: TimeAllocationWorkspace[] }[]>([]);
  const [loadingAllocation, setLoadingAllocation] = useState(true);
  const [drillWorkspaceId, setDrillWorkspaceId] = useState<string | null>(null);
  const [drillProjectId, setDrillProjectId] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState('');

  const loadAllocation = useCallback(async () => {
    try {
      setLoadingAllocation(true);
      if (scope === 'all' && isAdmin) {
        setAllAllocation(await api.getAllMembersTimeAllocation());
      } else {
        setMyAllocation(await api.getMyTimeAllocation());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAllocation(false);
    }
  }, [scope, isAdmin]);

  useFocusEffect(useCallback(() => {
    loadAllocation();
    setDrillWorkspaceId(null);
    setDrillProjectId(null);
  }, [mainTab, loadAllocation]));

  const drillWorkspace = myAllocation.find(w => w.id === drillWorkspaceId) || null;
  const drillProject = drillWorkspace?.projects.find(p => p.id === drillProjectId) || null;

  const allMemberRows = allAllocation.flatMap(({ user: member, workspaces: wss }) =>
    wss.flatMap(ws => ws.projects.map(prj => ({ member, ws, prj })))
  ).filter(row => {
    if (!memberSearch.trim()) return true;
    const q = memberSearch.trim().toLowerCase();
    return row.member.name.toLowerCase().includes(q) || row.member.email.toLowerCase().includes(q);
  });

  /* ---------- HISTORY: one row per started task, from the task chrono ---------- */
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('all');
  const [period, setPeriod] = useState<Period>('all');
  const [search, setSearch] = useState('');

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAllocation();
    setRefreshing(false);
  };

  const showAll = scope === 'all' && isAdmin;
  const historySource: { member: User | null; wss: TimeAllocationWorkspace[] }[] = showAll
    ? allAllocation.map(a => ({ member: a.user, wss: a.workspaces }))
    : [{ member: null, wss: myAllocation }];

  const historyRows = historySource
    .flatMap(({ member, wss }) => wss.flatMap(ws => ws.projects.flatMap(prj => prj.tasks.map(t => ({ member, ws, prj, t })))))
    .filter(({ member, ws, prj, t }) => {
      if (!t.start_at || new Date(t.start_at).getTime() > Date.now()) return false; // not started yet
      if (selectedWorkspaceId !== 'all' && ws.id !== selectedWorkspaceId) return false;
      const days = period === 'week' ? 7 : period === 'month' ? 30 : 0;
      if (days && new Date(t.start_at).getTime() < Date.now() - days * 86400000) return false;
      const q = search.trim().toLowerCase();
      if (q && !(t.title.toLowerCase().includes(q) || prj.name.toLowerCase().includes(q) || member?.name.toLowerCase().includes(q))) return false;
      return true;
    })
    .sort((a, b) => new Date(b.t.start_at!).getTime() - new Date(a.t.start_at!).getTime());

  const lateMinutes = (t: TimeAllocationTask) => {
    if (!t.end_at) return 0;
    const finish = t.completed_at ? new Date(t.completed_at).getTime() : Date.now();
    return Math.max(0, Math.round((finish - new Date(t.end_at).getTime()) / 60000));
  };
  const resultLabel = (t: TimeAllocationTask) => {
    const late = lateMinutes(t);
    if (t.completed_at) return late > 0 ? `Terminée en retard (+${formatMinutes(late)})` : 'Terminée à temps';
    return late > 0 ? `En retard (+${formatMinutes(late)})` : 'En cours';
  };

  const totalMinutes = historyRows.reduce((sum, r) => sum + r.t.logged_minutes, 0);
  const doneCount = historyRows.filter(r => r.t.completed_at).length;
  const lateCount = historyRows.filter(r => lateMinutes(r.t) > 0).length;

  const handleExportCSV = async () => {
    if (historyRows.length === 0) {
      Alert.alert('Rien à exporter', 'Aucune tâche ne correspond aux filtres actuels.');
      return;
    }
    setExporting(true);
    try {
      const q = (v: string) => `"${v.replace(/"/g, '""')}"`;
      const headers = ['Membre', 'Tache', 'Projet', 'Espace', 'Commencee le', 'Terminee le', 'Temps passe (heures)', 'Resultat'];
      const rows = historyRows.map(({ member, ws, prj, t }) => [
        q(member?.name || user?.name || ''),
        q(t.title),
        q(prj.name),
        q(ws.name),
        q(t.start_at ? formatDate(t.start_at) : ''),
        q(t.completed_at ? formatDate(t.completed_at) : ''),
        (t.logged_minutes / 60).toFixed(2),
        q(resultLabel(t)),
      ]);
      const csvContent = '﻿' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');

      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const file = new File(Paths.cache, `AxeTask_Historique_${stamp}.csv`);
      file.create();
      file.write(csvContent);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: "Exporter l'historique" });
      } else {
        Alert.alert('Export prêt', `Fichier enregistré : ${file.uri}`);
      }
    } catch (err: any) {
      Alert.alert('Erreur', err.message || "Impossible d'exporter le CSV.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Mon temps</Text>
          {mainTab === 'history' && (
            <Pressable style={styles.exportBtn} onPress={handleExportCSV} disabled={exporting}>
              <Ionicons name="download-outline" size={14} color={colors.white} />
              <Text style={styles.exportText}>{exporting ? 'Export…' : 'Export CSV'}</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.mainTabs}>
          <Pressable style={[styles.mainTab, mainTab === 'overview' && styles.mainTabActive]} onPress={() => setMainTab('overview')}>
            <Ionicons name="grid-outline" size={13} color={mainTab === 'overview' ? colors.primarySoft : colors.textMuted} />
            <Text style={[styles.mainTabText, mainTab === 'overview' && styles.mainTabTextActive]}>Vue d'ensemble</Text>
          </Pressable>
          <Pressable style={[styles.mainTab, mainTab === 'history' && styles.mainTabActive]} onPress={() => setMainTab('history')}>
            <Ionicons name="time-outline" size={13} color={mainTab === 'history' ? colors.primarySoft : colors.textMuted} />
            <Text style={[styles.mainTabText, mainTab === 'history' && styles.mainTabTextActive]}>Historique</Text>
          </Pressable>
        </View>
      </View>

      {mainTab === 'overview' ? (
        <FlatList
          data={[{ key: 'content' }]}
          keyExtractor={i => i.key}
          contentContainerStyle={styles.listContent}
          renderItem={() => (
            <View>
              {isAdmin && (
                <View style={styles.scopeRow}>
                  <Pressable style={[styles.scopeBtn, scope === 'me' && styles.scopeBtnActive]} onPress={() => setScope('me')}>
                    <Text style={[styles.scopeBtnText, scope === 'me' && styles.scopeBtnTextActive]}>Mes données</Text>
                  </Pressable>
                  <Pressable style={[styles.scopeBtn, scope === 'all' && styles.scopeBtnActive]} onPress={() => setScope('all')}>
                    <Ionicons name="people-outline" size={13} color={scope === 'all' ? colors.white : colors.textMuted} />
                    <Text style={[styles.scopeBtnText, scope === 'all' && styles.scopeBtnTextActive]}>Tous les membres</Text>
                  </Pressable>
                </View>
              )}

              {loadingAllocation ? (
                <Text style={styles.loadingText}>Chargement…</Text>
              ) : scope === 'all' && isAdmin ? (
                <View>
                  <View style={styles.searchWrap}>
                    <Ionicons name="search" size={14} color={colors.textMuted} style={styles.searchIcon} />
                    <TextInput
                      value={memberSearch}
                      onChangeText={setMemberSearch}
                      placeholder="Rechercher un membre..."
                      placeholderTextColor={colors.textMuted}
                      style={styles.searchInput}
                    />
                  </View>
                  {allMemberRows.length === 0 ? (
                    <EmptyState icon="⏱️" title="Aucune affectation" subtitle="Aucun membre n'a de tâches assignées pour le moment." />
                  ) : (
                  allMemberRows.map(({ member, ws, prj }) => (
                    <Card key={`${member.id}-${prj.id}`} style={styles.allocCard}>
                      <View style={styles.allocRow}>
                        <Avatar user={member} size={24} />
                        <Text style={styles.allocMember}>{member.name}</Text>
                      </View>
                      <Text style={styles.allocProject}>{prj.name} <Text style={styles.allocWs}>· {ws.name}</Text></Text>
                      <View style={styles.allocStats}>
                        <Text style={styles.allocAllocated}>Prévu : {formatMinutes(prj.allocated_minutes)}</Text>
                        <Text style={styles.allocLogged}>Passé : {formatMinutes(prj.logged_minutes)}</Text>
                      </View>
                    </Card>
                  ))
                  )}
                </View>
              ) : drillProject && drillWorkspace ? (
                <View>
                  <Pressable style={styles.backRow} onPress={() => setDrillProjectId(null)}>
                    <Ionicons name="arrow-back" size={14} color={colors.textMuted} />
                    <Text style={styles.backText}>{drillWorkspace.name}</Text>
                  </Pressable>
                  <Text style={styles.drillTitle}>{drillProject.name}</Text>
                  {drillProject.tasks.map(t => (
                    <Card key={t.id} style={styles.allocCard} onPress={() => navigation.navigate('TaskDetail', { taskId: t.id })}>
                      <Text style={styles.allocMember}>{t.title}</Text>
                      <View style={styles.allocStats}>
                        <Text style={styles.allocAllocated}>Prévu : {formatMinutes(t.allocated_minutes)}</Text>
                        <Text style={styles.allocLogged}>Passé : {formatMinutes(t.logged_minutes)}</Text>
                      </View>
                    </Card>
                  ))}
                </View>
              ) : drillWorkspace ? (
                <View>
                  <Pressable style={styles.backRow} onPress={() => setDrillWorkspaceId(null)}>
                    <Ionicons name="arrow-back" size={14} color={colors.textMuted} />
                    <Text style={styles.backText}>Tous les espaces</Text>
                  </Pressable>
                  <Text style={styles.drillTitle}>{drillWorkspace.name}</Text>
                  {drillWorkspace.projects.map(prj => (
                    <Card key={prj.id} style={styles.allocCard} onPress={() => setDrillProjectId(prj.id)}>
                      <View style={styles.allocRow}>
                        <Text style={styles.allocMember}>{prj.name}</Text>
                        <Text style={styles.allocWs}>{prj.tasks_count} tâche{prj.tasks_count > 1 ? 's' : ''}</Text>
                      </View>
                      <View style={styles.allocStats}>
                        <Text style={styles.allocAllocated}>Prévu : {formatMinutes(prj.allocated_minutes)}</Text>
                        <Text style={styles.allocLogged}>Passé : {formatMinutes(prj.logged_minutes)}</Text>
                      </View>
                    </Card>
                  ))}
                </View>
              ) : myAllocation.length === 0 ? (
                <EmptyState icon="⏱️" title="Aucun projet assigné" subtitle="Aucun projet ne vous est actuellement assigné." />
              ) : (
                myAllocation.map(ws => {
                  const allocated = ws.projects.reduce((s, p) => s + p.allocated_minutes, 0);
                  const logged = ws.projects.reduce((s, p) => s + p.logged_minutes, 0);
                  return (
                    <Card key={ws.id} style={styles.allocCard} onPress={() => setDrillWorkspaceId(ws.id)}>
                      <View style={styles.allocRow}>
                        {ws.photo_url ? (
                          <Image source={{ uri: ws.photo_url }} style={styles.wsPhoto} />
                        ) : (
                          <View style={[styles.wsIconWrap, { backgroundColor: `${ws.color}26` }]}>
                            <Ionicons name="layers-outline" size={16} color={ws.color} />
                          </View>
                        )}
                        <View style={styles.flex1}>
                          <Text style={styles.allocMember}>{ws.name}</Text>
                          <Text style={styles.allocWs}>{ws.projects.length} projet{ws.projects.length > 1 ? 's' : ''} assigné{ws.projects.length > 1 ? 's' : ''}</Text>
                        </View>
                      </View>
                      <View style={styles.allocStats}>
                        <Text style={styles.allocAllocated}>Prévu : {formatMinutes(allocated)}</Text>
                        <Text style={styles.allocLogged}>Passé : {formatMinutes(logged)}</Text>
                      </View>
                    </Card>
                  );
                })
              )}
            </View>
          )}
        />
      ) : (
        <>
          <View style={styles.historyHeader}>
            {isAdmin && (
              <View style={styles.scopeRow}>
                <Pressable style={[styles.scopeBtn, scope === 'me' && styles.scopeBtnActive]} onPress={() => setScope('me')}>
                  <Text style={[styles.scopeBtnText, scope === 'me' && styles.scopeBtnTextActive]}>Mes données</Text>
                </Pressable>
                <Pressable style={[styles.scopeBtn, scope === 'all' && styles.scopeBtnActive]} onPress={() => setScope('all')}>
                  <Ionicons name="people-outline" size={13} color={scope === 'all' ? colors.white : colors.textMuted} />
                  <Text style={[styles.scopeBtnText, scope === 'all' && styles.scopeBtnTextActive]}>Tous les membres</Text>
                </Pressable>
              </View>
            )}

            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{formatMinutes(totalMinutes)}</Text>
                <Text style={styles.statLabel}>Temps passé</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statValue, { color: colors.success }]}>{doneCount}</Text>
                <Text style={styles.statLabel}>Terminées</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statValue, { color: colors.danger }]}>{lateCount}</Text>
                <Text style={styles.statLabel}>En retard</Text>
              </View>
            </View>

            <View style={styles.searchWrap}>
              <Ionicons name="search" size={14} color={colors.textMuted} style={styles.searchIcon} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Rechercher une tâche, un projet..."
                placeholderTextColor={colors.textMuted}
                style={styles.searchInput}
              />
            </View>

            <View style={styles.chipsRow}>
              <Chip label="Tous les espaces" active={selectedWorkspaceId === 'all'} onPress={() => setSelectedWorkspaceId('all')} />
              {workspaces.map(ws => (
                <Chip
                  key={ws.id}
                  label={ws.name}
                  color={ws.color}
                  active={selectedWorkspaceId === ws.id}
                  onPress={() => setSelectedWorkspaceId(ws.id)}
                />
              ))}
            </View>
            <View style={styles.chipsRow}>
              <Chip label="Depuis le début" active={period === 'all'} onPress={() => setPeriod('all')} />
              <Chip label="7 derniers jours" active={period === 'week'} onPress={() => setPeriod('week')} />
              <Chip label="30 derniers jours" active={period === 'month'} onPress={() => setPeriod('month')} />
            </View>
          </View>

          {loadingAllocation && !refreshing ? (
            <LoadingScreen label="Chargement…" />
          ) : (
            <FlatList
              data={historyRows}
              keyExtractor={r => `${r.member?.id || 'me'}-${r.t.id}`}
              contentContainerStyle={styles.listContent}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
              ListEmptyComponent={<EmptyState icon="⏱️" title="Aucune tâche commencée" subtitle="Le temps se compte dès qu'une tâche passe « En cours »." />}
              renderItem={({ item: { member, prj, t } }) => {
                const late = lateMinutes(t) > 0;
                return (
                  <Card style={styles.entryCard} onPress={() => navigation.navigate('TaskDetail', { taskId: t.id })}>
                    <View style={styles.entryRow}>
                      <View style={styles.flex1}>
                        <Text style={styles.entryTask} numberOfLines={1}>{t.title}</Text>
                        <Text style={styles.entryMeta}>{member ? `${member.name} · ` : ''}{prj.name}</Text>
                        <Text style={styles.entryMeta}>
                          Commencée le {formatDate(t.start_at!)}{t.completed_at ? ` · Terminée le ${formatDate(t.completed_at)}` : ''}
                        </Text>
                        <Text style={[styles.entryResult, { color: late ? colors.danger : t.completed_at ? colors.success : colors.primarySoft }]}>
                          {resultLabel(t)}
                        </Text>
                      </View>
                      <View style={styles.durationPill}>
                        <Text style={styles.durationText}>{formatMinutes(t.logged_minutes)}</Text>
                      </View>
                    </View>
                  </Card>
                );
              }}
            />
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  title: { color: colors.textPrimary, fontSize: 22, fontWeight: '800' },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
  exportText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  mainTabs: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.sm },
  mainTab: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radius.sm },
  mainTabActive: { backgroundColor: `${colors.primary}26` },
  mainTabText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  mainTabTextActive: { color: colors.primarySoft },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  loadingText: { color: colors.textMuted, fontSize: 12, textAlign: 'center', paddingVertical: spacing.xl },
  scopeRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  scopeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 7 },
  scopeBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  scopeBtnText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  scopeBtnTextActive: { color: colors.white },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm },
  backText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  drillTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '800', marginBottom: spacing.md },
  allocCard: { marginBottom: spacing.sm, gap: spacing.xs },
  allocRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, justifyContent: 'space-between' },
  allocMember: { color: colors.textPrimary, fontSize: 13, fontWeight: '700' },
  allocProject: { color: colors.textPrimary, fontSize: 13, fontWeight: '700' },
  allocWs: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  allocStats: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: spacing.xs, borderTopWidth: 1, borderColor: colors.border },
  allocAllocated: { color: colors.primarySoft, fontSize: 11, fontWeight: '700' },
  allocLogged: { color: colors.success, fontSize: 11, fontWeight: '700' },
  wsPhoto: { width: 32, height: 32, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  wsIconWrap: { width: 32, height: 32, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  flex1: { flex: 1 },
  historyHeader: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  statsRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  statBox: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md },
  statValue: { color: colors.primarySoft, fontSize: 20, fontWeight: '800' },
  statLabel: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  searchWrap: { position: 'relative', justifyContent: 'center', marginBottom: spacing.sm },
  searchIcon: { position: 'absolute', left: 12, zIndex: 1 },
  searchInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingLeft: 34,
    paddingRight: spacing.md,
    paddingVertical: 8,
    color: colors.textPrimary,
    fontSize: 13,
  },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.xs },
  entryCard: { marginBottom: spacing.sm },
  entryRow: { flexDirection: 'row', alignItems: 'center' },
  entryTask: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  entryMeta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  entryNote: { color: colors.textSecondary, fontSize: 12, marginTop: 2, fontStyle: 'italic' },
  durationPill: { backgroundColor: `${colors.primary}26`, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  entryResult: { fontSize: 11, fontWeight: '700', marginTop: 4 },
  durationText: { color: colors.primarySoft, fontSize: 12, fontWeight: '700' },
});
