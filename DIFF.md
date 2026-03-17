# Difflog

本文档记录当前仓库中由 **jetlin-sys** 提交的 5 个改造提交（按时间顺序：a2853e0、8fe8d86、aa27d7a、67a6563、b0b00a7）相对上游 wetty 的差异点。  
后续如有新的提交，应在本文件基础上继续追加说明。

---

## 一、提交 a2853e0 - feat: 添加Windows平台支持并改进路由处理

**整体说明：**  
为 WeTTY 添加 Windows 平台支持，改进路由与命令行逻辑，并补充部署/开发文档。

1. **build.js - 构建脚本 Windows 兼容**  
   - 调整 `spawn` 调用：在 Windows 平台下使用 `opts.shell = true`，并统一使用 `spawn(prog, args, opts)`，提升在 Windows 上执行 npm 脚本时的兼容性。

2. **src/server/command.ts - localhost 检测与命令构造增强**  
   - 改进 `localhost` 检测逻辑，显式考虑 Windows 平台（`process.platform === 'win32'`）的行为差异。  
   - 确保在 Windows 上本地登录 / SSH 命令构造符合预期。

3. **src/server/socketServer.ts - 路由与多会话支撑（基础版）**  
   - 在 socketServer 中增加更通用的路由匹配逻辑，为后续多会话（通过 URL 路径区分会话）提供基础能力。  

4. **src/server/spawn.ts - 进程生成逻辑重构**  
   - 针对 Windows 平台调整 shell / 命令调用方式，使 PTY 能在 Windows 上正确启动。  
   - 为后续 cwd 配置和多会话场景打下基础。

5. **package.json - 依赖与脚本更新（首轮）**  
   - 更新部分依赖版本（包括 `node-pty`、`sass-embedded` 等），以获得更好的 Windows 支持。  
   - 保持 build / start 等脚本与新的构建逻辑兼容。

6. **docs/deployment.md - 部署文档（新增）**  
   - 新增部署说明文档，介绍 WeTTY 在不同环境下的部署方式与注意事项。

7. **docs/development-guide.md - 开发文档（新增）**  
   - 新增开发指南文档，说明本地开发、构建、运行步骤，为后续改造提供文档支撑。

---

## 二、提交 8fe8d86 - feat: 支持多会话并更新依赖版本

**整体说明：**  
支持通过 URL 区分多会话，并为前端构建引入独立 ESBuild 脚本，顺带更新依赖。

1. **conf/config.json5 - 默认命令调整**  
   - 将默认 `command` 从 `login` 修改为 `'shell'`，更适合当前 Windows 环境使用。  

2. **build-client.js - 前端构建脚本（新增）**  
   - 新增基于 `esbuild` + `esbuild-sass-plugin` 的前端打包脚本：  
     - 入口为 `src/client/wetty.ts`，输出至 `build/client`。  
     - 支持打包 JS、CSS/SASS、字体和图片资源，提高前端构建效率。

3. **package-lock.json - 依赖锁定文件（新增）**  
   - 新增 `package-lock.json`，锁定项目依赖版本，保证安装行为可复现。

4. **package.json - 依赖与脚本更新（多会话相关）**  
   - 更新 Sass 相关依赖版本（如 `sass` / `sass-embedded`）到较新版本。  
   - 增加 / 调整与前端构建相关的脚本命令（使用 `build-client.js`）。

5. **src/client/wetty.ts - 前端入口支持多会话**  
   - 根据 URL 路径（如 `/wetty/<sessionId>`）区分不同会话，为多终端视图提供入口支持。  
   - 配合后端的多会话路由，为每个会话分配独立连接。

6. **src/client/wetty/socket.ts - Socket 层多会话适配**  
   - 调整 Socket.IO 连接逻辑，使其能够根据 URL 中的会话信息建立和管理多个终端会话。  
   - 为后续关键字高亮与测试桥接提供 socket 侧支撑。

---

## 三、提交 aa27d7a - test: 添加 WeTTY API 自动化测试脚本

**整体说明：**  
新增一个简单的 API 级自动化测试脚本，验证 WeTTY 终端服务基本可用性。

1. **tests/wetty-api-test.mjs - WeTTY API 自动化测试（新增）**  
   - 通过 Socket.IO 连接 WeTTY 终端服务器。  
   - 执行指定命令并捕获输出，用于验证终端服务的连通性和基本行为。  
   - 封装连接管理、命令发送与结果打印逻辑，方便在 CI 或本地快速自检。

---

## 四、提交 67a6563 - feat: 为终端添加关键字高亮功能

**整体说明：**  
在终端输出层面添加“关键字高亮”，并提供测试桥接工具与文档，方便多终端 / 高亮效果联调。

1. **.mocharc.json - 测试范围扩展**  
   - 将 `spec` 从 `["src/**/*.spec.*"]` 扩展为 `["src/**/*.spec.*", "tests/**/*.spec.*"]`，使 `tests` 目录下的测试（如关键字高亮）也能被 Mocha 统一执行。

2. **conf/config.json5 - keywordHighlight 配置（新增）**  
   - 在配置文件中新增 `keywordHighlight` 配置块，支持配置多组关键字及其高亮样式：  
     - 包含错误 / 成功 / 警告 / 信息 / 调试等多个类别的关键字。  
     - 每个关键字可以设置 `backgroundColor`、`description` 等属性，用于前端高亮显示。

3. **docs/development-guide.md - 测试程序启动说明**  
   - 在开发文档中追加测试程序启动命令示例：  
     - `node tests/wetty-api-test.mjs`  
     - `npx tsc tests/bridge-server.ts --outDir tests/build --esModuleInterop --module ESNext --target ES2020 --moduleResolution node --skipLibCheck`  
     - `node tests/build/bridge-server.js`  
   - 方便开发者一键跑通高亮与多终端相关的测试工具。

4. **src/shared/interfaces.ts - Config 类型扩展**  
   - 在公共配置类型中增加 `keywordHighlight` 字段及相关规则类型（如 `KeywordRule`），用于描述关键字高亮配置结构。  

5. **src/shared/config.ts - 加载关键字高亮配置**  
   - 在配置加载与合并逻辑中增加对 `keywordHighlight` 字段的处理。  
   - 确保从 `conf/config.json5` 读取到的高亮配置可以传递给服务端及前端。

6. **src/main.ts - CLI 与配置链路保持兼容**  
   - 在不破坏原有 CLI 行为的前提下，确保通过 `loadConfigFile` / `mergeCliConf` 得到的 `keywordHighlight` 配置能够正确设置到日志模块和服务启动逻辑中。

7. **src/server.ts - 服务启动携带高亮配置**  
   - 在 `start` / `decorateServerWithSsh` 中，将 `keywordHighlight` 配置传入 socketServer 层。  
   - 为前端终端获取高亮规则提供后端入口。

8. **src/server/socketServer.ts - 高亮配置透传与多会话支持增强**  
   - 扩展 socketServer 初始化逻辑，使其能将 `keywordHighlight` 配置传递给前端页面。  
   - 配合上一提交的多会话路径解析逻辑，支持多终端会话同时使用高亮能力。

9. **src/server/socketServer/html.ts - 挂载高亮与配置页面**  
   - 在服务器生成的 HTML 中嵌入 xterm 配置 iframe（`/client/xterm_config/index.html`），并确保前端能访问到关键字高亮等配置。  

10. **src/client/wetty/term.ts - 前端终端集成高亮**  
    - 在前端终端初始化逻辑中集成 `KeywordHighlightAddon`，将从后端获取的 `keywordHighlight` 配置应用到 xterm 实例上。  
    - 实现终端输出实时扫描与高亮。

11. **src/client/wetty/term/keyword-highlight.ts - 高亮核心实现（新增）**  
    - 提供关键字高亮核心逻辑（addon）：  
      - 根据关键字规则匹配终端输出行。  
      - 应用对应的背景色 / 字体样式。  
      - 支持增删高亮装饰，保持在滚动和更新时高亮效果正确。

12. **tests/bridge-client/index.html - 多终端测试前端页面（新增）**  
    - 作为多终端桥接测试工具的前端界面。  
    - 通过 Socket.IO 与 `tests/bridge-server.ts` 通信，展示多个会话的终端内容。

13. **tests/bridge-server.ts - 多终端测试桥接服务（新增）**  
    - 启动 Playwright 无头浏览器，连接多个 WeTTY 会话。  
    - 提供 Socket.IO 接口，供 `tests/bridge-client/index.html` 统一查看与控制多个终端。  

14. **tests/build/bridge-server.js - 编译后的测试服务（新增）**  
    - 由 `tests/bridge-server.ts` 编译生成，用于直接在 Node 环境中运行多终端桥接服务。

15. **tests/keyword-highlight.spec.ts - 关键字高亮测试（新增）**  
    - 为关键字高亮功能提供自动化测试用例，验证不同关键字与样式在终端中的渲染效果。

16. **package-lock.json / package.json - 依赖与脚本同步更新**  
    - 增加高亮相关依赖或类型支持。  
    - 确保测试脚本、构建脚本与新增测试工具对齐。

---

## 五、提交 b0b00a7 - feat: 添加新终端初始工作目录配置选项

**整体说明：**  
新增 `--cwd` 命令行参数与配置项，使新开终端可以在指定工作目录下启动，并扩展测试工具验证多工作目录场景。

1. **conf/config.json5 - 新增 cwd 示例**  
   - 在 `server` 段增加示例字段 `cwd`：用于指定新终端的初始工作目录（不设置时使用进程启动目录）。  
   - 继续保留前一提交中新增的 `keywordHighlight` 块。

2. **src/shared/interfaces.ts - Server 接口增加 cwd 字段**  
   - 在 `Server` 接口中加入 `cwd?: string`，为 cwd 配置提供类型定义。

3. **src/shared/config.ts - CLI 与配置合并支持 cwd**  
   - 在 `mergeCliConf` 中将 CLI 参数 `--cwd` 合并到 `server.cwd`，使命令行可覆盖配置文件中的默认工作目录。

4. **src/main.ts - CLI 新增 --cwd 参数**  
   - 在 yargs 配置中增加 `cwd` 选项，并将其纳入配置加载流程。  
   - 说明为 “Initial working directory for new terminal windows”。

5. **src/server.ts - 将 cwd 透传到 getCommand 与 spawn**  
   - 调用 `getCommand(socket, ssh, command, forcessh, serverConf.cwd)`，并在生成终端时执行 `spawn(socket, args, { cwd: serverConf.cwd })`。  
   - 形成从配置/CLI → serverConf → getCommand / spawn 的完整 cwd 传递链路。

6. **src/server/command.ts - getCommand 支持 cwd 参数**  
   - 函数签名扩展为 `getCommand(socket, ssh, command, forcessh, cwd?)`。  
   - 在 SSH 场景下，将 cwd 继续传递给 `address`。

7. **src/server/command/address.ts - address 支持 cwd 参数**  
   - 函数签名调整为 `address(socket, user, host, cwd?)`。  
   - 在需要交互登录时，调用 `login(socket, cwd)`，保证登录阶段终端也使用同一 cwd。

8. **src/server/login.ts - 登录终端支持自定义 cwd**  
   - `login` 函数签名改为 `login(socket, cwd?)`。  
   - 使用 `path.resolve(cwd ?? process.cwd())` 作为 PTY 的 `cwd`，使登录用户名输入终端与业务终端保持一致的工作目录。

9. **src/server/spawn.ts - PTY 启动支持 cwd**  
   - `spawn` 函数签名扩展为 `spawn(socket, args, options?: { cwd?: string })`。  
   - 使用 `path.resolve(options?.cwd ?? process.cwd())` 计算工作目录，并与 `xterm` 选项合并后传入 `pty.spawn`。

10. **build.js - 构建脚本微调（配合 Windows / shell 行为）**  
    - 继续完善 Windows 下的 shell 选项设置，确保在有/无 cwd 改造时构建脚本都能正常运行。

11. **tests/bridge-server.ts - 多 WeTTY 实例 + 不同 cwd 测试**  
    - 扩展测试桥接服务：  
      - 引入 `WETTY_TAB_CONFIG`，为多个 Tab 分配不同端口和对应工作目录。  
      - 通过在启动 WeTTY 实例时传入 `--cwd` 参数，验证每个会话的初始工作目录是否按预期工作。  
    - 用于回归验证新 cwd 配置在多会话场景下的正确性。

12. **tests/build/bridge-server.js - 编译产物同步更新**  
    - 反映上述 TypeScript 版本修改后的编译结果，保证直接运行 JS 版本测试服务也能覆盖 cwd 改造。

13. **package-lock.json - 依赖锁文件同步更新**  
    - 由于源码有变更，锁文件中相关条目也随之更新，保持依赖解析一致性。


