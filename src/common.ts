import * as vscode from "vscode";
import { ChildProcessWithoutNullStreams, spawn } from "child_process";

export const ext_name = "ros2-topic-viewer";
export const ext_title = "ROS2 Topic Viewer";

function getSourceCommand(): string | null {
    const config = vscode.workspace.getConfiguration(ext_name);
    const files = config.get<Array<string>>("filesToSource");
    if (!files || files.length === 0) {
        return null;
    }
    let sourceCommand = "";
    for (const file of files!) {
        sourceCommand += `source ${file} && `;
    }
    return sourceCommand;
}
export function addSourceCommand(command: string): string {
    const sourceCommand = getSourceCommand() || "";
    return `bash -c '${sourceCommand}${command}'`;
}

export function spawnWithSource(command: string, args: readonly string[]): ChildProcessWithoutNullStreams {
    var rosCommand = `${getSourceCommand() || ""}${command}`;
    for (const arg of args) {
        rosCommand += " " + arg;
    }

    return spawn("bash", ["-c", rosCommand]);
}
