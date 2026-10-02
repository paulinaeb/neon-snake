// Famobi start sequence (https://docs.famobi.com/start): the game code is loaded and started
// only after GameInterface.init() has resolved. The SDK loads string entries as classic scripts,
// which cannot carry Vite's ES module output, so the game module is imported in the resolve callback.
window.GameInterface.init([])
  .then(() => import('./main'))
  .catch((error: unknown) => {
    window.GameInterface.log('Neon Snake failed to start', error);
  });
