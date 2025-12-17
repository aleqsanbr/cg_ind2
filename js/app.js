const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

let isRendering = false;

function resizeCanvas() {
  const container = canvas.parentElement;
  const rect = container.getBoundingClientRect();

  // Используем квадратный canvas
  const size = Math.min(rect.width - 4, rect.height - 4);
  canvas.width = size;
  canvas.height = size;

  console.log('Canvas resized to:', canvas.width, 'x', canvas.height);

  // Заливаем фон
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function getSceneOptions() {
  const mirrorWallSelect = document.getElementById('mirrorWallSelect');
  const enableMirrorWall = document.getElementById('enableMirrorWall').checked;

  return {
    // Куб
    cubeMirror: document.getElementById('cubeMirror').checked,
    cubeTransparent: document.getElementById('cubeTransparent').checked,

    // Параллелепипед
    boxMirror: document.getElementById('boxMirror').checked,
    boxTransparent: document.getElementById('boxTransparent').checked,

    // Сфера 1
    sphere1Mirror: document.getElementById('sphere1Mirror').checked,
    sphere1Transparent: document.getElementById('sphere1Transparent').checked,

    // Сфера 2
    sphere2Mirror: document.getElementById('sphere2Mirror').checked,
    sphere2Transparent: document.getElementById('sphere2Transparent').checked,

    // Зеркальная стена
    mirrorWall: enableMirrorWall ? mirrorWallSelect.value : 'none',

    // Основной источник света
    light1Pos: new Point3D(parseFloat(document.getElementById('light1X').value) || 0, parseFloat(document.getElementById('light1Y').value) || 190, parseFloat(document.getElementById('light1Z').value) || 0),
    light1Intensity: parseFloat(document.getElementById('light1Intensity').value) || 10,

    // Дополнительный источник света
    enableLight2: document.getElementById('enableLight2').checked,
    light2Pos: new Point3D(parseFloat(document.getElementById('light2X').value) || 150, parseFloat(document.getElementById('light2Y').value) || 100, parseFloat(document.getElementById('light2Z').value) || 150),
    light2Intensity: parseFloat(document.getElementById('light2Intensity').value) || 10,

    // Настройки рендеринга
    refractiveIndex: parseFloat(document.getElementById('refractionIndex').value) || 1.5
  };
}

async function render() {
  if (isRendering) {
    console.log('Already rendering, skipping');
    return;
  }

  isRendering = true;
  const renderBtn = document.getElementById('btnRender');
  const renderInfo = document.getElementById('renderInfo');

  renderBtn.disabled = true;
  renderBtn.textContent = 'Рендеринг...';

  const startTime = performance.now();

  try {
    console.log('=== Starting render ===');
    const options = getSceneOptions();
    console.log('Options:', options);

    const maxDepth = parseInt(document.getElementById('maxDepth').value) || 5;
    console.log('Max depth:', maxDepth);

    console.log('Creating RayTracer...', canvas.width, 'x', canvas.height);
    const rayTracer = new RayTracer(canvas.width, canvas.height);
    rayTracer.setMaxDepth(maxDepth);

    console.log('Creating scene...');
    rayTracer.scene = createCornellBoxScene(options);
    console.log('Scene objects:', rayTracer.scene.objects.length);
    console.log('Scene lights:', rayTracer.scene.lights.length);

    console.log('Starting async render...');
    await rayTracer.renderAsync(ctx, (progress) => {
      const percent = Math.floor(progress * 100);
      renderInfo.textContent = `Рендеринг: ${percent}%`;
      if (percent % 20 === 0) {
        console.log('Progress:', percent + '%');
      }
    });

    console.log('Render complete!');

    const endTime = performance.now();
    const elapsed = ((endTime - startTime) / 1000).toFixed(2);
    renderInfo.textContent = `Готово за ${elapsed}с`;
    console.log('Elapsed:', elapsed, 's');
  } catch (error) {
    console.error('Render error:', error);
    console.error('Stack:', error.stack);
    renderInfo.textContent = 'Ошибка: ' + error.message;
  }

  renderBtn.disabled = false;
  renderBtn.textContent = 'Рендер';
  isRendering = false;
}

function setupEventListeners() {
  document.getElementById('btnRender').addEventListener('click', render);

  // Автоматически обновляем mirrorWallSelect при включении зеркальной стены
  document.getElementById('enableMirrorWall').addEventListener('change', (e) => {
    const select = document.getElementById('mirrorWallSelect');
    if (e.target.checked && select.value === 'none') {
      select.value = 'back';
    }
  });
}

function init() {
  console.log('Initializing app...');
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  setupEventListeners();

  console.log('Init complete. Click Render button to start.');
}

// Запуск после загрузки DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
