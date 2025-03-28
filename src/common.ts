import * as vscode from "vscode";

export const ext_name = "ros2-topic-viewer";
export const ext_title = "ROS2 Topic Viewer";

export function addSourceCommand(command: string): string {
    const config = vscode.workspace.getConfiguration(ext_name);
    const files = config.get<Array<string>>("filesToSource");
    console.log(files);
    if (!files || files.length === 0) {
        return command;
    }
    let sourceCommand = "";
    for (const file of files!) {
        sourceCommand += `source ${file} && `;
    }
    return `bash -c '${sourceCommand}${command}'`;
}
