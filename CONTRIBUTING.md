# Contributing to Control

Thank you for your interest in contributing to Control! This document outlines the guidelines and processes for contributing to the project.

## Code of Conduct

This project adheres to a code of conduct that we expect all contributors to follow. Please be respectful and constructive in all interactions.

## Development Setup

### Prerequisites

- Go 1.21 or later
- Git
- Make (optional, but recommended)

### Getting Started

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/control.git
   cd control
   ```

3. Set up the upstream remote:
   ```bash
   git remote add upstream https://github.com/snowfort/control.git
   ```

4. Install dependencies:
   ```bash
   go mod download
   ```

5. Run tests to ensure everything works:
   ```bash
   make test
   ```

## Development Workflow

### Building

```bash
# Build the binary
make build

# Build for all platforms
make build-all

# Development mode (auto-reload)
make dev
```

### Testing

```bash
# Run all tests
make test

# Run tests with coverage
make test-coverage

# Run benchmarks
make bench
```

### Code Quality

```bash
# Format code
make fmt

# Run linter
make lint

# Security audit
make security
```

## Making Changes

### Branch Naming

Use descriptive branch names:
- `feature/add-new-adapter` for new features
- `fix/stability-calculation` for bug fixes
- `docs/update-readme` for documentation updates
- `refactor/storage-layer` for refactoring

### Commit Messages

Follow conventional commit format:
- `feat: add support for new agent adapter`
- `fix: resolve stability score calculation bug`
- `docs: update API documentation`
- `test: add integration tests for git adapter`
- `refactor: simplify metrics calculator`

### Code Style

- Follow Go conventions and idioms
- Use `gofmt` to format your code
- Write clear, self-documenting code
- Add comments for complex logic
- Keep functions focused and reasonably sized

### Testing

- Write tests for new functionality
- Ensure all tests pass before submitting
- Include both unit and integration tests where appropriate
- Mock external dependencies in tests
- Aim for good test coverage (>80%)

## Submitting Changes

### Pull Request Process

1. Ensure your branch is up to date with upstream:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. Run the full test suite:
   ```bash
   make test lint
   ```

3. Push your changes to your fork:
   ```bash
   git push origin your-branch-name
   ```

4. Create a pull request from your fork to the main repository

### Pull Request Guidelines

- Provide a clear title and description
- Reference any related issues
- Include screenshots for UI changes
- Update documentation if needed
- Ensure CI checks pass

## Architecture Guidelines

### Project Structure

```
control/
├── cmd/control/           # CLI entry point
├── internal/              # Private packages
│   ├── adapters/         # Data source adapters
│   ├── storage/          # Database interface
│   ├── server/           # HTTP server
│   ├── cli/              # Command definitions
│   └── metrics/          # Metrics calculation
├── web/                  # Frontend (optional)
└── tests/                # Integration tests
```

### Adding New Adapters

When adding support for new agent/tool integrations:

1. Create a new file in `internal/adapters/`
2. Implement the `Adapter` interface:
   ```go
   type Adapter interface {
       HasNewData() (bool, error)
       FetchEvents() ([]storage.Event, error)
       Watch(eventChan chan<- storage.Event, stopChan <-chan struct{})
   }
   ```
3. Add tests for your adapter
4. Update documentation

### Database Schema Changes

- All changes should be backward compatible
- Add migration logic if needed
- Update the `Event` struct if adding new fields
- Test with existing data

## Documentation

- Update README.md for user-facing changes
- Add inline code documentation for complex functions
- Update API documentation for new endpoints
- Include examples where helpful

## Performance Considerations

- Keep memory usage low (target: <25MB idle)
- Optimize database queries
- Use efficient data structures
- Profile performance-critical code
- Consider caching for expensive operations

## Security

- Never commit secrets or API keys
- Validate all user inputs
- Use secure defaults
- Follow Go security best practices
- Run security audits on dependencies

## Release Process

Releases are managed by maintainers:

1. Version bump in appropriate files
2. Update CHANGELOG.md
3. Create and push git tag
4. CI automatically builds and publishes releases
5. Homebrew formula is updated automatically

## Getting Help

- Open an issue for bugs or feature requests
- Join discussions for questions
- Check existing issues before creating new ones
- Provide detailed information when reporting bugs

## Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes for significant contributions
- Special thanks in major releases

Thank you for contributing to Control! 🎛️