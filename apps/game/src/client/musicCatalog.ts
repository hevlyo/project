const AMBIENT_TRACK_FILE_NAMES = [
  '01. Battle Suit Aces.mp3',
  '02. Peaceful Times.mp3',
  '03. Cosmic Rendezvous.mp3',
  '04. Pholians.mp3',
  '05. Under Attack.mp3',
  '06. To the Battle Line!.mp3',
  '07. Defeat.mp3',
  '08. Space Station.mp3',
  '09. USS Zephyr.mp3',
  '10. Mission Complete!.mp3',
  '11. SIM Chamber.mp3',
  '12. Wilderness.mp3',
  '13. Distant Settlement.mp3',
  '14. Suitsmiths.mp3',
  "15. A Captain's Speech.mp3",
  '16. Metropolis.mp3',
  "17. Hunter's Guild.mp3",
  '18. Spring in Our Step.mp3',
  '19. Unknown Truth.mp3',
  "20. You're Not Alone.mp3",
  '21. Crisis!.mp3',
  '22. Conspiracy.mp3',
  '23. Carrion Riders.mp3',
  '24. Quiet on the Ship.mp3',
  '25. Bounty Board.mp3',
  '26. Suit Gala.mp3',
  '27. Frenzied Swarm.mp3',
  '28. Steadfast.mp3',
  '29. Raring to Go!.mp3',
  '30. Starball Match.mp3',
  '31. Growing Pride.mp3',
  '32. Shady Dealings.mp3',
  '33. Typhoons.mp3',
  '34. Patchworks.mp3',
  '35. Suit Up!.mp3',
  '36. Our Precious Days Together.mp3',
  '37. Enigmas.mp3',
  '38. Blooming Love.mp3',
  '39. Skiads.mp3',
  '40. Grey Wraith.mp3',
  '41. The Summoning.mp3',
  '42. The Sun Eater.mp3',
  '43. Burning Memory.mp3',
];

export function getAmbientTrackFileNames() {
  return [...AMBIENT_TRACK_FILE_NAMES];
}

export function buildAmbientTrackUrls() {
  return AMBIENT_TRACK_FILE_NAMES.map((fileName) => `/assets/background_sound/${encodeURIComponent(fileName)}`);
}

export function formatAmbientTrackLabel(fileName) {
  return fileName
    .replace(/^\d+\.\s*/, '')
    .replace(/\.mp3$/i, '');
}

export function buildMusicModeOptions() {
  const options = [{
    value: 'auto',
    label: 'Automático aleatório',
  }];

  AMBIENT_TRACK_FILE_NAMES.forEach((fileName, index) => {
    options.push({
      value: `track:${index}`,
      label: formatAmbientTrackLabel(fileName),
    });
  });

  return options;
}
