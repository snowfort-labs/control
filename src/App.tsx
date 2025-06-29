import React, { useState, useEffect } from 'react';
import { ProjectPanel } from './components/ProjectPanel';
import { TerminalPanel } from './components/TerminalPanel';
import { IntelligencePanel } from './components/IntelligencePanel';
import { Header } from './components/Header';
import { ProjectOnboarding } from './components/ProjectOnboarding';
import { useAppStore } from './store/appStore';

export const App: React.FC = () => {
  const { 
    intelligencePanelCollapsed, 
    setIntelligencePanelCollapsed,
    showOnboarding,
    setShowOnboarding,
    loadData,
    addProject
  } = useAppStore();
  const [projectPanelCollapsed, setProjectPanelCollapsed] = useState(false);

  // Load data when app starts
  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleProjectCreated = (projectId: string) => {
    setShowOnboarding(false);
    // The project is already added to the store via the onboarding component
    // We could optionally set it as active here
  };

  return (
    <div className="main-container">
      <Header />
      <div className="content">
        <div className={`panel ${projectPanelCollapsed ? 'collapsed' : ''}`} style={{ width: projectPanelCollapsed ? '48px' : '320px' }}>
          <ProjectPanel 
            collapsed={projectPanelCollapsed} 
            onToggleCollapse={() => setProjectPanelCollapsed(!projectPanelCollapsed)}
          />
        </div>
        
        <div className="terminal-container">
          <TerminalPanel />
        </div>
        
        <div className={`panel ${intelligencePanelCollapsed ? 'collapsed' : ''}`} style={{ width: intelligencePanelCollapsed ? '48px' : '320px' }}>
          <IntelligencePanel 
            collapsed={intelligencePanelCollapsed} 
            onToggleCollapse={() => setIntelligencePanelCollapsed(!intelligencePanelCollapsed)}
          />
        </div>
      </div>

      {/* Onboarding Modal */}
      {showOnboarding && (
        <ProjectOnboarding
          onProjectCreated={handleProjectCreated}
          onCancel={() => setShowOnboarding(false)}
        />
      )}
    </div>
  );
};