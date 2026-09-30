/**
 * Geospatial Converter: GeoJSON / CSV to KML / KMZ
 * Handles coordinate detection, WKT, segment lines, dictionary replacement,
 * thematic styling, and KMZ compression.
 */
(function (global) {
  'use strict';

  class GeoConverter {
    constructor() {
      this.featureCollection = null;
      this.originalData = null;
      this.dataType = null; // 'geojson' or 'csv'
      this.detectedColumns = null;
      this.csvRows = null;
      this.csvHeaders = null;
    }

    /**
     * Convert standard Hex color #RRGGBB and opacity (0-1) to KML color aabbggrr
     */
    static hexToKmlColor(hex, opacity = 1.0) {
      if (!hex) return 'ffffffff';
      let cleanHex = hex.replace('#', '').trim();
      if (cleanHex.length === 3) {
        cleanHex = cleanHex.split('').map(c => c + c).join('');
      }
      if (cleanHex.length !== 6) return 'ffffffff';

      const r = cleanHex.substring(0, 2);
      const g = cleanHex.substring(2, 4);
      const b = cleanHex.substring(4, 6);

      const alphaInt = Math.round(Math.min(1, Math.max(0, opacity)) * 255);
      const a = alphaInt.toString(16).padStart(2, '0');

      // KML format is AABBGGRR
      return (a + b + g + r).toLowerCase();
    }

    /**
     * Escape XML special characters
     */
    static escapeXml(unsafe) {
      if (unsafe === null || unsafe === undefined) return '';
      return String(unsafe)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    }

    /**
     * Standard ViDA Star Rating color definitions
     */
    static STAR_COLORS = Object.freeze({
      5: '#2C742C', // 5 Stars: ViDA Green
      4: '#818139', // 4 Stars: ViDA Olive
      3: '#BE9646', // 3 Stars: ViDA Amber
      2: '#921D1B', // 2 Stars: ViDA Crimson Red
      1: '#000000', // 1 Star: ViDA Black
      na: '#3F4344' // Not applicable: ViDA Slate Gray
    });

    /**
     * Target property keys for Star Rating Raw fields by mode
     */
    static STAR_THEME_KEYS = Object.freeze({
      vehicle: ['Vehicle Star Rating Raw', 'vehicle star rating raw'],
      motorcycle: ['Motorcyclist Star Rating Raw', 'Motorcycle Star Rating Raw', 'motorcyclist star rating raw', 'motorcycle star rating raw'],
      bicycle: ['Bicyclist Star Rating Raw', 'Bicycle Star Rating Raw', 'bicyclist star rating raw', 'bicycle star rating raw'],
      pedestrian: ['Pedestrian Star Rating Raw', 'pedestrian star rating raw']
    });

    /**
     * Resolve the ViDA Star Rating color for a GeoJSON feature based on the chosen theme.
     * @param {Object} feature - GeoJSON feature object (or properties object)
     * @param {string} theme - 'vehicle' | 'motorcycle' | 'bicycle' | 'pedestrian' | 'none'
     * @param {string} fallbackColor - Hex color to return if no rating or theme is 'none'
     * @returns {string} Hex color string (#RRGGBB)
     */
    static getStarRatingColor(feature, theme = 'vehicle', fallbackColor = '#3F4344') {
      if (!theme || theme === 'none') return fallbackColor;

      const props = (feature && feature.properties) ? feature.properties : (feature || {});
      let ratingVal = null;

      const targets = GeoConverter.STAR_THEME_KEYS[theme] || GeoConverter.STAR_THEME_KEYS.vehicle;

      // 1. Exact match
      for (const target of targets) {
        if (props[target] !== undefined && props[target] !== null) {
          ratingVal = props[target];
          break;
        }
      }

      // 2. Normalized key match
      if (ratingVal === null || ratingVal === undefined) {
        for (const [k, v] of Object.entries(props)) {
          const norm = k.toLowerCase().replace(/[\s_]+/g, ' ').trim();
          if (targets.some(t => t.toLowerCase() === norm)) {
            ratingVal = v;
            break;
          }
        }
      }

      // 3. Keyword fuzzy match
      if (ratingVal === null || ratingVal === undefined) {
        const kw = theme === 'motorcycle' ? ['motorcycle', 'motorcyclist']
                 : theme === 'bicycle' ? ['bicycle', 'bicyclist']
                 : theme === 'pedestrian' ? ['pedestrian']
                 : ['vehicle'];
        for (const [k, v] of Object.entries(props)) {
          const norm = k.toLowerCase().replace(/[\s_]+/g, ' ').trim();
          if (kw.some(w => norm.includes(w)) && norm.includes('star rating') && norm.includes('raw')) {
            ratingVal = v;
            break;
          }
        }
      }

      if (ratingVal !== null && ratingVal !== undefined) {
        const s = String(ratingVal).toLowerCase().trim();
        if (s.includes('5 star') || s === '5') return GeoConverter.STAR_COLORS[5];
        if (s.includes('4 star') || s === '4') return GeoConverter.STAR_COLORS[4];
        if (s.includes('3 star') || s === '3') return GeoConverter.STAR_COLORS[3];
        if (s.includes('2 star') || s === '2') return GeoConverter.STAR_COLORS[2];
        if (s.includes('1 star') || s === '1') return GeoConverter.STAR_COLORS[1];
        if (s.includes('not applicable') || s.includes('n/a') || s === '0') return GeoConverter.STAR_COLORS.na;
      }

      return fallbackColor;
    }

    /**
     * Inspect a FeatureCollection to determine which Star Rating themes are present.
     * @param {Object} featureCollection - GeoJSON FeatureCollection
     * @returns {{ vehicle: boolean, motorcycle: boolean, bicycle: boolean, pedestrian: boolean }}
     */
    static detectAvailableStarThemes(featureCollection) {
      const available = {
        vehicle: false,
        motorcycle: false,
        bicycle: false,
        pedestrian: false
      };

      if (!featureCollection || !Array.isArray(featureCollection.features)) {
        return available;
      }

      const sampleFeatures = featureCollection.features.slice(0, Math.min(featureCollection.features.length, 50));
      for (const f of sampleFeatures) {
        const props = f.properties || {};
        for (const k of Object.keys(props)) {
          const norm = k.toLowerCase().replace(/[\s_]+/g, ' ').trim();
          if ((norm.includes('star rating') && norm.includes('raw')) || norm.endsWith('star rating raw') || norm.includes('star_rating_raw')) {
            if (norm.includes('vehicle')) available.vehicle = true;
            if (norm.includes('motorcycle') || norm.includes('motorcyclist')) available.motorcycle = true;
            if (norm.includes('bicycle') || norm.includes('bicyclist')) available.bicycle = true;
            if (norm.includes('pedestrian')) available.pedestrian = true;
          }
        }
      }

      return available;
    }


    /**
     * Auto-detect coordinate and geometry columns in CSV headers
     */
    static detectCsvColumns(headers) {
      const lower = headers.map(h => String(h).trim().toLowerCase());

      const latNames = ['latitude', 'lat', 'y', 'lat_dd', 'latitude_deg', 'start_latitude', 'start_lat', 'lat1', 'from_lat', 'y_coord', 'ycoord'];
      const lonNames = ['longitude', 'lon', 'lng', 'long', 'x', 'lon_dd', 'longitude_deg', 'start_longitude', 'start_lon', 'lon1', 'from_lon', 'x_coord', 'xcoord'];
      const endLatNames = ['end latitude', 'end_latitude', 'end lat', 'end_lat', 'endlatitude', 'to_lat', 'latitude_to', 'lat_to', 'lat2', 'end_y'];
      const endLonNames = ['end longitude', 'end_longitude', 'end lon', 'end_lon', 'end_lng', 'endlongitude', 'to_lon', 'longitude_to', 'lon_to', 'lon2', 'end_x'];
      const wktNames = ['wkt', 'geom', 'the_geom', 'geometry', 'shape', 'geometry_wkt'];

      const findMatch = (candidates, exclude = []) => {
        // First try exact matches
        for (const cand of candidates) {
          const idx = lower.findIndex((h, i) => h === cand && !exclude.includes(headers[i]));
          if (idx !== -1) return headers[idx];
        }
        // Then try contains
        for (const cand of candidates) {
          const idx = lower.findIndex((h, i) => h.includes(cand) && !exclude.includes(headers[i]));
          if (idx !== -1) return headers[idx];
        }
        return null;
      };

      const wktCol = findMatch(wktNames);
      const endLatCol = findMatch(endLatNames);
      const endLonCol = findMatch(endLonNames);
      const latCol = findMatch(latNames, endLatCol ? [endLatCol] : []);
      const lonCol = findMatch(lonNames, endLonCol ? [endLonCol] : []);

      const hasStart = !!(latCol && lonCol);
      const hasEnd = !!(endLatCol && endLonCol);
      const hasWkt = !!wktCol;

      let defaultMode = 'point';
      if (hasStart && hasEnd) {
        defaultMode = 'linestring';
      } else if (hasWkt) {
        defaultMode = 'wkt';
      }

      return {
        latCol,
        lonCol,
        endLatCol,
        endLonCol,
        wktCol,
        hasStart,
        hasEnd,
        hasWkt,
        defaultMode
      };
    }

    /**
     * Parse WKT geometry string (Point, LineString, Polygon)
     */
    static parseWKT(wktString) {
      if (!wktString || typeof wktString !== 'string') return null;
      const s = wktString.trim();

      // POINT (lon lat)
      const ptMatch = s.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
      if (ptMatch) {
        return {
          type: 'Point',
          coordinates: [parseFloat(ptMatch[1]), parseFloat(ptMatch[2])]
        };
      }

      // LINESTRING (lon lat, lon lat, ...)
      const lineMatch = s.match(/LINESTRING\s*\(([^)]+)\)/i);
      if (lineMatch) {
        const coords = lineMatch[1].trim().split(',').map(pair => {
          const [lon, lat] = pair.trim().split(/\s+/).map(Number);
          return [lon, lat];
        }).filter(c => !isNaN(c[0]) && !isNaN(c[1]));
        return { type: 'LineString', coordinates: coords };
      }

      // POLYGON ((lon lat, ...))
      const polyMatch = s.match(/POLYGON\s*\(\(([^)]+)\)\)/i);
      if (polyMatch) {
        const coords = polyMatch[1].trim().split(',').map(pair => {
          const [lon, lat] = pair.trim().split(/\s+/).map(Number);
          return [lon, lat];
        }).filter(c => !isNaN(c[0]) && !isNaN(c[1]));
        return { type: 'Polygon', coordinates: [coords] };
      }

      return null;
    }

    /**
     * Load and parse GeoJSON text or object
     */
    loadGeoJSON(geojsonData, sourceName = 'GeoJSON') {
      let parsed = geojsonData;
      if (typeof geojsonData === 'string') {
        // Strip BOM if present
        if (geojsonData.charCodeAt(0) === 0xFEFF) {
          geojsonData = geojsonData.slice(1);
        }
        parsed = JSON.parse(geojsonData);
      }

      let features = [];
      if (parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) {
        features = parsed.features;
      } else if (parsed.type === 'Feature') {
        features = [parsed];
      } else if (parsed.type && parsed.coordinates) {
        features = [{
          type: 'Feature',
          geometry: parsed,
          properties: {}
        }];
      } else {
        throw new Error('Invalid GeoJSON format. Must be FeatureCollection, Feature, or Geometry.');
      }

      // Deep clone original data so dictionary transformations can be reloaded/reapplied idempotently
      this.originalData = JSON.parse(JSON.stringify(parsed));
      this.featureCollection = {
        type: 'FeatureCollection',
        features: JSON.parse(JSON.stringify(features))
      };
      this.dataType = 'geojson';
      this.sourceName = sourceName;

      return this.getDataSummary();
    }

    /**
     * Load CSV text
     */
    loadCSV(csvString, sourceName = 'CSV Data') {
      if (csvString.charCodeAt(0) === 0xFEFF) {
        csvString = csvString.slice(1);
      }

      const parsed = Papa.parse(csvString, {
        header: true,
        skipEmptyLines: 'greedy',
        dynamicTyping: false
      });

      if (!parsed.data || parsed.data.length === 0) {
        throw new Error('CSV is empty or could not be parsed.');
      }

      const headers = parsed.meta.fields || Object.keys(parsed.data[0]);
      this.csvRows = parsed.data;
      this.csvHeaders = headers;
      this.sourceName = sourceName;
      this.dataType = 'csv';
      this.detectedColumns = GeoConverter.detectCsvColumns(headers);

      // Convert using default mode
      this.convertCsvToGeoJson(this.detectedColumns.defaultMode);
      return this.getDataSummary();
    }

    /**
     * Convert CSV rows to GeoJSON FeatureCollection with chosen configuration
     */
    convertCsvToGeoJson(mode = 'linestring', customMapping = {}) {
      const mapping = Object.assign({}, this.detectedColumns, customMapping);
      const rows = this.csvRows || [];
      const features = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        let geometry = null;

        if (mode === 'wkt' && mapping.wktCol && row[mapping.wktCol]) {
          geometry = GeoConverter.parseWKT(row[mapping.wktCol]);
        } else if (mode === 'linestring' && mapping.latCol && mapping.lonCol && mapping.endLatCol && mapping.endLonCol) {
          const lat1 = parseFloat(row[mapping.latCol]);
          const lon1 = parseFloat(row[mapping.lonCol]);
          const lat2 = parseFloat(row[mapping.endLatCol]);
          const lon2 = parseFloat(row[mapping.endLonCol]);

          if (!isNaN(lat1) && !isNaN(lon1) && !isNaN(lat2) && !isNaN(lon2)) {
            // Safeguard: If start and end coordinates are identical, fallback to Point
            // to prevent zero-length LineStrings which cause Google Earth coordinate errors
            if (lat1 === lat2 && lon1 === lon2) {
              geometry = {
                type: 'Point',
                coordinates: [lon1, lat1]
              };
            } else {
              geometry = {
                type: 'LineString',
                coordinates: [
                  [lon1, lat1],
                  [lon2, lat2]
                ]
              };
            }
          } else if (!isNaN(lat1) && !isNaN(lon1)) {
            // Fallback to point if end is missing
            geometry = {
              type: 'Point',
              coordinates: [lon1, lat1]
            };
          }
        } else if (mode === 'point_end' && mapping.endLatCol && mapping.endLonCol) {
          const lat = parseFloat(row[mapping.endLatCol]);
          const lon = parseFloat(row[mapping.endLonCol]);
          if (!isNaN(lat) && !isNaN(lon)) {
            geometry = { type: 'Point', coordinates: [lon, lat] };
          }
        } else {
          // Standard point start
          const lat = parseFloat(row[mapping.latCol]);
          const lon = parseFloat(row[mapping.lonCol]);
          if (!isNaN(lat) && !isNaN(lon)) {
            geometry = { type: 'Point', coordinates: [lon, lat] };
          }
        }

        if (geometry) {
          // Clone properties
          const properties = Object.assign({}, row);
          features.push({
            type: 'Feature',
            id: i + 1,
            geometry,
            properties
          });
        }
      }

      this.featureCollection = {
        type: 'FeatureCollection',
        features
      };

      return this.featureCollection;
    }

    /**
     * Apply data dictionary replacement to all features
     * Note: Data dictionary replacement is disabled for GeoJSON files
     * (GeoJSON is directly converted to KMZ as it already contains full definitions).
     */
    applyDictionary(dataDictionary) {
      if (!this.featureCollection || !dataDictionary) return { replacements: 0, affectedFeatures: 0 };

      let totalReplacements = 0;
      let affectedFeatures = 0;

      for (const feature of this.featureCollection.features) {
        if (!feature.properties) continue;
        const res = dataDictionary.transformProperties(feature.properties);
        if (res.replacementsCount > 0) {
          feature.properties = res.transformed;
          totalReplacements += res.replacementsCount;
          affectedFeatures++;
        }
      }

      return {
        replacements: totalReplacements,
        affectedFeatures: affectedFeatures,
        totalFeatures: this.featureCollection.features.length
      };
    }

    /**
     * Auto-detect best property to use as Placemark title
     */
    detectTitleField() {
      if (!this.featureCollection || this.featureCollection.features.length === 0) return null;
      const sampleProps = this.featureCollection.features[0].properties || {};
      const keys = Object.keys(sampleProps);
      const lowerKeys = keys.map(k => k.toLowerCase());

      const candidates = [
        'road name', 'road_name', 'name', 'title', 'section', 'landmark',
        'location id', 'location_id', 'segment id', '_segment_id', 'segment',
        'objectid', 'id'
      ];

      for (const cand of candidates) {
        const idx = lowerKeys.findIndex(k => k === cand || k.includes(cand));
        if (idx !== -1) return keys[idx];
      }

      return keys[0] || null;
    }


    /**
     * Extract bounding box [minLon, minLat, maxLon, maxLat]
     */
    getBounds() {
      if (!this.featureCollection || this.featureCollection.features.length === 0) return null;

      let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;

      const checkCoord = (coord) => {
        if (!coord || coord.length < 2) return;
        const [lon, lat] = coord;
        if (lon < minLon) minLon = lon;
        if (lat < minLat) minLat = lat;
        if (lon > maxLon) maxLon = lon;
        if (lat > maxLat) maxLat = lat;
      };

      const checkGeometry = (geom) => {
        if (!geom) return;
        if (geom.type === 'Point') {
          checkCoord(geom.coordinates);
        } else if (geom.type === 'LineString' || geom.type === 'MultiPoint') {
          geom.coordinates.forEach(checkCoord);
        } else if (geom.type === 'Polygon' || geom.type === 'MultiLineString') {
          geom.coordinates.forEach(ring => ring.forEach(checkCoord));
        } else if (geom.type === 'MultiPolygon') {
          geom.coordinates.forEach(poly => poly.forEach(ring => ring.forEach(checkCoord)));
        }
      };

      this.featureCollection.features.forEach(f => checkGeometry(f.geometry));

      if (minLon === Infinity) return null;
      return [minLon, minLat, maxLon, maxLat];
    }

    /**
     * Get summary of currently loaded data
     */
    getDataSummary() {
      if (!this.featureCollection) return null;
      const features = this.featureCollection.features;
      const geomTypes = Array.from(new Set(features.map(f => f.geometry ? f.geometry.type : 'None')));
      const sampleProps = features.length > 0 ? Object.keys(features[0].properties || {}) : [];
      const bounds = this.getBounds();

      return {
        sourceName: this.sourceName,
        dataType: this.dataType,
        featureCount: features.length,
        geometryTypes: geomTypes,
        propertyNames: sampleProps,
        detectedColumns: this.detectedColumns,
        bounds: bounds
      };
    }

    /**
     * Generate KML Document string
     */
    generateKML(options = {}) {
      if (!this.featureCollection) {
        throw new Error('No geospatial data loaded to export.');
      }

      const {
        documentName = this.sourceName || 'Geospatial Export',
        titleField = this.detectTitleField(),
        colorMode = 'irap_stars', // 'irap_stars', 'categorical', 'single'
        colorField = null,
        singleColor = '#2563EB',
        lineWidth = 4,
        pointRadius = 1.0,
        includeExtendedData = true
      } = options;

      // Build Styles Map
      const styles = [];
      const styleMap = new Map();

      // Helper to register a style
      const getStyleIdForColor = (hexColor) => {
        const cleanHex = hexColor.replace('#', '').toUpperCase();
        const styleId = `style_${cleanHex}`;
        if (!styleMap.has(styleId)) {
          const kmlLineColor = GeoConverter.hexToKmlColor(hexColor, 0.95);
          const kmlPolyColor = GeoConverter.hexToKmlColor(hexColor, 0.5);
          const kmlIconColor = GeoConverter.hexToKmlColor(hexColor, 1.0);

          styles.push(`
    <Style id="${styleId}">
      <LineStyle>
        <color>${kmlLineColor}</color>
        <width>${lineWidth}</width>
      </LineStyle>
      <PolyStyle>
        <color>${kmlPolyColor}</color>
        <fill>1</fill>
        <outline>1</outline>
      </PolyStyle>
      <IconStyle>
        <color>${kmlIconColor}</color>
        <scale>${pointRadius}</scale>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href>
        </Icon>
      </IconStyle>
      <BalloonStyle>
        <text><![CDATA[
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; max-height: 400px; overflow-y: auto; color: #1e293b;">
            <h3 style="margin: 0 0 10px 0; color: #0f172a; border-bottom: 2px solid #3b82f6; padding-bottom: 6px;">$[name]</h3>
            $[description]
          </div>
        ]]></text>
      </BalloonStyle>
    </Style>`);
          styleMap.set(styleId, true);
        }
        return styleId;
      };

      // Categorical color palette generator
      const categoricalPalette = [
        '#2563EB', '#7C3AED', '#DB2777', '#EA580C', '#16A34A',
        '#0891B2', '#4F46E5', '#9333EA', '#D97706', '#059669',
        '#E11D48', '#2563EB', '#475569'
      ];
      const categoryColorMap = new Map();
      let colorIdx = 0;

      const getCategoricalColor = (val) => {
        const key = String(val !== undefined && val !== null ? val : 'Unspecified');
        if (!categoryColorMap.has(key)) {
          categoryColorMap.set(key, categoricalPalette[colorIdx % categoricalPalette.length]);
          colorIdx++;
        }
        return categoryColorMap.get(key);
      };

      // Build Placemarks
      const placemarks = [];
      const features = this.featureCollection.features;

      for (let i = 0; i < features.length; i++) {
        const feature = features[i];
        const props = feature.properties || {};

        // Determine title
        let name = '';
        if (titleField && props[titleField] !== undefined) {
          name = String(props[titleField]);
        }
        if (!name) {
          name = `Feature ${i + 1}`;
        }

        // Determine style color
        let featureColor = singleColor;
        const normalizedMode = (colorMode === 'irap_stars' || !colorMode) ? 'vehicle' : colorMode;
        if (['vehicle', 'motorcycle', 'bicycle', 'pedestrian'].includes(normalizedMode)) {
          featureColor = GeoConverter.getStarRatingColor(feature, normalizedMode, singleColor);
        } else if (normalizedMode === 'none') {
          featureColor = singleColor;
        } else if (normalizedMode === 'categorical' && colorField) {
          featureColor = getCategoricalColor(props[colorField]);
        }
        const styleId = getStyleIdForColor(featureColor);

        // Build HTML table for description balloon
        const rowsHtml = [];
        for (const [k, v] of Object.entries(props)) {
          if (v === null || v === undefined || v === '') continue;
          rowsHtml.push(`
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 4px 8px; font-weight: 600; color: #475569; background-color: #f8fafc; width: 40%; vertical-align: top;">${GeoConverter.escapeXml(k)}</td>
              <td style="padding: 4px 8px; color: #0f172a; word-break: break-word;">${GeoConverter.escapeXml(v)}</td>
            </tr>`);
        }

        const descriptionHtml = `
          <table style="width: 100%; border-collapse: collapse; font-family: inherit; font-size: 12px; margin-top: 5px;">
            <tbody>
              ${rowsHtml.join('')}
            </tbody>
          </table>`;

        // Build ExtendedData if requested
        let extendedDataXml = '';
        if (includeExtendedData) {
          const dataTags = [];
          for (const [k, v] of Object.entries(props)) {
            dataTags.push(`        <Data name="${GeoConverter.escapeXml(k)}"><value>${GeoConverter.escapeXml(v)}</value></Data>`);
          }
          if (dataTags.length > 0) {
            extendedDataXml = `\n      <ExtendedData>\n${dataTags.join('\n')}\n      </ExtendedData>`;
          }
        }

        // Build Geometry XML
        const geomXml = GeoConverter.geometryToKML(feature.geometry);
        if (!geomXml) continue;

        placemarks.push(`
    <Placemark id="pm_${i + 1}">
      <name>${GeoConverter.escapeXml(name)}</name>
      <styleUrl>#${styleId}</styleUrl>
      <description><![CDATA[${descriptionHtml}]]></description>${extendedDataXml}
      ${geomXml}
    </Placemark>`);
      }

      // Assemble final KML
      return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2">
  <Document>
    <name>${GeoConverter.escapeXml(documentName)}</name>
    <open>1</open>
    <description><![CDATA[Exported with CSV/GeoJSON to KMZ Converter]]></description>
${styles.join('\n')}
    <Folder>
      <name>Layers</name>
${placemarks.join('\n')}
    </Folder>
  </Document>
</kml>`;
    }

    /**
     * Convert GeoJSON geometry to KML geometry XML
     */
    static geometryToKML(geom) {
      if (!geom || !geom.type || !geom.coordinates) return '';

      const coordString = (coords) => {
        // coords is [lon, lat, alt?]
        const alt = coords.length > 2 ? coords[2] : 0;
        return `${coords[0]},${coords[1]},${alt}`;
      };

      const lineCoordString = (coordArray) => {
        return coordArray.map(c => coordString(c)).join(' ');
      };

      switch (geom.type) {
        case 'Point':
          return `<Point>
        <coordinates>${coordString(geom.coordinates)}</coordinates>
      </Point>`;

        case 'LineString': {
          const coords = geom.coordinates || [];
          // Safeguard: Google Earth requires at least two distinct points for LineString
          const hasTwoUnique = coords.length >= 2 && coords.some((c, i) =>
            i > 0 && (c[0] !== coords[0][0] || c[1] !== coords[0][1])
          );
          if (!hasTwoUnique && coords.length > 0) {
            return `<Point>
        <coordinates>${coordString(coords[0])}</coordinates>
      </Point>`;
          }
          return `<LineString>
        <tessellate>1</tessellate>
        <coordinates>${lineCoordString(coords)}</coordinates>
      </LineString>`;
        }

        case 'MultiLineString':
          return `<MultiGeometry>
        ${(geom.coordinates || []).map(line => {
          const hasTwoUnique = line.length >= 2 && line.some((c, i) =>
            i > 0 && (c[0] !== line[0][0] || c[1] !== line[0][1])
          );
          if (!hasTwoUnique && line.length > 0) {
            return `<Point>
          <coordinates>${coordString(line[0])}</coordinates>
        </Point>`;
          }
          return `<LineString>
          <tessellate>1</tessellate>
          <coordinates>${lineCoordString(line)}</coordinates>
        </LineString>`;
        }).join('\n')}
      </MultiGeometry>`;

        case 'Polygon':
          return `<Polygon>
        <tessellate>1</tessellate>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>${lineCoordString(geom.coordinates[0] || [])}</coordinates>
          </LinearRing>
        </outerBoundaryIs>
        ${geom.coordinates.slice(1).map(inner => `
        <innerBoundaryIs>
          <LinearRing>
            <coordinates>${lineCoordString(inner)}</coordinates>
          </LinearRing>
        </innerBoundaryIs>`).join('\n')}
      </Polygon>`;

        case 'MultiPolygon':
          return `<MultiGeometry>
        ${geom.coordinates.map(poly => `
        <Polygon>
          <tessellate>1</tessellate>
          <outerBoundaryIs>
            <LinearRing>
              <coordinates>${lineCoordString(poly[0] || [])}</coordinates>
            </LinearRing>
          </outerBoundaryIs>
        </Polygon>`).join('\n')}
      </MultiGeometry>`;

        case 'MultiPoint':
          return `<MultiGeometry>
        ${geom.coordinates.map(pt => `
        <Point>
          <coordinates>${coordString(pt)}</coordinates>
        </Point>`).join('\n')}
      </MultiGeometry>`;

        default:
          return '';
      }
    }

    /**
     * Package KML into a KMZ (zipped) file using JSZip
     * Returns a Promise resolving to Blob or Uint8Array
     */
    async generateKMZ(kmlContent, isNode = false) {
      const ZipClass = typeof JSZip !== 'undefined' ? JSZip : require('jszip');
      const zip = new ZipClass();

      // Add doc.kml to root of KMZ
      zip.file('doc.kml', kmlContent);

      if (isNode || typeof window === 'undefined') {
        return await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
      }

      return await zip.generateAsync({
        type: 'blob',
        mimeType: 'application/vnd.google-earth.kmz',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });
    }
  }

  // Export to window or module
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = GeoConverter;
  } else {
    global.GeoConverter = GeoConverter;
  }
})(typeof window !== 'undefined' ? window : this);
