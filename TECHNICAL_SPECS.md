# The Loom - Technical Specifications

## Overview
The Loom is a desktop application for orchestrating multiple AI coding agents (Claude Code, OpenAI Codex CLI, Gemini CLI) across multiple projects through managed terminal sessions with intelligent analytics and notifications.

## Architecture

### Core Approach: Managed Terminal Sessions
- Launch AI agents in controlled terminal environments
- User sees and interacts with native terminal interface
- App monitors I/O for analytics, state detection, and notifications
- Shortcut buttons inject common commands into terminals

### Desktop Framework
**Choice: Electron** (Node.js backend + Web frontend)
- Seamless terminal integration with xterm.js + node-pty
- Straightforward agent process management with child_process
- Rich Node.js ecosystem for authentication and file operations
- Proven approach for developer tools (VS Code, Discord)
- Cross-platform support (Mac, Linux, Windows)

### Frontend Stack
- **React + TypeScript**: UI framework
- **Zustand**: State management (lightweight)
- **Radix UI + Tailwind**: Component library + styling
- **xterm.js**: Terminal emulation in browser

### Data Persistence
**SQLite** embedded database with schema:

```sql
-- Organization hierarchy
organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  order_index INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Projects (repositories)
projects (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES organizations(id),
  name TEXT NOT NULL,
  path TEXT NOT NULL, -- file system path to repo
  order_index INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Agent sessions
sessions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  name TEXT NOT NULL,
  agent_type TEXT NOT NULL, -- 'claude' | 'codex' | 'gemini'
  status TEXT DEFAULT 'idle', -- 'idle' | 'ready' | 'working' | 'error' | 'completed'
  config TEXT, -- JSON config for agent-specific settings
  order_index INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_active DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Conversation analytics
conversations (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  messages TEXT, -- JSON array of messages
  turn_count INTEGER DEFAULT 0,
  status TEXT, -- 'active' | 'completed' | 'failed'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);

-- Intelligence metrics
analytics (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  metric_type TEXT NOT NULL, -- 'turn_count' | 'completion_time' | 'success_rate'
  value REAL NOT NULL,
  metadata TEXT, -- JSON for additional context
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## User Interface Layout

### Main Layout (Option 6 Enhanced)
```
┌─────────────────────────────────────────────────────────────┐
│ 🧵 The Loom                    Auto Mode ▼    🔴 3 🟡 2     │
├─────────────────────────────────────────────────────────────┤
│ ┌─PROJECTS─────┐ ┌─ACTIVE SESSION──────────┐ ┌─INTELLIGENCE┐ │
│ │ [Collapsible │ │ Terminal + Controls     │ │ [Collapsible]│ │
│ │  Hierarchy]  │ │                         │ │   Panel     │ │
│ │              │ │ [Managed Terminal View] │ │             │ │
│ │              │ │                         │ │             │ │
│ │              │ │ [Shortcut Buttons]      │ │             │ │
│ └──────────────┘ └─────────────────────────┘ └─────────────┘ │
│ ┌─QUEUE & BACKGROUND ACTIVITY────────────────────────────────┐ │
│ │ Background Sessions + Task Queue                           │ │
│ └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Project Hierarchy (Left Panel)
```
📁 Organization Name (optional)
├── 🗂 Project Name
│   ├── 📺 Session 1 (Claude) 🟢
│   ├── 📺 Session 2 (Codex) 🟡
│   └── 📺 Session 3 (Gemini) ⚪
└── 🗂 Another Project
    └── 📺 Session A (Claude) 🔵

🗂 Standalone Project (no org)
└── 📺 Session X (Codex) 🔵
```

**Features:**
- Drag and drop reordering
- Collapsible sections
- Move projects between organizations
- Color-coded session status
- Persistent across app restarts

### Intelligence Panel (Right Panel)
**Collapsible with states:**
- **Collapsed**: Thin strip with key metrics
- **Expanded**: Full insights dashboard

**MVP Contents:**
- Turn count for active session
- Session status and notifications
- Basic analytics (completion time, success rate)

## Agent Integration

### Supported Agents
1. **Claude Code**: `claude-code` command
2. **OpenAI Codex CLI**: `codex` command  
3. **Gemini CLI**: `gemini-cli` command

### Managed Terminal Session Implementation

```typescript
interface AgentConfig {
  executable: string;
  defaultArgs: string[];
  authCommand?: string;
  configPath?: string;
}

class ManagedTerminalSession {
  id: string;
  terminal: Terminal; // xterm.js instance
  process: ChildProcess; // spawned agent process
  agent: AgentType;
  project: Project;
  status: SessionStatus;
  
  async start(agent: AgentType, projectPath: string): Promise<void>;
  sendCommand(command: string): void;
  restart(): Promise<void>;
  terminate(): void;
  
  // Analytics
  onOutputReceived(callback: (data: string) => void): void;
  getCurrentTurnCount(): number;
  getSessionMetrics(): SessionMetrics;
}
```

### State Detection Patterns
Each agent has different output patterns for state detection:

**Claude Code:**
- Ready: `Continue conversation...`
- Working: `🔄 Executing...` or `Claude is working...`
- Error: Error messages in output
- Completed: Task completion indicators

**Codex CLI:**
- Ready: Command prompt appears
- Working: Processing indicators
- Error: Error output patterns

**Gemini CLI:**
- Ready: Prompt ready state
- Working: Processing states
- Error: Error patterns

### Session Persistence Strategy
**Requirements:** Sessions continue when app closes

**Implementation:**
1. **Process Persistence**: Keep agent processes running in background
2. **State Storage**: Save terminal state, scroll position, command history
3. **Reconnection**: Reattach to existing processes on app startup
4. **Graceful Shutdown**: Option to terminate or keep sessions running

## Key Features

### MVP Features (Phase 1)
- ✅ Project hierarchy management (Organizations → Projects → Sessions)
- ✅ Managed terminal sessions for all three agents
- ✅ Basic turn counting and analytics
- ✅ Desktop notifications when agents ready for input
- ✅ Session persistence across app restarts
- ✅ Collapsible intelligence panel
- ✅ Shortcut buttons for common commands

### Shortcut Buttons (MVP)
- `[Run Tests]` → "run the tests"
- `[Commit Changes]` → "commit these changes with a good message"
- `[Explain Code]` → "explain this codebase structure"
- `[Fix Errors]` → "fix any errors you find"

### Future Features (Phase 2+)
- Advanced analytics and pattern recognition
- Multi-agent task queuing
- Agent supervision and intervention
- Cross-project learning and recommendations
- Automated conflict prevention

## Technical Implementation Details

### Process Management
- Spawn agents with predefined configurations
- Monitor process health and restart if needed
- Handle different agent authentication flows
- Manage environment variables and PATH

### Terminal Integration
- Full terminal emulation with xterm.js
- Bidirectional I/O streaming
- Command injection for shortcuts
- Terminal state persistence (scroll, history)

### Cross-Platform Considerations
- Agent executable detection across OS
- Path handling differences
- Authentication flow variations
- File system permissions

## Configuration Management

### Agent-Specific Configs
Each agent has different configuration approaches:

**Claude Code:**
- Uses `.claude/` directory
- API key management
- Project-specific settings

**OpenAI Codex CLI:**
- OpenAI API key setup
- Different config file format
- Model selection options

**Gemini CLI:**
- Google Cloud authentication
- Gemini-specific configuration
- Rate limiting settings

### Application Settings
- Default agent preferences
- Notification settings
- Keyboard shortcuts
- Intelligence panel preferences
- Session persistence options

## CLI Agent Terminal Compatibility Research

### Claude Code CLI ✅ **High Compatibility**
**Technical Details:**
- Built with CommanderJS + React Ink framework
- Native terminal application, designed to "live in your terminal"
- Installation: `npm install -g @anthropic-ai/claude-code` (Node 18+)
- Platform Support: macOS, Linux, Windows via WSL

**Terminal Integration Features:**
- Headless mode with `-p` flag for piping/automation
- Can chain with other CLI tools and pipe data
- Supports multiple instances in different terminal tabs
- Direct execution of commands, tests, and git operations

**Compatibility Assessment:** **Excellent** - Purpose-built for terminal usage, should work seamlessly with xterm.js + node-pty approach.

### OpenAI Codex CLI ✅ **High Compatibility**
**Technical Details:**
- Open-source, TypeScript-based terminal agent
- Uses openai Node.js library v4+ with streaming support
- Installation: `npm install -g @openai/codex` (Node 22+, 4-8GB RAM)
- Platform Support: macOS, Linux (official), Windows experimental via WSL

**Terminal Integration Features:**
- Three approval modes: Suggest, Auto Edit, Full Auto
- Multimodal inputs (text, screenshots, diagrams)
- Built-in sandboxing with Docker integration
- Local execution - source code doesn't leave environment
- Shell command execution through defined tools

**Compatibility Assessment:** **Excellent** - Standard CLI with well-defined I/O patterns, explicit support for automation and process management.

### Gemini CLI ✅ **High Compatibility**
**Technical Details:**
- TypeScript-based, recently released (June 2025)
- Uses ReAct (Reason and Act) loop architecture
- Installation: Node.js 18+ required
- Platform Support: Windows, macOS, Linux (full cross-platform)

**Terminal Integration Features:**
- Built-in MCP (Model Context Protocol) support
- File manipulation and command execution capabilities
- Google Search integration for real-time context
- Non-interactive mode for script automation
- Free tier with high usage limits (60 req/min, 1000/day)

**Compatibility Assessment:** **Excellent** - Modern CLI design with automation support, explicit cross-platform compatibility.

## Terminal Emulation Compatibility Summary

### ✅ **All Three Agents Are Highly Compatible**

**Why Our Approach Will Work:**
1. **Standard CLI Applications**: All three are Node.js-based CLI tools that follow standard input/output patterns
2. **No Special Terminal Requirements**: None require specific terminal emulators or special pty handling
3. **Automation Support**: All support non-interactive and automated usage modes
4. **Cross-Platform**: All work on our target platforms (Mac, Linux, Windows)
5. **Process Management**: All can be spawned as child processes and managed programmatically

**Technical Implementation (Electron + node-pty):**
```typescript
// Seamless integration with Electron's Node.js backend
const pty = require('node-pty');

// Claude Code
const claudeProcess = pty.spawn('claude-code', [], { 
  cwd: projectPath,
  name: 'xterm-color',
  cols: 80,
  rows: 30
});

// Codex CLI  
const codexProcess = pty.spawn('codex', [], { cwd: projectPath });

// Gemini CLI
const geminiProcess = pty.spawn('gemini-cli', [], { cwd: projectPath });

// Terminal integration
terminal.onData(data => claudeProcess.write(data));
claudeProcess.onData(data => terminal.write(data));
```

**State Detection Patterns Identified:**
- **Claude Code**: Uses React Ink, likely has consistent prompt patterns
- **Codex CLI**: Has explicit approval modes with defined states
- **Gemini CLI**: ReAct loop provides clear reasoning/action boundaries

**Potential Challenges (Minor):**
- Each has different authentication flows to handle
- Output parsing patterns will need to be agent-specific
- Some interactive prompts may need special handling

**Overall Assessment: 🟢 GREEN LIGHT** - Our managed terminal approach is fully compatible with all target agents.

---

## Decisions Made

### ✅ 1. Authentication Strategy
**Decision**: Let each agent handle its own authentication flow
- Simpler implementation for MVP
- Agents manage their own credentials/tokens
- Users authenticate through each agent's native flow

### ✅ 2. Session Persistence Strategy  
**Decision**: Save state + restart processes approach
- Save terminal state, scroll position, command history to SQLite
- On app restart, respawn agent processes and restore terminal state
- Upgrade to background daemon approach in future versions

### ✅ 3. Project Onboarding Flow
**Decision**: Browse/enter directory with smart defaults + auto-create session
- User browses or enters directory path
- Auto-detect project name from folder name (user can modify)
- Git branch handling: Auto-detect current branch, no selection needed initially
- Validate directory exists and is accessible
- **Auto-create initial session** when project is added

### 4. Keyboard Shortcuts
**Decision**: Deferred to later development phase

## Remaining Open Questions

### 1. Project Onboarding Details
**Git Branch Handling Options:**
- **A) Auto-detect current branch** (simplest - just use whatever branch they're on)
- **B) Show current branch + allow switching** (more complex but useful)
- **C) Branch selection during onboarding** (most complex)

**Additional Onboarding Fields:**
- Project name (prefilled from folder name, editable)
- Organization assignment (optional dropdown)
- Default agent preference (optional)
- Initial session creation (auto-create or ask?)

### 2. Error Recovery Strategy
How to handle agent crashes or errors?
- Automatic restart attempts?
- User notification + manual restart?
- Intelligent retry with different parameters?

### 3. Multi-Project Workflows  
How to handle commands that affect multiple projects?
- Cross-project search and operations?
- Bulk session management?
- Project relationship management?

---

## Roadmap & Future Features

### Phase 1: MVP (Core Functionality)
**Target: 2-4 weeks**
- ✅ Project hierarchy management (Organizations → Projects → Sessions)
- ✅ Managed terminal sessions for Claude Code, Codex CLI, Gemini CLI
- ✅ Basic turn counting and session analytics
- ✅ Desktop notifications when agents ready for input
- ✅ Session persistence across app restarts
- ✅ Collapsible intelligence panel with basic metrics
- ✅ Shortcut buttons for common commands
- ✅ Project onboarding with directory browsing

### Phase 2: Intelligence & Automation (4-8 weeks)
- **Auto-populate existing projects**: Scan file system for Claude Code usage patterns
  - Detect `.claude/` directories and recent Claude Code sessions
  - Parse conversation history to identify frequently used projects
  - Suggest importing existing projects with one-click setup
- **Advanced analytics**: Pattern recognition, success prediction, agent performance comparison
- **Smart recommendations**: Context-aware suggestions based on conversation history
- **Task queue system**: Queue and prioritize tasks across multiple projects
- **Agent supervision**: AI agents monitoring other agents for quality/completion

### Phase 3: Advanced Orchestration (8-12 weeks)
- **Multi-agent workflows**: Run multiple agents on same task, compare results
- **Agent competition**: OpenAI vs Claude vs Gemini head-to-head
- **Cross-project learning**: Shared knowledge base and pattern library
- **Automated conflict prevention**: Worktree management, port allocation
- **Advanced session persistence**: Background daemon processes

### Phase 4: Team & Enterprise (12+ weeks)
- **Team collaboration**: Shared projects and session insights
- **Organization-wide analytics**: Team productivity metrics
- **Custom agent configurations**: Fine-tuned settings per project/team
- **Integration ecosystem**: CI/CD integration, IDE plugins, webhook support

### Auto-Populate Feature (Phase 2 Priority)

**Detection Strategy:**
```typescript
interface ProjectDiscovery {
  // Scan for Claude Code usage
  scanClaudeDirectories(): Promise<ClaudeProject[]>; // ~/.claude/projects/
  
  // Parse conversation logs
  parseConversationHistory(): Promise<ProjectUsage[]>;
  
  // Git repository detection  
  findGitRepositories(searchPaths: string[]): Promise<GitRepo[]>;
  
  // Recent file activity
  analyzeRecentActivity(): Promise<RecentProject[]>;
}
```

**User Experience:**
```
┌─ Welcome to The Loom ─────────────────────────────┐
│                                                   │
│ 🔍 We found 8 projects you've worked on recently │
│                                                   │
│ ✅ ~/code/my-app        (Claude Code, 2 days ago) │
│ ✅ ~/work/api-service   (Claude Code, 1 week ago) │
│ ⬜ ~/personal/website   (Git repo, no Claude)     │
│ ⬜ ~/experiments/ml     (Git repo, no Claude)     │
│                                                   │
│ [Import Selected]  [Add Manually]  [Skip]        │
└───────────────────────────────────────────────────┘
```

**Implementation Details:**
- Scan `~/.claude/projects/` for existing Claude Code projects
- Parse conversation logs to identify active repositories
- Cross-reference with git repositories in common directories
- Respect user privacy: only scan local files, ask permission
- One-click import with intelligent project naming and organization

This feature will be crucial for user adoption - making the transition from standalone CLI usage to The Loom seamless.

---

## Development Plan - Phase 1 MVP

### Week 1: Project Setup & Core UI
**Deliverables:**
- ✅ Electron app skeleton with React + TypeScript
- ✅ Basic three-panel layout (Projects | Main | Intelligence)
- ✅ SQLite database setup with schema
- ✅ Project hierarchy UI (Organizations → Projects → Sessions)

**Tasks:**
1. Initialize Electron project with React + TypeScript
2. Set up build pipeline and development environment
3. Create main window with three-panel layout
4. Implement SQLite integration with schema
5. Build project tree component with drag/drop

**No Uncertainties** - Standard Electron setup

### Week 2: Terminal Integration
**Deliverables:**
- ✅ Working terminal sessions with xterm.js + node-pty
- ✅ Agent process spawning (Claude Code first)
- ✅ Basic I/O monitoring for analytics
- ✅ Session state management

**Tasks:**
1. Integrate xterm.js terminal component
2. Implement ManagedTerminalSession class
3. Add Claude Code process spawning
4. Create terminal I/O logging system
5. Build session persistence logic

**Uncertainty: Agent Output Parsing**
- Need to identify Claude Code state detection patterns through testing
- May require iterative refinement of parsing logic

### Week 3: Project Management
**Deliverables:**
- ✅ Project onboarding flow with directory browser
- ✅ Git integration (branch detection)
- ✅ Project CRUD operations
- ✅ Session creation and management

**Tasks:**
1. Build project onboarding dialog
2. Implement directory validation and git detection
3. Add project editing and deletion
4. Create session management UI
5. Test with real projects

**No Uncertainties** - Standard file system operations

### Week 4: Intelligence & Polish
**Deliverables:**
- ✅ Turn counting and basic analytics
- ✅ Desktop notifications
- ✅ Shortcut buttons
- ✅ Collapsible intelligence panel
- ✅ App packaging and distribution

**Tasks:**
1. Implement turn counting logic
2. Add desktop notification system
3. Create shortcut button framework
4. Build intelligence panel with basic metrics
5. Set up app packaging (electron-builder)

**Uncertainty: Notification Timing**
- Need to fine-tune when notifications fire
- May require user preference settings

## Technical Architecture Details

### Electron App Structure
```
src/
├── main/                    # Electron main process
│   ├── main.ts             # App entry point
│   ├── database.ts         # SQLite operations
│   └── terminal-manager.ts # Process management
├── renderer/               # React frontend
│   ├── components/         # UI components
│   ├── stores/             # Zustand state
│   └── hooks/              # React hooks
└── shared/                 # Shared types/utils
    ├── types.ts            # TypeScript interfaces
    └── constants.ts        # App constants
```

### Key Dependencies
```json
{
  "electron": "^28.0.0",
  "react": "^18.0.0",
  "typescript": "^5.0.0",
  "xterm": "^5.3.0",
  "node-pty": "^1.0.0",
  "@radix-ui/react-*": "latest",
  "tailwindcss": "^3.4.0",
  "zustand": "^4.4.0",
  "sqlite3": "^5.1.0"
}
```

### State Management (Zustand)
```typescript
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
  
  // Actions
  addProject: (project: Project) => void;
  createSession: (projectId: string, agentType: AgentType) => void;
  setActiveSession: (sessionId: string) => void;
}
```

## Remaining Uncertainties (All Minor)

### 1. Agent Output Parsing Patterns
**Question:** What are the exact output patterns for each agent's state detection?
**Impact:** Low - can be refined iteratively through testing
**Mitigation:** Start with basic patterns, improve based on observation

### 2. Notification Preferences  
**Question:** When exactly should notifications fire? What user preferences needed?
**Impact:** Low - UX polish, doesn't affect core functionality
**Mitigation:** Start with simple "agent ready" notifications, add preferences later

### 3. Shortcut Button Commands
**Question:** What are the most useful default shortcut commands?
**Impact:** Very Low - easy to modify based on usage
**Mitigation:** Start with basic set, make configurable

### 4. Cross-Platform Testing
**Question:** Any platform-specific issues with terminal integration or process spawning?
**Impact:** Medium - could affect Windows/Linux support  
**Mitigation:** Test early on all platforms, focus on Mac first

## Risk Assessment: 🟢 LOW RISK

**Why this plan has high confidence:**
- ✅ Electron + terminal integration is proven (VS Code, Hyper, etc.)
- ✅ All major decisions made, no architectural unknowns
- ✅ Agent compatibility confirmed through research
- ✅ Standard web technologies throughout
- ✅ Incremental development approach

**Biggest Risk:** Agent output parsing complexity
**Mitigation:** Build flexible parsing system, refine iteratively

**Timeline Confidence:** High - 4 weeks is realistic for MVP with daily development