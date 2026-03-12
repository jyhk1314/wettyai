# WeTTY 开发手册

## 项目结构

```
wetty/
├── src/
│   ├── client/          # 前端代码
│   │   └── wetty/       # 客户端应用
│   │       ├── term/    # 终端组件
│   │       ├── socket.ts    # Socket.IO 连接
│   │       └── wetty.ts    # 主入口
│   ├── server/          # 后端代码
│   │   ├── command/     # 命令处理
│   │   ├── spawn/      # 进程管理
│   │   └── socketServer/   # Socket 服务器
│   └── shared/         # 共享代码
│       ├── config.ts   # 配置管理
│       └── logger.ts   # 日志
├── build/              # 编译输出
├── conf/               # 配置文件
└── tests/              # 测试代码
```

## 开发环境搭建

### 1. 克隆项目

```powershell
git clone https://github.com/butlerx/wetty.git
cd wetty
```

### 2. 安装依赖

```powershell
npm install --legacy-peer-deps --ignore-scripts
npm install sass-embedded --legacy-peer-deps
```

### 3. 编译原生模块 (Windows)

```powershell
$env:PYTHON = "D:\py39\python.exe"

# node-pty
cd node_modules\node-pty
npx node-gyp rebuild

# gc-stats
cd ..\gc-stats
npx node-gyp rebuild

cd ..\..
```

### 4. 构建项目

```powershell
# 编译服务端
npx tsc -p tsconfig.node.json

# 编译客户端
node build-client.js
```

### 5. 启动开发服务器

```powershell
npm run dev
# 或手动启动
node build/main.js --conf conf/config.json5 --port 3000 --command shell
```

## 代码规范

- 使用 TypeScript
- ESLint 检查代码风格
- 使用 ESM 模块格式

### 检查代码

```powershell
npm run lint
```

### 自动修复

```powershell
npm run lint:fix
```

## 核心模块说明

### 1. Socket.IO 通信

**客户端 → 服务端：**

| 事件 | 参数 | 说明 |
|------|------|------|
| `input` | `string` | 发送输入 |
| `resize` | `{cols, rows}` | 设置终端大小 |
| `commit` | `number` | 流量控制确认 |

**服务端 → 客户端：**

| 事件 | 参数 | 说明 |
|------|------|------|
| `data` | `string` | 终端输出 |
| `login` | - | 登录成功 |
| `logout` | - | 登出 |

### 2. 终端进程管理

`src/server/spawn.ts` 负责创建和管理 PTY 进程：

```typescript
// 关键代码
const isWindows = process.platform === 'win32';
const shell = isWindows ? process.env.COMSPEC || 'cmd.exe' : '/usr/bin/env';
const term = pty.spawn(shell, cmd, xterm);
```

### 3. 命令路由

`src/server/command.ts` 处理不同命令模式：

- `shell` - 本地 Shell
- `login` - SSH 登录
- `ssh` - SSH 连接

## API 使用示例

### 连接到 WeTTY

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000/wetty', {
  path: '/wetty/socket.io',
  transports: ['websocket', 'polling'],
});

// 监听输出
socket.on('data', (data) => {
  console.log(data);
});

// 发送命令
socket.emit('input', 'ls\r');

// 设置终端大小
socket.emit('resize', { cols: 80, rows: 24 });
```

### 运行测试脚本

```powershell
# 默认执行 claude
node tests/wetty-api-test.mjs

# 指定命令
$env:COMMAND = "dir"
node tests/wetty-api-test.mjs
```

## 调试技巧

### 1. 查看日志

服务启动后会输出 JSON 格式的日志：

```powershell
node build/main.js --conf conf/config.json5
```

### 2. 启用调试模式

```powershell
$env:DEBUG = "*"
node build/main.js --conf conf/config.json5
```

### 3. 浏览器开发者工具

- 打开 Chrome DevTools
- 访问 http://localhost:3000/wetty/
- 查看 Console 和 Network 面板

## 贡献代码

### 开发流程

1. Fork 项目
2. 创建特性分支：`git checkout -b feature/xxx`
3. 修改代码并测试
4. 运行 lint：`npm run lint`
5. 提交更改：`git commit -m 'Add xxx'`
6. 推送分支：`git push origin feature/xxx`
7. 创建 Pull Request

### 代码规范要求

- TypeScript 类型严格
- ESLint 检查通过
- 保持代码简洁
- 添加必要的注释

## 常见问题

### Windows 平台构建问题

**问题**: `spawn EINVAL`

**解决**: 使用 `cmd /c` 方式调用，或直接使用 `node-gyp` 编译原生模块

**问题**: Python distutils 错误

**解决**: 使用 Python 3.9 或安装 setuptools

### Socket 连接问题

**问题**: WebSocket 连接失败

**解决**: 
- 检查服务端是否运行
- 确认端口未被占用
- 尝试使用 `polling` 传输

### 终端显示问题

**问题**: 终端无响应

**解决**: 
- 检查 `--command` 参数
- Windows 上确认使用 `shell` 命令
- 检查防火墙设置
