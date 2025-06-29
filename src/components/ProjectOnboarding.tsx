import React, { useState, useEffect } from 'react';
import { EngineAvailability, EngineType } from '../types/engine';
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
  const addSession = (session: any) => {
    useAppStore.setState((state) => ({
      sessions: [...state.sessions, session]
    }));
  };
  const [step, setStep] = useState<'path' | 'engine' | 'creating'>('path');
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
  const [engineAvailability, setEngineAvailability] = useState<EngineAvailability | null>(null);

  useEffect(() => {
    // Detect available engines
    if (window.snowfortAPI && window.snowfortAPI.detectAvailableEngines) {
      window.snowfortAPI.detectAvailableEngines().then(setEngineAvailability);
    }
  }, []);

  const handlePathSubmit = () => {
    if (projectPath && projectName) {
      setStep('engine');
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

  const handleEngineSelect = async () => {
    setStep('creating');
    
    try {
      // Create project
      const project = await window.snowfortAPI.createProject(
        projectName, 
        projectPath
      );

      // Create initial session
      const session = await window.snowfortAPI.createSession(
        project.id,
        `${getEngineDisplayName(selectedEngine)} Session`,
        selectedEngine
      );

      // Add project to store
      addProject(project);

      // Add session to store
      addSession(session);
      
      // Start engine session
      await window.snowfortAPI.createEngineSession(
        session.id,
        selectedEngine,
        projectPath
      );

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
    if (!engineAvailability) return 'Checking...';
    
    const status = engineAvailability[engineType];
    switch (status) {
      case 'available': return 'Installed';
      case 'not-installed': return 'Not Installed';
      case 'auth-required': return 'Auth Required';
      case 'subscription-required': return 'Subscription Required';
      case 'credits-required': return 'Credits Required';
      default: return 'Unknown';
    }
  };

  const isEngineAvailable = (engineType: EngineType): boolean => {
    return engineAvailability?.[engineType] === 'available';
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

  if (step === 'engine') {
    return (
      <div className="modal-overlay">
        <div className="modal-content">
          <div className="modal-header">
            <h2>Select Default AI Engine</h2>
            <p>Choose which AI engine to use for this project (can be changed later)</p>
          </div>
          <div className="modal-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div 
                onClick={() => isEngineAvailable('gemini') && setSelectedEngine('gemini')}
                style={getEngineCardStyle('gemini', isEngineAvailable('gemini'))}
                onMouseEnter={(e) => {
                  if (isEngineAvailable('gemini') && selectedEngine !== 'gemini') {
                    e.currentTarget.style.boxShadow = '0 0 0 1px #007AFF';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedEngine !== 'gemini') {
                    e.currentTarget.style.boxShadow = 'none';
                  } else {
                    e.currentTarget.style.boxShadow = '0 0 0 2px #007AFF';
                  }
                }}
              >
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '8px',
                  backgroundColor: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px'
                }}>
                  <img 
                    src={geminiLogo}
                    alt="Gemini"
                    width="40"
                    height="40"
                    style={{ borderRadius: '4px', objectFit: 'contain' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', fontSize: '16px', marginBottom: '4px' }}>Gemini CLI</div>
                  <div style={{ display: 'flex', gap: '12px', fontSize: '12px' }}>
                    <span style={{ color: 'var(--accent-color)', fontWeight: '500' }}>Free + Pro tiers</span>
                    <span style={{ color: 'var(--text-muted)' }}>MCP Support</span>
                  </div>
                </div>
                <div style={{ fontSize: '14px', fontWeight: '500' }}>{getEngineStatus('gemini')}</div>
              </div>

              <div 
                onClick={() => isEngineAvailable('claude') && setSelectedEngine('claude')}
                style={getEngineCardStyle('claude', isEngineAvailable('claude'))}
                onMouseEnter={(e) => {
                  if (isEngineAvailable('claude') && selectedEngine !== 'claude') {
                    e.currentTarget.style.boxShadow = '0 0 0 1px #007AFF';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedEngine !== 'claude') {
                    e.currentTarget.style.boxShadow = 'none';
                  } else {
                    e.currentTarget.style.boxShadow = '0 0 0 2px #007AFF';
                  }
                }}
              >
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '8px',
                  backgroundColor: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px'
                }}>
                  <img 
                    src={claudeLogo}
                    alt="Claude"
                    width="40"
                    height="40"
                    style={{ borderRadius: '4px', objectFit: 'contain' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', fontSize: '16px', marginBottom: '4px' }}>Claude Code</div>
                  <div style={{ display: 'flex', gap: '12px', fontSize: '12px' }}>
                    <span style={{ color: 'var(--accent-color)', fontWeight: '500' }}>Subscription ($20+/month)</span>
                    <span style={{ color: 'var(--text-muted)' }}>MCP Support</span>
                  </div>
                </div>
                <div style={{ fontSize: '14px', fontWeight: '500' }}>{getEngineStatus('claude')}</div>
              </div>

              <div 
                onClick={() => isEngineAvailable('codex') && setSelectedEngine('codex')}
                style={getEngineCardStyle('codex', isEngineAvailable('codex'))}
                onMouseEnter={(e) => {
                  if (isEngineAvailable('codex') && selectedEngine !== 'codex') {
                    e.currentTarget.style.boxShadow = '0 0 0 1px #007AFF';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedEngine !== 'codex') {
                    e.currentTarget.style.boxShadow = 'none';
                  } else {
                    e.currentTarget.style.boxShadow = '0 0 0 2px #007AFF';
                  }
                }}
              >
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '8px',
                  backgroundColor: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px'
                }}>
                  <img 
                    src={openaiLogo}
                    alt="OpenAI"
                    width="40"
                    height="40"
                    style={{ borderRadius: '4px', objectFit: 'contain' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', fontSize: '16px', marginBottom: '4px' }}>OpenAI Codex CLI</div>
                  <div style={{ display: 'flex', gap: '12px', fontSize: '12px' }}>
                    <span style={{ color: 'var(--accent-color)', fontWeight: '500' }}>Pay-as-you-go (API Credits)</span>
                  </div>
                </div>
                <div style={{ fontSize: '14px', fontWeight: '500' }}>{getEngineStatus('codex')}</div>
              </div>
            </div>

            {!engineAvailability && (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                Detecting available engines...
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button onClick={onCancel} className="btn-secondary">Cancel</button>
            <button 
              onClick={handleEngineSelect} 
              className="btn-primary"
              disabled={!isEngineAvailable(selectedEngine)}
            >
              Create Project with {getEngineDisplayName(selectedEngine)}
            </button>
          </div>
        </div>
      </div>
    );
  }

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
Next: Choose Engine
          </button>
        </div>
      </div>
    </div>
  );
};