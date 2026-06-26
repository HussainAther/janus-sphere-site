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
