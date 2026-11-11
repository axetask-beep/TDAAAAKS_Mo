import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { Conversation, ConversationParticipant } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, radius } from '../../theme';
import { Avatar, EmptyState, LoadingScreen } from '../../components/ui';
import { formatRelative } from '../../lib/format';
import NewConversationModal from '../../components/modals/NewConversationModal';

const ONLINE_WINDOW_MS = 90_000;

function isOnline(p?: ConversationParticipant): boolean {
  if (!p?.last_seen_at) return false;
  return Date.now() - new Date(p.last_seen_at).getTime() < ONLINE_WINDOW_MS;
}

function otherParticipant(conv: Conversation, myId: string): ConversationParticipant | undefined {
  return conv.participants.find(p => p.id !== myId) || conv.participants[0];
}

export default function MessagesScreen({ navigation }: any) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [newOpen, setNewOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.getConversations();
      setConversations(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <LoadingScreen label="Chargement des messages…" />;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.title}>Messages</Text>
        <Pressable style={styles.addButton} onPress={() => setNewOpen(true)}>
          <Ionicons name="create-outline" size={20} color={colors.white} />
        </Pressable>
      </View>

      <FlatList
        data={conversations}
        keyExtractor={c => c.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<EmptyState icon="💬" title="Aucune conversation" subtitle="Démarrez une discussion avec un membre de l'équipe." />}
        renderItem={({ item }) => {
          const other = user ? otherParticipant(item, user.id) : undefined;
          return (
            <Pressable
              style={styles.row}
              onPress={() => navigation.navigate('Conversation', { conversationId: item.id, name: other?.name || 'Conversation' })}
            >
              <View style={styles.avatarWrap}>
                <Avatar user={other} size={44} />
                {isOnline(other) && <View style={styles.onlineDot} />}
              </View>
              <View style={styles.flex1}>
                <View style={styles.rowTop}>
                  <Text style={styles.name} numberOfLines={1}>{item.name || other?.name || 'Conversation'}</Text>
                  {item.last_message ? <Text style={styles.time}>{formatRelative(item.last_message.created_at)}</Text> : null}
                </View>
                <Text style={styles.preview} numberOfLines={1}>
                  {item.last_message?.content || 'Aucun message'}
                </Text>
              </View>
              {item.unread_count > 0 ? (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>{item.unread_count}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        }}
      />

      <NewConversationModal
        visible={newOpen}
        onClose={() => setNewOpen(false)}
        onStarted={conv => {
          setNewOpen(false);
          const other = user ? otherParticipant(conv, user.id) : undefined;
          navigation.navigate('Conversation', { conversationId: conv.id, name: other?.name || 'Conversation' });
        }}
      />
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
  addButton: { width: 36, height: 36, borderRadius: radius.full, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderColor: colors.border },
  avatarWrap: { position: 'relative' },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.background,
  },
  flex1: { flex: 1 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between' },
  name: { color: colors.textPrimary, fontSize: 15, fontWeight: '700', flexShrink: 1 },
  time: { color: colors.textMuted, fontSize: 11 },
  preview: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  unreadBadge: { backgroundColor: colors.primary, borderRadius: radius.full, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  unreadText: { color: colors.white, fontSize: 11, fontWeight: '700' },
});
