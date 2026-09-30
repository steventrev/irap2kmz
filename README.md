# irap2kmz

A client-side webapp that can apply a data dictionary to convert ViDA iRAP exported data (csv/geojson) to a KMZ file. Can optionally apply a data dictionary to convert categorical data to meaningful labels.

Can be self-hosted or accessed at [https://steventrev.github.io/irap2kmz/](https://steventrev.github.io/irap2kmz/)

AI Disclosure: This project was developed with the assistance of Google's **Gemini 3.8 Flash**.

1. **Inputs Geospatial Data** (`.geojson`, `.json`, or `.csv`):
   - Automatically detects coordinate columns (Latitude, Longitude) for Points.
   - Automatically detects Start & End coordinates (e.g. `Latitude`/`Longitude` and `End Latitude`/`End Longitude`) to render **Line Segments** (ideal for road safety surveys such as iRAP 100m segment data).
   - Also parses WKT (Well-Known Text) geometries.
2. **Translates Categorical Codes with a Data Dictionary CSV (Optional)**:
   - Replaces cryptic integer or shorthand codes (e.g., `11` for Median type, `13` for Roadside object, `1` for Road condition) with human-readable definitions (e.g., `Centre line`, `Rigid structure or building`, `Good`).
   - Includes iRAP-specific dictionary for 1-click application.
   - Supports custom data dictionaries with flexible column auto-detection and fuzzy attribute matching.
3. **Exports to Styled Google Earth KMZ / KML**:
   - Compresses into a `.kmz` file directly in the browser using JSZip.
   - Generates Google Earth Pro & ArcGIS Earth compatible `<Placemark>` features with clean HTML balloon tables and GIS `<ExtendedData>`.
   - Thematic styling: iRAP Star Rating color schema, categorical attribute coloring, or custom palette.


## 📂 Project Structure

```
├── index.html                 # Main application UI
├── css/
│   └── style.css              # Modern responsive CSS design system (Dark & Light theme)
├── js/
│   ├── app.js                 # Main UI controller, map bindings, and export actions
│   ├── geo-converter.js       # GeoJSON/CSV parsing, coordinate detection & KMZ generator
│   ├── data-dictionary.js     # Data dictionary parser, normalizer, and code replacer
│   └── irap-dictionary.js     # Pre-loaded iRAP Quick Coding Guide (541 mappings)
├── vendor/
│   ├── jszip.min.js           # Client-side KMZ archive compression
│   ├── papaparse.min.js       # Fast, robust CSV parser
│   ├── leaflet.js             # Interactive map preview
│   ├── leaflet.css            # Leaflet map styling
│   └── images/                # Leaflet marker assets
├── test-data/                 # Local private test & sample data (gitignored)
├── .github/workflows/
│   └── deploy.yml             # Automatic GitHub Pages deployment workflow
├── .gitignore                 # Excludes test-data/ and node_modules/
└── README.md                  # Documentation & usage guide
```

---

## 🛠️ Data Dictionary Formats

The tool automatically identifies the columns in your dictionary CSV:
| Item / Field | Code | Category / Definition |
| :--- | :--- | :--- |
| `Median type` | `11` | `Centre line` |
| `Median type` | `1` | `Safety barrier - metal` |
| `Road condition` | `1` | `Good` |
| `Roadside severity - driver-side object` | `13` | `Rigid structure or building` |
| `Area type` | `1` | `Rural` |

### Fuzzy Field Matching
The matcher intelligently normalizes attribute names, so `27 _ Median type`, `Median type (code)`, and `Median Type` all correctly match `Median type`.
