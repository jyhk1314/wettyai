import { Terminal, IDecorationOptions, IDecoration, IMarker } from '@xterm/xterm';

export interface KeywordRule {
  pattern: string | RegExp;
  backgroundColor?: string;
  foregroundColor?: string;
  borderColor?: string;
  borderWidth?: string;
  borderRadius?: string;
  fontWeight?: string;
  description?: string;
}

export interface KeywordHighlightOptions {
  keywords: KeywordRule[];
  debounceMs?: number;
  maxDecorations?: number;
  enabled?: boolean;
}

interface InternalDecoration {
  decoration: IDecoration;
  marker: IMarker;
  startCol: number;
  endCol: number;
  line: number;
}

let styleInjected = false;

function injectStyles(): void {
  if (styleInjected) return;
  
  const style = document.createElement('style');
  style.id = 'wetty-keyword-highlight-styles';
  style.textContent = `
    .wetty-keyword-highlight {
      position: absolute;
      pointer-events: none;
      z-index: 1;
      mix-blend-mode: normal;
    }
  `;
  document.head.appendChild(style);
  styleInjected = true;
}

export class KeywordHighlightAddon {
  private terminal: Terminal | null = null;
  private options: KeywordHighlightOptions;
  private decorations: InternalDecoration[] = [];
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private disposables: (() => void)[] = [];
  private enabled: boolean = true;

  constructor(options?: Partial<KeywordHighlightOptions>) {
    this.options = {
      keywords: options?.keywords || [],
      debounceMs: options?.debounceMs ?? 100,
      maxDecorations: options?.maxDecorations ?? 500,
      enabled: options?.enabled ?? true,
    };
    this.enabled = this.options.enabled!;
  }

  activate(terminal: Terminal): void {
    this.terminal = terminal;
    injectStyles();
    
    const onDisposable = terminal.onData(() => {
      this.scheduleHighlight();
    });
    this.disposables.push(() => onDisposable.dispose());

    const onRenderDisposable = terminal.onRender(() => {
      this.scheduleHighlight();
    });
    this.disposables.push(() => onRenderDisposable.dispose());

    const onResizeDisposable = terminal.onResize(() => {
      this.clearAllDecorations();
      this.scheduleHighlight();
    });
    this.disposables.push(() => onResizeDisposable.dispose());

    const onScrollDisposable = terminal.onScroll(() => {
      this.scheduleHighlight();
    });
    this.disposables.push(() => onScrollDisposable.dispose());

    setTimeout(() => this.highlight(), 200);
  }

  dispose(): void {
    this.clearAllDecorations();
    this.disposables.forEach(d => d());
    this.disposables = [];
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.terminal = null;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.clearAllDecorations();
    } else {
      this.scheduleHighlight();
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setKeywords(keywords: KeywordRule[]): void {
    this.options.keywords = keywords;
    this.clearAllDecorations();
    this.scheduleHighlight();
  }

  getKeywords(): KeywordRule[] {
    return [...this.options.keywords];
  }

  addKeyword(keyword: KeywordRule): void {
    this.options.keywords.push(keyword);
    this.scheduleHighlight();
  }

  removeKeyword(pattern: string | RegExp): void {
    const patternStr = pattern.toString();
    this.options.keywords = this.options.keywords.filter(
      k => k.pattern.toString() !== patternStr
    );
    this.clearAllDecorations();
    this.scheduleHighlight();
  }

  private scheduleHighlight(): void {
    if (!this.enabled || !this.terminal) return;
    
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.highlight();
    }, this.options.debounceMs);
  }

  private clearAllDecorations(): void {
    for (const item of this.decorations) {
      try {
        item.decoration.dispose();
        item.marker.dispose();
      } catch {
        // ignore
      }
    }
    this.decorations = [];
  }

  private highlight(): void {
    if (!this.enabled || !this.terminal) return;

    const buffer = this.terminal.buffer.active;
    const cursorY = buffer.cursorY;
    const baseY = buffer.baseY;
    const viewportY = buffer.viewportY;
    const rows = this.terminal.rows;
    const cursorAbsoluteLine = baseY + cursorY;
    const extraScanAbove = 2;
    const extraScanBelow = 5;
    const scanStart = Math.max(0, viewportY - extraScanAbove);
    const scanEndExclusive = Math.min(
      buffer.length,
      viewportY + rows + extraScanBelow,
    );

    const oldDecorations = new Map<string, InternalDecoration>();
    for (const d of this.decorations) {
      oldDecorations.set(`${d.line}-${d.startCol}`, d);
    }

    const newDecorations: InternalDecoration[] = [];
    const matches: Array<{
      lineOffset: number;
      startCol: number;
      endCol: number;
      rule: KeywordRule;
      absoluteLine: number;
    }> = [];

    const nullCell = buffer.getNullCell?.();

    for (let absoluteLine = scanStart; absoluteLine < scanEndExclusive; absoluteLine++) {
      const line = buffer.getLine(absoluteLine);
      if (!line) continue;

      const { text: lineText, codeUnitToStartCol, codeUnitToEndCol } =
        translateLineToStringWithColMap(
          line,
          this.terminal.cols,
          nullCell,
        );
      if (!lineText) continue;

      for (const rule of this.options.keywords) {
        const pattern = typeof rule.pattern === 'string' 
          ? new RegExp(escapeRegex(rule.pattern), 'g')
          : new RegExp(rule.pattern.source, rule.pattern.flags.includes('g') ? rule.pattern.flags : rule.pattern.flags + 'g');

        let match;
        while ((match = pattern.exec(lineText)) !== null) {
          if (!match[0]) {
            pattern.lastIndex += 1;
            continue;
          }

          const startCodeUnitIndex = match.index;
          const endCodeUnitIndex = startCodeUnitIndex + match[0].length - 1;
          const mappedStartCol = codeUnitToStartCol[startCodeUnitIndex];
          const mappedEndCol = codeUnitToEndCol[endCodeUnitIndex];
          const startCol = mappedStartCol ?? startCodeUnitIndex;
          const endCol =
            mappedEndCol ?? startCol + match[0].length;
          const lineOffset = absoluteLine - cursorAbsoluteLine;
          matches.push({ lineOffset, startCol, endCol, rule, absoluteLine });
        }
      }
    }

    for (const match of matches) {
      const key = `${match.absoluteLine}-${match.startCol}`;
      const existing = oldDecorations.get(key);
      
      if (existing && existing.endCol === match.endCol) {
        newDecorations.push(existing);
        oldDecorations.delete(key);
        continue;
      }

      if (newDecorations.length >= this.options.maxDecorations!) {
        break;
      }

      const decoration = this.createDecoration(match.lineOffset, match.startCol, match.endCol - match.startCol, match.rule, match.absoluteLine);
      if (decoration) {
        newDecorations.push(decoration);
      }
    }

    for (const item of oldDecorations.values()) {
      try {
        item.decoration.dispose();
        item.marker.dispose();
      } catch {
        // ignore
      }
    }

    this.decorations = newDecorations;
  }

  private createDecoration(
    lineOffset: number,
    startCol: number,
    width: number,
    rule: KeywordRule,
    absoluteLine: number
  ): InternalDecoration | null {
    if (!this.terminal) return null;

    try {
      const marker = this.terminal.registerMarker(lineOffset);
      if (!marker) return null;

      const options: IDecorationOptions = {
        marker,
        anchor: 'left',
        x: startCol,
        width: Math.max(1, width),
        height: 1,
        layer: 'top',
      };

      const decoration = this.terminal.registerDecoration(options);
      if (!decoration) {
        marker.dispose();
        return null;
      }

      decoration.onRender((element: HTMLElement) => {
        element.classList.add('wetty-keyword-highlight');
        if (rule.backgroundColor) {
          element.style.backgroundColor = rule.backgroundColor;
        }
        if (rule.foregroundColor) {
          element.style.color = rule.foregroundColor;
        }
        if (rule.fontWeight) {
          element.style.fontWeight = rule.fontWeight;
        }

        // xterm 对视口外的行不设置 top，需要手动修正以确保高亮位置正确
        if (this.terminal) {
          const buffer = this.terminal.buffer.active;
          const viewportY = buffer.viewportY;
          const lineInViewport = absoluteLine - viewportY;
          // 通过已有的 width/height 反推 cellHeight
          const elHeight = parseFloat(element.style.height);
          if (!isNaN(elHeight) && elHeight > 0) {
            element.style.top = `${lineInViewport * elHeight}px`;
          }
        }
      });

      return {
        decoration,
        marker,
        startCol,
        endCol: startCol + width,
        line: absoluteLine,
      };
    } catch {
      return null;
    }
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function translateLineToStringWithColMap(
  line: any,
  cols: number,
  nullCell?: any,
): {
  text: string;
  codeUnitToStartCol: number[];
  codeUnitToEndCol: number[];
} {
  const codeUnitToStartCol: number[] = [];
  const codeUnitToEndCol: number[] = [];
  const parts: string[] = [];

  for (let x = 0; x < cols; x++) {
    const cell = line.getCell?.(x, nullCell);
    if (!cell) {
      parts.push(' ');
      codeUnitToStartCol.push(x);
      codeUnitToEndCol.push(x + 1);
      continue;
    }

    const width = Number(cell.getWidth?.() ?? 1);
    if (width === 0) continue;

    const chars = String(cell.getChars?.() ?? '');
    const content = chars || ' ';
    parts.push(content);

    for (const cp of content) {
      for (let i = 0; i < cp.length; i++) {
        codeUnitToStartCol.push(x);
        codeUnitToEndCol.push(x + width);
      }
    }
  }

  let text = parts.join('');
  while (text.endsWith(' ')) {
    text = text.slice(0, -1);
    codeUnitToStartCol.pop();
    codeUnitToEndCol.pop();
  }

  return { text, codeUnitToStartCol, codeUnitToEndCol };
}
