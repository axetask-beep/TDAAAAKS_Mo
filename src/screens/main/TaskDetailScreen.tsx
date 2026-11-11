import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Linking,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { Tag, Task, TaskStatus, TaskPriority, User } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, radius, STATUS_CONFIG, STATUS_ORDER, PRIORITY_CONFIG, PRIORITY_ORDER } from '../../theme';
import { Avatar, Chip, EmptyState, LoadingScreen, SectionTitle, TextField } from '../../components/ui';
import { ChronoBadge } from '../../components/ChronoBadge';
import { DateTimeField } from '../../components/DateTimeField';
import { UserPickerField } from '../../components/UserPicker';
import { TagChips } from '../../components/TagChips';
import { pickFileAsDataUrl, openDataUrl } from '../../lib/file';
import { isoToDate } from '../../lib/datetime';
import { formatRelative } from '../../lib/format';

// The task page used to be one very long scroll; it's split into tabs so
// each part (edit fields / checklist / discussion / files) fits on screen.
type TabKey = 'details' | 'checklist' | 'discussion' | 'files';

export default function TaskDetailScreen({ route, navigation }: any) {
  const { taskId } = route.params;
  const { user } = useAuth();

  const [task, setTask] = useState<Task | null>(null);
  const [members, setMembers] = useState<User[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('details');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [newSubtask, setNewSubtask] = useState('');
  const [newComment, setNewComment] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [addingLink, setAddingLink] = useState(false);
  const [linkName, setLinkName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  const load = useCallback(async () => {
    try {
      const t = await api.getTask(taskId);
      setTask(t);
      setTitle(t.title);
      setDescription(t.description || '');
      // Every platform user, not just workspace members — assigning someone
      // new auto-grants them workspace access server-side.
      api.getUsers().then(setMembers).catch(() => {});
      const wsId = t.workspace_id || t.project?.workspace_id;
      if (wsId) api.getWorkspaceTags(wsId).then(setTags).catch(() => {});
    } catch (err: any) {
      Alert.alert('Erreur', err.message || 'Impossible de charger la tâche.');
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onDelete = () => {
    Alert.alert('Supprimer la tâche', 'Cette action est irréversible.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteTask(taskId);
            navigation.goBack();
          } catch (err: any) {
            Alert.alert('Erreur', err.message || 'Suppression impossible.');
          }
        },
      },
    ]);
  };

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={onDelete} hitSlop={10} style={{ marginRight: spacing.sm }}>
          <Ionicons name="trash-outline" size={21} color={colors.danger} />
        </Pressable>
      ),
    });
  }, [taskId]);

  const patchTask = async (updates: Partial<Task> & { tag_ids?: string[] }) => {
    if (!task) return;
    const { tag_ids, ...fields } = updates;
    setTask(prev => (prev ? { ...prev, ...fields, ...(tag_ids ? { tags: tags.filter(t => tag_ids.includes(t.id)) } : {}) } : prev));
    try {
      const updated = await api.updateTask(task.id, updates);
      setTask(prev => (prev ? { ...prev, ...updated } : updated));
    } catch (err: any) {
      Alert.alert('Erreur', err.message || 'La mise à jour a échoué.');
      load();
    }
  };

  const toggleTag = (tagId: string) => {
    const current = task?.tags?.map(t => t.id) || [];
    patchTask({ tag_ids: current.includes(tagId) ? current.filter(id => id !== tagId) : [...current, tagId] });
  };

  const addSubtask = async () => {
    if (!newSubtask.trim() || !task) return;
    const text = newSubtask.trim();
    setNewSubtask('');
    try {
      const created = await api.addSubtask(task.id, text);
      setTask(prev => (prev ? { ...prev, subtasks: [...(prev.subtasks || []), created] } : prev));
    } catch (err: any) {
      Alert.alert('Erreur', err.message || "Impossible d'ajouter la sous-tâche.");
    }
  };

  const toggleSubtask = async (id: string, completed: boolean) => {
    setTask(prev => (prev ? { ...prev, subtasks: prev.subtasks?.map(s => (s.id === id ? { ...s, completed } : s)) } : prev));
    try {
      await api.updateSubtask(id, { completed });
    } catch {
      load();
    }
  };

  const deleteSubtask = async (id: string) => {
    setTask(prev => (prev ? { ...prev, subtasks: prev.subtasks?.filter(s => s.id !== id) } : prev));
    try {
      await api.deleteSubtask(id);
    } catch (err: any) {
      Alert.alert('Erreur', err.message || 'Suppression impossible.');
      load();
    }
  };

  const addComment = async () => {
    if (!newComment.trim() || !task) return;
    const content = newComment.trim();
    setNewComment('');
    try {
      const created = await api.addComment(task.id, content);
      setTask(prev => (prev ? { ...prev, comments: [...(prev.comments || []), { ...created, user } as any] } : prev));
    } catch (err: any) {
      Alert.alert('Erreur', err.message || "Impossible d'ajouter le commentaire.");
    }
  };

  const deleteComment = (id: string) => {
    Alert.alert('Supprimer ce commentaire ?', undefined, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteComment(id);
            setTask(prev => (prev ? { ...prev, comments: prev.comments?.filter(c => c.id !== id) } : prev));
          } catch (err: any) {
            Alert.alert('Erreur', err.message || 'Suppression impossible.');
          }
        },
      },
    ]);
  };

  const onImportFile = async () => {
    if (!task) return;
    setUploadingFile(true);
    try {
      const picked = await pickFileAsDataUrl();
      if (!picked) return;
      const created = await api.addAttachment(task.id, {
        file_name: picked.name,
        file_url: picked.dataUrl,
        file_size: picked.size,
        file_type: picked.type,
      });
      setTask(prev => (prev ? { ...prev, attachments: [...(prev.attachments || []), { ...created, uploader: user } as any] } : prev));
    } catch (err: any) {
      Alert.alert('Erreur', err.message || "Impossible d'importer le fichier.");
    } finally {
      setUploadingFile(false);
    }
  };

  const onAddLink = async () => {
    if (!task || !linkName.trim() || !linkUrl.trim()) return;
    try {
      const created = await api.addAttachment(task.id, {
        file_name: linkName.trim(),
        file_url: linkUrl.trim(),
        file_type: 'link',
      });
      setTask(prev => (prev ? { ...prev, attachments: [...(prev.attachments || []), { ...created, uploader: user } as any] } : prev));
      setLinkName('');
      setLinkUrl('');
      setAddingLink(false);
    } catch (err: any) {
      Alert.alert('Erreur', err.message || "Impossible d'attacher ce lien.");
    }
  };

  const onDeleteAttachment = (attachmentId: string) => {
    Alert.alert('Supprimer ce fichier ?', undefined, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteAttachment(attachmentId);
            setTask(prev => (prev ? { ...prev, attachments: prev.attachments?.filter(a => a.id !== attachmentId) } : prev));
          } catch (err: any) {
            Alert.alert('Erreur', err.message || 'Suppression impossible.');
          }
        },
      },
    ]);
  };

  if (loading || !task) return <LoadingScreen label="Chargement de la tâche…" />;

  const subtasks = task.subtasks || [];
  const comments = task.comments || [];
  const attachments = task.attachments || [];
  const doneSubtasks = subtasks.filter(s => s.completed).length;
  const TABS: { key: TabKey; label: string; icon: keyof typeof Ionicons.glyphMap; count?: string }[] = [
    { key: 'details', label: 'Détails', icon: 'document-text-outline' },
    { key: 'checklist', label: 'Checklist', icon: 'checkbox-outline', count: subtasks.length ? `${doneSubtasks}/${subtasks.length}` : undefined },
    { key: 'discussion', label: 'Discussion', icon: 'chatbubbles-outline', count: comments.length ? String(comments.length) : undefined },
    { key: 'files', label: 'Fichiers', icon: 'attach-outline', count: attachments.length ? String(attachments.length) : undefined },
  ];

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      {/* Always-visible header: title, where it lives, live chrono */}
      <View style={styles.top}>
        <TextInput
          style={styles.titleInput}
          value={title}
          onChangeText={setTitle}
          onBlur={() => { if (title.trim() && title !== task.title) patchTask({ title: title.trim() }); }}
          multiline
        />
        {task.project?.name || task.workspace?.name ? (
          <Text style={styles.breadcrumb} numberOfLines={1}>
            {task.workspace?.name}{task.workspace?.name && task.project?.name ? ' › ' : ''}{task.project?.name}
          </Text>
        ) : null}
        <View style={styles.chronoWrap}>
          <ChronoBadge startAt={task.start_at} endAt={task.end_at} completedAt={task.completed_at} />
        </View>

        <View style={styles.tabs}>
          {TABS.map(t => {
            const active = tab === t.key;
            return (
              <Pressable key={t.key} style={[styles.tab, active && styles.tabActive]} onPress={() => setTab(t.key)}>
                <Ionicons name={t.icon} size={16} color={active ? colors.primarySoft : colors.textMuted} />
                <Text style={[styles.tabText, active && styles.tabTextActive]} numberOfLines={1}>{t.label}</Text>
                {t.count ? <Text style={[styles.tabCount, active && styles.tabTextActive]}>{t.count}</Text> : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {tab === 'details' && (
          <>
            <SectionTitle>Statut</SectionTitle>
            <View style={styles.chipRow}>
              {STATUS_ORDER.map(s => (
                <Chip key={s} label={STATUS_CONFIG[s].label} active={task.status === s} color={STATUS_CONFIG[s].color} onPress={() => patchTask({ status: s as TaskStatus })} />
              ))}
            </View>

            <SectionTitle>Priorité</SectionTitle>
            <View style={styles.chipRow}>
              {PRIORITY_ORDER.map(p => (
                <Chip key={p} label={PRIORITY_CONFIG[p].label} active={task.priority === p} color={PRIORITY_CONFIG[p].color} onPress={() => patchTask({ priority: p as TaskPriority })} />
              ))}
            </View>

            <UserPickerField label="Assigné à" users={members} value={task.assignee_id} onChange={id => patchTask({ assignee_id: id })} />

            <DateTimeField
              label="Début"
              value={isoToDate(task.start_at)}
              onChange={d => patchTask({ start_at: d ? d.toISOString() : null })}
            />
            <DateTimeField
              label="Échéance"
              value={isoToDate(task.end_at)}
              defaultHour={18}
              onChange={d => patchTask({ end_at: d ? d.toISOString() : null })}
            />

            <SectionTitle>Tags</SectionTitle>
            <TagChips tags={tags} selectedIds={task.tags?.map(t => t.id) || []} onToggle={toggleTag} />

            <SectionTitle>Description</SectionTitle>
            <TextField
              value={description}
              onChangeText={setDescription}
              onBlur={() => { if (description !== (task.description || '')) patchTask({ description }); }}
              placeholder="Ajouter une description…"
              multiline
            />
            {task.creator?.name ? (
              <Text style={styles.meta}>Créée par {task.creator.name} · {formatRelative(task.created_at)}</Text>
            ) : null}
          </>
        )}

        {tab === 'checklist' && (
          <>
            {subtasks.length > 0 && (
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.round((doneSubtasks / subtasks.length) * 100)}%` }]} />
              </View>
            )}
            {subtasks.length === 0 && <EmptyState icon="☑️" title="Aucune sous-tâche" subtitle="Découpez la tâche en petites étapes ci-dessous." />}
            {subtasks.map(s => (
              <View key={s.id} style={styles.subtaskRow}>
                <Pressable style={styles.subtaskMain} onPress={() => toggleSubtask(s.id, !s.completed)}>
                  <Ionicons name={s.completed ? 'checkbox' : 'square-outline'} size={22} color={s.completed ? colors.success : colors.textMuted} />
                  <Text style={[styles.subtaskText, s.completed && styles.subtaskDone]}>{s.title}</Text>
                </Pressable>
                <Pressable onPress={() => deleteSubtask(s.id)} hitSlop={10}>
                  <Ionicons name="close" size={18} color={colors.textMuted} />
                </Pressable>
              </View>
            ))}
            <View style={styles.addRow}>
              <TextInput
                style={styles.addInput}
                value={newSubtask}
                onChangeText={setNewSubtask}
                placeholder="Nouvelle étape…"
                placeholderTextColor={colors.textMuted}
                onSubmitEditing={addSubtask}
                blurOnSubmit={false}
                returnKeyType="done"
              />
              <Pressable onPress={addSubtask} style={styles.addBtn}>
                <Ionicons name="add" size={20} color={colors.white} />
              </Pressable>
            </View>
          </>
        )}

        {tab === 'discussion' && (
          <>
            {comments.length === 0 && <EmptyState icon="💬" title="Pas encore de commentaire" subtitle="Posez une question ou partagez une avancée." />}
            {comments.map(c => {
              const mine = c.user_id === user?.id;
              return (
                <View key={c.id} style={styles.commentRow}>
                  <Avatar user={c.user} size={30} />
                  <View style={[styles.commentBubble, mine && styles.commentMine]}>
                    <View style={styles.commentHeader}>
                      <Text style={styles.commentAuthor}>{mine ? 'Vous' : c.user?.name || 'Utilisateur'}</Text>
                      <Text style={styles.commentDate}>{formatRelative(c.created_at)}</Text>
                      {mine && (
                        <Pressable onPress={() => deleteComment(c.id)} hitSlop={8}>
                          <Ionicons name="trash-outline" size={13} color={colors.textMuted} />
                        </Pressable>
                      )}
                    </View>
                    <Text style={styles.commentContent}>{c.content}</Text>
                  </View>
                </View>
              );
            })}
            <View style={styles.addRow}>
              <TextInput
                style={styles.addInput}
                value={newComment}
                onChangeText={setNewComment}
                placeholder="Écrire un commentaire…"
                placeholderTextColor={colors.textMuted}
                multiline
              />
              <Pressable onPress={addComment} style={styles.addBtn}>
                <Ionicons name="send" size={16} color={colors.white} />
              </Pressable>
            </View>
          </>
        )}

        {tab === 'files' && (
          <>
            {attachments.length === 0 && <EmptyState icon="📎" title="Aucun fichier" subtitle="Importez un document ou attachez un lien." />}
            {attachments.map(att => (
              <Pressable key={att.id} style={styles.attachmentRow} onPress={() => (att.file_url.startsWith('/api/')
                    ? api.getAttachmentFile(att.file_url).then(f => openDataUrl(f.data_url, f.file_name)).catch((e: any) => Alert.alert('Ouverture impossible', e.message || 'Réessaie.'))
                    : Linking.openURL(att.file_url).catch(() => {}))}>
                <Ionicons name={att.file_type === 'link' ? 'link-outline' : 'document-attach-outline'} size={18} color={colors.primarySoft} />
                <View style={styles.flex1}>
                  <Text style={styles.attachmentName} numberOfLines={1}>{att.file_name}</Text>
                  <Text style={styles.attachmentMeta}>Ajouté par {att.uploader?.name || "quelqu'un"}</Text>
                </View>
                <Ionicons name="open-outline" size={16} color={colors.textSecondary} />
                <Pressable onPress={() => onDeleteAttachment(att.id)} hitSlop={8} style={{ marginLeft: spacing.sm }}>
                  <Ionicons name="trash-outline" size={16} color={colors.danger} />
                </Pressable>
              </Pressable>
            ))}
            <View style={styles.fileActionsRow}>
              <Pressable style={styles.fileActionBtn} onPress={onImportFile} disabled={uploadingFile}>
                <Ionicons name="cloud-upload-outline" size={16} color={colors.primarySoft} />
                <Text style={styles.fileActionText}>{uploadingFile ? 'Import…' : 'Importer un fichier'}</Text>
              </Pressable>
              <Pressable style={styles.fileActionBtn} onPress={() => setAddingLink(!addingLink)}>
                <Ionicons name="link-outline" size={16} color={colors.textSecondary} />
                <Text style={[styles.fileActionText, { color: colors.textSecondary }]}>Attacher un lien</Text>
              </Pressable>
            </View>
            {addingLink && (
              <View style={styles.linkForm}>
                <TextField placeholder="Nom du lien" value={linkName} onChangeText={setLinkName} />
                <TextField placeholder="https://…" value={linkUrl} onChangeText={setLinkUrl} autoCapitalize="none" keyboardType="url" />
                <View style={styles.linkFormActions}>
                  <Pressable onPress={() => setAddingLink(false)}><Text style={styles.linkCancel}>Annuler</Text></Pressable>
                  <Pressable onPress={onAddLink} style={styles.linkSubmit}><Text style={styles.linkSubmitText}>Attacher</Text></Pressable>
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  flex1: { flex: 1 },
  top: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: colors.background, borderBottomWidth: 1, borderColor: colors.border },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
  titleInput: { color: colors.textPrimary, fontSize: 20, fontWeight: '800', padding: 0 },
  breadcrumb: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  chronoWrap: { marginTop: spacing.sm },
  tabs: { flexDirection: 'row', marginTop: spacing.md },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    gap: 2,
    borderBottomWidth: 2,
    borderColor: 'transparent',
  },
  tabActive: { borderColor: colors.primary },
  tabText: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  tabTextActive: { color: colors.primarySoft },
  tabCount: { color: colors.textMuted, fontSize: 10, fontWeight: '800' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.sm, marginBottom: spacing.lg },
  meta: { color: colors.textMuted, fontSize: 11, marginTop: spacing.xs },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceAlt, overflow: 'hidden', marginBottom: spacing.md },
  progressFill: { height: '100%', backgroundColor: colors.success },
  subtaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  subtaskMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  subtaskText: { color: colors.textPrimary, fontSize: 15, flex: 1 },
  subtaskDone: { color: colors.textMuted, textDecorationLine: 'line-through' },
  addRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginTop: spacing.md },
  addInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    color: colors.textPrimary,
    fontSize: 14,
    maxHeight: 120,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  commentBubble: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm },
  commentMine: { borderColor: `${colors.primary}55`, backgroundColor: `${colors.primary}12` },
  commentHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  commentAuthor: { color: colors.textPrimary, fontSize: 12, fontWeight: '700', flex: 1 },
  commentDate: { color: colors.textMuted, fontSize: 10 },
  commentContent: { color: colors.textSecondary, fontSize: 14, marginTop: 4, lineHeight: 19 },
  attachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  attachmentName: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
  attachmentMeta: { color: colors.textMuted, fontSize: 10, marginTop: 1 },
  fileActionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  fileActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 12,
  },
  fileActionText: { color: colors.primarySoft, fontSize: 12, fontWeight: '700' },
  linkForm: { marginTop: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  linkFormActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: spacing.md },
  linkCancel: { color: colors.textMuted, fontSize: 13, fontWeight: '600', paddingVertical: 8 },
  linkSubmit: { backgroundColor: colors.primary, borderRadius: radius.sm, paddingHorizontal: spacing.lg, paddingVertical: 8 },
  linkSubmitText: { color: colors.white, fontSize: 13, fontWeight: '700' },
});
