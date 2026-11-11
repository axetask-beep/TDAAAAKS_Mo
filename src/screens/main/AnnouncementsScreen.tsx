import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, TextInput, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { Announcement, User } from '../../types';
import { colors, spacing, radius } from '../../theme';
import { Avatar, EmptyState, LoadingScreen } from '../../components/ui';
import { formatDate, formatTime } from '../../lib/format';
import CreateAnnouncementModal from '../../components/modals/CreateAnnouncementModal';

const RECENT_THRESHOLD_MS = 24 * 60 * 60 * 1000;

function toAvatarUser(author: Announcement['author']): User | undefined {
  if (!author) return undefined;
  return { id: author.id, email: '', name: author.name, avatar_url: author.avatar_url || undefined, role: 'member' };
}

export default function AnnouncementsScreen() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const insets = useSafeAreaInsets();

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async (q?: string) => {
    try {
      const list = await api.getAnnouncements(q);
      setAnnouncements(list);
    } catch (err) {
      console.error('Failed to load announcements:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Keeps a live ref of the search box so the focus-triggered reload below
  // (mount + every return to this screen) always refetches with whatever the
  // user last typed, without making useFocusEffect's callback identity churn
  // on every keystroke (that would double-fire alongside the debounce below).
  const searchRef = useRef(search);
  useEffect(() => { searchRef.current = search; }, [search]);

  useFocusEffect(useCallback(() => { load(searchRef.current); }, [load]));

  useEffect(() => {
    const timer = setTimeout(() => load(search), search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [search, load]);

  const handleDelete = (a: Announcement) => {
    Alert.alert("Supprimer l'annonce", `Supprimer définitivement « ${a.title} » ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          setDeletingId(a.id);
          try {
            await api.deleteAnnouncement(a.id);
            setAnnouncements(prev => prev.filter(x => x.id !== a.id));
          } catch (err: any) {
            Alert.alert('Erreur', err.message || 'Suppression impossible.');
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  };

  if (loading) return <LoadingScreen label="Chargement des annonces…" />;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.flex1}>
          <Text style={styles.title}>Annonces</Text>
          <Text style={styles.subtitle}>Communications officielles, conservées avec leur date.</Text>
        </View>
        {isAdmin && (
          <Pressable style={styles.addButton} onPress={() => setCreateOpen(true)}>
            <Ionicons name="megaphone-outline" size={18} color={colors.white} />
          </Pressable>
        )}
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={16} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher une annonce par son titre..."
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
        data={announcements}
        keyExtractor={a => a.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <EmptyState
            icon="📣"
            title="Aucune annonce"
            subtitle={search ? `Aucune annonce ne correspond à « ${search} ».` : 'Rien à afficher pour le moment.'}
          />
        }
        renderItem={({ item }) => {
          const isRecent = Date.now() - new Date(item.created_at).getTime() < RECENT_THRESHOLD_MS;
          return (
            <View style={styles.card}>
              <View style={styles.cardRow}>
                <View style={styles.iconWrap}>
                  <Ionicons name="megaphone" size={18} color={colors.warning} />
                  {isRecent && <View style={styles.recentDot} />}
                </View>

                <View style={styles.flex1}>
                  <View style={styles.titleRow}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    {isRecent && (
                      <View style={styles.newPill}>
                        <Text style={styles.newPillText}>NOUVEAU</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.cardContent}>{item.content}</Text>

                  <View style={styles.footerRow}>
                    <Avatar user={toAvatarUser(item.author)} size={18} />
                    <Text style={styles.footerText} numberOfLines={1}>
                      {item.author?.name || 'Administrateur'}
                    </Text>
                    <Ionicons name="time-outline" size={12} color={colors.textMuted} style={{ marginLeft: spacing.sm }} />
                    <Text style={styles.footerText}>
                      {formatDate(item.created_at)} à {formatTime(item.created_at)}
                    </Text>
                  </View>
                </View>

                {isAdmin && (
                  <Pressable onPress={() => handleDelete(item)} disabled={deletingId === item.id} hitSlop={8} style={styles.deleteBtn}>
                    <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
                  </Pressable>
                )}
              </View>
            </View>
          );
        }}
      />

      {isAdmin && (
        <CreateAnnouncementModal
          visible={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreated={() => load(search)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex1: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  title: { color: colors.textPrimary, fontSize: 22, fontWeight: '800' },
  subtitle: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    height: 38,
  },
  searchIcon: { marginRight: spacing.xs },
  searchInput: { flex: 1, color: colors.textPrimary, fontSize: 14, height: '100%' },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  card: {
    backgroundColor: `${colors.warning}0D`,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: `${colors.warning}26`,
    borderWidth: 2,
    borderColor: `${colors.warning}55`,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  recentDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.background,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  cardTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '800', flexShrink: 1 },
  newPill: {
    backgroundColor: `${colors.danger}26`,
    borderWidth: 1,
    borderColor: `${colors.danger}55`,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  newPillText: { color: colors.danger, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  cardContent: { color: colors.textSecondary, fontSize: 13, marginTop: 6, lineHeight: 18 },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  footerText: { color: colors.textMuted, fontSize: 11 },
  deleteBtn: { padding: 4 },
});
