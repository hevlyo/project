function setToneClass(element, tone) {
  if (!element) return;
  element.dataset.tone = tone;
}

export function createUIController(elements) {
  const state = {
    toastTimer: null,
    pickupTimer: null,
    instructionTimer: null,
    instructionHideTimer: null,
    killfeedTimers: new Set(),
  };

  function bindStart(handler) {
    elements.playButton.addEventListener('click', handler);
    elements.nicknameInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        handler();
      }
    });
  }

  function getNickname() {
    return elements.nicknameInput.value;
  }

  function setNickname(value) {
    elements.nicknameInput.value = value;
  }

  function focusNickname() {
    elements.nicknameInput.focus();
    elements.nicknameInput.select();
  }

  function setMenuBusy(isBusy, buttonLabel = 'Entrar na pocilga') {
    elements.playButton.disabled = isBusy;
    elements.nicknameInput.disabled = isBusy;
    elements.playButton.textContent = buttonLabel;
  }

  function setMenuStatus(text, tone = 'idle') {
    elements.menuStatus.textContent = text;
    setToneClass(elements.menuStatus, tone);
  }

  function showMenu() {
    elements.menuScreen.hidden = false;
    elements.menuScreen.classList.remove('is-hidden');
  }

  function hideMenu() {
    elements.menuScreen.classList.add('is-hidden');
    window.setTimeout(() => {
      if (elements.menuScreen.classList.contains('is-hidden')) {
        elements.menuScreen.hidden = true;
      }
    }, 220);
  }

  function setHUDVisible(visible) {
    elements.hud.hidden = !visible;
  }

  function setConnectionState(text, tone = 'live') {
    if (!elements.connectionBadge) return;
    elements.connectionBadge.textContent = text;
    setToneClass(elements.connectionBadge, tone);
  }

  function updateHUD({ score, playerCount, leaderboard, localPlayerId, statusLine, statusChip }) {
    elements.scoreValue.textContent = String(score);
    elements.playerCountValue.textContent = String(playerCount);
    elements.statusLine.textContent = statusLine;

    if (elements.statusChip) {
      if (statusChip?.label) {
        elements.statusChip.hidden = false;
        elements.statusChip.textContent = statusChip.label;
        setToneClass(elements.statusChip, statusChip.tone || 'live');
      } else {
        elements.statusChip.hidden = true;
        elements.statusChip.textContent = '';
      }
    }

    elements.leaderboard.innerHTML = '';

    if (!leaderboard.length) {
      const empty = document.createElement('li');
      empty.className = 'leaderboard-entry';
      empty.textContent = 'Nenhum miserável no placar ainda.';
      elements.leaderboard.appendChild(empty);
      return;
    }

    leaderboard.forEach((player, index) => {
      const item = document.createElement('li');
      item.className = 'leaderboard-entry';
      if (player.id === localPlayerId) {
        item.dataset.local = 'true';
      }

      const place = document.createElement('span');
      place.className = 'leaderboard-rank';
      place.textContent = `${index + 1}.`;

      const name = document.createElement('span');
      name.className = 'leaderboard-name';
      name.textContent = player.nickname;

      const points = document.createElement('span');
      points.className = 'leaderboard-score';
      points.textContent = `${player.score}`;

      item.append(place, name, points);
      elements.leaderboard.appendChild(item);
    });
  }

  function showToast(text, tone = 'info', duration = 2200) {
    elements.toast.textContent = text;
    elements.toast.hidden = false;
    elements.toast.classList.add('is-visible');
    setToneClass(elements.toast, tone);

    if (state.toastTimer) {
      window.clearTimeout(state.toastTimer);
    }

    state.toastTimer = window.setTimeout(() => {
      elements.toast.classList.remove('is-visible');
      window.setTimeout(() => {
        if (!elements.toast.classList.contains('is-visible')) {
          elements.toast.hidden = true;
        }
      }, 180);
    }, duration);
  }

  function hideToast() {
    if (state.toastTimer) {
      window.clearTimeout(state.toastTimer);
      state.toastTimer = null;
    }

    elements.toast.classList.remove('is-visible');
    elements.toast.hidden = true;
  }

  function showPickup(text, duration = 1200) {
    elements.pickupFlash.textContent = text;
    elements.pickupFlash.hidden = false;
    elements.pickupFlash.classList.remove('is-animating');
    void elements.pickupFlash.offsetWidth;
    elements.pickupFlash.classList.add('is-animating');

    if (state.pickupTimer) {
      window.clearTimeout(state.pickupTimer);
    }

    state.pickupTimer = window.setTimeout(() => {
      elements.pickupFlash.classList.remove('is-animating');
      elements.pickupFlash.hidden = true;
    }, duration);
  }

  function showKillfeed(text, tone = 'info', duration = 2400) {
    if (!elements.killfeed) return;

    elements.killfeed.hidden = false;

    const item = document.createElement('div');
    item.className = 'killfeed-entry';
    item.textContent = text;
    setToneClass(item, tone);
    elements.killfeed.prepend(item);

    while (elements.killfeed.children.length > 3) {
      elements.killfeed.lastElementChild?.remove();
    }

    const timer = window.setTimeout(() => {
      item.remove();
      state.killfeedTimers.delete(timer);
      if (!elements.killfeed.children.length) {
        elements.killfeed.hidden = true;
      }
    }, duration);
    state.killfeedTimers.add(timer);
  }

  function showSessionInstructions(text, duration = 10000) {
    if (!elements.instructionsPanel || !elements.hudTip) return;

    if (state.instructionTimer) {
      window.clearTimeout(state.instructionTimer);
    }
    if (state.instructionHideTimer) {
      window.clearTimeout(state.instructionHideTimer);
    }

    elements.hudTip.textContent = text;
    elements.instructionsPanel.hidden = false;
    elements.instructionsPanel.classList.remove('is-fading');

    state.instructionTimer = window.setTimeout(() => {
      elements.instructionsPanel.classList.add('is-fading');

      state.instructionHideTimer = window.setTimeout(() => {
        elements.instructionsPanel.hidden = true;
      }, 900);
    }, duration);
  }

  return {
    bindStart,
    getNickname,
    setNickname,
    focusNickname,
    setMenuBusy,
    setMenuStatus,
    showMenu,
    hideMenu,
    setHUDVisible,
    setConnectionState,
    updateHUD,
    showToast,
    hideToast,
    showPickup,
    showKillfeed,
    showSessionInstructions,
  };
}
