import { describe, expect, test } from 'vitest';
import {
  applyInputCommand,
  createInputState,
  resolveKeyDownCommand,
  resolveKeyUpCommand,
  resetInputState,
} from './inputController.js';

describe('inputController', () => {
  test('resolves fullscreen shortcut even outside gameplay keys', () => {
    const result = resolveKeyDownCommand({
      key: 'f',
      typing: false,
      hasModifier: false,
    });

    expect(result).toEqual({ command: 'toggleFullscreen', preventDefault: true });
  });

  test('ignores movement shortcuts while typing', () => {
    const result = resolveKeyDownCommand({
      key: 'w',
      typing: true,
      hasModifier: false,
    });

    expect(result).toEqual({ command: 'none', preventDefault: false });
  });

  test('maps movement and sprint press/release', () => {
    const state = createInputState();

    applyInputCommand(state, resolveKeyDownCommand({ key: 'w', typing: false, hasModifier: false }).command);
    applyInputCommand(state, resolveKeyDownCommand({ key: 'Shift', typing: false, hasModifier: false }).command);

    expect(state.forward).toBe(true);
    expect(state.sprint).toBe(true);

    applyInputCommand(state, resolveKeyUpCommand('w'));
    applyInputCommand(state, resolveKeyUpCommand('Shift'));

    expect(state.forward).toBe(false);
    expect(state.sprint).toBe(false);
  });

  test('maps spacebar variations to dash command', () => {
    const first = resolveKeyDownCommand({ key: ' ', typing: false, hasModifier: false });
    const second = resolveKeyDownCommand({ key: 'Unknown', code: 'Space', typing: false, hasModifier: false });

    expect(first.command).toBe('dash');
    expect(second.command).toBe('dash');
    expect(first.preventDefault).toBe(true);
    expect(second.preventDefault).toBe(true);
  });

  test('resets all key flags', () => {
    const state = createInputState();
    state.forward = true;
    state.backward = true;
    state.left = true;
    state.right = true;
    state.sprint = true;

    resetInputState(state);

    expect(state).toEqual({
      forward: false,
      backward: false,
      left: false,
      right: false,
      sprint: false,
    });
  });
});
