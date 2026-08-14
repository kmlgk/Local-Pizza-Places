/* ==========================================================================
   Ember & Forno — shared front-end logic (vanilla JS, no build step).
   Namespaced on window.EF so page-specific inline scripts (menu builder,
   checkout, dashboard) can call the cart/order/auth helpers directly.
   ========================================================================== */
(function () {
  "use strict";

  const LS = {
    theme: "ef_theme",
    dir: "ef_dir",
    cart: "ef_cart",
    users: "ef_users",
    session: "ef_session",
    orders: "ef_orders",
  };

  /* ---------------------------------------------------------------------
     Order status stages — timestamps are milliseconds after placement.
     Kept short on purpose so the "live" tracker is actually observable
     during a demo without waiting hours for a real delivery window.
  --------------------------------------------------------------------- */
  const STAGES = [
    { key: "received", label: "Order Received", icon: "fa-receipt", at: 0 },
    { key: "preparing", label: "Preparing", icon: "fa-kitchen-set", at: 25000 },
    { key: "oven", label: "In the Oven", icon: "fa-fire-burner", at: 70000 },
    { key: "delivery", label: "Out for Delivery", icon: "fa-motorcycle", at: 130000 },
    { key: "delivered", label: "Delivered", icon: "fa-circle-check", at: 200000 },
  ];

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function writeJSON(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }

  /* ---------------------------- Theme ---------------------------- */
  function initTheme() {
    const saved = localStorage.getItem(LS.theme);
    const prefers = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = saved ? saved === "dark" : prefers;
    document.documentElement.classList.toggle("dark", isDark);
    syncThemeUI(isDark);
  }
  function toggleTheme() {
    const isDark = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem(LS.theme, isDark ? "dark" : "light");
    syncThemeUI(isDark);
  }
  function syncThemeUI(isDark) {
    document.querySelectorAll(".theme-switch").forEach((btn) => {
      btn.setAttribute("aria-checked", String(isDark));
      const icon = btn.querySelector("i");
      if (icon) icon.className = isDark ? "fa-solid fa-moon" : "fa-solid fa-sun";
    });
  }

  /* ---------------------------- Direction ---------------------------- */
  function initDir() {
    const saved = localStorage.getItem(LS.dir) || "ltr";
    applyDir(saved);
  }
  function applyDir(dir) {
    // Suppress transitions for a couple of frames: the nav-drawer's closed-state
    // transform sign flips between LTR and RTL, and without this its own
    // `transition: transform` would animate through translateX(0) — the same
    // value as its open state — making the closed drawer flash into view.
    document.documentElement.classList.add("dir-changing");
    document.documentElement.setAttribute("dir", dir);
    document.documentElement.setAttribute("lang", dir === "rtl" ? "ar" : "en");
    localStorage.setItem(LS.dir, dir);
    document.querySelectorAll(".dir-switch").forEach((btn) => {
      const isRtl = dir === "rtl";
      btn.setAttribute("aria-pressed", String(isRtl));
      btn.setAttribute("aria-label", isRtl ? "Switch to English (LTR)" : "Switch to Arabic (RTL)");
      const label = btn.querySelector(".dir-switch-label");
      if (label) label.textContent = isRtl ? "LTR" : "RTL";
    });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.documentElement.classList.remove("dir-changing");
      });
    });
  }
  function bindDirSwitches() {
    document.querySelectorAll(".dir-switch").forEach((btn) => {
      btn.addEventListener("click", () => {
        const current = document.documentElement.getAttribute("dir") || "ltr";
        applyDir(current === "rtl" ? "ltr" : "rtl");
      });
    });
  }

  /* ---------------------------- Header scroll state ---------------------------- */
  function initHeaderScroll() {
    const header = document.querySelector(".site-header");
    if (!header) return;
    const onScroll = () => header.classList.toggle("is-compact", window.scrollY > 30);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---------------------------- Back to top ---------------------------- */
  function initBackToTop() {
    const btn = document.querySelector(".back-to-top");
    if (!btn) return;
    window.addEventListener(
      "scroll",
      () => btn.classList.toggle("is-visible", window.scrollY > 500),
      { passive: true }
    );
    btn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  /* ---------------------------- Page loader ---------------------------- */
  function initPageLoader() {
    const loader = document.getElementById("page-loader");
    if (!loader) return;
    const hide = () => loader.classList.add("is-hidden");
    if (document.readyState === "complete") hide();
    else window.addEventListener("load", hide);
    setTimeout(hide, 1200);
  }

  /* ---------------------------- Image fallback ---------------------------- */
  function initImageFallback() {
    document.querySelectorAll("img.ph-img").forEach((img) => {
      img.addEventListener(
        "error",
        () => {
          img.style.visibility = "hidden";
        },
        { once: true }
      );
    });
  }

  /* ---------------------------- Nav drawer (standard hamburger menu, all breakpoints below xl) ---------------------------- */
  function initNavDrawer() {
    const btn = document.getElementById("navMenuBtn");
    const drawer = document.getElementById("navDrawer");
    const backdrop = document.getElementById("navBackdrop");
    const closeBtn = document.getElementById("navCloseBtn");
    if (!btn || !drawer) return;

    const open = () => {
      drawer.classList.add("is-open");
      backdrop.classList.add("is-open");
      document.body.classList.add("no-scroll");
      btn.setAttribute("aria-expanded", "true");
      const cartDrawer = document.getElementById("cartDrawer");
      const cartBackdrop = document.getElementById("cartBackdrop");
      cartDrawer && cartDrawer.classList.remove("is-open");
      cartBackdrop && cartBackdrop.classList.remove("is-open");
    };
    const close = () => {
      drawer.classList.remove("is-open");
      backdrop.classList.remove("is-open");
      document.body.classList.remove("no-scroll");
      btn.setAttribute("aria-expanded", "false");
    };
    btn.addEventListener("click", () => (drawer.classList.contains("is-open") ? close() : open()));
    closeBtn && closeBtn.addEventListener("click", close);
    backdrop && backdrop.addEventListener("click", close);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });
    window.addEventListener("resize", () => {
      if (window.innerWidth >= 1280) close();
    });
  }

  /* ---------------------------- Desktop "Home" dropdown ---------------------------- */
  function initHomeDropdown() {
    const btn = document.getElementById("homeMenuBtn");
    const panel = document.getElementById("homeMenuPanel");
    if (!btn || !panel) return;
    let open = false;
    const setOpen = (v) => {
      open = v;
      panel.classList.toggle("hidden", !open);
      btn.setAttribute("aria-expanded", String(open));
    };
    btn.addEventListener("click", () => setOpen(!open));
    document.addEventListener("click", (e) => {
      if (!btn.contains(e.target) && !panel.contains(e.target)) setOpen(false);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") setOpen(false);
    });
  }

  /* ---------------------------- Toast ---------------------------- */
  function showToast(msg) {
    let toast = document.querySelector(".toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "toast";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add("is-visible");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toast.classList.remove("is-visible"), 2600);
  }

  /* ---------------------------- Cart ---------------------------- */
  function getCart() {
    return readJSON(LS.cart, []);
  }
  function saveCart(cart) {
    writeJSON(LS.cart, cart);
    renderCartBadges();
    renderCartDrawer();
  }
  function addToCart(item) {
    const cart = getCart();
    const existing = cart.find((l) => l.lineId === item.lineId);
    if (existing) existing.qty += item.qty || 1;
    else cart.push(Object.assign({ qty: 1 }, item));
    saveCart(cart);
    showToast(`${item.name} added to cart`);
  }
  function changeQty(lineId, delta) {
    const cart = getCart();
    const line = cart.find((l) => l.lineId === lineId);
    if (!line) return;
    line.qty += delta;
    const next = cart.filter((l) => l.qty > 0);
    saveCart(line.qty > 0 ? cart : next);
  }
  function removeLine(lineId) {
    saveCart(getCart().filter((l) => l.lineId !== lineId));
  }
  function clearCart() {
    saveCart([]);
  }
  function cartCount(cart) {
    return (cart || getCart()).reduce((sum, l) => sum + l.qty, 0);
  }
  function cartTotal(cart) {
    return (cart || getCart()).reduce((sum, l) => sum + l.qty * l.price, 0);
  }
  function renderCartBadges() {
    const count = cartCount();
    document.querySelectorAll(".cart-count, .tab-badge").forEach((el) => {
      el.textContent = String(count);
      el.style.display = count > 0 ? "flex" : "none";
    });
  }
  function renderCartDrawer() {
    const list = document.getElementById("cartItems");
    const emptyState = document.getElementById("cartEmpty");
    const totalEl = document.getElementById("cartTotal");
    if (!list) return;
    const cart = getCart();
    list.innerHTML = "";
    if (cart.length === 0) {
      emptyState && emptyState.classList.remove("hidden");
    } else {
      emptyState && emptyState.classList.add("hidden");
      cart.forEach((line) => {
        const row = document.createElement("div");
        row.className = "flex gap-3 items-center py-3 border-b border-black/5 dark:border-white/10";
        row.innerHTML = `
          <img src="${line.img}" alt="" class="w-16 h-16 rounded-xl object-cover ph-img shrink-0" loading="lazy">
          <div class="flex-1 min-w-0">
            <p class="font-extrabold text-sm truncate">${line.name}</p>
            ${line.meta ? `<p class="text-xs opacity-60">${line.meta}</p>` : ""}
            <div class="flex items-center justify-between mt-1.5">
              <div class="qty-stepper" data-line="${line.lineId}">
                <button type="button" data-action="dec" aria-label="Decrease quantity">−</button>
                <span>${line.qty}</span>
                <button type="button" data-action="inc" aria-label="Increase quantity">+</button>
              </div>
              <span class="font-extrabold text-sm">$${(line.price * line.qty).toFixed(2)}</span>
            </div>
          </div>
          <button type="button" class="opacity-50 hover:opacity-100 hover:text-red-600 shrink-0" data-remove="${line.lineId}" aria-label="Remove ${line.name}">
            <i class="fa-solid fa-trash"></i>
          </button>`;
        list.appendChild(row);
      });
    }
    if (totalEl) totalEl.textContent = `$${cartTotal(cart).toFixed(2)}`;
    const checkoutBtn = document.getElementById("cartCheckoutBtn");
    if (checkoutBtn) checkoutBtn.classList.toggle("pointer-events-none", cart.length === 0);
    if (checkoutBtn) checkoutBtn.classList.toggle("opacity-40", cart.length === 0);
  }

  function initCartDrawer() {
    const drawer = document.getElementById("cartDrawer");
    const backdrop = document.getElementById("cartBackdrop");
    const openBtns = document.querySelectorAll("#cartOpenBtn, #tabCartBtn");
    const closeBtn = document.getElementById("cartCloseBtn");
    if (!drawer) return;
    const open = () => {
      drawer.classList.add("is-open");
      backdrop.classList.add("is-open");
      document.body.classList.add("no-scroll");
    };
    const close = () => {
      drawer.classList.remove("is-open");
      backdrop.classList.remove("is-open");
      document.body.classList.remove("no-scroll");
    };
    openBtns.forEach((b) => b.addEventListener("click", open));
    closeBtn && closeBtn.addEventListener("click", close);
    backdrop && backdrop.addEventListener("click", close);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });

    const list = document.getElementById("cartItems");
    if (list) {
      list.addEventListener("click", (e) => {
        const stepBtn = e.target.closest("[data-action]");
        const removeBtn = e.target.closest("[data-remove]");
        if (stepBtn) {
          const lineId = stepBtn.closest(".qty-stepper").dataset.line;
          changeQty(lineId, stepBtn.dataset.action === "inc" ? 1 : -1);
        } else if (removeBtn) {
          removeLine(removeBtn.dataset.remove);
        }
      });
    }
    renderCartBadges();
    renderCartDrawer();
  }

  /* ---------------------------- Fly-to-cart micro-interaction ---------------------------- */
  function flyToCart(originEl) {
    const target = document.querySelector("#cartOpenBtn, #tabCartBtn");
    if (!originEl || !target || document.documentElement.classList.contains("reduced-motion")) return;
    const start = originEl.getBoundingClientRect();
    const end = target.getBoundingClientRect();
    const dot = document.createElement("div");
    dot.className = "fly-dot";
    dot.innerHTML = '<i class="fa-solid fa-pizza-slice"></i>';
    dot.style.left = start.left + start.width / 2 - 11 + "px";
    dot.style.top = start.top + start.height / 2 - 11 + "px";
    document.body.appendChild(dot);
    const dx = end.left + end.width / 2 - (start.left + start.width / 2);
    const dy = end.top + end.height / 2 - (start.top + start.height / 2);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      dot.remove();
      return;
    }
    const anim = dot.animate(
      [
        { transform: "translate(0,0) scale(1)", opacity: 1 },
        { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 60}px) scale(.9)`, opacity: 1, offset: 0.6 },
        { transform: `translate(${dx}px, ${dy}px) scale(.3)`, opacity: 0.2 },
      ],
      { duration: 650, easing: "cubic-bezier(.2,.8,.3,1)" }
    );
    anim.onfinish = () => {
      dot.remove();
      target.animate([{ transform: "scale(1)" }, { transform: "scale(1.25)" }, { transform: "scale(1)" }], {
        duration: 320,
      });
    };
  }

  /* ---------------------------- Tabs (generic) ---------------------------- */
  function initTabs() {
    document.querySelectorAll("[data-tabs]").forEach((group) => {
      const triggers = group.querySelectorAll("[data-tab-trigger]");
      const panels = group.querySelectorAll("[data-tab-panel]");
      triggers.forEach((btn) => {
        btn.addEventListener("click", () => {
          triggers.forEach((b) => b.setAttribute("aria-selected", "false"));
          panels.forEach((p) => p.classList.add("hidden"));
          btn.setAttribute("aria-selected", "true");
          const panel = group.querySelector(`[data-tab-panel="${btn.dataset.tabTrigger}"]`);
          panel && panel.classList.remove("hidden");
          if (history.replaceState && group.dataset.tabsHash) {
            history.replaceState(null, "", `#${btn.dataset.tabTrigger}`);
          }
        });
      });
      const hash = window.location.hash.replace("#", "");
      if (hash && group.dataset.tabsHash) {
        const match = group.querySelector(`[data-tab-trigger="${hash}"]`);
        match && match.click();
      }
    });
  }

  /* ---------------------------- Accordion (generic) ---------------------------- */
  function initAccordion() {
    document.querySelectorAll("[data-accordion-trigger]").forEach((trigger) => {
      trigger.addEventListener("click", () => {
        const panel = trigger.nextElementSibling;
        const isOpen = trigger.getAttribute("aria-expanded") === "true";
        const group = trigger.closest("[data-accordion-group]");
        if (group && group.dataset.accordionGroup === "single") {
          group.querySelectorAll("[data-accordion-trigger]").forEach((t) => {
            t.setAttribute("aria-expanded", "false");
            t.nextElementSibling.classList.remove("is-open");
          });
        }
        trigger.setAttribute("aria-expanded", String(!isOpen));
        panel.classList.toggle("is-open", !isOpen);
      });
    });
  }

  /* ---------------------------- Animated stat counters ---------------------------- */
  function initCounters() {
    const els = document.querySelectorAll("[data-count-to]");
    if (!els.length || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          io.unobserve(el);
          const target = parseFloat(el.dataset.countTo);
          const decimals = el.dataset.countTo.includes(".") ? 1 : 0;
          const duration = 1400;
          const start = performance.now();
          const step = (now) => {
            const p = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            el.textContent = (target * eased).toFixed(decimals);
            if (p < 1) requestAnimationFrame(step);
            else el.textContent = target.toFixed(decimals);
          };
          if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            el.textContent = target.toFixed(decimals);
          } else {
            requestAnimationFrame(step);
          }
        });
      },
      { threshold: 0.4 }
    );
    els.forEach((el) => io.observe(el));
  }

  /* ---------------------------- Countdown timers ---------------------------- */
  function initCountdowns() {
    const els = document.querySelectorAll("[data-countdown]");
    if (!els.length) return;
    const tick = () => {
      const now = Date.now();
      els.forEach((el) => {
        const target = new Date(el.dataset.countdown).getTime();
        const diff = target - now;
        if (diff <= 0) {
          el.innerHTML = '<span class="font-extrabold">Offer ended</span>';
          return;
        }
        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        const box = (v, label) =>
          `<div class="countdown-box"><span class="text-lg font-extrabold">${String(v).padStart(
            2,
            "0"
          )}</span><span class="text-[10px] uppercase tracking-wide opacity-70">${label}</span></div>`;
        el.innerHTML = box(d, "Days") + box(h, "Hrs") + box(m, "Min") + box(s, "Sec");
      });
    };
    tick();
    setInterval(tick, 1000);
  }

  /* ---------------------------- Form validation ---------------------------- */
  function validateForm(form) {
    let valid = true;
    form.querySelectorAll("[required], [data-validate]").forEach((input) => {
      const field = input.closest(".form-field") || input.parentElement;
      const errorEl = field.querySelector(".field-error");
      let fieldValid = true;
      const val = input.value.trim();

      if (input.type === "checkbox") {
        if (input.hasAttribute("required") && !input.checked) fieldValid = false;
        field.classList.toggle("has-error", !fieldValid);
        if (!fieldValid) valid = false;
        return;
      }
      if (input.hasAttribute("required") && !val) fieldValid = false;
      if (fieldValid && input.type === "email" && val) {
        fieldValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
      }
      if (fieldValid && input.type === "tel" && val) {
        fieldValid = /^[0-9+()\-\s]{7,}$/.test(val);
      }
      if (fieldValid && input.minLength > 0 && val) {
        fieldValid = val.length >= input.minLength;
      }
      if (fieldValid && input.dataset.match) {
        const other = form.querySelector(`[name="${input.dataset.match}"]`);
        fieldValid = other && other.value === val;
      }

      field.classList.toggle("has-error", !fieldValid);
      if (!fieldValid) valid = false;
    });
    return valid;
  }
  function bindLiveValidation(form) {
    form.querySelectorAll("input, textarea, select").forEach((input) => {
      input.addEventListener("blur", () => {
        const field = input.closest(".form-field");
        if (field && field.classList.contains("has-error")) validateForm(form);
      });
    });
  }

  /* ---------------------------- Auth (demo, client-side only) ---------------------------- */
  function getUsers() {
    return readJSON(LS.users, []);
  }
  function registerUser({ name, email, password }) {
    const users = getUsers();
    if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      return { ok: false, error: "An account with this email already exists." };
    }
    const createdAt = Date.now();
    users.push({ name, email, password, createdAt });
    writeJSON(LS.users, users);
    writeJSON(LS.session, { name, email, createdAt });
    return { ok: true };
  }
  function loginUser(email, password) {
    const users = getUsers();
    const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
    if (!user) return { ok: false, error: "Incorrect email or password." };
    writeJSON(LS.session, { name: user.name, email: user.email, createdAt: user.createdAt });
    return { ok: true };
  }
  function logoutUser() {
    localStorage.removeItem(LS.session);
  }
  function currentUser() {
    return readJSON(LS.session, null);
  }

  /* ---------------------------- Orders ---------------------------- */
  function getOrders() {
    return readJSON(LS.orders, []).sort((a, b) => b.placedAt - a.placedAt);
  }
  function placeOrder({ items, address, phone, notes }) {
    const orders = readJSON(LS.orders, []);
    const order = {
      id: "EF" + Date.now().toString().slice(-8),
      items,
      total: cartTotal(items),
      address,
      phone,
      notes: notes || "",
      placedAt: Date.now(),
    };
    orders.push(order);
    writeJSON(LS.orders, orders);
    clearCart();
    return order;
  }
  function getStageIndex(order) {
    const elapsed = Date.now() - order.placedAt;
    let idx = 0;
    STAGES.forEach((s, i) => {
      if (elapsed >= s.at) idx = i;
    });
    return idx;
  }
  function reorder(orderId) {
    const order = getOrders().find((o) => o.id === orderId);
    if (!order) return;
    const cart = getCart();
    order.items.forEach((item) => {
      const existing = cart.find((l) => l.lineId === item.lineId);
      if (existing) existing.qty += item.qty;
      else cart.push(Object.assign({}, item));
    });
    saveCart(cart);
    showToast("Order added to your cart");
  }

  /* ---------------------------- Misc small syncs ---------------------------- */
  function syncFooterYear() {
    document.querySelectorAll(".js-year").forEach((el) => (el.textContent = new Date().getFullYear()));
  }
  function syncAccountLinks() {
    const user = currentUser();
    document.querySelectorAll(".js-account-link").forEach((el) => {
      el.href = user ? "dashboard.html" : "login.html";
      el.setAttribute("aria-label", user ? `Dashboard: ${user.name}` : "Log in");
      const icon = el.querySelector("i");
      if (icon) icon.className = user ? "fa-solid fa-user-check" : "fa-solid fa-user";
    });
    document.querySelectorAll(".js-account-label").forEach((el) => {
      el.textContent = user ? "Dashboard" : "Login";
    });
  }

  /* ---------------------------- Init ---------------------------- */
  function init() {
    initTheme();
    initDir();
    bindDirSwitches();
    document.querySelectorAll(".theme-switch").forEach((btn) => btn.addEventListener("click", toggleTheme));
    initHeaderScroll();
    initBackToTop();
    initPageLoader();
    initImageFallback();
    initNavDrawer();
    initHomeDropdown();
    initCartDrawer();
    initTabs();
    initAccordion();
    initCountdowns();
    initCounters();
    syncFooterYear();
    syncAccountLinks();

    document.querySelectorAll("form[data-validate-form]").forEach((form) => {
      bindLiveValidation(form);
      form.addEventListener("submit", (e) => {
        if (!validateForm(form)) {
          e.preventDefault();
          const firstError = form.querySelector(".has-error input, .has-error textarea, .has-error select");
          firstError && firstError.focus();
        }
      });
    });

    document.querySelectorAll("[data-add-to-cart]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        addToCart({
          lineId: btn.dataset.id,
          id: btn.dataset.id,
          name: btn.dataset.name,
          price: parseFloat(btn.dataset.price),
          img: btn.dataset.img,
          meta: btn.dataset.meta || "",
        });
        flyToCart(btn);
      });
    });
  }

  document.addEventListener("DOMContentLoaded", init);

  window.EF = {
    getCart, addToCart, changeQty, removeLine, clearCart, cartCount, cartTotal, renderCartDrawer,
    flyToCart, showToast, validateForm, bindLiveValidation,
    registerUser, loginUser, logoutUser, currentUser,
    getOrders, placeOrder, getStageIndex, reorder, STAGES,
  };
})();
