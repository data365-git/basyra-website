/* Basyra AI Chat Popup — vanilla JS widget, mounted on document.body (outside #bn-fit/#bn-page) */
(function () {
  "use strict";

  // Backend endpoint for AI answers. null = placeholder mode.
  var BASYRA_CHAT_URL = null;

  var IDLE_BUBBLE_INTERVAL = 25000;
  var IDLE_BUBBLE_DURATION = 4000;
  var STREAM_CHAR_DELAY = 30;
  var STREAM_START_DELAY = 500;

  var IDLE_LINES = [
    "Assalomu Alaykum 👋\nMen Basyra AI-detektiviman"
  ];


  var MASCOT_SMILE = "assets/images/882867af-1e28-4aa5-b593-c5d7b5850331.png";
  var MASCOT_COOL = "assets/images/882867af-1e28-4aa5-b593-c5d7b5850331.png";

  // ---------- state ----------
  var state = {
    open: false,
    streaming: false,
    messages: [] // {role: 'user'|'assistant', content: string}
  };

  var idleTimer = null;
  var idleBubbleEl = null;
  var idleBubbleHideTimer = null;
  var streamAbort = null;
  var lastFocusedEl = null;
  var fabHiddenBySection = false; // true while a section with its own in-page assistant teaser is in view

  // ---------- tiny markdown parser (bold, italic, code, links, lists, paragraphs) ----------
  function escapeHtml(s) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function inlineMd(text) {
    var out = escapeHtml(text);
    // code spans first so inner chars aren't touched by other rules
    out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
    // links [text](url)
    out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, function (m, txt, url) {
      return '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + txt + "</a>";
    });
    // bold **text**
    out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    // italic *text*
    out = out.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1<em>$2</em>");
    return out;
  }

  function renderMarkdown(src) {
    var lines = (src || "").replace(/\r\n/g, "\n").split("\n");
    var html = "";
    var i = 0;
    var para = [];

    function flushPara() {
      if (para.length) {
        html += "<p>" + inlineMd(para.join(" ")) + "</p>";
        para = [];
      }
    }

    while (i < lines.length) {
      var line = lines[i];
      var hMatch = /^(#{1,3})\s+(.*)$/.exec(line);
      var listMatch = /^\s*[-*]\s+(.*)$/.exec(line);
      var olMatch = /^\s*\d+\.\s+(.*)$/.exec(line);

      if (hMatch) {
        flushPara();
        var tag = hMatch[1].length === 1 ? "h4" : hMatch[1].length === 2 ? "h5" : "h6";
        html += "<" + tag + ">" + inlineMd(hMatch[2]) + "</" + tag + ">";
        i++; continue;
      }

      if (listMatch) {
        flushPara();
        var ulItems = [];
        while (i < lines.length && (listMatch = /^\s*[-*]\s+(.*)$/.exec(lines[i]))) {
          ulItems.push("<li>" + inlineMd(listMatch[1]) + "</li>");
          i++;
        }
        html += "<ul>" + ulItems.join("") + "</ul>";
        continue;
      }

      if (olMatch) {
        flushPara();
        var olItems = [];
        while (i < lines.length && (olMatch = /^\s*\d+\.\s+(.*)$/.exec(lines[i]))) {
          olItems.push("<li>" + inlineMd(olMatch[1]) + "</li>");
          i++;
        }
        html += "<ol>" + olItems.join("") + "</ol>";
        continue;
      }

      if (line.trim() === "") {
        flushPara();
        i++;
        continue;
      }

      para.push(line.trim());
      i++;
    }
    flushPara();
    return html;
  }

  // ---------- DOM refs ----------
  var els = {};

  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "class") el.className = attrs[k];
        else if (k === "html") el.innerHTML = attrs[k];
        else if (k === "text") el.textContent = attrs[k];
        else el.setAttribute(k, attrs[k]);
      });
    }
    (children || []).forEach(function (c) {
      if (c) el.appendChild(c);
    });
    return el;
  }

  function svgSend() {
    return (
      '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M12 20V5M12 5L5.5 11.5M12 5L18.5 11.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' +
      "</svg>"
    );
  }

  function svgStop() {
    return (
      '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">' +
      '<rect x="6" y="6" width="12" height="12" rx="2"/>' +
      "</svg>"
    );
  }

  function svgOrb() {
    return (
      '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M12 2L14.5 8.5L21 11L14.5 13.5L12 20L9.5 13.5L3 11L9.5 8.5L12 2Z" fill="currentColor"/>' +
      "</svg>"
    );
  }

  function svgWarn() {
    return (
      '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a1 1 0 00.86 1.5h18.64a1 1 0 00.86-1.5L13.71 3.86a1 1 0 00-1.72 0z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
      "</svg>"
    );
  }

  function build() {
    // FAB
    var fabImg = h("img", { src: MASCOT_SMILE, alt: "", "aria-hidden": "true" }, []);
    var fab = h(
      "button",
      { class: "ai-fab", type: "button", "aria-label": "Basyra AI yordamchisini ochish", "aria-haspopup": "dialog" },
      [fabImg]
    );

    var aura = h("div", { class: "ai-aura", "aria-hidden": "true" }, []);

    // Popup panel
    var closeBtn = h(
      "button",
      { class: "ai-x", type: "button", "aria-label": "Yopish" },
      [
        h("span", {
          html:
            '<svg viewBox="0 0 14 14" width="14" height="14" fill="none"><path d="M1.6 1.6L12.4 12.4M12.4 1.6L1.6 12.4" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>'
        })
      ]
    );

    var liveDot = h("span", { class: "live" }, []);
    var subtitle = h("div", { class: "s" }, [liveDot, document.createTextNode("Kurs bo'yicha yordamchi")]);
    var title = h("div", { class: "t", text: "Basyra AI" }, []);
    var htxt = h("div", { class: "htxt" }, [title, subtitle]);
    var orb = h("div", { class: "orb-sm", html: svgOrb() }, []);
    var header = h("div", { class: "ai-hd ai-section" }, [orb, htxt, closeBtn]);

    var body = h("div", { class: "ai-body ai-section", role: "log", "aria-live": "polite" }, []);

    var welcome = h("div", { class: "ai-msg ai" }, [
      h("div", { class: "bubble ai-welcome" }, [
        h("div", { class: "wt" }, [
          document.createTextNode("Assalomu Alaykum 👋"),
          h("br", {}, []),
          document.createTextNode("Men "),
          h("span", { class: "grad", text: "Basyra AI-detektiviman" }, [])
        ]),
        h("div", {
          class: "ws",
          text: "Kurs, dastur yoki narx haqida savolingiz bo'lsa — so'rang."
        })
      ])
    ]);
    body.appendChild(welcome);

    var errorBox = h("div", { class: "ai-error", style: "display:none;" }, [
      h("span", { html: svgWarn() }),
      h("span", { class: "ai-error-text", text: "" })
    ]);

    var textarea = h("textarea", {
      class: "ai-input",
      rows: "1",
      placeholder: "Savolingizni yozing...",
      "aria-label": "Xabar yozish"
    }, []);

    var sendBtn = h(
      "button",
      { class: "ai-send", type: "button", "aria-label": "Yuborish", disabled: "disabled" },
      [h("span", { html: svgSend() })]
    );
    var stopBtn = h(
      "button",
      { class: "ai-stop", type: "button", "aria-label": "To'xtatish", style: "display:none;" },
      [h("span", { html: svgStop() })]
    );

    var inputbar = h("div", { class: "ai-inputbar" }, [textarea, sendBtn, stopBtn]);
    var disclaimer = h("div", {
      class: "ai-disclaimer",
      text: "AI javoblari xato bo'lishi mumkin. Muhim savollar uchun murojaat qiling."
    });
    var tgIcon = h("span", { html: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/></svg>' }, []);
    var callIcon = h("span", { html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014 2h3a2 2 0 012 1.7c.1.9.3 1.8.6 2.6a2 2 0 01-.5 2.1L8 9.6a16 16 0 006 6l1.2-1.1a2 2 0 012.1-.5c.8.3 1.7.5 2.6.6a2 2 0 011.7 2z"/></svg>' }, []);
    var tgBtn = h("a", { class: "ai-cta ai-cta-tg", href: "https://t.me/USERNAME", target: "_blank", rel: "noopener" }, [tgIcon, h("span", { text: "Telegram" }, [])]);
    var callBtn = h("a", { class: "ai-cta ai-cta-call", href: "tel:+998555888484" }, [callIcon, h("span", { text: "Qo'ng'iroq" }, [])]);
    var actions = h("div", { class: "ai-actions" }, [tgBtn, callBtn]);
    var poweredBy = h("div", { class: "ai-powered" }, [
      h("a", { href: "https://www.data365.uz/", target: "_blank", rel: "noopener noreferrer" }, [
        h("span", { class: "ai-powered-dot" }, []),
        document.createTextNode("Powered by "),
        h("span", { text: "data365" }, [])
      ])
    ]);
    var footer = h("div", { class: "ai-foot ai-section" }, [errorBox, inputbar, disclaimer, actions]);

    var popup = h(
      "div",
      {
        class: "ai-popup",
        role: "dialog",
        "aria-modal": "true",
        "aria-label": "Basyra AI chat",
        tabindex: "-1"
      },
      [
        h("div", { class: "ai-noise", "aria-hidden": "true" }, []),
        header,
        poweredBy,
        body,
        footer
      ]
    );

    var root = h("div", { id: "basyra-ai-widget" }, [aura, popup, fab]);
    document.body.appendChild(root);

    els.root = root;
    els.fab = fab;
    els.fabImg = fabImg;
    els.aura = aura;
    els.popup = popup;
    els.header = header;
    els.body = body;
    els.footer = footer;
    els.textarea = textarea;
    els.sendBtn = sendBtn;
    els.stopBtn = stopBtn;
    els.errorBox = errorBox;
    els.errorText = errorBox.querySelector(".ai-error-text");
    els.closeBtn = closeBtn;

    wireEvents();
  }

  // ---------- open/close ----------
  function openPopup() {
    if (state.open) return;
    state.open = true;
    lastFocusedEl = document.activeElement;
    els.popup.classList.add("open");
    els.popup.setAttribute("data-open", "true");
    els.aura.classList.add("show");
    els.fabImg.src = MASCOT_COOL;
    els.fab.setAttribute("aria-expanded", "true");
    hideIdleBubble();
    stopIdleTimer();
    document.addEventListener("keydown", onKeydown, true);
    setTimeout(function () {
      els.textarea.focus();
    }, 200);
  }

  function closePopup() {
    if (!state.open) return;
    state.open = false;
    els.popup.classList.remove("open");
    els.popup.removeAttribute("data-open");
    els.aura.classList.remove("show");
    els.fabImg.src = MASCOT_SMILE;
    els.fab.setAttribute("aria-expanded", "false");
    document.removeEventListener("keydown", onKeydown, true);
    startIdleTimer();
    if (lastFocusedEl && typeof lastFocusedEl.focus === "function") {
      lastFocusedEl.focus();
    } else {
      els.fab.focus();
    }
  }

  function togglePopup() {
    if (state.open) closePopup();
    else openPopup();
  }

  // ---------- focus trap ----------
  function getFocusable() {
    var nodes = els.popup.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    return Array.prototype.filter.call(nodes, function (n) {
      return !n.disabled && n.offsetParent !== null;
    });
  }

  function onKeydown(e) {
    if (!state.open) return;
    if (e.key === "Escape") {
      e.preventDefault();
      closePopup();
      return;
    }
    if (e.key === "Tab") {
      var focusable = getFocusable();
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  // ---------- idle speech bubble ----------
  function showIdleBubble() {
    if (state.open || fabHiddenBySection) return;
    hideIdleBubble();
    var line = IDLE_LINES[Math.floor(Math.random() * IDLE_LINES.length)];
    idleBubbleEl = h("div", { class: "mascot-bubble", role: "status" }, [
      document.createTextNode(line),
      h("div", { class: "mascot-bubble__tail" }, [])
    ]);
    idleBubbleEl.addEventListener("click", function () {
      openPopup();
    });
    document.body.appendChild(idleBubbleEl);
    idleBubbleHideTimer = setTimeout(function () {
      hideIdleBubble();
    }, IDLE_BUBBLE_DURATION);
  }

  function hideIdleBubble() {
    if (idleBubbleHideTimer) {
      clearTimeout(idleBubbleHideTimer);
      idleBubbleHideTimer = null;
    }
    if (idleBubbleEl && idleBubbleEl.parentNode) {
      idleBubbleEl.parentNode.removeChild(idleBubbleEl);
    }
    idleBubbleEl = null;
  }

  function startIdleTimer() {
    stopIdleTimer();
    idleTimer = setInterval(showIdleBubble, IDLE_BUBBLE_INTERVAL);
  }

  function stopIdleTimer() {
    if (idleTimer) {
      clearInterval(idleTimer);
      idleTimer = null;
    }
  }

  // ---------- messages ----------
  function scrollToBottom() {
    requestAnimationFrame(function () {
      els.body.scrollTo({ top: els.body.scrollHeight, behavior: "smooth" });
    });
  }

  function addMessage(role, content) {
    state.messages.push({ role: role, content: content });
    var bubble = h("div", { class: "bubble" }, []);
    bubble.innerHTML = renderMarkdown(content);
    var msg = h("div", { class: "ai-msg " + (role === "user" ? "user" : "ai") }, [bubble]);
    els.body.appendChild(msg);
    scrollToBottom();
    return { msgEl: msg, bubbleEl: bubble };
  }

  function removeWelcomeIfNeeded() {
    var welcome = els.body.querySelector(".ai-welcome");
    if (welcome) {
      var msg = welcome.closest(".ai-msg");
      if (msg) msg.remove();
    }
  }

  function showTyping() {
    hideTyping();
    var typing = h("div", { class: "ai-typing" }, [
      h("span", {}, []),
      h("span", {}, []),
      h("span", {}, [])
    ]);
    var wrap = h("div", { class: "ai-msg ai", id: "ai-typing-msg" }, [typing]);
    els.body.appendChild(wrap);
    scrollToBottom();
  }

  function hideTyping() {
    var existing = document.getElementById("ai-typing-msg");
    if (existing) existing.remove();
  }

  function showError(text) {
    els.errorText.textContent = text;
    els.errorBox.style.display = "flex";
  }

  function hideError() {
    els.errorBox.style.display = "none";
  }

  function setStreaming(isStreaming) {
    state.streaming = isStreaming;
    els.sendBtn.style.display = isStreaming ? "none" : "flex";
    els.stopBtn.style.display = isStreaming ? "flex" : "none";
    els.textarea.disabled = isStreaming;
  }

  function updateSendState() {
    var hasText = els.textarea.value.trim().length > 0;
    els.sendBtn.disabled = !hasText || state.streaming;
  }

  function autoGrow() {
    els.textarea.style.height = "auto";
    var lineHeight = 20;
    var maxRows = 4;
    var maxHeight = lineHeight * maxRows + 12;
    els.textarea.style.height = Math.min(els.textarea.scrollHeight, maxHeight) + "px";
  }

  // ---------- mock streaming ----------
  var PLACEHOLDER_MSG = "Hozircha sun'iy intellektimiz laboratoriya ishlarida 🔬🧪\n\nUngacha tabiiy intellekt bilan gaplashib turish uchun bemalol jamoadagi konsultantlarimizga aloqaga chiqsangiz bo'ladi 😊🤝";

  function pickMockResponse() {
    return PLACEHOLDER_MSG;
  }

  function sendMock(userText) {
    showTyping();
    setStreaming(true);
    hideError();

    setTimeout(function () {
      hideTyping();
      var msgRefs = addMessage("assistant", pickMockResponse());

      var cta = document.createElement("a");
      cta.href = "#ariza";
      cta.className = "ai-form-cta";
      cta.textContent = "Dasturga yoziling →";
      cta.addEventListener("click", function (e) {
        e.preventDefault();
        closePopup();
        var sec = document.getElementById("ariza");
        if (sec) sec.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(function () {
          var f = document.getElementById("ar-ism");
          if (f) f.focus();
        }, 700);
      });
      msgRefs.bubbleEl.appendChild(cta);
      scrollToBottom();

      setStreaming(false);
      updateSendState();
    }, STREAM_START_DELAY);
  }

  function sendReal(userText) {
    var abortCtrl = new AbortController();
    streamAbort = function () {
      abortCtrl.abort();
      hideTyping();
      setStreaming(false);
      streamAbort = null;
    };

    showTyping();
    setStreaming(true);
    hideError();

    fetch(BASYRA_CHAT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: userText }),
      signal: abortCtrl.signal,
    })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        hideTyping();
        var answer = data.answer || "Javob olinmadi. Qayta urinib ko'ring.";
        addMessage("assistant", answer);
        setStreaming(false);
        streamAbort = null;
        updateSendState();
        scrollToBottom();
      })
      .catch(function (err) {
        hideTyping();
        setStreaming(false);
        streamAbort = null;
        if (err.name === "AbortError") return;
        showError("Ulanishda xatolik yuz berdi. Qayta urinib ko'ring.");
        updateSendState();
      });
  }

  function handleSend() {
    var text = els.textarea.value.trim();
    if (!text || state.streaming) return;

    removeWelcomeIfNeeded();
    hideError();
    addMessage("user", text);
    els.textarea.value = "";
    autoGrow();
    updateSendState();

    if (BASYRA_CHAT_URL) {
      sendReal(text);
    } else {
      sendMock(text);
    }
  }

  function handleStop() {
    if (streamAbort) streamAbort();
  }

  // ---------- wire events ----------
  function wireEvents() {
    els.fab.addEventListener("click", togglePopup);
    els.closeBtn.addEventListener("click", closePopup);

    els.textarea.addEventListener("input", function () {
      autoGrow();
      updateSendState();
    });

    els.textarea.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

    els.sendBtn.addEventListener("click", handleSend);
    els.stopBtn.addEventListener("click", handleStop);

    document.addEventListener("click", function (e) {
      if (!state.open) return;
      if (els.popup.contains(e.target) || els.fab.contains(e.target)) return;
      closePopup();
    });
  }

  // ---------- hide fab while a section with its own in-page assistant teaser is in view
  // (avoid showing the global FAB mascot/bubble at the same time as a section's own) ----------
  function setupHeroVisibility() {
    var selectors = ["#bn-hero", "#oldin-keyin", "#nimani-organasiz", "#dastur", "#men-haqimda", ".bn-nt"];
    var targets = selectors
      .map(function (s) { return document.querySelector(s); })
      .filter(Boolean);
    if (!targets.length || !("IntersectionObserver" in window)) return;
    var visible = {};
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var key = Array.prototype.indexOf.call(targets, entry.target);
        visible[key] = entry.isIntersecting;
      });
      var anyVisible = Object.keys(visible).some(function (k) { return visible[k]; });
      var hide = anyVisible && !state.open;
      fabHiddenBySection = hide;
      els.fab.style.display = hide ? "none" : "";
      els.aura.style.display = hide ? "none" : "";
      if (idleBubbleEl) idleBubbleEl.style.display = hide ? "none" : "";
    }, { threshold: 0 });
    targets.forEach(function (t) { io.observe(t); });
  }

  // ---------- init ----------
  function init() {
    build();
    startIdleTimer();
    setupHeroVisibility();
    window.BasyraAI = { open: openPopup, close: closePopup };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
