import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { Message, ConversationParticipant } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, radius } from '../../theme';
import { LoadingScreen } from '../../components/ui';
import { formatTime } from '../../lib/format';

const ONLINE_WINDOW_MS = 90_000;

function isOnline(p?: ConversationParticipant): boolean {
  if (!p?.last_seen_at) return false;
  return Date.now() - new Date(p.last_seen_at).getTime() < ONLINE_WINDOW_MS;
}

export default function ConversationScreen({ route, navigation }: any) {
  const { conversationId, name } = route.params;
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [other, setOther] = useState<ConversationParticipant | undefined>();
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    navigation.setOptions({ title: name });
  }, [name]);

  const load = useCallback(async (silent = false) => {
    try {
      const [msgs, convs] = await Promise.all([api.getMessages(conversationId), api.getConversations()]);
      setMessages([...msgs].reverse());
      const conv = convs.find(c => c.id === conversationId);
      if (conv && user) setOther(conv.participants.find(p => p.id !== user.id) || conv.participants[0]);
      api.markConversationRead(conversationId).catch(() => {});
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [conversationId, user]);

  useFocusEffect(
    useCallback(() => {
      load();
      const interval = setInterval(() => load(true), 4000);
      return () => clearInterval(interval);
    }, [load])
  );

  const send = async () => {
    if (!text.trim()) return;
    const content = text.trim();
    const replyToId = replyingTo?.id || null;
    setText('');
    setReplyingTo(null);
    try {
      const msg = await api.sendMessage(conversationId, content, replyToId);
      setMessages(prev => [...prev, msg]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <LoadingScreen label="Chargement des messages…" />;

  const lastMineIndex = [...messages].map(m => m.sender_id === user?.id).lastIndexOf(true);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={styles.subHeader}>
        <View style={styles.avatarDotWrap}>
          {isOnline(other) && <View style={styles.onlineDot} />}
        </View>
        <Text style={styles.subHeaderText}>{isOnline(other) ? 'En ligne' : other?.email || ''}</Text>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={m => m.id}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item, index }) => {
          const mine = item.sender_id === user?.id;
          const isSeen = mine && index === lastMineIndex && !!other?.last_read_at && new Date(other.last_read_at) >= new Date(item.created_at);
          return (
            <View style={[styles.bubbleRow, mine && styles.bubbleRowMine]}>
              <Pressable onLongPress={() => setReplyingTo(item)} style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                {item.reply_to && (
                  <View style={styles.quoted}>
                    <Text style={[styles.quotedAuthor, mine && { color: colors.white }]}>{item.reply_to.sender_name || 'Message'}</Text>
                    <Text style={[styles.quotedContent, mine && { color: `${colors.white}CC` }]} numberOfLines={1}>{item.reply_to.content}</Text>
                  </View>
                )}
                <Text style={[styles.bubbleText, mine && { color: colors.white }]}>{item.content}</Text>
              </Pressable>
              <Text style={styles.time}>{formatTime(item.created_at)}</Text>
              {mine && index === lastMineIndex && (
                <View style={styles.seenRow}>
                  <Ionicons name={isSeen ? 'checkmark-done' : 'checkmark'} size={12} color={isSeen ? colors.primarySoft : colors.textMuted} />
                  <Text style={styles.seenText}>{isSeen ? 'Vu' : 'Envoyé'}</Text>
                </View>
              )}
            </View>
          );
        }}
      />

      {replyingTo && (
        <View style={styles.replyBar}>
          <View style={styles.replyBarContent}>
            <Text style={styles.replyBarAuthor}>Réponse à {replyingTo.sender?.name || ''}</Text>
            <Text style={styles.replyBarText} numberOfLines={1}>{replyingTo.content}</Text>
          </View>
          <Pressable onPress={() => setReplyingTo(null)} hitSlop={8}>
            <Ionicons name="close" size={16} color={colors.textMuted} />
          </Pressable>
        </View>
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Écrire un message…"
          placeholderTextColor={colors.textMuted}
          multiline
          onSubmitEditing={send}
        />
        <Pressable style={styles.sendBtn} onPress={send}>
          <Ionicons name="send" size={18} color={colors.white} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  avatarDotWrap: { width: 8, height: 8 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  subHeaderText: { color: colors.textMuted, fontSize: 11 },
  listContent: { padding: spacing.lg, paddingBottom: spacing.md },
  bubbleRow: { marginBottom: spacing.md, alignItems: 'flex-start' },
  bubbleRowMine: { alignItems: 'flex-end' },
  bubble: { maxWidth: '80%', borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: 10 },
  bubbleTheirs: { backgroundColor: colors.surfaceAlt, borderBottomLeftRadius: 4 },
  bubbleMine: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleText: { color: colors.textPrimary, fontSize: 14 },
  quoted: { borderLeftWidth: 2, borderLeftColor: colors.textMuted, paddingLeft: spacing.xs, marginBottom: 4 },
  quotedAuthor: { color: colors.textSecondary, fontSize: 10, fontWeight: '700' },
  quotedContent: { color: colors.textMuted, fontSize: 10 },
  time: { color: colors.textMuted, fontSize: 10, marginTop: 2, marginHorizontal: 4 },
  seenRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2, marginHorizontal: 4 },
  seenText: { color: colors.textMuted, fontSize: 10 },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    backgroundColor: colors.background,
  },
  replyBarContent: { flex: 1, borderLeftWidth: 2, borderLeftColor: colors.primary, paddingLeft: spacing.sm },
  replyBarAuthor: { color: colors.primarySoft, fontSize: 11, fontWeight: '700' },
  replyBarText: { color: colors.textMuted, fontSize: 11 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontSize: 14,
    maxHeight: 100,
  },
  sendBtn: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});
