/**
 * Geo2KMZ Studio - Main Application Controller
 */
(function () {
  'use strict';

  // =========================================================================
  // Feature Flag: Interactive Leaflet Map Preview
  // Set to `true` to re-enable the interactive Leaflet map preview at any time.
  // Set to `false` to display the static map placeholder image.
  // =========================================================================
  const ENABLE_INTERACTIVE_MAP = false;

  // Application State
  const state = {
    converter: new GeoConverter(),
    dictionary: new DataDictionary(),
    dictionaryLoaded: false,
    dictionaryType: null,
    geoLoaded: false,
    activeTab: 'map',
    interactiveMapEnabled: ENABLE_INTERACTIVE_MAP,
    map: null,
    mapLayerGroup: null,
    currentRows: [],
    filteredRows: [],
    tableHeaders: [],
    currentPage: 1,
    pageSize: 50,
    replacedFieldsSet: new Set(),
    exportBaseName: 'geospatial_export',
    selectedLineColor: '#3F4344'
  };

  // DOM Elements Cache
  const el = {
    // Theme
    themeToggleBtn: document.getElementById('theme-toggle-btn'),
    themeIcon: document.getElementById('theme-icon'),
    themeText: document.getElementById('theme-text'),

    // Demo & Quick Actions
    loadDemoBtn: document.getElementById('load-demo-btn'),
    geoDemoBadge: document.getElementById('geo-demo-badge'),
    downloadDictCsvBtn: document.getElementById('download-dict-csv-btn'),
    footerDictLink: document.getElementById('footer-dict-link'),
    applyIrapPresetBtn: document.getElementById('apply-irap-preset-btn'),
    dictBuiltinBadge: document.getElementById('dict-builtin-badge'),

    // Step 1: Geo
    geoDropzone: document.getElementById('geo-dropzone'),
    geoFileInput: document.getElementById('geo-file-input'),
    geoLoadedBanner: document.getElementById('geo-loaded-banner'),
    geoFileName: document.getElementById('geo-file-name'),
    geoFileTypeBadge: document.getElementById('geo-file-type-badge'),
    geoRemoveBtn: document.getElementById('geo-remove-btn'),
    csvGeoSettings: document.getElementById('csv-geo-settings'),
    selectLat: document.getElementById('select-lat'),
    selectLon: document.getElementById('select-lon'),
    selectEndLat: document.getElementById('select-end-lat'),
    selectEndLon: document.getElementById('select-end-lon'),
    wrapEndLat: document.getElementById('wrap-end-lat'),
    wrapEndLon: document.getElementById('wrap-end-lon'),
    modeRadios: document.querySelectorAll('input[name="csv-geom-mode"]'),
    geoStats: document.getElementById('geo-stats'),
    statFeatures: document.getElementById('stat-features'),
    statGeomType: document.getElementById('stat-geom-type'),
    statProperties: document.getElementById('stat-properties'),

    // Step 2: Dict
    dictDropzone: document.getElementById('dict-dropzone'),
    dictFileInput: document.getElementById('dict-file-input'),
    dictLoadedBanner: document.getElementById('dict-loaded-banner'),
    dictFileName: document.getElementById('dict-file-name'),
    dictRemoveBtn: document.getElementById('dict-remove-btn'),
    dictColSettings: document.getElementById('dict-col-settings'),
    selectDictField: document.getElementById('select-dict-field'),
    selectDictCode: document.getElementById('select-dict-code'),
    selectDictDesc: document.getElementById('select-dict-desc'),
    dictStatsSummary: document.getElementById('dict-stats-summary'),
    dictStatsText: document.getElementById('dict-stats-text'),

    // Step 3: KMZ Styling
    starThemeRadios: document.querySelectorAll('input[name="star-theme"]'),
    rowLineColor: document.getElementById('row-line-color'),
    colorSwatches: document.querySelectorAll('.color-swatch'),
    inputCustomLineColor: document.getElementById('input-custom-line-color'),
    sliderLineWidth: document.getElementById('slider-line-width'),
    labelLineWidth: document.getElementById('label-line-width'),

    // Export Section
    exportHeadline: document.getElementById('export-headline'),
    exportDetails: document.getElementById('export-details'),
    btnDownloadKmz: document.getElementById('btn-download-kmz'),
    btnDownloadKml: document.getElementById('btn-download-kml'),
    btnDownloadGeoJson: document.getElementById('btn-download-geojson'),
    btnOpenGoogleEarth: document.getElementById('btn-open-google-earth'),

    // Tabs & Map Preview
    tabButtons: document.querySelectorAll('.tab-btn'),
    tabContents: document.querySelectorAll('.tab-content'),
    mapImageWrapper: document.getElementById('map-image-wrapper'),
    mapPlaceholderImg: document.getElementById('map-placeholder-img'),
    mapPlaceholder: document.getElementById('map-placeholder'),
    mapContainer: document.getElementById('map-container'),
    mapLegend: document.getElementById('map-legend'),

    // Table
    tableSearch: document.getElementById('table-search'),
    tableHeadRow: document.getElementById('table-head-row'),
    tableBody: document.getElementById('table-body'),
    prevPageBtn: document.getElementById('prev-page-btn'),
    nextPageBtn: document.getElementById('next-page-btn'),
    pageIndicator: document.getElementById('page-indicator'),

    // Diff
    diffSummaryContainer: document.getElementById('diff-summary-container'),
    toastContainer: document.getElementById('toast-container')
  };

  /**
   * Display Toast Notification
   */
  function showToast(message, type = 'info', duration = 3500) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '⚠️';

    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    el.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  /**
   * Theme Switcher
   */
  function initTheme() {
    const savedTheme = localStorage.getItem('geo2kmz_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeButton(savedTheme);

    el.themeToggleBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('geo2kmz_theme', next);
      updateThemeButton(next);
      if (state.map) {
        updateMapTileLayer(next);
      }
    });
  }

  function updateThemeButton(theme) {
    if (theme === 'dark') {
      el.themeIcon.textContent = '🌙';
      el.themeText.textContent = 'Dark';
    } else {
      el.themeIcon.textContent = '☀️';
      el.themeText.textContent = 'Light';
    }
  }

  /**
   * Leaflet Map Initialization
   */
  let currentTileLayer = null;

  function initMap() {
    if (!state.interactiveMapEnabled) {
      if (el.mapImageWrapper) el.mapImageWrapper.style.display = 'block';
      if (el.mapPlaceholder) el.mapPlaceholder.style.display = 'none';
      if (el.mapLegend) el.mapLegend.style.display = 'none';
      return;
    }

    if (el.mapImageWrapper) el.mapImageWrapper.style.display = 'none';
    if (el.mapLegend) el.mapLegend.style.display = 'flex';
    if (state.map || typeof L === 'undefined') return;

    // Remove placeholder
    if (el.mapPlaceholder) {
      el.mapPlaceholder.style.display = 'none';
    }

    state.map = L.map('map-container', {
      zoomControl: true,
      attributionControl: true
    }).setView([34.896, -80.893], 13);

    updateMapTileLayer(document.documentElement.getAttribute('data-theme') || 'dark');
    state.mapLayerGroup = L.layerGroup().addTo(state.map);
  }

  /**
   * Helper function to programmatically toggle between placeholder image and interactive Leaflet map
   */
  function setInteractiveMapEnabled(enabled) {
    state.interactiveMapEnabled = Boolean(enabled);
    if (state.interactiveMapEnabled) {
      if (el.mapImageWrapper) el.mapImageWrapper.style.display = 'none';
      if (el.mapLegend) el.mapLegend.style.display = 'flex';
      initMap();
      renderMapFeatures();
      if (state.map) setTimeout(() => state.map.invalidateSize(), 150);
    } else {
      if (el.mapImageWrapper) el.mapImageWrapper.style.display = 'block';
      if (el.mapPlaceholder) el.mapPlaceholder.style.display = 'none';
      if (el.mapLegend) el.mapLegend.style.display = 'none';
    }
  }

  if (typeof window !== 'undefined') {
    window.setInteractiveMapEnabled = setInteractiveMapEnabled;
  }

  function getCartoApiKey() {
    if (typeof window !== 'undefined') {
      if (window.APP_CONFIG && window.APP_CONFIG.cartoApiKey) {
        return String(window.APP_CONFIG.cartoApiKey).trim();
      }
      try {
        const storedKey = localStorage.getItem('carto_api_key');
        if (storedKey) return storedKey.trim();
      } catch (e) {
        // localStorage unavailable
      }
    }
    return '';
  }

  function updateMapTileLayer(theme) {
    if (!state.map) return;
    if (currentTileLayer) state.map.removeLayer(currentTileLayer);

    const apiKey = getCartoApiKey();

    if (apiKey) {
      // Use CARTO Positron (light grayscale basemap)
      const tileUrl = `https://basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png?key=${encodeURIComponent(apiKey)}`;
      const attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

      currentTileLayer = L.tileLayer(tileUrl, {
        maxZoom: 19,
        className: 'map-tiles-grayscale',
        attribution: attribution
      }).addTo(state.map);

      let hasFallback = false;
      currentTileLayer.on('tileerror', function() {
        if (hasFallback) return;
        hasFallback = true;
        console.warn('CARTO basemap tile request failed; falling back to OpenStreetMap.');
        if (state.map && currentTileLayer) {
          state.map.removeLayer(currentTileLayer);
          currentTileLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            className: 'map-tiles-grayscale',
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          }).addTo(state.map);
        }
      });
    } else {
      // Without an API key, load OpenStreetMap with light grayscale filter
      currentTileLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        className: 'map-tiles-grayscale',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(state.map);
    }
  }

  /**
   * Render Features on Leaflet Map
   */
  function renderMapFeatures() {
    if (!state.interactiveMapEnabled) return;
    if (!state.converter.featureCollection || typeof L === 'undefined') return;
    initMap();

    state.mapLayerGroup.clearLayers();
    const fc = state.converter.featureCollection;
    if (!fc.features || fc.features.length === 0) return;

    const starTheme = getSelectedRadioValue('star-theme') || 'vehicle';
    const singleColor = state.selectedLineColor || '#3F4344';
    const lineWidth = parseInt(el.sliderLineWidth.value, 10) || 4;

    const getFeatureColor = (feature) => GeoConverter.getStarRatingColor(feature, starTheme, singleColor);


    const titleField = state.converter.detectTitleField();

    const geoJsonLayer = L.geoJSON(fc, {
      style: (feature) => {
        const col = getFeatureColor(feature);
        return {
          color: col,
          weight: lineWidth,
          opacity: 0.9,
          fillColor: col,
          fillOpacity: 0.4
        };
      },
      pointToLayer: (feature, latlng) => {
        const col = getFeatureColor(feature);
        return L.circleMarker(latlng, {
          radius: 6,
          fillColor: col,
          color: '#ffffff',
          weight: 1.5,
          opacity: 1,
          fillOpacity: 0.85
        });
      },
      onEachFeature: (feature, layer) => {
        const props = feature.properties || {};
        const title = (titleField && props[titleField]) ? props[titleField] : 'Feature Details';

        let rowsHtml = '';
        for (const [k, v] of Object.entries(props)) {
          if (v === null || v === undefined || v === '') continue;
          const isReplaced = state.replacedFieldsSet.has(k);
          rowsHtml += `
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 4px 6px; font-weight: 600; color: #475569; width: 45%;">${GeoConverter.escapeXml(k)}</td>
              <td style="padding: 4px 6px; ${isReplaced ? 'color: #0891b2; font-weight: 600;' : ''}">${GeoConverter.escapeXml(v)}</td>
            </tr>`;
        }

        const popupContent = `
          <div style="font-family: inherit; font-size: 12px; max-height: 280px; overflow-y: auto; max-width: 320px;">
            <div style="font-weight: 700; font-size: 13px; color: #0f172a; margin-bottom: 6px; border-bottom: 2px solid #3b82f6; padding-bottom: 4px;">
              ${GeoConverter.escapeXml(title)}
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
              <tbody>${rowsHtml}</tbody>
            </table>
          </div>`;

        layer.bindPopup(popupContent, { maxWidth: 350 });
      }
    });

    state.mapLayerGroup.addLayer(geoJsonLayer);

    const bounds = geoJsonLayer.getBounds();
    if (bounds.isValid()) {
      state.map.fitBounds(bounds, { padding: [25, 25], maxZoom: 16 });
    }

    // Toggle legend visibility based on star theme
    el.mapLegend.style.display = starTheme !== 'none' ? 'flex' : 'none';
  }

  /**
   * Populate Data Table
   */
  function populateTable() {
    if (!state.converter.featureCollection) return;
    const features = state.converter.featureCollection.features || [];

    if (features.length === 0) {
      el.tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--text-muted);">No records found.</td></tr>`;
      return;
    }

    // Extract headers from first feature properties
    state.tableHeaders = Object.keys(features[0].properties || {});
    state.currentRows = features.map((f, i) => ({ id: i + 1, props: f.properties || {} }));
    state.filteredRows = state.currentRows;
    state.currentPage = 1;

    // Render Headers
    let headerHtml = '<th>#</th>';
    for (const h of state.tableHeaders) {
      const isReplaced = state.replacedFieldsSet.has(h);
      headerHtml += `<th title="${GeoConverter.escapeXml(h)}">${GeoConverter.escapeXml(h)} ${isReplaced ? '✨' : ''}</th>`;
    }
    el.tableHeadRow.innerHTML = headerHtml;

    renderTablePage();
  }

  function renderTablePage() {
    const total = state.filteredRows.length;
    const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
    state.currentPage = Math.min(Math.max(1, state.currentPage), totalPages);

    const start = (state.currentPage - 1) * state.pageSize;
    const end = Math.min(start + state.pageSize, total);
    const pageRows = state.filteredRows.slice(start, end);

    let bodyHtml = '';
    for (const item of pageRows) {
      bodyHtml += `<tr><td><strong>${item.id}</strong></td>`;
      for (const h of state.tableHeaders) {
        const val = item.props[h] !== undefined ? item.props[h] : '';
        const isReplaced = state.replacedFieldsSet.has(h);
        bodyHtml += `<td class="${isReplaced ? 'highlight-replaced' : ''}" title="${GeoConverter.escapeXml(val)}">${GeoConverter.escapeXml(val)}</td>`;
      }
      bodyHtml += '</tr>';
    }

    el.tableBody.innerHTML = bodyHtml || `<tr><td colspan="${state.tableHeaders.length + 1}" style="text-align:center; padding:1.5rem;">No matching results</td></tr>`;

    // Pagination Controls
    el.pageIndicator.textContent = `Page ${state.currentPage} of ${totalPages} (${total} total)`;
    el.prevPageBtn.disabled = state.currentPage <= 1;
    el.nextPageBtn.disabled = state.currentPage >= totalPages;
  }

  /**
   * Populate Dictionary Diff View
   */
  function populateDiffView() {
    if (!state.dictionaryLoaded || state.dictionary.fieldCodeMap.size === 0) {
      el.diffSummaryContainer.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: var(--text-muted);">
          No data dictionary applied yet. Upload a dictionary CSV or click "Use Built-in iRAP Dictionary" to preview code mappings.
        </div>`;
      return;
    }

    let diffHtml = '';
    let cardsCount = 0;

    for (const [normField, codeMap] of state.dictionary.fieldCodeMap.entries()) {
      const originalFieldName = state.dictionary.fieldOriginalNames.get(normField) || normField;
      const isFieldPresentInData = state.replacedFieldsSet.has(originalFieldName) ||
        Array.from(state.replacedFieldsSet).some(f => DataDictionary.normalizeFieldName(f) === normField);

      let itemsHtml = '';
      let count = 0;
      for (const [code, desc] of codeMap.entries()) {
        if (count >= 10) {
          itemsHtml += `<div style="font-size:0.7rem; color:var(--text-subtle); text-align:center;">+ ${codeMap.size - 10} more codes...</div>`;
          break;
        }
        itemsHtml += `
          <div class="diff-item">
            <span class="diff-from">${code}</span>
            <span class="diff-to">→ ${GeoConverter.escapeXml(desc)}</span>
          </div>`;
        count++;
      }

      diffHtml += `
        <div class="diff-card" style="${isFieldPresentInData ? 'border-color: rgba(6, 182, 212, 0.4);' : ''}">
          <h4>
            ${GeoConverter.escapeXml(originalFieldName)}
            ${isFieldPresentInData ? '<span class="file-badge" style="font-size:0.65rem; background:var(--accent);">Applied</span>' : ''}
          </h4>
          <div class="diff-list">${itemsHtml}</div>
        </div>`;
      cardsCount++;
    }

    el.diffSummaryContainer.innerHTML = diffHtml || '<p>No mappings found.</p>';
  }

  /**
   * Update Coordinate Selectors for CSV
   */
  function setupCsvCoordinateSelectors(detected) {
    if (!state.converter.csvHeaders) return;
    const headers = state.converter.csvHeaders;

    const populateSelect = (selectEl, selectedVal, allowEmpty = false) => {
      let html = allowEmpty ? '<option value="">(None)</option>' : '';
      for (const h of headers) {
        const isSel = h === selectedVal ? 'selected' : '';
        html += `<option value="${GeoConverter.escapeXml(h)}" ${isSel}>${GeoConverter.escapeXml(h)}</option>`;
      }
      selectEl.innerHTML = html;
    };

    populateSelect(el.selectLat, detected.latCol);
    populateSelect(el.selectLon, detected.lonCol);
    populateSelect(el.selectEndLat, detected.endLatCol, true);
    populateSelect(el.selectEndLon, detected.endLonCol, true);

    // Show/hide End coordinate dropdowns depending on mode
    const mode = getSelectedRadioValue('csv-geom-mode');
    updateCsvGeomModeVisibility(mode);
  }

  function updateCsvGeomModeVisibility(mode) {
    const isLine = mode === 'linestring';
    const isEndPt = mode === 'point_end';
    el.wrapEndLat.style.display = isLine || isEndPt ? 'flex' : 'none';
    el.wrapEndLon.style.display = isLine || isEndPt ? 'flex' : 'none';
  }

  /**
   * Update Attribute Selectors and Star Rating Theme Availability
   */
  function updateAttributeSelectors() {
    updateStarRatingThemeAvailability();
  }

  /**
   * Update Star Rating Theme Radio Availability based on dataset properties
   */
  function updateStarRatingThemeAvailability() {
    const themeRadios = {
      vehicle: document.getElementById('theme-vehicle'),
      motorcycle: document.getElementById('theme-motorcycle'),
      bicycle: document.getElementById('theme-bicycle'),
      pedestrian: document.getElementById('theme-pedestrian'),
      none: document.getElementById('theme-none')
    };

    if (!themeRadios.vehicle || !themeRadios.none) return;

    const fc = state.converter.featureCollection;
    if (!state.geoLoaded || !fc || !fc.features || fc.features.length === 0) {
      themeRadios.vehicle.disabled = false;
      themeRadios.motorcycle.disabled = false;
      themeRadios.bicycle.disabled = false;
      themeRadios.pedestrian.disabled = false;
      themeRadios.none.disabled = false;
      themeRadios.vehicle.checked = true;
      return;
    }

    // Inspect properties of features to find available Star Rating Raw fields
    const availableThemes = GeoConverter.detectAvailableStarThemes(fc);

    const hasAnyRaw = availableThemes.vehicle || availableThemes.motorcycle || availableThemes.bicycle || availableThemes.pedestrian;

    if (!hasAnyRaw) {
      // If no "Star Rating Raw" field is available, the buttons should be disabled except for "None".
      themeRadios.vehicle.disabled = true;
      themeRadios.motorcycle.disabled = true;
      themeRadios.bicycle.disabled = true;
      themeRadios.pedestrian.disabled = true;
      themeRadios.none.disabled = false;
      themeRadios.none.checked = true;
    } else {
      themeRadios.vehicle.disabled = !availableThemes.vehicle;
      themeRadios.motorcycle.disabled = !availableThemes.motorcycle;
      themeRadios.bicycle.disabled = !availableThemes.bicycle;
      themeRadios.pedestrian.disabled = !availableThemes.pedestrian;
      themeRadios.none.disabled = false;

      // "Vehicle should be selected by default."
      if (availableThemes.vehicle) {
        themeRadios.vehicle.checked = true;
      } else {
        const currentSelected = getSelectedRadioValue('star-theme');
        if (!availableThemes[currentSelected]) {
          const firstAvailable = ['motorcycle', 'bicycle', 'pedestrian'].find(t => availableThemes[t]);
          if (firstAvailable) {
            themeRadios[firstAvailable].checked = true;
          } else {
            themeRadios.none.checked = true;
          }
        }
      }
    }
    updateLineColorVisibility();
  }

  /**
   * Update Line Color visibility based on selected star theme
   */
  function updateLineColorVisibility() {
    const starTheme = getSelectedRadioValue('star-theme') || 'vehicle';
    if (el.rowLineColor) {
      el.rowLineColor.style.display = starTheme === 'none' ? 'flex' : 'none';
    }
  }

  /**
   * Set active line color for 'none' theme
   */
  function setLineColor(colorHex) {
    state.selectedLineColor = colorHex;
    if (el.colorSwatches) {
      el.colorSwatches.forEach(swatch => {
        const isMatch = swatch.getAttribute('data-color').toLowerCase() === colorHex.toLowerCase();
        swatch.classList.toggle('active', isMatch);
        swatch.setAttribute('aria-checked', isMatch ? 'true' : 'false');
      });
    }
    if (el.inputCustomLineColor) {
      el.inputCustomLineColor.value = colorHex;
    }
    renderMapFeatures();
  }

  /**
   * Re-run Data Dictionary Application on Current Spatial Data
   */
  function reapplyDataDictionary() {
    if (!state.geoLoaded) return;

    // If CSV, reload fresh from CSV rows so dictionary changes don't overwrite previous runs
    if (state.converter.dataType === 'csv') {
      const mode = getSelectedRadioValue('csv-geom-mode');
      const customMapping = {
        latCol: el.selectLat.value,
        lonCol: el.selectLon.value,
        endLatCol: el.selectEndLat.value,
        endLonCol: el.selectEndLon.value
      };
      state.converter.convertCsvToGeoJson(mode, customMapping);
    } else if (state.converter.originalData) {
      // Reload fresh GeoJSON
      state.converter.loadGeoJSON(state.converter.originalData, state.converter.sourceName);
    }

    state.replacedFieldsSet.clear();

    if (state.dictionaryLoaded) {
      const res = state.converter.applyDictionary(state.dictionary);

      if (res && res.replacedFields) {
        for (const k of res.replacedFields) {
          state.replacedFieldsSet.add(k);
        }
      }

      const repCount = res.replacements || 0;
      const fieldCount = state.replacedFieldsSet.size || 0;

      if (el.dictStatsText) {
        el.dictStatsText.innerHTML = `<strong>${repCount.toLocaleString()}</strong> values replaced across <strong>${fieldCount.toLocaleString()}</strong> fields`;
      }
      if (el.dictStatsSummary) {
        if (repCount > 0) {
          el.dictStatsSummary.classList.add('has-replacements');
        } else {
          el.dictStatsSummary.classList.remove('has-replacements');
        }
      }

      if (state.geoLoaded && res.replacements > 0) {
        showToast(`Dictionary applied (${res.replacements.toLocaleString()} updated)`, 'success');
      }
    } else {
      if (el.dictStatsText) el.dictStatsText.innerHTML = '<strong>0</strong> values replaced across <strong>0</strong> fields (no dictionary applied)';
      if (el.dictStatsSummary) el.dictStatsSummary.classList.remove('has-replacements');
    }

    updateUI();
  }

  /**
   * Update Entire UI based on Loaded Data
   */
  function updateUI() {
    if (!state.geoLoaded) {
      el.btnDownloadKmz.disabled = true;
      el.btnDownloadKml.disabled = true;
      el.btnDownloadGeoJson.disabled = true;
      if (el.exportHeadline) el.exportHeadline.textContent = 'Ready to Generate KMZ';
      if (el.exportDetails) el.exportDetails.textContent = 'Upload geospatial data above to enable Google Earth KMZ packaging.';
      return;
    }

    const summary = state.converter.getDataSummary();
    if (!summary) return;

    // Update Stats
    el.statFeatures.textContent = summary.featureCount.toLocaleString();
    el.statGeomType.textContent = summary.geometryTypes.join(', ') || 'Mixed';
    el.statProperties.textContent = summary.propertyNames.length;
    el.geoStats.style.display = 'grid';

    // Enable Export Buttons
    el.btnDownloadKmz.disabled = false;
    el.btnDownloadKml.disabled = false;
    el.btnDownloadGeoJson.disabled = false;


    // Update Export Card if elements present
    if (el.exportHeadline) {
      let dictText = '';
      if (state.dictionaryLoaded) {
        dictText = `Data dictionary active (${state.dictionary.totalEntriesCount} rules applied).`;
      } else {
        dictText = 'No data dictionary applied (exporting original values).';
      }
      el.exportHeadline.textContent = `Ready: ${summary.featureCount} Features (${summary.geometryTypes.join(', ')})`;
      if (el.exportDetails) el.exportDetails.textContent = `${summary.propertyNames.length} attributes detected. ${dictText}`;
    }

    // Update Views
    renderMapFeatures();
    populateTable();
    populateDiffView();
  }

  /**
   * Load Geospatial File (GeoJSON or CSV)
   */
  function processGeoFile(file) {
    const reader = new FileReader();
    const fileName = file.name;
    const isCsv = fileName.toLowerCase().endsWith('.csv');
    const isJson = fileName.toLowerCase().endsWith('.geojson') || fileName.toLowerCase().endsWith('.json');

    reader.onload = function (e) {
      const content = e.target.result;
      try {
        if (isCsv) {
          const summary = state.converter.loadCSV(content, fileName);
          el.geoFileTypeBadge.textContent = 'CSV';
          el.csvGeoSettings.style.display = 'flex';

          // Set radio mode
          const modeRadio = document.querySelector(`input[name="csv-geom-mode"][value="${summary.detectedColumns.defaultMode}"]`);
          if (modeRadio) modeRadio.checked = true;

          setupCsvCoordinateSelectors(summary.detectedColumns);
        } else {
          state.converter.loadGeoJSON(content, fileName);
          el.geoFileTypeBadge.textContent = 'GEOJSON';
          el.csvGeoSettings.style.display = 'none';
        }

        state.geoLoaded = true;
        el.geoFileName.textContent = fileName;
        el.geoDropzone.style.display = 'none';
        el.geoLoadedBanner.style.display = 'flex';
        if (el.loadDemoBtn) el.loadDemoBtn.className = 'btn-builtin-inactive';
        if (el.geoDemoBadge) el.geoDemoBadge.style.display = 'none';

        // Output filename based on input
        const cleanName = fileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_') || 'geospatial_export';
        state.exportBaseName = cleanName;

        updateAttributeSelectors();
        reapplyDataDictionary();

        showToast(`Loaded ${fileName}`, 'success');
      } catch (err) {
        console.error('Geo file parse error:', err);
        showToast(`Parse failed: ${err.message}`, 'error', 5000);
      }
    };
    reader.readAsText(file);
  }

  /**
   * Load Data Dictionary CSV File
   */
  function processDictFile(file) {
    const reader = new FileReader();
    const fileName = file.name;

    reader.onload = function (e) {
      const content = e.target.result;
      try {
        const summary = state.dictionary.loadFromCSV(content, fileName);
        state.dictionaryLoaded = true;
        state.dictionaryType = 'custom';

        el.dictFileName.textContent = fileName;
        el.dictDropzone.style.display = 'none';
        el.dictLoadedBanner.style.display = 'flex';

        if (el.applyIrapPresetBtn) el.applyIrapPresetBtn.className = 'btn-builtin-inactive';
        if (el.dictBuiltinBadge) el.dictBuiltinBadge.style.display = 'none';

        // Populate column mapping selectors
        populateDictColSelectors(summary.columnMapping);

        el.statDictEntries.textContent = summary.totalEntries.toLocaleString();
        el.statDictFields.textContent = summary.distinctFields;
        el.dictStats.style.display = 'grid';

        reapplyDataDictionary();
        showToast(`Loaded ${fileName}`, 'success');
      } catch (err) {
        console.error('Dictionary parse error:', err);
        showToast(`Dictionary error: ${err.message}`, 'error', 5000);
      }
    };
    reader.readAsText(file);
  }

  /**
   * Apply Built-in iRAP Coding Dictionary
   */
  function applyBuiltinIrapDictionary(isSilent = false) {
    if (typeof window.IRAP_BUILTIN_DICTIONARY === 'undefined') {
      if (!isSilent) showToast('Dictionary not loaded', 'error');
      return;
    }

    const summary = state.dictionary.loadFromEntries(window.IRAP_BUILTIN_DICTIONARY, 'iRAP Coding Manual (Built-in)');
    state.dictionaryLoaded = true;
    state.dictionaryType = 'builtin';

    if (el.dictFileName) el.dictFileName.textContent = 'iRAP Coding Manual QuickGuide (Built-in)';
    if (el.dictDropzone) el.dictDropzone.style.display = 'block';
    if (el.dictLoadedBanner) el.dictLoadedBanner.style.display = 'none';
    if (el.dictColSettings) el.dictColSettings.style.display = 'none';

    if (el.applyIrapPresetBtn) el.applyIrapPresetBtn.className = 'btn-builtin-active';
    if (el.dictBuiltinBadge) {
      el.dictBuiltinBadge.style.display = 'inline-block';
      el.dictBuiltinBadge.textContent = 'Active';
    }

    if (el.statDictEntries) el.statDictEntries.textContent = summary.totalEntries.toLocaleString();
    if (el.statDictFields) el.statDictFields.textContent = summary.distinctFields;
    if (el.dictStats) el.dictStats.style.display = 'grid';

    reapplyDataDictionary();
    if (!isSilent) showToast('iRAP dictionary loaded', 'success');
  }

  /**
   * Handle Click on Built-in Dictionary Button (Toggle / Re-enable)
   */
  function handleBuiltinButtonClick() {
    if (state.dictionaryLoaded && state.dictionaryType === 'builtin') {
      // Toggle off dictionary
      state.dictionary = new DataDictionary();
      state.dictionaryLoaded = false;
      state.dictionaryType = null;
      if (el.applyIrapPresetBtn) el.applyIrapPresetBtn.className = 'btn-builtin-inactive';
      if (el.dictBuiltinBadge) el.dictBuiltinBadge.style.display = 'none';
      if (el.dictStatsText) el.dictStatsText.innerHTML = '<strong>0</strong> values replaced across <strong>0</strong> fields (dictionary disabled)';
      if (el.dictStatsSummary) el.dictStatsSummary.classList.remove('has-replacements');
      reapplyDataDictionary();
      showToast('Data dictionary disabled', 'info');
    } else {
      if (el.dictFileInput) el.dictFileInput.value = '';
      applyBuiltinIrapDictionary(false);
    }
  }

  /**
   * Setup Dictionary Column Selectors
   */
  function populateDictColSelectors(mapping) {
    if (!state.dictionary.rawEntries || state.dictionary.rawEntries.length === 0) return;
    const sample = state.dictionary.rawEntries[0] || {};
    const cols = Object.keys(sample);

    const makeOptions = (selVal) => cols.map(c => `<option value="${GeoConverter.escapeXml(c)}" ${c === selVal ? 'selected' : ''}>${GeoConverter.escapeXml(c)}</option>`).join('');

    el.selectDictField.innerHTML = makeOptions(mapping.fieldCol);
    el.selectDictCode.innerHTML = makeOptions(mapping.codeCol);
    el.selectDictDesc.innerHTML = makeOptions(mapping.descCol);

    el.dictColSettings.style.display = 'flex';
  }

  /**
   * Get Selected Value from Radio Group
   */
  function getSelectedRadioValue(name) {
    const radio = document.querySelector(`input[name="${name}"]:checked`);
    return radio ? radio.value : '';
  }

  /**
   * Trigger Download of Blob
   */
  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 200);
  }

  /**
   * Export Handlers
   */
  async function handleDownloadKmz() {
    if (!state.converter.featureCollection) return;

    try {
      el.btnDownloadKmz.disabled = true;
      el.btnDownloadKmz.textContent = 'Packaging KMZ...';

      const docName = state.exportBaseName || 'geospatial_export';
      const starTheme = getSelectedRadioValue('star-theme') || 'vehicle';
      const lineWidth = parseInt(el.sliderLineWidth.value, 10) || 4;
      const titleField = state.converter.detectTitleField();
      const includeExtendedData = true;

      const kml = state.converter.generateKML({
        documentName: docName,
        titleField: titleField,
        colorMode: starTheme,
        singleColor: state.selectedLineColor || '#3F4344',
        lineWidth: lineWidth,
        includeExtendedData: includeExtendedData
      });

      const kmzBlob = await state.converter.generateKMZ(kml);
      const filename = `${docName}.kmz`;
      triggerDownload(kmzBlob, filename);

      showToast(`Downloaded ${filename}`, 'success', 4000);
    } catch (err) {
      console.error('KMZ generation failed:', err);
      showToast(`KMZ export failed: ${err.message}`, 'error', 5000);
    } finally {
      el.btnDownloadKmz.disabled = false;
      el.btnDownloadKmz.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        Download KMZ (.kmz)`;
    }
  }

  function handleDownloadKml() {
    if (!state.converter.featureCollection) return;

    try {
      const docName = state.exportBaseName || 'geospatial_export';
      const starTheme = getSelectedRadioValue('star-theme') || 'vehicle';
      const lineWidth = parseInt(el.sliderLineWidth.value, 10) || 4;
      const titleField = state.converter.detectTitleField();
      const includeExtendedData = true;

      const kml = state.converter.generateKML({
        documentName: docName,
        titleField: titleField,
        colorMode: starTheme,
        singleColor: state.selectedLineColor || '#3F4344',
        lineWidth: lineWidth,
        includeExtendedData: includeExtendedData
      });

      const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml;charset=utf-8' });
      triggerDownload(blob, `${docName}.kml`);
      showToast(`Downloaded ${docName}.kml`, 'success');
    } catch (err) {
      showToast(`KML export failed: ${err.message}`, 'error');
    }
  }

  function handleDownloadGeoJson() {
    if (!state.converter.featureCollection) return;
    try {
      const docName = state.exportBaseName || 'geospatial_export';
      const jsonStr = JSON.stringify(state.converter.featureCollection, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/geo+json;charset=utf-8' });
      triggerDownload(blob, `${docName}_enriched.geojson`);
      showToast('Downloaded GeoJSON', 'success');
    } catch (err) {
      showToast(`GeoJSON export failed: ${err.message}`, 'error');
    }
  }


  /**
   * Setup Drag and Drop Zone
   */
  function setupDropzone(dropzoneEl, fileInputEl, onFileSelected) {
    dropzoneEl.addEventListener('click', () => fileInputEl.click());

    dropzoneEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzoneEl.classList.add('dragover');
    });

    dropzoneEl.addEventListener('dragleave', () => {
      dropzoneEl.classList.remove('dragover');
    });

    dropzoneEl.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzoneEl.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        onFileSelected(e.dataTransfer.files[0]);
      }
    });

    fileInputEl.addEventListener('change', () => {
      if (fileInputEl.files && fileInputEl.files.length > 0) {
        onFileSelected(fileInputEl.files[0]);
      }
    });
  }

  /**
   * Load In-Memory Demo Road Survey (10 Segments with iRAP attributes)
   */
  function loadDemoData() {
    const startLat = 34.896141;
    const startLon = -80.894851;
    const demoFeatures = [];

    const sampleAttributes = [
      { speed: 35, median: 11, object: 13, cond: 1, lanes: 1, width: 3, flow: 1, rating: 1 },
      { speed: 35, median: 11, object: 11, cond: 1, lanes: 1, width: 3, flow: 2, rating: 2 },
      { speed: 35, median: 11, object: 11, cond: 1, lanes: 1, width: 3, flow: 2, rating: 3 },
      { speed: 35, median: 11, object: 12, cond: 1, lanes: 1, width: 1, flow: 1, rating: 4 },
      { speed: 35, median: 11, object: 11, cond: 2, lanes: 1, width: 1, flow: 1, rating: 5 },
      { speed: 35, median: 11, object: 11, cond: 1, lanes: 1, width: 1, flow: 3, rating: 0 },
      { speed: 35, median: 11, object: 12, cond: 1, lanes: 1, width: 3, flow: 1, rating: 5 },
      { speed: 35, median: 11, object: 16, cond: 1, lanes: 1, width: 3, flow: 1, rating: 4 },
      { speed: 35, median: 11, object: 12, cond: 1, lanes: 1, width: 2, flow: 1, rating: 3 },
      { speed: 35, median: 11, object: 11, cond: 1, lanes: 1, width: 3, flow: 2, rating: 2 }
    ];

    for (let i = 0; i < sampleAttributes.length; i++) {
      const a = sampleAttributes[i];
      const p1 = [startLon + (i * 0.0010), startLat + (i * 0.00025)];
      const p2 = [startLon + ((i + 1) * 0.0010), startLat + ((i + 1) * 0.00025)];

      demoFeatures.push({
        type: 'Feature',
        id: i + 1,
        geometry: {
          type: 'LineString',
          coordinates: [p1, p2]
        },
        properties: {
          'Road name': 'Indian Trail (Demo Corridor)',
          'Section': `Segment ${436800 + i}`,
          'Distance (km)': (i * 0.1).toFixed(2),
          'Carriageway': (i < 6 ? 1 : 2),
          'Speed limit': a.speed,
          'Median type': a.median,
          'Roadside severity - driver-side object': a.object,
          'Road condition': a.cond,
          'Number of lanes': a.lanes,
          'Lane width': a.width,
          'Area type': (i < 7 ? 1 : 2),
          'Pedestrian observed flow across the road': a.flow,
          'Vehicle Star Rating Raw': a.rating,
          'Vehicle Star Rating Smoothed': a.rating,
          'Motorcyclist Star Rating Raw': a.rating === 0 ? 0 : Math.max(1, a.rating === 5 ? 4 : (a.rating === 1 ? 1 : a.rating - 1)),
          'Motorcyclist Star Rating Smoothed': a.rating === 0 ? 0 : Math.max(1, a.rating - 1),
          'Pedestrian Star Rating Raw': a.rating === 0 ? 0 : Math.min(5, a.rating === 1 ? 2 : a.rating + 1),
          'Pedestrian Star Rating Smoothed': a.rating === 0 ? 0 : Math.min(5, a.rating + 1),
          'Bicyclist Star Rating Raw': a.rating,
          'Bicyclist Star Rating Smoothed': a.rating,
          'Vehicle Occupant Star Rating Policy Target': 3
        }
      });
    }

    const demoFC = {
      type: 'FeatureCollection',
      features: demoFeatures
    };

    state.converter.loadGeoJSON(demoFC, 'Demo_Road_Survey_10_Segments');
    state.geoLoaded = true;

    el.geoFileName.textContent = 'Demo_Road_Survey_10_Segments.geojson';
    el.geoFileTypeBadge.textContent = 'DEMO';
    el.geoDropzone.style.display = 'none';
    el.geoLoadedBanner.style.display = 'flex';
    el.csvGeoSettings.style.display = 'none';
    state.exportBaseName = 'iRAPtoKMZ_demo';

    if (el.loadDemoBtn) el.loadDemoBtn.className = 'btn-builtin-active';
    if (el.geoDemoBadge) {
      el.geoDemoBadge.style.display = 'inline-block';
      el.geoDemoBadge.textContent = 'Active';
    }

    // Only apply built-in dictionary if user has previously enabled it
    if (state.dictionaryLoaded && state.dictionaryType === 'builtin') {
      applyBuiltinIrapDictionary(true);
    }
    updateAttributeSelectors();
    showToast('Demo data loaded', 'success');
  }

  /**
   * Export the 541 iRAP mappings as a downloadable CSV file
   */
  function downloadIrapDictCsv() {
    if (typeof window.IRAP_BUILTIN_DICTIONARY === 'undefined') {
      showToast('Dictionary unavailable', 'error');
      return;
    }

    const rows = ['Item,Code,Category'];
    for (const entry of window.IRAP_BUILTIN_DICTIONARY) {
      const item = entry.item.includes(',') ? `"${entry.item}"` : entry.item;
      const cat = entry.category.includes(',') ? `"${entry.category}"` : entry.category;
      rows.push(`${item},${entry.code},${cat}`);
    }

    // Prepend UTF-8 BOM (\uFEFF) so Excel opens UTF-8 without mojibake
    const blob = new Blob(['\uFEFF' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    triggerDownload(blob, 'irap_data_dictionary.csv');
    showToast('Downloaded dictionary CSV', 'success');
  }

  /**
   * Event Listeners Setup
   */
  function setupEventListeners() {
    // Theme
    initTheme();

    // Dropzones
    setupDropzone(el.geoDropzone, el.geoFileInput, processGeoFile);
    setupDropzone(el.dictDropzone, el.dictFileInput, processDictFile);

    // Remove file buttons
    el.geoRemoveBtn.addEventListener('click', () => {
      state.converter = new GeoConverter();
      state.geoLoaded = false;
      state.exportBaseName = 'geospatial_export';
      el.geoFileInput.value = '';
      el.geoDropzone.style.display = 'block';
      el.geoLoadedBanner.style.display = 'none';
      el.csvGeoSettings.style.display = 'none';
      el.geoStats.style.display = 'none';
      if (el.loadDemoBtn) el.loadDemoBtn.className = 'btn-builtin-inactive';
      if (el.geoDemoBadge) el.geoDemoBadge.style.display = 'none';
      if (state.mapLayerGroup) state.mapLayerGroup.clearLayers();
      if (el.dictStatsText) el.dictStatsText.innerHTML = '<strong>0</strong> values replaced across <strong>0</strong> fields';
      if (el.dictStatsSummary) el.dictStatsSummary.classList.remove('has-replacements');
      updateStarRatingThemeAvailability();
      updateUI();
    });

    el.dictRemoveBtn.addEventListener('click', () => {
      el.dictFileInput.value = '';
      el.dictDropzone.style.display = 'block';
      el.dictLoadedBanner.style.display = 'none';
      el.dictColSettings.style.display = 'none';
      state.dictionary = new DataDictionary();
      state.dictionaryLoaded = false;
      state.dictionaryType = null;
      if (el.applyIrapPresetBtn) el.applyIrapPresetBtn.className = 'btn-builtin-inactive';
      if (el.dictBuiltinBadge) el.dictBuiltinBadge.style.display = 'none';
      reapplyDataDictionary();
      showToast('Dictionary removed', 'info');
    });

    // Demo & Quick Actions
    if (el.loadDemoBtn) {
      el.loadDemoBtn.addEventListener('click', loadDemoData);
    }
    if (el.downloadDictCsvBtn) {
      el.downloadDictCsvBtn.addEventListener('click', downloadIrapDictCsv);
    }
    if (el.footerDictLink) {
      el.footerDictLink.addEventListener('click', (e) => {
        e.preventDefault();
        downloadIrapDictCsv();
      });
    }

    el.applyIrapPresetBtn.addEventListener('click', handleBuiltinButtonClick);

    // Mode Radio changes
    el.modeRadios.forEach(radio => {
      radio.addEventListener('change', () => {
        updateCsvGeomModeVisibility(radio.value);
        reapplyDataDictionary();
      });
    });

    // CSV Coord Selector changes
    [el.selectLat, el.selectLon, el.selectEndLat, el.selectEndLon].forEach(sel => {
      sel.addEventListener('change', reapplyDataDictionary);
    });

    // Star Rating Theme changes
    el.starThemeRadios.forEach(radio => {
      radio.addEventListener('change', () => {
        updateLineColorVisibility();
        renderMapFeatures();
      });
    });

    // Line Color Swatches for 'None' theme
    if (el.colorSwatches) {
      el.colorSwatches.forEach(swatch => {
        swatch.addEventListener('click', () => {
          const col = swatch.getAttribute('data-color');
          if (col) setLineColor(col);
        });
      });
    }

    // Custom Line Color Picker
    if (el.inputCustomLineColor) {
      el.inputCustomLineColor.addEventListener('input', (e) => {
        setLineColor(e.target.value);
      });
    }

    // Line width slider
    el.sliderLineWidth.addEventListener('input', (e) => {
      el.labelLineWidth.textContent = `${e.target.value}px`;
      renderMapFeatures();
    });

    // Tab buttons
    el.tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        el.tabButtons.forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-selected', 'false');
        });
        el.tabContents.forEach(c => c.classList.remove('active'));

        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
        const targetId = btn.getAttribute('aria-controls');
        const targetContent = document.getElementById(targetId);
        if (targetContent) targetContent.classList.add('active');

        if (targetId === 'tab-map' && state.interactiveMapEnabled && state.map) {
          setTimeout(() => state.map.invalidateSize(), 150);
        }
      });
    });

    // Table Search
    el.tableSearch.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      if (!q) {
        state.filteredRows = state.currentRows;
      } else {
        state.filteredRows = state.currentRows.filter(row => {
          return Object.values(row.props).some(v => String(v).toLowerCase().includes(q));
        });
      }
      state.currentPage = 1;
      renderTablePage();
    });

    // Table Pagination
    el.prevPageBtn.addEventListener('click', () => {
      if (state.currentPage > 1) {
        state.currentPage--;
        renderTablePage();
      }
    });

    el.nextPageBtn.addEventListener('click', () => {
      state.currentPage++;
      renderTablePage();
    });

    // Download Buttons
    el.btnDownloadKmz.addEventListener('click', handleDownloadKmz);
    el.btnDownloadKml.addEventListener('click', handleDownloadKml);
    el.btnDownloadGeoJson.addEventListener('click', handleDownloadGeoJson);
    if (el.btnOpenGoogleEarth) {
      el.btnOpenGoogleEarth.addEventListener('click', () => {
        showToast('In Google Earth: select File > Import File > Upload from Device', 'info', 6000);
      });
    }
  }

  // Initialize on DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    initMap();
    updateStarRatingThemeAvailability();
  });
})();
