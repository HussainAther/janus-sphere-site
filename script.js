const evidenceImages = {
  butterfly: {
    src: 'assets/butterfly-ground-truth.png',
    alt: 'Butterfly phantom ground truth',
    caption: 'Butterfly ground truth, used as a textured reconstruction target.',
  },
  marilyn: {
    src: 'assets/marilyn-ground-truth.png',
    alt: 'Marilyn phantom ground truth',
    caption: 'Marilyn ground truth from the RBYRCT evidence panel.',
  },
  random: {
    src: 'assets/shepp-random-1200.png',
    alt: 'Shepp-Logan random ray reconstruction at 1200 rays',
    caption: 'Random 1.2k ray reconstruction showing sparse coverage behavior.',
  },
  fan: {
    src: 'assets/shepp-fan-1200.png',
    alt: 'Shepp-Logan fan ray reconstruction at 1200 rays',
    caption: 'Fan 1.2k ray reconstruction used as a structured baseline.',
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
