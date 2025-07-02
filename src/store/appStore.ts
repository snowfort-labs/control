import { create } from 'zustand';
import { Project, Session, Organization, EngineType } from '../types/engine';

// Re-export for compatibility
export type { Project, Session, Organization };

interface AppStore {
  // Projects
  projects: Project[];
  organizations: Organization[];
  activeProject: Project | null;
  
  // Sessions  
  sessions: Session[];
  activeSession: Session | null;
  
  // UI State
  intelligencePanelCollapsed: boolean;
  showOnboarding: boolean;
  
  // Actions
  loadData: () => Promise<void>;
  addProject: (project: Project) => void;
  createSession: (projectId: string, engineType: EngineType) => void;
  setActiveSession: (sessionId: string) => void;
  setActiveProject: (projectId: string) => void;
  setIntelligencePanelCollapsed: (collapsed: boolean) => void;
  setShowOnboarding: (show: boolean) => void;
  updateSession: (session: Session) => void;
}

export const useAppStore = create<AppStore>((set, get) => ({
  // Initial state - empty until loaded from database
  projects: [],
  organizations: [],
  activeProject: null,
  
  sessions: [],
  activeSession: null,
  
  intelligencePanelCollapsed: false,
  showOnboarding: false,
  
  // Actions
  loadData: async () => {
    try {
      const [projects, organizations, sessions] = await Promise.all([
        window.snowfortAPI.getProjects(),
        window.snowfortAPI.getOrganizations(),
        window.snowfortAPI.getSessions()
      ]);
      
      set({ projects, organizations, sessions });
      
      // If no projects exist, show onboarding
      if (projects.length === 0) {
        set({ showOnboarding: true });
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  },

  addProject: (project) => set((state) => ({
    projects: [...state.projects, project],
    showOnboarding: false // Hide onboarding after adding project
  })),
  
  createSession: async (projectId, engineType) => {
    try {
      const session = await window.snowfortAPI.createSession(
        projectId, 
        `${engineType} Session`, 
        engineType
      );
      
      set((state) => ({
        sessions: [...state.sessions, session],
        activeSession: session, // Set the new session as active
      }));
      
      return session;
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  },
  
  setActiveSession: (sessionId) => {
    const session = get().sessions.find(s => s.id === sessionId);
    const project = session ? get().projects.find(p => p.id === session.projectId) : null;
    set({ activeSession: session || null, activeProject: project || null });
  },
  
  setActiveProject: (projectId) => {
    const project = get().projects.find(p => p.id === projectId);
    set({ activeProject: project || null, activeSession: null });
  },
  
  setIntelligencePanelCollapsed: (collapsed) => set({ intelligencePanelCollapsed: collapsed }),
  setShowOnboarding: (show) => set({ showOnboarding: show }),

  updateSession: (session) => set((state) => {
    const sessions = state.sessions.map(s => s.id === session.id ? session : s);
    const activeSession = state.activeSession?.id === session.id ? session : state.activeSession;
    return { sessions, activeSession };
  }),
}));

// Listen for session updates from the main process
if (window.snowfortAPI) {
  window.snowfortAPI.onSessionUpdate((session: Session) => {
    useAppStore.getState().updateSession(session);
  });
}