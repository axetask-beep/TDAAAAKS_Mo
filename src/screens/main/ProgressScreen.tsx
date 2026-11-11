// Mobile port of AXETASKS/src/components/progress/ProgressView.tsx.
// AXP are computed by the server only; this screen just reads and explains them.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable, Switch, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { api, XpSummary, Leaderboards, Challenge } from '../../lib/api';
import { Scope, XP_RULES, LEVELS, TIER_LABELS, planDay, missions } from '../../lib/insights';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, radius } from '../../theme';
import { Avatar, Button, ErrorBanner, LoadingScreen, TextField } from '../../components/ui';
import { UserPickerField } from '../../components/UserPicker';
import { Muted, ProgressBar, Section, Segmented, fmtDay } from '../../components/insights';
import { User } from '../../types';

const KIND_LABELS: Record<string, string> = {
  task_completed: 'Tâche terminée', blocker_resolved: 'Blocage levé', kudos: 'Reconnaissance', project_completed: 'Projet terminé', correction: 'Correction',
};
const LEVEL_KEY = 'axetask_last_seen_level';
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR');

export default function ProgressScreen({ navigation }: any) {
  const { user } = useAuth();
  const [xp, setXp] = useState<XpSummary | null>(null);
  const [boards, setBoards] = useState<Leaderboards | null>(null);
  const [challenges, setChallenges] = useState<Challenge[] | null>(null);
  const [scope, setScope] = useState<Scope | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [days, setDays] = useState(30);
  const [boardMode, setBoardMode] = useState<'teams' | 'people' | 'self'>('teams');
  const [levelUp, setLevelUp] = useState(false);
  const [showRules, setShowRules] = useState(false);

  const load = useCallback(async () => {
    try {
      const [x, b, c, s] = await Promise.all([api.getXpSummary(), api.getLeaderboards(days), api.getChallenges(), api.getInsightsScope()]);
      setXp(x); setBoards(b); setChallenges(c); setScope(s); setError(null);
    } catch (err: any) {
      setError(err.message || 'Chargement impossible');
    } finally {
      setRefreshing(false);
    }
  }, [days]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Level-up moment, once per new level (same rule as the web).
  useEffect(() => {
    if (!xp || !user) return;
    const key = `${LEVEL_KEY}:${user.id}`;
    AsyncStorage.getItem(key).then(v => {
      const last = Number(v || 0);
      if (last && xp.level.level > last) setLevelUp(true);
      AsyncStorage.setItem(key, String(xp.level.level)).catch(() => {});
    }).catch(() => {});
  }, [xp?.level.level, user?.id]);

  const plannedMissions = useMemo(() => {
    if (!scope || !xp || !user) return [];
    const now = Date.now();
    const d = new Date(now); d.setHours(0, 0, 0, 0);
    const dayStart = d.getTime();
    const w = new Date(dayStart); w.setDate(w.getDate() - ((w.getDay() + 6) % 7));
    const plan = planDay(scope.tasks, user.id, now, dayStart);
    return missions({ plan, tasks: scope.tasks, userId: user.id, now, dayStart, weekStart: w.getTime(), blockersResolvedToday: xp.today.blockersResolved, validatedThisWeek: xp.validated_this_week });
  }, [scope, xp, user]);

  if (!xp || !boards || !challenges || !scope) {
    if (error) return <View style={[styles.container, { padding: spacing.lg }]}><ErrorBanner message={error} /><Button title="Réessayer" variant="secondary" onPress={load} /></View>;
    return <LoadingScreen label="Chargement de la progression…" />;
  }

  const lvl = xp.level;
  const delta = xp.period.prev30 > 0 ? Math.round(((xp.period.last30 - xp.period.prev30) / xp.period.prev30) * 100) : null;
  const weekMax = Math.max(1, ...xp.weekly.map(w => w.value));
  const earnedBadges = xp.badges.filter(b => b.earned).length;
  const wsName = (id: string) => scope.workspaces.find(w => w.id === id)?.name || '';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: spacing.md, paddingBottom: spacing.xxl }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
      keyboardShouldPersistTaps="handled"
    >
      {levelUp && (
        <Pressable onPress={() => setLevelUp(false)} style={styles.levelUp}>
          <Ionicons name="sparkles" size={18} color={colors.warning} />
          <Text style={styles.levelUpText}>Nouveau palier atteint : niveau {lvl.level}, {lvl.name} !</Text>
          <Ionicons name="close" size={16} color={colors.textMuted} />
        </Pressable>
      )}

      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeLabel}>NIVEAU</Text>
            <Text style={styles.heroBadgeValue}>{lvl.level}</Text>
          </View>
          <View style={styles.flex1}>
            <Text style={styles.heroName}>{lvl.name}</Text>
            <Text style={styles.heroTotal}><Text style={styles.heroTotalNum}>{xp.total}</Text> AXP au total</Text>
          </View>
        </View>
        <View style={{ marginTop: spacing.md }}><ProgressBar value={lvl.progress} height={8} /></View>
        <View style={styles.heroScale}>
          <Text style={styles.heroScaleText}>{lvl.min}</Text>
          <Text style={styles.heroScaleText}>{lvl.next ? `${lvl.toNext} AXP avant ${lvl.next.name}` : 'Niveau maximal'}</Text>
          <Text style={styles.heroScaleText}>{lvl.next?.min ?? ''}</Text>
        </View>
        <View style={styles.heroStats}>
          <HeroStat icon="flame" color={colors.warning} value={`${xp.streak.current} j`} label={`Série · record ${xp.streak.best}`} />
          <HeroStat icon="trending-up" color={colors.success} value={`${xp.period.last30}`} label={delta === null ? '30 j · sans référence' : `30 j · ${delta >= 0 ? '+' : ''}${delta} %`} />
          <HeroStat icon="today-outline" color={colors.primarySoft} value={`${xp.today.earned}`} label={`Aujourd'hui / ${XP_RULES.dailyCap}`} />
        </View>
      </View>
      <Muted style={styles.disclaimer}>
        Les AXP récompensent des événements vérifiés (livrables validés, blocages levés, entraide). Ils ne mesurent pas la valeur professionnelle et ne sont liés à aucune rémunération.
      </Muted>

      {/* Missions */}
      <Section icon="locate-outline" title="Missions">
        {plannedMissions.length === 0 ? <Muted>Aucune mission aujourd'hui : rien d'urgent ne vous concerne.</Muted> : plannedMissions.map(m => {
          const done = m.progress >= m.target;
          return (
            <View key={m.id} style={[styles.mission, done && styles.missionDone]}>
              <View style={styles.missionTop}>
                <Ionicons name={done ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={done ? colors.success : colors.textMuted} />
                <Text style={styles.missionTitle}>{m.title}</Text>
                <Text style={styles.missionScope}>{m.scope.toUpperCase()}</Text>
              </View>
              <Text style={styles.missionWhy}>{m.why}</Text>
              <View style={styles.missionBar}>
                <View style={styles.flex1}><ProgressBar value={m.progress / m.target} color={done ? colors.success : colors.primary} /></View>
                <Text style={styles.missionCount}>{m.progress}/{m.target}</Text>
              </View>
            </View>
          );
        })}
        <Muted style={{ marginTop: spacing.xs }}>Ajustées à votre charge. Elles ne rapportent pas d'AXP en plus : ce sont les actions elles-mêmes qui comptent.</Muted>
      </Section>

      {/* Weekly chart */}
      <Section icon="bar-chart-outline" title="AXP par semaine">
        {xp.weekly.every(w => !w.value) ? <Muted>Pas encore d'AXP : terminez et faites valider une tâche.</Muted> : (
          <View style={styles.chart} accessibilityLabel={xp.weekly.map(w => `Semaine du ${fmtDay(w.key)} : ${w.value} AXP`).join(', ')}>
            {xp.weekly.map((w, i) => {
              const last = i === xp.weekly.length - 1;
              return (
                <View key={w.key} style={styles.col}>
                  <Text style={styles.colValue}>{w.value || ''}</Text>
                  <View style={styles.colTrack}>
                    <View style={[styles.colBar, { height: `${(w.value / weekMax) * 100}%`, backgroundColor: last ? colors.primarySoft : colors.primary }]} />
                  </View>
                  <Text style={styles.colLabel} numberOfLines={1}>{fmtDay(w.key)}</Text>
                </View>
              );
            })}
          </View>
        )}
      </Section>

      {/* Badges */}
      <Section icon="ribbon-outline" iconColor={colors.indigo} title="Insignes" meta={`${earnedBadges}/${xp.badges.length} obtenus`}>
        <View style={styles.badgeGrid}>
          {xp.badges.map(b => (
            <View key={b.id} style={[styles.badge, b.earned && styles.badgeEarned]}>
              <View style={[styles.badgeIcon, b.earned && styles.badgeIconEarned]}>
                <Ionicons name={b.earned ? 'ribbon' : 'lock-closed-outline'} size={16} color={b.earned ? '#C4B5FD' : colors.textMuted} />
              </View>
              <Text style={[styles.badgeName, !b.earned && { color: colors.textSecondary }]} numberOfLines={2}>{b.name}</Text>
              <Text style={styles.badgeRule} numberOfLines={3}>{b.rule}</Text>
              {!b.earned && (
                <View style={{ marginTop: 'auto', paddingTop: 6 }}>
                  <ProgressBar value={b.progress[0] / b.progress[1]} color={colors.indigo} height={4} />
                  <Text style={styles.badgeProgress}>{b.progress[0]}/{b.progress[1]}</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      </Section>

      {/* Leaderboards */}
      <Section icon="people-outline" title="Classements">
        <Segmented value={boardMode} onChange={setBoardMode} options={[['teams', 'Équipes'], ['people', 'Individuel'], ['self', 'Moi']]} />
        {boardMode !== 'self' && (
          <View style={styles.periodRow}>
            {[7, 30, 90].map(d => (
              <Pressable key={d} onPress={() => setDays(d)} style={[styles.period, days === d && styles.periodActive]}>
                <Text style={[styles.periodText, days === d && { color: colors.primarySoft }]}>{d} j</Text>
              </Pressable>
            ))}
          </View>
        )}
        {boardMode === 'teams' && (boards.teams.length === 0 ? <Muted>Aucun espace.</Muted> : boards.teams.map((t, i) => (
          <View key={t.id} style={styles.rankRow}>
            <Rank i={i} />
            <View style={[styles.teamDot, { backgroundColor: t.color || colors.primary }]} />
            <View style={styles.flex1}>
              <Text style={styles.rankName} numberOfLines={1}>{t.name}</Text>
              <Text style={styles.rankMeta} numberOfLines={1}>{t.members} membres · {t.validated} validés · {t.blockers} blocages levés</Text>
            </View>
            <Text style={styles.rankXp}>{t.xp}</Text>
          </View>
        )))}
        {boardMode === 'people' && (
          <>
            {boards.people.length === 0 ? <Muted style={{ marginTop: spacing.sm }}>Personne n'a encore choisi d'apparaître dans le classement individuel.</Muted> : boards.people.map((p, i) => (
              <View key={p.id} style={[styles.rankRow, p.id === user?.id && styles.rankMe]}>
                <Rank i={i} />
                <Avatar user={{ name: p.name, avatar_url: p.avatar_url } as User} size={28} />
                <View style={styles.flex1}>
                  <Text style={styles.rankName} numberOfLines={1}>{p.name}{p.id === user?.id ? ' (vous)' : ''}</Text>
                  <Text style={styles.rankMeta} numberOfLines={1}>{p.validated} validés · {p.blockers} blocages</Text>
                </View>
                <Text style={styles.rankXp}>{p.xp}</Text>
              </View>
            ))}
            <View style={styles.optIn}>
              <Text style={styles.optInText}>Apparaître dans le classement individuel (visible par les membres de vos espaces)</Text>
              <Switch
                value={xp.show_in_leaderboard}
                onValueChange={async v => {
                  try { await api.setLeaderboardVisibility(v); load(); } catch (err: any) { Alert.alert('Erreur', err.message); }
                }}
                trackColor={{ true: colors.primary, false: colors.surfaceAlt }}
                thumbColor={colors.white}
              />
            </View>
          </>
        )}
        {boardMode === 'self' && (
          <View style={styles.selfRow}>
            <View style={styles.selfBox}><Text style={styles.selfValue}>{xp.period.last30}</Text><Text style={styles.rankMeta}>30 derniers jours</Text></View>
            <Ionicons name="arrow-back" size={16} color={colors.textMuted} />
            <View style={styles.selfBox}><Text style={[styles.selfValue, { color: colors.textSecondary }]}>{xp.period.prev30}</Text><Text style={styles.rankMeta}>30 jours précédents</Text></View>
          </View>
        )}
        <Muted style={{ marginTop: spacing.md }}>Les classements d'équipe sont privilégiés : ils encouragent l'entraide plutôt que la compétition.</Muted>
      </Section>

      {/* Challenges */}
      <Section icon="flag-outline" iconColor={colors.warning} title="Défis d'équipe">
        {challenges.length === 0 ? <Muted>Aucun défi en cours. Les administrateurs d'espace les créent depuis la version web.</Muted> : challenges.map(c => {
          const tint = c.success ? colors.success : c.state === 'termine' ? colors.textMuted : colors.warning;
          return (
            <View key={c.id} style={[styles.challenge, c.success && { borderColor: `${colors.success}66` }]}>
              <View style={styles.missionTop}>
                <Text style={[styles.missionTitle, { flex: 1 }]} numberOfLines={2}>{c.title}</Text>
                <Text style={[styles.missionScope, { color: tint }]}>
                  {c.success ? 'RÉUSSI' : c.state === 'termine' ? 'TERMINÉ' : c.state === 'a_venir' ? 'À VENIR' : 'EN COURS'}
                </Text>
              </View>
              <Text style={styles.missionWhy}>{wsName(c.workspace_id)} · {c.metric_label} · objectif {c.target}{c.unit === '%' ? ' %' : ` ${c.unit}`}</Text>
              <View style={styles.missionBar}><View style={styles.flex1}><ProgressBar value={c.value / c.target} color={c.success ? colors.success : colors.indigo} /></View></View>
              <Text style={styles.missionWhy}>{c.detail} · du {fmtDate(c.start_at)} au {fmtDate(c.end_at)}{c.reward ? ` · 🎁 ${c.reward}` : ''}</Text>
            </View>
          );
        })}
      </Section>

      <Recognitions boards={boards} scope={scope} meId={user!.id} reload={load} />

      {/* History */}
      <Section icon="time-outline" title="Historique des récompenses" flush>
        {xp.events.length === 0 ? <Muted style={{ padding: spacing.md }}>Aucun événement.</Muted> : xp.events.slice(0, 40).map((e, i, arr) => (
          <Pressable
            key={e.id}
            disabled={!e.task_id}
            onPress={() => e.task_id && navigation.navigate('TaskDetail', { taskId: e.task_id })}
            style={[styles.eventRow, i < arr.length - 1 && styles.rowBorder, e.revoked && { opacity: 0.55 }]}
          >
            <Text style={[styles.eventPts, { color: e.revoked ? colors.textMuted : e.points < 0 ? colors.danger : colors.success }, e.revoked && { textDecorationLine: 'line-through' }]}>
              {e.points > 0 ? '+' : ''}{e.points}
            </Text>
            <View style={styles.flex1}>
              <Text style={styles.eventKind}>{KIND_LABELS[e.kind] || e.kind}</Text>
              <Text style={styles.rankMeta} numberOfLines={2}>{e.reason}{e.revoked ? ` · annulé : ${e.revoked_reason}` : ''}</Text>
            </View>
            <Text style={styles.eventDate}>{fmtDate(e.created_at)}</Text>
          </Pressable>
        ))}
      </Section>

      {/* Rules */}
      <Section icon="book-outline" title="Règles de calcul" flush>
        <Pressable onPress={() => setShowRules(v => !v)} style={styles.rulesToggle}>
          <Text style={styles.link}>{showRules ? 'Masquer les règles' : 'Comment sont calculés les AXP ?'}</Text>
          <Ionicons name={showRules ? 'chevron-up' : 'chevron-down'} size={14} color={colors.primarySoft} />
        </Pressable>
        {showRules && (
          <View style={{ padding: spacing.md, paddingTop: 0 }}>
            {([
              [`Tâche ${TIER_LABELS.simple.toLowerCase()} terminée (≤ 1 h)`, XP_RULES.simple],
              [`Tâche ${TIER_LABELS.medium.toLowerCase()} (1 à 4 h)`, XP_RULES.medium],
              ['Livrable important validé par un pair', XP_RULES.important],
              ['Tâche urgente validée par un pair', XP_RULES.critical],
              [`Blocage levé (bloquée ≥ ${XP_RULES.blockerMinHours} h)`, XP_RULES.blockerResolved],
              ["Reconnaissance reçue d'un collègue", XP_RULES.kudos],
              ['Projet terminé (bonus collectif)', XP_RULES.projectCompleted],
            ] as [string, number][]).map(([l, v]) => (
              <View key={l} style={styles.ruleRow}><Text style={styles.ruleLabel}>{l}</Text><Text style={styles.ruleValue}>{v}</Text></View>
            ))}
            <Muted style={{ marginTop: spacing.md }}>
              • Sans validation par un pair, une tâche importante ou urgente est plafonnée à {XP_RULES.unvalidatedCap} AXP.{'\n'}
              • Une seule récompense par tâche ; réouverte, ses AXP sont suspendus ; supprimée, ils sont annulés.{'\n'}
              • Créée et fermée par soi-même en moins de {XP_RULES.quickSelfCloseMinutes} min : 0 AXP. Plafond de {XP_RULES.dailyCap} AXP par jour.{'\n'}
              • Aucune pénalité automatique pour les retards.{'\n'}
              • Niveaux : {LEVELS.map(l => `${l.level}. ${l.name} (${l.min})`).join(' · ')}.
            </Muted>
          </View>
        )}
      </Section>
    </ScrollView>
  );
}

function Recognitions({ boards, scope, meId, reload }: { boards: Leaderboards; scope: Scope; meId: string; reload: () => void }) {
  const [to, setTo] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const colleagues = scope.users.filter(u => u.id !== meId) as unknown as User[];
  const send = async () => {
    if (!to) return;
    setBusy(true);
    try {
      await api.giveKudos(to, msg.trim());
      setMsg(''); setTo(null); reload();
      Alert.alert('Reconnaissance envoyée', `+${XP_RULES.kudos} AXP pour votre collègue.`);
    } catch (err: any) {
      Alert.alert('Impossible', err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Section icon="heart-outline" iconColor={colors.accentPink} title="Reconnaissance">
      <UserPickerField label="Remercier un collègue" users={colleagues} value={to} onChange={setTo} />
      <TextField
        label="Pour quelle aide concrète ?"
        value={msg}
        onChangeText={setMsg}
        placeholder="Ex. a débloqué l'accès API"
        maxLength={300}
        multiline
      />
      <Button title="Envoyer la reconnaissance" onPress={send} loading={busy} disabled={!to || msg.trim().length < 5} />
      <Muted style={{ marginTop: spacing.sm }}>{XP_RULES.kudosPerDay} reconnaissances max par jour, une par collègue. Elles rapportent des AXP au collègue, jamais à vous.</Muted>
      {boards.recognitions.length > 0 && (
        <View style={{ marginTop: spacing.md }}>
          {boards.recognitions.slice(0, 10).map(r => (
            <View key={r.id} style={styles.kudo}>
              <Text style={styles.kudoWho}>{r.from_name || 'Quelqu’un'} <Text style={{ color: colors.accentPink }}>→</Text> {r.to_name}</Text>
              <Text style={styles.kudoText}>« {r.reason} »</Text>
              <Text style={styles.rankMeta}>{r.task_title ? `${r.task_title} · ` : ''}{fmtDate(r.created_at)}</Text>
            </View>
          ))}
        </View>
      )}
    </Section>
  );
}

function HeroStat({ icon, color, value, label }: { icon: keyof typeof Ionicons.glyphMap; color: string; value: string; label: string }) {
  return (
    <View style={styles.heroStat}>
      <Ionicons name={icon} size={14} color={color} />
      <Text style={styles.heroStatValue}>{value}</Text>
      <Text style={styles.heroStatLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const MEDALS = ['#FBBF24', '#CBD5E1', '#D97706'];
function Rank({ i }: { i: number }) {
  return i < 3
    ? <View style={[styles.medal, { backgroundColor: `${MEDALS[i]}26`, borderColor: MEDALS[i] }]}><Text style={[styles.medalText, { color: MEDALS[i] }]}>{i + 1}</Text></View>
    : <Text style={styles.rankNum}>{i + 1}</Text>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex1: { flex: 1, minWidth: 0 },
  link: { color: colors.primarySoft, fontSize: 12, fontWeight: '700' },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },

  levelUp: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginHorizontal: spacing.lg, marginBottom: spacing.md,
    padding: spacing.md, borderRadius: radius.md, backgroundColor: `${colors.warning}1A`, borderWidth: 1, borderColor: `${colors.warning}55`,
  },
  levelUpText: { color: colors.textPrimary, fontSize: 13, fontWeight: '700', flex: 1 },

  hero: {
    marginHorizontal: spacing.lg, padding: spacing.lg, borderRadius: radius.lg,
    backgroundColor: '#111B33', borderWidth: 1, borderColor: `${colors.primary}55`,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  heroBadge: {
    width: 68, height: 68, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    backgroundColor: `${colors.primary}26`, borderWidth: 1.5, borderColor: `${colors.primary}AA`,
  },
  heroBadgeLabel: { color: '#93C5FD', fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  heroBadgeValue: { color: colors.white, fontSize: 32, fontWeight: '900', lineHeight: 34 },
  heroName: { color: colors.textPrimary, fontSize: 20, fontWeight: '900' },
  heroTotal: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  heroTotalNum: { color: colors.primarySoft, fontWeight: '900', fontSize: 14 },
  heroScale: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  heroScaleText: { color: colors.textMuted, fontSize: 10, fontVariant: ['tabular-nums'] },
  heroStats: { flexDirection: 'row', marginTop: spacing.lg, gap: spacing.sm },
  heroStat: { flex: 1, backgroundColor: `${colors.background}AA`, borderRadius: radius.md, padding: spacing.sm, alignItems: 'flex-start' },
  heroStatValue: { color: colors.textPrimary, fontSize: 17, fontWeight: '900', marginTop: 4, fontVariant: ['tabular-nums'] },
  heroStatLabel: { color: colors.textMuted, fontSize: 10 },
  disclaimer: { marginHorizontal: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.lg },

  mission: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  missionDone: { borderColor: `${colors.success}66`, backgroundColor: `${colors.success}0F` },
  missionTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  missionTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: '700', flex: 1 },
  missionScope: { color: colors.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
  missionWhy: { color: colors.textMuted, fontSize: 11, marginTop: 4 },
  missionBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  missionCount: { color: colors.textSecondary, fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] },

  chart: { flexDirection: 'row', alignItems: 'flex-end', height: 140, gap: 6 },
  col: { flex: 1, alignItems: 'center', height: '100%' },
  colValue: { color: colors.textSecondary, fontSize: 9, fontWeight: '700', height: 14 },
  colTrack: { flex: 1, width: '70%', justifyContent: 'flex-end' },
  colBar: { width: '100%', borderTopLeftRadius: 4, borderTopRightRadius: 4, minHeight: 2 },
  colLabel: { color: colors.textMuted, fontSize: 9, marginTop: 4 },

  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  badge: { flexBasis: '47%', flexGrow: 1, minHeight: 130, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, backgroundColor: colors.background },
  badgeEarned: { borderColor: '#7C3AED88', backgroundColor: '#2E106533' },
  badgeIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  badgeIconEarned: { borderColor: '#7C3AED', backgroundColor: '#7C3AED33' },
  badgeName: { color: colors.textPrimary, fontSize: 12, fontWeight: '800' },
  badgeRule: { color: colors.textMuted, fontSize: 10, marginTop: 3, lineHeight: 14 },
  badgeProgress: { color: colors.textSecondary, fontSize: 10, marginTop: 3, fontVariant: ['tabular-nums'] },

  periodRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.xs },
  period: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border },
  periodActive: { borderColor: colors.primary, backgroundColor: `${colors.primary}1F` },
  periodText: { color: colors.textSecondary, fontSize: 11, fontWeight: '700' },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  rankMe: { backgroundColor: `${colors.primary}14`, borderRadius: radius.sm },
  rankNum: { width: 24, textAlign: 'center', color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  medal: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  medalText: { fontSize: 11, fontWeight: '900' },
  teamDot: { width: 10, height: 10, borderRadius: 3 },
  rankName: { color: colors.textPrimary, fontSize: 13, fontWeight: '700' },
  rankMeta: { color: colors.textMuted, fontSize: 11, marginTop: 1 },
  rankXp: { color: colors.primarySoft, fontSize: 14, fontWeight: '900', fontVariant: ['tabular-nums'] },
  optIn: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md },
  optInText: { color: colors.textSecondary, fontSize: 12, flex: 1 },
  selfRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md },
  selfBox: { flex: 1, alignItems: 'center', padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  selfValue: { color: colors.textPrimary, fontSize: 24, fontWeight: '900', fontVariant: ['tabular-nums'] },

  challenge: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },

  kudo: { paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  kudoWho: { color: colors.textPrimary, fontSize: 12, fontWeight: '800' },
  kudoText: { color: colors.textSecondary, fontSize: 12, marginTop: 2, fontStyle: 'italic' },

  eventRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2 },
  eventPts: { width: 44, textAlign: 'right', fontSize: 14, fontWeight: '900', fontVariant: ['tabular-nums'] },
  eventKind: { color: colors.textPrimary, fontSize: 13, fontWeight: '700' },
  eventDate: { color: colors.textMuted, fontSize: 10 },

  rulesToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: spacing.md },
  ruleRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  ruleLabel: { color: colors.textSecondary, fontSize: 12, flex: 1, paddingRight: spacing.sm },
  ruleValue: { color: colors.textPrimary, fontSize: 12, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
