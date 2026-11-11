import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, FlatList } from 'react-native';
import { api } from '../../lib/api';
import { User, Conversation } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { FormModal } from '../FormModal';
import { Avatar, LoadingScreen } from '../ui';
import { colors, spacing } from '../../theme';

export default function NewConversationModal({
  visible,
  onClose,
  onStarted,
}: {
  visible: boolean;
  onClose: () => void;
  onStarted: (conv: Conversation) => void;
}) {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingId, setStartingId] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setLoading(true);
      api.getUsers()
        .then(list => setUsers(list.filter(u => u.id !== user?.id)))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [visible, user?.id]);

  const start = async (targetId: string) => {
    setStartingId(targetId);
    try {
      const conv = await api.startConversation(targetId);
      onStarted(conv);
    } catch (err: any) {
      Alert.alert('Erreur', err.message || 'Impossible de démarrer la conversation.');
    } finally {
      setStartingId(null);
    }
  };

  return (
    <FormModal visible={visible} onClose={onClose} title="Nouvelle conversation">
      {loading ? (
        <LoadingScreen />
      ) : (
        <FlatList
          data={users}
          keyExtractor={u => u.id}
          style={{ maxHeight: 360 }}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => start(item.id)} disabled={!!startingId}>
              <Avatar user={item} size={36} />
              <View style={styles.flex1}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.email}>{item.email}</Text>
              </View>
              {startingId === item.id ? <Text style={styles.loading}>…</Text> : null}
            </Pressable>
          )}
        />
      )}
    </FormModal>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  flex1: { flex: 1 },
  name: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  email: { color: colors.textMuted, fontSize: 12 },
  loading: { color: colors.textMuted },
});
