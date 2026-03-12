# WeTTY 部署手册

## 简介

WeTTY (Web + TTY) 是一个基于浏览器的终端模拟器，允许用户通过 Web 界面访问 SSH 或本地 Shell。

## 环境要求

- Node.js >= 18.0.0
- npm 或 pnpm
- Windows / Linux / macOS

## 安装部署

### 方式一：npm 安装

```powershell
# 克隆项目
git clone https://github.com/butlerx/wetty.git
cd wetty

# 安装依赖
npm install --legacy-peer-deps --ignore-scripts

# 安装 sass-embedded (用于 SCSS 编译)
npm install sass-embedded --legacy-peer-deps
```

### 方式二：Docker 部署

```powershell
# 使用 docker-compose
docker-compose up -d
```

## 编译构建

### 服务端编译

```powershell
npx tsc -p tsconfig.node.json
```

### 客户端编译

```powershell
node build-client.js
```

或使用完整构建脚本：

```powershell
npm run build
```

## 配置

### 配置文件位置

主配置文件：`conf/config.json5`

### 常用配置项

```json5
{
  ssh: {
    host: "localhost",      // SSH 服务器地址
    port: 22,              // SSH 端口
    auth: "password",      // 认证方式: password 或 publickey
  },
  server: {
    base: "/wetty/",       // URL 基础路径
    port: 3000,           // 服务端口
    host: "0.0.0.0",     // 监听地址
  },
  forceSSH: false,
  command: "shell"         // shell 或 login
}
```

## 启动服务

### 基本启动

```powershell
node build/main.js --conf conf/config.json5 --port 3000
```

### 指定 Shell 命令

```powershell
# 使用 PowerShell (Windows)
node build/main.js --command shell

# 使用 SSH 登录
node build/main.js --command login
```

### 使用自定义配置

```powershell
node build/main.js --conf /path/to/config.json5
```

## 访问地址

- 本地访问：`http://localhost:3000/wetty/`
- 多终端会话：`http://localhost:3000/wetty/1`、`http://localhost:3000/wetty/2`

## Windows 平台特殊说明

### 原生模块编译

在 Windows 上，需要编译 `node-pty` 和 `gc-stats` 原生模块：

```powershell
# 设置 Python 路径 (使用 Python 3.9)
$env:PYTHON = "D:\py39\python.exe"

# 编译 node-pty
cd node_modules\node-pty
npx node-gyp rebuild

# 编译 gc-stats
cd ..\gc-stats
npx node-gyp rebuild
```

### Shell 模式

Windows 上使用 `shell` 命令时，需要确保配置正确：

```powershell
node build/main.js --command shell --force-ssh false
```

## HTTPS 配置

编辑配置文件启用 SSL：

```json5
{
  ssl: {
    key: "ssl.key",
    cert: "ssl.cert"
  }
}
```

## 反向代理 (Nginx)

参考 `conf/nginx.template` 配置 Nginx 反向代理。

## 常见问题

### 端口被占用

```powershell
# 查看端口占用
netstat -ano | Select-String ":3000"

# 停止进程
Stop-Process -Id <PID> -Force
```

### 无法输入

- 确认 SSH 服务器正在运行
- Windows 上使用 `--command shell` 参数
- 检查防火墙设置

### WebSocket 连接失败

确保反向代理支持 WebSocket 协议。
