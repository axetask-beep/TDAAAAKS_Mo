// Mobile port of AXETASKS/src/components/command/CommandCenter.tsx (onglet
// « Pilotage »). Every number comes from the shared rules in lib/insights.ts
// applied to GET /api/insights/scope, so web and mobile always agree.
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, XpSummary } from '../../lib/api';
import {
  Scope, ScopeTask, KpiKey, KPI_DEFS, Health, HEALTH_LABELS, applyFilters, kpiTasks, onTimeRate, periodCompare,
  remainingMinutes, projectHealth, criticalNow, planDay, isOpen, isOverdue, DAY_MS,
} from '../../lib/insights';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, radius } from '../../theme';
import { Avatar, Chip, ErrorBanner, LoadingScreen } from '../../components/ui';
import { HEALTH_COLORS, ORANGE, KpiTile, Muted, ProgressBar, ScopeTaskRow, Section, fmtHours, fmtShortDate } from '../../components/insights';

const PERIODS = [7, 30, 90];
const HEALTH_SORT: Health[] = ['critique', 'surveiller', 'sain', 'termine', 'arrete'];

export default function CommandCenterScreen({ navigation }: any) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [scope, setScope] = useState<Scope | null>(null);
  const [xp, setXp] = useState<XpSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [days, setDays] = useState(30);
  const [workspaceId, setWorkspaceId] = useState<string | undefined>();
  const [drill, setDrill] = useState<KpiKey | null>(null);
  const [healthFilter, setHealthFilter] = useState<Health | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, x] = await Promise.all([api.getInsightsScope(), api.getXpSummary().catch(() => null)]);
      setScope(s);
      setXp(x);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Chargement impossible');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const now = useMemo(() => (scope ? Date.now() : 0), [scope]);
  const dayStart = useMemo(() => { const d = new Date(now); d.setHours(0, 0, 0, 0); return d.getTime(); }, [now]);
  const view = useMemo(() => (scope ? applyFilters(scope, { days, workspace_id: workspaceId }) : { tasks: [], projects: [] }), [scope, days, workspaceId]);
  const health = useMemo(() => view.projects.map(p => projectHealth(p, view.tasks, now)), [view, now]);

  if (!scope) {
    if (error) {
      return (
        <View style={[styles.container, { paddingTop: insets.top + spacing.lg, paddingHorizontal: spacing.lg }]}>
          <ErrorBanner message={error} />
          <Chip label="Réessayer" onPress={load} />
        </View>
      );
    }
    return <LoadingScreen label="Chargement du centre de contrôle…" />;
  }

  const tasks = view.tasks;
  const userName = (id: string | null) => (id ? scope.users.find(u => u.id === id)?.name || 'Inconnu' : 'Non assigné');
  const projectName = (id: string) => scope.projects.find(p => p.id === id)?.name || 'Projet';
  const openTask = (id: string) => navigation.navigate('TaskDetail', { taskId: id });
  const openProject = (id: string) => {
    const p = scope.projects.find(x => x.id === id);
    if (p) navigation.navigate('ProjectDetail', { projectId: p.id, workspaceId: p.workspace_id, name: p.name });
  };

  const count = (k: KpiKey) => kpiTasks(tasks, k, now, days).length;
  const cmp = periodCompare(tasks, now, days);
  const otr = onTimeRate(tasks, now - days * DAY_MS, now);
  const rem = remainingMinutes(tasks);
  const unread = scope.notifications.filter(n => !n.is_read).length;
  const critical = criticalNow(tasks, health, now);
  const plan = planDay(tasks, user!.id, now, dayStart);
  const drillTasks = drill ? kpiTasks(tasks, drill, now, days) : [];
  const healthCount = (h: Health) => health.filter(p => p.health === h).length;
  const radar = health
    .filter(p => (healthFilter ? p.health === healthFilter : p.health !== 'termine' && p.health !== 'arrete'))
    .sort((a, b) => HEALTH_SORT.indexOf(a.health) - HEALTH_SORT.indexOf(b.health));
  const toggleDrill = (k: KpiKey) => setDrill(d => (d === k ? null : k));

  const kpis: { key: KpiKey; label: string; value: number; tone: string; hint?: string }[] = [
    { key: 'active', label: 'Actives', value: count('active'), tone: colors.textPrimary },
    { key: 'completed', label: `Terminées`, value: cmp.cur, tone: colors.success, hint: cmp.deltaPct === null ? `${days} j · sans référence` : `${cmp.deltaPct >= 0 ? '+' : ''}${cmp.deltaPct} % vs préc.` },
    { key: 'overdue', label: 'En retard', value: count('overdue'), tone: count('overdue') ? ORANGE : colors.textPrimary },
    { key: 'critical', label: 'Critiques', value: count('critical'), tone: count('critical') ? colors.danger : colors.textPrimary, hint: '< 48 h ou en retard' },
    { key: 'blocked', label: 'Bloquées', value: count('blocked'), tone: count('blocked') ? colors.danger : colors.textPrimary },
    { key: 'review', label: 'À valider', value: count('review'), tone: colors.indigo, hint: 'En révision' },
  ];

  const teams = scope.workspaces
    .filter(w => !workspaceId || w.id === workspaceId)
    .map(w => {
      const tt = tasks.filter(t => t.workspace_id === w.id);
      return {
        w,
        open: tt.filter(isOpen).length,
        done: kpiTasks(tt, 'completed', now, days).length,
        overdue: tt.filter(t => isOverdue(t, now)).length,
        blocked: tt.filter(t => t.status === 'bloque').length,
        otr: onTimeRate(tt, now - days * DAY_MS, now),
        rem: remainingMinutes(tt),
      };
    })
    .filter(x => x.open + x.done > 0);

  const dayGoal = Math.max(plan.realisticGoal, plan.doneToday);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: spacing.xxl }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Image source={require('../../../assets/axetask-mark.png')} style={styles.logo} resizeMode="contain" />
        <View style={styles.flex1}>
          <Text style={styles.eyebrow}>CENTRE DE CONTRÔLE</Text>
          <Text style={styles.greeting} numberOfLines={1}>Bonjour, {user?.name?.split(' ')[0]}</Text>
        </View>
        <Pressable onPress={() => navigation.navigate('Profile')} hitSlop={8} accessibilityLabel="Ouvrir le profil">
          <Avatar user={user} size={38} />
        </Pressable>
      </View>

      {error ? <View style={styles.pad}><ErrorBanner message={`Actualisation échouée : ${error}`} /></View> : null}

      {/* Level strip → Progression */}
      {xp && (
        <Pressable onPress={() => navigation.navigate('Progress')} style={({ pressed }) => [styles.levelCard, pressed && { opacity: 0.9 }]} accessibilityLabel="Voir ma progression">
          <View style={styles.levelBadge}>
            <Text style={styles.levelBadgeLabel}>NIV.</Text>
            <Text style={styles.levelBadgeValue}>{xp.level.level}</Text>
          </View>
          <View style={styles.flex1}>
            <View style={styles.levelTop}>
              <Text style={styles.levelName} numberOfLines={1}>{xp.level.name}</Text>
              <View style={styles.streakPill}>
                <Ionicons name="flame" size={12} color={colors.warning} />
                <Text style={styles.streakText}>{xp.streak.current} j</Text>
              </View>
            </View>
            <View style={{ marginVertical: 6 }}><ProgressBar value={xp.level.progress} /></View>
            <Text style={styles.levelMeta} numberOfLines={1}>
              {xp.total} AXP{xp.level.next ? ` · ${xp.level.toNext} avant ${xp.level.next.name}` : ' · niveau maximal'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.primarySoft} />
        </Pressable>
      )}

      {/* Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {PERIODS.map(d => (
          <Chip key={d} label={`${d} j`} active={days === d} onPress={() => setDays(d)} />
        ))}
        <View style={styles.filterDivider} />
        <Chip label="Tous les espaces" active={!workspaceId} onPress={() => setWorkspaceId(undefined)} />
        {scope.workspaces.map(w => (
          <Chip key={w.id} label={w.name} active={workspaceId === w.id} color={w.color || colors.primary} onPress={() => setWorkspaceId(workspaceId === w.id ? undefined : w.id)} />
        ))}
      </ScrollView>

      {/* KPIs */}
      <View style={styles.kpiGrid}>
        {kpis.map(k => (
          <KpiTile key={k.key} label={k.label} value={k.value} tone={k.tone} hint={k.hint ?? KPI_DEFS[k.key].hint} active={drill === k.key} onPress={() => toggleDrill(k.key)} />
        ))}
      </View>

      {drill && (
        <Section icon="list-outline" title={`${KPI_DEFS[drill].label} · ${drillTasks.length}`} meta={KPI_DEFS[drill].hint} flush>
          {drillTasks.length === 0 ? <Muted style={styles.emptyPad}>Aucune tâche.</Muted> : drillTasks.slice(0, 30).map((t, i, arr) => (
            <ScopeTaskRow key={t.id} task={t} projectName={projectName(t.project_id)} userName={userName(t.assignee_id)} onPress={() => openTask(t.id)} last={i === arr.length - 1} />
          ))}
          {drillTasks.length > 30 && <Muted style={styles.emptyPad}>+ {drillTasks.length - 30} autres — affinez avec les filtres.</Muted>}
          <Pressable onPress={() => setDrill(null)} style={styles.closeDrill}><Text style={styles.link}>Fermer la liste</Text></Pressable>
        </Section>
      )}

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{otr.rate === null ? '—' : `${Math.round(otr.rate * 100)} %`}</Text>
          <Text style={styles.statLabel}>Livrées à temps</Text>
        </View>
        <View style={styles.statSep} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{fmtHours(rem.minutes)}</Text>
          <Text style={styles.statLabel}>Charge restante</Text>
        </View>
        <View style={styles.statSep} />
        <Pressable style={styles.stat} onPress={() => navigation.navigate('Notifications')}>
          <Text style={[styles.statValue, unread > 0 && { color: colors.warning }]}>{unread}</Text>
          <Text style={styles.statLabel}>{user?.role === 'admin' ? 'Alertes équipe' : 'Alertes non lues'}</Text>
        </Pressable>
      </View>

      {/* À traiter maintenant */}
      <Section icon="shield-outline" iconColor={colors.danger} title="À traiter maintenant" meta={critical.length ? `${critical.length} point${critical.length > 1 ? 's' : ''}` : undefined} flush>
        {critical.length === 0 ? (
          <View style={styles.allGood}>
            <Ionicons name="checkmark-circle" size={26} color={colors.success} />
            <Text style={styles.allGoodText}>Rien de critique dans ce périmètre.</Text>
          </View>
        ) : critical.map((c, i) => {
          const tint = c.urgency === 'critique' ? colors.danger : colors.warning;
          return (
            <Pressable
              key={c.key}
              onPress={() => (c.kind === 'task' ? openTask(c.id) : openProject(c.id))}
              style={({ pressed }) => [styles.critRow, i < critical.length - 1 && styles.rowBorder, pressed && { backgroundColor: colors.surfaceAlt }]}
            >
              <View style={[styles.critBar, { backgroundColor: tint }]} />
              <View style={styles.flex1}>
                <Text style={[styles.critProblem, { color: tint }]} numberOfLines={1}>
                  {c.urgency === 'critique' ? 'CRITIQUE' : 'HAUTE'} · {c.problem.toUpperCase()}
                </Text>
                <Text style={styles.critTitle} numberOfLines={2}>{c.title}</Text>
                <Text style={styles.critReason} numberOfLines={2}>{c.reason} · {userName(c.ownerId)}{c.due ? ` · ${fmtShortDate(c.due)}` : ''}</Text>
                <Text style={styles.critAction}>→ {c.action}</Text>
              </View>
              <View style={styles.actBtn}><Text style={styles.actBtnText}>Agir</Text></View>
            </Pressable>
          );
        })}
      </Section>

      {/* Mission du jour */}
      <Section icon="locate-outline" title="Mission du jour" meta={`${plan.doneToday} terminée${plan.doneToday > 1 ? 's' : ''} aujourd'hui`} flush>
        <View style={styles.sectionPad}>
          <View style={styles.goalRow}>
            <Text style={styles.goalText}>Objectif réaliste : <Text style={styles.bold}>{plan.realisticGoal} tâche{plan.realisticGoal > 1 ? 's' : ''}</Text></Text>
            <Text style={styles.goalCount}>{plan.doneToday}/{dayGoal || 0}</Text>
          </View>
          <ProgressBar value={dayGoal ? plan.doneToday / dayGoal : 0} color={colors.success} />
          {plan.overloaded && (
            <View style={styles.warnBox}>
              <Ionicons name="information-circle-outline" size={14} color={colors.warning} />
              <Text style={styles.warnText}>Charge élevée ({fmtHours(plan.loadMinutes)} en retard ou dû sous 24 h) : seules 2 priorités sont proposées. Parlez-en à votre responsable.</Text>
            </View>
          )}
        </View>
        {plan.main ? (
          <View style={styles.mainMission}>
            <Text style={styles.mainLabel}>MISSION PRINCIPALE</Text>
            <ScopeTaskRow task={plan.main.task} projectName={projectName(plan.main.task.project_id)} userName={userName(plan.main.task.assignee_id)} reasons={plan.main.reasons} onPress={() => openTask(plan.main!.task.id)} last />
          </View>
        ) : <Muted style={styles.emptyPad}>Aucune tâche ouverte assignée.</Muted>}
        <TaskGroup title="Ensuite" items={plan.top.slice(1).map(r => ({ task: r.task, reasons: r.reasons }))} {...{ projectName, userName, openTask }} />
        <TaskGroup title="Rapides (≤ 30 min)" icon="flash" iconColor={colors.warning} items={plan.quickWins.map(r => ({ task: r.task }))} {...{ projectName, userName, openTask }} />
        <TaskGroup title={`À valider par vous (${plan.toValidate.length})`} icon="hourglass-outline" iconColor={colors.indigo} items={plan.toValidate.slice(0, 5).map(t => ({ task: t }))} {...{ projectName, userName, openTask }} />
        <Muted style={styles.sectionPad}>Suggestions calculées (retard, échéance, priorité, statut). Ce n'est pas une obligation.</Muted>
      </Section>

      {/* Radar des projets */}
      <Section icon="speedometer-outline" title="Radar des projets" flush>
        <View style={styles.healthRow}>
          {(['critique', 'surveiller', 'sain'] as Health[]).map(h => {
            const active = healthFilter === h;
            const c = HEALTH_COLORS[h];
            return (
              <Pressable key={h} onPress={() => setHealthFilter(active ? null : h)} style={[styles.healthTile, { borderColor: active ? c : colors.border, backgroundColor: active ? `${c}1F` : colors.background }]}>
                <Text style={[styles.healthCount, { color: healthCount(h) ? c : colors.textMuted }]}>{healthCount(h)}</Text>
                <Text style={styles.healthLabel} numberOfLines={1}>{h === 'surveiller' ? 'À surveiller' : HEALTH_LABELS[h]}</Text>
              </Pressable>
            );
          })}
        </View>
        {radar.length === 0 ? <Muted style={styles.emptyPad}>Aucun projet actif dans ce périmètre.</Muted> : radar.map((p, i) => {
          const c = HEALTH_COLORS[p.health];
          return (
            <Pressable key={p.project.id} onPress={() => openProject(p.project.id)} style={({ pressed }) => [styles.projectRow, i < radar.length - 1 && styles.rowBorder, pressed && { backgroundColor: colors.surfaceAlt }]}>
              <View style={styles.projectTop}>
                <Text style={styles.projectName} numberOfLines={1}>{p.project.name}</Text>
                <View style={[styles.healthChip, { borderColor: `${c}66`, backgroundColor: `${c}1A` }]}>
                  <Text style={[styles.healthChipText, { color: c }]}>{HEALTH_LABELS[p.health]}</Text>
                </View>
              </View>
              <View style={styles.progressLine}>
                <View style={styles.flex1}><ProgressBar value={p.progress} color={c} /></View>
                <Text style={styles.progressPct}>{Math.round(p.progress * 100)} %</Text>
              </View>
              {p.reasons.length > 0 && <Text style={styles.projectReasons} numberOfLines={2}>{p.reasons.join(' · ')}</Text>}
              <View style={styles.projectStats}>
                <MiniStat icon="checkbox-outline" text={`${p.done}/${p.total}`} />
                <MiniStat icon="alarm-outline" text={`${p.overdue} en retard`} color={p.overdue ? ORANGE : undefined} />
                <MiniStat icon="hand-left-outline" text={`${p.blocked} bloquée${p.blocked > 1 ? 's' : ''}`} color={p.blocked ? colors.danger : undefined} />
                <MiniStat icon="calendar-outline" text={fmtShortDate(p.nextDue)} />
              </View>
            </Pressable>
          );
        })}
        <Muted style={styles.sectionPad}>
          Critique : échéance projet dépassée, ≥ 3 tâches en retard, ≥ 30 % en retard ou ≥ 2 bloquées. À surveiller : au moins un retard, blocage ou tâche critique, ou planning en avance de ≥ 25 pts sur l'avancement.
        </Muted>
      </Section>

      {/* Pouls des équipes */}
      {teams.length > 0 && (
        <>
          <Text style={styles.blockTitle}>Pouls des équipes</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.teamsRow}>
            {teams.map(x => (
              <View key={x.w.id} style={styles.teamCard}>
                <View style={styles.teamHead}>
                  <View style={[styles.teamDot, { backgroundColor: x.w.color || colors.primary }]} />
                  <Text style={styles.teamName} numberOfLines={1}>{x.w.name}</Text>
                </View>
                <View style={styles.teamGrid}>
                  <TeamStat label="Ouvertes" value={x.open} />
                  <TeamStat label={`Finies ${days} j`} value={x.done} color={colors.success} />
                  <TeamStat label="À temps" value={x.otr.rate === null ? '—' : `${Math.round(x.otr.rate * 100)} %`} />
                  <TeamStat label="En retard" value={x.overdue} color={x.overdue ? ORANGE : colors.textMuted} />
                  <TeamStat label="Bloquées" value={x.blocked} color={x.blocked ? colors.danger : colors.textMuted} />
                  <TeamStat label="Charge" value={fmtHours(x.rem.minutes)} />
                </View>
              </View>
            ))}
          </ScrollView>
        </>
      )}

      <Muted style={[styles.pad, { textAlign: 'center' }]}>
        Les analyses détaillées (courbes, matrices) sont disponibles sur la version web.
      </Muted>
    </ScrollView>
  );
}

function TaskGroup({ title, icon, iconColor, items, projectName, userName, openTask }: {
  title: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  items: { task: ScopeTask; reasons?: string[] }[];
  projectName: (id: string) => string;
  userName: (id: string | null) => string;
  openTask: (id: string) => void;
}) {
  if (!items.length) return null;
  return (
    <View style={{ marginTop: spacing.sm }}>
      <View style={styles.groupHead}>
        {icon && <Ionicons name={icon} size={12} color={iconColor} />}
        <Text style={styles.groupTitle}>{title.toUpperCase()}</Text>
      </View>
      {items.map((r, i) => (
        <ScopeTaskRow key={r.task.id} task={r.task} reasons={r.reasons} projectName={projectName(r.task.project_id)} userName={userName(r.task.assignee_id)} onPress={() => openTask(r.task.id)} last={i === items.length - 1} />
      ))}
    </View>
  );
}

function MiniStat({ icon, text, color = colors.textMuted }: { icon: keyof typeof Ionicons.glyphMap; text: string; color?: string }) {
  return (
    <View style={styles.miniStat}>
      <Ionicons name={icon} size={12} color={color} />
      <Text style={[styles.miniStatText, { color }]}>{text}</Text>
    </View>
  );
}

function TeamStat({ label, value, color = colors.textPrimary }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <View style={styles.teamStat}>
      <Text style={[styles.teamStatValue, { color }]}>{value}</Text>
      <Text style={styles.teamStatLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex1: { flex: 1, minWidth: 0 },
  pad: { paddingHorizontal: spacing.lg },
  bold: { color: colors.textPrimary, fontWeight: '800' },
  link: { color: colors.primarySoft, fontSize: 12, fontWeight: '700' },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  logo: { width: 40, height: 40 },
  eyebrow: { color: colors.primarySoft, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  greeting: { color: colors.textPrimary, fontSize: 22, fontWeight: '800' },

  levelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: `${colors.primary}55`,
    backgroundColor: '#111B33',
  },
  levelBadge: {
    width: 50, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: `${colors.primary}26`, borderWidth: 1, borderColor: `${colors.primary}88`,
  },
  levelBadgeLabel: { color: '#93C5FD', fontSize: 9, fontWeight: '800' },
  levelBadgeValue: { color: colors.textPrimary, fontSize: 22, fontWeight: '900', lineHeight: 24 },
  levelTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  levelName: { color: colors.textPrimary, fontSize: 15, fontWeight: '800', flexShrink: 1 },
  streakPill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.full, backgroundColor: `${colors.warning}1F`, marginLeft: 'auto' },
  streakText: { color: colors.warning, fontSize: 11, fontWeight: '800' },
  levelMeta: { color: colors.textSecondary, fontSize: 11 },

  filters: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, alignItems: 'center' },
  filterDivider: { width: 1, height: 22, backgroundColor: colors.border, marginRight: spacing.sm },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  statsRow: {
    flexDirection: 'row', marginHorizontal: spacing.lg, marginBottom: spacing.lg, paddingVertical: spacing.md,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
  },
  stat: { flex: 1, alignItems: 'center' },
  statSep: { width: 1, backgroundColor: colors.border },
  statValue: { color: colors.textPrimary, fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] },
  statLabel: { color: colors.textMuted, fontSize: 10, marginTop: 2 },

  emptyPad: { padding: spacing.md, textAlign: 'center' },
  closeDrill: { alignItems: 'center', paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  sectionPad: { padding: spacing.md },

  allGood: { alignItems: 'center', padding: spacing.xl, gap: spacing.sm },
  allGoodText: { color: colors.textSecondary, fontSize: 13 },
  critRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  critBar: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  critProblem: { fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  critTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '700', marginTop: 2 },
  critReason: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
  critAction: { color: colors.primarySoft, fontSize: 11, marginTop: 3, fontWeight: '600' },
  actBtn: { backgroundColor: colors.primary, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 7 },
  actBtnText: { color: colors.white, fontSize: 12, fontWeight: '800' },

  goalRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  goalText: { color: colors.textSecondary, fontSize: 12, flex: 1 },
  goalCount: { color: colors.success, fontSize: 12, fontWeight: '800', fontVariant: ['tabular-nums'] },
  warnBox: { flexDirection: 'row', gap: 6, marginTop: spacing.sm, padding: spacing.sm, borderRadius: radius.sm, backgroundColor: `${colors.warning}14` },
  warnText: { color: colors.warning, fontSize: 11, flex: 1, lineHeight: 15 },
  mainMission: { marginHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: `${colors.primary}66`, backgroundColor: `${colors.primary}14`, overflow: 'hidden' },
  mainLabel: { color: '#93C5FD', fontSize: 10, fontWeight: '800', letterSpacing: 0.6, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  groupTitle: { color: colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },

  healthRow: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  healthTile: { flex: 1, borderWidth: 1, borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: 'center' },
  healthCount: { fontSize: 20, fontWeight: '900', fontVariant: ['tabular-nums'] },
  healthLabel: { color: colors.textSecondary, fontSize: 10, fontWeight: '700' },
  projectRow: { padding: spacing.md },
  projectTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  projectName: { color: colors.textPrimary, fontSize: 14, fontWeight: '700', flex: 1 },
  healthChip: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  healthChipText: { fontSize: 10, fontWeight: '800' },
  progressLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  progressPct: { color: colors.textSecondary, fontSize: 11, fontWeight: '700', width: 38, textAlign: 'right', fontVariant: ['tabular-nums'] },
  projectReasons: { color: colors.textSecondary, fontSize: 11, marginTop: 6 },
  projectStats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.sm },
  miniStat: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  miniStatText: { fontSize: 11, fontWeight: '600' },

  blockTitle: { color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', marginHorizontal: spacing.lg, marginBottom: spacing.sm },
  teamsRow: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.lg },
  teamCard: { width: 230, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md },
  teamHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  teamDot: { width: 10, height: 10, borderRadius: 3 },
  teamName: { color: colors.textPrimary, fontSize: 14, fontWeight: '800', flex: 1 },
  teamGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.sm },
  teamStat: { width: '33.33%' },
  teamStatValue: { fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  teamStatLabel: { color: colors.textMuted, fontSize: 10 },
});
