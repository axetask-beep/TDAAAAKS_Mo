import React, { useEffect, useState } from 'react';
import { Alert, View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { api } from '../../lib/api';
import { JobFunction } from '../../types';
import { FormModal } from '../FormModal';
import { Button, TextField, Chip } from '../ui';
import { colors, spacing } from '../../theme';

export default function CreateUserModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'member'>('member');
  const [functionId, setFunctionId] = useState<string | null>(null);
  const [jobFunctions, setJobFunctions] = useState<JobFunction[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      api.getJobFunctions().then(setJobFunctions).catch(() => {});
    }
  }, [visible]);

  const reset = () => {
    setName('');
    setEmail('');
    setPassword('');
    setRole('member');
    setFunctionId(null);
  };

  const onSubmit = async () => {
    if (!name.trim() || !email.trim() || password.length < 6) {
      Alert.alert('Formulaire incomplet', 'Nom, email et un mot de passe de 6 caractères minimum sont requis.');
      return;
    }
    setSubmitting(true);
    try {
      await api.createUser({ name: name.trim(), email: email.trim(), password, role, function_id: functionId });
      reset();
      onCreated();
      onClose();
    } catch (err: any) {
      Alert.alert('Erreur', err.message || 'Impossible de créer ce compte.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModal visible={visible} onClose={onClose} title="Ajouter un membre">
      <TextField label="Nom complet" value={name} onChangeText={setName} autoFocus />
      <TextField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <TextField label="Mot de passe temporaire" value={password} onChangeText={setPassword} secureTextEntry />
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
        <Chip label="Membre" active={role === 'member'} onPress={() => setRole('member')} />
        <Chip label="Administrateur" active={role === 'admin'} onPress={() => setRole('admin')} />
      </View>

      {jobFunctions.length > 0 && (
        <>
          <Text style={styles.label}>Fonction / Poste</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.lg }}>
            <Pressable
              style={[styles.functionChip, !functionId && styles.functionChipActive]}
              onPress={() => setFunctionId(null)}
            >
              <Text style={styles.functionChipText}>Aucune</Text>
            </Pressable>
            {jobFunctions.map(fn => (
              <Pressable
                key={fn.id}
                style={[styles.functionChip, functionId === fn.id && styles.functionChipActive]}
                onPress={() => setFunctionId(fn.id)}
              >
                <Text style={styles.functionChipText}>{fn.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </>
      )}

      <Button title="Créer le compte" onPress={onSubmit} loading={submitting} fullWidth />
    </FormModal>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.4 },
  functionChip: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    marginRight: spacing.sm,
  },
  functionChipActive: { borderColor: colors.primary, backgroundColor: `${colors.primary}26` },
  functionChipText: { color: colors.textPrimary, fontSize: 12, fontWeight: '600' },
});
