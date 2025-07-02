# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Node.js Requirements

**Required Version:** Node.js 22 LTS (22.11.0 or later, to align with Electron 37.1.0's bundled Node.js version. Later versions may not include prebuilt dependencies like `node-pty`)

**Installation:**
```bash
# Using nvm (recommended)
nvm install 22
nvm use 22

# Verify version
node --version  # Should show v22.x.x
```

## Development Commands

**Core Development:**
- `npm run start` - Start Electron app in development mode (no DevTools)
- `npm run start:devtools` - Start Electron app with DevTools open
- `npm run lint` - Run ESLint on TypeScript/TSX files
- `npm run package` - Package the Electron app for distribution
- `npm run make` - Build distributable packages for the current platform

**TypeScript Compilation:**
The project uses webpack with ts-loader for compilation. TypeScript errors are checked in real-time during development via ForkTsCheckerWebpackPlugin.

**Real PTY Terminal Integration:**
Snowfort uses `node-pty` for true terminal functionality with real shell processes, cross-platform support, and proper ANSI handling. PTY processes are managed in the main process with real-time bidirectional communication to xterm.js.

**Build Requirements:**
With Node.js 22 LTS, `npm install` works directly. Build tools are only needed if prebuilt binaries fail.

## Project Architecture

**Snowfort Desktop** is an AI Engine Orchestration Platform built with Electron, React, and TypeScript. It provides a desktop interface for managing multiple AI engines (Claude Code, Gemini CLI, OpenAI Codex CLI) through managed terminal sessions.

### Core Architecture Patterns

**1. Electron IPC Communication:**
- Main process (`src/index.ts`) handles system operations, database, and engine management
- Renderer process (`src/renderer.tsx`) runs the React UI
- Secure IPC via `src/preload.ts` exposes `window.snowfortAPI` with type-safe methods
- All IPC methods defined in `src/types/ipc.ts` - must implement both main handler and preload exposure

**2. Three-Panel UI Layout:**
- **Projects Panel** (left): Project/session management with collapsible sidebar
- **Terminal Panel** (center): xterm.js-based terminal interface for engine interaction  
- **Intelligence Panel** (right): Analytics, metrics, and control insights

**3. Engine Management System:**
- `AgentDetector` (`src/services/agent-detector.ts`): Detects CLI availability and auth status
- `AgentManager` (`src/services/agent-manager.ts`): Spawns and manages engine processes
- Supports: `gemini` | `claude` | `codex` engines with different auth methods

**4. Database Layer:**
- SQLite via better-sqlite3 for local data persistence
- Schema: `organizations -> projects -> sessions -> conversations/analytics`
- Database stored in Electron's userData directory as `snowfort.db`

**5. State Management:**
- Zustand store (`src/store/appStore.ts`) for React state
- IPC calls to sync with Electron main process database
- Store automatically loads data on app start and triggers onboarding if no projects exist

### Key Implementation Details

**Engine Integration:**
Each engine has a configuration object defining:
- `executable`: Command to run (e.g., 'claude-code', 'npx', 'codex')
- `detectCommand`: Command to test availability
- `statePatterns`: Regex patterns to detect engine states from terminal output
- `authMethod`: Authentication type (oauth, api-key, google-login)

**Terminal Management:**
Uses xterm.js with @xterm/addon-fit for responsive rendering. ManagedSession interface wraps child processes with state tracking via regex patterns.

**Project Onboarding Flow:**
1. Path selection (manual input or native directory picker via `fs:selectDirectory`)
2. Engine selection based on availability detection
3. Project creation with initial session setup
4. Engine process spawning and terminal initialization

**Type Safety Notes:**
- All IPC communication is strongly typed via the SnowfortAPI interface
- Engine types and configurations centralized in `src/types/engine.ts`
- better-sqlite3 requires type workarounds: use `@ts-ignore` and `as any` casting

**Critical Dependencies:**
- `@xterm/xterm` and `@xterm/addon-fit` for terminal (note: must use consistent @xterm/* packages)
- `better-sqlite3` for database (constructor requires `(Database as any)(path)` pattern)
- `zustand` for state management
- Electron Forge with webpack for build system

### Development Workflow

**Adding New IPC Methods:**
1. Add method signature to `SnowfortAPI` in `src/types/ipc.ts`
2. Implement handler in `setupIpcHandlers()` in `src/index.ts`
3. Add preload exposure in `src/preload.ts`
4. Use from React via `window.snowfortAPI.methodName()`

**Database Schema Changes:**
Modify `initializeSchema()` in `src/services/database.ts`. Note: `CREATE TABLE IF NOT EXISTS` only handles table creation, not schema migrations.

**Engine Configuration:**
Engine configs in `AgentDetector.getAgentConfigs()` define detection commands, state patterns, and authentication. State detection parses terminal output in real-time with priority-based pattern matching (error > completed > working > ready).

## Testing and Verification

**Starting the App:**
```bash
# Start in foreground (blocks terminal)
npm run start

# Start in background (recommended for testing)
npm run start > snowfort-app.log 2>&1 &

# Wait for startup (look for "SNOWFORT-READY" in logs)
tail -f snowfort-app.log | grep -m 1 "SNOWFORT-READY"
```

**Verifying App Status:**
```bash
# Check if processes are running
ps aux | grep -E "(Snowfort|electron)" | grep -v grep

# Check startup logs
tail -20 snowfort-app.log
```

**Stopping the App:**
```bash
# Graceful shutdown (try first)
pkill -f "electron-forge"

# Force kill if needed (wait 2 seconds then force)
pkill -f "electron-forge" && sleep 2 && pkill -9 -f "electron" 2>/dev/null || true

# Verify processes stopped
ps aux | grep -E "(Snowfort|electron)" | grep -v grep
```

**Interactive Testing:**
The Electron app enables you to interact with it via MCP tools such as `circuit-electron`, if they are available. The webpack dev server runs on `http://localhost:9000` for build monitoring only - the React app runs inside Electron and isn't directly web-accessible.