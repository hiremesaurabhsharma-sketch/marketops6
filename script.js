import './workspace.js';

document.addEventListener('DOMContentLoaded', () => {
  // --- Global Loader ---
  const loader = document.getElementById('loader');
  if (loader) {
    const hideLoader = () => {
      setTimeout(() => {
        loader.classList.add('hidden');
      }, 350);
    };

    if (document.readyState === 'complete') {
      hideLoader();
    } else {
      window.addEventListener('load', hideLoader);
      // Fast fallback to guarantee working site responsiveness
      setTimeout(hideLoader, 1200);
    }
  }

  // --- Initialize Lucide Icons ---
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  // --- Dynamic Cursor Glow Movement ---
  const cursorGlow = document.getElementById('cursor-glow');
  if (cursorGlow && window.matchMedia('(pointer: fine)').matches) {
    document.addEventListener('mousemove', (e) => {
      cursorGlow.style.left = `${e.clientX}px`;
      cursorGlow.style.top = `${e.clientY}px`;
    });
  }

  // --- Transparent View To Glassmorphic Blurry Bar ---
  const header = document.getElementById('header');
  if (header) {
    const handleScroll = () => {
      if (window.scrollY > 40) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    };
    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Run initially
  }

  // --- Smooth Mobile Hamburger Drawer Menu Toggle ---
  const hamburger = document.getElementById('hamburger');
  const navMenu = document.getElementById('nav-menu');

  if (hamburger && navMenu) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('active');
      navMenu.classList.toggle('active');
      document.body.classList.toggle('overflow-hidden');
    });

    // Close menu when clicking a ordinary nav link or a dropdown link
    const navLinks = navMenu.querySelectorAll('.nav-link:not(.dropdown-toggle), .dropdown-link');
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        navMenu.classList.remove('active');
        document.body.classList.remove('overflow-hidden');
      });
    });

    // Mobile services dropdown support
    const dropdownToggle = navMenu.querySelector('.dropdown-toggle');
    const dropdownItem = navMenu.querySelector('.nav-item-dropdown');
    if (dropdownToggle && dropdownItem) {
      dropdownToggle.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
          e.preventDefault();
          dropdownItem.classList.toggle('active-dropdown');
        }
      });
    }
  }

  // --- Active Link Detection for Multi-page Navigation ---
  const currentPath = window.location.pathname;
  const pageName = currentPath.split('/').pop() || 'index.html';
  const navLinksList = document.querySelectorAll('.nav-link');

  navLinksList.forEach(link => {
    const href = link.getAttribute('href');
    if (href) {
      const linkPage = href.split('/').pop() || 'index.html';
      if (pageName === linkPage) {
        link.classList.add('active');
      } else if (pageName === '' && linkPage === 'index.html') {
        link.classList.add('active');
      }
    }
  });

  // --- FAQ Accordion Collapsible Elements ---
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');
    if (question) {
      question.addEventListener('click', () => {
        const isActive = item.classList.contains('active');
        
        // Optional: Close all other FAQ items
        faqItems.forEach(otherItem => {
          if (otherItem !== item) {
            otherItem.classList.remove('active');
          }
        });

        // Toggle active on current item
        if (isActive) {
          item.classList.remove('active');
        } else {
          item.classList.add('active');
        }
      });
    }
  });

  // --- Scroll-Reveal Logic via IntersectionObserver ---
  const reveals = document.querySelectorAll('.reveal');
  const revealCallback = (entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
        observer.unobserve(entry.target); // Reveal once
      }
    });
  };

  const revealObserver = new IntersectionObserver(revealCallback, {
    root: null, // viewport
    rootMargin: '0px 0px -100px 0px', // Trigger slightly before screen bottom
    threshold: 0.1
  });

  reveals.forEach(reveal => {
    revealObserver.observe(reveal);
  });

  // --- Animated Numeric Counters ---
  const counts = document.querySelectorAll('.stat-num');
  const countCallback = (entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const target = entry.target;
        const targetValAttr = target.getAttribute('data-target');
        if (!targetValAttr) return;

        // Parse absolute numbers (handling suffix '+' or '$')
        const targetClean = targetValAttr.replace(/[^0-9.]/g, '');
        const targetVal = parseFloat(targetClean);
        const prefix = targetValAttr.startsWith('$') ? '$' : '';
        const suffix = targetValAttr.endsWith('+') ? '+' : (targetValAttr.endsWith('M+') ? 'M+' : '');

        let startVal = 0;
        const duration = 2000; // ms
        const startTime = performance.now();

        const animateCount = (currentTime) => {
          const elapsedTime = currentTime - startTime;
          const progress = Math.min(elapsedTime / duration, 1);
          
          // Easing: easeOutQuad
          const easeProgress = progress * (2 - progress);
          const currentVal = Math.floor(easeProgress * targetVal);

          if (targetVal < 10) {
            target.textContent = `${prefix}${parseFloat((easeProgress * targetVal).toFixed(1))}${suffix}`;
          } else {
            target.textContent = `${prefix}${currentVal}${suffix}`;
          }

          if (progress < 1) {
            requestAnimationFrame(animateCount);
          } else {
            target.textContent = targetValAttr; // set original input exactly at the end
          }
        };

        requestAnimationFrame(animateCount);
        observer.unobserve(target); // Animate once
      }
    });
  };

  const countObserver = new IntersectionObserver(countCallback, {
    root: null,
    rootMargin: '0px 0px -50px 0px',
    threshold: 0.1
  });

  counts.forEach(count => {
    countObserver.observe(count);
  });

  // --- Extra Visual: Subtle Canvas Parallax or Micro-interactive elements ---
  const glassCards = document.querySelectorAll('.glass-card');
  glassCards.forEach(card => {
    card.addEventListener('mouseenter', () => {
      if (typeof lucide !== 'undefined') {
        const icon = card.querySelector('[data-lucide]');
        if (icon) {
          icon.style.transform = 'scale(1.15) rotate(5deg)';
          icon.style.transition = 'transform 0.3s ease';
        }
      }
    });
    card.addEventListener('mouseleave', () => {
      if (typeof lucide !== 'undefined') {
        const icon = card.querySelector('[data-lucide]');
        if (icon) {
          icon.style.transform = 'scale(1) rotate(0deg)';
        }
      }
    });
  });

  // --- Dynamic Persistent Floating WhatsApp Call/Chat Redirect Button ---
  const whatsappBtn = document.createElement('a');
  whatsappBtn.href = 'https://wa.me/919424995426';
  whatsappBtn.target = '_blank';
  whatsappBtn.rel = 'noopener noreferrer';
  whatsappBtn.className = 'whatsapp-float';
  whatsappBtn.ariaLabel = 'Contact via WhatsApp';
  whatsappBtn.innerHTML = `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.412c-3.41 0-6.473-1.766-8.223-4.473l-.326-.51-2.942.77 1.015-2.87-.136-.211C.802 12.512.23 9.837.23 7.045C.23 3.155 3.391 0 7.284 0C11.173 0 14.34 3.158 14.34 7.049c0 3.896-3.167 7.05-7.058 7.05a7.022 7.022 0 0 1-3.23-.782l-2.02.53 1.026-2.906c-.84-1.397-1.272-2.986-1.272-4.63C2.81 2.809 6.004 0 9.943 0c3.938 0 7.142 3.21 7.142 7.143c0 3.93-3.204 7.139-7.142 7.139v.001zm9.193-18.617C19.333 1.151 16.51 0 12.24 0C5.494 0 .025 5.467.025 12.213c0 2.155.562 4.26 1.63 6.11L0 24l5.895-1.547a12.148 12.148 0 0 0 6.345 1.76c6.743 0 12.213-5.47 12.213-12.213c0-3.268-1.274-6.34-3.593-8.625z"/>
    </svg>
  `;
  document.body.appendChild(whatsappBtn);
});
