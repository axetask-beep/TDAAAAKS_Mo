import React, { useState } from 'react';
import { View, Image, Pressable, Text, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { FormModal } from '../FormModal';
import { Button, TextField } from '../ui';
import { pickAndResizeImageAsDataUrl } from '../../lib/image';
import { colors, radius, spacing } from '../../theme';

const PRESET_COLORS = ['#F59E0B', '#EF4444', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

export default function CreateWorkspaceModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [pickingPhoto, setPickingPhoto] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setName('');
    setColor(PRESET_COLORS[0]);
    setPhotoUrl(null);
  };

  const onPickPhoto = async () => {
    setPickingPhoto(true);
    try {
      const dataUrl = await pickAndResizeImageAsDataUrl();
      if (dataUrl) setPhotoUrl(dataUrl);
    } catch (err: any) {
      Alert.alert('Erreur', err.message || "Impossible de traiter l'image.");
    } finally {
      setPickingPhoto(false);
    }
  };

  const onSubmit = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await api.createWorkspace({ name: name.trim(), color, photo_url: photoUrl || undefined });
      reset();
      onCreated();
      onClose();
    } catch (err: any) {
      Alert.alert('Erreur', err.message || 'Impossible de créer cet espace de travail.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModal visible={visible} onClose={onClose} title="Nouvel espace de travail">
      <Pressable style={styles.photoPicker} onPress={onPickPhoto} disabled={pickingPhoto}>
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={styles.photo} />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Ionicons name="image-outline" size={22} color={colors.textMuted} />
          </View>
        )}
        <Text style={styles.photoText}>{pickingPhoto ? 'Chargement…' : photoUrl ? 'Changer la photo' : 'Ajouter une photo'}</Text>
      </Pressable>

      <TextField label="Nom de l'espace" value={name} onChangeText={setName} placeholder="Ex : Axe Digital" autoFocus />

      <Text style={styles.colorLabel}>Couleur d'identification</Text>
      <View style={styles.colorRow}>
        {PRESET_COLORS.map(c => (
          <Pressable
            key={c}
            onPress={() => setColor(c)}
            style={[styles.colorSwatch, { backgroundColor: c }, color === c && styles.colorSwatchActive]}
          />
        ))}
      </View>

      <Button title="Créer l'espace" onPress={onSubmit} loading={submitting} fullWidth />
    </FormModal>
  );
}

const styles = StyleSheet.create({
  photoPicker: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  photo: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  photoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoText: { color: colors.primarySoft, fontSize: 12, fontWeight: '700' },
  colorLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: spacing.xs },
  colorRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg, flexWrap: 'wrap' },
  colorSwatch: { width: 30, height: 30, borderRadius: radius.sm },
  colorSwatchActive: { borderWidth: 2, borderColor: colors.white },
});
