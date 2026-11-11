// Edit / delete a project (web: EditProjectModal + WorkspaceView delete).
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../lib/api';
import { Project } from '../../types';
import { colors, spacing, radius } from '../../theme';
import { Button, Chip, LoadingScreen, SectionTitle, TextField } from '../../components/ui';
import { DateTimeField } from '../../components/DateTimeField';
import { isoToDate } from '../../lib/datetime';

export const PROJECT_STATUS: { id: Project['status']; label: string; color: string }[] = [
  { id: 'planned', label: 'Planifié', color: colors.indigo },
  { id: 'active', label: 'Actif', color: colors.primarySoft },
  { id: 'completed', label: 'Terminé', color: colors.success },
  { id: 'archived', label: 'Archivé', color: colors.textMuted },
];

export default function EditProjectScreen({ route, navigation }: any) {
  const { projectId, workspaceId } = route.params;
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [link, setLink] = useState('');
  const [status, setStatus] = useState<Project['status']>('active');
  const [startAt, setStartAt] = useState<Date | null>(null);
  const [endAt, setEndAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getProject(projectId)
      .then(p => {
        setName(p.name);
        setDescription(p.description || '');
        setLink(p.link || '');
        setStatus(p.status);
        setStartAt(isoToDate(p.start_at));
        setEndAt(isoToDate(p.end_at));
      })
      .catch(err => Alert.alert('Erreur', err.message || 'Impossible de charger le projet.'))
      .finally(() => setLoading(false));
  }, [projectId]);

  const onSave = async () => {
    if (!name.trim()) {
      Alert.alert('Nom requis', 'Le projet doit avoir un nom.');
      return;
    }
    if (startAt && endAt && endAt < startAt) {
      Alert.alert('Dates incohérentes', 'La date de fin doit être après la date de début.');
      return;
    }
    setSaving(true);
    try {
      await api.updateProject(projectId, {
        name: name.trim(),
        description: description.trim() || undefined,
        status,
        link: link.trim() || null,
        start_at: startAt ? startAt.toISOString() : null,
        end_at: endAt ? endAt.toISOString() : null,
      });
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Erreur', err.message || 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = () => {
    Alert.alert(
      'Supprimer le projet ?',
      `« ${name} » et toutes ses tâches seront définitivement supprimés.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteProject(projectId);
              // Skip the (now deleted) project screen.
              navigation.pop(2);
            } catch (err: any) {
              Alert.alert('Erreur', err.message || 'Suppression impossible.');
            }
          },
        },
      ],
    );
  };

  if (loading) return <LoadingScreen label="Chargement du projet…" />;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TextField label="Nom du projet *" value={name} onChangeText={setName} />
        <TextField label="Description" value={description} onChangeText={setDescription} multiline placeholder="Objectif du projet…" />
        <TextField label="Lien du projet" value={link} onChangeText={setLink} placeholder="https://…" autoCapitalize="none" autoCorrect={false} keyboardType="url" />

        <SectionTitle>Statut</SectionTitle>
        <View style={styles.chipRow}>
          {PROJECT_STATUS.map(s => (
            <Chip key={s.id} label={s.label} color={s.color} active={status === s.id} onPress={() => setStatus(s.id)} />
          ))}
        </View>

        <DateTimeField label="Début" value={startAt} onChange={setStartAt} withTime={false} />
        <DateTimeField label="Fin prévue" value={endAt} onChange={setEndAt} withTime={false} defaultHour={18} />

        <View style={styles.danger}>
          <Text style={styles.dangerTitle}>Zone de danger</Text>
          <Text style={styles.dangerText}>La suppression retire le projet et toutes ses tâches. Action irréversible.</Text>
          <Button title="Supprimer le projet" variant="danger" onPress={onDelete} fullWidth />
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <Button title="Enregistrer" onPress={onSave} loading={saving} fullWidth />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  danger: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: `${colors.danger}55`,
    backgroundColor: `${colors.danger}0D`,
  },
  dangerTitle: { color: colors.danger, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  dangerText: { color: colors.textSecondary, fontSize: 12, marginTop: 4, marginBottom: spacing.md },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
});
