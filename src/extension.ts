import * as vscode from 'vscode';

import { ROS2TopicsProvider } from './topicProvider';
import { spawn } from 'child_process';
import { exec } from 'child_process';

import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    const ros2TopicsProvider = new ROS2TopicsProvider();
    vscode.window.registerTreeDataProvider('ros2TopicsView', ros2TopicsProvider);

    console.log('Extension "ros2-topic-viewer" is now active!');

    let panelList: vscode.WebviewPanel[] = [];

    const new_disposable = vscode.commands.registerCommand('ros2-topic-viewer.refreshTopics', () => {
        ros2TopicsProvider.refresh();
        vscode.window.showInformationMessage('Topics refreshed!');
    });

    const showMessagesDisposable = vscode.commands.registerCommand('ros2-topic-viewer.showMessages', (topic: string) => {
        
        let existingPanel = panelList.find(p => p.title === `Messages for ${topic}`);

        if (existingPanel) {

            existingPanel.reveal(vscode.ViewColumn.One);
            return;

        }
        
        const panel = vscode.window.createWebviewPanel(
            'topicMessages',
            `Messages for ${topic}`,
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        panelList.push(panel);
        showTopicMessages(topic, panel, panelList);
        showAdvancedMessages(topic, panel);
        
    });

    context.subscriptions.push(new_disposable);
    context.subscriptions.push(showMessagesDisposable);
}

async function updateInfoPanel(topic: string, panel: vscode.WebviewPanel) {

    if(panel.visible === false) {
        return;
    }

    const process_secundary = exec('ros2 topic info ' + topic + ' --verbose');

    process_secundary.stdout?.on('data', (data) => {

        panel.webview.postMessage({ command: 'pushInfo', message: data.toString() });
        process_secundary.kill();

    });

    process_secundary.stderr?.on('data', (data) => {

        console.error(`Error from process secundary: ${data}`);
        panel.webview.postMessage({ command: 'error', message: data });

    });
}

async function showTopicMessages(topic: string, panel: vscode.WebviewPanel, panelList: vscode.WebviewPanel[]) {

	panel.onDidDispose(() => {

        panelList.splice(panelList.indexOf(panel), 1);

		if (process){
			process.kill();
		}

	});


    panel.webview.html = getWebviewContent(topic);

    let process = spawn('ros2', ['topic', 'echo', topic]);
	const process_secundary = exec('ros2 topic info ' + topic + ' --verbose');

    process.stdout?.on('data', (data) => {

        //if data is too big, truncate it:
        if (data.length > 10000) {
            data = data.slice(0, 10000);
            data = 'Unable to visualize the entire message. The message is too big. \n\n';
            panel.webview.postMessage({ command: 'error', message: data.toString() });
            // process.kill();
            return
        }

        panel.webview.postMessage({ command: 'update', message: data.toString() });

    });

    process.stderr?.on('data', (data) => {

        console.error(`Error: ${data}`);
        panel.webview.postMessage({ command: 'error', message: data });

    });

    process.on('exit', (code) => {

        console.log(`Process exited with code: ${code}`);
        panel.webview.postMessage({ command: 'exit', message: `The command has exited with code ${code}.` });
        // panel.dispose();

    });

	process_secundary.stdout?.on('data', (data) => {
    
		panel.webview.postMessage({ command: 'pushInfo', message: data });
		process_secundary.kill();

	});

    process_secundary.stderr?.on('data', (data) => {

        console.error(`Error from process secundary: ${data}`);
        panel.webview.postMessage({ command: 'error', message: data });

    });

    panel.onDidChangeViewState((event) => {

        if (event.webviewPanel.visible) {
            process.kill();
        }

        if (event.webviewPanel.visible) {
            process = spawn('ros2', ['topic', 'echo', topic]);
            updateInfoPanel(topic, panel);
        }});
            
}

async function showAdvancedMessages(topic: string, panel: vscode.WebviewPanel) {

    panel.webview.html = getWebviewContent(topic);
    const process = spawn('ros2', ['topic', 'hz', topic]);
    const process_secundary = spawn('ros2', ['topic', 'bw', topic]);

    process.stdout?.on('data', (data) => {
        console.log(`Data: ${data}`);
        panel.webview.postMessage({ command: 'updateHz', message: data.toString() });

    });

    process.stderr?.on('data', (data) => {

        console.error(`Error: ${data}`);
        panel.webview.postMessage({ command: 'error', message: data });

    });

    process.on('exit', (code) => {

        console.log(`Process exited with code: ${code}`);
        panel.webview.postMessage({ command: 'exit', message: `The command has exited with code ${code}.` });
        // panel.dispose();

    });

    process_secundary.stdout?.on('data', (data) => {
    
        // console.log(`Data: ${data}`);
        if(data.toString().includes('Subscribed')) { return; }
        panel.webview.postMessage({ command: 'updateBw', message: data.toString() });

    });

    process_secundary.stderr?.on('data', (data) => {

        console.error(`Error: ${data}`);
        panel.webview.postMessage({ command: 'error', message: data });

    });

}

function getWebviewContent(topic: string): string {
    const htmlPath = path.join(__dirname,'..', 'media', 'webview.html');
    let htmlContent = fs.readFileSync(htmlPath, 'utf8');
    htmlContent = htmlContent.replace('${topic}', topic);
    return htmlContent;
}
