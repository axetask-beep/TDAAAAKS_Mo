import { useState } from 'react';
import { Alert } from 'react-native';
import { api } from './api';
import { Task, TaskStatus } from '../types';

// Long-press a task in a list → StatusSheet → optimistic status update.
export function useQuickStatus(setTasks: React.Dispatch<React.SetStateAction<Task[]>>) {
  const [statusTask, setStatusTask] = useState<Task | null>(null);

  const changeStatus = async (task: Task, status: TaskStatus) => {
    if (task.status === status) return;
    setTasks(prev => prev.map(t => (t.id === task.id ? { ...t, status } : t)));
    try {
      const updated = await api.updateTask(task.id, { status });
      setTasks(prev => prev.map(t => (t.id === task.id ? { ...t, ...updated } : t)));
    } catch (err: any) {
      setTasks(prev => prev.map(t => (t.id === task.id ? task : t)));
      Alert.alert('Erreur', err.message || 'Changement de statut impossible.');
    }
  };

  return { statusTask, openStatus: setStatusTask, closeStatus: () => setStatusTask(null), changeStatus };
}
