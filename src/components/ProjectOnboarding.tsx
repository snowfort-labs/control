import React, { useState, useEffect } from 'react';
import { EngineType, Session } from '../types/engine';
import { useAppStore } from '../store/appStore';
import geminiLogo from '../assets/gemini_logo.png';
import claudeLogo from '../assets/claude-logo.png';
import openaiLogo from '../assets/openai.png';

interface ProjectOnboardingProps {
  onProjectCreated: (projectId: string) => void;
  onCancel: () => void;
}

export const ProjectOnboarding: React.FC<ProjectOnboardingProps> = ({ 
  onProjectCreated, 
  onCancel 
}) => {
  const { addProject, setActiveSession } = useAppStore();
  const addSession = (session: Session) => {
    useAppStore.setState((state) => ({
      sessions: [...state.sessions, session]
    }));
  };
  const [step, setStep] = useState<'path' | 'creating'>('path');
  const [projectPath, setProjectPath] = useState('');
  const [projectName, setProjectName] = useState('');
  const [selectedEngine, setSelectedEngine] = useState<EngineType>('gemini');
  
  const getEngineCardStyle = (engineType: EngineType, isAvailable: boolean) => {
    const isSelected = selectedEngine === engineType;
    return {
      border: '1px solid #E5E5EA',
      borderRadius: '8px',
      padding: '16px',
      cursor: isAvailable ? 'pointer' : 'not-allowed',
      backgroundColor: isSelected ? '#007AFF1A' : 'transparent',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      transition: 'all 0.2s ease',
      opacity: !isAvailable ? 0.5 : 1,
      position: 'relative' as const,
      boxShadow: isSelected ? '0 0 0 2px #007AFF' : 'none'
    };
  };

  const handlePathSubmit = () => {
    if (projectPath && projectName) {
      handleCreateProject();
    }
  };

  const handleBrowseDirectory = async () => {
    try {
      const selectedPath = await window.snowfortAPI.selectDirectory();
      if (selectedPath) {
        setProjectPath(selectedPath);
        // Auto-fill project name if not set
        if (!projectName) {
          const folderName = selectedPath.split('/').pop() || selectedPath.split('\\').pop();
          if (folderName) {
            setProjectName(folderName);
          }
        }
      }
    } catch (error) {
      console.error('Failed to select directory:', error);
    }
  };

  const handleCreateProject = async () => {
    setStep('creating');
    
    try {
      // Create project
      const project = await window.snowfortAPI.createProject(
        projectName, 
        projectPath
      );

      // Create initial generic terminal session
      const session = await window.snowfortAPI.createSession(
        project.id,
        'Session 1'
      );

      // Add project to store
      addProject(project);

      // Add session to store
      addSession(session);

      // Set the new session as active so user can start using it
      setActiveSession(session.id);

      onProjectCreated(project.id);
    } catch (error) {
      console.error('Failed to create project:', error);
      // Handle error
    }
  };

  const getEngineDisplayName = (engineType: EngineType): string => {
    switch (engineType) {
      case 'gemini': return 'Gemini CLI';
      case 'claude': return 'Claude Code';
      case 'codex': return 'OpenAI Codex CLI';
    }
  };

  const getEngineStatus = (engineType: EngineType): string => {
    return 'Ready';
  };

  const isEngineAvailable = (engineType: EngineType): boolean => {
    return true; // All engines are available through PTY terminal
  };

  if (step === 'creating') {
    return (
      <div className="modal-overlay">
        <div className="modal-content">
          <div className="modal-header">
            <h2>Creating Project</h2>
          </div>
          <div className="modal-body">
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚀</div>
              <div style={{ fontSize: '18px', marginBottom: '8px' }}>Setting up your project...</div>
              <div style={{ color: 'var(--text-muted)' }}>
                Creating project, initializing {getEngineDisplayName(selectedEngine)}, and preparing your workspace.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Engine selection step removed - no longer needed for generic terminal sessions

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Add New Project</h2>
          <p>Set up a new project to work with AI engines</p>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label>Project Name</label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="My Awesome Project"
                style={{ width: '100%', padding: '8px', marginTop: '4px' }}
              />
            </div>
            
            <div>
              <label>Project Path</label>
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <input
                  type="text"
                  value={projectPath}
                  onChange={(e) => setProjectPath(e.target.value)}
                  placeholder="/path/to/your/project"
                  style={{ flex: 1, padding: '8px' }}
                />
                <button
                  type="button"
                  onClick={handleBrowseDirectory}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: 'var(--primary-color)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 500,
                    whiteSpace: 'nowrap'
                  }}
                >
                  Browse
                </button>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Path to your project directory (e.g., ~/code/my-app)
              </div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onCancel} className="btn-secondary">Cancel</button>
          <button 
            onClick={handlePathSubmit} 
            className="btn-primary"
            disabled={!projectPath || !projectName}
          >
Create Project
          </button>
        </div>
      </div>
    </div>
  );
};