const fs = require('fs');
const path = require('path');
const Papa = require('../vendor/papaparse.min.js');
const JSZip = require('../vendor/jszip.min.js');

global.Papa = Papa;
global.JSZip = JSZip;

const DataDictionary = require('../js/data-dictionary.js');
const GeoConverter = require('../js/geo-converter.js');

async function test() {
  console.log('--- TEST 1: Load Data Dictionary ---');
  const dict = new DataDictionary();
  const findFile = (name, sampleName) => {
    if (sampleName) {
      const pSample = path.join(__dirname, '..', 'sample-data', sampleName);
      if (fs.existsSync(pSample)) return pSample;
    }
    const p0 = path.join(__dirname, '..', 'sample-data', name);
    if (fs.existsSync(p0)) return p0;
    const p1 = path.join(__dirname, '..', 'test-data', name);
    if (fs.existsSync(p1)) return p1;
    const p2 = path.join(__dirname, '..', name);
    if (fs.existsSync(p2)) return p2;
    return p0;
  };

  const dictCsv = fs.readFileSync(findFile('irap_data_dictionary.csv'), 'utf8');
  const dictSummary = dict.loadFromCSV(dictCsv, 'irap_data_dictionary.csv');
  console.log('Dict Summary:', dictSummary);

  console.log('\n--- TEST 2: Convert CSV (Sample Road Survey) with Dictionary Replacement ---');
  const csvFile = findFile('Catawba Core Data - Before - inc End-GPS.csv', 'sample_road_survey.csv');
  const csvContent = fs.readFileSync(csvFile, 'utf8');

  const converter = new GeoConverter();
  const csvSummary = converter.loadCSV(csvContent, 'Sample Road Survey');
  console.log('CSV Summary:', {
    featureCount: csvSummary.featureCount,
    geometryTypes: csvSummary.geometryTypes,
    detectedColumns: csvSummary.detectedColumns
  });

  const sampleBefore = Object.assign({}, converter.featureCollection.features[0].properties);
  console.log('Sample properties BEFORE dictionary replacement:');
  console.log({
    'Median type': sampleBefore['Median type'],
    'Road condition': sampleBefore['Road condition'],
    'Area type': sampleBefore['Area type'],
    'Roadside severity - driver-side object': sampleBefore['Roadside severity - driver-side object']
  });

  const replaceStats = converter.applyDictionary(dict);
  console.log('Dictionary replacement stats:', replaceStats);
  if (!Array.isArray(replaceStats.replacedFields) || replaceStats.replacedFields.length === 0) {
    throw new Error('Expected replacedFields to be a non-empty array');
  }

  const sampleAfter = converter.featureCollection.features[0].properties;
  console.log('Sample properties AFTER dictionary replacement:');
  console.log({
    'Median type': sampleAfter['Median type'],
    'Road condition': sampleAfter['Road condition'],
    'Area type': sampleAfter['Area type'],
    'Roadside severity - driver-side object': sampleAfter['Roadside severity - driver-side object']
  });

  console.log('\n--- TEST 3: Generate KML and KMZ ---');
  const kml = converter.generateKML({
    documentName: 'Sample Road Survey',
    colorMode: 'irap_stars'
  });
  console.log('KML Length:', kml.length);
  console.log('KML snippet:\n' + kml.slice(0, 500) + '...\n');

  const kmzBuffer = await converter.generateKMZ(kml, true);
  console.log('KMZ Buffer size in bytes:', kmzBuffer.length);
  fs.writeFileSync(path.join(__dirname, 'test_output.kmz'), kmzBuffer);
  console.log('Successfully wrote test_output.kmz!');

  console.log('\n--- TEST 4: Convert GeoJSON directly to KMZ (dictionary replacement disabled) ---');
  const geojsonFile = findFile('assetmapper-risk-attributes-231.geojson', 'sample_risk_attributes.geojson');
  const geojsonContent = fs.readFileSync(geojsonFile, 'utf8');

  const geoConverter2 = new GeoConverter();
  const geoSummary = geoConverter2.loadGeoJSON(geojsonContent, 'Risk Attributes');
  console.log('GeoJSON Summary:', {
    featureCount: geoSummary.featureCount,
    geometryTypes: geoSummary.geometryTypes,
    firstFeaturePropsCount: Object.keys(geoConverter2.featureCollection.features[0].properties).length
  });

  // Explicitly test that dictionary replacement is disabled for GeoJSON
  const geoDictRes = geoConverter2.applyDictionary(dict);
  console.log('GeoJSON dictionary call result (disabled/skipped):', geoDictRes);

  const kml2 = geoConverter2.generateKML({ documentName: 'Risk Attributes' });
  const kmzBuffer2 = await geoConverter2.generateKMZ(kml2, true);
  console.log('GeoJSON KMZ Buffer size in bytes:', kmzBuffer2.length);

  console.log('\n--- TEST 5: Star Rating Color & Theme Detection ---');
  const testFeature5 = {
    properties: { 'Vehicle Star Rating Raw': '5 star' }
  };
  const testFeature1 = {
    properties: { 'Vehicle Star Rating Raw': '1' }
  };
  const testFeature4 = { properties: { 'Vehicle Star Rating Raw': '4 star' } };
  const testFeature3 = { properties: { 'Vehicle Star Rating Raw': '3 star' } };
  const testFeature2 = { properties: { 'Vehicle Star Rating Raw': '2 star' } };
  const color5 = GeoConverter.getStarRatingColor(testFeature5, 'vehicle');
  const color4 = GeoConverter.getStarRatingColor(testFeature4, 'vehicle');
  const color3 = GeoConverter.getStarRatingColor(testFeature3, 'vehicle');
  const color2 = GeoConverter.getStarRatingColor(testFeature2, 'vehicle');
  const color1 = GeoConverter.getStarRatingColor(testFeature1, 'vehicle');
  console.log('Resolved 5 star color:', color5, '(expected #00C853)');
  console.log('Resolved 4 star color:', color4, '(expected #84CC16)');
  console.log('Resolved 3 star color:', color3, '(expected #FFD600)');
  console.log('Resolved 2 star color:', color2, '(expected #FF6D00)');
  console.log('Resolved 1 star color:', color1, '(expected #000000)');
  if (color5 !== '#00C853' || color4 !== '#84CC16' || color3 !== '#FFD600' || color2 !== '#FF6D00' || color1 !== '#000000') {
    throw new Error('Star rating color resolution test failed');
  }

  const themes = GeoConverter.detectAvailableStarThemes(converter.featureCollection);
  console.log('Detected themes in sample road survey:', themes);
  if (!themes.vehicle) {
    throw new Error('Expected sample road survey to have vehicle star rating theme');
  }

  const colorNoneDefault = GeoConverter.getStarRatingColor(testFeature5, 'none');
  console.log('Resolved none theme default color:', colorNoneDefault, '(expected #2563EB)');
  if (colorNoneDefault !== '#2563EB') {
    throw new Error(`Expected default line color for theme 'none' to be #2563EB, got ${colorNoneDefault}`);
  }

  console.log('\nALL TESTS PASSED!');
}


test().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
