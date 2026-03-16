/**
 * Roller Shutter Card for Home Assistant
 * 
 * A visual interactive card to control roller shutters (covers)
 * with per-entity configuration and automatic entity discovery.
 * 
 * @version 1.1.1
 * @license MIT
 */

const CARD_VERSION = "1.1.1";

console.info(
  `%c  ROLLER-SHUTTER-CARD  %c  v${CARD_VERSION}  `,
  "color: #fff; background: #2d5a87; font-weight: bold; padding: 2px 6px; border-radius: 4px 0 0 4px;",
  "color: #2d5a87; background: #e8e8f0; font-weight: bold; padding: 2px 6px; border-radius: 0 4px 4px 0;"
);

// ─── Default configuration ───────────────────────────────────────────
const GLOBAL_DEFAULTS = {
  type: "custom:roller-shutter-card",
  title: "Volets Roulants",
  entities: [],
  shutter_width: 140,
  shutter_height: 180,
  columns: 0,
  gap: 28,
  color_open: "#63b3ed",
  color_closed: "#ed8936",
  color_background: "var(--ha-card-background, var(--card-background-color, #1a1a2e))",
  show_buttons: true,
  show_percentage: true,
  show_global_controls: true,
  show_drag_hint: true,
  show_sky: true,
  show_stars: true,
  show_window_frame: true,
  invert_position: false,
};

const PER_ENTITY_KEYS = [
  "shutter_width", "shutter_height",
  "show_buttons", "show_percentage", "show_sky",
  "show_stars", "show_window_frame", "invert_position",
  "color_open", "color_closed",
];


// ═══════════════════════════════════════════════════════════════════════
// ─── MAIN CARD ──────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════

class RollerShutterCard extends HTMLElement {

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = null;
    this._dragging = null;

    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
    this._onTouchMove = this._onTouchMove.bind(this);
    this._onTouchEnd = this._onTouchEnd.bind(this);
  }

  // ── HA Lifecycle ──────────────────────────────────────────────────

  setConfig(config) {
    this._config = { ...GLOBAL_DEFAULTS, ...config };
    if (!Array.isArray(this._config.entities)) {
      this._config.entities = [];
    }
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._updateStates();
  }

  getCardSize() {
    return 4;
  }

  static getConfigElement() {
    return document.createElement("roller-shutter-card-editor");
  }

  static getStubConfig(hass) {
    const covers = hass ? Object.keys(hass.states).filter(e => e.startsWith("cover.")) : [];
    return {
      entities: covers.slice(0, 2).map(e => ({ entity: e })),
      title: "Volets Roulants",
    };
  }

  // ── Per-Entity Config Resolution ──────────────────────────────────

  _getEntityConfig(entityId) {
    const entry = this._config.entities.find(
      (e) => (typeof e === "string" ? e : e.entity) === entityId
    );
    return typeof entry === "object" ? entry : { entity: entityId };
  }

  _resolve(entityId, key) {
    const ec = this._getEntityConfig(entityId);
    return ec[key] !== undefined ? ec[key] : this._config[key];
  }

  _getPosition(entityId) {
    if (!this._hass) return 0;
    const state = this._hass.states[entityId];
    if (!state) return 0;
    const pos = state.attributes.current_position ?? 0;
    const invert = this._resolve(entityId, "invert_position");
    return invert ? pos : 100 - pos;
  }

  _getFriendlyName(entityId) {
    if (!this._hass) return entityId;
    const state = this._hass.states[entityId];
    return state?.attributes?.friendly_name || entityId.split(".").pop().replace(/_/g, " ");
  }

  _getEntityIcon(entityId) {
    return this._getEntityConfig(entityId).icon || "🪟";
  }

  _getEntityName(entityId) {
    return this._getEntityConfig(entityId).name || this._getFriendlyName(entityId);
  }

  _getEntityIds() {
    return this._config.entities.map((e) => (typeof e === "string" ? e : e.entity));
  }

  _setPosition(entityId, visualPos) {
    const invert = this._resolve(entityId, "invert_position");
    const servicePos = invert ? visualPos : 100 - visualPos;
    this._hass.callService("cover", "set_cover_position", {
      entity_id: entityId,
      position: Math.max(0, Math.min(100, servicePos)),
    });
  }

  _openCover(entityId) {
    this._hass.callService("cover", "open_cover", { entity_id: entityId });
  }

  _closeCover(entityId) {
    this._hass.callService("cover", "close_cover", { entity_id: entityId });
  }

  _stopCover(entityId) {
    this._hass.callService("cover", "stop_cover", { entity_id: entityId });
  }

  // ── Drag Handling ─────────────────────────────────────────────────

  _startDrag(entityId, clientY) {
    this._dragging = entityId;
    window.addEventListener("mousemove", this._onMouseMove);
    window.addEventListener("mouseup", this._onMouseUp);
    window.addEventListener("touchmove", this._onTouchMove, { passive: false });
    window.addEventListener("touchend", this._onTouchEnd);
    this._handleDragMove(clientY);
  }

  _onMouseMove(e) { this._handleDragMove(e.clientY); }
  _onTouchMove(e) { e.preventDefault(); this._handleDragMove(e.touches[0].clientY); }

  _handleDragMove(clientY) {
    if (!this._dragging) return;
    const windowEl = this.shadowRoot.querySelector(`[data-entity="${this._dragging}"] .shutter-window`);
    if (!windowEl) return;
    const rect = windowEl.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    this._updateShutterVisual(this._dragging, Math.round(ratio * 100));
  }

  _onMouseUp(e) { this._endDrag(e.clientY); }
  _onTouchEnd(e) { this._endDrag(e.changedTouches?.[0]?.clientY ?? 0); }

  _endDrag(clientY) {
    if (!this._dragging) return;
    const windowEl = this.shadowRoot.querySelector(`[data-entity="${this._dragging}"] .shutter-window`);
    if (windowEl) {
      const rect = windowEl.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
      this._setPosition(this._dragging, Math.round(ratio * 100));
    }
    this._dragging = null;
    window.removeEventListener("mousemove", this._onMouseMove);
    window.removeEventListener("mouseup", this._onMouseUp);
    window.removeEventListener("touchmove", this._onTouchMove);
    window.removeEventListener("touchend", this._onTouchEnd);
  }

  // ── Visual Update ─────────────────────────────────────────────────

  _updateShutterVisual(entityId, position) {
    const container = this.shadowRoot.querySelector(`[data-entity="${entityId}"]`);
    if (!container) return;

    const shutterEl = container.querySelector(".shutter-slats");
    const handleEl = container.querySelector(".drag-handle");
    const pctEl = container.querySelector(".percentage");
    const statusEl = container.querySelector(".status-text");
    const skyEl = container.querySelector(".sky");

    if (shutterEl) {
      shutterEl.style.height = `${position}%`;
      const slatsCount = Math.floor(position / 4);
      shutterEl.innerHTML = "";
      for (let i = 0; i < slatsCount; i++) {
        const slat = document.createElement("div");
        slat.className = "slat";
        shutterEl.appendChild(slat);
      }
      const bar = document.createElement("div");
      bar.className = "bottom-bar";
      shutterEl.appendChild(bar);
    }

    if (handleEl) {
      handleEl.style.top = `${position}%`;
      handleEl.style.display = position > 5 && position < 95 ? "flex" : "none";
    }

    if (pctEl) pctEl.textContent = `${100 - position}%`;
    if (skyEl) skyEl.style.opacity = Math.max(0, 1 - position / 100);

    if (statusEl) {
      statusEl.textContent = position === 0 ? "Ouvert" : position === 100 ? "Fermé" : `Fermé à ${position}%`;
    }

    const btnOpen = container.querySelector(".btn-open");
    const btnClose = container.querySelector(".btn-close");
    if (btnOpen) btnOpen.classList.toggle("active", position === 0);
    if (btnClose) btnClose.classList.toggle("active", position === 100);
  }

  _updateStates() {
    if (!this._hass) return;
    for (const entityId of this._getEntityIds()) {
      if (this._dragging === entityId) continue;
      this._updateShutterVisual(entityId, this._getPosition(entityId));
    }
    this._updateHeaderCounts();
  }

  _updateHeaderCounts() {
    const entities = this._getEntityIds();
    let openCount = 0, closedCount = 0;
    for (const eid of entities) {
      const pos = this._getPosition(eid);
      if (pos === 0) openCount++;
      else if (pos === 100) closedCount++;
    }
    const subtitle = this.shadowRoot.querySelector(".card-subtitle");
    if (subtitle) {
      subtitle.textContent = `${openCount} ouvert${openCount > 1 ? "s" : ""} · ${closedCount} fermé${closedCount > 1 ? "s" : ""}`;
    }
  }

  // ── Rendering ─────────────────────────────────────────────────────

  _render() {
    const c = this._config;
    const entities = this._getEntityIds();
    const globalW = c.shutter_width;
    const colTemplate = c.columns
      ? `repeat(${c.columns}, 1fr)`
      : `repeat(auto-fill, minmax(${globalW + 50}px, 1fr))`;

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        .card {
          background: ${c.color_background};
          border-radius: 16px;
          overflow: hidden;
          font-family: var(--ha-card-font-family, 'Segoe UI', Roboto, sans-serif);
        }
        .card-header {
          padding: 16px 20px 12px;
          display: flex; align-items: center; justify-content: space-between;
          border-bottom: 1px solid var(--divider-color, rgba(100,100,140,0.1));
          flex-wrap: wrap; gap: 8px;
        }
        .card-header-left { display: flex; align-items: center; gap: 12px; }
        .card-icon {
          width: 36px; height: 36px; border-radius: 10px;
          background: linear-gradient(135deg, #2d5a87, #1a3a5c);
          display: flex; align-items: center; justify-content: center;
          font-size: 18px; box-shadow: 0 2px 8px rgba(45,90,135,0.25); flex-shrink: 0;
        }
        .card-title { font-size: 16px; font-weight: 700; color: var(--primary-text-color, #e8e8f0); }
        .card-subtitle { font-size: 12px; color: var(--secondary-text-color, #6a6a8a); margin-top: 1px; }
        .global-controls { display: flex; gap: 8px; }
        .global-btn {
          padding: 6px 12px; border-radius: 8px; border: 1px solid;
          font-size: 12px; font-weight: 600; cursor: pointer;
          font-family: inherit; transition: all 0.2s; background: transparent;
        }
        .global-btn.open { border-color: rgba(99,179,237,0.25); color: ${c.color_open}; }
        .global-btn.open:hover { background: rgba(99,179,237,0.12); }
        .global-btn.close { border-color: rgba(237,137,54,0.25); color: ${c.color_closed}; }
        .global-btn.close:hover { background: rgba(237,137,54,0.12); }

        .shutters-grid {
          padding: ${c.gap}px;
          display: grid;
          grid-template-columns: ${colTemplate};
          gap: ${c.gap}px;
          justify-items: center;
        }

        .shutter-item { display: flex; flex-direction: column; align-items: center; gap: 10px; }

        .shutter-window {
          border-radius: 6px;
          border: 3px solid var(--divider-color, #4a4a5a);
          background: #1a1a2e;
          position: relative; overflow: hidden;
          cursor: ns-resize;
          box-shadow: inset 0 0 25px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.2);
          user-select: none; touch-action: none;
        }

        .sky {
          position: absolute; inset: 0;
          background: linear-gradient(180deg, #1a3a5c 10%, #2d5a87 40%, #e8a040 95%, #d4763a 100%);
          transition: opacity 0.2s ease; pointer-events: none;
        }
        .stars { position: absolute; inset: 0; pointer-events: none; }
        .star { position: absolute; background: #fff; border-radius: 50%; }

        .window-cross-v, .window-cross-h {
          position: absolute; background: rgba(100,100,120,0.4); z-index: 1; pointer-events: none;
        }
        .window-cross-v { top: 0; left: 50%; transform: translateX(-50%); width: 2px; height: 100%; }
        .window-cross-h { top: 50%; left: 0; transform: translateY(-50%); height: 2px; width: 100%; }

        .shutter-slats {
          position: absolute; top: 0; left: 0; right: 0; z-index: 2;
          display: flex; flex-direction: column; overflow: hidden;
          transition: height 0.3s ease;
        }
        .slat {
          flex: 1 0 auto; min-height: 5px; max-height: 7px;
          background: linear-gradient(180deg, #8a8a9a 0%, #6a6a7a 40%, #5a5a6a 100%);
          border-bottom: 1px solid #4a4a5a;
        }
        .slat:first-child { border-top: 1px solid #9a9aaa; }
        .bottom-bar {
          height: 5px;
          background: linear-gradient(180deg, #7a7a8a, #5a5a6a);
          border-radius: 0 0 2px 2px;
          box-shadow: 0 2px 5px rgba(0,0,0,0.35); flex-shrink: 0;
        }

        .drag-handle {
          position: absolute; left: 50%; transform: translate(-50%, -50%);
          z-index: 5; width: 32px; height: 16px; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          transition: top 0.3s ease; pointer-events: none;
        }
        .handle-lines { display: flex; flex-direction: column; gap: 2px; align-items: center; }
        .handle-line { height: 1.5px; background: #fff; border-radius: 1px; }
        .handle-line:first-child { width: 12px; }
        .handle-line:last-child { width: 8px; }

        .percentage {
          position: absolute; bottom: 6px; right: 8px; z-index: 10;
          font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
          font-weight: 700; color: #fff;
          text-shadow: 0 1px 4px rgba(0,0,0,0.7); pointer-events: none;
        }

        .shutter-buttons { display: flex; gap: 6px; }
        .shutter-btn {
          width: 34px; height: 34px; border-radius: 10px;
          border: 1.5px solid rgba(120,120,140,0.25);
          background: rgba(40,40,55,0.5);
          color: var(--secondary-text-color, #8a8a9a);
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          font-size: 14px; transition: all 0.2s;
        }
        .shutter-btn:hover { background: rgba(60,60,80,0.5); }
        .btn-open.active { border-color: var(--color-open); color: var(--color-open); background: rgba(99,179,237,0.12); }
        .btn-close.active { border-color: var(--color-closed); color: var(--color-closed); background: rgba(237,137,54,0.12); }

        .shutter-label { text-align: center; }
        .shutter-icon { font-size: 18px; margin-bottom: 2px; }
        .shutter-name { font-size: 13px; font-weight: 600; color: var(--primary-text-color, #d0d0e0); }
        .status-text { font-size: 11px; color: var(--secondary-text-color, #7a7a9a); margin-top: 2px; }

        .card-footer {
          padding: 10px 20px 14px; text-align: center;
          border-top: 1px solid var(--divider-color, rgba(100,100,140,0.08));
        }
        .card-footer p { margin: 0; font-size: 11px; color: var(--secondary-text-color, #5a5a7a); }

        .empty-state {
          padding: 32px 20px; text-align: center;
          color: var(--secondary-text-color, #7a7a9a);
        }
        .empty-state .empty-icon { font-size: 40px; margin-bottom: 8px; }
        .empty-state .empty-text { font-size: 14px; }
        .empty-state .empty-hint { font-size: 12px; margin-top: 4px; opacity: 0.7; }
      </style>

      <ha-card>
        <div class="card">
          ${this._renderHeader()}
          ${entities.length > 0 ? `
            <div class="shutters-grid">
              ${entities.map((eid) => this._renderShutter(eid)).join("")}
            </div>
          ` : `
            <div class="empty-state">
              <div class="empty-icon">🪟</div>
              <div class="empty-text">Aucun volet configuré</div>
              <div class="empty-hint">Modifiez la carte pour sélectionner vos volets</div>
            </div>
          `}
          ${c.show_drag_hint && entities.length > 0 ? `<div class="card-footer"><p>↕ Glissez sur la fenêtre pour régler la hauteur</p></div>` : ""}
        </div>
      </ha-card>
    `;

    this._attachEvents();
  }

  _renderHeader() {
    const c = this._config;
    if (!c.title && !c.show_global_controls) return "";
    return `
      <div class="card-header">
        <div class="card-header-left">
          <div class="card-icon">🪟</div>
          <div>
            ${c.title ? `<div class="card-title">${c.title}</div>` : ""}
            <div class="card-subtitle"></div>
          </div>
        </div>
        ${c.show_global_controls ? `
          <div class="global-controls">
            <button class="global-btn open" data-action="open-all">Tout ouvrir</button>
            <button class="global-btn close" data-action="close-all">Tout fermer</button>
          </div>
        ` : ""}
      </div>
    `;
  }

  _renderShutter(entityId) {
    const W = this._resolve(entityId, "shutter_width");
    const H = this._resolve(entityId, "shutter_height");
    const showBtns = this._resolve(entityId, "show_buttons");
    const showPct = this._resolve(entityId, "show_percentage");
    const showSky = this._resolve(entityId, "show_sky");
    const showStars = this._resolve(entityId, "show_stars");
    const showFrame = this._resolve(entityId, "show_window_frame");
    const colorOpen = this._resolve(entityId, "color_open");
    const colorClosed = this._resolve(entityId, "color_closed");
    const name = this._getEntityName(entityId);
    const icon = this._getEntityIcon(entityId);

    const stars = showStars
      ? [
          { top: 15, left: 20, s: 2 }, { top: 25, left: 70, s: 1.5 },
          { top: 10, left: 50, s: 2.5 }, { top: 35, left: 35, s: 1 },
          { top: 20, left: 85, s: 1.5 }, { top: 40, left: 60, s: 2 },
        ].map(st =>
          `<div class="star" style="top:${st.top}%;left:${st.left}%;width:${st.s}px;height:${st.s}px;box-shadow:0 0 ${st.s * 2}px rgba(255,255,255,0.6)"></div>`
        ).join("")
      : "";

    return `
      <div class="shutter-item" data-entity="${entityId}" style="--color-open:${colorOpen};--color-closed:${colorClosed};">
        <div class="shutter-window" data-entity="${entityId}" style="width:${W}px;height:${H}px;">
          ${showSky ? `<div class="sky"></div>` : ""}
          ${showStars ? `<div class="stars">${stars}</div>` : ""}
          ${showFrame ? `<div class="window-cross-v"></div><div class="window-cross-h"></div>` : ""}
          <div class="shutter-slats"></div>
          <div class="drag-handle" style="background:${colorOpen};box-shadow:0 0 8px ${colorOpen}66;">
            <div class="handle-lines"><div class="handle-line"></div><div class="handle-line"></div></div>
          </div>
          ${showPct ? `<div class="percentage" style="font-size:${Math.max(14, Math.min(20, W / 7))}px;">0%</div>` : ""}
        </div>
        ${showBtns ? `
          <div class="shutter-buttons">
            <button class="shutter-btn btn-open" data-action="open" data-entity="${entityId}" title="Ouvrir">▲</button>
            <button class="shutter-btn btn-stop" data-action="stop" data-entity="${entityId}" title="Stop">◼</button>
            <button class="shutter-btn btn-close" data-action="close" data-entity="${entityId}" title="Fermer">▼</button>
          </div>
        ` : ""}
        <div class="shutter-label">
          <div class="shutter-icon">${icon}</div>
          <div class="shutter-name">${name}</div>
          <div class="status-text"></div>
        </div>
      </div>
    `;
  }

  _attachEvents() {
    this.shadowRoot.querySelectorAll(".shutter-window").forEach((win) => {
      const entityId = win.dataset.entity;
      win.addEventListener("mousedown", (e) => { e.preventDefault(); this._startDrag(entityId, e.clientY); });
      win.addEventListener("touchstart", (e) => { this._startDrag(entityId, e.touches[0].clientY); }, { passive: true });
    });
    this.shadowRoot.querySelectorAll(".shutter-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const entityId = btn.dataset.entity;
        const action = btn.dataset.action;
        if (action === "open") this._openCover(entityId);
        else if (action === "close") this._closeCover(entityId);
        else if (action === "stop") this._stopCover(entityId);
      });
    });
    const openAll = this.shadowRoot.querySelector('[data-action="open-all"]');
    const closeAll = this.shadowRoot.querySelector('[data-action="close-all"]');
    if (openAll) openAll.addEventListener("click", () => this._getEntityIds().forEach(eid => this._openCover(eid)));
    if (closeAll) closeAll.addEventListener("click", () => this._getEntityIds().forEach(eid => this._closeCover(eid)));
  }
}


// ═══════════════════════════════════════════════════════════════════════
// ─── VISUAL CONFIG EDITOR with Entity Picker & Per-Entity Options ───
// ═══════════════════════════════════════════════════════════════════════

class RollerShutterCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = null;
    this._expandedEntity = null;
  }

  setConfig(config) {
    this._config = { ...GLOBAL_DEFAULTS, ...config };
    if (!Array.isArray(this._config.entities)) {
      this._config.entities = [];
    }
    this._render();
  }

  set hass(hass) {
    const hadHass = !!this._hass;
    this._hass = hass;
    if (!hadHass) this._render();
  }

  _getAvailableCovers() {
    if (!this._hass) return [];
    return Object.keys(this._hass.states)
      .filter(e => e.startsWith("cover."))
      .sort()
      .map(entityId => ({
        entity_id: entityId,
        name: this._hass.states[entityId]?.attributes?.friendly_name || entityId,
      }));
  }

  _getSelectedEntityIds() {
    return this._config.entities.map(e => typeof e === "string" ? e : e.entity);
  }

  _getEntityObj(entityId) {
    const entry = this._config.entities.find(e => (typeof e === "string" ? e : e.entity) === entityId);
    if (!entry) return null;
    return typeof entry === "object" ? { ...entry } : { entity: entry };
  }

  _fireChanged() {
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: { ...this._config } },
      bubbles: true, composed: true,
    }));
  }

  _toggleEntity(entityId, selected) {
    let entities = [...this._config.entities];
    if (selected) {
      if (!this._getSelectedEntityIds().includes(entityId)) {
        entities.push({ entity: entityId });
      }
    } else {
      entities = entities.filter(e => (typeof e === "string" ? e : e.entity) !== entityId);
      if (this._expandedEntity === entityId) this._expandedEntity = null;
    }
    this._config = { ...this._config, entities };
    this._fireChanged();
    this._render();
  }

  _moveEntity(entityId, direction) {
    const entities = [...this._config.entities];
    const idx = entities.findIndex(e => (typeof e === "string" ? e : e.entity) === entityId);
    if (idx < 0) return;
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= entities.length) return;
    [entities[idx], entities[swapIdx]] = [entities[swapIdx], entities[idx]];
    this._config = { ...this._config, entities };
    this._fireChanged();
    this._render();
  }

  _updateEntityProp(entityId, key, value) {
    const entities = this._config.entities.map(e => {
      const eid = typeof e === "string" ? e : e.entity;
      if (eid !== entityId) return e;
      const obj = typeof e === "object" ? { ...e } : { entity: e };
      if (value === "" || value === undefined) {
        delete obj[key];
      } else {
        obj[key] = value;
      }
      return obj;
    });
    this._config = { ...this._config, entities };
    this._fireChanged();
  }

  _updateGlobal(key, value) {
    this._config = { ...this._config, [key]: value };
    this._fireChanged();
  }

  _render() {
    const c = this._config;
    const covers = this._getAvailableCovers();
    const selectedIds = this._getSelectedEntityIds();

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        .editor {
          padding: 16px;
          font-family: var(--ha-card-font-family, sans-serif);
          color: var(--primary-text-color, #333);
        }
        .section {
          margin-bottom: 20px;
          border: 1px solid var(--divider-color, #e0e0e0);
          border-radius: 12px;
          overflow: hidden;
        }
        .section-header {
          padding: 12px 16px;
          background: var(--secondary-background-color, #f5f5f5);
          font-size: 14px; font-weight: 600;
          display: flex; align-items: center; gap: 8px;
        }
        .section-body { padding: 12px 16px; }

        .entity-list { display: flex; flex-direction: column; gap: 2px; }
        .entity-row {
          display: flex; align-items: center; gap: 10px;
          padding: 8px 10px; border-radius: 8px;
          transition: background 0.15s;
        }
        .entity-row:hover { background: var(--secondary-background-color, #f5f5f5); }
        .entity-row.selected { background: rgba(45,90,135,0.08); }
        .entity-cb { width: 18px; height: 18px; cursor: pointer; accent-color: #2d5a87; flex-shrink: 0; }
        .entity-info { flex: 1; min-width: 0; }
        .entity-friendly { font-size: 14px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .entity-id { font-size: 11px; color: var(--secondary-text-color, #888); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .entity-actions { display: flex; gap: 4px; align-items: center; flex-shrink: 0; }
        .icon-btn {
          width: 28px; height: 28px; border-radius: 6px;
          border: 1px solid var(--divider-color, #ddd);
          background: transparent; color: var(--secondary-text-color, #888);
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          font-size: 14px; transition: all 0.15s;
        }
        .icon-btn:hover { background: var(--secondary-background-color, #eee); color: var(--primary-text-color); }
        .icon-btn.active { background: #2d5a87; color: #fff; border-color: #2d5a87; }

        .entity-options {
          margin: 4px 0 8px 36px;
          padding: 12px;
          background: var(--secondary-background-color, #f9f9f9);
          border-radius: 10px;
          border: 1px solid var(--divider-color, #e0e0e0);
        }
        .opt-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .opt-field label {
          display: block; font-size: 12px; margin-bottom: 3px;
          color: var(--secondary-text-color, #666);
        }
        .opt-field input[type="text"],
        .opt-field input[type="number"] {
          width: 100%; padding: 6px 8px; border-radius: 6px;
          border: 1px solid var(--divider-color, #ccc);
          background: var(--card-background-color, #fff);
          color: var(--primary-text-color, #333);
          font-size: 13px; font-family: inherit;
          box-sizing: border-box;
        }
        .opt-field input[type="color"] {
          width: 100%; height: 32px; border-radius: 6px;
          border: 1px solid var(--divider-color, #ccc); cursor: pointer;
        }
        .opt-checks {
          grid-column: 1 / -1;
          display: flex; flex-wrap: wrap; gap: 8px 16px;
        }
        .opt-check {
          display: flex; align-items: center; gap: 5px;
          font-size: 12px; color: var(--secondary-text-color);
        }
        .opt-check input { width: 15px; height: 15px; accent-color: #2d5a87; }
        .opt-hint {
          grid-column: 1 / -1;
          font-size: 11px; color: var(--secondary-text-color, #999);
          font-style: italic;
        }

        .field { margin-bottom: 12px; }
        .field label { display: block; font-size: 13px; margin-bottom: 4px; color: var(--secondary-text-color); }
        .field input, .field select {
          width: 100%; padding: 8px; border-radius: 8px;
          border: 1px solid var(--divider-color, #ccc);
          background: var(--card-background-color, #fff);
          color: var(--primary-text-color, #333);
          font-size: 14px; font-family: inherit; box-sizing: border-box;
        }
        .row { display: flex; gap: 12px; }
        .row .field { flex: 1; }
        .checks { display: flex; flex-wrap: wrap; gap: 8px 18px; padding: 4px 0; }
        .check-item { display: flex; align-items: center; gap: 6px; font-size: 13px; }
        .check-item input { accent-color: #2d5a87; }

        .no-covers {
          padding: 20px; text-align: center;
          color: var(--secondary-text-color, #888);
          font-style: italic;
        }
        .search-box { margin-bottom: 8px; }
        .search-box input {
          width: 100%; padding: 8px 12px; border-radius: 8px;
          border: 1px solid var(--divider-color, #ccc);
          background: var(--card-background-color, #fff);
          color: var(--primary-text-color, #333);
          font-size: 14px; box-sizing: border-box;
        }
        .selected-count {
          font-size: 12px; color: var(--secondary-text-color);
          padding: 4px 0 8px;
        }
      </style>

      <div class="editor">

        <div class="section">
          <div class="section-header">📝 Général</div>
          <div class="section-body">
            <div class="field">
              <label>Titre de la carte</label>
              <input type="text" id="title" value="${c.title || ""}" />
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-header">🪟 Entités (covers)</div>
          <div class="section-body">
            <div class="search-box">
              <input type="text" id="entity-search" placeholder="Rechercher un volet..." />
            </div>
            <div class="selected-count">${selectedIds.length} sélectionné${selectedIds.length > 1 ? "s" : ""} sur ${covers.length} disponible${covers.length > 1 ? "s" : ""}</div>
            ${covers.length === 0
              ? `<div class="no-covers">Aucune entité cover.* trouvée.<br>Vérifiez que vos volets sont bien configurés.</div>`
              : `<div class="entity-list" id="entity-list">
                  ${this._renderEntityList(covers, selectedIds)}
                </div>`
            }
          </div>
        </div>

        <div class="section">
          <div class="section-header">📐 Options globales (par défaut)</div>
          <div class="section-body">
            <div class="row">
              <div class="field">
                <label>Largeur (px)</label>
                <input type="number" id="g_shutter_width" value="${c.shutter_width}" min="80" max="300" />
              </div>
              <div class="field">
                <label>Hauteur (px)</label>
                <input type="number" id="g_shutter_height" value="${c.shutter_height}" min="100" max="400" />
              </div>
            </div>
            <div class="row">
              <div class="field">
                <label>Colonnes (0 = auto)</label>
                <input type="number" id="g_columns" value="${c.columns}" min="0" max="8" />
              </div>
              <div class="field">
                <label>Espacement (px)</label>
                <input type="number" id="g_gap" value="${c.gap}" min="4" max="60" />
              </div>
            </div>
            <div class="row">
              <div class="field">
                <label>Couleur ouvert</label>
                <input type="color" id="g_color_open" value="${c.color_open}" />
              </div>
              <div class="field">
                <label>Couleur fermé</label>
                <input type="color" id="g_color_closed" value="${c.color_closed}" />
              </div>
            </div>
            <div style="margin-top:10px;">
              <label style="font-size:13px;color:var(--secondary-text-color);margin-bottom:6px;display:block;">Options d'affichage</label>
              <div class="checks">
                ${this._gCheck("show_buttons", "Boutons", c.show_buttons)}
                ${this._gCheck("show_percentage", "Pourcentage", c.show_percentage)}
                ${this._gCheck("show_global_controls", "Contrôles globaux", c.show_global_controls)}
                ${this._gCheck("show_drag_hint", "Indication glissement", c.show_drag_hint)}
                ${this._gCheck("show_sky", "Ciel", c.show_sky)}
                ${this._gCheck("show_stars", "Étoiles", c.show_stars)}
                ${this._gCheck("show_window_frame", "Croisillons", c.show_window_frame)}
                ${this._gCheck("invert_position", "Inverser position", c.invert_position)}
              </div>
            </div>
          </div>
        </div>

      </div>
    `;

    this._attachEditorEvents();
  }

  _gCheck(id, label, checked) {
    return `<div class="check-item"><input type="checkbox" id="g_${id}" ${checked ? "checked" : ""} /><label for="g_${id}">${label}</label></div>`;
  }

  _renderEntityList(covers, selectedIds) {
    const selectedCovers = selectedIds
      .map(id => covers.find(c => c.entity_id === id))
      .filter(Boolean);
    const unselectedCovers = covers.filter(c => !selectedIds.includes(c.entity_id));
    const ordered = [...selectedCovers, ...unselectedCovers];

    return ordered.map((cover) => {
      const isSelected = selectedIds.includes(cover.entity_id);
      const entityObj = isSelected ? this._getEntityObj(cover.entity_id) : null;
      const isExpanded = this._expandedEntity === cover.entity_id;
      const selectedIdx = selectedIds.indexOf(cover.entity_id);

      return `
        <div class="entity-row ${isSelected ? "selected" : ""}" data-entity-row="${cover.entity_id}">
          <input type="checkbox" class="entity-cb" data-entity="${cover.entity_id}" ${isSelected ? "checked" : ""} />
          <div class="entity-info">
            <div class="entity-friendly">${cover.name}</div>
            <div class="entity-id">${cover.entity_id}</div>
          </div>
          ${isSelected ? `
            <div class="entity-actions">
              <button class="icon-btn" data-move="${cover.entity_id}" data-dir="-1" title="Monter" ${selectedIdx === 0 ? "disabled" : ""}>↑</button>
              <button class="icon-btn" data-move="${cover.entity_id}" data-dir="1" title="Descendre" ${selectedIdx === selectedIds.length - 1 ? "disabled" : ""}>↓</button>
              <button class="icon-btn ${isExpanded ? "active" : ""}" data-expand="${cover.entity_id}" title="Options individuelles">⚙</button>
            </div>
          ` : ""}
        </div>
        ${isSelected && isExpanded ? this._renderEntityOptions(cover.entity_id, entityObj) : ""}
      `;
    }).join("");
  }

  _renderEntityOptions(entityId, entityObj) {
    const c = this._config;
    const val = (key) => entityObj?.[key] !== undefined ? entityObj[key] : "";
    const placeholder = (key) => `défaut: ${c[key]}`;

    return `
      <div class="entity-options" data-options="${entityId}">
        <div class="opt-grid">
          <div class="opt-field">
            <label>Nom personnalisé</label>
            <input type="text" data-eprop="${entityId}|name" value="${val("name")}" placeholder="Auto" />
          </div>
          <div class="opt-field">
            <label>Icône (emoji)</label>
            <input type="text" data-eprop="${entityId}|icon" value="${val("icon")}" placeholder="🪟" />
          </div>
          <div class="opt-field">
            <label>Largeur (px)</label>
            <input type="number" data-eprop="${entityId}|shutter_width" value="${val("shutter_width")}" placeholder="${placeholder("shutter_width")}" min="80" max="300" />
          </div>
          <div class="opt-field">
            <label>Hauteur (px)</label>
            <input type="number" data-eprop="${entityId}|shutter_height" value="${val("shutter_height")}" placeholder="${placeholder("shutter_height")}" min="100" max="400" />
          </div>
          <div class="opt-field">
            <label>Couleur ouvert</label>
            <input type="color" data-eprop="${entityId}|color_open" value="${val("color_open") || c.color_open}" />
          </div>
          <div class="opt-field">
            <label>Couleur fermé</label>
            <input type="color" data-eprop="${entityId}|color_closed" value="${val("color_closed") || c.color_closed}" />
          </div>
          <div class="opt-checks">
            ${this._eCheck(entityId, "show_buttons", "Boutons", entityObj)}
            ${this._eCheck(entityId, "show_percentage", "Pourcentage", entityObj)}
            ${this._eCheck(entityId, "show_sky", "Ciel", entityObj)}
            ${this._eCheck(entityId, "show_stars", "Étoiles", entityObj)}
            ${this._eCheck(entityId, "show_window_frame", "Croisillons", entityObj)}
            ${this._eCheck(entityId, "invert_position", "Inverser pos.", entityObj)}
          </div>
          <div class="opt-hint">Laissez vide pour utiliser les options globales.</div>
        </div>
      </div>
    `;
  }

  _eCheck(entityId, key, label, entityObj) {
    const globalVal = this._config[key];
    const localVal = entityObj?.[key];
    const isOverridden = localVal !== undefined;
    const checked = isOverridden ? localVal : globalVal;
    return `<div class="opt-check">
      <input type="checkbox" data-echeck="${entityId}|${key}" ${checked ? "checked" : ""} />
      <label>${label}</label>
    </div>`;
  }

  _attachEditorEvents() {
    const $ = (sel) => this.shadowRoot.querySelector(sel);
    const $$ = (sel) => this.shadowRoot.querySelectorAll(sel);

    const titleEl = $("#title");
    if (titleEl) titleEl.addEventListener("input", () => this._updateGlobal("title", titleEl.value));

    const searchEl = $("#entity-search");
    if (searchEl) {
      searchEl.addEventListener("input", () => {
        const query = searchEl.value.toLowerCase();
        $$("[data-entity-row]").forEach(row => {
          const text = row.textContent.toLowerCase();
          row.style.display = text.includes(query) ? "" : "none";
        });
      });
    }

    $$(".entity-cb").forEach(cb => {
      cb.addEventListener("change", () => {
        this._toggleEntity(cb.dataset.entity, cb.checked);
      });
    });

    $$("[data-move]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this._moveEntity(btn.dataset.move, parseInt(btn.dataset.dir));
      });
    });

    $$("[data-expand]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const entityId = btn.dataset.expand;
        this._expandedEntity = this._expandedEntity === entityId ? null : entityId;
        this._render();
      });
    });

    $$("[data-eprop]").forEach(input => {
      input.addEventListener("change", () => {
        const [entityId, key] = input.dataset.eprop.split("|");
        let value = input.value;
        if (input.type === "number") value = value ? parseInt(value) : "";
        this._updateEntityProp(entityId, key, value);
      });
    });

    $$("[data-echeck]").forEach(cb => {
      cb.addEventListener("change", () => {
        const [entityId, key] = cb.dataset.echeck.split("|");
        this._updateEntityProp(entityId, key, cb.checked);
      });
    });

    const globalFields = {
      g_shutter_width: "shutter_width",
      g_shutter_height: "shutter_height",
      g_columns: "columns",
      g_gap: "gap",
      g_color_open: "color_open",
      g_color_closed: "color_closed",
    };
    for (const [elId, key] of Object.entries(globalFields)) {
      const el = $(`#${elId}`);
      if (el) {
        el.addEventListener("change", () => {
          this._updateGlobal(key, el.type === "number" ? (parseInt(el.value) || 0) : el.value);
        });
      }
    }

    const globalChecks = [
      "show_buttons", "show_percentage", "show_global_controls",
      "show_drag_hint", "show_sky", "show_stars", "show_window_frame", "invert_position"
    ];
    for (const key of globalChecks) {
      const el = $(`#g_${key}`);
      if (el) el.addEventListener("change", () => this._updateGlobal(key, el.checked));
    }
  }
}


// ─── Register ───────────────────────────────────────────────────────
customElements.define("roller-shutter-card", RollerShutterCard);
customElements.define("roller-shutter-card-editor", RollerShutterCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "roller-shutter-card",
  name: "Roller Shutter Card",
  description: "Carte visuelle interactive pour volets roulants avec contrôle par glissement",
  preview: true,
  documentationURL: "https://github.com/francordi85/roller-shutter-card",
});
