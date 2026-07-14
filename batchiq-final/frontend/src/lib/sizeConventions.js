// Maps a market (country code) to the shoe-size system, measurement unit AND
// language that listings in that market should use. Shown as an always-visible
// guide so VAs don't put US sizes/inches/English on an EU store, etc.

const OVERRIDES = {
  US: { shoe: 'US', unit: 'inches', lang: 'English' },
  CA: { shoe: 'US', unit: 'cm', lang: 'English/French' },
  GB: { shoe: 'UK', unit: 'cm', lang: 'English' },
  UK: { shoe: 'UK', unit: 'cm', lang: 'English' },
  IE: { shoe: 'UK', unit: 'cm', lang: 'English' },
  AU: { shoe: 'AU', unit: 'cm', lang: 'English' },
  NZ: { shoe: 'AU', unit: 'cm', lang: 'English' },
  JP: { shoe: 'JP', unit: 'cm', lang: 'Japanese' },
  FR: { shoe: 'EU', unit: 'cm', lang: 'French' },
  BE: { shoe: 'EU', unit: 'cm', lang: 'Dutch/French' },
  NL: { shoe: 'EU', unit: 'cm', lang: 'Dutch' },
  DE: { shoe: 'EU', unit: 'cm', lang: 'German' },
  AT: { shoe: 'EU', unit: 'cm', lang: 'German' },
  CH: { shoe: 'EU', unit: 'cm', lang: 'German/French' },
  FI: { shoe: 'EU', unit: 'cm', lang: 'Finnish' },
  SE: { shoe: 'EU', unit: 'cm', lang: 'Swedish' },
  NO: { shoe: 'EU', unit: 'cm', lang: 'Norwegian' },
  DK: { shoe: 'EU', unit: 'cm', lang: 'Danish' },
  PL: { shoe: 'EU', unit: 'cm', lang: 'Polish' },
  CZ: { shoe: 'EU', unit: 'cm', lang: 'Czech' },
  ES: { shoe: 'EU', unit: 'cm', lang: 'Spanish' },
  IT: { shoe: 'EU', unit: 'cm', lang: 'Italian' },
  PT: { shoe: 'EU', unit: 'cm', lang: 'Portuguese' },
  IL: { shoe: 'EU', unit: 'cm', lang: 'Hebrew' },
};
// Fallback for any country not listed: EU sizes, CM, English copy.
const DEFAULT = { shoe: 'EU', unit: 'cm', lang: 'English' };

export function conventionFor(market) {
  if (!market) return DEFAULT;
  return OVERRIDES[String(market).toUpperCase()] || DEFAULT;
}

// Group a store's markets by identical convention (shoe+unit+lang).
export function conventionsForMarkets(markets) {
  const groups = {};
  for (const m of markets || []) {
    const c = conventionFor(m);
    const key = `${c.shoe}|${c.unit}|${c.lang}`;
    if (!groups[key]) groups[key] = { markets: [], shoe: c.shoe, unit: c.unit, lang: c.lang };
    groups[key].markets.push(String(m).toUpperCase());
  }
  return Object.values(groups);
}

export function hasMixedConventions(markets) {
  const set = new Set((markets || []).map(m => { const c = conventionFor(m); return `${c.shoe}|${c.unit}`; }));
  return set.size > 1;
}
