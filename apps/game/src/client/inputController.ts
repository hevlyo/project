export interface InputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
}

export interface KeyDownParams {
  key: string;
  code?: string;
  typing: boolean;
  hasModifier: boolean;
}

export type InputCommand =
  | 'none'
  | 'toggleFullscreen'
  | 'dash'
  | 'forwardOn'
  | 'forwardOff'
  | 'backwardOn'
  | 'backwardOff'
  | 'leftOn'
  | 'leftOff'
  | 'rightOn'
  | 'rightOff'
  | 'sprintOn'
  | 'sprintOff';

export interface KeyDownResult {
  command: InputCommand;
  preventDefault: boolean;
}

export function createInputState(): InputState {
  return {
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
  };
}

export function resetInputState(state: InputState): void {
  state.forward = false;
  state.backward = false;
  state.left = false;
  state.right = false;
  state.sprint = false;
}

export function resolveKeyDownCommand(params: KeyDownParams): KeyDownResult {
  const key = params.key;

  if (key.toLowerCase() === 'f' && !params.typing) {
    return { command: 'toggleFullscreen', preventDefault: true };
  }

  if (params.typing || params.hasModifier) {
    return { command: 'none', preventDefault: false };
  }

  switch (key) {
    case 'ArrowUp':
    case 'w':
    case 'W':
      return { command: 'forwardOn', preventDefault: true };
    case 'ArrowDown':
    case 's':
    case 'S':
      return { command: 'backwardOn', preventDefault: true };
    case 'ArrowLeft':
    case 'a':
    case 'A':
      return { command: 'leftOn', preventDefault: true };
    case 'ArrowRight':
    case 'd':
    case 'D':
      return { command: 'rightOn', preventDefault: true };
    case 'Shift':
      return { command: 'sprintOn', preventDefault: true };
    case ' ':
    case 'Spacebar':
      return { command: 'dash', preventDefault: true };
    default:
      if (params.code === 'Space') {
        return { command: 'dash', preventDefault: true };
      }
      return { command: 'none', preventDefault: false };
  }
}

export function resolveKeyUpCommand(key: string): InputCommand {
  switch (key) {
    case 'ArrowUp':
    case 'w':
    case 'W':
      return 'forwardOff';
    case 'ArrowDown':
    case 's':
    case 'S':
      return 'backwardOff';
    case 'ArrowLeft':
    case 'a':
    case 'A':
      return 'leftOff';
    case 'ArrowRight':
    case 'd':
    case 'D':
      return 'rightOff';
    case 'Shift':
      return 'sprintOff';
    default:
      return 'none';
  }
}

export function applyInputCommand(state: InputState, command: InputCommand): void {
  switch (command) {
    case 'forwardOn':
      state.forward = true;
      break;
    case 'forwardOff':
      state.forward = false;
      break;
    case 'backwardOn':
      state.backward = true;
      break;
    case 'backwardOff':
      state.backward = false;
      break;
    case 'leftOn':
      state.left = true;
      break;
    case 'leftOff':
      state.left = false;
      break;
    case 'rightOn':
      state.right = true;
      break;
    case 'rightOff':
      state.right = false;
      break;
    case 'sprintOn':
      state.sprint = true;
      break;
    case 'sprintOff':
      state.sprint = false;
      break;
    default:
      break;
  }
}
