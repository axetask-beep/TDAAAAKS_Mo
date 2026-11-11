// Mobile equivalent of AXETASKS/src/components/reports/ReportsView.tsx:
// everyone sees their own reports and the admins' ones (admins see all), with filters.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Alert, ScrollView, TextInput, Modal, Share } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { pickFileAsDataUrl, openDataUrl } from '../../lib/file';
import { summaryText } from '../../lib/meetingReport';
import { useAuth } from '../../context/AuthContext';
import { Report, ReportKind } from '../../types';
import { colors, spacing, radius } from '../../theme';
import MeetingRecorder from '../../components/MeetingRecorder';
import { Button, Chip, EmptyState, LoadingScreen } from '../../components/ui';

const KINDS: Record<ReportKind, string> = {
  journalier: 'Journalier', hebdomadaire: 'Hebdo', mensuel: 'Mensuel', mission: 'Mission', reunion: 'Réunion', autre: 'Autre',
};

const day = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function range(preset: string): { from?: string; to?: string } {
  const now = new Date();
  if (preset === 'today') return { from: day(now), to: day(now) };
  if (preset === 'week') {
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    return { from: day(monday), to: day(now) };
  }
  if (preset === 'month') return { from: day(new Date(now.getFullYear(), now.getMonth(), 1)), to: day(now) };
  return {};
}
const PERIODS = [['', 'Tout'], ['today', "Aujourd'hui"], ['week', 'Semaine'], ['month', 'Mois']];

function formatSize(bytes?: number | null) {
  if (!bytes) return '';
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} Ko` : `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export default function ReportsScreen() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [reports, setReports] = useState<Report[]>([]);
  const [authors, setAuthors] = useState<{ id: string; name: string }[]>([]);
  const [query, setQuery] = useState('');
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('');
  const [period, setPeriod] = useState('');
  const [author, setAuthor] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [summary, setSummary] = useState<{ title: string; text: string } | null>(null);
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setQ(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  const load = useCallback(() => {
    api.getReports({ q, kind, author, ...range(period), limit: 100 })
      .then(setReports).catch(() => {}).finally(() => setLoading(false));
  }, [q, kind, author, period]);
  useFocusEffect(load);
  useFocusEffect(useCallback(() => { api.getReportAuthors().then(setAuthors).catch(() => {}); }, []));

  const onUpload = async () => {
    try {
      const picked = await pickFileAsDataUrl();
      if (!picked) return;
      setUploading(true);
      await api.uploadReport({
        file_name: picked.name, file_data: picked.dataUrl, file_size: picked.size, file_type: picked.type,
        title: picked.name.replace(/\.[a-z0-9]{2,5}$/i, ''), kind: 'autre',
      });
      load();
    } catch (err: any) {
      Alert.alert("Échec de l'import", err.message || 'Réessaie.');
    } finally {
      setUploading(false);
    }
  };

  const onOpen = async (r: Report) => {
    try {
      const { file_name, file_data, content } = await api.getReportFile(r.id);
      if (file_data) await openDataUrl(file_data, file_name);
      else if (content) setSummary({ title: r.title, text: summaryText(content) });
    } catch (err: any) {
      Alert.alert('Ouverture impossible', err.message || 'Réessaie.');
    }
  };

  const onDelete = (r: Report) => {
    if (!isAdmin && r.author.id !== user?.id) return;
    Alert.alert('Supprimer le rapport', `Supprimer « ${r.title} » ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => api.deleteReport(r.id).catch(() => {}).finally(load) },
    ]);
  };

  if (loading && !reports.length && !q && !kind && !author && !period) return <LoadingScreen />;

  return (
    <View style={styles.container}>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1 }}><Button title="Enregistrer une réunion" variant="danger" onPress={() => setRecording(true)} fullWidth /></View>
        <View style={{ flex: 1 }}><Button title={uploading ? 'Import…' : 'Importer'} variant="secondary" onPress={onUpload} loading={uploading} fullWidth /></View>
      </View>
      <MeetingRecorder visible={recording} onClose={() => setRecording(false)} onSaved={() => { setRecording(false); load(); }} />
      <View style={styles.search}>
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Titre, fichier, contenu…"
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips} contentContainerStyle={styles.chipsRow}>
        {PERIODS.map(([k, l]) => <Chip key={k} label={l} active={period === k} onPress={() => setPeriod(k)} />)}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips} contentContainerStyle={styles.chipsRow}>
        <Chip label="Tous types" active={!kind} onPress={() => setKind('')} />
        {Object.entries(KINDS).map(([k, l]) => <Chip key={k} label={l} active={kind === k} onPress={() => setKind(kind === k ? '' : k)} />)}
      </ScrollView>
      {authors.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips} contentContainerStyle={styles.chipsRow}>
          <Chip label="Tous auteurs" active={!author} onPress={() => setAuthor('')} />
          {authors.map(a => <Chip key={a.id} label={a.name} active={author === a.id} onPress={() => setAuthor(author === a.id ? '' : a.id)} />)}
        </ScrollView>
      )}
      <FlatList
        data={reports}
        keyExtractor={r => r.id}
        contentContainerStyle={{ paddingVertical: spacing.sm, flexGrow: 1 }}
        ListEmptyComponent={<EmptyState title="Aucun rapport ne correspond." />}
        renderItem={({ item: r }) => (
          <Pressable style={styles.row} onPress={() => onOpen(r)} onLongPress={() => onDelete(r)}>
            <Ionicons name={r.kind === 'reunion' ? 'mic-outline' : 'document-text-outline'} size={20} color={r.kind === 'reunion' ? '#FB7185' : colors.primarySoft} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{r.title}{r.kind ? `  ·  ${KINDS[r.kind]}` : ''}</Text>
              <Text style={styles.meta}>
                {r.author.role === 'admin' ? '★ ' : ''}{r.author.name} · {new Date(r.created_at).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}
                {r.file_size ? ` · ${formatSize(r.file_size)}` : ''}
              </Text>
            </View>
            {(isAdmin || r.author.id === user?.id) && (
              <Pressable hitSlop={8} onPress={() => onDelete(r)}>
                <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
              </Pressable>
            )}
          </Pressable>
        )}
      />
      <Modal visible={!!summary} animationType="slide" onRequestClose={() => setSummary(null)}>
        <View style={[styles.container, { paddingTop: spacing.xl }]}>
          <View style={styles.modalHead}>
            <Text style={[styles.name, { flex: 1, fontSize: 16 }]}>{summary?.title}</Text>
            <Pressable hitSlop={8} onPress={() => summary && Share.share({ title: summary.title, message: `${summary.title}\n\n${summary.text}` })}>
              <Ionicons name="share-outline" size={22} color={colors.textPrimary} />
            </Pressable>
            <Pressable hitSlop={8} onPress={() => setSummary(null)}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </Pressable>
          </View>
          <ScrollView><Text style={styles.summary}>{summary?.text}</Text></ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, paddingHorizontal: spacing.md,
    backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md,
  },
  searchInput: { flex: 1, color: colors.textPrimary, paddingVertical: 10, fontSize: 14 },
  chips: { flexGrow: 0, marginTop: spacing.sm },
  chipsRow: { gap: spacing.xs },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, marginBottom: spacing.sm,
    backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md,
  },
  name: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  meta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  modalHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  summary: { color: colors.textSecondary, fontSize: 14, lineHeight: 21 },
});
