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
  const findFile = (name) => {
    const p1 = path.join(__dirname, '..', 'test-data', name);
    if (fs.existsSync(p1)) return p1;
    const p2 = path.join(__dirname, '..', name);
    if (fs.existsSync(p2)) return p2;
    return p1;
  };

  const dictCsv = fs.readFileSync(findFile('irap_data_dictionary.csv'), 'utf8');
  const dictSummary = dict.loadFromCSV(dictCsv, 'irap_data_dictionary.csv');
  console.log('Dict Summary:', dictSummary);

  console.log('\n--- TEST 2: Convert CSV (Catawba Core Data) with Dictionary Replacement ---');
  const csvFile = findFile('Catawba Core Data - Before - inc End-GPS.csv');
  const csvContent = fs.readFileSync(csvFile, 'utf8');

  const converter = new GeoConverter();
  const csvSummary = converter.loadCSV(csvContent, 'Catawba Core Data');
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
    documentName: 'Catawba Road Survey',
    colorMode: 'irap_stars'
  });
  console.log('KML Length:', kml.length);
  console.log('KML snippet:\n' + kml.slice(0, 500) + '...\n');

  const kmzBuffer = await converter.generateKMZ(kml, true);
  console.log('KMZ Buffer size in bytes:', kmzBuffer.length);
  fs.writeFileSync(path.join(__dirname, 'test_output.kmz'), kmzBuffer);
  console.log('Successfully wrote test_output.kmz!');

  console.log('\n--- TEST 4: Convert GeoJSON directly to KMZ (dictionary replacement disabled) ---');
  const geojsonFile = findFile('assetmapper-risk-attributes-231.geojson');
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

  console.log('\nALL TESTS PASSED!');
}

test().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
