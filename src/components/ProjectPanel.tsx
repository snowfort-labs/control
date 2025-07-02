import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import geminiLogo from '../assets/gemini_logo.png';
import claudeLogo from '../assets/claude-logo.png';
import openaiLogo from '../assets/openai.png';

interface ProjectPanelProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export const ProjectPanel: React.FC<ProjectPanelProps> = ({ collapsed, onToggleCollapse }) => {
  const { projects, sessions, organizations, activeSession, setActiveSession, setActiveProject, setShowOnboarding, loadData } = useAppStore();
  const [editingSession, setEditingSession] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState<string | null>(null);
  const [sessionName, setSessionName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [openMenuProject, setOpenMenuProject] = useState<string | null>(null);
  const [openMenuSession, setOpenMenuSession] = useState<string | null>(null);
  const [sessionCommand, setSessionCommand] = useState('');
  const [isCommandMode, setIsCommandMode] = useState<string | null>(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setOpenMenuProject(null);
      setOpenMenuSession(null);
      setIsCommandMode(null);
      setSessionCommand('');
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const getSessionsForProject = (projectId: string) => {
    return sessions.filter(s => s.projectId === projectId);
  };

  const getProjectsForOrg = (orgId?: string) => {
    return projects.filter(p => p.orgId === orgId);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready': return <div className="status-indicator ready"></div>;
      case 'working': return <div className="status-indicator working"></div>;
      case 'error': return <div className="status-indicator error"></div>;
      default: return <div className="status-indicator idle"></div>;
    }
  };

  const getEngineIcon = (engineType?: string, activeEngine?: string) => {
    // Show the active engine icon if something is running, otherwise show configured engine type
    const engine = activeEngine || engineType;
    if (!engine) return null; // No icon for generic terminal sessions
    
    // Use different icons based on whether engine is actively running or just configured
    const isActive = activeEngine !== undefined;
    const iconClass = `engine-label ${engine} ${isActive ? 'active' : 'configured'}`;
    
    switch (engine) {
      case 'claude':
      case 'claude-code': 
        return (
          <span className={iconClass} title={isActive ? 'Claude Code (Active)' : 'Claude Code (Configured)'}>
            <img src={claudeLogo} alt="Claude" style={{ width: '16px', height: '16px' }} />
          </span>
        );
      case 'codex': 
        return (
          <span className={iconClass} title={isActive ? 'OpenAI Codex (Active)' : 'OpenAI Codex (Configured)'}>
            <img src={openaiLogo} alt="OpenAI" style={{ width: '16px', height: '16px' }} />
          </span>
        );
      case 'gemini': 
        return (
          <span className={iconClass} title={isActive ? 'Gemini CLI (Active)' : 'Gemini CLI (Configured)'}>
            <img src={geminiLogo} alt="Gemini" style={{ width: '16px', height: '16px' }} />
          </span>
        );
      default: return null;
    }
  };

  const handleRenameProject = async (projectId: string, newName: string) => {
    try {
      await window.snowfortAPI.updateProject(projectId, { name: newName });
      await loadData(); // Refresh data from database
    } catch (error) {
      console.error('Failed to rename project:', error);
    }
  };

  const handleRenameSession = async (sessionId: string, newName: string) => {
    try {
      await window.snowfortAPI.updateSession(sessionId, { name: newName });
      await loadData(); // Refresh data from database
    } catch (error) {
      console.error('Failed to rename session:', error);
    }
  };

  const handleCreateSession = async (projectId: string, command?: string) => {
    try {
      // Get existing sessions for this project to generate the next session number
      const projectSessions = getSessionsForProject(projectId);
      const sessionNumber = projectSessions.length + 1;
      const sessionName = command ? `Session ${sessionNumber} - ${command.split(' ')[0]}` : `Session ${sessionNumber}`;
      
      // Create session with generic name and no specific engine type
      const session = await window.snowfortAPI.createSession(projectId, sessionName, undefined, command);
      await loadData(); // Refresh data from database
      setIsCommandMode(null);
      setSessionCommand('');
      
      // Set the new session as active
      setActiveSession(session.id);
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await window.snowfortAPI.deleteSession(sessionId);
      await loadData(); // Refresh data from database
      
      // If we deleted the active session, clear it
      if (activeSession?.id === sessionId) {
        setActiveSession(''); // Clear active session
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  const DotMenu: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onRename: () => void;
    onDelete?: () => void;
    type: 'project' | 'session';
  }> = ({ isOpen, onClose, onRename, onDelete, type }) => {
    if (!isOpen) return null;
    
    return (
      <div className="dot-menu" onClick={(e) => e.stopPropagation()}>
        <button 
          className="dot-menu-item" 
          onClick={() => {
            onRename();
            onClose();
          }}
        >
          Rename {type}
        </button>
        {onDelete && (
          <button 
            className="dot-menu-item delete-item" 
            onClick={() => {
              onDelete();
              onClose();
            }}
          >
            Delete {type}
          </button>
        )}
      </div>
    );
  };


  if (collapsed) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div className="panel-header" style={{ justifyContent: 'center' }}>
          <button onClick={onToggleCollapse} className="toggle-btn">›</button>
        </div>
        <div className="panel-content">
          {sessions.map(session => (
            <button
              key={session.id}
              onClick={() => setActiveSession(session.id)}
              className={`session-item ${activeSession?.id === session.id ? 'active' : ''}`}
              style={{ marginLeft: 0, justifyContent: 'center' }}
            >
              {getStatusIcon(session.status)}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="panel-header">
        <span>Projects & Sessions</span>
        <button onClick={onToggleCollapse}>←</button>
      </div>
      
      <div className="panel-content">
        <div className="project-list">
          {/* Organized Projects */}
          {organizations.map(org => {
            const orgProjects = getProjectsForOrg(org.id);
            if (orgProjects.length === 0) return null;
            
            return (
              <div key={org.id} className="project-group">
                <div className="project-group-title">
                  <span className="folder-icon">›</span>
                  <span>{org.name}</span>
                </div>
                {orgProjects.map(project => (
                  <div key={project.id}>
                    <div 
                      className={`project-item ${editingProject === project.id ? 'editing' : ''}`}
                      onClick={() => setActiveProject(project.id)}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setEditingProject(project.id);
                        setProjectName(project.name);
                      }}
                    >
                      <span className="project-icon">●</span>
                      {editingProject === project.id ? (
                        <input
                          className="editable-name"
                          value={projectName}
                          onChange={(e) => setProjectName(e.target.value)}
                          onBlur={() => {
                            handleRenameProject(project.id, projectName);
                            setEditingProject(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleRenameProject(project.id, projectName);
                              setEditingProject(null);
                            } else if (e.key === 'Escape') {
                              setEditingProject(null);
                            }
                          }}
                          autoFocus
                        />
                      ) : (
                        <span style={{ fontWeight: 500 }}>{project.name}</span>
                      )}
                      {project.currentBranch && (
                        <span className="branch-badge">{project.currentBranch}</span>
                      )}
                      <div className="project-actions">
                        <button 
                          className="dot-menu-trigger"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuProject(openMenuProject === project.id ? null : project.id);
                          }}
                        >
                          ⋯
                        </button>
                        <DotMenu
                          isOpen={openMenuProject === project.id}
                          onClose={() => setOpenMenuProject(null)}
                          onRename={() => {
                            setEditingProject(project.id);
                            setProjectName(project.name);
                          }}
                          type="project"
                        />
                      </div>
                    </div>
                    {getSessionsForProject(project.id).map(session => (
                      <div key={session.id} className={`session-item-container ${activeSession?.id === session.id ? 'active' : ''}`}>
                        <button
                          onClick={() => setActiveSession(session.id)}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            setEditingSession(session.id);
                            setSessionName(session.name);
                          }}
                          className={`session-item ${activeSession?.id === session.id ? 'active' : ''}`}
                        >
                          {getStatusIcon(session.status)}
                          {getEngineIcon(session.engineType, session.activeEngine)}
                          {editingSession === session.id ? (
                            <input
                              className="editable-name"
                              value={sessionName}
                              onChange={(e) => setSessionName(e.target.value)}
                              onBlur={() => {
                                handleRenameSession(session.id, sessionName);
                                setEditingSession(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleRenameSession(session.id, sessionName);
                                  setEditingSession(null);
                                } else if (e.key === 'Escape') {
                                  setEditingSession(null);
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                              autoFocus
                            />
                          ) : (
                            <span>{session.name}</span>
                          )}
                        </button>
                        <button 
                          className="dot-menu-trigger session-menu"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuSession(openMenuSession === session.id ? null : session.id);
                          }}
                        >
                          ⋯
                        </button>
                        <DotMenu
                          isOpen={openMenuSession === session.id}
                          onClose={() => setOpenMenuSession(null)}
                          onRename={() => {
                            setEditingSession(session.id);
                            setSessionName(session.name);
                          }}
                          onDelete={() => handleDeleteSession(session.id)}
                          type="session"
                        />
                      </div>
                    ))}
                    
                    {/* Add Session Button */}
                    <div className="add-session-container">
                      {isCommandMode === project.id ? (
                        <div className="add-session-input-container" onClick={(e) => e.stopPropagation()}>
                          <input
                            className="add-session-input"
                            value={sessionCommand}
                            onChange={(e) => setSessionCommand(e.target.value)}
                            placeholder="Enter command (optional)"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleCreateSession(project.id, sessionCommand.trim() || undefined);
                              } else if (e.key === 'Escape') {
                                setIsCommandMode(null);
                                setSessionCommand('');
                              }
                            }}
                            autoFocus
                          />
                          <button 
                            className="add-session-confirm-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCreateSession(project.id, sessionCommand.trim() || undefined);
                            }}
                          >
                            <span className="add-session-icon">+</span>
                          </button>
                        </div>
                      ) : (
                        <button 
                          className="add-session-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsCommandMode(project.id);
                          }}
                        >
                          <span className="add-session-icon">+</span>
                          <span>Add Session</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
          
          {/* Standalone Projects */}
          {getProjectsForOrg(undefined).map(project => (
            <div key={project.id}>
              <div 
                className={`project-item ${editingProject === project.id ? 'editing' : ''}`}
                onClick={() => setActiveProject(project.id)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setEditingProject(project.id);
                  setProjectName(project.name);
                }}
              >
                <span className="project-icon">●</span>
                {editingProject === project.id ? (
                  <input
                    className="editable-name"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    onBlur={() => {
                      handleRenameProject(project.id, projectName);
                      setEditingProject(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleRenameProject(project.id, projectName);
                        setEditingProject(null);
                      } else if (e.key === 'Escape') {
                        setEditingProject(null);
                      }
                    }}
                    autoFocus
                  />
                ) : (
                  <span style={{ fontWeight: 500 }}>{project.name}</span>
                )}
                {project.currentBranch && (
                  <span className="branch-badge">{project.currentBranch}</span>
                )}
                <div className="project-actions">
                  <button 
                    className="dot-menu-trigger"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuProject(openMenuProject === project.id ? null : project.id);
                    }}
                  >
                    ⋯
                  </button>
                  <DotMenu
                    isOpen={openMenuProject === project.id}
                    onClose={() => setOpenMenuProject(null)}
                    onRename={() => {
                      setEditingProject(project.id);
                      setProjectName(project.name);
                    }}
                    type="project"
                  />
                </div>
              </div>
              {getSessionsForProject(project.id).map(session => (
                <div key={session.id} className={`session-item-container ${activeSession?.id === session.id ? 'active' : ''}`}>
                  <button
                    onClick={() => setActiveSession(session.id)}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setEditingSession(session.id);
                      setSessionName(session.name);
                    }}
                    className={`session-item ${activeSession?.id === session.id ? 'active' : ''}`}
                  >
                    {getStatusIcon(session.status)}
                    {getEngineIcon(session.engineType, session.activeEngine)}
                    {editingSession === session.id ? (
                      <input
                        className="editable-name"
                        value={sessionName}
                        onChange={(e) => setSessionName(e.target.value)}
                        onBlur={() => {
                          handleRenameSession(session.id, sessionName);
                          setEditingSession(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleRenameSession(session.id, sessionName);
                            setEditingSession(null);
                          } else if (e.key === 'Escape') {
                            setEditingSession(null);
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                      />
                    ) : (
                      <span>{session.name}</span>
                    )}
                  </button>
                  <button 
                    className="dot-menu-trigger session-menu"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuSession(openMenuSession === session.id ? null : session.id);
                    }}
                  >
                    ⋯
                  </button>
                  <DotMenu
                    isOpen={openMenuSession === session.id}
                    onClose={() => setOpenMenuSession(null)}
                    onRename={() => {
                      setEditingSession(session.id);
                      setSessionName(session.name);
                    }}
                    onDelete={() => handleDeleteSession(session.id)}
                    type="session"
                  />
                </div>
              ))}
              
              {/* Add Session Button */}
              <div className="add-session-container">
                {isCommandMode === project.id ? (
                  <div className="add-session-input-container">
                    <input
                      className="add-session-input"
                      value={sessionCommand}
                      onChange={(e) => setSessionCommand(e.target.value)}
                      placeholder="Enter command (optional)"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleCreateSession(project.id, sessionCommand.trim() || undefined);
                        } else if (e.key === 'Escape') {
                          setIsCommandMode(null);
                          setSessionCommand('');
                        }
                      }}
                      autoFocus
                    />
                    <button 
                      className="add-session-confirm-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCreateSession(project.id, sessionCommand.trim() || undefined);
                      }}
                    >
                      <span className="add-session-icon">+</span>
                    </button>
                  </div>
                ) : (
                  <button 
                    className="add-session-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsCommandMode(project.id);
                    }}
                  >
                    <span className="add-session-icon">+</span>
                    <span>Add Session</span>
                  </button>
                )}
              </div>
            </div>
          ))}
          
          {/* Add Project Button */}
          <button className="add-project-btn" onClick={() => setShowOnboarding(true)}>
            + Add Project
          </button>
        </div>
      </div>
    </div>
  );
};