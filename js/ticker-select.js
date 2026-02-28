/**
 * TickerSelect — Searchable Market Ticker Dropdown
 * Fetches live data from Supabase Edge Function → Yahoo Finance
 *
 * Usage:
 *   const ts = new TickerSelect({
 *     inputId: 'f-ticker',
 *     nameFieldId: 'f-company',    // optional autofill
 *     sectorFieldId: 'f-sector',   // optional autofill
 *     onChange: (item) => {}       // optional callback
 *   });
 */

class TickerSelect {
  constructor({ inputId, nameFieldId = null, sectorFieldId = null, onChange = null }) {
    this.inputId       = inputId;
    this.nameFieldId   = nameFieldId;
    this.sectorFieldId = sectorFieldId;
    this.onChange      = onChange;

    this.selected          = null;
    this.dropdownVisible   = false;
    this.highlightedIndex  = -1;
    this.debounceTimer     = null;
    this.cache             = {};
    this.loading           = false;
    this._currentResults   = [];

    // Edge Function URL — reads SUPABASE_URL from config.js
    this.edgeFnUrl = `${SUPABASE_URL}/functions/v1/get-tickers`;

    this.input = document.getElementById(inputId);
    if (!this.input) return;

    this._build();
    this._bind();

    // Pre-warm: fetch top 50 tickers so first focus is instant
    this._fetchTickers('');
  }

  _build() {
    const wrapper = document.createElement('div');
    wrapper.className = 'ts-wrapper';
    wrapper.style.cssText = 'position:relative;';
    this.input.parentNode.insertBefore(wrapper, this.input);
    wrapper.appendChild(this.input);

    this.input.setAttribute('autocomplete', 'off');
    this.input.setAttribute('spellcheck', 'false');

    // Badge showing company name inside the input
    this.badge = document.createElement('div');
    this.badge.style.cssText = `
      display:none; position:absolute; right:36px; top:50%;
      transform:translateY(-50%); font-size:11px; color:var(--muted);
      pointer-events:none; white-space:nowrap; max-width:180px;
      overflow:hidden; text-overflow:ellipsis; font-family:var(--font-mono);
    `;
    wrapper.appendChild(this.badge);

    // Spinning loader icon
    this.spinner = document.createElement('div');
    this.spinner.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/></svg>`;
    this.spinner.style.cssText = `
      display:none; position:absolute; right:12px; top:50%;
      transform:translateY(-50%); color:var(--accent);
      animation:tsSpin 0.8s linear infinite;
    `;
    wrapper.appendChild(this.spinner);

    if (!document.getElementById('ts-spin-kf')) {
      const s = document.createElement('style');
      s.id = 'ts-spin-kf';
      s.textContent = '@keyframes tsSpin{to{transform:translateY(-50%) rotate(360deg)}}';
      document.head.appendChild(s);
    }

    // Dropdown container
    this.dropdown = document.createElement('div');
    this.dropdown.style.cssText = `
      display:none; position:absolute; top:calc(100% + 6px);
      left:0; right:0; background:#111418; border:1px solid #1e2530;
      border-radius:12px; max-height:280px; overflow-y:auto; z-index:9999;
      box-shadow:0 16px 40px rgba(0,0,0,0.6); padding:6px;
    `;
    wrapper.appendChild(this.dropdown);
  }

  _bind() {
    this.input.addEventListener('input', () => {
      this.badge.style.display = 'none';
      this.input.style.paddingRight = '';
      this._debounce(() => this._onInput(), 220);
    });

    this.input.addEventListener('focus', () => {
      const q = this.input.value.trim().toUpperCase();
      if (this.cache[q]) {
        this._render(this.cache[q], q);
        this._show();
      } else {
        this._onInput();
      }
    });

    this.input.addEventListener('keydown', (e) => this._onKeydown(e));

    document.addEventListener('click', (e) => {
      if (!this.input.closest('.ts-wrapper')?.contains(e.target)) this._hide();
    });
  }

  async _fetchTickers(query) {
    if (this.cache[query] !== undefined) return this.cache[query];

    this.loading = true;
    this.spinner.style.display = 'block';

    try {
      const url = query
        ? `${this.edgeFnUrl}?q=${encodeURIComponent(query)}`
        : this.edgeFnUrl;

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
      });
      const json = await res.json();
      const tickers = json.tickers ?? [];
      this.cache[query] = tickers;
      return tickers;

    } catch (err) {
      console.warn('TickerSelect: edge fn unavailable, falling back to static data');
      // Graceful fallback to idx-tickers.js if edge fn is not yet deployed
      if (typeof IDX_TICKERS !== 'undefined') {
        const q = query.toUpperCase();
        const results = q
          ? IDX_TICKERS.filter(t => t.ticker.startsWith(q) || t.name.toUpperCase().includes(q)).slice(0, 30)
          : IDX_TICKERS.slice(0, 50);
        this.cache[query] = results;
        return results;
      }
      return [];
    } finally {
      this.loading = false;
      this.spinner.style.display = 'none';
    }
  }

  async _onInput() {
    const q = this.input.value.trim().toUpperCase();
    this._showLoading();
    this._show();
    const results = await this._fetchTickers(q);
    this._render(results, q);
  }

  _showLoading() {
    this.dropdown.innerHTML = `
      <div style="padding:20px;text-align:center;color:var(--muted);font-size:12px;
                  display:flex;align-items:center;justify-content:center;gap:8px;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2" style="animation:tsSpin 0.8s linear infinite;">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/>
        </svg>
        Mencari ticker...
      </div>`;
  }

  _render(results, q = '') {
    this._currentResults = results;
    this.highlightedIndex = -1;

    // "Use manually" option — always shown at the bottom if user typed something
    const manualOption = q ? `
      <div class="ts-manual" style="
        display:flex;align-items:center;gap:10px;padding:9px 12px;
        border-radius:8px;cursor:pointer;transition:background 0.1s;
        border-top:1px solid var(--border);margin-top:4px;">
        <div style="
          width:28px;height:28px;border-radius:6px;flex-shrink:0;
          background:rgba(255,255,255,0.05);border:1px dashed var(--border);
          display:flex;align-items:center;justify-content:center;
          font-size:14px;color:var(--muted);">+</div>
        <div>
          <div style="font-size:12px;color:var(--text);">
            Pakai "<strong style="font-family:var(--font-display);color:var(--accent)">${q}</strong>" sebagai ticker manual
          </div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px;">
            Isi nama perusahaan secara manual
          </div>
        </div>
      </div>` : '';

    if (!results.length) {
      this.dropdown.innerHTML = `
        <div style="padding:16px 12px 8px;text-align:center;color:var(--muted);font-size:12px;">
          Ticker "<strong style="color:var(--text)">${q}</strong>" tidak ditemukan di database
        </div>
        ${manualOption}`;
      this._bindManualOption(q);
      return;
    }

    this.dropdown.innerHTML = results.map((item, i) => {
      const price = item.last_price
        ? `<span style="color:var(--accent);font-size:11px;font-family:var(--font-mono);">
             Rp ${Number(item.last_price).toLocaleString('id-ID')}
           </span>`
        : '';
      return `
        <div class="ts-item" data-i="${i}" style="
          display:flex;align-items:center;gap:12px;padding:9px 12px;
          border-radius:8px;cursor:pointer;transition:background 0.1s;">
          <div style="font-family:var(--font-display);font-weight:700;font-size:14px;
                      min-width:54px;color:var(--text);">
            ${this._hl(item.ticker, q)}
          </div>
          <div style="flex:1;overflow:hidden;min-width:0;">
            <div style="font-size:12px;color:var(--muted);white-space:nowrap;
                        overflow:hidden;text-overflow:ellipsis;">
              ${this._hl(item.name, q)}
            </div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex-shrink:0;">
            ${price}
            <span style="font-size:10px;padding:2px 8px;border-radius:100px;
                         background:rgba(255,255,255,0.05);color:var(--muted);white-space:nowrap;">
              ${item.sector ?? ''}
            </span>
          </div>
        </div>`;
    }).join('') + manualOption;

    this.dropdown.querySelectorAll('.ts-item').forEach((el, i) => {
      el.addEventListener('mouseenter', () => el.style.background = 'rgba(0,229,160,0.07)');
      el.addEventListener('mouseleave', () => {
        el.style.background = i === this.highlightedIndex ? 'rgba(0,229,160,0.12)' : 'transparent';
      });
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this._select(results[i]);
      });
    });

    this._bindManualOption(q);
  }

  // Bind the "use as manual ticker" option
  _bindManualOption(q) {
    const el = this.dropdown.querySelector('.ts-manual');
    if (!el || !q) return;
    el.addEventListener('mouseenter', () => el.style.background = 'rgba(255,255,255,0.04)');
    el.addEventListener('mouseleave', () => el.style.background = 'transparent');
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this._selectManual(q);
    });
  }

  // Called when user picks "use manually" — unlock the name field for editing
  _selectManual(ticker) {
    this.selected = { ticker: ticker.toUpperCase(), name: '', sector: '', manual: true };
    this.input.value = ticker.toUpperCase();

    // Make name field editable and focus it
    if (this.nameFieldId) {
      const nameEl = document.getElementById(this.nameFieldId);
      if (nameEl) {
        nameEl.value = '';
        nameEl.readOnly = false;
        nameEl.style.background = '';
        nameEl.style.color = 'var(--text)';
        nameEl.style.cursor = 'text';
        nameEl.placeholder = 'Ketik nama perusahaan...';
        nameEl.style.borderColor = 'var(--accent)';
        // Focus name field so user can type right away
        setTimeout(() => nameEl.focus(), 50);
      }
    }

    // Clear sector field so user can pick manually
    if (this.sectorFieldId) {
      const sectorEl = document.getElementById(this.sectorFieldId);
      if (sectorEl) sectorEl.value = '';
    }

    // Hide badge (no company name yet)
    this.badge.style.display = 'none';
    this.input.style.paddingRight = '';

    this._hide();
    if (this.onChange) this.onChange(this.selected);
  }

  _hl(text, q) {
    if (!q || !text) return text ?? '';
    const i = text.toUpperCase().indexOf(q);
    if (i === -1) return text;
    return text.slice(0, i)
      + `<span style="color:var(--accent);font-weight:600">${text.slice(i, i + q.length)}</span>`
      + text.slice(i + q.length);
  }

  _select(item) {
    this.selected = item;
    this.input.value = item.ticker;

    if (this.nameFieldId) {
      const el = document.getElementById(this.nameFieldId);
      if (el) el.value = item.name;
    }
    if (this.sectorFieldId) {
      const el = document.getElementById(this.sectorFieldId);
      if (el) el.value = item.sector ?? '';
    }

    this.badge.textContent = item.name;
    this.badge.style.display = 'block';
    this.input.style.paddingRight = '210px';

    this._hide();
    if (this.onChange) this.onChange(item);
  }

  _onKeydown(e) {
    const items = this.dropdown.querySelectorAll('.ts-item');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.highlightedIndex = Math.min(this.highlightedIndex + 1, items.length - 1);
      this._applyHL(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.highlightedIndex = Math.max(this.highlightedIndex - 1, 0);
      this._applyHL(items);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (this.highlightedIndex >= 0 && this._currentResults[this.highlightedIndex]) {
        this._select(this._currentResults[this.highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      this._hide();
    }
  }

  _applyHL(items) {
    items.forEach((el, i) => {
      el.style.background = i === this.highlightedIndex ? 'rgba(0,229,160,0.12)' : 'transparent';
    });
    items[this.highlightedIndex]?.scrollIntoView({ block: 'nearest' });
  }

  _show() { this.dropdown.style.display = 'block'; this.dropdownVisible = true; }
  _hide() { this.dropdown.style.display = 'none'; this.dropdownVisible = false; }
  _debounce(fn, ms) { clearTimeout(this.debounceTimer); this.debounceTimer = setTimeout(fn, ms); }

  clear() {
    this.selected = null;
    this.input.value = '';
    this.badge.style.display = 'none';
    this.input.style.paddingRight = '';
    this._hide();
    // Reset name field back to readonly/autofill style
    this._resetNameField();
  }

  _resetNameField() {
    if (this.nameFieldId) {
      const el = document.getElementById(this.nameFieldId);
      if (el) {
        el.value = '';
        el.readOnly = true;
        el.style.background = 'rgba(0,229,160,0.03)';
        el.style.color = 'var(--muted)';
        el.style.cursor = 'default';
        el.style.borderColor = '';
        el.placeholder = 'Otomatis terisi saat pilih ticker';
      }
    }
  }

  setValue(ticker) {
    // Search cache first
    const allCached = Object.values(this.cache).flat();
    const found = allCached.find(t => t.ticker === ticker);
    if (found) { this._select(found); return; }

    // Set raw value then try to fetch match
    this.input.value = ticker;
    this._fetchTickers(ticker).then(results => {
      const match = results.find(t => t.ticker === ticker);
      if (match) this._select(match);
    });
  }
}