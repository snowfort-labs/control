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
  setIntelligencePanelCollapsed: (collapsed: boolean) => void;
  setShowOnboarding: (show: boolean) => void;
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
        sessions: [...state.sessions, session]
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
  
  setIntelligencePanelCollapsed: (collapsed) => set({ intelligencePanelCollapsed: collapsed }),
  setShowOnboarding: (show) => set({ showOnboarding: show }),
}));