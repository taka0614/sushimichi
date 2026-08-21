document.addEventListener("DOMContentLoaded", () => {
  const reduceMotionQuery = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  );
  const desktopPondQuery = window.matchMedia("(min-width: 961px)");
  const mobileMenuQuery = window.matchMedia("(max-width: 960px)");
  const menuToggle = document.querySelector(".menu-toggle");
  const mobileMenu = document.querySelector("#mobile-menu");
  const mobilePondElement = document.querySelector("#mobile-koi-pond");
  const desktopPondElement = document.querySelector("#koi-pond");
  const content = document.querySelector(".content-scroll");
  let desktopPond = null;
  let mobilePond = null;
  let menuIsOpen = false;
  let closeTimer = 0;

  const createPond = (element, config = {}) => {
    if (!element || typeof window.KoiPond !== "function") return null;
    const pond = new window.KoiPond(element, config);
    pond.start();
    return pond;
  };

  const syncDesktopPond = () => {
    if (desktopPondQuery.matches && !desktopPond) {
      desktopPond = createPond(desktopPondElement, {
        keepFishFullyVisible: true,
      });
      return;
    }

    if (!desktopPondQuery.matches && desktopPond) {
      desktopPond.destroy();
      desktopPond = null;
    }
  };

  const focusableMenuItems = () => [
    menuToggle,
    ...mobileMenu.querySelectorAll("a[href], button:not([disabled])"),
  ].filter(Boolean);

  const closeMenu = ({ returnFocus = false } = {}) => {
    if (!mobileMenu || !menuToggle) return;

    menuIsOpen = false;
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "メニューを開く");
    mobileMenu.classList.remove("is-open");
    mobileMenu.setAttribute("aria-hidden", "true");
    document.documentElement.classList.remove("menu-open");
    document.body.classList.remove("menu-open");

    if (content) {
      content.inert = false;
      content.removeAttribute("aria-hidden");
    }

    window.clearTimeout(closeTimer);
    const delay = reduceMotionQuery.matches ? 0 : 320;
    closeTimer = window.setTimeout(() => {
      if (menuIsOpen) return;
      mobileMenu.hidden = true;
      if (mobilePond) {
        mobilePond.destroy();
        mobilePond = null;
      }
    }, delay);

    if (returnFocus) menuToggle.focus();
  };

  const openMenu = () => {
    if (!mobileMenu || !menuToggle || !mobileMenuQuery.matches) return;

    window.clearTimeout(closeTimer);
    menuIsOpen = true;
    mobileMenu.hidden = false;
    mobileMenu.setAttribute("aria-hidden", "false");
    menuToggle.setAttribute("aria-expanded", "true");
    menuToggle.setAttribute("aria-label", "メニューを閉じる");
    document.documentElement.classList.add("menu-open");
    document.body.classList.add("menu-open");

    if (content) {
      content.inert = true;
      content.setAttribute("aria-hidden", "true");
    }

    window.requestAnimationFrame(() => {
      mobileMenu.classList.add("is-open");
      if (!mobilePond) mobilePond = createPond(mobilePondElement);
      mobileMenu.querySelector("a[href]")?.focus();
    });
  };

  menuToggle?.addEventListener("click", () => {
    if (menuIsOpen) {
      closeMenu({ returnFocus: true });
    } else {
      openMenu();
    }
  });

  mobileMenu?.querySelectorAll("a[href]").forEach((link) => {
    link.addEventListener("click", () => closeMenu());
  });

  document.addEventListener("keydown", (event) => {
    if (!menuIsOpen) return;

    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu({ returnFocus: true });
      return;
    }

    if (event.key !== "Tab") return;
    const items = focusableMenuItems();
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  mobileMenuQuery.addEventListener("change", (event) => {
    if (!event.matches && menuIsOpen) closeMenu();
  });
  desktopPondQuery.addEventListener("change", syncDesktopPond);
  syncDesktopPond();

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      const href = link.getAttribute("href");
      if (!href || href === "#") return;

      const target = document.getElementById(href.slice(1));
      if (!target) return;

      event.preventDefault();
      if (link.classList.contains("skip-link")) {
        target.focus({ preventScroll: true });
      }

      const scrollToAnchor = () => {
        const behavior = reduceMotionQuery.matches ? "auto" : "smooth";

        // On mobile, #top is the <main> element below the sticky header.
        // scrollIntoView() would align that element with the viewport top and
        // leave the header out of position. Return to the document origin
        // instead so the header and hero always resume their initial layout.
        if (href === "#top" && mobileMenuQuery.matches) {
          window.scrollTo({ top: 0, left: 0, behavior });
        } else {
          target.scrollIntoView({ behavior, block: "start" });
        }

        history.replaceState(null, "", href);
      };

      // The menu link handler unlocks page scrolling first. Waiting one frame
      // prevents the anchor movement from being calculated against the locked
      // menu state.
      if (link.closest("#mobile-menu")) {
        window.requestAnimationFrame(scrollToAnchor);
      } else {
        scrollToAnchor();
      }
    });
  });
});
