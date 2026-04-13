#!/bin/sh
set -e

echo "=== Dark Theme Plugin — Build ==="

# Install deps
echo "→ Installing dependencies..."
npm install

# Build
echo "→ Building bundle..."
npm run build

# Create distributable folder
DIST_DIR="camunda-dark-theme-plugin"
echo "→ Creating $DIST_DIR/..."

rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

cp index.js       "$DIST_DIR/"
cp style.css      "$DIST_DIR/"
cp package.json   "$DIST_DIR/"
mkdir -p "$DIST_DIR/dist"
cp dist/client.js "$DIST_DIR/dist/"

echo ""
echo "✓ Done! Plugin folder ready: $DIST_DIR/"
echo ""
echo "=== Install ==="
echo "Copy '$DIST_DIR' to your Camunda Modeler plugins directory:"
echo ""

case "$(uname -s)" in
  Darwin) PLUGINS="$HOME/Library/Application Support/camunda-modeler/resources/plugins/" ;;
  Linux)  PLUGINS="$HOME/.config/camunda-modeler/resources/plugins/" ;;
  *)      PLUGINS="%APPDATA%\\camunda-modeler\\resources\\plugins\\" ;;
esac

echo "  $PLUGINS"
echo ""
echo "Then restart Camunda Modeler."
