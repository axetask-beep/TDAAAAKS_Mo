// Mobile version of AXETASKS/src/components/reports/MeetingRecorder.tsx.
// Records in AAC/ADTS; every 75 s the new complete frames of the file being
// written are sent for transcription (one piece per request, Vercel caps at
// 4.5 Mo), then the transcript is summarised in the AXE DIGITAL template.
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { File } from 'expo-file-system';
import {
  useAudioRecorder, useAudioRecorderState, requestRecordingPermissionsAsync, setAudioModeAsync, IOSOutputFormat, AudioQuality,
} from 'expo-audio';
import { api } from '../lib/api';
import { completeFramesLength, toBase64 } from '../lib/adts';
import { MeetingContent, MeetingSummary, summaryText } from '../lib/meetingReport';
import { colors, spacing, radius } from '../theme';
import { Button } from './ui';

const SEGMENT_MS = 75_000;

const OPTIONS = {
  extension: '.aac',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 32000,
  isMeteringEnabled: true,
  android: { outputFormat: 'aac_adts' as const, audioEncoder: 'aac' as const, audioSource: 'voice_recognition' as const },
  ios: { outputFormat: IOSOutputFormat.MPEG4AAC, audioQuality: AudioQuality.MEDIUM },
  web: {},
};

type Segment = { audio: string; text?: string; status: 'pending' | 'done' | 'failed' };
type Phase = 'starting' | 'recording' | 'finishing' | 'review' | 'error';

const fmt = (s: number) => `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export default function MeetingRecorder({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved: () => void }) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={() => {}} statusBarTranslucent>
      {visible && <Recorder onClose={onClose} onSaved={onSaved} />}
    </Modal>
  );
}

function Recorder({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const recorder = useAudioRecorder(OPTIONS);
  const state = useAudioRecorderState(recorder, 250);
  const [phase, setPhase] = useState<Phase>('starting');
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [summary, setSummary] = useState<MeetingSummary | null>(null);
  const [title, setTitle] = useState(`Réunion du ${new Date().toLocaleDateString('fr-FR')}`);
  const [saving, setSaving] = useState(false);
  const sent = useRef(0); // bytes of the file already cut into segments
  const segments = useRef<Segment[]>([]);
  const queue = useRef(Promise.resolve());
  const duration = useRef(0);
  duration.current = Math.max(duration.current, state.durationMillis / 1000);

  // Transcribe pieces one after the other (free AI tier = few requests per minute).
  const transcribe = (seg: Segment) => {
    queue.current = queue.current.then(async () => {
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          seg.text = (await api.transcribeMeeting(seg.audio)).text;
          seg.status = 'done';
          return;
        } catch (err: any) {
          if (/GEMINI_API_KEY/.test(err.message)) { seg.status = 'failed'; setError(err.message); return; }
          await new Promise(r => setTimeout(r, 5000 * (attempt + 1)));
        }
      }
      seg.status = 'failed';
    });
  };

  const cut = () => {
    if (!recorder.uri) return;
    const file = new File(recorder.uri);
    const h = file.open();
    try {
      const size = h.size ?? 0;
      if (size <= sent.current) return;
      h.offset = sent.current;
      const bytes = h.readBytes(size - sent.current);
      const len = completeFramesLength(bytes);
      if (!len) return;
      sent.current += len;
      const seg: Segment = { audio: `data:audio/aac;base64,${toBase64(bytes.subarray(0, len))}`, status: 'pending' };
      segments.current.push(seg);
      transcribe(seg);
    } finally {
      h.close();
    }
  };

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    (async () => {
      try {
        const perm = await requestRecordingPermissionsAsync();
        if (!perm.granted) throw new Error("Le micro est refusé. Autorise-le dans les réglages du téléphone (Applications → AxeTask → Autorisations).");
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, allowsBackgroundRecording: true });
        await recorder.prepareToRecordAsync();
        if (cancelled) return;
        recorder.record();
        setPhase('recording');
        timer = setInterval(() => { try { cut(); } catch (e) { console.warn('[meeting] cut failed', e); } }, SEGMENT_MS);
      } catch (err: any) {
        setError(err.message || "Impossible de démarrer l'enregistrement.");
        setPhase('error');
      }
    })();
    return () => {
      cancelled = true;
      clearInterval(timer);
      recorder.stop().catch(() => {});
      setAudioModeAsync({ allowsRecording: false, allowsBackgroundRecording: false }).catch(() => {});
    };
  }, []);

  const togglePause = () => {
    if (paused) recorder.record(); else recorder.pause();
    setPaused(!paused);
  };

  const finish = async () => {
    setPhase('finishing');
    setProgress('Transcription de la réunion…');
    try {
      if (recorder.isRecording || paused) await recorder.stop();
      cut();
    } catch (e) {
      console.warn('[meeting] stop failed', e);
    }
    await queue.current;
    const failed = segments.current.filter(s => s.status === 'failed').length;
    if (failed) {
      setError(prev => prev || `${failed} morceau(x) de l'audio n'ont pas pu être transcrits (réseau ou limite de l'IA).`);
      return setPhase('error');
    }
    const transcript = segments.current.map(s => s.text).filter(Boolean).join('\n');
    try {
      setProgress('Rédaction du compte rendu…');
      const { summary } = await api.summarizeMeeting(transcript);
      setSummary(summary);
      if (typeof summary.intitule === 'string' && summary.intitule.trim()) setTitle(summary.intitule.trim());
      setPhase('review');
    } catch (err: any) {
      setError(err.message);
      setPhase('error');
    }
  };

  const retry = () => {
    setError('');
    segments.current.filter(s => s.status === 'failed').forEach(s => { s.status = 'pending'; transcribe(s); });
    finish();
  };

  const cancel = () => {
    if (phase === 'error' || phase === 'starting') return onClose();
    Alert.alert("Abandonner l'enregistrement ?", "L'audio et le compte rendu seront perdus.", [
      { text: 'Continuer', style: 'cancel' },
      { text: 'Abandonner', style: 'destructive', onPress: onClose },
    ]);
  };

  const save = async () => {
    if (!summary) return;
    setSaving(true);
    try {
      const content: MeetingContent = {
        summary,
        transcript: segments.current.map(s => s.text).filter(Boolean).join('\n'),
        duration_s: Math.round(duration.current),
        recorded_at: new Date().toISOString(),
      };
      await api.uploadReport({ file_name: `${title}.html`, title, kind: 'reunion', content });
      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (phase === 'review' && summary) {
    return (
      <View style={[styles.review]}>
        <Text style={styles.h}>Compte rendu — à relire</Text>
        <TextInput value={title} onChangeText={setTitle} style={styles.input} placeholder="Titre du rapport" placeholderTextColor={colors.textMuted} />
        <Text style={styles.meta}>Durée {fmt(duration.current)}. Pour corriger le texte, ouvre le rapport sur la version web après publication.</Text>
        {!!error && <Text style={styles.err}>{error}</Text>}
        <ScrollView style={{ flex: 1, marginVertical: spacing.md }}>
          <Text style={styles.summary}>{summaryText({ summary, transcript: '', duration_s: 0, recorded_at: '' })}</Text>
        </ScrollView>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1 }}><Button title="Abandonner" variant="secondary" onPress={cancel} fullWidth /></View>
          <View style={{ flex: 1 }}><Button title="Publier" onPress={save} loading={saving} disabled={!title.trim()} fullWidth /></View>
        </View>
      </View>
    );
  }

  // metering: dBFS, about -60 (silence) to 0 (loud).
  const level = phase === 'recording' && !paused ? Math.max(0, Math.min(1, ((state.metering ?? -60) + 60) / 50)) : 0;

  return (
    <View style={styles.rec}>
      <View style={styles.status} accessibilityLiveRegion="polite">
        {phase === 'recording' && <View style={[styles.dot, { backgroundColor: paused ? '#FBBF24' : '#F43F5E' }]} />}
        {(phase === 'finishing' || phase === 'starting') && <ActivityIndicator size="small" color="#fff" />}
        <Text style={styles.statusText}>
          {phase === 'recording' ? (paused ? 'En pause' : 'Enregistrement en cours') : phase === 'finishing' ? progress : phase === 'starting' ? 'Démarrage…' : 'Problème'}
        </Text>
      </View>

      <View style={{ alignItems: 'center', gap: spacing.xl }}>
        <View style={[styles.halo, { transform: [{ scale: 1 + level * 0.6 }], opacity: 0.25 + level * 0.5 }]} />
        <View style={[styles.mic, (paused || phase !== 'recording') && { opacity: 0.6 }]}>
          {phase === 'finishing' ? <ActivityIndicator size="large" color="#fff" /> : <Ionicons name="mic" size={56} color="#fff" />}
        </View>
        <Text style={styles.time}>{fmt(duration.current)}</Text>
        {phase === 'recording' && <Text style={styles.hint}>Parle normalement, tu peux verrouiller le téléphone. Le compte rendu est rédigé à la fin, selon le modèle AXE DIGITAL.</Text>}
        {phase === 'error' && <Text style={[styles.hint, { color: '#FECDD3' }]}>{error}</Text>}
      </View>

      {phase === 'recording' ? (
        <View style={styles.controls}>
          <Pressable onPress={cancel} style={styles.small} accessibilityLabel="Annuler l'enregistrement"><Ionicons name="close" size={26} color="#fff" /></Pressable>
          <Pressable onPress={finish} style={styles.stop} accessibilityLabel="Arrêter et rédiger le compte rendu"><Ionicons name="square" size={30} color="#E11D48" /></Pressable>
          <Pressable onPress={togglePause} style={styles.small} accessibilityLabel={paused ? 'Reprendre' : 'Mettre en pause'}><Ionicons name={paused ? 'play' : 'pause'} size={26} color="#fff" /></Pressable>
        </View>
      ) : phase === 'error' ? (
        <View style={{ gap: spacing.sm, alignSelf: 'stretch' }}>
          {segments.current.some(s => s.status === 'failed') && <Button title="Réessayer" onPress={retry} fullWidth />}
          <Button title="Fermer" variant="secondary" onPress={onClose} fullWidth />
        </View>
      ) : <View style={{ height: 80 }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  rec: { flex: 1, backgroundColor: '#05070D', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 64, paddingHorizontal: spacing.lg },
  status: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)' },
  statusText: { color: '#fff', fontSize: 12, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  halo: { position: 'absolute', top: -40, width: 220, height: 220, borderRadius: 110, backgroundColor: '#F43F5E' },
  mic: { width: 140, height: 140, borderRadius: 70, backgroundColor: '#E11D48', alignItems: 'center', justifyContent: 'center' },
  time: { color: '#fff', fontSize: 48, fontWeight: '700', fontVariant: ['tabular-nums'] },
  hint: { color: 'rgba(226,232,240,0.8)', fontSize: 12, textAlign: 'center', maxWidth: 300 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 28 },
  small: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  stop: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  review: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, paddingTop: 56 },
  h: { color: colors.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: spacing.md },
  input: { color: colors.textPrimary, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10 },
  meta: { color: colors.textMuted, fontSize: 11, marginTop: spacing.sm },
  err: { color: colors.danger, fontSize: 12, marginTop: spacing.sm },
  summary: { color: colors.textSecondary, fontSize: 14, lineHeight: 21 },
});
