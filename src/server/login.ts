import path from 'path';
import { fileURLToPath } from 'url';
import pty from 'node-pty';
import { xterm } from './shared/xterm.js';
import type SocketIO from 'socket.io';

const executable = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'buffer.js',
);

export function login(socket: SocketIO.Socket, cwd?: string): Promise<string> {
  // Request carries no username information
  // Create terminal and ask user for username
  const resolvedCwd = path.resolve(cwd ?? process.cwd());
  const ptyOptions = { ...xterm, cwd: resolvedCwd };
  const term = pty.spawn('/usr/bin/env', ['node', executable], ptyOptions);
  let buf = '';
  return new Promise((resolve, reject) => {
    term.onExit(({ exitCode }) => {
      console.error(`Process exited with code: ${exitCode}`);
      resolve(buf);
    });
    term.onData((data: string) => {
      socket.emit('data', data);
    });
    socket
      .on('input', (input: string) => {
        term.write(input);
        // eslint-disable-next-line no-control-regex
        buf = /\x0177/.exec(input) ? buf.slice(0, -1) : buf + input;
      })
      .on('disconnect', () => {
        term.kill();
        reject();
      });
  });
}
