import { spawn, execSync } from 'child_process';
import { chromium } from 'playwright';
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
/** 三个终端分别使用的端口与工作路径（使用 301x 避免与默认 3000 冲突导致复用已有 WeTTY） */
const WETTY_TAB_CONFIG = [
    { port: 3010, cwd: 'D:\\' },
    { port: 3011, cwd: 'D:\\github' },
    { port: 3012, cwd: 'D:\\github\\wettyai' },
];
class WeTTYTestBridge {
    constructor() {
        this.wettyProcesses = [];
        this.browser = null;
        this.expressServer = null;
        this.httpServer = null;
        this.io = null;
        this.bridgePort = 3100;
        this.tabs = new Map();
        this.pollingIntervals = new Map();
    }
    async start() {
        console.log('正在启动 WeTTY 多终端测试桥接服务...');
        await this.ensureWeTTYRunning();
        await this.startBrowser();
        await this.initAllTabs();
        await this.startExpressServer();
        console.log('所有服务启动完成！');
        console.log(`测试页面地址: http://localhost:${this.bridgePort}`);
        console.log('支持 3 个独立终端: Tab1 工作路径 D:, Tab2 D:\\github, Tab3 D:\\github\\wettyai');
    }
    isPortInUse(port) {
        try {
            const result = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, { encoding: 'utf-8' });
            return result.trim().length > 0;
        }
        catch {
            return false;
        }
    }
    async ensureWeTTYRunning() {
        const toStart = WETTY_TAB_CONFIG.filter(({ port }) => !this.isPortInUse(port));
        if (toStart.length === 0) {
            console.log('所有 WeTTY 端口已有服务运行，跳过启动');
            return;
        }
        console.log('正在启动 3 个 WeTTY 服务（不同工作路径）...');
        await Promise.all(WETTY_TAB_CONFIG.map(({ port, cwd }) => {
            if (this.isPortInUse(port)) {
                console.log(`端口 ${port} 已有服务，跳过`);
                return Promise.resolve();
            }
            return new Promise((resolve, reject) => {
                const proc = spawn('node', [
                    'build/main.js',
                    '--conf', 'conf/config.json5',
                    '--port', String(port),
                    '--cwd', cwd,
                ], {
                    cwd: process.cwd(),
                    stdio: 'pipe',
                });
                this.wettyProcesses.push(proc);
                proc.stdout?.on('data', (data) => {
                    const output = data.toString();
                    console.log(`[WeTTY:${port}]`, output);
                    if (output.includes('Server listening') || output.includes('Starting server')) {
                        setTimeout(resolve, 1500);
                    }
                });
                proc.stderr?.on('data', (data) => {
                    console.error(`[WeTTY:${port} Error]`, data.toString());
                });
                proc.on('error', (err) => {
                    console.error(`WeTTY 进程 ${port} 启动失败:`, err);
                    reject(err);
                });
                setTimeout(() => {
                    if (this.isPortInUse(port)) {
                        resolve();
                    }
                    else {
                        reject(new Error(`WeTTY 端口 ${port} 启动超时`));
                    }
                }, 12000);
            });
        }));
        console.log('所有 WeTTY 服务已就绪');
    }
    async startBrowser() {
        console.log('正在启动无头浏览器...');
        this.browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        console.log('无头浏览器启动完成');
    }
    async initAllTabs() {
        console.log('正在初始化 3 个终端会话...');
        for (let i = 1; i <= 3; i++) {
            await this.initTab(i);
        }
        console.log('所有终端会话初始化完成');
    }
    async initTab(tabId) {
        console.log(`正在初始化 Tab ${tabId}...`);
        if (!this.browser) {
            throw new Error('浏览器未启动');
        }
        const context = await this.browser.newContext({
            viewport: { width: 1200, height: 800 }
        });
        const page = await context.newPage();
        const { port, cwd } = WETTY_TAB_CONFIG[tabId - 1];
        const wettyPath = '/wetty/';
        const url = `http://localhost:${port}${wettyPath}`;
        console.log(`Tab ${tabId} 访问: ${url} (工作路径: ${cwd})`);
        await page.goto(url, { waitUntil: 'networkidle' });
        await page.waitForSelector('.xterm', { timeout: 10000 }).catch(() => {
            console.log(`Tab ${tabId}: 等待终端元素加载...`);
        });
        await page.waitForTimeout(2000);
        await page.waitForFunction(() => {
            return window.wetty_term !== undefined;
        }, { timeout: 15000 }).catch(() => {
            console.log(`Tab ${tabId}: 等待 wetty_term 初始化超时`);
        });
        const status = await page.evaluate(() => ({
            hasTerm: !!window.wetty_term,
            hasBuffer: !!window.wetty_term?.buffer?.active
        }));
        console.log(`Tab ${tabId} 终端初始化状态:`, status);
        this.tabs.set(tabId, {
            id: tabId,
            page,
            context,
            content: { html: '', text: '', timestamp: 0 },
            cursor: { x: 0, y: 0 },
            size: { cols: 80, rows: 24 }
        });
        this.startContentPolling(tabId);
        console.log(`Tab ${tabId} 初始化完成`);
    }
    startContentPolling(tabId) {
        const interval = setInterval(async () => {
            const tab = this.tabs.get(tabId);
            if (!tab || !tab.page)
                return;
            try {
                const terminalData = await tab.page.evaluate(() => {
                    const term = window.wetty_term;
                    if (!term) {
                        return { lines: ['等待终端初始化...'], cursorX: 0, cursorY: 0, cols: 80, rows: 24, error: 'term not found' };
                    }
                    try {
                        const buffer = term.buffer?.active;
                        if (!buffer) {
                            return { lines: ['buffer 未就绪'], cursorX: 0, cursorY: 0, cols: term.cols || 80, rows: term.rows || 24, error: 'buffer not ready' };
                        }
                        const lines = [];
                        const maxLines = Math.min(buffer.length, 100);
                        for (let i = 0; i < maxLines; i++) {
                            const line = buffer.getLine(i);
                            if (line) {
                                const text = line.translateToString(true);
                                lines.push(text);
                            }
                        }
                        let lastNonEmpty = lines.length - 1;
                        while (lastNonEmpty >= 0 && lines[lastNonEmpty].trim() === '') {
                            lastNonEmpty--;
                        }
                        const trimmedLines = lines.slice(0, lastNonEmpty + 1);
                        if (trimmedLines.length === 0) {
                            trimmedLines.push('(终端为空)');
                        }
                        return {
                            lines: trimmedLines,
                            cursorX: buffer.cursorX || 0,
                            cursorY: buffer.cursorY || 0,
                            cols: term.cols || 80,
                            rows: term.rows || 24
                        };
                    }
                    catch (e) {
                        return { lines: ['读取终端错误: ' + e.message], cursorX: 0, cursorY: 0, cols: 80, rows: 24, error: String(e) };
                    }
                });
                const text = terminalData.lines.join('\n');
                tab.content = {
                    html: '',
                    text: text.substring(0, 10000),
                    timestamp: Date.now()
                };
                tab.cursor = { x: terminalData.cursorX, y: terminalData.cursorY };
                tab.size = { cols: terminalData.cols, rows: terminalData.rows };
                this.io?.to(`tab-${tabId}`).emit('terminal-content', {
                    tabId,
                    ...tab.content,
                    cursor: tab.cursor,
                    size: tab.size
                });
            }
            catch (err) {
                console.error(`Tab ${tabId} 获取终端内容失败:`, err);
            }
        }, 500);
        this.pollingIntervals.set(tabId, interval);
    }
    async startExpressServer() {
        console.log('正在启动 Express 服务...');
        this.expressServer = express();
        this.httpServer = createServer(this.expressServer);
        this.io = new SocketIOServer(this.httpServer, {
            cors: { origin: '*' }
        });
        this.expressServer.use(express.static('tests/bridge-client'));
        this.expressServer.get('/api/tabs', (_req, res) => {
            const tabsInfo = Array.from(this.tabs.entries()).map(([id, tab]) => ({
                id,
                size: tab.size,
                lastUpdate: tab.content.timestamp
            }));
            res.json(tabsInfo);
        });
        this.expressServer.get('/api/terminal/:tabId', (req, res) => {
            const tabId = parseInt(req.params.tabId, 10);
            const tab = this.tabs.get(tabId);
            if (tab) {
                res.json({ ...tab.content, cursor: tab.cursor, size: tab.size });
            }
            else {
                res.status(404).json({ error: 'Tab not found' });
            }
        });
        this.io.on('connection', async (socket) => {
            console.log('客户端已连接:', socket.id);
            socket.emit('tabs-info', Array.from(this.tabs.keys()));
            socket.on('join-tab', (tabId) => {
                if (this.tabs.has(tabId)) {
                    socket.join(`tab-${tabId}`);
                    const tab = this.tabs.get(tabId);
                    socket.emit('terminal-content', {
                        tabId,
                        ...tab.content,
                        cursor: tab.cursor,
                        size: tab.size
                    });
                    console.log(`客户端 ${socket.id} 加入 Tab ${tabId}`);
                }
            });
            socket.on('leave-tab', (tabId) => {
                socket.leave(`tab-${tabId}`);
                console.log(`客户端 ${socket.id} 离开 Tab ${tabId}`);
            });
            socket.on('send-input', async (data) => {
                const tab = this.tabs.get(data.tabId);
                if (tab && tab.page && data.text) {
                    console.log(`Tab ${data.tabId} 发送输入:`, data.text);
                    await tab.page.keyboard.type(data.text);
                }
            });
            socket.on('send-key', async (data) => {
                const tab = this.tabs.get(data.tabId);
                if (tab && tab.page && data.key) {
                    console.log(`Tab ${data.tabId} 发送按键:`, data.key);
                    const keyMap = {
                        'enter': 'Enter',
                        'tab': 'Tab',
                        'escape': 'Escape',
                        'backspace': 'Backspace',
                        'delete': 'Delete',
                        'arrowup': 'ArrowUp',
                        'arrowdown': 'ArrowDown',
                        'arrowleft': 'ArrowLeft',
                        'arrowright': 'ArrowRight',
                        'home': 'Home',
                        'end': 'End',
                        'f1': 'F1', 'f2': 'F2', 'f3': 'F3', 'f4': 'F4',
                        'f5': 'F5', 'f6': 'F6', 'f7': 'F7', 'f8': 'F8',
                        'f9': 'F9', 'f10': 'F10', 'f11': 'F11', 'f12': 'F12',
                    };
                    const key = keyMap[data.key.toLowerCase()] || data.key;
                    await tab.page.keyboard.press(key);
                }
            });
            socket.on('send-ctrl', async (data) => {
                const tab = this.tabs.get(data.tabId);
                if (tab && tab.page && data.char) {
                    console.log(`Tab ${data.tabId} 发送 Ctrl 组合键:`, data.char);
                    await tab.page.keyboard.press(`Control+${data.char.toUpperCase()}`);
                }
            });
            socket.on('disconnect', () => {
                console.log('客户端已断开:', socket.id);
            });
        });
        return new Promise((resolve) => {
            this.httpServer?.listen(this.bridgePort, () => {
                console.log(`Express 服务启动在端口 ${this.bridgePort}`);
                resolve();
            });
        });
    }
    async stop() {
        console.log('正在停止所有服务...');
        for (const [tabId, interval] of this.pollingIntervals) {
            clearInterval(interval);
            console.log(`Tab ${tabId} 轮询已停止`);
        }
        this.pollingIntervals.clear();
        for (const [tabId, tab] of this.tabs) {
            await tab.page?.close();
            await tab.context?.close();
            console.log(`Tab ${tabId} 已关闭`);
        }
        this.tabs.clear();
        this.io?.close();
        this.httpServer?.close();
        await this.browser?.close();
        for (const proc of this.wettyProcesses) {
            proc.kill();
        }
        this.wettyProcesses = [];
        console.log('所有服务已停止');
    }
}
async function main() {
    const bridge = new WeTTYTestBridge();
    process.on('SIGINT', async () => {
        await bridge.stop();
        process.exit(0);
    });
    process.on('SIGTERM', async () => {
        await bridge.stop();
        process.exit(0);
    });
    try {
        await bridge.start();
    }
    catch (err) {
        console.error('启动失败:', err);
        await bridge.stop();
        process.exit(1);
    }
}
main();
