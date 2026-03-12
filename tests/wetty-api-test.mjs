import { io } from 'socket.io-client';

const WETTY_URL = process.env.WETTY_URL || 'http://localhost:3000';
const SESSION_PATH = process.env.SESSION_PATH || '/wetty';
const COMMAND = process.env.COMMAND || 'claude';

function trim(str) {
  return str.replace(/\/*$/, '');
}

const socketPath = `${trim(SESSION_PATH)}/socket.io`;

console.log('='.repeat(60));
console.log('WeTTY API 测试脚本');
console.log('='.repeat(60));
console.log('连接 URL:', WETTY_URL);
console.log('Socket Path:', socketPath);
console.log('执行命令:', COMMAND);
console.log('='.repeat(60));

const socket = io(WETTY_URL, {
  path: socketPath,
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

let outputBuffer = '';
let commandSent = false;
let loginReceived = false;

socket.on('connect', () => {
  console.log('\n[状态] 已连接到 WeTTY 服务器');
  
  socket.emit('resize', { cols: 120, rows: 30 });
});

socket.on('login', () => {
  console.log('[状态] 终端已就绪');
  loginReceived = true;
  
  setTimeout(() => {
    if (!commandSent) {
      console.log('\n[发送] 命令:', COMMAND);
      socket.emit('input', COMMAND + '\r');
      commandSent = true;
    }
  }, 500);
});

socket.on('data', (data) => {
  outputBuffer += data;
  process.stdout.write(data);
  
  if (data.includes('Yes, proceed') || data.includes('1. Yes')) {
    setTimeout(() => {
      console.log('\n[发送] 按下回车确认');
      socket.emit('input', '\r');
    }, 500);
  }
});

socket.on('logout', () => {
  console.log('\n\n' + '='.repeat(60));
  console.log('[状态] 终端会话已结束');
  console.log('='.repeat(60));
  console.log('\n【完整输出内容】');
  console.log('-'.repeat(60));
  console.log(outputBuffer);
  console.log('-'.repeat(60));
  socket.disconnect();
  process.exit(0);
});

socket.on('disconnect', (reason) => {
  console.log('\n\n[状态] 断开连接:', reason);
  if (!commandSent) {
    console.log('\n【完整输出内容】');
    console.log('-'.repeat(60));
    console.log(outputBuffer);
    console.log('-'.repeat(60));
  }
  process.exit(0);
});

socket.on('connect_error', (error) => {
  console.error('\n[错误] 连接错误:', error.message);
});

setTimeout(() => {
  if (!commandSent && loginReceived) {
    console.log('\n[发送] 命令:', COMMAND);
    socket.emit('input', COMMAND + '\r');
    commandSent = true;
  }
}, 3000);

setTimeout(() => {
  if (outputBuffer.length === 0) {
    console.log('\n[警告] 未收到任何输出，可能连接失败');
    socket.disconnect();
    process.exit(1);
  }
}, 10000);

process.on('SIGINT', () => {
  console.log('\n\n【完整输出内容】(Ctrl+C 中断)');
  console.log('-'.repeat(60));
  console.log(outputBuffer);
  console.log('-'.repeat(60));
  socket.disconnect();
  process.exit(0);
});
