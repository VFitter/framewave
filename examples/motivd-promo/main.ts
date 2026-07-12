import { Player, createRenderer, renderToVideo, downloadVideo } from 'framewave';
import { composition, build } from './scene.js';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const renderer = await createRenderer({ width: composition.width, height: composition.height, canvas });
const player = new Player({ composition, renderer, build, loop: true });
player.play();

document.getElementById('playpause')!.addEventListener('click', (e) => {
  if (player.playing) { player.pause(); (e.target as HTMLElement).textContent = 'Play'; }
  else { player.play(); (e.target as HTMLElement).textContent = 'Pause'; }
});

document.getElementById('export')!.addEventListener('click', async (e) => {
  const btn = e.target as HTMLButtonElement;
  player.pause();
  btn.disabled = true;
  const exportRenderer = await createRenderer({ width: composition.width, height: composition.height });
  try {
    const result = await renderToVideo({
      composition,
      renderer: exportRenderer,
      build,
      bitrate: 12_000_000,
      onProgress: (p) => (btn.textContent = `Exporting ${(p * 100).toFixed(0)}%`),
    });
    downloadVideo(result, 'motivd-promo');
    btn.textContent = `Done in ${(result.elapsedMs / 1000).toFixed(1)}s`;
  } finally {
    exportRenderer.dispose();
    btn.disabled = false;
    player.play();
  }
});
