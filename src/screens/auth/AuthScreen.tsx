// Mirrors AXETASKS/src/components/auth/AuthView.tsx: one screen with an
// internal Connexion/Créer un compte switcher instead of two separate routes,
// same dark card layout, icon-prefixed fields and feature pills.
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Pressable,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, radius } from '../../theme';

export default function AuthScreen() {
  const { login, signup, error, clearError } = useAuth();

  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!email || !password || (!isLogin && !name)) return;
    setLoading(true);
    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await signup(name, email, password);
      }
    } catch {
      // error state is already surfaced by AuthContext
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (login: boolean) => {
    setIsLogin(login);
    clearError();
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          {/* The logo already contains the "AxeTask" wordmark. */}
          <Image source={require('../../../assets/axetask-logo.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.tagline}>
            Plateforme de productivité &amp; gestion multi-ventures pour équipes agiles.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.switcher}>
            <Pressable
              onPress={() => switchMode(true)}
              style={[styles.switcherBtn, isLogin && styles.switcherBtnActive]}
            >
              <Text style={[styles.switcherText, isLogin && styles.switcherTextActive]}>Connexion</Text>
            </Pressable>
            <Pressable
              onPress={() => switchMode(false)}
              style={[styles.switcherBtn, !isLogin && styles.switcherBtnActive]}
            >
              <Text style={[styles.switcherText, !isLogin && styles.switcherTextActive]}>Créer un compte</Text>
            </Pressable>
          </View>

          {error ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={16} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.form}>
            {!isLogin && (
              <View>
                <Text style={styles.label}>Nom complet</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="person-outline" size={16} color={colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    value={name}
                    onChangeText={t => { setName(t); clearError(); }}
                    placeholder="Alexandre Martin"
                    placeholderTextColor={colors.textMuted}
                    style={styles.input}
                  />
                </View>
              </View>
            )}

            <View>
              <Text style={styles.label}>Adresse email</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="mail-outline" size={16} color={colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  value={email}
                  onChangeText={t => { setEmail(t); clearError(); }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="votre.email@axetask.com"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                />
              </View>
            </View>

            <View>
              <Text style={styles.label}>Mot de passe</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed-outline" size={16} color={colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  value={password}
                  onChangeText={t => { setPassword(t); clearError(); }}
                  secureTextEntry={!showPassword}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, styles.inputWithSuffix]}
                />
                <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn} hitSlop={8}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={16} color={colors.textMuted} />
                </Pressable>
              </View>
            </View>

            <Pressable
              onPress={onSubmit}
              disabled={loading}
              style={({ pressed }) => [styles.submitBtn, (loading || pressed) && { opacity: 0.85 }]}
            >
              <Text style={styles.submitText}>
                {loading ? 'Connexion en cours...' : isLogin ? 'Se connecter' : 'Créer mon compte'}
              </Text>
              <Ionicons name="arrow-forward" size={16} color={colors.white} />
            </Pressable>
          </View>
        </View>

        <View style={styles.pillsRow}>
          <View style={styles.pill}>
            <Ionicons name="checkmark-circle" size={12} color={colors.primaryLight} />
            <Text style={styles.pillText}>Contrôle d'accès RBAC</Text>
          </View>
          <View style={styles.pill}>
            <Ionicons name="checkmark-circle" size={12} color={colors.primaryLight} />
            <Text style={styles.pillText}>PostgreSQL Cloud SQL</Text>
          </View>
          <View style={styles.pill}>
            <Ionicons name="checkmark-circle" size={12} color={colors.primaryLight} />
            <Text style={styles.pillText}>Gestion Admin</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  brand: { alignItems: 'center', marginBottom: spacing.lg },
  logo: { width: 160, height: 160, marginBottom: spacing.xs },
  tagline: { color: colors.textSecondary, fontSize: 12, textAlign: 'center', marginTop: spacing.xs, maxWidth: 280, lineHeight: 17 },

  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  switcher: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 4,
    gap: 4,
    marginBottom: spacing.md,
  },
  switcherBtn: { flex: 1, paddingVertical: 8, borderRadius: radius.sm, alignItems: 'center' },
  switcherBtnActive: { backgroundColor: colors.primary },
  switcherText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  switcherTextActive: { color: colors.white },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: `${colors.danger}1A`,
    borderWidth: 1,
    borderColor: `${colors.danger}4D`,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  errorText: { color: colors.danger, fontSize: 12, fontWeight: '600', flexShrink: 1 },

  form: { gap: spacing.sm },
  label: { color: colors.textMuted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  inputWrap: { position: 'relative', justifyContent: 'center' },
  inputIcon: { position: 'absolute', left: 12, zIndex: 1 },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingLeft: 34,
    paddingRight: 12,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  inputWithSuffix: { paddingRight: 36 },
  eyeBtn: { position: 'absolute', right: 12 },

  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 12,
    marginTop: spacing.xs,
  },
  submitText: { color: colors.white, fontSize: 13, fontWeight: '700' },

  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pillText: { color: colors.textMuted, fontSize: 10, fontWeight: '600' },
});
