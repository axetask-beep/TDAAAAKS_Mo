import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, radius } from '../../theme';
import { Avatar, Button, TextField, Card } from '../../components/ui';
import { pickAndResizeImageAsDataUrl } from '../../lib/image';
import {
  SoundEffectType,
  SOUND_TYPES,
  SOUND_LABELS,
  getSoundSettings,
  setSoundSettings,
  previewSound,
} from '../../lib/sound';

export default function ProfileScreen({ navigation }: any) {
  const { user, updateProfile, changePassword, logout } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [saving, setSaving] = useState(false);
  const [pickingPhoto, setPickingPhoto] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundType, setSoundType] = useState<SoundEffectType>('harmonic_success');

  useEffect(() => {
    getSoundSettings().then(cfg => {
      setSoundEnabled(cfg.enabled);
      setSoundType(cfg.type);
    });
  }, []);

  const onToggleSound = async (enabled: boolean) => {
    setSoundEnabled(enabled);
    await setSoundSettings({ enabled });
    if (enabled) previewSound(soundType);
  };

  const onSelectSound = async (type: SoundEffectType) => {
    setSoundType(type);
    await setSoundSettings({ type });
    previewSound(type);
  };

  const onSave = async () => {
    if (!name.trim() || !email.trim()) return;
    setSaving(true);
    try {
      await updateProfile(name.trim(), email.trim());
      Alert.alert('Profil mis à jour');
    } catch (err: any) {
      Alert.alert('Erreur', err.message || 'Mise à jour impossible.');
    } finally {
      setSaving(false);
    }
  };

  const onChangeAvatar = async () => {
    setPickingPhoto(true);
    try {
      const dataUrl = await pickAndResizeImageAsDataUrl();
      if (!dataUrl) return;
      await updateProfile(user?.name || '', undefined, dataUrl);
    } catch (err: any) {
      Alert.alert('Erreur', err.message || "Impossible de mettre à jour la photo.");
    } finally {
      setPickingPhoto(false);
    }
  };

  const onChangePassword = async () => {
    if (newPassword.length < 6) {
      Alert.alert('Mot de passe trop court', 'Le nouveau mot de passe doit comporter au moins 6 caractères.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Erreur', 'Les deux mots de passe ne correspondent pas.');
      return;
    }
    setChangingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Mot de passe changé avec succès');
    } catch (err: any) {
      Alert.alert('Erreur', err.message || 'Changement de mot de passe impossible.');
    } finally {
      setChangingPassword(false);
    }
  };

  const onLogout = () => {
    Alert.alert('Se déconnecter', 'Voulez-vous vraiment vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Se déconnecter', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: spacing.md }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Pressable onPress={onChangeAvatar} disabled={pickingPhoto} style={styles.avatarWrap}>
          <Avatar user={user} size={72} />
          <View style={styles.avatarEditBadge}>
            <Ionicons name="camera-outline" size={14} color={colors.white} />
          </View>
        </Pressable>
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={styles.pillsRow}>
          <View style={styles.rolePill}>
            <Text style={styles.roleText}>{user?.role === 'admin' ? 'Administrateur' : 'Membre'}</Text>
          </View>
          {user?.job_function ? (
            <View style={styles.functionPill}>
              <Text style={styles.functionText}>{user.job_function.name}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Mes informations personnelles</Text>
        <TextField label="Nom complet" value={name} onChangeText={setName} />
        <TextField
          label="Adresse email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Button title="Enregistrer" onPress={onSave} loading={saving} fullWidth />
      </Card>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Changer le mot de passe</Text>
        <TextField
          label="Mot de passe actuel"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
        />
        <TextField
          label="Nouveau mot de passe"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          placeholder="6 caractères minimum"
        />
        <TextField
          label="Confirmer le nouveau mot de passe"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />
        <Button title="Changer le mot de passe" onPress={onChangePassword} loading={changingPassword} fullWidth />
      </Card>

      <Card style={styles.card}>
        <View style={styles.soundHeader}>
          <Text style={styles.cardTitle}>Son des notifications</Text>
          <Pressable
            style={[styles.soundToggle, soundEnabled && styles.soundToggleActive]}
            onPress={() => onToggleSound(!soundEnabled)}
          >
            <Ionicons name={soundEnabled ? 'volume-high-outline' : 'volume-mute-outline'} size={14} color={soundEnabled ? colors.white : colors.textMuted} />
            <Text style={[styles.soundToggleText, soundEnabled && styles.soundToggleTextActive]}>
              {soundEnabled ? 'Activé' : 'Désactivé'}
            </Text>
          </Pressable>
        </View>
        <Text style={styles.soundHint}>Touche un son pour l'écouter et le choisir.</Text>
        <View style={styles.soundGrid}>
          {SOUND_TYPES.map(type => {
            const active = soundType === type;
            return (
              <Pressable
                key={type}
                style={[styles.soundOption, active && styles.soundOptionActive]}
                onPress={() => onSelectSound(type)}
              >
                <Ionicons name="play" size={12} color={active ? colors.primarySoft : colors.textMuted} />
                <Text style={[styles.soundOptionText, active && styles.soundOptionTextActive]}>{SOUND_LABELS[type]}</Text>
                {active && <Ionicons name="checkmark-circle" size={14} color={colors.primarySoft} />}
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Pressable style={styles.linkRow} onPress={() => navigation.navigate('Reports')}>
        <Ionicons name="document-text-outline" size={20} color={colors.primarySoft} />
        <Text style={styles.linkText}>Rapports</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>

      <Pressable style={styles.linkRow} onPress={() => navigation.navigate('Announcements')}>
        <Ionicons name="megaphone-outline" size={20} color={colors.warning} />
        <Text style={styles.linkText}>{user?.role === 'admin' ? 'Gérer les annonces' : 'Voir les annonces'}</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>

      <Pressable style={styles.linkRow} onPress={() => navigation.navigate('TeamManagement')}>
        <Ionicons name="people-outline" size={20} color={colors.textSecondary} />
        <Text style={styles.linkText}>{user?.role === 'admin' ? "Gérer l'équipe" : "Voir l'équipe"}</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>

      <Button title="Se déconnecter" variant="danger" onPress={onLogout} fullWidth />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.xl },
  header: { alignItems: 'center' },
  avatarWrap: { position: 'relative' },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  name: { color: colors.textPrimary, fontSize: 18, fontWeight: '800', marginTop: spacing.md },
  email: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  pillsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  rolePill: { backgroundColor: `${colors.primary}26`, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 4 },
  roleText: { color: colors.primarySoft, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  functionPill: { backgroundColor: colors.surfaceAlt, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 4 },
  functionText: { color: colors.textSecondary, fontSize: 11, fontWeight: '700' },
  card: { gap: 0 },
  cardTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: '700', marginBottom: spacing.md },
  soundHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  soundToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  soundToggleActive: { backgroundColor: colors.primary },
  soundToggleText: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  soundToggleTextActive: { color: colors.white },
  soundHint: { color: colors.textMuted, fontSize: 11, marginBottom: spacing.md },
  soundGrid: { gap: spacing.xs },
  soundOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  soundOptionActive: { borderColor: colors.primary, backgroundColor: `${colors.primary}1A` },
  soundOptionText: { flex: 1, color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  soundOptionTextActive: { color: colors.textPrimary },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  linkText: { flex: 1, color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
});
