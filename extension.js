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

    // Register the commands: toggle (status bar, command palette) and the
    // Explorer's hide/show buttons, one of which is shown at a time.
    const isHidden = () => vscode.workspace.getConfiguration('dotfileToggle').get('hideDotfiles', false);
    const toggleCommand = vscode.commands.registerCommand('dotfileToggle.toggle', () => {
        setDotfilesHidden(statusBarItem, !isHidden());
    });
    const hideCommand = vscode.commands.registerCommand('dotfileToggle.hide', () => {
        setDotfilesHidden(statusBarItem, true);
    });
    const showCommand = vscode.commands.registerCommand('dotfileToggle.show', () => {
        setDotfilesHidden(statusBarItem, false);
    });

    // Listen for configuration changes
    const configChangeListener = vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('files.exclude') || e.affectsConfiguration('dotfileToggle')) {
            updateStatusBar(statusBarItem);
        }
    });

    // Add to subscriptions
    context.subscriptions.push(toggleCommand);
    context.subscriptions.push(hideCommand);
    context.subscriptions.push(showCommand);
    context.subscriptions.push(statusBarItem);
    context.subscriptions.push(configChangeListener);

    // Initialize on activation
    initializeDotfileState().catch(error => console.error('Dotfile Toggle:', error));
}

// Re-apply the pattern if the saved state says hidden but the pattern is missing.
async function initializeDotfileState() {
    const flag = vscode.workspace.getConfiguration('dotfileToggle').inspect('hideDotfiles');
    const scope = flag.workspaceValue !== undefined ? Workspace : Global;

    // With saveTo "user", never write the folder's settings, not even to repair them.
    if (scope === Workspace && savesToUserSettings()) {
        return;
    }

    if (vscode.workspace.getConfiguration('dotfileToggle').get('hideDotfiles', false)) {
        await applyDotfileExclusion(true, scope);
    }
}

async function setDotfilesHidden(statusBarItem, newState) {
    const config = vscode.workspace.getConfiguration('dotfileToggle');
    const userMode = savesToUserSettings();

    // With saveTo "user" the folder's settings are never written. If they set
    // dotfiles themselves they win over the user settings, so a toggle would
    // change nothing here; say why instead of failing silently.
    if (userMode && folderOverrides()) {
        const choice = await vscode.window.showWarningMessage(
            'This folder\'s settings hide or show dotfiles themselves, which overrides your user settings. ' +
            `To toggle here, remove "dotfileToggle.hideDotfiles" and the "${DOTFILE_PATTERN}" entry under "files.exclude" from them.`,
            'Open Folder Settings'
        );
        if (choice) {
            vscode.commands.executeCommand('workbench.action.openWorkspaceSettingsFile');
        }
        return;
    }

    // Save per folder when we can. With saveTo "user", no folder open, or a
    // folder whose settings file can't be written, use the user settings,
    // which apply to every folder.
    let scope = vscode.workspace.workspaceFolders && !userMode ? Workspace : Global;
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

// True when dotfileToggle.saveTo is "user": toggles go to the user settings
// even with a folder open, so the folder's settings file is never changed.
function savesToUserSettings() {
    return vscode.workspace.getConfiguration('dotfileToggle').get('saveTo', 'workspace') === 'user';
}

// True when the folder's own settings decide dotfile visibility, which
// overrides anything in the user settings.
function folderOverrides() {
    const flag = vscode.workspace.getConfiguration('dotfileToggle').inspect('hideDotfiles');
    const exclude = vscode.workspace.getConfiguration().inspect('files.exclude').workspaceValue || {};
    return flag.workspaceValue !== undefined || Object.prototype.hasOwnProperty.call(exclude, DOTFILE_PATTERN);
}

function updateStatusBar(statusBarItem) {
    const config = vscode.workspace.getConfiguration('dotfileToggle');
    const hideDotfiles = config.get('hideDotfiles', false);
    const flag = config.inspect('hideDotfiles');
    const fromUserSettings = flag.workspaceValue === undefined && flag.globalValue !== undefined;
    const userMode = savesToUserSettings();

    // Picks which Explorer button (eye or crossed-out eye) is shown.
    vscode.commands.executeCommand('setContext', 'dotfileToggle.hidden', hideDotfiles);

    statusBarItem.text = hideDotfiles ? '$(eye-closed) Dotfiles' : '$(eye) Dotfiles';

    if (userMode && folderOverrides()) {
        statusBarItem.tooltip = `Dotfiles ${hideDotfiles ? 'hidden' : 'shown'} by this folder's settings, which override your user settings`;
    } else if (userMode) {
        statusBarItem.tooltip = hideDotfiles
            ? 'Dotfiles hidden in all folders. Click to show them'
            : 'Click to hide dotfiles in all folders';
    } else if (hideDotfiles) {
        statusBarItem.tooltip = fromUserSettings
            ? 'Dotfiles hidden in all folders (user setting). Click to show them here'
            : 'Click to show dotfiles';
    } else {
        statusBarItem.tooltip = flag.globalValue === true
            ? 'Dotfiles shown in this folder, hidden elsewhere (user setting). Click to hide them here'
            : 'Click to hide dotfiles';
    }
}

function deactivate() {
    console.log('Dotfile Toggle extension is now deactivated');
}

module.exports = { activate, deactivate };
