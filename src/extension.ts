import * as vscode from "vscode";

import { ROS2TopicsProvider } from "./topicProvider";
import { ext_title, ext_name, addSourceCommand, spawnWithSource } from "./common";

import { exec } from "child_process";

import * as fs from "fs";
import * as path from "path";

export function activate(context: vscode.ExtensionContext) {
    const ros2TopicsProvider = new ROS2TopicsProvider();
    vscode.window.registerTreeDataProvider("ros2TopicsView", ros2TopicsProvider);

    let panelList: vscode.WebviewPanel[] = [];
    const max_panels = 4;

    const new_disposable = vscode.commands.registerCommand(`${ext_name}.refreshTopics`, () => {
        ros2TopicsProvider.refresh();
        vscode.window.showInformationMessage(ext_title + ": Topics refreshed!");
    });

    const showMessagesDisposable = vscode.commands.registerCommand(`${ext_name}.showMessages`, (topic: string) => {
        const config = vscode.workspace.getConfiguration(ext_name);

        if (panelList.length >= max_panels && config.get<boolean>("panelLimitSetting")) {
            vscode.window.showErrorMessage("Reached maximum number of panels! Please close a panel to open a new one.");
            return;
        }

        let existingPanel = panelList.find((p) => p.title === `Messages for ${topic}`);

        if (existingPanel) {
            existingPanel.reveal(vscode.ViewColumn.One);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            "topicMessages",
            `Messages for ${topic}`,
            vscode.ViewColumn.One,
            {
                enableScripts: true,
            }
        );

        panelList.push(panel);
        showTopicMessages(topic, panel, panelList);

        if (ros2TopicsProvider.getAdvancedMode()) {
            showAdvancedMessages(topic, panel);
        }
    });

    const toggleAdvancedDisposable = vscode.commands.registerCommand(`${ext_name}.toggleAdvanced`, () => {
        const advancedMode = ros2TopicsProvider.toggleAdvanced();
        if (advancedMode) {
            vscode.window.showInformationMessage(ext_title + ": Advanced mode enabled! Close panels to apply.");
        } else {
            vscode.window.showInformationMessage(ext_title + ": Advanced mode disabled! Close panels to apply.");
        }

        // while(panelList.length>0){
        //     const panel = panelList.pop();
        //     if (panel) {
        //         panel.dispose();
        //     }
        // }
    });

    const togglePanelLimitDisposable = vscode.commands.registerCommand(`${ext_name}.togglePanelLimit`, () => {
        togglePanelLimit();
    });

    context.subscriptions.push(new_disposable);
    context.subscriptions.push(showMessagesDisposable);
    context.subscriptions.push(toggleAdvancedDisposable);
    context.subscriptions.push(togglePanelLimitDisposable);
}

async function togglePanelLimit() {
    try {
        const config = vscode.workspace.getConfiguration(ext_name);
        const panelLimit = config.get<boolean>("panelLimitSetting");
        await config.update("panelLimitSetting", !panelLimit, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(
            "The panel limit setting is now set to: " + config.get<boolean>("panelLimitSetting")
        );
    } catch (err) {
        vscode.window.showErrorMessage("Error: " + err);
    }
}

async function updateInfoPanel(topic: string, panel: vscode.WebviewPanel) {
    if (panel.visible === false) {
        return;
    }

    const process_secondary = exec(addSourceCommand("ros2 topic info " + topic + " --verbose"));

    process_secondary.stdout?.on("data", (data) => {
        panel.webview.postMessage({ command: "pushInfo", message: data.toString() });
        process_secondary.kill();
    });

    process_secondary.stderr?.on("data", (data) => {
        console.error(`Error from process secondary: ${data}`);
        panel.webview.postMessage({ command: "error", message: data });
    });
}

async function showTopicMessages(topic: string, panel: vscode.WebviewPanel, panelList: vscode.WebviewPanel[]) {
    panel.onDidDispose(() => {
        console.log("Disposing panel");
        // console.log('index of: ' + panelList.indexOf(panel));

        panelList.splice(panelList.indexOf(panel), 1);

        if (process) {
            // console.log('Sending SIGTERM to process');
            process.kill("SIGCONT");
            process.kill("SIGTERM");
        }
        if (process_secondary) {
            process_secondary.kill("SIGCONT");
            process_secondary.kill("SIGTERM");
        }
    });

    panel.webview.html = getWebviewContent(topic);

    const process = spawnWithSource("ros2", ["topic", "echo", topic]);
    const process_secondary = exec(addSourceCommand("ros2 topic info " + topic + " --verbose"));

    process.stdout?.on("data", (data) => {
        //if data is too big, truncate it:
        if (data.length > 10000) {
            data = data.slice(0, 10000);
            data = "Unable to visualize the entire message. The message is too big. \n\n";
            panel.webview.postMessage({ command: "error", message: data.toString() });
            // process.kill();
            return;
        }
        if (data.toString().includes("fastrtps_port")) {
            return;
        } // ignore fastrtps_port messages lock and load
        panel.webview.postMessage({ command: "update", message: data.toString() });
    });

    process.stderr?.on("data", (data) => {
        console.error(`Error: ${data}`);
        panel.webview.postMessage({ command: "error", message: data });
    });

    process.on("exit", (code) => {
        console.log(`Process exited with code: ${code}`);
        panel.webview.postMessage({ command: "exit", message: `The command has exited with code ${code}.` });
        // panel.dispose();
    });

    process_secondary.stdout?.on("data", (data) => {
        if (data.toString().includes("fastrtps_port")) {
            return;
        }
        panel.webview.postMessage({ command: "pushInfo", message: data });
        process_secondary.kill();
    });

    process_secondary.stderr?.on("data", (data) => {
        console.error(`Error from process secondary: ${data}`);
        panel.webview.postMessage({ command: "error", message: data });
    });

    panel.onDidChangeViewState((event) => {
        if (event.webviewPanel.visible) {
            if (process) {
                process.kill("SIGCONT");
            }
            if (process_secondary) {
                process_secondary.kill("SIGCONT");
            }
            updateInfoPanel(topic, panel);
        } else {
            if (process) {
                process.kill("SIGSTOP");
            }
            if (process_secondary) {
                process_secondary.kill("SIGSTOP");
            }
        }
    });

    panel.webview.postMessage({ command: "hideAdvanced", message: "Advanced mode disabled!" });
}

async function showAdvancedMessages(topic: string, panel: vscode.WebviewPanel) {
    panel.webview.html = getWebviewContent(topic);
    // console.log('showing advanced messages');
    const process = spawnWithSource("ros2", ["topic", "hz", topic]);
    const process_secondary = spawnWithSource("ros2", ["topic", "bw", topic]);

    panel.webview.postMessage({ command: "showAdvanced", message: "Advanced mode enabled!" });

    panel.onDidDispose(() => {
        if (process) {
            // console.log('Sending SIGTERM to process');
            process.kill("SIGCONT");
            process.kill("SIGTERM");
        }
        if (process_secondary) {
            process_secondary.kill("SIGCONT");
            process_secondary.kill("SIGTERM");
        }
    });

    process.stdout?.on("data", (data) => {
        // console.log(`Data: ${data}`);
        if (data.toString().includes("fastrtps_port")) {
            return;
        }
        panel.webview.postMessage({ command: "updateHz", message: data.toString() });
    });

    process.stderr?.on("data", (data) => {
        console.error(`Error: ${data}`);
        panel.webview.postMessage({ command: "error", message: data });
    });

    process.on("exit", (code) => {
        console.log(`Process exited with code: ${code}`);
        panel.webview.postMessage({ command: "exit", message: `The command has exited with code ${code}.` });
        // panel.dispose();
    });

    process_secondary.stdout?.on("data", (data) => {
        // console.log(`Data: ${data}`);
        if (data.toString().includes("fastrtps_port")) {
            return;
        }
        if (data.toString().includes("Subscribed")) {
            return;
        }
        panel.webview.postMessage({ command: "updateBw", message: data.toString() });
    });

    process_secondary.stderr?.on("data", (data) => {
        console.error(`Error: ${data}`);
        panel.webview.postMessage({ command: "error", message: data });
    });

    panel.onDidChangeViewState((event) => {
        if (event.webviewPanel.visible) {
            process.kill("SIGCONT");
            process_secondary.kill("SIGCONT");
            panel.webview.postMessage({ command: "showAdvanced", message: "Advanced mode enabled!" });
            return;
        } else {
            process.kill("SIGSTOP");
            process_secondary.kill("SIGSTOP");
        }
    });
}

function getWebviewContent(topic: string): string {
    const htmlPath = path.join(__dirname, "..", "media", "webview.html");
    let htmlContent = fs.readFileSync(htmlPath, "utf8");
    htmlContent = htmlContent.replace("${topic}", topic);
    return htmlContent;
}
