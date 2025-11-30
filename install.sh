#!/bin/bash

# Port GitHub Migration Tool Installer
# Downloads and installs the latest binary for your system

set -e

VERSION=${1:-latest}
REPO="omby8888/port-github-migrator"
INSTALL_DIR="${HOME}/.local/bin"

# Detect OS and architecture
OS=$(uname -s)
ARCH=$(uname -m)

case "$OS" in
  Darwin)
    case "$ARCH" in
      x86_64)
        BINARY_NAME="port-github-migrator-macos-x64"
        ;;
      arm64)
        BINARY_NAME="port-github-migrator-macos-arm64"
        ;;
      *)
        echo "❌ Unsupported architecture: $ARCH"
        exit 1
        ;;
    esac
    ;;
  Linux)
    BINARY_NAME="port-github-migrator-linux-x64"
    ;;
  MINGW*|MSYS*|CYGWIN*)
    BINARY_NAME="port-github-migrator-win-x64.exe"
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
if [ "$VERSION" = "latest" ]; then
  DOWNLOAD_URL="https://github.com/$REPO/releases/latest/download/$BINARY_NAME"
else
  DOWNLOAD_URL="https://github.com/$REPO/releases/download/$VERSION/$BINARY_NAME"
fi
echo "📥 Downloading from: $DOWNLOAD_URL"

if ! curl -L --fail "$DOWNLOAD_URL" -o "$INSTALL_DIR/port-github-migrator"; then
  echo "❌ Failed to download binary. Check your connection or release version."
  exit 1
fi
chmod +x "$INSTALL_DIR/port-github-migrator"

# Add to PATH if not already there
if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
  echo ""
  echo "⚠️  To use 'port-github-migrator' from anywhere, add this to your shell profile:"
  echo "   export PATH=\"\$PATH:$INSTALL_DIR\""
  echo ""
  echo "Then run: port-github-migrator --version"
else
  echo ""
  echo "✅ Installation complete!"
  echo "   Run 'port-github-migrator --version' to verify"
fi

