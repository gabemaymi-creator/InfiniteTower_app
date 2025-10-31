import { initializeGame } from './game.js';
import { setupSettingsControls } from './settings.js';

const api = initializeGame();
setupSettingsControls(api);

window.startGame = api.startGame;
window.resumeGame = api.resumeGame;
window.togglePause = api.togglePause;

export default api;
