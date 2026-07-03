/* Basyra AI Chat Popup — vanilla JS widget, mounted on document.body */
(function () {
  "use strict";

  var BASYRA_CHAT_URL = null;

  var IDLE_BUBBLE_INTERVAL = 25000;
  var IDLE_BUBBLE_DURATION = 4000;
  var STREAM_CHAR_DELAY = 30;
  var STREAM_START_DELAY = 500;

  var IDLE_LINES = [
    "Savolingiz bormi?",
    "Kursga qiziqyapsizmi?",
    "Men yordam beraman!",
    "Basyra detektivi shu yerda"
  ];

  var MASCOT_IMG = "assets/images/882867af-1e28-4aa5-b593-c5d7b5850331.png";

  var state = {
    open: false,
    streaming: false,
    messages: []
  };

  var idleTimer = null;
  var idleBubbleEl = null;
  var idleBubbleHideTimer = null;
  var streamAbort = null;
  var lastFocusedEl = null;

  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function inlineMd(text) {
    var out = escapeHtml(text);
    out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
    out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, function (m, txt, url) {
      return '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + txt + "</a>";
    });
    out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    out = out.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1<em>$2</em>");
    return out;
  }

  function renderMarkdown(src) {
    var lines = (src || "").replace(/\r\n/g, "\n").split("\n");
    var html = "";
    var i = 0;
    var para = [];

    function flushPara() {
      if (para.length) { html += "<p>" + inlineMd(para.join(" ")) + "</p>"; para = []; }
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
      if (line.trim() === "") { flushPara(); i++; continue; }
      para.push(line.trim());
      i++;
    }
    flushPara();
    return html;
  }

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
    (children || []).forEach(function (c) { if (c) el.appendChild(c); });
    return el;
  }

  function svgSend() {
    return '<svg width="19" height="19" viewBox="0 0 24 24" fill="none">' +
      '<circle cx="10.5" cy="10.5" r="7" stroke="#231607" stroke-width="2.3"></circle>' +
      '<path d="M15.8 15.8L21 21" stroke="#231607" stroke-width="2.4" stroke-linecap="round"></path>' +
      '</svg>';
  }

  function svgStop() {
    return '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';
  }

  function svgWarn() {
    return '<svg viewBox="0 0 24 24" fill="none"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a1 1 0 00.86 1.5h18.64a1 1 0 00.86-1.5L13.71 3.86a1 1 0 00-1.72 0z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  function build() {
    // FAB — full-width mascot image as clickable button
    var fabImg = h("img", { src: MASCOT_IMG, alt: "" }, []);
    var fab = h("button", {
      class: "ai-fab",
      type: "button",
      "aria-label": "Basyra AI yordamchisini ochish",
      "aria-haspopup": "dialog"
    }, [fabImg]);

    var aura = h("div", { class: "ai-aura", "aria-hidden": "true" }, []);

    // Close button
    var closeBtn = h("button", { class: "ai-x", type: "button", "aria-label": "Yopish" }, [
      h("span", { html: '<svg viewBox="0 0 14 14" width="13" height="13" fill="none"><path d="M1.6 1.6L12.4 12.4M12.4 1.6L1.6 12.4" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"></path></svg>' })
    ]);

    // Header — mascot avatar (not icon orb)
    var orbImg = h("img", { src: MASCOT_IMG, alt: "" }, []);
    var orb = h("div", { class: "orb-sm" }, [orbImg]);
    var liveDot = h("span", { class: "live" }, []);
    var subtitle = h("div", { class: "s" }, [liveDot, document.createTextNode("Onlayn — savolga tayyor")]);
    var title = h("div", { class: "t", text: "Detektiv yordamchi" }, []);
    var htxt = h("div", { class: "htxt" }, [title, subtitle]);
    var header = h("div", { class: "ai-hd" }, [orb, htxt, closeBtn]);

    var body = h("div", { class: "ai-body", role: "log", "aria-live": "polite" }, []);

    // Welcome message
    var gradSpan = h("span", { class: "grad", text: "birga ochamiz" }, []);
    var welcomeTitle = h("div", { class: "wt" }, [document.createTextNode("Ishni "), gradSpan]);
    var welcomeSub = h("div", {
      class: "ws",
      text: "Sotuv, jarayon yoki dastur haqida savol bering — detektivona aniqlik bilan javob beraman."
    }, []);
    var welcomeCard = h("div", { class: "ai-welcome" }, [welcomeTitle, welcomeSub]);
    var welcomeMsg = h("div", { class: "ai-msg ai" }, [
      h("div", { class: "bubble" }, [welcomeCard])
    ]);
    body.appendChild(welcomeMsg);

    var errorBox = h("div", { class: "ai-error", style: "display:none;" }, [
      h("span", { html: svgWarn() }),
      h("span", { class: "ai-error-text", text: "" })
    ]);

    // Input field (single-line, matches reference)
    var input = h("input", {
      class: "ai-input",
      type: "text",
      placeholder: "Savolingizni yozing…",
      "aria-label": "Xabar yozish"
    }, []);

    var sendBtn = h("button", { class: "ai-send", type: "button", "aria-label": "Yuborish", disabled: "disabled" }, [
      h("span", { html: svgSend() })
    ]);
    var stopBtn = h("button", { class: "ai-stop", type: "button", "aria-label": "To'xtatish", style: "display:none;" }, [
      h("span", { html: svgStop() })
    ]);

    var inputbar = h("div", { class: "ai-inputbar" }, [input, sendBtn, stopBtn]);
    var disclaimer = h("div", { class: "ai-disclaimer", text: "Basyra detektivi — AI yordamchi" }, []);
    var footer = h("div", { class: "ai-foot" }, [errorBox, inputbar, disclaimer]);

    var popup = h("div", {
      class: "ai-popup",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": "Basyra AI chat",
      tabindex: "-1"
    }, [
      h("div", { class: "ai-noise", "aria-hidden": "true" }, []),
      header,
      body,
      footer
    ]);

    var root = h("div", { id: "basyra-ai-widget" }, [aura, popup, fab]);
    document.body.appendChild(root);

    els.root = root;
    els.fab = fab;
    els.aura = aura;
    els.popup = popup;
    els.body = body;
    els.input = input;
    els.sendBtn = sendBtn;
    els.stopBtn = stopBtn;
    els.errorBox = errorBox;
    els.errorText = errorBox.querySelector(".ai-error-text");
    els.closeBtn = closeBtn;

    wireEvents();
  }

  function openPopup() {
    if (state.open) return;
    state.open = true;
    lastFocusedEl = document.activeElement;
    els.popup.classList.add("open");
    els.popup.setAttribute("data-open", "true");
    els.aura.classList.add("show");
    els.fab.setAttribute("aria-expanded", "true");
    hideIdleBubble();
    stopIdleTimer();
    document.addEventListener("keydown", onKeydown, true);
    setTimeout(function () { els.input.focus(); }, 200);
  }

  function closePopup() {
    if (!state.open) return;
    state.open = false;
    els.popup.classList.remove("open");
    els.popup.removeAttribute("data-open");
    els.aura.classList.remove("show");
    els.fab.setAttribute("aria-expanded", "false");
    document.removeEventListener("keydown", onKeydown, true);
    startIdleTimer();
    if (lastFocusedEl && typeof lastFocusedEl.focus === "function") lastFocusedEl.focus();
    else els.fab.focus();
  }

  function togglePopup() {
    if (state.open) closePopup(); else openPopup();
  }

  function getFocusable() {
    var nodes = els.popup.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    return Array.prototype.filter.call(nodes, function (n) { return !n.disabled && n.offsetParent !== null; });
  }

  function onKeydown(e) {
    if (!state.open) return;
    if (e.key === "Escape") { e.preventDefault(); closePopup(); return; }
    if (e.key === "Tab") {
      var focusable = getFocusable();
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  function showIdleBubble() {
    if (state.open) return;
    hideIdleBubble();
    var line = IDLE_LINES[Math.floor(Math.random() * IDLE_LINES.length)];
    idleBubbleEl = h("div", { class: "mascot-bubble", role: "status" }, [
      document.createTextNode(line),
      h("div", { class: "mascot-bubble__tail" }, [])
    ]);
    idleBubbleEl.addEventListener("click", function () { openPopup(); });
    document.body.appendChild(idleBubbleEl);
    idleBubbleHideTimer = setTimeout(function () { hideIdleBubble(); }, IDLE_BUBBLE_DURATION);
  }

  function hideIdleBubble() {
    if (idleBubbleHideTimer) { clearTimeout(idleBubbleHideTimer); idleBubbleHideTimer = null; }
    if (idleBubbleEl && idleBubbleEl.parentNode) idleBubbleEl.parentNode.removeChild(idleBubbleEl);
    idleBubbleEl = null;
  }

  function startIdleTimer() {
    stopIdleTimer();
    idleTimer = setInterval(showIdleBubble, IDLE_BUBBLE_INTERVAL);
  }

  function stopIdleTimer() {
    if (idleTimer) { clearInterval(idleTimer); idleTimer = null; }
  }

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
    if (welcome) { var msg = welcome.closest(".ai-msg"); if (msg) msg.remove(); }
  }

  function showTyping() {
    hideTyping();
    var typing = h("div", { class: "ai-typing" }, [h("span", {}, []), h("span", {}, []), h("span", {}, [])]);
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
    els.input.disabled = isStreaming;
  }

  function updateSendState() {
    var hasText = els.input.value.trim().length > 0;
    els.sendBtn.disabled = !hasText || state.streaming;
  }

  function pickMockResponse(userText) {
    var t = userText.toLowerCase();
    if (t.indexOf("narx") !== -1 || t.indexOf("qancha") !== -1 || t.indexOf("pul") !== -1 || t.indexOf("to‘lov") !== -1) {
      return "Narx haqida to‘liq ma‘lumot olish uchun saytdagi ariza formasini to‘ldiring yoki bizga yozing.";
    }
    if (t.indexOf("davom") !== -1 || t.indexOf("muddat") !== -1 || t.indexOf("vaqt") !== -1) {
      return "Dastur **2.5 oy** davom etadi. Haftada 3 marta online sessiyalar + amaliy topshiriqlar.";
    }
    if (t.indexOf("mos") !== -1 || t.indexOf("kim") !== -1 || t.indexOf("uchun") !== -1) {
      return "Dastur **sotuv menejerlari**, **biznes egalari** va **sotuv jamoasini qurmoqchi bo‘lganlar** uchun mo‘ljallangan.";
    }
    if (t.indexOf("natija") !== -1 || t.indexOf("o‘lcha") !== -1 || t.indexOf("natijaviy") !== -1) {
      return "Natijani **sotuvlar o‘sishi**, **jamoaning samaradorligi** va **tizim ishlashi** orqali o‘lchaymiz. Har bir bitiruvchi shaxsiy hisobot oladi.";
    }
    if (t.indexOf("dastur") !== -1 || t.indexOf("kurs") !== -1 || t.indexOf("nima") !== -1) {
      return "Basyra Academy — bu **2.5 oylik** offline sotuvchilar uchun intensiv dastur. Dasturda:\n\n- 13 ta amaliy dars\n- Jonli sessiyalar\n- Shaxsiy mentorlik\n\nBarchasi real sotuv natijalariga qaratilgan.";
    }
    return "Rahmat savolingiz uchun! Men Basyra detektivi — kurs bo‘yicha barcha savollaringizga javob beraman. Nimani bilmoqchisiz?";
  }

  function sendMock(userText) {
    var aborted = false;
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
      state.messages.pop();

      function tick() {
        if (aborted) { finalize(); return; }
        idx++;
        current = fullText.slice(0, idx);
        msgRefs.bubbleEl.innerHTML = renderMarkdown(current);
        scrollToBottom();
        if (idx < fullText.length) { streamTimer = setTimeout(tick, STREAM_CHAR_DELAY); }
        else { finalize(); }
      }

      function finalize() {
        state.messages.push({ role: "assistant", content: current || fullText });
        setStreaming(false);
        streamAbort = null;
        updateSendState();
      }

      var streamTimer = setTimeout(tick, STREAM_CHAR_DELAY);
      streamAbort = function () { aborted = true; clearTimeout(streamTimer); finalize(); };
    }, STREAM_START_DELAY);

    streamAbort = function () { aborted = true; clearTimeout(startTimer); hideTyping(); setStreaming(false); streamAbort = null; };
  }

  function handleSend() {
    var text = els.input.value.trim();
    if (!text || state.streaming) return;

    removeWelcomeIfNeeded();
    hideError();
    addMessage("user", text);
    els.input.value = "";
    updateSendState();

    sendMock(text);
  }

  function handleStop() {
    if (streamAbort) streamAbort();
  }

  function wireEvents() {
    els.fab.addEventListener("click", togglePopup);
    els.closeBtn.addEventListener("click", closePopup);

    els.input.addEventListener("input", function () { updateSendState(); });
    els.input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
    });

    els.sendBtn.addEventListener("click", handleSend);
    els.stopBtn.addEventListener("click", handleStop);
  }

  function init() {
    build();
    startIdleTimer();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
