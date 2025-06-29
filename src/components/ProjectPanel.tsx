import React from 'react';
import { useAppStore } from '../store/appStore';

interface ProjectPanelProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export const ProjectPanel: React.FC<ProjectPanelProps> = ({ collapsed, onToggleCollapse }) => {
  const { projects, sessions, organizations, activeSession, setActiveSession, setShowOnboarding } = useAppStore();

  const getSessionsForProject = (projectId: string) => {
    return sessions.filter(s => s.projectId === projectId);
  };

  const getProjectsForOrg = (orgId?: string) => {
    return projects.filter(p => p.orgId === orgId);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready': return '🟢';
      case 'working': return '🟡';
      case 'error': return '🔴';
      default: return '⚪';
    }
  };

  const getEngineIcon = (engineType: string) => {
    switch (engineType) {
      case 'claude': return '🤖';
      case 'codex': return '💻';
      case 'gemini': return '💎';
      default: return '📺';
    }
  };

  if (collapsed) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div className="panel-header" style={{ justifyContent: 'center' }}>
          <button onClick={onToggleCollapse}>📁</button>
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
                  <span>📁</span>
                  <span>{org.name}</span>
                </div>
                {orgProjects.map(project => (
                  <div key={project.id}>
                    <div className="project-item">
                      <span>🗂</span>
                      <span style={{ fontWeight: 500 }}>{project.name}</span>
                      {project.currentBranch && (
                        <span className="branch-badge">{project.currentBranch}</span>
                      )}
                    </div>
                    {getSessionsForProject(project.id).map(session => (
                      <button
                        key={session.id}
                        onClick={() => setActiveSession(session.id)}
                        className={`session-item ${activeSession?.id === session.id ? 'active' : ''}`}
                      >
                        <span>{getStatusIcon(session.status)}</span>
                        <span>{getEngineIcon(session.engineType)}</span>
                        <span>{session.name}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            );
          })}
          
          {/* Standalone Projects */}
          {getProjectsForOrg(undefined).map(project => (
            <div key={project.id}>
              <div className="project-item">
                <span>🗂</span>
                <span style={{ fontWeight: 500 }}>{project.name}</span>
                {project.currentBranch && (
                  <span className="branch-badge">{project.currentBranch}</span>
                )}
              </div>
              {getSessionsForProject(project.id).map(session => (
                <button
                  key={session.id}
                  onClick={() => setActiveSession(session.id)}
                  className={`session-item ${activeSession?.id === session.id ? 'active' : ''}`}
                >
                  <span>{getStatusIcon(session.status)}</span>
                  <span>{getEngineIcon(session.engineType)}</span>
                  <span>{session.name}</span>
                </button>
              ))}
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