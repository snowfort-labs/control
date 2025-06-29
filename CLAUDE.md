# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

**Core Development:**
- `npm run start` - Start Electron app in development mode with hot reload
- `npm run lint` - Run ESLint on TypeScript/TSX files
- `npm run package` - Package the Electron app for distribution
- `npm run make` - Build distributable packages for the current platform

**TypeScript Compilation:**
The project uses webpack with ts-loader for compilation. TypeScript errors are checked in real-time during development via ForkTsCheckerWebpackPlugin.

**MCP Electron Testing:**
For automated testing with sfcg-electron MCP (Model Context Protocol):
```bash
# Step 1: In terminal, start your dev server first
npm run start

# Step 2: Once webpack compiles, use the MCP to launch
await app_launch({
  "app": "/Users/colin/data/control",
  "mode": "development"
})
```

**MCP Testing Best Practices:**

1. **Use MCP-Optimized Scripts:**
   ```bash
   # Regular development (with DevTools)
   npm run start
   
   # Development without DevTools
   npm run start:no-devtools
   
   # Optimized for MCP testing (no DevTools, MCP mode enabled)
   npm run start:mcp
   ```

2. **Enhanced Startup Detection:**
   The MCP now has improved Electron Forge detection with 30s timeout and progress updates every 5 seconds. Use `startScript` for reliable auto-start:
   ```bash
   # Clean process management (if needed)
   pkill -f "electron" && pkill -f "snowfort"
   
   # MCP will handle startup automatically
   await app_launch({
     "app": "/path/to/project",
     "mode": "development", 
     "startScript": "start:mcp"
   })
   ```

3. **Startup Detection:**
   Look for these log patterns to confirm readiness:
   - `[SNOWFORT-DEBUG] Remote debugging enabled` - Playwright ready
   - `[SNOWFORT-STARTUP] Detecting available engines` - Initialization started
   - `[SNOWFORT-ENGINES] {"claude":"available"...}` - Engines detected
   - `[SNOWFORT-READY] App initialized successfully` - Fully ready

4. **State File Verification:**
   Check the startup state file for programmatic detection:
   ```bash
   cat ~/Library/Application\ Support/Snowfort/startup-state.json
   ```
   Contains: `ready`, `timestamp`, `engines`, `pid`, `version`

5. **Expected Startup Sequence:**
   - Webpack compilation: ~5-10 seconds
   - Electron launch: ~2-3 seconds  
   - Engine detection: ~1-2 seconds
   - Look for: `[SNOWFORT-READY]` message

6. **Automatic Window Management:**
   DevTools filtering is now automatic - the MCP always targets the main app window. Use `get_windows()` to see all available windows with types:
   ```javascript
   // Returns structured window data
   // [
   //   {id: "window-0", type: "main", title: "Snowfort - AI Agent..."},
   //   {id: "window-1", type: "devtools", title: "DevTools"}
   // ]
   ```

7. **Environment Variables:**
   - `ELECTRON_DISABLE_DEVTOOLS=true` - Prevents DevTools opening
   - `SNOWFORT_MCP_MODE=true` - Optimizes for automated testing
   - `NODE_ENV=development` - Ensures development features

8. **Real PTY Terminal Integration:**
   Snowfort now uses `node-pty` for true terminal functionality:
   
   **Features Implemented:**
   - ✅ Real shell processes (zsh/bash/powershell)
   - ✅ Cross-platform support (macOS, Linux, Windows)
   - ✅ Proper ANSI escape sequence handling
   - ✅ Terminal resizing and cleanup
   - ✅ Claude Code CLI integration
   - ✅ All shell commands work (`ls`, `claude`, `npm`, etc.)
   
   **Implementation Details:**
   - PTY processes managed in main process (`src/index.ts:184-234`)
   - Real-time bidirectional communication (PTY ↔ xterm.js)
   - Platform-specific shell detection and PATH setup
   - Session-based PTY process management
   
   **Build Requirement:**
   `node-pty` requires native compilation. If build fails:
   ```bash
   # Install build tools (macOS)
   xcode-select --install
   
   # Install build tools (Linux)
   sudo apt-get install build-essential python3-dev
   
   # Then retry
   npm install
   ```

9. **Terminal Input Interaction (Legacy - for old MCP testing):**
   When using MCP to interact with the terminal input field in Snowfort:
   ```javascript
   // CORRECT: Use click_by_role to focus the terminal input
   await click_by_role({
     "sessionId": "session-id",
     "role": "textbox",
     "name": "Terminal input"
   });
   
   // Then type using keyboard_type
   await keyboard_type({
     "sessionId": "session-id", 
     "text": "your command here"
   });
   
   // Send the command with Enter
   await keyboard_press({
     "sessionId": "session-id",
     "key": "Enter"
   });
   ```
   
   **Don't use these approaches (they don't work):**
   - `type()` with CSS selectors - fails to find the element
   - `click()` with CSS selectors - timeouts on element location
   - Direct selector references like `[ref="e21"]` - not reliable
   
   **The working pattern is:** `click_by_role` → `keyboard_type` → `keyboard_press`

## Project Architecture

**Snowfort Desktop** is an AI Agent Orchestration Platform built with Electron, React, and TypeScript. It provides a desktop interface for managing multiple AI agents (Claude Code, Gemini CLI, OpenAI Codex CLI) through managed terminal sessions.

### Core Architecture Patterns

**1. Electron IPC Communication:**
- Main process (`src/index.ts`) handles system operations, database, and agent management
- Renderer process (`src/renderer.tsx`) runs the React UI
- Secure IPC via `src/preload.ts` exposes `window.snowfortAPI` with type-safe methods
- All IPC methods defined in `src/types/ipc.ts` - must implement both main handler and preload exposure

**2. Three-Panel UI Layout:**
- **Projects Panel** (left): Project/session management with collapsible sidebar
- **Terminal Panel** (center): xterm.js-based terminal interface for agent interaction  
- **Intelligence Panel** (right): Analytics, metrics, and control insights

**3. Agent Management System:**
- `AgentDetector` (`src/services/agent-detector.ts`): Detects CLI availability and auth status
- `AgentManager` (`src/services/agent-manager.ts`): Spawns and manages agent processes
- Supports three agent types: `gemini` | `claude` | `codex` with different auth methods

**4. Database Layer:**
- SQLite via better-sqlite3 for local data persistence
- Schema: `organizations -> projects -> sessions -> conversations/analytics`
- Database stored in Electron's userData directory as `snowfort.db`

**5. State Management:**
- Zustand store (`src/store/appStore.ts`) for React state
- IPC calls to sync with Electron main process database
- Store automatically loads data on app start and triggers onboarding if no projects exist

### Key Implementation Details

**Agent Integration:**
Each agent has a configuration object defining:
- `executable`: Command to run (e.g., 'claude-code', 'npx', 'codex')
- `detectCommand`: Command to test availability
- `statePatterns`: Regex patterns to detect agent states from terminal output
- `authMethod`: Authentication type (oauth, api-key, google-login)

**Terminal Management:**
- Uses xterm.js with @xterm/addon-fit for responsive terminal rendering
- ManagedSession interface wraps child processes with state tracking
- Terminal state parsing via regex patterns to detect ready/working/error states

**Project Onboarding Flow:**
1. Path selection (manual input or native directory picker via `fs:selectDirectory`)
2. Agent selection based on availability detection
3. Project creation with initial session setup
4. Agent process spawning and terminal initialization

**Type Safety Notes:**
- All IPC communication is strongly typed via the SnowfortAPI interface
- Agent types and configurations centralized in `src/types/agent.ts`
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
Modify `initializeSchema()` in `src/services/database.ts`. The app handles schema migration via SQLite's `CREATE TABLE IF NOT EXISTS` pattern.

**Agent Configuration:**
Agent configs are defined in `AgentDetector.getAgentConfigs()`. Each agent needs detection commands, state patterns, and authentication handling.

**Engine Integration:**
Engine components must use xterm.js consistently and handle the async nature of engine process startup and state detection.

**Engine State Detection:**
Snowfort automatically detects engine states by parsing their terminal output:
- **Pattern-based detection**: Each engine has specific output patterns for ready/working/error/completed states
- **Real-time parsing**: Output is analyzed as it streams to update UI indicators
- **State transitions**: Proper flow from idle → ready → working → completed/error → ready
- **Fallback handling**: Timeout-based fallback to 'ready' if no patterns detected

Engine configurations include:
- `statePatterns.ready`: Patterns indicating engine is waiting for input
- `statePatterns.working`: Patterns indicating engine is processing
- `statePatterns.error`: Patterns indicating engine encountered an error  
- `statePatterns.completed`: Patterns indicating engine finished a task

State detection implementation in `src/services/engine-manager.ts`:
- Normalized pattern matching (case-insensitive)
- Priority-based detection (error > completed > working > ready)
- Logging for debugging state transitions
- Prevention of redundant state changes

## Testing and Verification

**Starting the App:**
1. `npm run start` - Starts Electron app with webpack dev server
2. The webpack dev server runs on `http://localhost:9000` for build monitoring only
3. The actual Snowfort app opens as a separate desktop Electron window (not web-accessible)

**Verifying App is Running:**
```bash
# Check if Electron processes are running
ps aux | grep -E "(electron|snowfort)" | grep -v grep

# Check if database is created
ls -la ~/Library/Application\ Support/Snowfort/snowfort.db

# Check webpack compilation status
tail -10 snowfort-app.log  # Look for "No errors found"
```

**Clean Restart Process:**
```bash
# Kill all Electron processes
pkill -f "electron" && pkill -f "snowfort"

# Free webpack dev server port if needed
lsof -ti:9000 | xargs kill -9 2>/dev/null || true

# Start fresh
npm run start > snowfort-app.log 2>&1 &
```

**Playwright MCP Testing:**

The Electron renderer process can be tested directly with Playwright MCP tools during development.

**Setup Process:**
1. Start the app: `npm run start`
2. Wait for compilation: Look for "No errors found" in webpack output
3. Navigate to: `http://localhost:3000/main_window`
4. Use Playwright MCP tools to interact with the UI

**What CAN be tested:**
- ✅ **React component rendering** - All UI elements, layouts, and visual components
- ✅ **User interactions** - Button clicks, form inputs, navigation flows
- ✅ **State management** - Component state changes and UI updates
- ✅ **Responsive design** - Layout behavior at different screen sizes
- ✅ **Styling and animations** - CSS behavior and visual effects
- ✅ **Frontend routing** - Navigation between different UI states
- ✅ **Error boundaries** - React error handling and display
- ✅ **Component integration** - How different UI components work together

**What CANNOT be tested:**
- ❌ **IPC communication** - `window.snowfortAPI` calls fail (browser vs Electron context)
- ❌ **File system operations** - Directory selection, file operations
- ❌ **Database operations** - Project/session creation, data persistence
- ❌ **Agent management** - CLI agent spawning, process communication
- ❌ **Terminal integration** - Real agent process interaction (xterm.js will render but won't connect)
- ❌ **Native Electron features** - Window management, system integration

**Expected Behaviors in Browser Context:**
- **IPC errors are normal** - Components will show error overlays when trying to call `window.snowfortAPI`
- **Mock data may be needed** - For testing components that depend on database/agent data
- **Terminal appears but doesn't function** - xterm.js renders but can't connect to real processes
- **File dialogs won't work** - Directory selection will fail gracefully

**Testing Examples:**
```javascript
// Navigate to app
await page.goto('http://localhost:3000/main_window');

// Test UI interactions
await page.click('text=Add Project');  // Triggers onboarding flow
await page.click('text=Dark');         // Toggle dark mode
await page.fill('input[placeholder*="project"]', 'Test Project');

// Verify UI state
expect(await page.textContent('h1')).toBe('Snowfort');
expect(await page.isVisible('text=Projects & Sessions')).toBe(true);

// Test responsive design
await page.setViewportSize({ width: 800, height: 600 });
```

**Debugging Tips:**
- Use browser DevTools to inspect React components and state
- Check console for expected IPC errors vs unexpected JavaScript errors
- Use Playwright MCP screenshot tool to capture UI states
- Test with different viewport sizes to verify responsive behavior

**Verification Checklist:**
- ✅ TypeScript compilation: "No errors found" in webpack output
- ✅ Electron processes: Multiple Electron processes running 
- ✅ Database: `snowfort.db` exists in userData directory
- ✅ Window: Snowfort app window visible on desktop (manual check)

**Common Issues:**
- Port 9000 in use: Kill existing processes and restart
- TypeScript errors: Check imports, especially `AgentType` vs string types
- Database errors: Check `better-sqlite3` constructor pattern: `(Database as any)(path)`
- Window not opening: Check main process logs for errors in `src/index.ts`