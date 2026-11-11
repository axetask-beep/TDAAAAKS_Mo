// Ports the AxeTask brand palette from the web app (index.html / Sidebar.tsx /
// ProjectView.tsx use these same hex values) to a shared RN theme object.
import { TaskPriority, TaskStatus } from '../types';

export const colors = {
  background: '#090D16',
  surface: '#0F172A',
  surfaceAlt: '#1E293B',
  border: '#1E293B',
  textPrimary: '#E2E8F0',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  primary: '#2563EB',
  primaryLight: '#3B82F6',
  primarySoft: '#60A5FA',
  accentPink: '#EC4899',
  success: '#34D399',
  warning: '#F59E0B',
  danger: '#F43F5E',
  indigo: '#818CF8',
  white: '#FFFFFF',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  full: 999,
};

export const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; border: string }> = {
  a_faire: { label: 'À faire', color: colors.textSecondary, border: colors.border },
  en_cours: { label: 'En cours', color: colors.primarySoft, border: colors.primary },
  en_revision: { label: 'En révision', color: colors.indigo, border: colors.indigo },
  termine: { label: 'Terminé', color: colors.success, border: colors.success },
  bloque: { label: 'Bloqué', color: colors.danger, border: colors.danger },
};

export const STATUS_ORDER: TaskStatus[] = ['a_faire', 'en_cours', 'en_revision', 'bloque', 'termine'];

export const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string }> = {
  basse: { label: 'Basse', color: colors.textMuted },
  normale: { label: 'Normale', color: colors.primarySoft },
  haute: { label: 'Haute', color: colors.warning },
  urgente: { label: 'Urgente', color: colors.danger },
};

export const PRIORITY_ORDER: TaskPriority[] = ['basse', 'normale', 'haute', 'urgente'];
