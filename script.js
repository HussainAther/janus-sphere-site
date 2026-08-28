const evidenceImages = {
  butterfly: {
    src: 'assets/butterfly-near-reconstruction.png',
    alt: 'Near-converged butterfly sparse-ray reconstruction',
    caption: 'Butterfly — near-converged RBYRCT-inspired reconstruction with restrained sparse-view residuals.',
  },
  marilyn: {
    src: 'assets/marilyn-near-reconstruction.png',
    alt: 'Near-converged Marilyn sparse-ray reconstruction',
    caption: 'Marilyn — near-converged RBYRCT-inspired reconstruction preserving the source structure with mild reconstruction residuals.',
  },
  rbyrct: {
    src: 'assets/marilyn-rbyrct-row.png',
    alt: 'RBYRCT Marilyn reconstructions at 1,000, 5,000, and 10,000 rays',
    caption: 'RBYRCT — Marilyn reconstruction progression at 1,000, 5,000, and 10,000 rays.',
  },
  fan: {
    src: 'assets/marilyn-fan-row.png',
    alt: 'Fan Marilyn reconstructions at 1,000, 5,000, and 10,000 rays',
    caption: 'Fan — Marilyn reconstruction progression at 1,000, 5,000, and 10,000 rays.',
  },
};

const imageNode = document.querySelector('[data-evidence-image]');
const captionNode = document.querySelector('[data-evidence-caption]');
const imageButtons = document.querySelectorAll('[data-image]');

imageButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const nextImage = evidenceImages[button.dataset.image];
    if (!nextImage) return;

    imageButtons.forEach((item) => {
      item.classList.toggle('active', item === button);
      item.setAttribute('aria-selected', String(item === button));
    });

    imageNode.src = nextImage.src;
    imageNode.alt = nextImage.alt;
    captionNode.textContent = nextImage.caption;
  });
});

const strategyData = {
  adaptive: {
    coverage: '84%',
    target: '1.42x',
    budget: '12.5k',
    note:
      'Adaptive policy concentrates rays around high-information regions while preserving a global coverage floor.',
  },
  random: {
    coverage: '76%',
    target: '1.18x',
    budget: '12.5k',
    note:
      'Random policy explores broadly and avoids rigid sweep artifacts, but it spends some rays on regions already resolved.',
  },
  fan: {
    coverage: '61%',
    target: '0.94x',
    budget: '12.5k',
    note:
      'Fan policy is orderly and interpretable, but under sparse budgets it can lag around off-axis texture and target regions.',
  },
};

const promptAnswers = {
  winner:
    'Adaptive is winning in this sketch because it balances coverage with targeted sampling. It does not simply chase one bright feature; it protects global structure while revisiting uncertain regions.',
  lag:
    'Fan sampling can lag under sparse budgets because the ray schedule is fixed. If the target evidence sits outside the strongest sweep path, the reconstruction pays for structure it already understands.',
  next:
    'The next rays should go where the current image has edge disagreement: boundary texture, lesion-like compact structures, and areas where random coverage still leaves thin unmeasured corridors.',
  caption:
    'RBYRCT comparison of sparse ray policies. Adaptive ray selection improves target-region sampling while maintaining global coverage, offering a visual route toward lower-budget reconstruction studies.',
};

const strategyButtons = document.querySelectorAll('[data-strategy]');
const strategyNote = document.querySelector('[data-strategy-note]');
const metrics = {
  coverage: document.querySelector('[data-metric="coverage"]'),
  target: document.querySelector('[data-metric="target"]'),
  budget: document.querySelector('[data-metric="budget"]'),
};

strategyButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const strategy = strategyData[button.dataset.strategy];
    if (!strategy) return;

    strategyButtons.forEach((item) => {
      item.classList.toggle('active', item === button);
      item.setAttribute('aria-selected', String(item === button));
    });

    metrics.coverage.textContent = strategy.coverage;
    metrics.target.textContent = strategy.target;
    metrics.budget.textContent = strategy.budget;
    strategyNote.textContent = strategy.note;
  });
});

const promptButtons = document.querySelectorAll('[data-prompt]');
const answerBox = document.querySelector('[data-answer-box]');

promptButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const answer = promptAnswers[button.dataset.prompt];
    if (!answer) return;

    promptButtons.forEach((item) => item.classList.toggle('active', item === button));
    answerBox.textContent = answer;
  });
});

const cancerZapControls = document.querySelectorAll('[data-cancerzap-control]');
const cancerZapValues = {
  scout: document.querySelector('[data-cancerzap-value="scout"]'),
  rays: document.querySelector('[data-cancerzap-value="rays"]'),
  uncertainty: document.querySelector('[data-cancerzap-value="uncertainty"]'),
  lesion: document.querySelector('[data-cancerzap-value="lesion"]'),
};
const cancerZapMetrics = {
  focused: document.querySelector('[data-cancerzap-metric="focused"]'),
  coverage: document.querySelector('[data-cancerzap-metric="coverage"]'),
  information: document.querySelector('[data-cancerzap-metric="information"]'),
};
const cancerZapField = document.querySelector('[data-cancerzap-field]');
const cancerZapAnswer = document.querySelector('[data-cancerzap-answer]');
const cancerZapPromptButtons = document.querySelectorAll('[data-cancerzap-prompt]');
let cancerZapPrompt = 'scout';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatRayBudget(value) {
  return `${(value / 1000).toFixed(value >= 1000 ? 1 : 0)}k`;
}

function readCancerZapState() {
  return Array.from(cancerZapControls).reduce(
    (state, control) => ({
      ...state,
      [control.dataset.cancerzapControl]: Number(control.value),
    }),
    {},
  );
}

function modelCancerZap(state) {
  const focusShare = Math.round(
    clamp(28 + state.uncertainty * 0.24 + state.lesion * 0.34 - state.scout * 0.16, 24, 84),
  );
  const coverage = Math.round(
    clamp(44 + state.scout * 0.95 + (100 - focusShare) * 0.18 + (state.rays / 6200) * 12, 48, 94),
  );
  const information = Math.round(
    clamp(38 + Math.log2(state.rays / 800) * 8 + state.uncertainty * 0.12 + state.lesion * 0.14 + state.scout * 0.08, 35, 98),
  );
  const nextFocus = Math.round(clamp(36 + state.lesion * 0.34, 34, 72));
  const targetSize = Math.round(clamp(54 + coverage * 0.32, 66, 88));

  return {
    focusShare,
    coverage,
    information,
    nextFocus,
    targetSize,
    reserve: Math.round(state.rays * focusShare / 100),
    broad: Math.round(state.rays * (100 - focusShare) / 100),
  };
}

function buildCancerZapAnswer(state, model) {
  const answers = {
    scout:
      `At a ${state.scout}% scout setting, CancerZap treats the first pass as an uncertainty map rather than a finished image. The simulated policy keeps about ${model.broad.toLocaleString()} rays for broad coverage and reserves ${model.reserve.toLocaleString()} rays for unresolved structure.`,
    adaptive:
      `The adaptive move is to stop treating every measurement as equal. In this setting, ${model.focusShare}% of the ray budget is aimed toward high-gradient or candidate-lesion regions while the coverage floor stays near ${model.coverage}%, so the simulator does not simply tunnel into one bright feature.`,
    background:
      `The book's structured-background simulations ask whether small targets are hidden by anatomy-like texture, not just random noise. CancerZap raises ray priority when uncertainty and lesion focus are high because those are the conditions where ordinary uniform sampling can spend dose on already-understood tissue.`,
    validation:
      `A public claim would need locked phantoms, noise and motion stress tests, limited-angle studies, dose maps, repeatable ray logs, and reader-relevant task metrics. This assistant is only a research sketch; clinical credibility has to come from controlled validation, not from the slider values.`,
  };

  return answers[cancerZapPrompt] || answers.scout;
}

function updateCancerZap() {
  if (!cancerZapControls.length || !cancerZapAnswer) return;

  const state = readCancerZapState();
  const model = modelCancerZap(state);

  if (cancerZapValues.scout) cancerZapValues.scout.textContent = `${state.scout}%`;
  if (cancerZapValues.rays) cancerZapValues.rays.textContent = formatRayBudget(state.rays);
  if (cancerZapValues.uncertainty) cancerZapValues.uncertainty.textContent = state.uncertainty;
  if (cancerZapValues.lesion) cancerZapValues.lesion.textContent = state.lesion;

  if (cancerZapMetrics.focused) cancerZapMetrics.focused.textContent = `${model.focusShare}%`;
  if (cancerZapMetrics.coverage) cancerZapMetrics.coverage.textContent = `${model.coverage}%`;
  if (cancerZapMetrics.information) cancerZapMetrics.information.textContent = model.information;

  if (cancerZapField) {
    cancerZapField.style.setProperty('--zap-focus', `${model.nextFocus}%`);
    cancerZapField.style.setProperty('--zap-size', `${model.targetSize}px`);
  }

  cancerZapAnswer.textContent = buildCancerZapAnswer(state, model);
}

cancerZapControls.forEach((control) => {
  control.addEventListener('input', updateCancerZap);
});

cancerZapPromptButtons.forEach((button) => {
  button.addEventListener('click', () => {
    cancerZapPrompt = button.dataset.cancerzapPrompt;
    cancerZapPromptButtons.forEach((item) => {
      item.classList.toggle('active', item === button);
    });
    updateCancerZap();
  });
});

updateCancerZap();

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const logoGlobe = document.querySelector('[data-logo-globe]');

if (logoGlobe && !prefersReducedMotion) {
  initializeLogoGlobe(logoGlobe);
}

function initializeLogoGlobe(globeCanvas) {
  const gl = globeCanvas.getContext('webgl', {
    alpha: true,
    antialias: true,
    premultipliedAlpha: false,
  });

  if (!gl) return;

  const vertexSource = `
    attribute vec2 aPosition;
    varying vec2 vUv;

    void main() {
      vUv = aPosition * 0.5 + 0.5;
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }
  `;

  const fragmentSource = `
    precision highp float;

    uniform vec2 uResolution;
    uniform float uTime;
    varying vec2 vUv;

    mat2 rotate2d(float angle) {
      float s = sin(angle);
      float c = cos(angle);
      return mat2(c, -s, s, c);
    }

    float ring(vec2 p, float angle, float radius, float thickness) {
      vec2 q = rotate2d(angle) * p;
      q.y *= 0.34;
      return smoothstep(thickness, 0.0, abs(length(q) - radius));
    }

    float particle(vec2 p, float index) {
      float angle = uTime * (0.42 + index * 0.03) + index * 1.91;
      vec2 orbit = vec2(cos(angle) * (0.82 + index * 0.015), sin(angle) * 0.32);
      orbit = rotate2d(index * 0.62) * orbit;
      return smoothstep(0.025, 0.0, length(p - orbit));
    }

    void main() {
      vec2 p = (vUv - 0.5) * 2.0;
      p.x *= uResolution.x / uResolution.y;

      float r2 = dot(p, p);
      float sphereMask = smoothstep(1.04, 0.98, r2);
      float rim = smoothstep(0.72, 1.0, r2) * sphereMask;
      float z = sqrt(max(0.0, 1.0 - r2));
      vec3 normal = normalize(vec3(p, z));
      vec3 light = normalize(vec3(-0.55, 0.72, 0.8));
      float shade = clamp(dot(normal, light), 0.0, 1.0);
      float crescent = smoothstep(0.28, 0.62, normal.x * -0.9 + normal.y * 0.8 + 0.36);
      float gloss = pow(max(dot(reflect(-light, normal), vec3(0.0, 0.0, 1.0)), 0.0), 42.0);

      vec3 deepBlue = vec3(0.02, 0.2, 0.34);
      vec3 blue = vec3(0.02, 0.36, 0.56);
      vec3 silver = vec3(0.82, 0.88, 0.94);
      vec3 teal = vec3(0.16, 0.83, 0.78);
      vec3 sphere = mix(deepBlue, blue, shade);
      sphere = mix(sphere, silver, crescent * 0.78);
      sphere += gloss * vec3(0.72, 0.92, 1.0);
      sphere += rim * teal * 0.18;

      float rings = 0.0;
      rings += ring(p, 0.08 + uTime * 0.12, 0.94, 0.016);
      rings += ring(p, -0.58 - uTime * 0.08, 1.08, 0.012);
      rings += ring(p, 0.92 + uTime * 0.06, 1.18, 0.01);

      float sparks = 0.0;
      for (float i = 0.0; i < 10.0; i += 1.0) {
        sparks += particle(p, i);
      }

      float halo = smoothstep(1.55, 0.0, length(p)) * 0.34;
      vec3 color = sphere * sphereMask;
      color += teal * rings * 0.7;
      color += vec3(0.95, 1.0, 1.0) * sparks * 0.9;
      color += teal * halo;

      float alpha = max(sphereMask, rings * 0.86);
      alpha = max(alpha, sparks);
      alpha = max(alpha, halo * 0.45);
      gl_FragColor = vec4(color, alpha);
    }
  `;

  function compileShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  const vertexShader = compileShader(gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentSource);
  if (!vertexShader || !fragmentShader) return;

  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;

  const positionLocation = gl.getAttribLocation(program, 'aPosition');
  const resolutionLocation = gl.getUniformLocation(program, 'uResolution');
  const timeLocation = gl.getUniformLocation(program, 'uTime');
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );

  function resizeGlobe() {
    const rect = globeCanvas.getBoundingClientRect();
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.floor(rect.width * scale));
    const height = Math.max(1, Math.floor(rect.height * scale));

    if (globeCanvas.width !== width || globeCanvas.height !== height) {
      globeCanvas.width = width;
      globeCanvas.height = height;
      gl.viewport(0, 0, width, height);
    }
  }

  function drawGlobe(time) {
    resizeGlobe();
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.enableVertexAttribArray(positionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(resolutionLocation, globeCanvas.width, globeCanvas.height);
    gl.uniform1f(timeLocation, time * 0.001);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    requestAnimationFrame(drawGlobe);
  }

  window.addEventListener('resize', resizeGlobe);
  requestAnimationFrame(drawGlobe);
}

const canvas = document.querySelector('[data-ray-canvas]');

if (canvas && !prefersReducedMotion) {
  const context = canvas.getContext('2d');
  const rays = Array.from({ length: 42 }, (_, index) => ({
    phase: index * 0.31,
    speed: 0.004 + (index % 7) * 0.0008,
    width: 0.35 + (index % 5) * 0.12,
  }));
  const pointer = { x: 0.34, y: 0.58 };

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const scale = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * scale));
    canvas.height = Math.max(1, Math.floor(rect.height * scale));
    context.setTransform(scale, 0, 0, scale, 0, 0);
  }

  function drawRays(time) {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    context.clearRect(0, 0, width, height);
    context.globalCompositeOperation = 'lighter';

    rays.forEach((ray, index) => {
      const sweep = (time * ray.speed + ray.phase) % 1;
      const startX = -width * 0.08;
      const startY = height * (0.12 + sweep * 0.78);
      const targetX = width * (0.28 + pointer.x * 0.54);
      const targetY = height * (0.22 + pointer.y * 0.56);
      const endX = width * 1.08;
      const endY = height * (0.9 - sweep * 0.72 + Math.sin(ray.phase) * 0.08);
      const gradient = context.createLinearGradient(startX, startY, endX, endY);

      gradient.addColorStop(0, 'rgba(41, 211, 199, 0)');
      gradient.addColorStop(0.44, index % 3 === 0 ? 'rgba(232, 162, 74, 0.34)' : 'rgba(41, 211, 199, 0.42)');
      gradient.addColorStop(1, 'rgba(41, 211, 199, 0)');

      context.beginPath();
      context.moveTo(startX, startY);
      context.quadraticCurveTo(targetX, targetY, endX, endY);
      context.strokeStyle = gradient;
      context.lineWidth = ray.width;
      context.stroke();
    });

    requestAnimationFrame(drawRays);
  }

  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    pointer.y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
  });

  resizeCanvas();
  requestAnimationFrame(drawRays);
}


// Tumor Hunt / Battleship ----------------------------------------------------
const battleBoard = document.querySelector('[data-battle-board]');
const battleHeat = document.querySelector('[data-battle-heatmap]');

if (battleBoard && battleHeat) {
  const size = 8;
  const totalCells = size * size;
  const shotCountNode = document.querySelector('[data-battle-shots]');
  const hitCountNode = document.querySelector('[data-battle-hits]');
  const lesionCountNode = document.querySelector('[data-battle-lesions]');
  const bestNode = document.querySelector('[data-battle-best]');
  const coverageNode = document.querySelector('[data-battle-coverage]');
  const probNode = document.querySelector('[data-battle-prob]');
  const statusNode = document.querySelector('[data-battle-status]');
  const copyNode = document.querySelector('[data-battle-copy]');
  const hintButton = document.querySelector('[data-battle-hint]');
  const randomButton = document.querySelector('[data-battle-random]');
  const autoButton = document.querySelector('[data-battle-auto]');
  const resetButton = document.querySelector('[data-battle-reset]');

  let cells = [];
  let boardButtons = [];
  let heatCells = [];
  let autoTimer = null;
  let gameState = null;
  let suggestedIndex = null;

  function xyToIndex(x, y) { return y * size + x; }
  function indexToLabel(index) {
    const x = index % size;
    const y = Math.floor(index / size);
    return `${String.fromCharCode(65 + x)}${y + 1}`;
  }
  function inside(x, y) { return x >= 0 && x < size && y >= 0 && y < size; }
  function key(x, y) { return `${x},${y}`; }

  function seededNoise(x, y) {
    const n = Math.sin((x + 1) * 12.9898 + (y + 1) * 78.233) * 43758.5453;
    return n - Math.floor(n);
  }

  function chooseShapes() {
    return [
      [[0, 0], [1, 0], [0, 1]],
      [[0, 0], [1, 0]],
    ];
  }

  function placeLesions() {
    const lesions = [];
    const occupied = new Set();
    for (const shape of chooseShapes()) {
      let placed = false;
      for (let tries = 0; tries < 200 && !placed; tries += 1) {
        const rotate = Math.floor(Math.random() * 4);
        const transformed = shape.map(([x, y]) => {
          if (rotate === 1) return [y, -x];
          if (rotate === 2) return [-x, -y];
          if (rotate === 3) return [-y, x];
          return [x, y];
        });
        const xs = transformed.map(([x]) => x);
        const ys = transformed.map(([, y]) => y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const offsetX = Math.floor(Math.random() * (size - (maxX - minX) - 2)) + 1 - minX;
        const offsetY = Math.floor(Math.random() * (size - (maxY - minY) - 2)) + 1 - minY;
        const cellsCandidate = transformed.map(([x, y]) => [x + offsetX, y + offsetY]);
        const tooClose = cellsCandidate.some(([x, y]) => {
          for (let yy = y - 1; yy <= y + 1; yy += 1) {
            for (let xx = x - 1; xx <= x + 1; xx += 1) {
              if (occupied.has(key(xx, yy))) return true;
            }
          }
          return false;
        });
        if (tooClose) continue;
        cellsCandidate.forEach(([x, y]) => occupied.add(key(x, y)));
        lesions.push({ cells: cellsCandidate.map(([x, y]) => xyToIndex(x, y)) });
        placed = true;
      }
    }
    lesions.forEach((lesion) => {
      lesion.found = false;
    });
    return lesions;
  }

  function initBoards() {
    battleBoard.innerHTML = '';
    battleHeat.innerHTML = '';
    boardButtons = [];
    heatCells = [];
    for (let i = 0; i < totalCells; i += 1) {
      const cellButton = document.createElement('button');
      cellButton.type = 'button';
      cellButton.className = 'battle-cell';
      cellButton.setAttribute('aria-label', `Measurement cell ${indexToLabel(i)}`);
      cellButton.textContent = '·';
      cellButton.addEventListener('click', () => fireShot(i, 'manual'));
      battleBoard.appendChild(cellButton);
      boardButtons.push(cellButton);

      const heatCell = document.createElement('div');
      heatCell.className = 'battle-cell';
      heatCell.setAttribute('aria-hidden', 'true');
      heatCell.textContent = '0';
      battleHeat.appendChild(heatCell);
      heatCells.push(heatCell);
    }
  }

  function initGame() {
    if (autoTimer) {
      clearTimeout(autoTimer);
      autoTimer = null;
    }
    const lesions = placeLesions();
    cells = Array.from({ length: totalCells }, (_, index) => ({
      index,
      shot: false,
      result: null,
      suspicion: 0.08 + (index % 2 ? 0.01 : 0),
      tumor: lesions.some((lesion) => lesion.cells.includes(index)),
    }));
    gameState = {
      lesions,
      shots: 0,
      hits: 0,
      localized: 0,
      won: false,
      lastMessage: 'Click any square to start probing the hidden phantom.',
    };
    boardButtons.forEach((button) => {
      button.disabled = false;
      button.className = 'battle-cell';
      button.textContent = '·';
    });
    suggestedIndex = null;
    updateBattleshipFromBelief();
    renderBattle();
  }

  function lesionOf(index) {
    return gameState.lesions.find((lesion) => lesion.cells.includes(index));
  }

  function nearestTumorDistance(index) {
    const x = index % size;
    const y = Math.floor(index / size);
    let best = Infinity;
    gameState.lesions.forEach((lesion) => {
      lesion.cells.forEach((cellIndex) => {
        const tx = cellIndex % size;
        const ty = Math.floor(cellIndex / size);
        best = Math.min(best, Math.abs(tx - x) + Math.abs(ty - y));
      });
    });
    return best;
  }

  function classifyShot(index) {
    if (cells[index].tumor) return 'hit';
    const distance = nearestTumorDistance(index);
    if (distance <= 1) return 'near';
    return 'miss';
  }

  function updateBeliefFromShot(index, result) {
    const sx = index % size;
    const sy = Math.floor(index / size);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const idx = xyToIndex(x, y);
        const distance = Math.abs(x - sx) + Math.abs(y - sy);
        let delta = 0;
        if (result === 'hit') {
          if (distance === 0) delta = 0.92;
          else if (distance === 1) delta = 0.42;
          else if (distance === 2) delta = 0.13;
          else delta = -0.015 * distance;
        } else if (result === 'near') {
          if (distance === 0) delta = 0.18;
          else if (distance === 1) delta = 0.30;
          else if (distance === 2) delta = 0.12;
          else if (distance === 3) delta = 0.04;
          else delta = -0.01 * distance;
        } else {
          if (distance === 0) delta = -0.28;
          else if (distance === 1) delta = -0.07;
          else if (distance === 2) delta = 0.01;
          else delta = 0;
        }
        const prior = cells[idx].suspicion;
        const centerBias = 0.006 * (1 - Math.hypot((x - 3.5) / 4, (y - 3.5) / 4));
        const parityBias = ((x + y) % 2 === 0 ? 0.005 : 0);
        cells[idx].suspicion = clamp(prior * 0.88 + delta + centerBias + parityBias, 0, 0.99);
      }
    }
    cells[index].suspicion = result === 'hit' ? 0.99 : result === 'near' ? 0.76 : 0.01;
  }

  function updateLocalized() {
    let localized = 0;
    gameState.lesions.forEach((lesion) => {
      const found = lesion.cells.every((cellIndex) => cells[cellIndex].result === 'hit');
      lesion.found = found;
      if (found) localized += 1;
    });
    gameState.localized = localized;
    if (localized === gameState.lesions.length) {
      gameState.won = true;
      gameState.lastMessage = `All ${localized} hidden lesion regions have been localized in ${gameState.shots} shots.`;
    }
  }

  function bestSuggestion() {
    let best = { index: null, score: -Infinity };
    cells.forEach((cell) => {
      if (cell.shot) return;
      const ix = cell.index % size;
      const iy = Math.floor(cell.index / size);
      let adjacency = 0;
      for (let yy = iy - 1; yy <= iy + 1; yy += 1) {
        for (let xx = ix - 1; xx <= ix + 1; xx += 1) {
          if (!inside(xx, yy) || (xx === ix && yy === iy)) continue;
          const neighbor = cells[xyToIndex(xx, yy)];
          if (neighbor.result === 'hit') adjacency += 0.45;
          else if (neighbor.result === 'near') adjacency += 0.18;
        }
      }
      const checker = ((ix + iy) % 2 === 0 ? 0.03 : 0);
      const score = cell.suspicion + adjacency + checker;
      if (score > best.score) best = { index: cell.index, score };
    });
    return best;
  }

  function updateBattleshipFromBelief() {
    const best = bestSuggestion();
    suggestedIndex = best.index;
  }

  function fireShot(index, source) {
    if (gameState.won || cells[index].shot) return;
    const result = classifyShot(index);
    cells[index].shot = true;
    cells[index].result = result;
    gameState.shots += 1;
    if (result === 'hit') gameState.hits += 1;

    updateBeliefFromShot(index, result);
    updateLocalized();
    updateBattleshipFromBelief();

    if (!gameState.won) {
      if (result === 'hit') {
        const lesion = lesionOf(index);
        const remaining = lesion ? lesion.cells.filter((cellIndex) => cells[cellIndex].result !== 'hit').length : 0;
        gameState.lastMessage = remaining > 0
          ? `${indexToLabel(index)} is a direct hit. Adaptive sampling should now examine adjacent structure.`
          : `${indexToLabel(index)} completes one lesion region. Re-target the remaining uncertain structure.`;
      } else if (result === 'near') {
        gameState.lastMessage = `${indexToLabel(index)} shows suspicious local structure. An RBYRCT-style policy would increase belief around neighboring cells.`;
      } else if (source === 'random') {
        gameState.lastMessage = `${indexToLabel(index)} was a random shot and returned low evidence. Random search covers the board, but it can spend shots inefficiently.`;
      } else {
        gameState.lastMessage = `${indexToLabel(index)} returns low evidence. The next move should shift toward cells with higher updated suspicion.`;
      }
    }

    renderBattle();
  }

  function renderBattle() {
    let maxSuspicion = 0;
    cells.forEach((cell) => { if (cell.suspicion > maxSuspicion) maxSuspicion = cell.suspicion; });
    boardButtons.forEach((button, index) => {
      const cell = cells[index];
      button.className = 'battle-cell';
      button.disabled = cell.shot || gameState.won;
      button.textContent = '·';
      if (cell.shot && cell.result) {
        button.classList.add(cell.result);
        button.textContent = cell.result === 'hit' ? '✦' : cell.result === 'near' ? '◌' : '–';
      } else if (suggestedIndex === index && !gameState.won) {
        button.classList.add('suggested');
      }
    });

    heatCells.forEach((node, index) => {
      const cell = cells[index];
      const p = Math.round(cell.suspicion * 100);
      node.className = 'battle-cell';
      const alpha = Math.max(0.08, cell.suspicion);
      const red = Math.round(34 + cell.suspicion * 178);
      const green = Math.round(58 + cell.suspicion * 112);
      const blue = Math.round(82 - cell.suspicion * 36);
      node.style.background = `linear-gradient(180deg, rgba(${red}, ${green}, ${blue}, ${Math.min(0.96, 0.35 + alpha * 0.6)}), rgba(10, 20, 28, 0.92))`;
      node.style.borderColor = `rgba(${red}, ${green}, ${blue}, ${Math.min(0.75, 0.18 + alpha * 0.55)})`;
      node.textContent = String(p);
      if (cell.result === 'hit') {
        node.classList.add('solved-hit');
        node.textContent = '★';
      }
    });

    shotCountNode.textContent = String(gameState.shots);
    hitCountNode.textContent = String(gameState.hits);
    lesionCountNode.textContent = `${gameState.localized} / ${gameState.lesions.length}`;
    bestNode.textContent = suggestedIndex == null ? '—' : indexToLabel(suggestedIndex);
    coverageNode.textContent = `${Math.round((gameState.shots / totalCells) * 100)}%`;
    probNode.textContent = `${Math.round(maxSuspicion * 100)}%`;
    statusNode.textContent = gameState.won ? 'localized' : gameState.shots ? 'tracking' : 'ready';
    copyNode.textContent = gameState.lastMessage;

    hintButton.disabled = gameState.won || suggestedIndex == null;
    randomButton.disabled = gameState.won;
    autoButton.disabled = gameState.won;
  }

  function fireHintedShot() {
    const next = bestSuggestion().index;
    if (next != null) {
      suggestedIndex = next;
      renderBattle();
      gameState.lastMessage = `RBYRCT hint: ${indexToLabel(next)} currently has the highest modeled information value.`;
      copyNode.textContent = gameState.lastMessage;
    }
  }

  function fireRandomShot() {
    const unshot = cells.filter((cell) => !cell.shot);
    if (!unshot.length) return;
    const choice = unshot[Math.floor(Math.random() * unshot.length)];
    fireShot(choice.index, 'random');
  }

  function autoPlayStep() {
    if (gameState.won) {
      autoTimer = null;
      return;
    }
    const next = bestSuggestion().index;
    if (next == null) {
      autoTimer = null;
      return;
    }
    fireShot(next, 'auto');
    if (!gameState.won && gameState.shots < 24) {
      autoTimer = setTimeout(autoPlayStep, 260);
    } else {
      autoTimer = null;
    }
  }

  hintButton.addEventListener('click', fireHintedShot);
  randomButton.addEventListener('click', fireRandomShot);
  autoButton.addEventListener('click', () => {
    if (autoTimer) return;
    gameState.lastMessage = 'Auto-play is running a simple RBYRCT-style greedy search over the belief state.';
    copyNode.textContent = gameState.lastMessage;
    autoTimer = setTimeout(autoPlayStep, 80);
  });
  resetButton.addEventListener('click', initGame);

  initBoards();
  initGame();
}
