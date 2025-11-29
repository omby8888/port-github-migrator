#!/bin/bash

# Port GitHub Migration Tool Installer
# Downloads and installs the latest binary for your system

set -e

VERSION=${1:-latest}
REPO="yourusername/github-ocean-migration"
INSTALL_DIR="${HOME}/.local/bin"

# Detect OS and architecture
OS=$(uname -s)
ARCH=$(uname -m)

case "$OS" in
  Darwin)
    case "$ARCH" in
      x86_64)
        BINARY_NAME="port-migrate-macos-x64"
        ;;
      arm64)
        BINARY_NAME="port-migrate-macos-arm64"
        ;;
      *)
        echo "❌ Unsupported architecture: $ARCH"
        exit 1
        ;;
    esac
    ;;
  Linux)
    BINARY_NAME="port-migrate-linux-x64"
    ;;
  MINGW*|MSYS*|CYGWIN*)
    BINARY_NAME="port-migrate-win-x64.exe"
    ;;
  *)
    echo "❌ Unsupported OS: $OS"
    exit 1
    ;;
esac

echo "📥 Downloading Port GitHub Migration Tool..."
echo "   OS: $OS, Architecture: $ARCH"
echo "   Binary: $BINARY_NAME"

# Create install directory if it doesn't exist
mkdir -p "$INSTALL_DIR"

# Download binary
DOWNLOAD_URL="https://github.com/$REPO/releases/$VERSION/download/$BINARY_NAME"
echo "📥 Downloading from: $DOWNLOAD_URL"

curl -L "$DOWNLOAD_URL" -o "$INSTALL_DIR/port-migrate"
chmod +x "$INSTALL_DIR/port-migrate"

# Add to PATH if not already there
if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
  echo ""
  echo "⚠️  To use 'port-migrate' from anywhere, add this to your shell profile:"
  echo "   export PATH=\"\$PATH:$INSTALL_DIR\""
else
  echo ""
  echo "✅ Installation complete!"
  echo "   Run 'port-migrate' to start"
fi

