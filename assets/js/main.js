(() => {
  const root = document.documentElement;
  const header = document.querySelector('.site-header');
  const themeButton = document.querySelector('.theme-toggle');
  const navButton = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.main-nav');

  const effectiveTheme = (theme) => {
    if (theme !== 'system') return theme;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };

  const syncGiscusTheme = (theme) => {
    const iframe = document.querySelector('iframe.giscus-frame');
    if (!iframe) return;
    iframe.contentWindow.postMessage({
      giscus: { setConfig: { theme: effectiveTheme(theme) === 'dark' ? 'dark' : 'light' } }
    }, 'https://giscus.app');
  };

  themeButton?.addEventListener('click', () => {
    const current = root.dataset.theme || 'system';
    const next = current === 'system' ? 'dark' : current === 'dark' ? 'light' : 'system';
    root.dataset.theme = next;
    localStorage.setItem('theme', next);
    syncGiscusTheme(next);
  });

  const setNavOpen = (open) => {
    if (!nav || !navButton) return;
    nav.classList.toggle('open', open);
    navButton.setAttribute('aria-expanded', String(open));
  };

  navButton?.addEventListener('click', () => setNavOpen(!nav?.classList.contains('open')));
  nav?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setNavOpen(false)));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setNavOpen(false);
  });
  document.addEventListener('click', (event) => {
    if (!nav?.classList.contains('open')) return;
    if (!nav.contains(event.target) && !navButton?.contains(event.target)) setNavOpen(false);
  });

  const syncHeader = () => header?.classList.toggle('scrolled', window.scrollY > 18);
  syncHeader();
  window.addEventListener('scroll', syncHeader, { passive: true });

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -20px' });
    document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
  } else {
    document.querySelectorAll('.reveal').forEach((el) => el.classList.add('visible'));
  }

  const visual = document.querySelector('.architecture-visual');
  if (visual && window.matchMedia('(pointer: fine)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    visual.addEventListener('pointermove', (event) => {
      const rect = visual.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      visual.style.transform = `perspective(1200px) rotateY(${x * 3 - 2}deg) rotateX(${y * -3 + 1}deg)`;
    });
    visual.addEventListener('pointerleave', () => {
      visual.style.transform = 'perspective(1200px) rotateY(-2deg) rotateX(1deg)';
    });
  }

  const searchPage = document.querySelector('[data-search-page]');
  if (searchPage) {
    const input = searchPage.querySelector('.search-input');
    const results = searchPage.querySelector('.search-results');
    const status = searchPage.querySelector('.search-status');
    let index = [];

    fetch(searchPage.dataset.searchIndex || '/search-index.json')
      .then((response) => {
        if (!response.ok) throw new Error('Search index unavailable');
        return response.json();
      })
      .then((data) => { index = data; })
      .catch(() => { status.textContent = '搜索索引加载失败，请稍后重试。'; });

    const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[char]));

    input?.addEventListener('input', () => {
      const query = input.value.trim().toLocaleLowerCase();
      results.innerHTML = '';
      if (query.length < 2) {
        status.textContent = '至少输入两个字符。';
        return;
      }
      const matches = index.filter((item) => {
        const haystack = [item.title, item.summary, item.content, ...(item.tags || [])].join(' ').toLocaleLowerCase();
        return haystack.includes(query);
      }).slice(0, 20);

      status.textContent = matches.length ? `找到 ${matches.length} 条结果。` : '没有找到匹配内容。';
      results.innerHTML = matches.map((item) => `
        <article class="content-card visible">
          <div class="card-icon">✦</div>
          <div class="card-meta"><span>${escapeHtml(item.section)}</span><time>${escapeHtml(item.date)}</time></div>
          <h3><a href="${escapeHtml(item.url)}">${escapeHtml(item.title)}</a></h3>
          <p>${escapeHtml(item.summary)}</p>
          <div class="card-footer"><span></span><a class="card-arrow" href="${escapeHtml(item.url)}">↗</a></div>
        </article>
      `).join('');
    });
  }
})();
