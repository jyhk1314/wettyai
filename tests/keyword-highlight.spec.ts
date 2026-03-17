import 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import { JSDOM } from 'jsdom';
import { KeywordHighlightAddon } from '../src/client/wetty/term/keyword-highlight';

describe('KeywordHighlightAddon', () => {
  function createLineFromCells(
    cols: number,
    cells: Array<{ chars: string; width: number }>,
  ) {
    return {
      getCell: (x: number) => {
        const cell = cells[x];
        if (!cell) return undefined;
        return {
          getChars: () => cell.chars,
          getWidth: () => cell.width,
        };
      },
    };
  }

  before(() => {
    const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>');
    (globalThis as any).window = dom.window;
    (globalThis as any).document = dom.window.document;
  });

  after(() => {
    delete (globalThis as any).window;
    delete (globalThis as any).document;
  });

  it('should scan visible lines based on viewportY', () => {
    const getLineCalls: number[] = [];

    const cols = 80;
    const cells = Array.from({ length: cols }, () => ({ chars: ' ', width: 1 }));
    'Something Error happened'.split('').forEach((ch, i) => {
      cells[i] = { chars: ch, width: 1 };
    });

    const buffer = {
      cursorY: 10,
      baseY: 100,
      viewportY: 50,
      length: 200,
      getNullCell: () => ({}),
      getLine: (lineIndex: number) => {
        getLineCalls.push(lineIndex);
        if (lineIndex !== 52) return undefined;
        return createLineFromCells(cols, cells);
      },
    };

    const markerDispose = sinon.spy();
    const registerMarkerSpy = sinon.spy((lineOffset: number) => ({
      id: 1,
      line: 0,
      lineOffset,
      dispose: markerDispose,
      onDispose: sinon.spy(),
      onTrim: sinon.spy(),
    }));

    const decorationDispose = sinon.spy();
    const registerDecorationSpy = sinon.spy(() => ({
      dispose: decorationDispose,
      onRender: (fn: (el: HTMLElement) => void) => {
        const el = document.createElement('div');
        fn(el);
      },
    }));

    const terminal = {
      rows: 20,
      cols,
      buffer: { active: buffer },
      registerMarker: registerMarkerSpy,
      registerDecoration: registerDecorationSpy,
    };

    const addon = new KeywordHighlightAddon({
      keywords: [{ pattern: 'Error', backgroundColor: 'rgba(6, 249, 75, 0.92)' }],
      debounceMs: 0,
    });

    (addon as any).terminal = terminal;
    (addon as any).enabled = true;
    (addon as any).highlight();

    expect(getLineCalls).to.include(50);
    expect(getLineCalls).to.include(52);
    expect(getLineCalls).to.not.include(100);

    const expectedLineOffset = 52 - (100 + 10);
    expect(registerMarkerSpy.calledWith(expectedLineOffset)).to.equal(true);
  });

  it('should map string match index to cell columns with wide chars', () => {
    const cols = 30;
    const text = '中文Error';

    const cells = Array.from({ length: cols }, () => ({ chars: ' ', width: 1 }));
    cells[0] = { chars: '中', width: 2 };
    cells[1] = { chars: '', width: 0 };
    cells[2] = { chars: '文', width: 2 };
    cells[3] = { chars: '', width: 0 };
    'Error'.split('').forEach((ch, i) => {
      cells[4 + i] = { chars: ch, width: 1 };
    });

    const buffer = {
      cursorY: 0,
      baseY: 0,
      viewportY: 0,
      length: 5,
      getNullCell: () => ({}),
      getLine: (lineIndex: number) => {
        if (lineIndex !== 0) return undefined;
        return createLineFromCells(cols, cells);
      },
    };

    const registerMarkerSpy = sinon.spy(() => ({
      id: 1,
      line: 0,
      dispose: sinon.spy(),
      onDispose: sinon.spy(),
      onTrim: sinon.spy(),
    }));

    const registerDecorationSpy = sinon.spy((options: any) => ({
      options,
      dispose: sinon.spy(),
      onRender: (fn: (el: HTMLElement) => void) => {
        const el = document.createElement('div');
        fn(el);
      },
    }));

    const terminal = {
      rows: 5,
      cols,
      buffer: { active: buffer },
      registerMarker: registerMarkerSpy,
      registerDecoration: registerDecorationSpy,
    };

    const addon = new KeywordHighlightAddon({
      keywords: [{ pattern: 'Error', backgroundColor: 'rgba(6, 249, 75, 0.92)' }],
      debounceMs: 0,
    });

    (addon as any).terminal = terminal;
    (addon as any).enabled = true;
    (addon as any).highlight();

    expect(registerDecorationSpy.called).to.equal(true);
    const call = registerDecorationSpy.getCall(0);
    expect(call.args[0].x).to.equal(4);
    expect(call.args[0].width).to.equal(5);
    expect(text.includes('Error')).to.equal(true);
  });
});
