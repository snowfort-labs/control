# Control Build System

.PHONY: build test clean install dev docker release

# Build configuration
BINARY_NAME=control
MAIN_PATH=./cmd/control
BUILD_DIR=./build
VERSION?=$(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
LDFLAGS=-ldflags "-X main.version=${VERSION} -s -w"

# Default target
all: build

# Build the binary
build:
	@echo "Building Control v${VERSION}..."
	@mkdir -p ${BUILD_DIR}
	go build ${LDFLAGS} -o ${BUILD_DIR}/${BINARY_NAME} ${MAIN_PATH}
	@echo "Binary built: ${BUILD_DIR}/${BINARY_NAME}"

# Build for multiple platforms
build-all:
	@echo "Building for all platforms..."
	@mkdir -p ${BUILD_DIR}
	# macOS
	GOOS=darwin GOARCH=amd64 go build ${LDFLAGS} -o ${BUILD_DIR}/${BINARY_NAME}-darwin-amd64 ${MAIN_PATH}
	GOOS=darwin GOARCH=arm64 go build ${LDFLAGS} -o ${BUILD_DIR}/${BINARY_NAME}-darwin-arm64 ${MAIN_PATH}
	# Linux
	GOOS=linux GOARCH=amd64 go build ${LDFLAGS} -o ${BUILD_DIR}/${BINARY_NAME}-linux-amd64 ${MAIN_PATH}
	GOOS=linux GOARCH=arm64 go build ${LDFLAGS} -o ${BUILD_DIR}/${BINARY_NAME}-linux-arm64 ${MAIN_PATH}
	@echo "All platform binaries built in ${BUILD_DIR}/"

# Run tests
test:
	@echo "Running tests..."
	go test -v ./...

# Run tests with coverage
test-coverage:
	@echo "Running tests with coverage..."
	go test -v -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out -o coverage.html
	@echo "Coverage report: coverage.html"

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	rm -rf ${BUILD_DIR}
	rm -f coverage.out coverage.html

# Install locally
install: build
	@echo "Installing to /usr/local/bin..."
	sudo cp ${BUILD_DIR}/${BINARY_NAME} /usr/local/bin/
	@echo "Control installed successfully"

# Development mode (watch for changes)
dev:
	@echo "Starting development mode..."
	@which air > /dev/null || (echo "Installing air..." && go install github.com/cosmtrek/air@latest)
	air -c .air.toml

# Quick development server
serve: build
	@echo "Starting development server..."
	./${BUILD_DIR}/${BINARY_NAME} dashboard

# Docker build
docker:
	@echo "Building Docker image..."
	docker build -t control:${VERSION} .
	docker tag control:${VERSION} control:latest

# Prepare release
release: clean test build-all
	@echo "Preparing release ${VERSION}..."
	@mkdir -p ${BUILD_DIR}/release
	# Create archives
	cd ${BUILD_DIR} && tar -czf release/${BINARY_NAME}-${VERSION}-darwin-amd64.tar.gz ${BINARY_NAME}-darwin-amd64
	cd ${BUILD_DIR} && tar -czf release/${BINARY_NAME}-${VERSION}-darwin-arm64.tar.gz ${BINARY_NAME}-darwin-arm64
	cd ${BUILD_DIR} && tar -czf release/${BINARY_NAME}-${VERSION}-linux-amd64.tar.gz ${BINARY_NAME}-linux-amd64
	cd ${BUILD_DIR} && tar -czf release/${BINARY_NAME}-${VERSION}-linux-arm64.tar.gz ${BINARY_NAME}-linux-arm64
	# Generate checksums
	cd ${BUILD_DIR}/release && shasum -a 256 *.tar.gz > checksums.txt
	@echo "Release artifacts ready in ${BUILD_DIR}/release/"

# Initialize go modules
init:
	@echo "Initializing Go modules..."
	go mod init github.com/snowfort/control
	go mod tidy

# Download dependencies
deps:
	@echo "Downloading dependencies..."
	go mod download
	go mod tidy

# Format code
fmt:
	@echo "Formatting code..."
	go fmt ./...

# Lint code
lint:
	@echo "Linting code..."
	@which golangci-lint > /dev/null || (echo "Installing golangci-lint..." && go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest)
	golangci-lint run

# Generate documentation
docs:
	@echo "Generating documentation..."
	@which godoc > /dev/null || (echo "Installing godoc..." && go install golang.org/x/tools/cmd/godoc@latest)
	godoc -http=:6060 &
	@echo "Documentation server running at http://localhost:6060"

# Benchmark tests
bench:
	@echo "Running benchmarks..."
	go test -bench=. -benchmem ./...

# Security audit
security:
	@echo "Running security audit..."
	@which gosec > /dev/null || (echo "Installing gosec..." && go install github.com/securecodewarrior/gosec/v2/cmd/gosec@latest)
	gosec ./...

# Show help
help:
	@echo "Control Build System"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@echo "  build        Build the binary"
	@echo "  build-all    Build for all platforms"
	@echo "  test         Run tests"
	@echo "  test-coverage Run tests with coverage"
	@echo "  clean        Clean build artifacts"
	@echo "  install      Install locally"
	@echo "  dev          Development mode with auto-reload"
	@echo "  serve        Start development server"
	@echo "  docker       Build Docker image"
	@echo "  release      Prepare release artifacts"
	@echo "  deps         Download dependencies"
	@echo "  fmt          Format code"
	@echo "  lint         Lint code"
	@echo "  docs         Generate documentation"
	@echo "  bench        Run benchmarks"
	@echo "  security     Run security audit"
	@echo "  help         Show this help"