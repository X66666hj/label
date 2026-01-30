const state = {
  data: [],
  filtered: [],
  index: 0,
  annotations: {},
};

const els = {
  total: document.getElementById("stat-total"),
  done: document.getElementById("stat-done"),
  category: document.getElementById("stat-category"),
  recordId: document.getElementById("record-id"),
  recordCategory: document.getElementById("record-category"),
  conversation: document.getElementById("conversation"),
  items: document.getElementById("items"),
  index: document.getElementById("index"),
  indexTotal: document.getElementById("index-total"),
  categorySelect: document.getElementById("category"),
  search: document.getElementById("search"),
  hint: document.getElementById("selection-hint"),
  reason: document.getElementById("reason"),
};

function loadAnnotations() {
  try {
    const raw = localStorage.getItem("top5_annotations_v1");
    if (raw) state.annotations = JSON.parse(raw);
  } catch (err) {
    state.annotations = {};
  }
}

function saveAnnotations() {
  localStorage.setItem("top5_annotations_v1", JSON.stringify(state.annotations));
}

function setFiltered() {
  const category = els.categorySelect.value;
  const query = els.search.value.trim().toLowerCase();
  state.filtered = state.data.filter((row) => {
    if (category !== "All" && row.category !== category) return false;
    if (query) {
      return (row.conversation_text || "").toLowerCase().includes(query);
    }
    return true;
  });
  state.index = 0;
  render();
}

function getCurrent() {
  if (state.filtered.length === 0) return null;
  return state.filtered[state.index];
}

function updateStats() {
  els.total.textContent = state.data.length;
  const done = Object.values(state.annotations).filter(
    (v) => v?.selected?.length === 5 || v?.null === true
  ).length;
  els.done.textContent = done;
  els.category.textContent = els.categorySelect.value;
  els.index.textContent = state.filtered.length ? state.index + 1 : 0;
  els.indexTotal.textContent = state.filtered.length;
}

function ensureEntry(row) {
  if (!state.annotations[row.id]) {
    state.annotations[row.id] = { selected: [], category: row.category, null: false, reason: "" };
  }
  return state.annotations[row.id];
}

function renderConversation(row) {
  if (Array.isArray(row.conversation)) {
    els.conversation.innerHTML = "";
    row.conversation.forEach((msg) => {
      const role = String(msg.role || "").toLowerCase();
      const content = String(msg.content || "");
      const bubble = document.createElement("div");
      bubble.className = `bubble bubble--${role || "unknown"}`;
      const tag = document.createElement("div");
      tag.className = "bubble__role";
      tag.textContent = role ? role.toUpperCase() : "UNKNOWN";
      const body = document.createElement("div");
      body.className = "bubble__text";
      body.textContent = content;
      bubble.appendChild(tag);
      bubble.appendChild(body);
      els.conversation.appendChild(bubble);
    });
  } else {
    els.conversation.textContent = row.conversation_text || "";
  }
}

function render() {
  const row = getCurrent();
  updateStats();
  if (!row) {
    els.recordId.textContent = "-";
    els.recordCategory.textContent = "-";
    els.conversation.textContent = "No records.";
    els.items.innerHTML = "";
    els.reason.value = "";
    return;
  }
  els.recordId.textContent = row.id;
  els.recordCategory.textContent = row.category;
  renderConversation(row);

  const entry = ensureEntry(row);
  els.reason.value = entry.reason || "";
  els.items.innerHTML = "";

  const nullWrap = document.createElement("div");
  nullWrap.className = "item null-item";
  const nullCheckbox = document.createElement("input");
  nullCheckbox.type = "checkbox";
  nullCheckbox.checked = entry.null === true;
  const nullContent = document.createElement("div");
  const nullTitle = document.createElement("div");
  nullTitle.className = "item__title";
  nullTitle.textContent = "NULL (no suitable recommendation)";
  const nullMeta = document.createElement("div");
  nullMeta.className = "item__id";
  nullMeta.textContent = "Select to mark this conversation as not recommendable.";
  nullContent.appendChild(nullTitle);
  nullContent.appendChild(nullMeta);
  nullWrap.appendChild(nullCheckbox);
  nullWrap.appendChild(nullContent);
  if (nullCheckbox.checked) nullWrap.classList.add("selected");
  els.items.appendChild(nullWrap);

  nullCheckbox.addEventListener("change", () => {
    entry.null = nullCheckbox.checked;
    if (entry.null) entry.selected = [];
    state.annotations[row.id] = entry;
    saveAnnotations();
    render();
  });

  row.items.forEach((item) => {
    const wrap = document.createElement("div");
    wrap.className = "item";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = entry.selected.includes(item.id);
    const rankIndex = entry.selected.indexOf(item.id);
    const content = document.createElement("div");
    const title = document.createElement("div");
    title.className = "item__title";
    title.textContent = item.title || "(no title)";
    const meta = document.createElement("div");
    meta.className = "item__id";
    meta.textContent = item.id;
    content.appendChild(title);
    content.appendChild(meta);
    wrap.appendChild(checkbox);
    wrap.appendChild(content);
    if (checkbox.checked) wrap.classList.add("selected");

    if (rankIndex >= 0) {
      const badge = document.createElement("span");
      badge.className = "rank";
      badge.textContent = String(rankIndex + 1);
      wrap.appendChild(badge);

      const controls = document.createElement("div");
      controls.className = "item__controls";
      const up = document.createElement("button");
      up.type = "button";
      up.className = "mini";
      up.textContent = "Up";
      const down = document.createElement("button");
      down.type = "button";
      down.className = "mini";
      down.textContent = "Down";

      up.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const idx = entry.selected.indexOf(item.id);
        if (idx > 0) {
          [entry.selected[idx - 1], entry.selected[idx]] = [
            entry.selected[idx],
            entry.selected[idx - 1],
          ];
          state.annotations[row.id] = entry;
          saveAnnotations();
          render();
        }
      });

      down.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const idx = entry.selected.indexOf(item.id);
        if (idx >= 0 && idx < entry.selected.length - 1) {
          [entry.selected[idx + 1], entry.selected[idx]] = [
            entry.selected[idx],
            entry.selected[idx + 1],
          ];
          state.annotations[row.id] = entry;
          saveAnnotations();
          render();
        }
      });

      controls.appendChild(up);
      controls.appendChild(down);
      wrap.appendChild(controls);
    }

    checkbox.addEventListener("change", () => {
      if (entry.null) entry.null = false;
      if (checkbox.checked) {
        if (entry.selected.length >= 5) {
          checkbox.checked = false;
          return;
        }
        entry.selected.push(item.id);
      } else {
        const idx = entry.selected.indexOf(item.id);
        if (idx >= 0) entry.selected.splice(idx, 1);
      }
      state.annotations[row.id] = entry;
      saveAnnotations();
      render();
    });
    els.items.appendChild(wrap);
  });

  const selectedCount = entry.selected.length;
  const hasReason = Boolean((entry.reason || "").trim());
  if ((selectedCount === 5 || entry.null) && !hasReason) {
    els.hint.textContent = "Reason required.";
    els.hint.style.color = "var(--danger)";
  } else if (selectedCount === 5) {
    els.hint.textContent = "Selection complete.";
    els.hint.style.color = "var(--accent-2)";
  } else if (entry.null) {
    els.hint.textContent = "Marked as NULL (no recommendation).";
    els.hint.style.color = "var(--danger)";
  } else {
    els.hint.textContent = `Pick ${5 - selectedCount} more.`;
    els.hint.style.color = "var(--muted)";
  }
}

function exportJSON() {
  const blob = new Blob([JSON.stringify(state.annotations, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "top5_annotations.json";
  a.click();
  URL.revokeObjectURL(url);
}

function bind() {
  document.getElementById("prev").addEventListener("click", () => {
    if (state.index > 0) {
      state.index -= 1;
      render();
    }
  });
  document.getElementById("next").addEventListener("click", () => {
    if (state.index < state.filtered.length - 1) {
      state.index += 1;
      render();
    }
  });
  document.getElementById("clear").addEventListener("click", () => {
    const row = getCurrent();
    if (!row) return;
    const entry = ensureEntry(row);
    entry.selected = [];
    entry.null = false;
    state.annotations[row.id] = entry;
    saveAnnotations();
    render();
  });
  document.getElementById("export-json").addEventListener("click", exportJSON);
  els.categorySelect.addEventListener("change", setFiltered);
  els.search.addEventListener("input", () => {
    clearTimeout(window.__searchTimer);
    window.__searchTimer = setTimeout(setFiltered, 200);
  });
  els.reason.addEventListener("input", () => {
    const row = getCurrent();
    if (!row) return;
    const entry = ensureEntry(row);
    entry.reason = els.reason.value;
    state.annotations[row.id] = entry;
    saveAnnotations();
    render();
  });
}

async function init() {
  loadAnnotations();
  const res = await fetch("data.json");
  const data = await res.json();
  state.data = data;
  const categories = ["All", ...new Set(data.map((d) => d.category))].sort();
  categories.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    els.categorySelect.appendChild(opt);
  });
  setFiltered();
  bind();
}

init();
