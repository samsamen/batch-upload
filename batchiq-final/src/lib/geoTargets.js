// Google Ads geo_target_country comes back as geoTargetConstants/<id>.
// Map the constant ids to ISO country codes. Covers Sam's European markets + common ones.
// Full list: https://developers.google.com/google-ads/api/data/geotargets
const GEO_CONSTANT_TO_CODE = {
  '2056': 'BE', // Belgium
  '2250': 'FR', // France
  '2246': 'FI', // Finland
  '2826': 'GB', // United Kingdom
  '2616': 'PL', // Poland
  '2528': 'NL', // Netherlands
  '2276': 'DE', // Germany
  '2752': 'SE', // Sweden
  '2578': 'NO', // Norway
  '2208': 'DK', // Denmark
  '2724': 'ES', // Spain
  '2380': 'IT', // Italy
  '2040': 'AT', // Austria
  '2756': 'CH', // Switzerland
  '2372': 'IE', // Ireland
  '2620': 'PT', // Portugal
  '2233': 'EE', // Estonia
  '2428': 'LV', // Latvia
  '2440': 'LT', // Lithuania
  '2203': 'CZ', // Czechia
  '2703': 'SK', // Slovakia
  '2348': 'HU', // Hungary
  '2642': 'RO', // Romania
  '2100': 'BG', // Bulgaria
  '2300': 'GR', // Greece
  '2191': 'HR', // Croatia
  '2705': 'SI', // Slovenia
  '2840': 'US', // United States
  '2124': 'CA', // Canada
  '2036': 'AU', // Australia
  '2554': 'NZ', // New Zealand
};

function geoConstantToCode(constantId) {
  if (!constantId) return null;
  return GEO_CONSTANT_TO_CODE[String(constantId)] || null;
}

module.exports = { GEO_CONSTANT_TO_CODE, geoConstantToCode };
