// Full-screen task creation (was a cramped bottom sheet). Same fields as the
// web CreateTaskModal: title, description, status, priority, dates,
// assignee, tags.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { Tag, TaskPriority, TaskStatus, User } from '../../types';
import { STATUS_CONFIG, STATUS_ORDER, PRIORITY_CONFIG, PRIORITY_ORDER, colors, spacing } from '../../theme';
import { Button, Chip, SectionTitle, TextField } from '../../components/ui';
import { DateTimeField } from '../../components/DateTimeField';
import { UserPickerField } from '../../components/UserPicker';
import { TagChips } from '../../components/TagChips';

export default function CreateTaskScreen({ route, navigation }: any) {
  const { projectId, workspaceId, status: initialStatus } = route.params;
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>(initialStatus || 'a_faire');
  const [priority, setPriority] = useState<TaskPriority>('normale');
  // Defaults to yourself, like the web quick-add.
  const [assigneeId, setAssigneeId] = useState<string | null>(user?.id || null);
  const [startAt, setStartAt] = useState<Date | null>(null);
  const [endAt, setEndAt] = useState<Date | null>(null);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Every platform user, not just workspace members — assigning someone
    // new auto-grants them workspace access server-side.
    api.getUsers().then(setUsers).catch(() => {});
    api.getWorkspaceTags(workspaceId).then(setTags).catch(() => {});
  }, [workspaceId]);

  const onSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Titre requis', 'Donnez un titre à la tâche.');
      return;
    }
    if (startAt && endAt && endAt < startAt) {
      Alert.alert('Dates incohérentes', "L'échéance doit être après le début.");
      return;
    }
    setSubmitting(true);
    try {
      await api.createTask(projectId, {
        title: title.trim(),
        description: description.trim() || undefined,
        status,
        priority,
        assignee_id: assigneeId,
        start_at: startAt ? startAt.toISOString() : null,
        end_at: endAt ? endAt.toISOString() : null,
        tag_ids: tagIds,
      } as any);
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Erreur', err.message || 'Impossible de créer cette tâche.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TextField label="Titre *" value={title} onChangeText={setTitle} placeholder="Que faut-il faire ?" autoFocus />
        <TextField
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="Détails, contexte, liens… (optionnel)"
          multiline
        />

        <SectionTitle>Statut</SectionTitle>
        <View style={styles.chipRow}>
          {STATUS_ORDER.map(s => (
            <Chip key={s} label={STATUS_CONFIG[s].label} active={status === s} color={STATUS_CONFIG[s].color} onPress={() => setStatus(s)} />
          ))}
        </View>

        <SectionTitle>Priorité</SectionTitle>
        <View style={styles.chipRow}>
          {PRIORITY_ORDER.map(p => (
            <Chip key={p} label={PRIORITY_CONFIG[p].label} active={priority === p} color={PRIORITY_CONFIG[p].color} onPress={() => setPriority(p)} />
          ))}
        </View>

        <UserPickerField label="Assigné à" users={users} value={assigneeId} onChange={setAssigneeId} />

        <DateTimeField label="Début" value={startAt} onChange={setStartAt} defaultHour={9} />
        <DateTimeField label="Échéance" value={endAt} onChange={setEndAt} defaultHour={18} />

        <SectionTitle>Tags</SectionTitle>
        <TagChips
          tags={tags}
          selectedIds={tagIds}
          onToggle={id => setTagIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))}
        />
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <Button title="Créer la tâche" onPress={onSubmit} loading={submitting} fullWidth />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
});
