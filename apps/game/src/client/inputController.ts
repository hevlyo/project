export type InputState = {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  sprint: boolean;
}

export type KeyDownParams = {
  key: string;
  code?: string;
  typing: boolean;
  hasModifier: boolean;
}

export type InputCommand
  = | 'none'
  	| 'toggleFullscreen'
  	| 'toggleFreeCamera'
  	| 'dash'
  	| 'forwardOn'
  	| 'forwardOff'
  	| 'backwardOn'
  	| 'backwardOff'
  	| 'leftOn'
  	| 'leftOff'
  	| 'rightOn'
  	| 'rightOff'
  	| 'upOn'
  	| 'upOff'
  	| 'downOn'
  	| 'downOff'
  	| 'sprintOn'
  	| 'sprintOff';

export type KeyDownResult = {
  command: InputCommand;
  preventDefault: boolean;
}

export function createInputState(): InputState {
  return {
    forward: false,
    backward: false,
    left: false,
    right: false,
    up: false,
    down: false,
    sprint: false,
  };
}

export function resetInputState(state: InputState): void {
  state.forward = false;
  state.backward = false;
  state.left = false;
  state.right = false;
  state.up = false;
  state.down = false;
  state.sprint = false;
}

export function resolveKeyDownCommand(parameters: KeyDownParams): KeyDownResult {
  const {key} = parameters;

  if (key.toLowerCase() === 'f' && !parameters.typing) {
    return { command: 'toggleFullscreen', preventDefault: true };
  }

  if (key.toLowerCase() === 'c' && !parameters.typing) {
    return { command: 'toggleFreeCamera', preventDefault: true };
  }

  if (parameters.typing || parameters.hasModifier) {
    return { command: 'none', preventDefault: false };
  }

  switch (key) {
    case 'ArrowUp':
    case 'w':
    case 'W': {
      return { command: 'forwardOn', preventDefault: true };
    }

    case 'ArrowDown':
    case 's':
    case 'S': {
      return { command: 'backwardOn', preventDefault: true };
    }

    case 'ArrowLeft':
    case 'a':
    case 'A': {
      return { command: 'leftOn', preventDefault: true };
    }

    case 'ArrowRight':
    case 'd':
    case 'D': {
      return { command: 'rightOn', preventDefault: true };
    }

    case 'Shift': {
      return { command: 'sprintOn', preventDefault: true };
    }

    case 'q':
    case 'Q': {
      return { command: 'upOn', preventDefault: true };
    }

    case 'e':
    case 'E': {
      return { command: 'downOn', preventDefault: true };
    }

    case ' ':
    case 'Spacebar': {
      return { command: 'dash', preventDefault: true };
    }

    default: {
      if (parameters.code === 'Space') {
        return { command: 'dash', preventDefault: true };
      }

      return { command: 'none', preventDefault: false };
    }
  }
}

export function resolveKeyUpCommand(key: string): InputCommand {
  switch (key) {
    case 'ArrowUp':
    case 'w':
    case 'W': {
      return 'forwardOff';
    }

    case 'ArrowDown':
    case 's':
    case 'S': {
      return 'backwardOff';
    }

    case 'ArrowLeft':
    case 'a':
    case 'A': {
      return 'leftOff';
    }

    case 'ArrowRight':
    case 'd':
    case 'D': {
      return 'rightOff';
    }

    case 'Shift': {
      return 'sprintOff';
    }

    case 'q':
    case 'Q': {
      return 'upOff';
    }

    case 'e':
    case 'E': {
      return 'downOff';
    }

    default: {
      return 'none';
    }
  }
}

export function applyInputCommand(state: InputState, command: InputCommand): void {
  switch (command) {
    case 'forwardOn': {
      state.forward = true;
      break;
    }

    case 'forwardOff': {
      state.forward = false;
      break;
    }

    case 'backwardOn': {
      state.backward = true;
      break;
    }

    case 'backwardOff': {
      state.backward = false;
      break;
    }

    case 'leftOn': {
      state.left = true;
      break;
    }

    case 'leftOff': {
      state.left = false;
      break;
    }

    case 'rightOn': {
      state.right = true;
      break;
    }

    case 'rightOff': {
      state.right = false;
      break;
    }

    case 'upOn': {
      state.up = true;
      break;
    }

    case 'upOff': {
      state.up = false;
      break;
    }

    case 'downOn': {
      state.down = true;
      break;
    }

    case 'downOff': {
      state.down = false;
      break;
    }

    case 'sprintOn': {
      state.sprint = true;
      break;
    }

    case 'sprintOff': {
      state.sprint = false;
      break;
    }

    default: {
      break;
    }
  }
}
