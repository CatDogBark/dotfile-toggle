# Dotfile Toggle

A simple VS Code extension to quickly toggle the visibility of dotfiles (hidden files) in the Explorer panel.

## Features

- **One-click toggle** - Show or hide all dotfiles with a single click
- **Status bar indicator** - See current state at a glance with eye icon
- **Smart filtering** - Hides common dotfiles like `.env`, `.gitignore`, `.DS_Store` while keeping `.git` hidden for cleaner workspace
- **Command palette support** - Access via `Ctrl+Shift+P` → "Toggle Dotfiles"
- **Explorer integration** - Toggle button appears directly in the Explorer panel

## How to Use

### Status Bar
Click the eye icon in the status bar:
- 👁️ **Open eye** = Dotfiles are visible
- 👁️‍🗨️ **Closed eye** = Dotfiles are hidden

### Command Palette
1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
2. Type "Toggle Dotfiles"
3. Press Enter

### Explorer Panel
Click the eye icon in the Explorer panel title bar

## What Gets Hidden

When hiding dotfiles, this extension will hide:
- All files starting with `.` (using pattern `**/.*`)
- Common dotfiles like `.env`, `.gitignore`, `.DS_Store`, `.vscode`
- The `.git` folder remains hidden even when showing other dotfiles

## Installation

Install from the VS Code Marketplace:
1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X`)
3. Search for "Dotfile Toggle"
4. Click Install

## Configuration

The extension automatically saves your preference per workspace. No additional configuration needed!

## Requirements

- VS Code 1.74.0 or higher

## Extension Settings

This extension contributes the following settings:

- `dotfileToggle.hideDotfiles`: Controls whether dotfiles should be hidden (managed automatically by the extension)
- `dotfileToggle.notify`: Show a notification each time dotfiles are hidden or shown (default: off)

## Known Issues

- When using VS Code with Remote SSH, you'll need to install the extension on both local and remote environments

## Release Notes

### 0.0.4

- No more "Extension Loaded!" popup at startup
- Toggle notifications are off by default; turn them on with `dotfileToggle.notify` (thanks to [@unennhexium](https://github.com/unennhexium), #2)

### 0.0.1

Initial release of Dotfile Toggle
- Toggle dotfile visibility in Explorer
- Status bar integration
- Command palette support
- Workspace-specific settings

## Why This Extension?

Working with projects that have many configuration files (`.env`, `.eslintrc`, `.prettierrc`, etc.) can clutter your Explorer view. This extension gives you a quick way to clean up your workspace view without permanently hiding important files.

## Contributing

Found a bug or have a feature request? Please open an issue on the [GitHub repository](https://github.com/CatDogBark/dotfile-toggle).

## License

This extension is released under the GPL License.