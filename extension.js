const vscode = require('vscode');

const { Workspace, Global } = vscode.ConfigurationTarget;

// The one pattern this extension manages in files.exclude.
const DOTFILE_PATTERN = '**/.*';
// Patterns older versions (0.0.3 and earlier) also wrote. '**/.*' already
// covers them, so they're removed whenever we save.
const LEGACY_PATTERNS = ['**/.vscode', '**/.gitignore', '**/.env'];

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    console.log('Dotfile Toggle extension is now active!');

    // Create status bar item
    const statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100
    );
    statusBarItem.command = 'dotfileToggle.toggle';
    updateStatusBar(statusBarItem);
    statusBarItem.show();

    // Register the toggle command
    const toggleCommand = vscode.commands.registerCommand('dotfileToggle.toggle', () => {
        toggleDotfiles(statusBarItem);
    });

    // Listen for configuration changes
    const configChangeListener = vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('files.exclude') || e.affectsConfiguration('dotfileToggle.hideDotfiles')) {
            updateStatusBar(statusBarItem);
        }
    });

    // Add to subscriptions
    context.subscriptions.push(toggleCommand);
    context.subscriptions.push(statusBarItem);
    context.subscriptions.push(configChangeListener);

    // Initialize on activation
    initializeDotfileState().catch(error => console.error('Dotfile Toggle:', error));
}

// Re-apply the pattern if the saved state says hidden but the pattern is missing.
async function initializeDotfileState() {
    const flag = vscode.workspace.getConfiguration('dotfileToggle').inspect('hideDotfiles');
    const scope = flag.workspaceValue !== undefined ? Workspace : Global;

    if (vscode.workspace.getConfiguration('dotfileToggle').get('hideDotfiles', false)) {
        await applyDotfileExclusion(true, scope);
    }
}

async function toggleDotfiles(statusBarItem) {
    const config = vscode.workspace.getConfiguration('dotfileToggle');
    const newState = !config.get('hideDotfiles', false);

    // Save per folder when we can. With no folder open, or a folder whose
    // settings file can't be written, fall back to the user settings, which
    // apply to every folder.
    let scope = vscode.workspace.workspaceFolders ? Workspace : Global;
    try {
        try {
            await saveState(newState, scope);
        } catch (error) {
            if (scope === Global) {
                throw error;
            }
            scope = Global;
            await saveState(newState, scope);
        }

        // Update status bar
        updateStatusBar(statusBarItem);

        // Show notification
        if (config.get('notify', false)) {
            const message = newState ? 'Dotfiles hidden' : 'Dotfiles visible';
            const where = scope === Global ? ' in all folders' : '';
            vscode.window.showInformationMessage(`📄 ${message}${where}`);
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to toggle dotfiles: ${error.message}`);
    }
}

async function saveState(hide, scope) {
    await applyDotfileExclusion(hide, scope);

    // Store the flag at the same level, leaving it out when it would only
    // repeat what that level already inherits.
    const flag = vscode.workspace.getConfiguration('dotfileToggle').inspect('hideDotfiles');
    const inherited = scope === Workspace
        ? (flag.globalValue ?? flag.defaultValue ?? false)
        : (flag.defaultValue ?? false);
    await vscode.workspace.getConfiguration('dotfileToggle')
        .update('hideDotfiles', hide === inherited ? undefined : hide, scope);
}

// Edit files.exclude at one level only. VS Code merges object settings across
// the default, user and folder levels, so each level only needs its own entries.
async function applyDotfileExclusion(hide, scope) {
    const config = vscode.workspace.getConfiguration();
    const inspected = config.inspect('files.exclude');
    const own = { ...((scope === Workspace ? inspected.workspaceValue : inspected.globalValue) || {}) };
    const inherited = scope === Workspace
        ? { ...(inspected.defaultValue || {}), ...(inspected.globalValue || {}) }
        : { ...(inspected.defaultValue || {}) };
    const before = JSON.stringify(own);

    // Older versions only ever wrote folder settings, so only tidy those;
    // the user settings may hold entries the user chose themselves.
    if (scope === Workspace) {
        for (const pattern of LEGACY_PATTERNS) {
            if (own[pattern] === true) {
                delete own[pattern];
            }
        }
    }

    // Write the pattern only when this level differs from what it inherits;
    // e.g. showing dotfiles in one folder while the user settings hide them.
    if (Boolean(inherited[DOTFILE_PATTERN]) === hide) {
        delete own[DOTFILE_PATTERN];
    } else {
        own[DOTFILE_PATTERN] = hide;
    }

    // Drop folder entries that only repeat what the folder inherits, such as
    // the copies of VS Code's own defaults that older versions wrote.
    if (scope === Workspace) {
        for (const key of Object.keys(own)) {
            if (key !== DOTFILE_PATTERN && inherited[key] === own[key]) {
                delete own[key];
            }
        }
    }

    if (JSON.stringify(own) === before) {
        return;
    }
    return config.update('files.exclude', Object.keys(own).length ? own : undefined, scope);
}

function updateStatusBar(statusBarItem) {
    const config = vscode.workspace.getConfiguration('dotfileToggle');
    const hideDotfiles = config.get('hideDotfiles', false);
    const flag = config.inspect('hideDotfiles');
    const fromUserSettings = flag.workspaceValue === undefined && flag.globalValue !== undefined;

    if (hideDotfiles) {
        statusBarItem.text = '$(eye-closed) Dotfiles';
        statusBarItem.tooltip = fromUserSettings
            ? 'Dotfiles hidden in all folders (user setting). Click to show them here'
            : 'Click to show dotfiles';
    } else {
        statusBarItem.text = '$(eye) Dotfiles';
        statusBarItem.tooltip = flag.globalValue === true
            ? 'Dotfiles shown in this folder, hidden elsewhere (user setting). Click to hide them here'
            : 'Click to hide dotfiles';
    }
}

function deactivate() {
    console.log('Dotfile Toggle extension is now deactivated');
}

module.exports = { activate, deactivate };
