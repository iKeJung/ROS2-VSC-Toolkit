"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate
});
module.exports = __toCommonJS(extension_exports);
var vscode2 = __toESM(require("vscode"));

// src/topicProvider.ts
var vscode = __toESM(require("vscode"));
var import_child_process = require("child_process");
var ROS2TopicsProvider = class {
  _onDidChangeTreeData = new vscode.EventEmitter();
  onDidChangeTreeData = this._onDidChangeTreeData.event;
  _advancedMode = false;
  constructor() {
    console.log("ROS2TopicsProvider initialized");
  }
  refresh() {
    console.log("Refresh called");
    this._onDidChangeTreeData.fire();
  }
  toggleAdvanced() {
    console.log("Advanced mode toggled");
    this._advancedMode = !this._advancedMode;
    return this._advancedMode;
  }
  getAdvancedMode() {
    return this._advancedMode;
  }
  getChildren(element) {
    return new Promise((resolve, reject) => {
      (0, import_child_process.exec)("ros2 topic list", (error, stdout, stderr) => {
        if (error) {
          console.error(`Error fetching topics: ${error.message}`);
          return reject(error);
        }
        if (stderr) {
          console.error(`Error: ${stderr}`);
          return reject(new Error(stderr));
        }
        const topics = stdout.split("\n").filter((line) => line);
        const treeItems = topics.map((topic) => {
          const item = new vscode.TreeItem(topic, vscode.TreeItemCollapsibleState.None);
          item.command = {
            command: "ros2-topic-viewer.showMessages",
            title: "Show messages from ${topic}",
            arguments: [topic]
          };
          return item;
        });
        resolve(treeItems);
      });
    });
  }
  getTreeItem(element) {
    return element;
  }
};

// src/common.ts
var ext_name = "ros2-topic-viewer";
var ext_title = "ROS2 Topic Viewer";

// src/extension.ts
var import_child_process2 = require("child_process");
var import_child_process3 = require("child_process");
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
function activate(context) {
  const ros2TopicsProvider = new ROS2TopicsProvider();
  vscode2.window.registerTreeDataProvider("ros2TopicsView", ros2TopicsProvider);
  let panelList = [];
  const max_panels = 4;
  const new_disposable = vscode2.commands.registerCommand(`${ext_name}.refreshTopics`, () => {
    ros2TopicsProvider.refresh();
    vscode2.window.showInformationMessage(ext_title + ": Topics refreshed!");
  });
  const showMessagesDisposable = vscode2.commands.registerCommand(`${ext_name}.showMessages`, (topic) => {
    if (panelList.length >= max_panels) {
      vscode2.window.showErrorMessage("Reached maximum number of panels! Please close a panel to open a new one.");
      return;
    }
    let existingPanel = panelList.find((p) => p.title === `Messages for ${topic}`);
    if (existingPanel) {
      existingPanel.reveal(vscode2.ViewColumn.One);
      return;
    }
    const panel = vscode2.window.createWebviewPanel(
      "topicMessages",
      `Messages for ${topic}`,
      vscode2.ViewColumn.One,
      { enableScripts: true }
    );
    panelList.push(panel);
    showTopicMessages(topic, panel, panelList);
    if (ros2TopicsProvider.getAdvancedMode()) {
      showAdvancedMessages(topic, panel);
    }
  });
  const toggleAdvancedDisposable = vscode2.commands.registerCommand(`${ext_name}.toggleAdvanced`, () => {
    const advancedMode = ros2TopicsProvider.toggleAdvanced();
    if (advancedMode) {
      vscode2.window.showInformationMessage(ext_title + ": Advanced mode enabled! Close panels to apply.");
    } else {
      vscode2.window.showInformationMessage(ext_title + ": Advanced mode disabled! Close panels to apply.");
    }
  });
  context.subscriptions.push(new_disposable);
  context.subscriptions.push(showMessagesDisposable);
  context.subscriptions.push(toggleAdvancedDisposable);
}
async function updateInfoPanel(topic, panel) {
  if (panel.visible === false) {
    return;
  }
  const process_secundary = (0, import_child_process3.exec)("ros2 topic info " + topic + " --verbose");
  process_secundary.stdout?.on("data", (data) => {
    panel.webview.postMessage({ command: "pushInfo", message: data.toString() });
    process_secundary.kill();
  });
  process_secundary.stderr?.on("data", (data) => {
    console.error(`Error from process secundary: ${data}`);
    panel.webview.postMessage({ command: "error", message: data });
  });
}
async function showTopicMessages(topic, panel, panelList) {
  panel.onDidDispose(() => {
    console.log("Disposing panel");
    panelList.splice(panelList.indexOf(panel), 1);
    if (process) {
      process.kill("SIGCONT");
      process.kill("SIGTERM");
    }
    if (process_secundary) {
      process_secundary.kill("SIGCONT");
      process_secundary.kill("SIGTERM");
    }
  });
  panel.webview.html = getWebviewContent(topic);
  const process = (0, import_child_process2.spawn)("ros2", ["topic", "echo", topic]);
  const process_secundary = (0, import_child_process3.exec)("ros2 topic info " + topic + " --verbose");
  process.stdout?.on("data", (data) => {
    if (data.length > 1e4) {
      data = data.slice(0, 1e4);
      data = "Unable to visualize the entire message. The message is too big. \n\n";
      panel.webview.postMessage({ command: "error", message: data.toString() });
      return;
    }
    if (data.toString().includes("fastrtps_port")) {
      return;
    }
    panel.webview.postMessage({ command: "update", message: data.toString() });
  });
  process.stderr?.on("data", (data) => {
    console.error(`Error: ${data}`);
    panel.webview.postMessage({ command: "error", message: data });
  });
  process.on("exit", (code) => {
    console.log(`Process exited with code: ${code}`);
    panel.webview.postMessage({ command: "exit", message: `The command has exited with code ${code}.` });
  });
  process_secundary.stdout?.on("data", (data) => {
    if (data.toString().includes("fastrtps_port")) {
      return;
    }
    panel.webview.postMessage({ command: "pushInfo", message: data });
    process_secundary.kill();
  });
  process_secundary.stderr?.on("data", (data) => {
    console.error(`Error from process secundary: ${data}`);
    panel.webview.postMessage({ command: "error", message: data });
  });
  panel.onDidChangeViewState((event) => {
    if (event.webviewPanel.visible) {
      if (process) {
        process.kill("SIGCONT");
      }
      if (process_secundary) {
        process_secundary.kill("SIGCONT");
      }
      updateInfoPanel(topic, panel);
    } else {
      if (process) {
        process.kill("SIGSTOP");
      }
      if (process_secundary) {
        process_secundary.kill("SIGSTOP");
      }
    }
  });
  panel.webview.postMessage({ command: "hideAdvanced", message: "Advanced mode disabled!" });
}
async function showAdvancedMessages(topic, panel) {
  panel.webview.html = getWebviewContent(topic);
  const process = (0, import_child_process2.spawn)("ros2", ["topic", "hz", topic]);
  const process_secundary = (0, import_child_process2.spawn)("ros2", ["topic", "bw", topic]);
  panel.webview.postMessage({ command: "showAdvanced", message: "Advanced mode enabled!" });
  panel.onDidDispose(() => {
    if (process) {
      process.kill("SIGCONT");
      process.kill("SIGTERM");
    }
    if (process_secundary) {
      process_secundary.kill("SIGCONT");
      process_secundary.kill("SIGTERM");
    }
  });
  process.stdout?.on("data", (data) => {
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
  });
  process_secundary.stdout?.on("data", (data) => {
    if (data.toString().includes("fastrtps_port")) {
      return;
    }
    if (data.toString().includes("Subscribed")) {
      return;
    }
    panel.webview.postMessage({ command: "updateBw", message: data.toString() });
  });
  process_secundary.stderr?.on("data", (data) => {
    console.error(`Error: ${data}`);
    panel.webview.postMessage({ command: "error", message: data });
  });
  panel.onDidChangeViewState((event) => {
    if (event.webviewPanel.visible) {
      process.kill("SIGCONT");
      process_secundary.kill("SIGCONT");
      panel.webview.postMessage({ command: "showAdvanced", message: "Advanced mode enabled!" });
      return;
    } else {
      process.kill("SIGSTOP");
      process_secundary.kill("SIGSTOP");
    }
  });
}
function getWebviewContent(topic) {
  const htmlPath = path.join(__dirname, "..", "media", "webview.html");
  let htmlContent = fs.readFileSync(htmlPath, "utf8");
  htmlContent = htmlContent.replace("${topic}", topic);
  return htmlContent;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate
});
//# sourceMappingURL=extension.js.map
