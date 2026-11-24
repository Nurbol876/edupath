const SUPPORTED_LANGUAGES = ['ru', 'kg', 'en'];
let COUNTRY_TEMPLATES = [];

async function fetchStaticJson(path) {
  const url = new URL(path, document.baseURI);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url.pathname}: HTTP ${response.status}`);
  }
  return response.json();
}

async function loadApplicationData() {
  const [universities, countryTemplates, ru, kg, en] = await Promise.all([
    fetchStaticJson('data/universities.json'),
    fetchStaticJson('data/country-templates.json'),
    fetchStaticJson('locales/ru.json'),
    fetchStaticJson('locales/kg.json'),
    fetchStaticJson('locales/en.json')
  ]);

  if (!Array.isArray(universities) || !Array.isArray(countryTemplates)) {
    throw new Error('University and country template data must be JSON arrays');
  }

  const seenIds = new Set();
  universities.forEach((university, index) => {
    if (!university || typeof university.id !== 'string' || seenIds.has(university.id)) {
      throw new Error(`Invalid or duplicate university id at index ${index}`);
    }
    if (!university.name || typeof university.name !== 'object') {
      throw new Error(`University ${university.id} has no localized name object`);
    }
    if (typeof university.lastUpdated !== 'string'
      || typeof university.verified !== 'boolean'
      || !Object.prototype.hasOwnProperty.call(university, 'sourceUrl')) {
      throw new Error(`University ${university.id} is missing required data metadata`);
    }
    seenIds.add(university.id);
  });

  I18N = { ru, kg, en };
  COUNTRY_TEMPLATES = countryTemplates;
  UNIVERSITIES_DATA = universities.map(normalizeUniversityRecord);
}

function normalizeUniversityRecord(record) {
  const localizedName = record.name && typeof record.name === 'object'
    ? record.name
    : record.nameLocalized || { ru: record.name || record.displayName, kg: record.name || record.displayName, en: record.name || record.displayName };
  const requirements = record.requirements || {};
  const ielts = requirements.ielts || {};
  const grantCoverage = record.grantCoverage || {};
  const livingCosts = record.livingCostUSDMonth || record.livingCostMonthly || {};
  const deadlines = Array.isArray(record.deadlines) ? record.deadlines : [];
  const firstDeadline = deadlines[0] || {};
  const visa = record.visaGuideKG || record.visaInformation || {};
  const programs = Array.isArray(record.popularMajors)
    ? record.popularMajors
    : Array.isArray(record.programs) ? record.programs : [];
  const grantTypes = Array.isArray(record.grantNames)
    ? record.grantNames
    : Array.isArray(record.grantTypes) ? record.grantTypes : [];
  const documents = Array.isArray(record.documentRequirements)
    ? record.documentRequirements
    : Array.isArray(requirements.documents) ? requirements.documents : [];

  return {
    ...record,
    nameLocalized: localizedName,
    displayName: record.displayName || localizedName.en || localizedName.ru,
    name: localizedName[state.lang] || localizedName.ru || record.displayName,
    nativeName: record.nativeName || localizedName.en || localizedName.ru || '',
    city: record.city || '',
    country: record.country || '',
    countryCode: record.countryCode || '',
    region: record.region || 'unknown',
    flag: record.flag || '',
    image: record.image || (Array.isArray(record.campusPhotos) && record.campusPhotos[0]) || '',
    qsRank: record.qsRank ?? null,
    acceptanceRate: record.acceptanceRate || '',
    tuitionUSD: record.tuitionUSD ?? null,
    tuitionLocal: record.tuitionLocal || '',
    fullGrantAvailable: record.fullGrantAvailable === true,
    grantNames: grantTypes,
    grantType: record.grantType || grantCoverage.type || '',
    grantDetails: record.grantDetails || grantCoverage.details || '',
    grantLink: record.grantLink || '',
    accepts11thGradeDirectly: record.accepts11thGradeDirectly ?? record.directAdmissionAfter11 ?? null,
    languages: Array.isArray(record.languages) ? record.languages : [],
    primaryLanguage: record.primaryLanguage || (Array.isArray(record.languages) ? record.languages.join(' / ') : ''),
    ieltsRequired: record.ieltsRequired ?? ielts.required ?? null,
    minIELTS: record.minIELTS ?? ielts.minimum ?? null,
    recommendedIELTS: record.recommendedIELTS ?? ielts.recommended ?? null,
    minTOEFL: record.minTOEFL ?? requirements.toefl?.minimum ?? null,
    recommendedTOEFL: record.recommendedTOEFL ?? requirements.toefl?.recommended ?? null,
    minDuolingo: record.minDuolingo ?? requirements.duolingo?.minimum ?? null,
    recommendedDuolingo: record.recommendedDuolingo ?? requirements.duolingo?.recommended ?? null,
    minSAT: record.minSAT ?? requirements.sat?.minimum ?? null,
    recommendedSAT: record.recommendedSAT ?? requirements.sat?.recommended ?? null,
    minGPA: record.minGPA ?? requirements.gpaMinimum ?? null,
    nextDeadline: record.nextDeadline || firstDeadline.name || firstDeadline.title || firstDeadline.date || '',
    deadlineDate: record.deadlineDate || firstDeadline.date || '',
    deadlines,
    documentRequirements: documents,
    visaGuideKG: visa,
    livingCostUSDMonth: {
      total: livingCosts.total ?? null,
      housing: livingCosts.housing ?? null,
      food: livingCosts.food ?? null,
      transport: livingCosts.transport ?? null,
      insurance: livingCosts.insurance ?? null,
      flightBishkek: livingCosts.flightBishkek ?? null
    },
    popularMajors: programs,
    officialWebsite: record.officialWebsite || record.website || '',
    applicationPortal: record.applicationPortal || '',
    difficulty: record.difficulty || 'unknown',
    intakeSeason: record.intakeSeason || '',
    verificationNote: record.verificationNote || ''
  };
}
