import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, Pressable, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { api } from '../../lib/api';
import { FormModal } from '../FormModal';
import { Button, TextField } from '../ui';
import { colors, spacing } from '../../theme';
import { formatDate, formatTime } from '../../lib/format';

type PickerTarget = 'start-date' | 'start-time' | 'end-date' | 'end-time' | null;

export default function CreateProjectModal({
  visible,
  onClose,
  workspaceId,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  workspaceId: string;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [link, setLink] = useState('');
  const [startAt, setStartAt] = useState<Date | null>(null);
  const [endAt, setEndAt] = useState<Date | null>(null);
  const [activePicker, setActivePicker] = useState<PickerTarget>(null);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setName('');
    setDescription('');
    setLink('');
    setStartAt(null);
    setEndAt(null);
  };

  const onSubmit = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await api.createProject(workspaceId, {
        name: name.trim(),
        description: description.trim() || undefined,
        link: link.trim() || undefined,
        start_at: startAt ? startAt.toISOString() : undefined,
        end_at: endAt ? endAt.toISOString() : undefined,
      });
      reset();
      onCreated();
      onClose();
    } catch (err: any) {
      Alert.alert('Erreur', err.message || 'Impossible de créer ce projet.');
    } finally {
      setSubmitting(false);
    }
  };

  const onPickerChange = (_: any, selected?: Date) => {
    const target = activePicker;
    setActivePicker(Platform.OS === 'ios' ? target : null);
    if (!selected) return;

    if (target === 'start-date' || target === 'start-time') {
      const base = startAt || new Date();
      setStartAt(
        target === 'start-date'
          ? new Date(selected.getFullYear(), selected.getMonth(), selected.getDate(), base.getHours(), base.getMinutes())
          : new Date(base.getFullYear(), base.getMonth(), base.getDate(), selected.getHours(), selected.getMinutes())
      );
    } else if (target === 'end-date' || target === 'end-time') {
      const base = endAt || new Date();
      setEndAt(
        target === 'end-date'
          ? new Date(selected.getFullYear(), selected.getMonth(), selected.getDate(), base.getHours(), base.getMinutes())
          : new Date(base.getFullYear(), base.getMonth(), base.getDate(), selected.getHours(), selected.getMinutes())
      );
    }
  };

  return (
    <FormModal visible={visible} onClose={onClose} title="Nouveau projet">
      <TextField label="Nom du projet" value={name} onChangeText={setName} placeholder="Ex : Refonte site web" autoFocus />
      <TextField
        label="Description (optionnel)"
        value={description}
        onChangeText={setDescription}
        placeholder="Quelques mots sur ce projet"
        multiline
        numberOfLines={3}
      />
      <TextField label="Lien du projet (optionnel)" value={link} onChangeText={setLink} placeholder="https://…" autoCapitalize="none" autoCorrect={false} keyboardType="url" />

      <View style={styles.row2}>
        <View style={styles.flex1}>
          <Text style={styles.label}>Début</Text>
          <View style={styles.pillRow}>
            <Pressable style={styles.dateButton} onPress={() => setActivePicker('start-date')}>
              <Text style={styles.dateButtonText}>{startAt ? formatDate(startAt.toISOString()) : 'Date'}</Text>
            </Pressable>
            <Pressable style={styles.dateButton} onPress={() => setActivePicker('start-time')}>
              <Text style={styles.dateButtonText}>{startAt ? formatTime(startAt.toISOString()) : 'Heure'}</Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.flex1}>
          <Text style={styles.label}>Fin</Text>
          <View style={styles.pillRow}>
            <Pressable style={styles.dateButton} onPress={() => setActivePicker('end-date')}>
              <Text style={styles.dateButtonText}>{endAt ? formatDate(endAt.toISOString()) : 'Date'}</Text>
            </Pressable>
            <Pressable style={styles.dateButton} onPress={() => setActivePicker('end-time')}>
              <Text style={styles.dateButtonText}>{endAt ? formatTime(endAt.toISOString()) : 'Heure'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
      {activePicker && (
        <DateTimePicker
          value={activePicker.startsWith('start') ? (startAt || new Date()) : (endAt || new Date())}
          mode={activePicker.endsWith('date') ? 'date' : 'time'}
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={onPickerChange}
        />
      )}

      <Button title="Créer le projet" onPress={onSubmit} loading={submitting} fullWidth />
    </FormModal>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.4 },
  row2: { flexDirection: 'row', gap: spacing.md },
  flex1: { flex: 1 },
  pillRow: { flexDirection: 'row', gap: spacing.xs },
  dateButton: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    marginBottom: spacing.lg,
  },
  dateButtonText: { color: colors.textPrimary, fontSize: 13 },
});
