# Dark Theme Plugin for Camunda Modeler 5+

Adds a **🌙 Dark / ☀ Light** toggle to the status bar (bottom of the window).

Inspired by the [Dracula](https://draculatheme.com/) colour palette.

## Features

- Dark theme for the entire Modeler UI — canvas, properties panel, tabs, status bar
- Custom element colours are automatically darkened (not replaced)
- Theme preference saved in `localStorage` — dark mode on by default
- Toggle button in the status bar, works on all tabs

## Requirements

- Node.js ≥ 16
- Camunda Modeler 5.0+

## Build & Install

**macOS / Linux:**
```sh
sh build.sh
```

**Windows:**
```
build.bat
```

The script will:
1. Run `npm install`
2. Build the bundle (`dist/client.js`)
3. Create a `camunda-dark-theme-plugin/` folder with only the necessary files

**Then copy `camunda-dark-theme-plugin/` to your plugins directory:**

| OS      | Path |
|---------|------|
| Windows | `%APPDATA%\camunda-modeler\resources\plugins\` |
| macOS   | `~/Library/Application Support/camunda-modeler/resources/plugins/` |
| Linux   | `~/.config/camunda-modeler/resources/plugins/` |

Restart Camunda Modeler — the toggle button appears in the bottom-right status bar.

## Development

```sh
npm run watch   # rebuild on file change
```

Press **F12 → Ctrl+R** inside Modeler to reload plugins without a full restart.
