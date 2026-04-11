function setToneClass(element, tone) {
  if (!element) {
return;
}

  element.dataset.tone = tone;
}

export function createUIController(elements) {
  const state = {
    toastTimer: null,
    pickupTimer: null,
    instructionTimer: null,
    instructionHideTimer: null,
    menuHideTimer: null,
    killfeedTimers: new Set(),
    startClickHandler: null,
    nicknameKeydownHandler: null,
    musicVolumeInputHandler: null,
    musicMuteClickHandler: null,
    musicModeChangeHandler: null,
    lastScoreText: null,
    lastPlayerCountText: null,
    lastStatusLineText: null,
    lastStatusChipLabel: null,
    lastStatusChipTone: null,
    lastStatusChipVisible: null,
    lastLeaderboardKey: null,
    lastDashLabel: null,
    lastDashScaleX: null,
  };

  function bindStart(handler) {
    if (state.startClickHandler) {
      elements.playButton.removeEventListener('click', state.startClickHandler);
    }

    if (state.nicknameKeydownHandler) {
      elements.nicknameInput.removeEventListener('keydown', state.nicknameKeydownHandler);
    }

    state.startClickHandler = handler;
    state.nicknameKeydownHandler = event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        handler();
      }
    };

    elements.playButton.addEventListener('click', state.startClickHandler);
    elements.nicknameInput.addEventListener('keydown', state.nicknameKeydownHandler);
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

  function setMenuBusy(isBusy, buttonLabel = 'Aceitar meu destino') {
    elements.playButton.disabled = isBusy;
    elements.nicknameInput.disabled = isBusy;
    if (elements.musicVolumeInput) {
      elements.musicVolumeInput.disabled = isBusy;
    }

    if (elements.musicMuteButton) {
      elements.musicMuteButton.disabled = isBusy;
    }

    if (elements.musicModeSelect) {
      elements.musicModeSelect.disabled = isBusy;
    }

    elements.playButton.textContent = buttonLabel;
  }

  function setMusicModeOptions(options, selectedValue = 'auto') {
    if (!elements.musicModeSelect) {
return;
}

    elements.musicModeSelect.innerHTML = '';
    for (const option of options) {
      const item = document.createElement('option');
      item.value = option.value;
      item.textContent = option.label;
      elements.musicModeSelect.append(item);
    }

    elements.musicModeSelect.value = selectedValue;
  }

  function getMusicMode() {
    if (!elements.musicModeSelect) {
return 'auto';
}

    return elements.musicModeSelect.value || 'auto';
  }

  function setMusicMode(value) {
    if (!elements.musicModeSelect) {
return;
}

    elements.musicModeSelect.value = value;
  }

  function bindMusicModeChange(handler) {
    if (!elements.musicModeSelect) {
return;
}

    if (state.musicModeChangeHandler) {
      elements.musicModeSelect.removeEventListener('change', state.musicModeChangeHandler);
    }

    state.musicModeChangeHandler = () => {
      handler(getMusicMode());
    };

    elements.musicModeSelect.addEventListener('change', state.musicModeChangeHandler);
  }

  function getMusicVolume() {
    if (!elements.musicVolumeInput) {
return 0.08;
}

    return Number(elements.musicVolumeInput.value) / 100;
  }

  function setMusicVolume(value) {
    if (!elements.musicVolumeInput || !elements.musicVolumeValue) {
return;
}

    const safeValue = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.08;
    const percent = Math.round(safeValue * 100);
    elements.musicVolumeInput.value = String(percent);
    elements.musicVolumeValue.textContent = `${percent}%`;
  }

  function bindMusicVolumeChange(handler) {
    if (!elements.musicVolumeInput) {
return;
}

    if (state.musicVolumeInputHandler) {
      elements.musicVolumeInput.removeEventListener('input', state.musicVolumeInputHandler);
    }

    state.musicVolumeInputHandler = () => {
      const volume = getMusicVolume();
      setMusicVolume(volume);
      handler(volume);
    };

    elements.musicVolumeInput.addEventListener('input', state.musicVolumeInputHandler);
  }

  function setMusicMuted(isMuted) {
    if (!elements.musicMuteButton) {
return;
}

    const muted = Boolean(isMuted);
    elements.musicMuteButton.setAttribute('aria-pressed', muted ? 'true' : 'false');
    elements.musicMuteButton.textContent = muted ? 'Som off' : 'Mutar';
  }

  function bindMusicMuteToggle(handler) {
    if (!elements.musicMuteButton) {
return;
}

    if (state.musicMuteClickHandler) {
      elements.musicMuteButton.removeEventListener('click', state.musicMuteClickHandler);
    }

    state.musicMuteClickHandler = () => {
      handler();
    };

    elements.musicMuteButton.addEventListener('click', state.musicMuteClickHandler);
  }

  function setMenuStatus(text, tone = 'idle') {
    if (!elements.menuStatus) {
return;
}

    elements.menuStatus.textContent = text;
    setToneClass(elements.menuStatus, tone);
  }

  function showMenu() {
    elements.menuScreen.hidden = false;
    elements.menuScreen.classList.remove('is-hidden');
  }

  function hideMenu() {
    elements.menuScreen.classList.add('is-hidden');
    if (state.menuHideTimer) {
      globalThis.clearTimeout(state.menuHideTimer);
    }

    state.menuHideTimer = globalThis.setTimeout(() => {
      if (elements.menuScreen.classList.contains('is-hidden')) {
        elements.menuScreen.hidden = true;
      }
    }, 220);
  }

  function setHUDVisible(visible) {
    elements.hud.hidden = !visible;
  }

  function setConnectionState(text, tone = 'live') {
    // Connection state display removed; info shown in status line
  }

  function updateHUD({ score, playerCount, leaderboard, localPlayerId, statusLine, statusChip, dashCooldownRatio, dashReady, dashUnlimited, dashRemainingMs }) {
    const scoreText = String(score);
    if (state.lastScoreText !== scoreText) {
      elements.scoreValue.textContent = scoreText;
      state.lastScoreText = scoreText;
    }

    const playerCountText = String(playerCount);
    if (state.lastPlayerCountText !== playerCountText) {
      elements.playerCountValue.textContent = playerCountText;
      state.lastPlayerCountText = playerCountText;
    }

    if (elements.statusLine && state.lastStatusLineText !== statusLine) {
      elements.statusLine.textContent = statusLine;
      state.lastStatusLineText = statusLine;
    }

    if (elements.statusChip) {
      const chipVisible = Boolean(statusChip?.label);
      const chipLabel = chipVisible ? statusChip.label : '';
      const chipTone = chipVisible ? (statusChip.tone || 'live') : 'idle';

      if (state.lastStatusChipVisible !== chipVisible) {
        elements.statusChip.hidden = !chipVisible;
        state.lastStatusChipVisible = chipVisible;
      }

      if (state.lastStatusChipLabel !== chipLabel) {
        elements.statusChip.textContent = chipLabel;
        state.lastStatusChipLabel = chipLabel;
      }

      if (chipVisible && state.lastStatusChipTone !== chipTone) {
        setToneClass(elements.statusChip, chipTone);
        state.lastStatusChipTone = chipTone;
      }

      if (statusChip?.label) {
        // No-op: updates are handled by cached writes above.
      } else {
        state.lastStatusChipTone = null;
      }
    }

    if (elements.dashLabel && elements.dashCooldownFill) {
      const safeRatio = Number.isFinite(dashCooldownRatio)
        ? Math.max(0, Math.min(1, dashCooldownRatio))
        : 1;
      const dashLabel = dashUnlimited ? 'Ilimitado!' : (dashReady ? 'Pronto' : `${(dashRemainingMs / 1000).toFixed(1)}s`);

      if (state.lastDashLabel !== dashLabel) {
        elements.dashLabel.textContent = dashLabel;
        state.lastDashLabel = dashLabel;
      }

      if (state.lastDashScaleX !== safeRatio) {
        elements.dashCooldownFill.style.transform = `scaleX(${safeRatio})`;
        state.lastDashScaleX = safeRatio;
      }
    }

    const leaderboardKey = leaderboard.map((player, index) => (
      `${index}:${player.id}:${player.score}:${player.id === localPlayerId ? 1 : 0}`
    )).join('|');
    if (state.lastLeaderboardKey === leaderboardKey) {
      return;
    }

    state.lastLeaderboardKey = leaderboardKey;

    elements.leaderboard.innerHTML = '';

    if (leaderboard.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'leaderboard-entry';
      empty.textContent = 'Ninguém digno de vergonha ainda. Entra tu.';
      elements.leaderboard.append(empty);
      return;
    }

    for (const [index, player] of leaderboard.entries()) {
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
      elements.leaderboard.append(item);
    }
  }

  function showToast(text, tone = 'info', duration = 2200) {
    elements.toast.textContent = text;
    elements.toast.hidden = false;
    elements.toast.classList.add('is-visible');
    setToneClass(elements.toast, tone);

    if (state.toastTimer) {
      globalThis.clearTimeout(state.toastTimer);
    }

    state.toastTimer = globalThis.setTimeout(() => {
      elements.toast.classList.remove('is-visible');
      globalThis.setTimeout(() => {
        if (!elements.toast.classList.contains('is-visible')) {
          elements.toast.hidden = true;
        }
      }, 180);
    }, duration);
  }

  function hideToast() {
    if (state.toastTimer) {
      globalThis.clearTimeout(state.toastTimer);
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
      globalThis.clearTimeout(state.pickupTimer);
    }

    state.pickupTimer = globalThis.setTimeout(() => {
      elements.pickupFlash.classList.remove('is-animating');
      elements.pickupFlash.hidden = true;
    }, duration);
  }

  function showKillfeed(text, tone = 'info', duration = 2400) {
    if (!elements.killfeed) {
return;
}

    elements.killfeed.hidden = false;

    const item = document.createElement('div');
    item.className = 'killfeed-entry';
    item.textContent = text;
    setToneClass(item, tone);
    elements.killfeed.prepend(item);

    while (elements.killfeed.children.length > 3) {
      elements.killfeed.lastElementChild?.remove();
    }

    const timer = globalThis.setTimeout(() => {
      item.remove();
      state.killfeedTimers.delete(timer);
      if (elements.killfeed.children.length === 0) {
        elements.killfeed.hidden = true;
      }
    }, duration);
    state.killfeedTimers.add(timer);
  }

  function showSessionInstructions(text, duration = 10_000) {
    if (!elements.instructionsPanel || !elements.hudTip) {
return;
}

    if (state.instructionTimer) {
      globalThis.clearTimeout(state.instructionTimer);
    }

    if (state.instructionHideTimer) {
      globalThis.clearTimeout(state.instructionHideTimer);
    }

    elements.hudTip.textContent = text;
    elements.instructionsPanel.hidden = false;
    elements.instructionsPanel.classList.remove('is-fading');

    state.instructionTimer = globalThis.setTimeout(() => {
      elements.instructionsPanel.classList.add('is-fading');

      state.instructionHideTimer = globalThis.setTimeout(() => {
        elements.instructionsPanel.hidden = true;
      }, 900);
    }, duration);
  }

  function destroy() {
    if (state.startClickHandler) {
      elements.playButton.removeEventListener('click', state.startClickHandler);
      state.startClickHandler = null;
    }

    if (state.nicknameKeydownHandler) {
      elements.nicknameInput.removeEventListener('keydown', state.nicknameKeydownHandler);
      state.nicknameKeydownHandler = null;
    }

    if (state.musicVolumeInputHandler && elements.musicVolumeInput) {
      elements.musicVolumeInput.removeEventListener('input', state.musicVolumeInputHandler);
      state.musicVolumeInputHandler = null;
    }

    if (state.musicMuteClickHandler && elements.musicMuteButton) {
      elements.musicMuteButton.removeEventListener('click', state.musicMuteClickHandler);
      state.musicMuteClickHandler = null;
    }

    if (state.musicModeChangeHandler && elements.musicModeSelect) {
      elements.musicModeSelect.removeEventListener('change', state.musicModeChangeHandler);
      state.musicModeChangeHandler = null;
    }

    if (state.toastTimer) {
      globalThis.clearTimeout(state.toastTimer);
    }

    if (state.pickupTimer) {
      globalThis.clearTimeout(state.pickupTimer);
    }

    if (state.instructionTimer) {
      globalThis.clearTimeout(state.instructionTimer);
    }

    if (state.instructionHideTimer) {
      globalThis.clearTimeout(state.instructionHideTimer);
    }

    if (state.menuHideTimer) {
      globalThis.clearTimeout(state.menuHideTimer);
    }

    for (const timer of state.killfeedTimers) {
globalThis.clearTimeout(timer);
}

    state.killfeedTimers.clear();
  }

  function triggerDashError() {
    if (elements.dashPanel) {
      elements.dashPanel.classList.remove('pulse-error');
      // Forçar reflow para reiniciar a animação CSS
      void elements.dashPanel.offsetWidth;
      elements.dashPanel.classList.add('pulse-error');
    }
  }

  return {
    bindStart,
    getNickname,
    setNickname,
    getMusicVolume,
    setMusicVolume,
    bindMusicVolumeChange,
    setMusicModeOptions,
    getMusicMode,
    setMusicMode,
    bindMusicModeChange,
    setMusicMuted,
    bindMusicMuteToggle,
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
    triggerDashError,
    destroy,
  };
}
