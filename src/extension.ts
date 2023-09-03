import path = require('path');
import * as vscode from 'vscode';

const trackedFiles: Map<string, number> = new Map(); // Map to store file paths and their time spent
let activeEditor: vscode.TextEditor | undefined = vscode.window.activeTextEditor;
let startTime: number | undefined;

// Function to update the tracked time for a file
function updateTrackedTime(filePath: string, elapsedTime: number) {
	if (trackedFiles.has(filePath)) {
		trackedFiles.set(filePath, trackedFiles.get(filePath)! + elapsedTime);
	} else {
		trackedFiles.set(filePath, elapsedTime);
	}

	// Refresh the leaderboard when data changes
	leaderboardProvider.refresh();
}

// Function to start tracking time when a file editor becomes active
function startTrackingTime(editor: vscode.TextEditor) {
	const filePath = editor.document.fileName;
	startTime = Date.now();
	// vscode.window.showInformationMessage(`Tracking time for ${filePath}`);
}

// Function to stop tracking time when the file editor is changed
function stopTrackingTime(filePath: string) {
	if (startTime !== undefined) {
		const elapsedTime = (Date.now() - startTime) / 1000; // Convert to seconds
		updateTrackedTime(filePath, elapsedTime);
		startTime = undefined;
	}
}

// Function to get the top 5 most used files
function getTop5Files(): [string, number][] {
	// Sort the trackedFiles Map by time spent
	const sortedFiles = Array.from(trackedFiles).sort((a, b) => b[1] - a[1]);
	return sortedFiles.slice(0, 5);
}

// Tree item representing a tracked file in the sidebar
class TrackedFileItem extends vscode.TreeItem {
	constructor(public readonly label: string, public readonly filePath: string, public readonly timeSpent: number) {
		super(label, vscode.TreeItemCollapsibleState.None);
		this.filePath = filePath;
		this.tooltip = `${label}: ${formatTime(timeSpent)}`;
		this.description = formatTime(timeSpent);
	}
}

// TreeDataProvider for the sidebar leaderboard
class LeaderboardProvider implements vscode.TreeDataProvider<TrackedFileItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<TrackedFileItem | null | undefined> = new vscode.EventEmitter<TrackedFileItem | null | undefined>();
	readonly onDidChangeTreeData: vscode.Event<TrackedFileItem | null | undefined> = this._onDidChangeTreeData.event;


	getTreeItem(element: TrackedFileItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
		const item = new TrackedFileItem(element.label, element.filePath, element.timeSpent);
		item.command = {
			title: 'Open File',
			command: 'extension.openFileFromLeaderboard',
			arguments: [element]
		};
		return item;
	}

	getChildren(element?: TrackedFileItem | undefined): vscode.ProviderResult<TrackedFileItem[]> {
		return getTop5Files().map(([filePath, timeSpent]) => new TrackedFileItem(path.basename(filePath), filePath, timeSpent));
	}

	// Function to manually trigger a refresh of the leaderboard
	refresh(): void {
		this._onDidChangeTreeData.fire(null);
	}

	async openFile(item: TrackedFileItem): Promise<void> {
		const document = await vscode.workspace.openTextDocument(item.filePath);
		await vscode.window.showTextDocument(document);
	}
}

// Function to format time in HH:MM:SS format
function formatTime(seconds: number): string {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const remainingSeconds = Math.floor(seconds % 60);
	return `${padZero(hours)}:${padZero(minutes)}:${padZero(remainingSeconds)}`;
}

// Function to pad zero to single-digit numbers (e.g., 1 becomes "01")
function padZero(num: number): string {
	return num.toString().padStart(2, '0');
}

const leaderboardProvider = new LeaderboardProvider();

vscode.window.onDidChangeWindowState((state) => {
	const isWindowActive = state.focused;

	// Pause or resume tracking time based on the window state
	if (isWindowActive) {
		// Resume tracking time if there's an active editor
		if (activeEditor) {
			startTrackingTime(activeEditor);
		}
	} else {
		// Pause tracking time if the window is not active
		if (startTime !== undefined) {
			stopTrackingTime(activeEditor?.document.fileName || '');
		}
	}
})

export function activate(context: vscode.ExtensionContext) {
	activeEditor = vscode.window.activeTextEditor;
	if (activeEditor) {
		startTrackingTime(activeEditor);
	}

	// Track when a file editor is activated
	vscode.window.onDidChangeActiveTextEditor((editor) => {
		if (editor) {
			if (activeEditor && activeEditor !== editor) {
				stopTrackingTime(activeEditor.document.fileName);
			}
			activeEditor = editor;
			startTrackingTime(editor);
		}
	});

	// Register the leaderboard tree view and command
	vscode.window.registerTreeDataProvider('leaderboard', leaderboardProvider);

	context.subscriptions.push(
		vscode.commands.registerCommand('extension.openFileFromLeaderboard', (item: TrackedFileItem) => {
			leaderboardProvider.openFile(item);
		})
	);
}

export function deactivate() { }
