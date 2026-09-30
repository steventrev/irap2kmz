/**
 * Geo2KMZ Studio - Main Application Controller
 */
(function () {
  'use strict';

  // Application State
  const state = {
    converter: new GeoConverter(),
    dictionary: new DataDictionary(),
    dictionaryLoaded: false,
    geoLoaded: false,
    activeTab: 'map',
    map: null,
    mapLayerGroup: null,
    currentRows: [],
    filteredRows: [],
    tableHeaders: [],
    currentPage: 1,
    pageSize: 50,
    replacedFieldsSet: new Set()
  };

  // DOM Elements Cache
  const el = {
    // Theme
    themeToggleBtn: document.getElementById('theme-toggle-btn'),
    themeIcon: document.getElementById('theme-icon'),
    themeText: document.getElementById('theme-text'),

    // Demo & Quick Actions
    loadDemoBtn: document.getElementById('load-demo-btn'),
    downloadDictCsvBtn: document.getElementById('download-dict-csv-btn'),
    footerDictLink: document.getElementById('footer-dict-link'),
    applyIrapPresetBtn: document.getElementById('apply-irap-preset-btn'),

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
    dictStats: document.getElementById('dict-stats'),
    statDictEntries: document.getElementById('stat-dict-entries'),
    statDictFields: document.getElementById('stat-dict-fields'),
    statDictReplacements: document.getElementById('stat-dict-replacements'),

    // Step 3: KMZ Styling
    selectTitleField: document.getElementById('select-title-field'),
    colorRadios: document.querySelectorAll('input[name="color-mode"]'),
    wrapCategoricalField: document.getElementById('wrap-categorical-field'),
    selectColorField: document.getElementById('select-color-field'),
    wrapSingleColor: document.getElementById('wrap-single-color'),
    inputSingleColor: document.getElementById('input-single-color'),
    sliderLineWidth: document.getElementById('slider-line-width'),
    labelLineWidth: document.getElementById('label-line-width'),
    checkExtendedData: document.getElementById('check-extended-data'),
    inputDocName: document.getElementById('input-doc-name'),

    // Export Section
    exportHeadline: document.getElementById('export-headline'),
    exportDetails: document.getElementById('export-details'),
    btnDownloadKmz: document.getElementById('btn-download-kmz'),
    btnDownloadKml: document.getElementById('btn-download-kml'),
    btnDownloadGeoJson: document.getElementById('btn-download-geojson'),

    // Tabs
    tabButtons: document.querySelectorAll('.tab-btn'),
    tabContents: document.querySelectorAll('.tab-content'),
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

    const isDark = theme === 'dark';
    const apiKey = getCartoApiKey();

    if (apiKey) {
      const tileUrl = isDark
        ? `https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png?key=${encodeURIComponent(apiKey)}`
        : `https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${encodeURIComponent(apiKey)}`;

      const attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

      currentTileLayer = L.tileLayer(tileUrl, {
        maxZoom: 19,
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
            className: isDark ? 'osm-dark-tiles' : '',
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          }).addTo(state.map);
        }
      });
    } else {
      // Without an API key, CARTO returns watermarked tiles ("API KEY REQUIRED").
      // Directly load OpenStreetMap to ensure a clean, watermark-free basemap.
      currentTileLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        className: isDark ? 'osm-dark-tiles' : '',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(state.map);
    }
  }

  /**
   * Render Features on Leaflet Map
   */
  function renderMapFeatures() {
    if (!state.converter.featureCollection || typeof L === 'undefined') return;
    initMap();

    state.mapLayerGroup.clearLayers();
    const fc = state.converter.featureCollection;
    if (!fc.features || fc.features.length === 0) return;

    const colorMode = getSelectedRadioValue('color-mode');
    const colorField = el.selectColorField.value;
    const singleColor = el.inputSingleColor.value;
    const lineWidth = parseInt(el.sliderLineWidth.value, 10) || 4;

    const starColorMap = {
      '5 star': '#43A047', '5': '#43A047',
      '4 star': '#FDD835', '4': '#FDD835',
      '3 star': '#FB8C00', '3': '#FB8C00',
      '2 star': '#E53935', '2': '#E53935',
      '1 star': '#212121', '1': '#212121'
    };

    const catPalette = ['#2563EB', '#7C3AED', '#DB2777', '#EA580C', '#16A34A', '#0891B2', '#4F46E5', '#9333EA', '#D97706', '#059669'];
    const catMap = new Map();
    let catIdx = 0;

    const getFeatureColor = (feature) => {
      const props = feature.properties || {};

      if (colorMode === 'irap_stars') {
        let ratingVal = props['Vehicle Star Rating Raw'];
        if (ratingVal === undefined || ratingVal === null) {
          for (const [k, v] of Object.entries(props)) {
            const norm = k.toLowerCase().replace(/[\s_]+/g, ' ').trim();
            if (norm === 'vehicle star rating raw') {
              ratingVal = v;
              break;
            }
          }
        }
        if (ratingVal !== null && ratingVal !== undefined) {
          const s = String(ratingVal).toLowerCase().trim();
          for (const [starKey, col] of Object.entries(starColorMap)) {
            if (s.includes(starKey)) return col;
          }
        }
        return singleColor;
      }

      if (colorMode === 'categorical' && colorField && props[colorField] !== undefined) {
        const val = String(props[colorField]);
        if (!catMap.has(val)) {
          catMap.set(val, catPalette[catIdx % catPalette.length]);
          catIdx++;
        }
        return catMap.get(val);
      }

      return singleColor;
    };

    const titleField = el.selectTitleField.value || state.converter.detectTitleField();

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

    // Toggle legend visibility based on color mode
    el.mapLegend.style.display = colorMode === 'irap_stars' ? 'flex' : 'none';
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
      const isFieldPresentInData = state.replacedFieldsSet.has(originalFieldName);

      let itemsHtml = '';
      let count = 0;
      for (const [code, desc] of codeMap.entries()) {
        if (count >= 10) {
          itemsHtml += `<div style="font-size:0.7rem; color:var(--text-subtle); text-align:center;">+ ${codeMap.size - 10} more codes...</div>`;
          break;
        }
        itemsHtml += `
          <div class="diff-item">
            <span class="diff-from">Code ${code}</span>
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
   * Update Placemark Title and Color Attribute Dropdowns
   */
  function updateAttributeSelectors() {
    if (!state.converter.featureCollection) return;
    const features = state.converter.featureCollection.features || [];
    if (features.length === 0) return;

    const sampleProps = Object.keys(features[0].properties || {});
    const autoTitle = state.converter.detectTitleField();

    let titleOptions = '<option value="">(Auto-detect: ' + (autoTitle || 'Feature #') + ')</option>';
    let colorOptions = '<option value="">(Select attribute)</option>';

    for (const p of sampleProps) {
      titleOptions += `<option value="${GeoConverter.escapeXml(p)}">${GeoConverter.escapeXml(p)}</option>`;
      colorOptions += `<option value="${GeoConverter.escapeXml(p)}">${GeoConverter.escapeXml(p)}</option>`;
    }

    el.selectTitleField.innerHTML = titleOptions;
    el.selectColorField.innerHTML = colorOptions;

    // Pick reasonable default for color attribute (e.g. Star Rating or Speed limit)
    const starCandidate = sampleProps.find(p => p.toLowerCase().includes('star rating') || p.toLowerCase().includes('section') || p.toLowerCase().includes('road'));
    if (starCandidate) {
      el.selectColorField.value = starCandidate;
    }
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

    const isGeoJson = state.converter.dataType === 'geojson';

    if (isGeoJson) {
      // Data dictionary replacement is disabled for GeoJSON files
      el.statDictReplacements.textContent = 'Bypassed (GeoJSON)';
      const dictBadge = document.querySelector('#card-dictionary .card-header .version-pill');
      if (dictBadge) {
        dictBadge.textContent = 'Bypassed for GeoJSON';
        dictBadge.style.color = 'var(--text-subtle)';
        dictBadge.style.borderColor = 'var(--border-color)';
      }
    } else if (state.dictionaryLoaded) {
      const dictBadge = document.querySelector('#card-dictionary .card-header .version-pill');
      if (dictBadge) {
        dictBadge.textContent = 'Active (CSV)';
        dictBadge.style.color = 'var(--success)';
        dictBadge.style.borderColor = 'rgba(16,185,129,0.4)';
      }

      const res = state.converter.applyDictionary(state.dictionary);
      el.statDictReplacements.textContent = res.replacements.toLocaleString();

      // Find which fields were replaced
      for (const f of state.converter.featureCollection.features) {
        for (const k of Object.keys(f.properties || {})) {
          if (state.dictionary.lookup(k, f.properties[k]) !== null) {
            state.replacedFieldsSet.add(k);
          }
        }
      }

      showToast(`Dictionary applied (${res.replacements.toLocaleString()} updated)`, 'success');
    } else {
      const dictBadge = document.querySelector('#card-dictionary .card-header .version-pill');
      if (dictBadge) {
        dictBadge.textContent = 'Optional (CSV)';
        dictBadge.style.color = 'var(--text-muted)';
        dictBadge.style.borderColor = 'var(--border-color)';
      }
      el.statDictReplacements.textContent = '0';
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

    // Enable Buttons
    el.btnDownloadKmz.disabled = false;
    el.btnDownloadKml.disabled = false;
    el.btnDownloadGeoJson.disabled = false;

    // Update Export Card if elements present
    if (el.exportHeadline) {
      const isGeoJson = state.converter.dataType === 'geojson';
      let dictText = '';
      if (isGeoJson) {
        dictText = 'GeoJSON to KMZ direct conversion (dictionary replacement disabled for GeoJSON).';
      } else if (state.dictionaryLoaded) {
        dictText = `Data dictionary active (${state.dictionary.totalEntriesCount} rules applied).`;
      } else {
        dictText = 'No data dictionary applied (exporting original CSV values).';
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

        // Suggest clean output name
        const cleanName = fileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
        el.inputDocName.value = cleanName;

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

        el.dictFileName.textContent = fileName;
        el.dictDropzone.style.display = 'none';
        el.dictLoadedBanner.style.display = 'flex';

        // Populate column mapping selectors
        populateDictColSelectors(summary.columnMapping);

        el.statDictEntries.textContent = summary.totalEntries.toLocaleString();
        el.statDictFields.textContent = summary.distinctFields;
        el.dictStats.style.display = 'grid';

        reapplyDataDictionary();
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
  function applyBuiltinIrapDictionary() {
    if (typeof window.IRAP_BUILTIN_DICTIONARY === 'undefined') {
      showToast('Dictionary not loaded', 'error');
      return;
    }

    const summary = state.dictionary.loadFromEntries(window.IRAP_BUILTIN_DICTIONARY, 'iRAP Coding Manual (Built-in)');
    state.dictionaryLoaded = true;

    el.dictFileName.textContent = 'iRAP Coding Manual QuickGuide (Built-in)';
    el.dictDropzone.style.display = 'none';
    el.dictLoadedBanner.style.display = 'flex';
    el.dictColSettings.style.display = 'none';

    el.statDictEntries.textContent = summary.totalEntries.toLocaleString();
    el.statDictFields.textContent = summary.distinctFields;
    el.dictStats.style.display = 'grid';

    reapplyDataDictionary();
    showToast('iRAP dictionary loaded', 'success');
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

      const docName = el.inputDocName.value.trim() || 'geospatial_export';
      const colorMode = getSelectedRadioValue('color-mode');
      const colorField = el.selectColorField.value;
      const singleColor = el.inputSingleColor.value;
      const lineWidth = parseInt(el.sliderLineWidth.value, 10) || 4;
      const titleField = el.selectTitleField.value || state.converter.detectTitleField();
      const includeExtendedData = el.checkExtendedData.checked;

      const kml = state.converter.generateKML({
        documentName: docName,
        titleField: titleField,
        colorMode: colorMode,
        colorField: colorField,
        singleColor: singleColor,
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
      const docName = el.inputDocName.value.trim() || 'geospatial_export';
      const colorMode = getSelectedRadioValue('color-mode');
      const colorField = el.selectColorField.value;
      const singleColor = el.inputSingleColor.value;
      const lineWidth = parseInt(el.sliderLineWidth.value, 10) || 4;
      const titleField = el.selectTitleField.value || state.converter.detectTitleField();
      const includeExtendedData = el.checkExtendedData.checked;

      const kml = state.converter.generateKML({
        documentName: docName,
        titleField: titleField,
        colorMode: colorMode,
        colorField: colorField,
        singleColor: singleColor,
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
      const docName = el.inputDocName.value.trim() || 'geospatial_export';
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
      { speed: 35, median: 11, object: 13, cond: 1, lanes: 1, width: 3, flow: 1, rating: 3 },
      { speed: 35, median: 11, object: 11, cond: 1, lanes: 1, width: 3, flow: 2, rating: 3 },
      { speed: 35, median: 11, object: 11, cond: 1, lanes: 1, width: 3, flow: 2, rating: 2 },
      { speed: 35, median: 11, object: 12, cond: 1, lanes: 1, width: 1, flow: 1, rating: 4 },
      { speed: 35, median: 11, object: 11, cond: 2, lanes: 1, width: 1, flow: 1, rating: 4 },
      { speed: 35, median: 11, object: 11, cond: 1, lanes: 1, width: 1, flow: 3, rating: 3 },
      { speed: 35, median: 11, object: 12, cond: 1, lanes: 1, width: 3, flow: 1, rating: 5 },
      { speed: 35, median: 11, object: 16, cond: 1, lanes: 1, width: 3, flow: 1, rating: 2 },
      { speed: 35, median: 11, object: 12, cond: 1, lanes: 1, width: 2, flow: 1, rating: 3 },
      { speed: 35, median: 11, object: 11, cond: 1, lanes: 1, width: 3, flow: 2, rating: 4 }
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
          'Carriageway': 3,
          'Speed limit': a.speed,
          'Median type': a.median,
          'Roadside severity - driver-side object': a.object,
          'Road condition': a.cond,
          'Number of lanes': a.lanes,
          'Lane width': a.width,
          'Area type': 1,
          'Pedestrian observed flow across the road': a.flow,
          'Vehicle Star Rating Smoothed': a.rating,
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
    el.inputDocName.value = 'Demo_Road_Survey_KMZ';

    // Also auto-apply the built-in iRAP dictionary
    applyBuiltinIrapDictionary();
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

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
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
      el.geoFileInput.value = '';
      el.geoDropzone.style.display = 'block';
      el.geoLoadedBanner.style.display = 'none';
      el.csvGeoSettings.style.display = 'none';
      el.geoStats.style.display = 'none';
      if (state.mapLayerGroup) state.mapLayerGroup.clearLayers();
      updateUI();
    });

    el.dictRemoveBtn.addEventListener('click', () => {
      state.dictionary = new DataDictionary();
      state.dictionaryLoaded = false;
      el.dictFileInput.value = '';
      el.dictDropzone.style.display = 'block';
      el.dictLoadedBanner.style.display = 'none';
      el.dictColSettings.style.display = 'none';
      el.dictStats.style.display = 'none';
      reapplyDataDictionary();
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

    el.applyIrapPresetBtn.addEventListener('click', applyBuiltinIrapDictionary);

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

    // Color Mode changes
    el.colorRadios.forEach(radio => {
      radio.addEventListener('change', () => {
        const val = radio.value;
        el.wrapCategoricalField.style.display = val === 'categorical' ? 'flex' : 'none';
        el.wrapSingleColor.style.display = val === 'single' ? 'flex' : 'none';
        renderMapFeatures();
      });
    });

    el.selectColorField.addEventListener('change', renderMapFeatures);
    el.inputSingleColor.addEventListener('input', renderMapFeatures);

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

        if (targetId === 'tab-map' && state.map) {
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
  }

  // Initialize on DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    initMap();
  });
})();
