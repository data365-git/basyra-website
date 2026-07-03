/* Basyra AI Chat Popup — vanilla JS widget, mounted on document.body (outside #bn-fit/#bn-page) */
(function () {
  "use strict";

  // Set to a real endpoint URL when the backend is ready. null = mock mode.
  var BASYRA_CHAT_URL = null;

  var IDLE_BUBBLE_INTERVAL = 25000;
  var IDLE_BUBBLE_DURATION = 4000;
  var STREAM_CHAR_DELAY = 30;
  var STREAM_START_DELAY = 500;

  var IDLE_LINES = [
    "Savolingiz bormi? 🔍",
    "Kursga qiziqyapsizmi?",
    "Men yordam beraman!",
    "Basyra detektivi shu yerda 🕵️"
  ];

  var SUGGESTIONS = [
    "Dastur nimalardan iborat?",
    "Kurs narxi qancha?",
    "Kim uchun mos?",
    "Qanday natijalar beradi?"
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
      var listMatch = /^\s*[-*]\s+(.*)$/.exec(line);
      var olMatch = /^\s*\d+\.\s+(.*)$/.exec(line);

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

    var chipsWrap = h("div", { class: "ai-chips" }, []);
    SUGGESTIONS.forEach(function (s) {
      var chip = h("button", { class: "ai-chip", type: "button", text: s }, []);
      chip.addEventListener("click", function () {
        els.textarea.value = s;
        autoGrow();
        updateSendState();
        els.textarea.focus();
      });
      chipsWrap.appendChild(chip);
    });

    var welcome = h("div", { class: "ai-msg ai" }, [
      h("div", { class: "bubble ai-welcome" }, [
        h("div", { class: "wt" }, [
          document.createTextNode("Salom! Men "),
          h("span", { class: "grad", text: "Basyra detektivi" }, [])
        ]),
        h("div", {
          class: "ws",
          text: "Kurs, dastur yoki narx haqida savolingiz bo'lsa — so'rang."
        })
      ])
    ]);
    welcome.querySelector(".bubble").appendChild(chipsWrap);
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
    var footer = h("div", { class: "ai-foot ai-section" }, [errorBox, inputbar, disclaimer]);

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
    els.chipsWrap = chipsWrap;

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
    if (state.open) return;
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
  function pickMockResponse(userText) {
    var t = userText.toLowerCase();
    if (
      t.indexOf("narx") !== -1 ||
      t.indexOf("qancha") !== -1 ||
      t.indexOf("pul") !== -1 ||
      t.indexOf("to'lov") !== -1
    ) {
      return "Narx haqida to'liq ma'lumot olish uchun saytdagi ariza formasini to'ldiring yoki bizga yozing.";
    }
    if (
      t.indexOf("dastur") !== -1 ||
      t.indexOf("kurs") !== -1 ||
      t.indexOf("nima") !== -1 ||
      t.indexOf("mos") !== -1 ||
      t.indexOf("natija") !== -1
    ) {
      return "Basyra Academy — bu **2.5 oylik** offline sotuvchilar uchun intensiv dastur. Dasturda:\n\n- 13 ta amaliy dars\n- Video materiallar\n- Jonli sessiyalar\n- Shaxsiy mentorlik\n\nBarchasi real sotuv natijalariga qaratilgan.";
    }
    return "Rahmat savolingiz uchun! Men Basyra detektivi — kurs bo'yicha barcha savollaringizga javob beraman. Nimani bilmoqchisiz?";
  }

  function sendMock(userText) {
    var aborted = false;
    streamAbort = function () {
      aborted = true;
    };

    showTyping();
    setStreaming(true);
    hideError();

    var startTimer = setTimeout(function () {
      if (aborted) return;
      hideTyping();

      var fullText = pickMockResponse(userText);
      var current = "";
      var idx = 0;
      var msgRefs = addMessage("assistant", "");
      // remove the placeholder we just pushed to history; we'll push final text at the end
      state.messages.pop();

      function tick() {
        if (aborted) {
          finalize();
          return;
        }
        idx++;
        current = fullText.slice(0, idx);
        msgRefs.bubbleEl.innerHTML = renderMarkdown(current);
        scrollToBottom();
        if (idx < fullText.length) {
          streamTimer = setTimeout(tick, STREAM_CHAR_DELAY);
        } else {
          finalize();
        }
      }

      function finalize() {
        state.messages.push({ role: "assistant", content: current || fullText });
        setStreaming(false);
        streamAbort = null;
        updateSendState();
      }

      var streamTimer = setTimeout(tick, STREAM_CHAR_DELAY);
      streamAbort = function () {
        aborted = true;
        clearTimeout(streamTimer);
        finalize();
      };
    }, STREAM_START_DELAY);

    streamAbort = function () {
      aborted = true;
      clearTimeout(startTimer);
      hideTyping();
      setStreaming(false);
      streamAbort = null;
    };
  }

  function sendReal(userText) {
    // Placeholder for real backend integration once BASYRA_CHAT_URL is set.
    showError("Ulanishda xatolik yuz berdi. Qayta urinib ko'ring.");
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
  }

  // ---------- hide fab while the hero is in view (avoid overlapping hero stats) ----------
  function setupHeroVisibility() {
    var hero = document.getElementById("bn-hero");
    if (!hero || !("IntersectionObserver" in window)) return;
    var io = new IntersectionObserver(function (entries) {
      var hide = entries[0].isIntersecting && !state.open;
      els.fab.style.display = hide ? "none" : "";
      els.aura.style.display = hide ? "none" : "";
      if (idleBubbleEl) idleBubbleEl.style.display = hide ? "none" : "";
    }, { threshold: 0.2 });
    io.observe(hero);
  }

  // ---------- init ----------
  function init() {
    build();
    startIdleTimer();
    setupHeroVisibility();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
