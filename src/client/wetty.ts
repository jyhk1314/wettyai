import { dom, library } from '@fortawesome/fontawesome-svg-core';
import { faCogs, faKeyboard } from '@fortawesome/free-solid-svg-icons';
import _ from 'lodash';

import '../assets/scss/styles.scss';

import { disconnect } from './wetty/disconnect';
import { overlay } from './wetty/disconnect/elements';
import { verifyPrompt } from './wetty/disconnect/verify';
import { FileDownloader } from './wetty/download';
import { FlowControlClient } from './wetty/flowcontrol';
import { mobileKeyboard } from './wetty/mobile';
import { socket } from './wetty/socket';
import { terminal, Term } from './wetty/term';

// Setup for fontawesome
library.add(faCogs);
library.add(faKeyboard);
dom.watch();

// 根据URL路径设置不同的背景颜色
function setSessionBackgroundColor(): void {
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  const lastPart = pathParts[pathParts.length - 1];
  const sessionNum = parseInt(lastPart, 10);

  const colorMap: Record<number, string> = {
    1: '#1a1a2e',  // 深蓝紫
    2: '#16213e',  // 深蓝
    3: '#0f3460',  // 海军蓝
    4: '#1b4332',  // 深绿
    5: '#2d3436',  // 深灰
    6: '#2c1810',  // 深棕
    7: '#1a1a1a',  // 纯黑
    8: '#0d1b2a',  // 深海蓝
    9: '#1c1c1c',  // 暗灰
  };

  if (!isNaN(sessionNum) && sessionNum >= 1) {
    const color = colorMap[sessionNum] || '#000000';
    document.documentElement.style.setProperty('--session-bg', color);
    document.body.style.backgroundColor = color;
  }
}

setSessionBackgroundColor();

function onResize(term: Term): () => void {
  return function resize() {
    term.resizeTerm();
  };
}

socket.on('connect', () => {
  const term = terminal(socket);
  if (_.isUndefined(term)) return;

  if (!_.isNull(overlay)) overlay.style.display = 'none';
  window.addEventListener('beforeunload', verifyPrompt, false);
  window.addEventListener('resize', onResize(term), false);

  term.resizeTerm();
  term.focus();
  mobileKeyboard();
  const fileDownloader = new FileDownloader();
  const fcClient = new FlowControlClient();

  term.onData((data: string) => {
    socket.emit('input', data);
  });
  term.onResize((size: { cols: number; rows: number }) => {
    socket.emit('resize', size);
  });
  socket
    .on('data', (data: string) => {
      const remainingData = fileDownloader.buffer(data);
      const downloadLength = data.length - remainingData.length;
      if (downloadLength && fcClient.needsCommit(downloadLength)) {
        socket.emit('commit', fcClient.ackBytes);
      }
      if (remainingData) {
        if (fcClient.needsCommit(remainingData.length)) {
          term.write(remainingData, () =>
            socket.emit('commit', fcClient.ackBytes),
          );
        } else {
          term.write(remainingData);
        }
      }
    })
    .on('login', () => {
      term.writeln('');
      term.resizeTerm();
    })
    .on('logout', disconnect)
    .on('disconnect', disconnect)
    .on('error', (err: string | null) => {
      if (err) disconnect(err);
    });
});
