  // ==UserScript==
  // @name         StinkySocks NCH Location Multi-Filter (All Pages)
  // @namespace    http://tampermonkey.net/
  // @version      1.2.0
  // @description  Fetch all pages at 100 listings, merge, multi-select locations with Select All, filter, and hide pagination.
  // @match        https://secure.stinkysocks.net/nch*
  // @match        https://secure.stinkysocks.net/NCH*
  // @run-at       document-idle
  // @grant        none
  // ==/UserScript==

  (() => {
    const CONFIG = {
      pageSizeValue: '100',
      pageSizeSelect: 'select[name="listingsperpage"]',
      locationSelect: 'select[name="location"]',
      mobileFiltersToggle: '#mobile-filters a',
      listingContainer: '#nch-list',
      listingItem: '.product.product-accordion',
      listingLocationLink: 'a[href*="www.stinkysocks.net/locations/"]',
      storageKey: 'nch-multi-location-selected',
      pageSizeStateKey: 'nch-perpage-set',
      fetchBase:
        'https://secure.stinkysocks.net/nch/index-{PAGE}.html?location=&skillsonly=&hotlist=&level=&tod=&listingsperpage=100'
    };

    const waitFor = (fn, timeout = 10000, interval = 200) =>
      new Promise((resolve, reject) => {
        const start = Date.now();
        const tick = () => {
          const res = fn();
          if (res) return resolve(res);
          if (Date.now() - start > timeout) return reject(new Error('timeout'));
          setTimeout(tick, interval);
        };
        tick();
      });

    const clickMobileFilters = () => {
      const btn = document.querySelector(CONFIG.mobileFiltersToggle);
      if (btn) btn.click();
    };

    const collapseFilters = () => {
      const btn = document.querySelector('[data-toggle="collapse"]');
      if (btn) btn.click();
      if (btn) btn.click();
    };

    const ensurePageSize = (select) => {
      if (!select) return true;
      const paramVal = new URLSearchParams(location.search).get('listingsperpage');
      const is100 = paramVal === CONFIG.pageSizeValue || select.value === CONFIG.pageSizeValue;
      if (is100) {
        select.value = CONFIG.pageSizeValue;
        localStorage.setItem(CONFIG.pageSizeStateKey, 'true');
        return true;
      }
      select.value = CONFIG.pageSizeValue;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      localStorage.setItem(CONFIG.pageSizeStateKey, 'true');
      return false;
    };

    const readSavedLocations = () => {
      try {
        const raw = localStorage.getItem(CONFIG.storageKey);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    };

    const saveLocations = (vals) => {
      try {
        localStorage.setItem(CONFIG.storageKey, JSON.stringify(vals));
      } catch {
        /* ignore */
      }
    };

    const getLocationText = (item) => {
      const link = item.querySelector(CONFIG.listingLocationLink);
      if (link && link.textContent) return link.textContent.trim();
      return item.textContent?.trim() || '';
    };

    const filterListings = (selectedVals) => {
      const container = document.querySelector(CONFIG.listingContainer);
      if (!container) return;
      const selSet = new Set(selectedVals || readSavedLocations());
      const items = container.querySelectorAll(CONFIG.listingItem);
      items.forEach((item) => {
        const loc = getLocationText(item);
        const match =
          selSet.size === 0 ||
          Array.from(selSet).some((val) => val && loc.toLowerCase().includes(val.toLowerCase()));
        item.style.display = match ? '' : 'none';
      });
    };

    const buildMultiSelect = (select) => {
      const saved = new Set(readSavedLocations());
      const opts = Array.from(select.options).map((o) => ({
        label: o.textContent.trim(),
        value: o.value
      }));

      // Remove placeholder and replace with Select all
      const filteredOpts = opts.filter((o, idx) => idx !== 0 && o.value !== '');
      const allSelectedByDefault = saved.size === 0;
      const selectedSet = allSelectedByDefault ? new Set(filteredOpts.map((o) => o.value)) : saved;

      const wrapper = document.createElement('div');
      wrapper.style.padding = '4px 0';
      wrapper.style.display = 'flex';
      wrapper.style.flexWrap = 'wrap';
      wrapper.style.gap = '4px';

      const makeChip = (label, value, checked, onChange) => {
        const id = `nch-multi-${value || 'all'}`;
        const chip = document.createElement('label');
        chip.setAttribute('for', id);
        chip.style.display = 'inline-flex';
        chip.style.alignItems = 'center';
        chip.style.gap = '4px';
        chip.style.padding = '2px 6px';
        chip.style.border = '1px solid #ccc';
        chip.style.borderRadius = '6px';
        chip.style.background = checked ? '#eef5ff' : '#fff';
        chip.style.fontSize = '13px';
        chip.style.userSelect = 'none';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.id = id;
        cb.value = value;
        cb.checked = checked;
        cb.addEventListener('change', () => onChange(cb, chip));

        const span = document.createElement('span');
        span.textContent = label;
        chip.append(cb, span);
        return chip;
      };

      // Select all chip
      const allChip = makeChip(
        'Select all',
        '__ALL__',
        allSelectedByDefault || selectedSet.size === filteredOpts.length,
        (cb, chip) => {
          const check = cb.checked;
          chip.style.background = check ? '#eef5ff' : '#fff';
          const checkboxes = wrapper.querySelectorAll('input[type="checkbox"]');
          checkboxes.forEach((box) => {
            if (box.value === '__ALL__') return;
            box.checked = check;
            box.closest('label').style.background = check ? '#eef5ff' : '#fff';
          });
          const selected = check ? filteredOpts.map((o) => o.value) : [];
          saveLocations(selected);
          filterListings(selected);
        }
      );
      wrapper.appendChild(allChip);

      // Location chips
      filteredOpts.forEach(({ label, value }) => {
        const chip = makeChip(label, value, selectedSet.has(value), (cb, chipEl) => {
          chipEl.style.background = cb.checked ? '#eef5ff' : '#fff';
          const selected = Array.from(
            wrapper.querySelectorAll('input[type="checkbox"]:checked')
          )
            .map((x) => x.value)
            .filter((v) => v !== '__ALL__');
          // update Select all checkbox
          const allBox = wrapper.querySelector('input[value="__ALL__"]');
          if (allBox) {
            const allChecked = selected.length === filteredOpts.length;
            allBox.checked = allChecked;
            allBox.closest('label').style.background = allChecked ? '#eef5ff' : '#fff';
          }
          saveLocations(selected);
          filterListings(selected);
        });
        wrapper.appendChild(chip);
      });

      select.style.display = 'none';
      select.insertAdjacentElement('afterend', wrapper);

      // Initial selection state
      const initialSelected = selectedSet.size ? Array.from(selectedSet) : [];
      const allBox = wrapper.querySelector('input[value="__ALL__"]');
      if (allBox) {
        const allChecked = initialSelected.length === filteredOpts.length;
        allBox.checked = allChecked;
        allBox.closest('label').style.background = allChecked ? '#eef5ff' : '#fff';
      }
      filterListings(initialSelected);
    };

    const hidePagination = () => {
      document.querySelectorAll('.pagination').forEach((el) => {
        el.style.display = 'none';
      });
    };

    const fetchAllPages = async () => {
      if (window.__NCH_FETCHING_ALL__) return;
      window.__NCH_FETCHING_ALL__ = true;

      const pageLinks = Array.from(document.querySelectorAll('.page-numbers a'));
      const pageNums = Array.from(
        new Set(
          pageLinks
            .map((a) => parseInt(a.textContent.trim(), 10))
            .filter((n) => Number.isFinite(n) && n > 0)
        )
      ).sort((a, b) => a - b);

      if (pageNums.length === 0) {
        hidePagination();
        filterListings();
        return;
      }

      const combinedNodes = [];
      const parser = new DOMParser();

      for (const num of pageNums) {
        const url = CONFIG.fetchBase.replace('{PAGE}', num);
        try {
          const res = await fetch(url, { credentials: 'include' });
          const text = await res.text();
          const doc = parser.parseFromString(text, 'text/html');
          const list = doc.querySelector(CONFIG.listingContainer);
          if (list) {
            combinedNodes.push(...Array.from(list.children).map((n) => n.cloneNode(true)));
          }
        } catch (e) {
          console.error('NCH fetch error for page', num, e);
        }
      }

      if (combinedNodes.length === 0) {
        hidePagination();
        filterListings();
        return;
      }

      const mainList = document.querySelector(CONFIG.listingContainer);
      if (!mainList) return;
      mainList.innerHTML = '';
      combinedNodes.forEach((n) => mainList.appendChild(n));

      hidePagination();
      filterListings();
    };

    const observeListings = () => {
      const container = document.querySelector(CONFIG.listingContainer);
      if (!container) return;
      const observer = new MutationObserver(() => filterListings());
      observer.observe(container, { childList: true, subtree: true });
    };

    const init = async () => {
      try {
        clickMobileFilters();

        const pageSizeSelect = await waitFor(() => document.querySelector(CONFIG.pageSizeSelect));
        const isReady = ensurePageSize(pageSizeSelect);
        if (!isReady) return; // change triggered; let the reload happen

        const locationSelect = await waitFor(() => document.querySelector(CONFIG.locationSelect));
        if (locationSelect) buildMultiSelect(locationSelect);

        await fetchAllPages();
        observeListings();
        collapseFilters();
      } catch (err) {
        console.error('NCH multi-filter error', err);
      }
    };

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      init();
    } else {
      document.addEventListener('DOMContentLoaded', init, { once: true });
    }
  })();
