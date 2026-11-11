// Adapted from AXETASKS/src/context/WorkspaceContext.tsx. Keeps the same
// "current workspace / current project" selection model. The personal
// work-session stopwatch (activeTimer/startTimer/pauseTimer/resumeTimer/
// stopAndLogTimer/discardTimer) that used to live here has been deleted
// app-wide — a task's chrono is now fully automatic, derived from its
// start_at/end_at/completed_at (see lib/chrono.ts), with no manual controls.
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Workspace, Project } from '../types';
import { api } from '../lib/api';
import { useAuth } from './AuthContext';

interface WorkspaceContextType {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  currentProject: Project | null;
  loading: boolean;
  setCurrentWorkspaceId: (id: string | null) => void;
  setCurrentProjectId: (id: string | null) => Promise<void>;
  refreshWorkspaces: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshWorkspaces = useCallback(async () => {
    if (!user) {
      setWorkspaces([]);
      setCurrentWorkspace(null);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const wsList = await api.getWorkspaces();
      setWorkspaces(wsList);
      setCurrentWorkspace(prev => {
        if (prev) {
          const found = wsList.find(w => w.id === prev.id);
          if (found) return found;
        }
        return wsList.length > 0 ? wsList[0] : null;
      });
    } catch (err) {
      console.error('Error loading workspaces:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refreshWorkspaces();
  }, [refreshWorkspaces]);

  const setCurrentWorkspaceId = (id: string | null) => {
    if (!id) {
      setCurrentWorkspace(null);
      setCurrentProject(null);
      return;
    }
    const found = workspaces.find(w => w.id === id);
    if (found) {
      setCurrentWorkspace(found);
      setCurrentProject(null);
    }
  };

  const setCurrentProjectId = async (id: string | null) => {
    if (!id) {
      setCurrentProject(null);
      return;
    }
    try {
      const prj = await api.getProject(id);
      setCurrentProject(prj);
      if (prj.workspace) setCurrentWorkspace(prj.workspace);
    } catch (err) {
      console.error('Error setting project:', err);
    }
  };

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        currentWorkspace,
        currentProject,
        loading,
        setCurrentWorkspaceId,
        setCurrentProjectId,
        refreshWorkspaces,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};
