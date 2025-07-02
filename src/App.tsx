import React, { useState, useEffect } from 'react';
import { ProjectPanel } from './components/ProjectPanel';
import { TerminalPanel } from './components/TerminalPanel';
import { IntelligencePanel } from './components/IntelligencePanel';
import { Header } from './components/Header';
import { ProjectOnboarding } from './components/ProjectOnboarding';
import { ResizablePanel } from './components/ResizablePanel';
import { useAppStore } from './store/appStore';

export const App: React.FC = () => {
  const { 
    intelligencePanelCollapsed, 
    setIntelligencePanelCollapsed,
    showOnboarding,
    setShowOnboarding,
    loadData
  } = useAppStore();
  const [projectPanelCollapsed, setProjectPanelCollapsed] = useState(false);

  // Load data when app starts
  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleProjectCreated = () => {
    setShowOnboarding(false);
    // The project is already added to the store via the onboarding component
  };

  return (
    <div className="main-container">
      <Header />
      <div className="content">
        {projectPanelCollapsed ? (
          <div className="panel collapsed" style={{ width: '48px' }}>
            <ProjectPanel 
              collapsed={projectPanelCollapsed} 
              onToggleCollapse={() => setProjectPanelCollapsed(!projectPanelCollapsed)}
            />
          </div>
        ) : (
          <ResizablePanel
            direction="left"
            initialWidth={320}
            minWidth={200}
            maxWidth={500}
          >
            <ProjectPanel 
              collapsed={projectPanelCollapsed} 
              onToggleCollapse={() => setProjectPanelCollapsed(!projectPanelCollapsed)}
            />
          </ResizablePanel>
        )}
        
        <div className="terminal-container panel">
          <TerminalPanel />
        </div>
        
        {intelligencePanelCollapsed ? (
          <div className="panel collapsed" style={{ width: '48px' }}>
            <IntelligencePanel 
              collapsed={intelligencePanelCollapsed} 
              onToggleCollapse={() => setIntelligencePanelCollapsed(!intelligencePanelCollapsed)}
            />
          </div>
        ) : (
          <ResizablePanel
            direction="right"
            initialWidth={320}
            minWidth={200}
            maxWidth={500}
          >
            <IntelligencePanel 
              collapsed={intelligencePanelCollapsed} 
              onToggleCollapse={() => setIntelligencePanelCollapsed(!intelligencePanelCollapsed)}
            />
          </ResizablePanel>
        )}
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