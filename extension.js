const vscode = require('vscode');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    console.log('Dotfile Toggle extension is now active!');
    
    // Show activation message
    vscode.window.showInformationMessage('✅ Dotfile Toggle Extension Loaded!');

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
        if (e.affectsConfiguration('files.exclude')) {
            updateStatusBar(statusBarItem);
        }
    });

    // Add to subscriptions
    context.subscriptions.push(toggleCommand);
    context.subscriptions.push(statusBarItem);
    context.subscriptions.push(configChangeListener);

    // Initialize on activation
    initializeDotfileState();
}

function initializeDotfileState() {
    const config = vscode.workspace.getConfiguration();
    const hideDotfiles = config.get('dotfileToggle.hideDotfiles', false);
    
    if (hideDotfiles) {
        // Apply the exclusion pattern if it should be hidden
        applyDotfileExclusion(true);
    }
}

async function toggleDotfiles(statusBarItem) {
    const config = vscode.workspace.getConfiguration();
    const currentState = config.get('dotfileToggle.hideDotfiles', false);
    const newState = !currentState;
    
    try {
        // Update our extension's configuration
        await config.update('dotfileToggle.hideDotfiles', newState, vscode.ConfigurationTarget.Workspace);
        
        // Apply or remove the exclusion pattern
        await applyDotfileExclusion(newState);
        
        // Update status bar
        updateStatusBar(statusBarItem);
        
        // Show notification
        const message = newState ? 'Dotfiles hidden' : 'Dotfiles visible';
        vscode.window.showInformationMessage(`📄 ${message}`);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to toggle dotfiles: ${error.message}`);
    }
}

async function applyDotfileExclusion(hide) {
    const config = vscode.workspace.getConfiguration();
    let filesExclude = { ...config.get('files.exclude') } || {}; // Create a copy
    
    if (hide) {
        // Add dotfile pattern to exclusions
        filesExclude['**/.*'] = true;
        // Common dotfiles to explicitly hide
        filesExclude['**/.git'] = true;
        filesExclude['**/.vscode'] = true;
        filesExclude['**/.gitignore'] = true;
        filesExclude['**/.env'] = true;
        filesExclude['**/.DS_Store'] = true;
    } else {
        // Remove dotfile patterns from exclusions
        delete filesExclude['**/.*'];
        delete filesExclude['**/.vscode'];
        delete filesExclude['**/.gitignore'];
        delete filesExclude['**/.env'];
        delete filesExclude['**/.DS_Store'];
        // Keep .git hidden as it's typically not needed - but make it optional
        // Comment out the next line if you want .git to be visible when showing dotfiles
        filesExclude['**/.git'] = true;
    }
    
    // Update the files.exclude configuration
    return config.update('files.exclude', filesExclude, vscode.ConfigurationTarget.Workspace);
}

function updateStatusBar(statusBarItem) {
    const config = vscode.workspace.getConfiguration();
    const hideDotfiles = config.get('dotfileToggle.hideDotfiles', false);
    
    if (hideDotfiles) {
        statusBarItem.text = '$(eye-closed) Dotfiles';
        statusBarItem.tooltip = 'Click to show dotfiles';
    } else {
        statusBarItem.text = '$(eye) Dotfiles';
        statusBarItem.tooltip = 'Click to hide dotfiles';
    }
}

function deactivate() {
    console.log('Dotfile Toggle extension is now deactivated');
}

module.exports = { activate, deactivate };