/**
 * Core Lab — Unified JavaScript Interactions & Theme Engine
 */

// Immediate theme execution to prevent flash
// Default is ALWAYS dark. Light can be toggled but dark is the baseline.
(function() {
  const saved = localStorage.getItem('corelab_theme');
  // If no saved preference, or saved preference was 'light' from an older session
  // we want dark as the default. Only honour 'light' if explicitly set.
  const theme = (saved === 'light') ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', theme);
})();

document.addEventListener('DOMContentLoaded', () => {
  initThemeToggle();
  initStickyHeader();
  initMobileNavigation();
  initActiveNavLinks();
  initFaqAccordion();
  initProgramFilters();
  initProjectFilters();
  initHeroCanvas();
});

/* ==========================================================================
   Theme Switcher Engine (Dark / Light)
   ========================================================================== */
function initThemeToggle() {
  const getPreferredTheme = () => {
    return localStorage.getItem('corelab_theme') || 'dark';
  };

  const applyTheme = (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('corelab_theme', theme);

    // Update all toggle buttons in header and mobile drawer
    const toggleBtns = document.querySelectorAll('.theme-toggle-btn');
    toggleBtns.forEach(btn => {
      const isDark = theme === 'dark';
      btn.setAttribute('aria-label', isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode');
      btn.setAttribute('title', isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode');
    });

    // Notify canvas or other listeners
    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
  };

  const currentTheme = getPreferredTheme();
  applyTheme(currentTheme);

  // Bind clicks
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.theme-toggle-btn');
    if (!btn) return;
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  });
}

/* ==========================================================================
   0. Sticky Header Elevation on Scroll
   ========================================================================== */
function initStickyHeader() {
  const header = document.querySelector('header');
  if (!header) return;

  const onScroll = () => {
    if (window.scrollY > 15) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* ==========================================================================
   1. Mobile Drawer Navigation
   ========================================================================== */
function initMobileNavigation() {
  const toggleBtn = document.querySelector('.mobile-toggle');
  const drawer = document.querySelector('.mobile-drawer');

  if (!toggleBtn || !drawer) return;

  toggleBtn.addEventListener('click', () => {
    const isOpen = drawer.classList.toggle('open');
    toggleBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });

  // Close drawer when clicking outside drawer content
  drawer.addEventListener('click', (e) => {
    if (e.target === drawer) {
      drawer.classList.remove('open');
      toggleBtn.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }
  });

  // Close drawer when a navigation link is clicked
  const drawerLinks = drawer.querySelectorAll('a:not(.theme-toggle-btn)');
  drawerLinks.forEach(link => {
    link.addEventListener('click', () => {
      drawer.classList.remove('open');
      toggleBtn.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    });
  });
}

/* ==========================================================================
   2. Active Nav Link Detection
   ========================================================================== */
function initActiveNavLinks() {
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  const navLinks = document.querySelectorAll('.nav-link, .mobile-drawer a');

  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (!href) return;

    // Direct match or root home match
    if (href === currentPath || 
       (currentPath === '' && href === 'index.html') ||
       (currentPath === 'index.html' && href === 'index.html') ||
       (href.replace('.html', '') === currentPath.replace('.html', ''))) {
      link.classList.add('active');
    }
  });
}

/* ==========================================================================
   3. FAQ Accordion
   ========================================================================== */
function initFaqAccordion() {
  const faqItems = document.querySelectorAll('.faq-item');
  const catButtons = document.querySelectorAll('.faq-cat-btn');

  faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');
    const answer = item.querySelector('.faq-answer');

    if (!question || !answer) return;

    question.addEventListener('click', () => {
      const isActive = item.classList.contains('active');

      // Close other accordion items in the same section
      faqItems.forEach(other => {
        if (other !== item) {
          other.classList.remove('active');
          const otherAnswer = other.querySelector('.faq-answer');
          if (otherAnswer) otherAnswer.style.maxHeight = null;
        }
      });

      // Toggle current item
      if (!isActive) {
        item.classList.add('active');
        answer.style.maxHeight = answer.scrollHeight + 30 + 'px';
      } else {
        item.classList.remove('active');
        answer.style.maxHeight = null;
      }
    });
  });

  // Category Filtering for FAQs
  if (catButtons.length) {
    catButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        catButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const cat = btn.getAttribute('data-cat');
        faqItems.forEach(item => {
          const itemCat = item.getAttribute('data-cat');
          if (cat === 'all' || itemCat === cat) {
            item.style.display = 'block';
          } else {
            item.style.display = 'none';
          }
        });
      });
    });
  }
}

/* ==========================================================================
   4. Filterable Grids (Programs & Projects)
   ========================================================================== */
function initProgramFilters() {
  const filterBtns = document.querySelectorAll('.prog-filter-btn');
  const courseCards = document.querySelectorAll('.schedule-section .course-card, #courses .course-card, .courses-grid-4 .course-card');

  if (!filterBtns.length || !courseCards.length) return;

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filter = btn.getAttribute('data-filter');
      courseCards.forEach(card => {
        const category = card.getAttribute('data-category');
        if (filter === 'all' || category === filter) {
          card.style.display = 'flex';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });
}

function initProjectFilters() {
  const filterBtns = document.querySelectorAll('.project-filter-btn');
  const projectCards = document.querySelectorAll('.projects-grid .project-card');

  if (!filterBtns.length || !projectCards.length) return;

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filter = btn.getAttribute('data-filter');
      projectCards.forEach(card => {
        const category = card.getAttribute('data-category');
        if (filter === 'all' || category === filter) {
          card.style.display = 'flex';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });
}

/* ==========================================================================
   5. Dynamic Technical Canvas (Particles & Constellations)
   ========================================================================== */
function initHeroCanvas() {
  const canvas = document.getElementById('heroCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let width, height;
  let particles = [];
  const particleCount = 48;

  function resize() {
    if (!canvas.parentElement) return;
    width = canvas.width = canvas.parentElement.offsetWidth;
    height = canvas.height = canvas.parentElement.offsetHeight;
  }

  window.addEventListener('resize', resize);
  resize();

  const getThemePalette = () => {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    return isDark 
      ? ['#38bdf8', '#3b82f6', '#818cf8', '#22d3ee', '#60a5fa'] 
      : ['#c2521a', '#1d4ed8', '#2d7a4f', '#5b3fa0', '#e07040'];
  };

  class Particle {
    constructor() {
      this.reset();
    }
    reset() {
      this.x = Math.random() * width;
      this.y = Math.random() * height;
      this.vx = (Math.random() - 0.5) * 0.6;
      this.vy = (Math.random() - 0.5) * 0.6;
      this.radius = Math.random() * 2.5 + 1.8;  // 1.8–4.3px dots
      this.alpha = Math.random() * 0.2 + 0.6;   // 0.6–0.8
      const palette = getThemePalette();
      this.color = palette[Math.floor(Math.random() * palette.length)];
    }
    update() {
      this.x += this.vx;
      this.y += this.vy;

      if (this.x < 0 || this.x > width) this.vx *= -1;
      if (this.y < 0 || this.y > height) this.vy *= -1;
    }
    draw() {
      const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.globalAlpha = this.alpha;
      ctx.shadowBlur = isDark ? 10 : 6;
      ctx.shadowColor = this.color;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  function initParticles() {
    particles = [];
    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle());
    }
  }
  initParticles();

  // Listen to theme switch and refresh particle colors
  window.addEventListener('themechange', () => {
    const palette = getThemePalette();
    particles.forEach(p => {
      p.color = palette[Math.floor(Math.random() * palette.length)];
    });
  });

  function animate() {
    ctx.clearRect(0, 0, width, height);
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

    // Draw connecting constellation lines
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 150) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = isDark ? '#38bdf8' : '#c2521a';
          ctx.globalAlpha = (1 - dist / 150) * (isDark ? 0.4 : 0.5);
          ctx.lineWidth = isDark ? 1 : 1.2;
          ctx.stroke();
        }
      }
    }

    // Update and draw particles
    particles.forEach(p => {
      p.update();
      p.draw();
    });

    requestAnimationFrame(animate);
  }

  animate();
}
