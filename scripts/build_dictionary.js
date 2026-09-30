const fs = require('fs');
const path = require('path');

const dictionaryData = [
  // Carriageway
  { item: 'Carriageway', code: 1, category: 'Carriageway A of a divided road' },
  { item: 'Carriageway', code: 2, category: 'Carriageway B of a divided road' },
  { item: 'Carriageway', code: 3, category: 'Undivided road' },
  { item: 'Carriageway', code: 4, category: 'Carriageway A of a motorcycle facility' },
  { item: 'Carriageway', code: 5, category: 'Carriageway B of a motorcycle facility' },
  { item: 'Carriageway label', code: 1, category: 'Carriageway A of a divided road' },
  { item: 'Carriageway label', code: 2, category: 'Carriageway B of a divided road' },
  { item: 'Carriageway label', code: 3, category: 'Undivided road' },
  { item: 'Carriageway label', code: 4, category: 'Carriageway A of a motorcycle facility' },
  { item: 'Carriageway label', code: 5, category: 'Carriageway B of a motorcycle facility' },

  // Upgrade cost
  { item: 'Upgrade cost', code: 1, category: 'Low' },
  { item: 'Upgrade cost', code: 2, category: 'Medium' },
  { item: 'Upgrade cost', code: 3, category: 'High' },

  // Observed flows
  ...['Motorcycle observed flow'].flatMap(item => [
    { item, code: 1, category: 'None' },
    { item, code: 2, category: '1 motorcycle' },
    { item, code: 3, category: '2 to 3 motorcycles' },
    { item, code: 4, category: '4 to 5 motorcycles' },
    { item, code: 5, category: '6 to 7 motorcycles' },
    { item, code: 6, category: '8+ motorcycles' }
  ]),
  ...['Bicycle observed flow'].flatMap(item => [
    { item, code: 1, category: 'None' },
    { item, code: 2, category: '1 bicycle' },
    { item, code: 3, category: '2 to 3 bicycles' },
    { item, code: 4, category: '4 to 5 bicycles' },
    { item, code: 5, category: '6 to 7 bicycles' },
    { item, code: 6, category: '8+ bicycles' }
  ]),
  ...[
    'Pedestrian observed flow across the road',
    'Ped observed flow across'
  ].flatMap(item => [
    { item, code: 1, category: 'None' },
    { item, code: 2, category: '1 pedestrian' },
    { item, code: 3, category: '2 to 3 pedestrians' },
    { item, code: 4, category: '4 to 5 pedestrians' },
    { item, code: 5, category: '6 to 7 pedestrians' },
    { item, code: 6, category: '8+ pedestrians' }
  ]),
  ...[
    'Pedestrian observed flow along the road driver-side',
    'Ped observed flow along – driver-side',
    'Ped observed flow along - driver-side'
  ].flatMap(item => [
    { item, code: 1, category: 'None' },
    { item, code: 2, category: '1 pedestrian' },
    { item, code: 3, category: '2 to 3 pedestrians' },
    { item, code: 4, category: '4 to 5 pedestrians' },
    { item, code: 5, category: '6 to 7 pedestrians' },
    { item, code: 6, category: '8+ pedestrians' }
  ]),
  ...[
    'Pedestrian observed flow along the road passenger-side',
    'Ped observed flow along – passenger-side',
    'Ped observed flow along - passenger-side'
  ].flatMap(item => [
    { item, code: 1, category: 'None' },
    { item, code: 2, category: '1 pedestrian' },
    { item, code: 3, category: '2 to 3 pedestrians' },
    { item, code: 4, category: '4 to 5 pedestrians' },
    { item, code: 5, category: '6 to 7 pedestrians' },
    { item, code: 6, category: '8+ pedestrians' }
  ]),

  // Land use
  ...[
    'Land use - driver-side',
    'Land use – driver-side',
    'Land use - passenger-side',
    'Land use – passenger-side'
  ].flatMap(item => [
    { item, code: 1, category: 'Undeveloped areas' },
    { item, code: 2, category: 'Farming and agricultural' },
    { item, code: 3, category: 'Residential' },
    { item, code: 4, category: 'Commercial' },
    { item, code: 5, category: 'Not Recorded' },
    { item, code: 6, category: 'Educational' },
    { item, code: 7, category: 'Industrial and manufacturing' }
  ]),

  // Area type
  ...['Area type'].flatMap(item => [
    { item, code: 1, category: 'Rural' },
    { item, code: 2, category: 'Urban' }
  ]),

  // Speed limits
  ...['Speed limit', 'Motorcycle speed limit', 'Truck speed limit'].flatMap(item => [
    { item, code: 1, category: '<30km/h' },
    { item, code: 3, category: '40km/h' },
    { item, code: 5, category: '50km/h' },
    { item, code: 7, category: '60km/h' },
    { item, code: 9, category: '70km/h' },
    { item, code: 11, category: '80km/h' },
    { item, code: 13, category: '90km/h' },
    { item, code: 15, category: '100km/h' },
    { item, code: 17, category: '110km/h' },
    { item, code: 19, category: '120km/h' },
    { item, code: 21, category: '130km/h' },
    { item, code: 23, category: '140km/h' },
    { item, code: 25, category: '≥150km/h' },
    { item, code: 31, category: '<20mph' },
    { item, code: 33, category: '30mph' },
    { item, code: 35, category: '40mph' },
    { item, code: 37, category: '50mph' },
    { item, code: 39, category: '60mph' },
    { item, code: 41, category: '70mph' },
    { item, code: 43, category: '80mph' },
    { item, code: 45, category: '≥90mph' }
  ]),

  // Differential speed limits
  ...['Differential speed limits', 'Speed differential'].flatMap(item => [
    { item, code: 1, category: 'Not present' },
    { item, code: 2, category: 'Present' }
  ]),

  // Median type
  ...['Median type'].flatMap(item => [
    { item, code: 1, category: 'Safety barrier - metal' },
    { item, code: 2, category: 'Safety barrier - concrete' },
    { item, code: 3, category: 'Physical median width ≥20m' },
    { item, code: 4, category: 'Physical median width 10 to <20m' },
    { item, code: 5, category: 'Physical median width 5 to <10m' },
    { item, code: 6, category: 'Physical median width 1 to <5m' },
    { item, code: 7, category: 'Physical median width 0 to <1m' },
    { item, code: 8, category: 'Continuous central turning lane' },
    { item, code: 9, category: 'Flexible posts' },
    { item, code: 10, category: 'Central hatching >1m' },
    { item, code: 11, category: 'Centre line' },
    { item, code: 12, category: 'Safety barrier - motorcycle friendly' },
    { item, code: 13, category: 'One way' },
    { item, code: 14, category: 'Wide centre line 0.3m to 1m' },
    { item, code: 15, category: 'Safety barrier - wire rope' }
  ]),

  // Rumble strips
  ...['Centreline rumble strips', 'Centre line rumble strips', 'Shoulder rumble strips'].flatMap(item => [
    { item, code: 1, category: 'Not present' },
    { item, code: 2, category: 'Present' }
  ]),

  // Roadside severity distances
  ...[
    'Roadside severity - driver-side distance',
    'Roadside severity – driver-side distance',
    'Roadside severity - passenger-side distance',
    'Roadside severity – passenger-side distance'
  ].flatMap(item => [
    { item, code: 1, category: '0 to <1m' },
    { item, code: 2, category: '1 to <5m' },
    { item, code: 3, category: '5 to <10m' },
    { item, code: 4, category: '≥10m' }
  ]),

  // Roadside severity objects
  ...[
    'Roadside severity - driver-side object',
    'Roadside severity – driver-side object',
    'Roadside severity - passenger-side object',
    'Roadside severity – passenger-side object'
  ].flatMap(item => [
    { item, code: 1, category: 'Safety barrier - metal' },
    { item, code: 2, category: 'Safety barrier - concrete' },
    { item, code: 3, category: 'Safety barrier - motorcycle friendly' },
    { item, code: 4, category: 'Safety barrier - wire rope' },
    { item, code: 5, category: 'Aggressive vertical face' },
    { item, code: 6, category: 'Upwards slope - roll over' },
    { item, code: 7, category: 'Upwards slope - no roll over' },
    { item, code: 8, category: 'Deep drainage ditch' },
    { item, code: 9, category: 'Downwards slope' },
    { item, code: 10, category: 'Cliff' },
    { item, code: 11, category: 'Tree ≥10cm' },
    { item, code: 12, category: 'Rigid sign, post or pole ≥10cm' },
    { item, code: 13, category: 'Rigid structure or building' },
    { item, code: 14, category: 'Semi-rigid structure or building' },
    { item, code: 15, category: 'Unprotected safety barrier end' },
    { item, code: 16, category: 'Low rigid object ≥20cm high' },
    { item, code: 17, category: 'No object' }
  ]),

  // Paved shoulder
  ...[
    'Paved shoulder - driver-side',
    'Paved shoulder – driver-side',
    'Paved shoulder - passenger-side',
    'Paved shoulder – passenger-side'
  ].flatMap(item => [
    { item, code: 1, category: 'Wide ≥2.4m' },
    { item, code: 2, category: 'Medium 1m to <2.4m' },
    { item, code: 3, category: 'Narrow 0m to <1m' },
    { item, code: 4, category: 'None' }
  ]),

  // Intersection type
  ...['Intersection type'].flatMap(item => [
    { item, code: 1, category: 'Merge lane' },
    { item, code: 2, category: 'Roundabout' },
    { item, code: 3, category: '3-leg with protected turn lane' },
    { item, code: 4, category: '3-leg' },
    { item, code: 5, category: '3-leg signalised with protected turn lane' },
    { item, code: 6, category: '3-leg signalised' },
    { item, code: 7, category: '4-leg with protected turn lane' },
    { item, code: 8, category: '4-leg' },
    { item, code: 9, category: '4-leg signalised with protected turn lane' },
    { item, code: 10, category: '4-leg signalised' },
    { item, code: 12, category: 'None' },
    { item, code: 13, category: 'Railway Crossing - passive' },
    { item, code: 14, category: 'Railway Crossing - active' },
    { item, code: 15, category: 'Median crossing point - informal' },
    { item, code: 16, category: 'Median crossing point - formal' },
    { item, code: 17, category: 'Mini roundabout' }
  ]),

  // Intersection channelisation
  ...['Intersection channelisation', 'Intersection channelization'].flatMap(item => [
    { item, code: 1, category: 'Not present' },
    { item, code: 2, category: 'Present' }
  ]),

  // Intersecting road volume
  ...['Intersecting road volume'].flatMap(item => [
    { item, code: 1, category: '≥15,000 vehicles' },
    { item, code: 2, category: '10,000 to 15,000 vehicles' },
    { item, code: 3, category: '5,000 to 10,000 vehicles' },
    { item, code: 4, category: '1,000 to 5,000 vehicles' },
    { item, code: 5, category: '100 to 1,000 vehicles' },
    { item, code: 6, category: '1 to 100 vehicles' },
    { item, code: 7, category: 'Not applicable' }
  ]),

  // Intersection quality
  ...['Intersection quality'].flatMap(item => [
    { item, code: 1, category: 'Adequate' },
    { item, code: 2, category: 'Poor' },
    { item, code: 3, category: 'Not applicable' }
  ]),

  // Property access points
  ...['Property access points'].flatMap(item => [
    { item, code: 1, category: 'Commercial Access ≥1' },
    { item, code: 2, category: 'Residential Access ≥3' },
    { item, code: 3, category: 'Residential Access <3' },
    { item, code: 4, category: 'None' }
  ]),

  // Number of lanes
  ...['Number of lanes'].flatMap(item => [
    { item, code: 1, category: 'One' },
    { item, code: 2, category: 'Two' },
    { item, code: 3, category: 'Three' },
    { item, code: 4, category: 'Four or more' },
    { item, code: 5, category: 'Two and one' },
    { item, code: 6, category: 'Three and two' }
  ]),

  // Lane width
  ...['Lane width'].flatMap(item => [
    { item, code: 1, category: 'Wide ≥3.25m' },
    { item, code: 2, category: 'Medium 2.75m to <3.25m' },
    { item, code: 3, category: 'Narrow 0m to <2.75m' }
  ]),

  // Curvature
  ...['Curvature'].flatMap(item => [
    { item, code: 1, category: 'Straight or gently curving' },
    { item, code: 2, category: 'Moderate' },
    { item, code: 3, category: 'Sharp' },
    { item, code: 4, category: 'Very sharp' }
  ]),

  // Quality of curve
  ...['Quality of curve'].flatMap(item => [
    { item, code: 1, category: 'Adequate' },
    { item, code: 2, category: 'Poor' },
    { item, code: 3, category: 'Not applicable' }
  ]),

  // Grade
  ...['Grade'].flatMap(item => [
    { item, code: 1, category: '0% to <7.5%' },
    { item, code: 4, category: '7.5% to <10%' },
    { item, code: 5, category: '≥10%' }
  ]),

  // Road condition
  ...['Road condition'].flatMap(item => [
    { item, code: 1, category: 'Good' },
    { item, code: 2, category: 'Medium' },
    { item, code: 3, category: 'Poor' }
  ]),

  // Skid resistance
  ...['Skid resistance / grip', 'Skid resistance'].flatMap(item => [
    { item, code: 1, category: 'Sealed – adequate' },
    { item, code: 2, category: 'Sealed – medium' },
    { item, code: 3, category: 'Sealed – poor' },
    { item, code: 4, category: 'Unsealed – adequate' },
    { item, code: 5, category: 'Unsealed – poor' }
  ]),

  // Delineation
  ...['Delineation'].flatMap(item => [
    { item, code: 1, category: 'Adequate' },
    { item, code: 2, category: 'Poor' }
  ]),

  // Street lighting
  ...['Street lighting'].flatMap(item => [
    { item, code: 1, category: 'Not present' },
    { item, code: 2, category: 'Present' }
  ]),

  // Pedestrian crossing facilities
  ...[
    'Pedestrian crossing facilities - inspected road',
    'Pedestrian crossing facilities – inspected road',
    'Pedestrian crossing facilities - intersecting road',
    'Pedestrian crossing facilities – side road'
  ].flatMap(item => [
    { item, code: 1, category: 'Grade separated facility' },
    { item, code: 2, category: 'Signalised crossing with refuge' },
    { item, code: 3, category: 'Signalised crossing' },
    { item, code: 4, category: 'Marked crossing with refuge' },
    { item, code: 5, category: 'Marked crossing only' },
    { item, code: 6, category: 'Refuge only' },
    { item, code: 7, category: 'No facility' },
    { item, code: 14, category: 'Raised marked crossing with refuge' },
    { item, code: 15, category: 'Raised marked crossing' },
    { item, code: 16, category: 'Raised unmarked crossing with refuge' },
    { item, code: 17, category: 'Raised unmarked crossing' }
  ]),

  // Pedestrian crossing quality
  ...['Pedestrian crossing quality', 'Pedestrian crossing facilities quality'].flatMap(item => [
    { item, code: 1, category: 'Adequate' },
    { item, code: 2, category: 'Poor' },
    { item, code: 3, category: 'Not applicable' }
  ]),

  // Pedestrian fencing
  ...['Pedestrian fencing'].flatMap(item => [
    { item, code: 1, category: 'Not present' },
    { item, code: 2, category: 'Present' }
  ]),

  // Speed management
  ...['Speed management / traffic calming', 'Speed management'].flatMap(item => [
    { item, code: 1, category: 'Not present' },
    { item, code: 2, category: 'Present' }
  ]),

  // Vehicle parking
  ...['Vehicle parking'].flatMap(item => [
    { item, code: 1, category: 'None' },
    { item, code: 2, category: 'One side' },
    { item, code: 3, category: 'Two side' }
  ]),

  // Sidewalks
  ...[
    'Sidewalk - driver-side',
    'Sidewalk – driver-side',
    'Sidewalk - passenger-side',
    'Sidewalk – passenger-side'
  ].flatMap(item => [
    { item, code: 1, category: 'Sidewalk with barrier' },
    { item, code: 2, category: 'Sidewalk ≥3m from road' },
    { item, code: 3, category: 'Sidewalk 1m to <3m from road' },
    { item, code: 4, category: 'Sidewalk 0m to <1m from road' },
    { item, code: 5, category: 'None' },
    { item, code: 6, category: 'Informal path ≥1m' },
    { item, code: 7, category: 'Informal path 0m to <1m' }
  ]),

  // Service road
  ...['Service road'].flatMap(item => [
    { item, code: 1, category: 'Not present' },
    { item, code: 2, category: 'Present' }
  ]),

  // Facilities for motorcycles
  ...['Facilities for motorised two wheelers', 'Facilities for motorcycles'].flatMap(item => [
    { item, code: 1, category: 'Motorcycle path two way with barrier' },
    { item, code: 2, category: 'Motorcycle path one way' },
    { item, code: 3, category: 'Motorcycle path one way with barrier' },
    { item, code: 4, category: 'Motorcycle path two way' },
    { item, code: 5, category: 'Motorcycle lane on roadway' },
    { item, code: 6, category: 'None' }
  ]),

  // Facilities for bicycles
  ...['Facilities for bicycles'].flatMap(item => [
    { item, code: 1, category: 'Segregated bicycle path with barrier' },
    { item, code: 2, category: 'Segregated bicycle path' },
    { item, code: 3, category: 'Dedicated bicycle lane on roadway' },
    { item, code: 4, category: 'None' },
    { item, code: 5, category: 'Extra wide outside ≥4.2m' },
    { item, code: 6, category: 'Signed shared roadway' },
    { item, code: 7, category: 'Shared use path' }
  ]),

  // Roadworks
  ...['Roadworks'].flatMap(item => [
    { item, code: 1, category: 'No road works' },
    { item, code: 2, category: 'Minor road works' },
    { item, code: 3, category: 'Major road works' }
  ]),

  // Sight distance
  ...['Sight distance'].flatMap(item => [
    { item, code: 1, category: 'Adequate' },
    { item, code: 2, category: 'Poor' }
  ]),

  // School zone warning
  ...['School zone warning'].flatMap(item => [
    { item, code: 1, category: 'School zone flashing beacons' },
    { item, code: 2, category: 'School zone static signs or road markings' },
    { item, code: 3, category: 'No school zone warning (school present)' },
    { item, code: 4, category: 'Not applicable (no school at the location)' }
  ]),

  // School zone crossing supervisor
  ...['School zone crossing supervisor'].flatMap(item => [
    { item, code: 1, category: 'School zone crossing supervisor present at school start and finish times' },
    { item, code: 2, category: 'School zone crossing supervisor not present' },
    { item, code: 3, category: 'Not applicable (no school at the location)' }
  ]),

  // Star ratings
  ...[
    'Vehicle Star Rating Raw',
    'Vehicle Star Rating Smoothed',
    'Motorcyclist Star Rating Raw',
    'Motorcyclist Star Rating Smoothed',
    'Pedestrian Star Rating Raw',
    'Pedestrian Star Rating Smoothed',
    'Bicyclist Star Rating Raw',
    'Bicyclist Star Rating Smoothed',
    'Vehicle Occupant Star Rating Policy Target',
    'Motorcycle Star Rating Policy Target',
    'Pedestrian Star Rating Policy Target',
    'Bicycle Star Rating Policy Target'
  ].flatMap(item => [
    { item, code: 0, category: 'Not applicable' },
    { item, code: 1, category: '1 Star' },
    { item, code: 2, category: '2 Star' },
    { item, code: 3, category: '3 Star' },
    { item, code: 4, category: '4 Star' },
    { item, code: 5, category: '5 Star' }
  ])
];

// Write CSV
const csvRows = ['Item,Code,Category'];
for (const entry of dictionaryData) {
  const cat = entry.category.includes(',') ? `"${entry.category}"` : entry.category;
  const item = entry.item.includes(',') ? `"${entry.item}"` : entry.item;
  csvRows.push(`${item},${entry.code},${cat}`);
}
fs.writeFileSync(path.join(__dirname, '..', 'irap_data_dictionary.csv'), csvRows.join('\n'), 'utf8');

// Ensure js directory exists
const jsDir = path.join(__dirname, '..', 'js');
if (!fs.existsSync(jsDir)) fs.mkdirSync(jsDir, { recursive: true });

// Write JS dictionary module
const jsContent = `/**
 * Built-in iRAP (International Road Assessment Programme) Coding Dictionary
 * Auto-generated from iRAP Coding Manual Quick Guide.
 */
window.IRAP_BUILTIN_DICTIONARY = ${JSON.stringify(dictionaryData, null, 2)};
`;

fs.writeFileSync(path.join(jsDir, 'irap-dictionary.js'), jsContent, 'utf8');
console.log(`Generated irap_data_dictionary.csv and js/irap-dictionary.js with ${dictionaryData.length} mappings!`);
