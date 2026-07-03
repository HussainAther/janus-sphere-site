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

const canvas = document.querySelector('[data-ray-canvas]');
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
