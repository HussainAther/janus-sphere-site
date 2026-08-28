(() => {
  const glCanvas = document.querySelector('[data-rbyrct-gl]');
  const reconCanvas = document.querySelector('[data-rbyrct-recon]');
  if (!glCanvas || !reconCanvas) return;

  const angleInput = document.querySelector('[data-steer-angle]');
  const orbitInput = document.querySelector('[data-source-orbit]');
  const relaxInput = document.querySelector('[data-mart-relax]');
  const angleValue = document.querySelector('[data-steer-value]');
  const orbitValue = document.querySelector('[data-orbit-value]');
  const relaxValue = document.querySelector('[data-relax-value]');
  const fireButton = document.querySelector('[data-fire-ray]');
  const autoButton = document.querySelector('[data-auto-scan]');
  const resetButton = document.querySelector('[data-reset-scan]');
  const policyButtons = [...document.querySelectorAll('[data-scan-policy]')];
  const telemetry = {
    count: document.querySelector('[data-ray-count]'),
    integral: document.querySelector('[data-line-integral]'),
    transmission: document.querySelector('[data-transmission]'),
    detector: document.querySelector('[data-detector-signal]'),
    steer: document.querySelector('[data-steer-readout]'),
    policy: document.querySelector('[data-policy-readout]'),
    state: document.querySelector('[data-scan-state]'),
    quality: document.querySelector('[data-scan-quality]'),
  };

  const GRID = 64;
  const I0 = 100000;
  let rayCount = 0;
  let policy = 'manual';
  let autoRunning = false;
  let reconstruction = new Float32Array(GRID * GRID);
  let lastRay = null;

  const policyLabels = {
    manual: 'Manual RBYRCT',
    scout: 'Scout',
    adaptive: 'Adaptive RBYRCT',
    fan: 'Fan baseline',
  };

  function phantomMu(x, y) {
    const r2 = x * x + y * y;
    if (r2 > 0.92 * 0.92) return 0;
    let mu = 0.16;
    const ellipse = (cx, cy, rx, ry) => {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      return dx * dx + dy * dy <= 1;
    };
    if (ellipse(-0.22, 0.16, 0.52, 0.30)) mu += 0.055;
    if (ellipse(0.26, -0.18, 0.46, 0.25)) mu += 0.045;
    if (ellipse(0.12, 0.31, 0.30, 0.17)) mu += 0.035;
    if (ellipse(-0.28, -0.32, 0.24, 0.14)) mu += 0.025;
    const lesion = Math.hypot(x - 0.34, y - 0.18);
    if (lesion < 0.095) mu += 0.22;
    return mu;
  }

  function resetReconstruction() {
    reconstruction = new Float32Array(GRID * GRID);
    for (let j = 0; j < GRID; j += 1) {
      for (let i = 0; i < GRID; i += 1) {
        const x = ((i + 0.5) / GRID) * 2 - 1;
        const y = ((j + 0.5) / GRID) * 2 - 1;
        reconstruction[j * GRID + i] = x * x + y * y <= 0.92 * 0.92 ? 0.14 : 0;
      }
    }
    rayCount = 0;
    lastRay = null;
    updateTelemetry(null);
    drawRecon();
  }

  function rotate(v, a) {
    const c = Math.cos(a);
    const s = Math.sin(a);
    return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
  }

  function geometry() {
    const orbit = Number(orbitInput.value) * Math.PI / 180;
    const steer = Number(angleInput.value) * Math.PI / 180;
    const source = { x: Math.cos(orbit) * 1.32, y: Math.sin(orbit) * 1.32 };
    const towardCenter = { x: -Math.cos(orbit), y: -Math.sin(orbit) };
    const dir = rotate(towardCenter, steer);
    const b = 2 * (source.x * dir.x + source.y * dir.y);
    const c = source.x * source.x + source.y * source.y - 1.32 * 1.32;
    const disc = Math.max(0, b * b - 4 * c);
    const t = (-b + Math.sqrt(disc)) / 2;
    const detector = { x: source.x + dir.x * t, y: source.y + dir.y * t };
    return { source, detector, dir, steer, orbit };
  }

  function traceRay() {
    const g = geometry();
    const samples = 360;
    const dx = (g.detector.x - g.source.x) / samples;
    const dy = (g.detector.y - g.source.y) / samples;
    const ds = Math.hypot(dx, dy);
    let integral = 0;
    const weights = new Map();

    for (let k = 0; k <= samples; k += 1) {
      const x = g.source.x + dx * k;
      const y = g.source.y + dy * k;
      if (x * x + y * y > 0.92 * 0.92) continue;
      integral += phantomMu(x, y) * ds;
      const ix = Math.max(0, Math.min(GRID - 1, Math.floor((x + 1) * 0.5 * GRID)));
      const iy = Math.max(0, Math.min(GRID - 1, Math.floor((y + 1) * 0.5 * GRID)));
      const idx = iy * GRID + ix;
      weights.set(idx, (weights.get(idx) || 0) + ds);
    }

    const transmission = Math.exp(-integral);
    const detectorSignal = Math.round(I0 * transmission);
    const measuredProjection = -Math.log(Math.max(detectorSignal, 1) / I0);
    let estimatedProjection = 0;
    weights.forEach((w, idx) => { estimatedProjection += reconstruction[idx] * w; });

    const relax = Number(relaxInput.value);
    if (estimatedProjection > 1e-8 && measuredProjection > 1e-8) {
      const factor = Math.pow(measuredProjection / estimatedProjection, relax);
      weights.forEach((w, idx) => {
        const localFactor = Math.pow(factor, Math.min(1, w / (2 / GRID)));
        reconstruction[idx] = Math.max(0.015, Math.min(0.62, reconstruction[idx] * localFactor));
      });
    }

    rayCount += 1;
    lastRay = { ...g, integral, transmission, detectorSignal };
    updateTelemetry(lastRay);
    drawRecon();
  }

  function reconGradientTarget() {
    let best = { score: -Infinity, x: 0, y: 0 };
    for (let y = 2; y < GRID - 2; y += 2) {
      for (let x = 2; x < GRID - 2; x += 2) {
        const nx = (x / (GRID - 1)) * 2 - 1;
        const ny = (y / (GRID - 1)) * 2 - 1;
        if (nx * nx + ny * ny > 0.82 * 0.82) continue;
        const gx = reconstruction[y * GRID + x + 1] - reconstruction[y * GRID + x - 1];
        const gy = reconstruction[(y + 1) * GRID + x] - reconstruction[(y - 1) * GRID + x];
        const centerBias = 0.02 * (1 - Math.hypot(nx, ny));
        const score = Math.hypot(gx, gy) + centerBias;
        if (score > best.score) best = { score, x: nx, y: ny };
      }
    }
    return best;
  }

  function steerToPoint(x, y) {
    const orbit = Number(orbitInput.value) * Math.PI / 180;
    const source = { x: Math.cos(orbit) * 1.32, y: Math.sin(orbit) * 1.32 };
    const base = Math.atan2(-source.y, -source.x);
    const aim = Math.atan2(y - source.y, x - source.x);
    let delta = (aim - base) * 180 / Math.PI;
    while (delta > 180) delta -= 360;
    while (delta < -180) delta += 360;
    angleInput.value = Math.max(-44, Math.min(44, delta)).toFixed(1);
    syncControls();
  }

  function chooseNextRay(index) {
    if (policy === 'manual') return;
    if (policy === 'scout') {
      orbitInput.value = String(((rayCount * 17) % 360) - 180);
      angleInput.value = String(-44 + ((rayCount * 23) % 88));
    } else if (policy === 'fan') {
      orbitInput.value = String(((rayCount * 5) % 360) - 180);
      angleInput.value = String(-44 + (index % 9) * 11);
    } else if (policy === 'adaptive') {
      orbitInput.value = String(((rayCount * 19) % 360) - 180);
      if (rayCount < 18) {
        angleInput.value = String(-44 + ((rayCount * 29) % 88));
      } else {
        const target = reconGradientTarget();
        steerToPoint(target.x, target.y);
        const jitter = ((rayCount * 13) % 9) - 4;
        angleInput.value = String(Math.max(-44, Math.min(44, Number(angleInput.value) + jitter)));
      }
    }
    syncControls();
  }

  function updateTelemetry(ray) {
    telemetry.count.textContent = String(rayCount);
    telemetry.policy.textContent = policyLabels[policy];
    telemetry.steer.textContent = `${Number(angleInput.value).toFixed(1)}°`;
    telemetry.state.textContent = autoRunning ? 'acquiring' : rayCount ? 'updated' : 'ready';
    if (!ray) {
      telemetry.integral.textContent = '—';
      telemetry.transmission.textContent = '—';
      telemetry.detector.textContent = '—';
      telemetry.quality.textContent = 'initial estimate';
      return;
    }
    telemetry.integral.textContent = ray.integral.toFixed(4);
    telemetry.transmission.textContent = ray.transmission.toFixed(4);
    telemetry.detector.textContent = ray.detectorSignal.toLocaleString();
    telemetry.quality.textContent = rayCount < 20 ? 'scout structure' : rayCount < 80 ? 'sparse estimate' : 'iterative estimate';
  }

  function drawRecon() {
    const ctx = reconCanvas.getContext('2d');
    const image = ctx.createImageData(GRID, GRID);
    let max = 0.32;
    for (const value of reconstruction) max = Math.max(max, value);
    for (let i = 0; i < reconstruction.length; i += 1) {
      const v = Math.max(0, Math.min(1, reconstruction[i] / max));
      const j = i * 4;
      image.data[j] = Math.round(18 + v * 185);
      image.data[j + 1] = Math.round(34 + v * 198);
      image.data[j + 2] = Math.round(48 + v * 207);
      image.data[j + 3] = reconstruction[i] > 0 ? 255 : 255;
    }
    const tmp = document.createElement('canvas');
    tmp.width = GRID;
    tmp.height = GRID;
    tmp.getContext('2d').putImageData(image, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.clearRect(0, 0, reconCanvas.width, reconCanvas.height);
    ctx.drawImage(tmp, 0, 0, reconCanvas.width, reconCanvas.height);
  }

  const gl = glCanvas.getContext('webgl', { antialias: true, alpha: false });
  if (!gl) return;

  const vertexSource = `
    attribute vec2 aPosition;
    void main(){ gl_Position = vec4(aPosition, 0.0, 1.0); }
  `;
  const fragmentSource = `
    precision highp float;
    uniform vec2 uResolution;
    uniform vec2 uSource;
    uniform vec2 uDetector;
    uniform float uPulse;

    float sdSegment(vec2 p, vec2 a, vec2 b){
      vec2 pa=p-a, ba=b-a;
      float h=clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0);
      return length(pa-ba*h);
    }
    float ellipse(vec2 p, vec2 c, vec2 r){
      vec2 q=(p-c)/r;
      return 1.0-smoothstep(0.96,1.02,dot(q,q));
    }
    void main(){
      vec2 p=(gl_FragCoord.xy/uResolution)*2.0-1.0;
      p.x*=uResolution.x/uResolution.y;
      vec3 bg=vec3(0.018,0.035,0.055);
      vec3 col=bg;
      float body=1.0-smoothstep(0.90,0.93,length(p));
      float tissue=0.0;
      tissue+=ellipse(p,vec2(-0.22,0.16),vec2(0.52,0.30))*0.26;
      tissue+=ellipse(p,vec2(0.26,-0.18),vec2(0.46,0.25))*0.20;
      tissue+=ellipse(p,vec2(0.12,0.31),vec2(0.30,0.17))*0.15;
      float lesion=1.0-smoothstep(0.075,0.105,length(p-vec2(0.34,0.18)));
      vec3 phantom=mix(vec3(0.035,0.13,0.20),vec3(0.08,0.32,0.39),tissue);
      phantom=mix(phantom,vec3(0.91,0.60,0.24),lesion*0.72);
      col=mix(col,phantom,body*0.93);
      float rim=(1.0-smoothstep(0.008,0.018,abs(length(p)-0.92)));
      col+=rim*vec3(0.08,0.72,0.68)*0.55;
      float ray=1.0-smoothstep(0.004,0.012,sdSegment(p,uSource,uDetector));
      float glow=1.0-smoothstep(0.012,0.055,sdSegment(p,uSource,uDetector));
      col+=vec3(0.15,0.92,0.85)*ray*0.95;
      col+=vec3(0.90,0.54,0.20)*glow*(0.18+0.12*sin(uPulse));
      float src=1.0-smoothstep(0.035,0.052,length(p-uSource));
      float det=1.0-smoothstep(0.035,0.052,length(p-uDetector));
      col=mix(col,vec3(0.95,0.62,0.22),src);
      col=mix(col,vec3(0.18,0.82,0.76),det);
      gl_FragColor=vec4(col,1.0);
    }
  `;

  function shader(type, source) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, source);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) return null;
    return sh;
  }
  const program = gl.createProgram();
  gl.attachShader(program, shader(gl.VERTEX_SHADER, vertexSource));
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fragmentSource));
  gl.linkProgram(program);
  const pos = gl.getAttribLocation(program, 'aPosition');
  const uResolution = gl.getUniformLocation(program, 'uResolution');
  const uSource = gl.getUniformLocation(program, 'uSource');
  const uDetector = gl.getUniformLocation(program, 'uDetector');
  const uPulse = gl.getUniformLocation(program, 'uPulse');
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);

  function resizeGL() {
    const rect = glCanvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    glCanvas.width = Math.max(1, Math.floor(rect.width * dpr));
    glCanvas.height = Math.max(1, Math.floor(rect.height * dpr));
    gl.viewport(0, 0, glCanvas.width, glCanvas.height);
  }

  function drawGL(time = 0) {
    resizeGL();
    const g = geometry();
    const aspect = glCanvas.width / glCanvas.height;
    const sx = g.source.x / aspect;
    const dx = g.detector.x / aspect;
    gl.useProgram(program);
    gl.enableVertexAttribArray(pos);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(uResolution, glCanvas.width, glCanvas.height);
    gl.uniform2f(uSource, sx, g.source.y);
    gl.uniform2f(uDetector, dx, g.detector.y);
    gl.uniform1f(uPulse, time * 0.008);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    requestAnimationFrame(drawGL);
  }

  function syncControls() {
    angleValue.textContent = `${Number(angleInput.value).toFixed(1)}°`;
    orbitValue.textContent = `${Number(orbitInput.value).toFixed(0)}°`;
    relaxValue.textContent = Number(relaxInput.value).toFixed(2);
    telemetry.steer.textContent = `${Number(angleInput.value).toFixed(1)}°`;
  }

  angleInput.addEventListener('input', syncControls);
  orbitInput.addEventListener('input', syncControls);
  relaxInput.addEventListener('input', syncControls);

  glCanvas.addEventListener('pointerdown', (event) => {
    if (policy !== 'manual') setPolicy('manual');
    const rect = glCanvas.getBoundingClientRect();
    const aspect = rect.width / rect.height;
    let x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = (1 - (event.clientY - rect.top) / rect.height) * 2 - 1;
    x *= aspect;
    steerToPoint(x, y);
    glCanvas.setPointerCapture(event.pointerId);
  });
  glCanvas.addEventListener('pointermove', (event) => {
    if (!glCanvas.hasPointerCapture(event.pointerId)) return;
    const rect = glCanvas.getBoundingClientRect();
    const aspect = rect.width / rect.height;
    let x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = (1 - (event.clientY - rect.top) / rect.height) * 2 - 1;
    x *= aspect;
    steerToPoint(x, y);
  });

  function setPolicy(next) {
    policy = next;
    policyButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.scanPolicy === next));
    telemetry.policy.textContent = policyLabels[policy];
    autoButton.textContent = policy === 'fan' ? 'Run fan bundle' : 'Run 64 rays';
  }

  policyButtons.forEach(btn => btn.addEventListener('click', () => setPolicy(btn.dataset.scanPolicy)));
  fireButton.addEventListener('click', () => {
    chooseNextRay(rayCount);
    traceRay();
  });
  resetButton.addEventListener('click', () => {
    autoRunning = false;
    autoButton.disabled = false;
    fireButton.disabled = false;
    resetReconstruction();
  });
  autoButton.addEventListener('click', async () => {
    if (autoRunning) return;
    autoRunning = true;
    autoButton.disabled = true;
    fireButton.disabled = true;
    updateTelemetry(lastRay);
    const total = policy === 'fan' ? 72 : 64;
    for (let i = 0; i < total && autoRunning; i += 1) {
      chooseNextRay(i);
      traceRay();
      await new Promise(resolve => setTimeout(resolve, 22));
    }
    autoRunning = false;
    autoButton.disabled = false;
    fireButton.disabled = false;
    updateTelemetry(lastRay);
  });

  window.addEventListener('resize', resizeGL);
  resetReconstruction();
  syncControls();
  requestAnimationFrame(drawGL);
})();
