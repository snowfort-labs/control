import React from 'react';
import { useAppStore } from '../store/appStore';

interface IntelligencePanelProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export const IntelligencePanel: React.FC<IntelligencePanelProps> = ({ collapsed, onToggleCollapse }) => {
  const { activeSession, sessions } = useAppStore();

  if (collapsed) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div className="panel-header" style={{ justifyContent: 'center' }}>
          <button onClick={onToggleCollapse}>🧠</button>
        </div>
        <div className="panel-content" style={{ textAlign: 'center' }}>
          {activeSession && (
            <>
              <div className="metric-value">{activeSession.turnCount}</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>turns</div>
            </>
          )}
          <div style={{ marginTop: 16 }}>
            <div style={{ width: 32, height: 8, backgroundColor: '#bbf7d0', borderRadius: 4, margin: '0 auto' }}></div>
            <div style={{ fontSize: 12, color: '#10b981', marginTop: 4 }}>94%</div>
          </div>
        </div>
      </div>
    );
  }

  const getActiveSessionsCount = () => sessions.filter(s => s.status === 'ready' || s.status === 'working').length;
  const getAverageTurns = () => {
    const activeSessions = sessions.filter(s => s.turnCount && s.turnCount > 0);
    return activeSessions.length > 0 
      ? Math.round(activeSessions.reduce((sum, s) => sum + (s.turnCount || 0), 0) / activeSessions.length)
      : 0;
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="panel-header">
        <span>Intelligence & Control</span>
        <button onClick={onToggleCollapse}>→</button>
      </div>
      
      <div className="panel-content">
        <div className="intelligence-metrics">
          {activeSession ? (
            <div className="metric-group">
              <h3>⚡ Live Insights</h3>
              {activeSession.status === 'ready' && (
                <div className="insight-card success">
                  <div style={{ fontWeight: 500 }}>Ready for input</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Agent is waiting for your command</div>
                </div>
              )}
              {activeSession.status === 'working' && (
                <div className="insight-card warning">
                  <div style={{ fontWeight: 500 }}>Processing task</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Est. completion: 2-3 minutes</div>
                </div>
              )}
              {activeSession.turnCount && activeSession.turnCount > 5 && (
                <div className="insight-card info">
                  <div style={{ fontWeight: 500 }}>Long conversation detected</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Consider breaking into smaller tasks</div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: '#6b7280', marginTop: 32 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🧠</div>
              <p style={{ fontSize: 14 }}>Select a session to see insights</p>
            </div>
          )}

          <div className="metric-group">
            <h3>📊 Analytics</h3>
            <div className="metric-row">
              <span className="metric-label">Active Sessions</span>
              <span className="metric-value">{getActiveSessionsCount()}</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Avg Turns/Task</span>
              <span className="metric-value">{getAverageTurns()}</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Success Rate</span>
              <span className="metric-value" style={{ color: '#10b981' }}>94%</span>
            </div>
          </div>

          <div className="metric-group">
            <h3>⚡ Quick Actions</h3>
            <button className="action-btn">📋 Create Task Template</button>
            <button className="action-btn">🔄 Restart All Sessions</button>
            <button className="action-btn">📊 Export Analytics</button>
          </div>

          {sessions.filter(s => s.status === 'working').length > 0 && (
            <div className="metric-group">
              <h3>🔄 Background Activity</h3>
              {sessions.filter(s => s.status === 'working').map(session => (
                <div key={session.id} className="insight-card warning">
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{session.name}</div>
                  <div style={{ fontSize: 12 }}>Turn {session.turnCount} • {session.engineType}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};