import React, { useState, useEffect } from 'react';
import { Project, Task, TaskPlan } from '../types/engine';

interface ProjectViewProps {
  project: Project;
}

export const ProjectView: React.FC<ProjectViewProps> = ({ project }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskPlans, setTaskPlans] = useState<TaskPlan[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'planning'>('overview');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskBody, setNewTaskBody] = useState('');
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    loadTasks();
    loadTaskPlans();
  }, [project.id]);

  const loadTasks = async () => {
    try {
      const projectTasks = await window.snowfortAPI.getTasks(project.id);
      setTasks(projectTasks);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    }
  };

  const loadTaskPlans = async () => {
    try {
      const plans = await window.snowfortAPI.getTaskPlans(project.id);
      setTaskPlans(plans);
    } catch (error) {
      console.error('Failed to load task plans:', error);
    }
  };

  const createTask = async () => {
    if (!newTaskTitle.trim() || !newTaskBody.trim()) return;
    
    try {
      await window.snowfortAPI.createTask(project.id, newTaskTitle, newTaskBody);
      setNewTaskTitle('');
      setNewTaskBody('');
      loadTasks();
    } catch (error) {
      console.error('Failed to create task:', error);
    }
  };

  const analyzeConflicts = async () => {
    if (selectedTasks.length === 0) return;
    
    setIsAnalyzing(true);
    try {
      await window.snowfortAPI.analyzeTaskConflicts(project.id, selectedTasks);
      loadTaskPlans();
    } catch (error) {
      console.error('Failed to analyze conflicts:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTasks(prev => 
      prev.includes(taskId) 
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="panel-header">
        <span>{project.name}</span>
        <span>•</span>
        <span style={{ color: '#6b7280' }}>Project Overview</span>
        <div style={{ marginLeft: 'auto' }}>
          <button className="shortcut-btn">⚙️ Settings</button>
        </div>
      </div>
      
      <div style={{ borderBottom: '1px solid #374151', display: 'flex' }}>
        <button 
          onClick={() => setActiveTab('overview')}
          style={{
            padding: '12px 16px',
            background: activeTab === 'overview' ? '#374151' : 'transparent',
            border: 'none',
            color: activeTab === 'overview' ? '#f3f4f6' : '#9ca3af',
            cursor: 'pointer'
          }}
        >
          Overview
        </button>
        <button 
          onClick={() => setActiveTab('tasks')}
          style={{
            padding: '12px 16px',
            background: activeTab === 'tasks' ? '#374151' : 'transparent',
            border: 'none',
            color: activeTab === 'tasks' ? '#f3f4f6' : '#9ca3af',
            cursor: 'pointer'
          }}
        >
          Tasks ({tasks.length})
        </button>
        <button 
          onClick={() => setActiveTab('planning')}
          style={{
            padding: '12px 16px',
            background: activeTab === 'planning' ? '#374151' : 'transparent',
            border: 'none',
            color: activeTab === 'planning' ? '#f3f4f6' : '#9ca3af',
            cursor: 'pointer'
          }}
        >
          Planning ({taskPlans.length})
        </button>
      </div>
      
      <div style={{ flex: 1, padding: '20px', overflow: 'auto' }}>
        {activeTab === 'overview' && (
          <div className="project-overview">
            <section style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: '#f3f4f6' }}>
                Project Details
              </h3>
              <div style={{ background: '#1f2937', padding: '16px', borderRadius: '8px' }}>
                <div style={{ marginBottom: '8px' }}>
                  <strong style={{ color: '#9ca3af' }}>Path:</strong> 
                  <span style={{ marginLeft: '8px', fontFamily: 'monospace', color: '#e5e7eb' }}>
                    {project.path}
                  </span>
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <strong style={{ color: '#9ca3af' }}>Branch:</strong> 
                  <span style={{ marginLeft: '8px', color: '#e5e7eb' }}>
                    {project.currentBranch || 'main'}
                  </span>
                </div>
                <div>
                  <strong style={{ color: '#9ca3af' }}>Created:</strong> 
                  <span style={{ marginLeft: '8px', color: '#e5e7eb' }}>
                    {new Date(project.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </section>

            <section style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: '#f3f4f6' }}>
                Quick Actions
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <button 
                  className="project-action-btn"
                  style={{ 
                    background: '#1f2937', 
                    border: '1px solid #374151', 
                    borderRadius: '8px', 
                    padding: '16px', 
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#374151'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#1f2937'}
                >
                  <div style={{ fontSize: '20px', marginBottom: '4px' }}>📁</div>
                  <div style={{ color: '#f3f4f6', fontSize: '14px', fontWeight: 500 }}>Open in Finder</div>
                  <div style={{ color: '#9ca3af', fontSize: '12px' }}>View project files</div>
                </button>
                
                <button 
                  className="project-action-btn"
                  style={{ 
                    background: '#1f2937', 
                    border: '1px solid #374151', 
                    borderRadius: '8px', 
                    padding: '16px', 
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#374151'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#1f2937'}
                >
                  <div style={{ fontSize: '20px', marginBottom: '4px' }}>🌿</div>
                  <div style={{ color: '#f3f4f6', fontSize: '14px', fontWeight: 500 }}>Git Status</div>
                  <div style={{ color: '#9ca3af', fontSize: '12px' }}>Check repository status</div>
                </button>
                
                <button 
                  className="project-action-btn"
                  style={{ 
                    background: '#1f2937', 
                    border: '1px solid #374151', 
                    borderRadius: '8px', 
                    padding: '16px', 
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#374151'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#1f2937'}
                >
                  <div style={{ fontSize: '20px', marginBottom: '4px' }}>🧪</div>
                  <div style={{ color: '#f3f4f6', fontSize: '14px', fontWeight: 500 }}>Run Tests</div>
                  <div style={{ color: '#9ca3af', fontSize: '12px' }}>Execute project tests</div>
                </button>
                
                <button 
                  className="project-action-btn"
                  style={{ 
                    background: '#1f2937', 
                    border: '1px solid #374151', 
                    borderRadius: '8px', 
                    padding: '16px', 
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#374151'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#1f2937'}
                >
                  <div style={{ fontSize: '20px', marginBottom: '4px' }}>📊</div>
                  <div style={{ color: '#f3f4f6', fontSize: '14px', fontWeight: 500 }}>Project Stats</div>
                  <div style={{ color: '#9ca3af', fontSize: '12px' }}>View project metrics</div>
                </button>
              </div>
            </section>

            <section>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: '#f3f4f6' }}>
                Recent Activity
              </h3>
              <div style={{ background: '#1f2937', padding: '16px', borderRadius: '8px' }}>
                <div style={{ color: '#9ca3af', textAlign: 'center', padding: '20px' }}>
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>📋</div>
                  <div>No recent activity</div>
                  <div style={{ fontSize: '12px', marginTop: '4px' }}>
                    Activity will appear here as you work on this project
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="tasks-view">
            <section style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: '#f3f4f6' }}>
                Create New Task
              </h3>
              <div style={{ background: '#1f2937', padding: '16px', borderRadius: '8px' }}>
                <div style={{ marginBottom: '12px' }}>
                  <input
                    type="text"
                    placeholder="Task title..."
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: '#374151',
                      border: '1px solid #4b5563',
                      borderRadius: '4px',
                      color: '#f3f4f6',
                      fontSize: '14px'
                    }}
                  />
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <textarea
                    placeholder="Task description..."
                    value={newTaskBody}
                    onChange={(e) => setNewTaskBody(e.target.value)}
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: '#374151',
                      border: '1px solid #4b5563',
                      borderRadius: '4px',
                      color: '#f3f4f6',
                      fontSize: '14px',
                      resize: 'vertical'
                    }}
                  />
                </div>
                <button
                  onClick={createTask}
                  disabled={!newTaskTitle.trim() || !newTaskBody.trim()}
                  style={{
                    padding: '8px 16px',
                    background: newTaskTitle.trim() && newTaskBody.trim() ? '#3b82f6' : '#4b5563',
                    border: 'none',
                    borderRadius: '4px',
                    color: '#f3f4f6',
                    fontSize: '14px',
                    cursor: newTaskTitle.trim() && newTaskBody.trim() ? 'pointer' : 'not-allowed'
                  }}
                >
                  Create Task
                </button>
              </div>
            </section>

            <section>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#f3f4f6' }}>
                  Tasks ({tasks.length})
                </h3>
                {selectedTasks.length > 0 && (
                  <button
                    onClick={analyzeConflicts}
                    disabled={isAnalyzing}
                    style={{
                      padding: '6px 12px',
                      background: '#10b981',
                      border: 'none',
                      borderRadius: '4px',
                      color: '#f3f4f6',
                      fontSize: '12px',
                      cursor: isAnalyzing ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {isAnalyzing ? 'Analyzing...' : `Analyze ${selectedTasks.length} Tasks`}
                  </button>
                )}
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {tasks.length === 0 ? (
                  <div style={{ background: '#1f2937', padding: '24px', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', marginBottom: '8px' }}>📝</div>
                    <div style={{ color: '#9ca3af' }}>No tasks yet</div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                      Create your first task above
                    </div>
                  </div>
                ) : (
                  tasks.map(task => (
                    <div
                      key={task.id}
                      style={{
                        background: '#1f2937',
                        border: selectedTasks.includes(task.id) ? '2px solid #3b82f6' : '1px solid #374151',
                        borderRadius: '8px',
                        padding: '16px',
                        marginBottom: '8px',
                        cursor: 'pointer'
                      }}
                      onClick={() => toggleTaskSelection(task.id)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <h4 style={{ color: '#f3f4f6', fontSize: '14px', fontWeight: 500, margin: 0 }}>
                          {task.title}
                        </h4>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          {task.conflictRisk !== undefined && (
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '10px',
                              background: task.conflictRisk > 70 ? '#dc2626' : task.conflictRisk > 30 ? '#f59e0b' : '#10b981',
                              color: '#fff'
                            }}>
                              {task.conflictRisk}% risk
                            </span>
                          )}
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '10px',
                            background: '#374151',
                            color: '#9ca3af'
                          }}>
                            {task.status}
                          </span>
                        </div>
                      </div>
                      <p style={{ color: '#d1d5db', fontSize: '12px', margin: 0, lineHeight: 1.4 }}>
                        {task.body}
                      </p>
                      {task.source === 'github' && (
                        <div style={{ marginTop: '8px', fontSize: '10px', color: '#6b7280' }}>
                          📱 GitHub Issue #{task.sourceId}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'planning' && (
          <div className="planning-view">
            <section>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: '#f3f4f6' }}>
                Task Plans ({taskPlans.length})
              </h3>
              
              {taskPlans.length === 0 ? (
                <div style={{ background: '#1f2937', padding: '24px', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>🎯</div>
                  <div style={{ color: '#9ca3af' }}>No plans yet</div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                    Go to Tasks tab and select tasks to analyze for conflicts
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {taskPlans.map(plan => (
                    <div
                      key={plan.id}
                      style={{
                        background: '#1f2937',
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        padding: '16px',
                        marginBottom: '16px'
                      }}
                    >
                      <h4 style={{ color: '#f3f4f6', fontSize: '14px', fontWeight: 500, marginBottom: '12px' }}>
                        {plan.name}
                      </h4>
                      
                      {plan.phases.map((phase) => (
                        <div key={phase.id} style={{ marginBottom: '16px' }}>
                          <h5 style={{ color: '#d1d5db', fontSize: '12px', fontWeight: 500, marginBottom: '8px' }}>
                            {phase.name}
                          </h5>
                          
                          {phase.parallelGroups.map(group => (
                            <div
                              key={group.id}
                              style={{
                                background: '#374151',
                                padding: '12px',
                                borderRadius: '6px',
                                marginBottom: '8px'
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ color: '#9ca3af', fontSize: '11px' }}>
                                  {group.canRunInParallel ? '🟢 Can run in parallel' : '🔴 Must run sequentially'}
                                </span>
                                <span style={{
                                  padding: '2px 6px',
                                  borderRadius: '8px',
                                  fontSize: '9px',
                                  background: group.conflictRisk > 70 ? '#dc2626' : group.conflictRisk > 30 ? '#f59e0b' : '#10b981',
                                  color: '#fff'
                                }}>
                                  {group.conflictRisk}% conflict risk
                                </span>
                              </div>
                              
                              <div style={{ fontSize: '10px', color: '#d1d5db' }}>
                                Tasks: {group.taskIds.map(taskId => {
                                  const task = tasks.find(t => t.id === taskId);
                                  return task ? task.title : taskId;
                                }).join(', ')}
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                      
                      <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '8px' }}>
                        Created: {new Date(plan.createdAt).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
};