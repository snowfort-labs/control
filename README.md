# Snowfort

**Desktop Application for Software Development via AI Agent Orchestration**

Snowfort Desktop is a cross-platform desktop application that provides a unified interface for managing and orchestrating multiple AI agents (Claude Code, Gemini CLI, OpenAI Codex) through real terminal sessions. Built with Electron, React, and TypeScript.

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-37.1.0-47848F.svg)](https://electronjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-4.5.4-blue.svg)](https://www.typescriptlang.org/)

## ✨ Features

- **🤖 Multi-Agent Support** - Seamlessly work with Claude Code, Gemini CLI, and OpenAI Codex
- **💻 Real Terminal Integration** - True PTY terminals with full shell command support
- **📁 Project Management** - Organize and manage multiple development projects
- **🔄 Session Management** - Persistent agent sessions with state tracking
- **🌓 Dark/Light Theme** - Beautiful UI with theme switching
- **🗄️ Local Database** - SQLite-based local storage for projects and sessions
- **🔍 Intelligence Panel** - Real-time analytics and insights (coming soon)

## 🚀 Quick Start

### Prerequisites

- **Node.js 22 LTS** (22.11.0 or later) - [Download Node.js](https://nodejs.org/)
- **npm** (included with Node.js)

> **✅ No Build Tools Required!** With Node.js 22, prebuilt native modules eliminate the need for Xcode or Visual Studio Build Tools in most cases.

### Installation

```bash
# Clone the repository
git clone https://github.com/snowfort-labs/control.git
cd control

# Ensure you're using Node.js 22 (recommended)
nvm install 22  # if using nvm
nvm use 22      # if using nvm
node --version  # should show v22.x.x

# Install dependencies (no build tools needed!)
npm install

# Start the application
npm run start
```

### First Launch

1. **Add a Project** - Click "Add Project" to select your development directory
2. **Choose an Agent** - Select Claude Code, Gemini CLI, or OpenAI Codex
3. **Start Coding** - Use the integrated terminal to interact with your chosen AI agent

## 🛠️ Development

### Available Scripts

```bash
npm run start              # Start in development mode (no DevTools)
npm run start:devtools     # Start with DevTools for debugging
npm run start:mcp          # Start optimized for MCP testing
npm run package            # Package for distribution
npm run make               # Build distributable packages
npm run lint               # Run ESLint
```

### Project Structure

```
src/
├── components/           # React components
│   ├── Header.tsx       # App header with theme toggle
│   ├── ProjectPanel.tsx # Project and session management
│   ├── Terminal.tsx     # Terminal component with xterm.js
│   └── ...
├── services/            # Core services
│   ├── database.ts      # SQLite database operations
│   ├── engine-manager.ts # AI agent process management
│   └── engine-detector.ts # Agent availability detection
├── types/               # TypeScript type definitions
└── store/               # Zustand state management
```

### Architecture

**Snowfort Desktop** follows a clean architecture pattern:

- **Main Process** (`src/index.ts`) - Electron main process, handles system operations
- **Renderer Process** (`src/renderer.tsx`) - React UI application
- **IPC Communication** (`src/preload.ts`) - Secure inter-process communication
- **PTY Integration** (`node-pty`) - Real terminal processes for AI agents

## 🖥️ Platform Support

| Platform | Status | Notes |
|----------|--------|-------|
| **macOS** | ✅ Full Support | ARM64 and Intel |
| **Linux** | ✅ Full Support | Ubuntu, Debian, Fedora |
| **Windows** | 🚧 In Progress | PowerShell support |

## 🤖 Supported AI Agents

| Agent | Status | Installation |
|-------|--------|-------------|
| **Claude Code** | ✅ Production | [Install Claude Code](https://claude.ai/code) |
| **Gemini CLI** | ✅ Beta | `npm install -g @google/generative-ai-cli` |
| **OpenAI Codex** | 🚧 Coming Soon | API key required |

## 🔧 Configuration

Snowfort Desktop automatically detects available AI agents and handles authentication through each agent's standard methods:

- **Claude Code**: OAuth authentication
- **Gemini CLI**: Google account login
- **OpenAI Codex**: API key configuration

## 🐛 Troubleshooting

### Installation Issues

**Node.js Version**: Ensure you're using Node.js 22 LTS:

```bash
# Check version
node --version  # Should show v22.x.x

# Install Node.js 22 LTS if needed
# Option 1: Using nvm (recommended)
nvm install 22
nvm use 22

# Option 2: Download from nodejs.org
# Visit https://nodejs.org/ and download Node.js 22 LTS
```

**Rare Build Issues** (only if prebuilt binaries fail):

```bash
# macOS (rarely needed with Node.js 22)
# xcode-select --install

# Linux (rarely needed with Node.js 22)
# sudo apt-get install build-essential python3-dev

# Then retry installation
npm install
```

### Common Issues

- **Port 9000 in use**: Kill existing processes with `lsof -ti:9000 | xargs kill -9`
- **Database locked**: Remove `~/Library/Application Support/Snowfort/snowfort.db`
- **Agent not detected**: Ensure the agent CLI is installed and in your PATH

## 📚 Documentation

- **[CLAUDE.md](CLAUDE.md)** - Developer guide for Claude Code integration
- **[PROJECT_VISION.md](PROJECT_VISION.md)** - Product vision and roadmap
- **[TECHNICAL_SPECS.md](TECHNICAL_SPECS.md)** - Technical specifications

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🏢 About Snowfort Labs

Snowfort Desktop is developed by Snowfort Labs, building the future of AI-powered development tools.

---

**Need help?** [Open an issue](https://github.com/snowfort-labs/control/issues) or join our community discussions.