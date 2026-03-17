import type winston from 'winston';

export interface KeywordRule {
  pattern: string;
  backgroundColor?: string;
  foregroundColor?: string;
  borderColor?: string;
  borderWidth?: string;
  borderRadius?: string;
  fontWeight?: string;
  description?: string;
}

export interface KeywordHighlightConfig {
  enabled?: boolean;
  keywords?: KeywordRule[];
}

export interface SSH {
  [s: string]: string | number | boolean | undefined;
  user: string;
  host: string;
  auth: string;
  port: number;
  knownHosts: string;
  allowRemoteHosts: boolean;
  allowRemoteCommand: boolean;
  pass?: string;
  key?: string;
  config?: string;
}

export interface SSL {
  key: string;
  cert: string;
}

export interface SSLBuffer {
  key?: Buffer;
  cert?: Buffer;
}

export interface Server {
  [s: string]: string | number | boolean | undefined;
  port: number;
  host: string;
  socket: string | boolean;
  title: string;
  base: string;
  allowIframe: boolean;
  /** 新开终端时的初始工作目录，不设则使用进程启动目录 */
  cwd?: string;
}

export interface Config {
  ssh: SSH;
  server: Server;
  forceSSH: boolean;
  command: string;
  logLevel: typeof winston.level;
  ssl?: SSL;
  keywordHighlight?: KeywordHighlightConfig;
}
