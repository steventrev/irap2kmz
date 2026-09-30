/**
 * Data Dictionary Parser & Replacer
 * Supports custom CSV dictionaries, wide format, key-value tables, and built-in iRAP dictionary.
 */
(function (global) {
  'use strict';

  class DataDictionary {
    constructor() {
      // Map of normalized_field_name -> Map of normalized_code -> descriptive_value
      this.fieldCodeMap = new Map();
      // Track original field names for display
      this.fieldOriginalNames = new Map();
      // List of all loaded mappings
      this.rawEntries = [];
      // Detected or configured column headers
      this.columnMapping = {
        fieldCol: null,
        codeCol: null,
        descCol: null
      };
      this.sourceName = '';
      this.totalEntriesCount = 0;
    }

    /**
     * Normalize a field / attribute name for fuzzy matching:
     * - "27 _ Median type" -> "median type"
     * - "Median type" -> "median type"
     * - "Roadside severity – driver-side object" -> "roadside severity driver side object"
     * - "Centreline rumble strips" -> "centreline rumble strips"
     */
    static normalizeFieldName(name) {
      if (!name) return '';
      let s = String(name).trim();
      // Remove leading number prefix like "27 _ " or "1. " or "Col 23 - "
      s = s.replace(/^(\d+\s*[_.-]\s*|\bcol\s*\d+\s*[-_.]?\s*)/i, '');
      // Remove trailing units or notes in parentheses like " (km)" or " (code)"
      s = s.replace(/\s*\([^)]*\)$/, '');
      // Normalize hyphens, dashes, underscores, and extra spaces
      s = s.replace(/[\u2010-\u2015\u2212_]/g, '-');
      s = s.toLowerCase().trim();
      // Replace multiple spaces/symbols with single space
      s = s.replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
      return s;
    }

    /**
     * Normalize code value for comparison (e.g. 1 vs "1" vs "01" vs 1.0)
     */
    static normalizeCode(code) {
      if (code === null || code === undefined) return '';
      let s = String(code).trim();
      // If numeric, standardize
      if (!isNaN(s) && s !== '') {
        const num = Number(s);
        return String(num);
      }
      return s.toLowerCase();
    }

    /**
     * Detect best candidate columns from headers
     */
    static detectColumns(headers) {
      const lowerHeaders = headers.map(h => String(h).trim().toLowerCase());

      const fieldCandidates = ['item', 'field', 'column', 'attribute', 'variable', 'property', 'name', 'field_name', 'item name', 'col name', 'header'];
      const codeCandidates = ['code', 'cat id', 'cat_id', 'value', 'key', 'id', 'val', 'coded value', 'category id', 'code id'];
      const descCandidates = ['category', 'description', 'definition', 'label', 'meaning', 'value label', 'desc', 'text', 'category name', 'title'];

      let fieldCol = headers[0] || '';
      let codeCol = headers[1] || '';
      let descCol = headers[2] || '';

      // Find field column
      for (const cand of fieldCandidates) {
        const idx = lowerHeaders.findIndex(h => h === cand || h.includes(cand));
        if (idx !== -1) {
          fieldCol = headers[idx];
          break;
        }
      }

      // Find code column
      for (const cand of codeCandidates) {
        const foundIndex = lowerHeaders.findIndex((h, i) => (h === cand || h.includes(cand)) && headers[i] !== fieldCol);
        if (foundIndex !== -1) {
          codeCol = headers[foundIndex];
          break;
        }
      }

      // Find description column
      for (const cand of descCandidates) {
        const foundIndex = lowerHeaders.findIndex((h, i) => (h === cand || h.includes(cand)) && headers[i] !== fieldCol && headers[i] !== codeCol);
        if (foundIndex !== -1) {
          descCol = headers[foundIndex];
          break;
        }
      }

      return { fieldCol, codeCol, descCol };
    }

    /**
     * Load from array of mapping objects { item, code, category }
     */
    loadFromEntries(entries, sourceName = 'Custom Dictionary') {
      this.clear();
      this.sourceName = sourceName;
      this.rawEntries = entries;

      for (const entry of entries) {
        const item = entry.item || entry.field || entry.Item || entry.Field || '';
        const code = entry.code !== undefined ? entry.code : (entry.Code !== undefined ? entry.Code : entry.value);
        const desc = entry.category || entry.description || entry.Category || entry.Description || entry.label;

        if (!item || code === undefined || desc === undefined) continue;

        this.addMapping(item, code, desc);
      }

      return this.getSummary();
    }

    /**
     * Load from CSV string using PapaParse
     */
    loadFromCSV(csvString, sourceName = 'Uploaded CSV') {
      this.clear();
      this.sourceName = sourceName;

      // Handle BOM
      if (csvString.charCodeAt(0) === 0xFEFF) {
        csvString = csvString.slice(1);
      }

      const parseResult = Papa.parse(csvString, {
        header: true,
        skipEmptyLines: 'greedy',
        dynamicTyping: false
      });

      if (!parseResult.data || parseResult.data.length === 0) {
        throw new Error('CSV file is empty or could not be parsed.');
      }

      const headers = parseResult.meta.fields || Object.keys(parseResult.data[0] || {});
      if (headers.length < 2) {
        throw new Error('Data dictionary CSV must contain at least 2 columns.');
      }

      // Auto-detect columns
      const detected = DataDictionary.detectColumns(headers);
      this.columnMapping = detected;

      for (const row of parseResult.data) {
        const item = row[detected.fieldCol];
        const code = row[detected.codeCol];
        const desc = row[detected.descCol];

        if (item === undefined || code === undefined || desc === undefined) continue;

        this.addMapping(item, code, desc);
        this.rawEntries.push({ item, code, category: desc });
      }

      return this.getSummary();
    }

    /**
     * Add single mapping rule
     */
    addMapping(item, code, desc) {
      const normField = DataDictionary.normalizeFieldName(item);
      const normCode = DataDictionary.normalizeCode(code);
      const cleanDesc = String(desc).trim();

      if (!normField || normCode === '') return;

      if (!this.fieldCodeMap.has(normField)) {
        this.fieldCodeMap.set(normField, new Map());
        this.fieldOriginalNames.set(normField, String(item).trim());
      }

      const codeMap = this.fieldCodeMap.get(normField);
      codeMap.set(normCode, cleanDesc);
      this.totalEntriesCount++;
    }

    /**
     * Clear loaded dictionary
     */
    clear() {
      this.fieldCodeMap.clear();
      this.fieldOriginalNames.clear();
      this.rawEntries = [];
      this.sourceName = '';
      this.totalEntriesCount = 0;
      this.columnMapping = { fieldCol: null, codeCol: null, descCol: null };
    }

    /**
     * Lookup replacement for a given field name and code value
     */
    lookup(fieldName, codeValue) {
      if (this.fieldCodeMap.size === 0) return null;
      if (codeValue === null || codeValue === undefined || codeValue === '') return null;

      const normField = DataDictionary.normalizeFieldName(fieldName);
      const codeMap = this.fieldCodeMap.get(normField);
      if (!codeMap) return null;

      const normCode = DataDictionary.normalizeCode(codeValue);
      if (codeMap.has(normCode)) {
        return codeMap.get(normCode);
      }

      return null;
    }

    /**
     * Transform a properties object, replacing categorical codes with descriptive strings
     * @param {Object} properties
     * @returns {Object} { transformed: Object, replacementsCount: Number, modifiedFields: Array }
     */
    transformProperties(properties) {
      if (!properties || typeof properties !== 'object') {
        return { transformed: {}, replacementsCount: 0, modifiedFields: [] };
      }

      const transformed = {};
      let replacementsCount = 0;
      const modifiedFields = [];

      for (const [key, val] of Object.entries(properties)) {
        const replacement = this.lookup(key, val);
        if (replacement !== null && replacement !== undefined) {
          transformed[key] = replacement;
          replacementsCount++;
          modifiedFields.push({ field: key, original: val, replaced: replacement });
        } else {
          transformed[key] = val;
        }
      }

      return { transformed, replacementsCount, modifiedFields };
    }

    /**
     * Get summary metadata of loaded dictionary
     */
    getSummary() {
      return {
        sourceName: this.sourceName,
        totalEntries: this.totalEntriesCount,
        distinctFields: this.fieldCodeMap.size,
        fieldNames: Array.from(this.fieldOriginalNames.values()),
        columnMapping: this.columnMapping
      };
    }
  }

  // Export to window or module
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataDictionary;
  } else {
    global.DataDictionary = DataDictionary;
  }
})(typeof window !== 'undefined' ? window : this);
