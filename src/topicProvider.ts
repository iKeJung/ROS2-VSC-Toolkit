import * as vscode from "vscode";
import { exec } from "child_process";
import { addSourceCommand } from "./common";

export class ROS2TopicsProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> =
        new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> =
        this._onDidChangeTreeData.event;

    private _advancedMode: boolean = false;

    constructor() {
        console.log("ROS2TopicsProvider initialized");
    }

    refresh(): void {
        console.log("Refresh called");
        this._onDidChangeTreeData.fire();
    }

    toggleAdvanced(): boolean {
        console.log("Advanced mode toggled");
        this._advancedMode = !this._advancedMode;
        return this._advancedMode;
    }

    getAdvancedMode(): boolean {
        return this._advancedMode;
    }

    getChildren(element?: vscode.TreeItem): vscode.ProviderResult<vscode.TreeItem[]> {
        return new Promise((resolve, reject) => {
            exec(addSourceCommand("ros2 topic list"), (error, stdout, stderr) => {
                if (error) {
                    console.error(`Error fetching topics: ${error.message}`);
                    return reject(error);
                }
                if (stderr) {
                    console.error(`Error: ${stderr}`);
                    return reject(new Error(stderr));
                }

                const topics = stdout.split("\n").filter((line) => line); // Split by newlines and filter empty
                const treeItems = topics.map((topic) => {
                    const item = new vscode.TreeItem(topic, vscode.TreeItemCollapsibleState.None);
                    item.command = {
                        command: "ros2-topic-viewer.showMessages",
                        title: "Show messages from ${topic}",
                        arguments: [topic],
                    };
                    return item;
                });
                resolve(treeItems);
            });
        });
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }
}
