/**
 * EduPath KG (БилимГид) — Core Application Logic
 * Interactive Search, Filters, Chance Matcher (GPA, Minimum vs Recommended IELTS, TOEFL, Duolingo, SAT),
 * Comparison, Favorites, and Document Checklist.
 */

// Application State
const state = {
  lang: localStorage.getItem('edupath_lang') || 'ru',
  searchQuery: '',
  region: 'all',
  maxBudget: 70000,
  fullGrantOnly: false,
  direct11Only: false,
  noIeltsOnly: false,
  language: 'all',
  difficulty: 'all',
  sortBy: 'cheapest',
  activeView: 'catalog',
  favorites: new Set(JSON.parse(localStorage.getItem('edupath_favs') || '[]')),
  compareList: new Set(JSON.parse(localStorage.getItem('edupath_compare') || '[]')),
  chanceProfile: {
    gpa: null,
    examType: 'ielts', // 'ielts' | 'toefl' | 'duolingo' | 'none'
    examScore: null,
    satScore: null,
    budget: null,
    active: false
  },
  checklist: JSON.parse(localStorage.getItem('edupath_checklist') || '{}'),
  activeModalUniId: null,
  activeModalTab: 'overview'
};

// Helper: Translation lookup
function t(key) {
  const dict = I18N[state.lang] || I18N.ru;
  return dict[key] || I18N.ru[key] || key;
}

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  state.lang = SUPPORTED_LANGUAGES.includes(state.lang) ? state.lang : 'ru';
  reloadApplicationData();
});

async function reloadApplicationData() {
  const errorPanel = document.getElementById('data-load-error');
  if (errorPanel) {
    errorPanel.hidden = true;
    errorPanel.textContent = '';
  }

  try {
    await loadApplicationData();
    updateStaticTexts();
    renderCounters();
    renderActiveFilters();
    renderCatalog();
    updateCompareBar();
    renderUniversityRoute();
  } catch (error) {
    console.error('Unable to initialize EduPath KG data:', error);
    if (errorPanel) {
      errorPanel.hidden = false;
      errorPanel.innerHTML = `
        <p>${t('dataLoadError')}</p>
        <button type="button" class="btn-empty-reset" onclick="reloadApplicationData()">${t('retry')}</button>
      `;
    }
  }
}

// Update Static UI Texts based on current language
function updateStaticTexts() {
  document.documentElement.lang = state.lang === 'kg' ? 'ky' : state.lang;

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.textContent = t(key);
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    el.placeholder = t(key);
  });

  // Highlight active language button
  document.querySelectorAll('.lang-btn').forEach(btn => {
    if (btn.dataset.lang === state.lang) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  UNIVERSITIES_DATA.forEach(university => {
    university.name = university.nameLocalized[state.lang]
      || university.nameLocalized.ru
      || university.displayName;
  });

  // Update budget display
  const budgetValDisplay = document.getElementById('budget-val-display');
  if (budgetValDisplay) {
    budgetValDisplay.textContent = state.maxBudget >= 70000 
      ? t('budgetAny') 
      : `${t('budgetMax')} $${Number(state.maxBudget).toLocaleString()}`;
  }

  // Update navbar favorites count
  const favCountEl = document.getElementById('fav-count-badge');
  if (favCountEl) {
    favCountEl.textContent = state.favorites.size;
  }
}

// Render dynamic counters in Hero
function renderCounters() {
  const elTotal = document.getElementById('stat-total-unis');
  const elGrants = document.getElementById('stat-total-grants');
  const elCountries = document.getElementById('stat-total-countries');
  const elDirect11 = document.getElementById('stat-total-direct11');
  const elNoIelts = document.getElementById('stat-total-no-ielts');

  if (elTotal) elTotal.textContent = UNIVERSITIES_DATA.length;
  if (elGrants) elGrants.textContent = UNIVERSITIES_DATA.filter(u => u.fullGrantAvailable).length;
  
  const countries = new Set(UNIVERSITIES_DATA.map(u => u.country));
  if (elCountries) elCountries.textContent = countries.size;

  if (elDirect11) elDirect11.textContent = UNIVERSITIES_DATA.filter(u => u.accepts11thGradeDirectly).length;
  if (elNoIelts) elNoIelts.textContent = UNIVERSITIES_DATA.filter(u => u.ieltsRequired === false).length;

  const regionCounts = {
    all: UNIVERSITIES_DATA.length,
    europe: UNIVERSITIES_DATA.filter(u => u.region === 'europe').length,
    asia: UNIVERSITIES_DATA.filter(u => u.region === 'asia').length,
    middleEast: UNIVERSITIES_DATA.filter(u => u.region === 'middle_east').length,
    northAmerica: UNIVERSITIES_DATA.filter(u => u.region === 'north_america').length
  };
  Object.entries(regionCounts).forEach(([region, count]) => {
    const regionId = region.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
    const regionCountEl = document.getElementById(`region-count-${regionId}`);
    if (regionCountEl) regionCountEl.textContent = count;
  });
}

// Filter and Sort Engine
function getFilteredAndSortedUnis() {
  let list = UNIVERSITIES_DATA.slice();

  // Favorites only view
  if (state.activeView === 'favorites') {
    list = list.filter(u => state.favorites.has(u.id));
  }

  // Live Search Query
  if (state.searchQuery.trim()) {
    const q = state.searchQuery.toLowerCase().trim();
    list = list.filter(u => {
      const inName = u.name.toLowerCase().includes(q);
      const inNative = (u.nativeName || '').toLowerCase().includes(q);
      const inCountry = u.country.toLowerCase().includes(q);
      const inCity = u.city.toLowerCase().includes(q);
      const inMajors = u.popularMajors.some(m => String(m).toLowerCase().includes(q));
      const inGrants = u.grantNames.some(g => String(g).toLowerCase().includes(q));
      const inNote = (u.ieltsAlternativeNote || '').toLowerCase().includes(q);
      return inName || inNative || inCountry || inCity || inMajors || inGrants || inNote;
    });
  }

  // Region Filter
  if (state.region !== 'all') {
    list = list.filter(u => u.region === state.region);
  }

  // Budget Filter
  if (state.maxBudget < 70000) {
    list = list.filter(u => {
      if (u.tuitionUSD != null && u.tuitionUSD <= state.maxBudget) return true;
      if (state.fullGrantOnly && u.fullGrantAvailable) return true;
      return false;
    });
  }

  // 100% Full Grant Filter
  if (state.fullGrantOnly) {
    list = list.filter(u => u.fullGrantAvailable);
  }

  // 11-th Grade Direct Entry Filter
  if (state.direct11Only) {
    list = list.filter(u => u.accepts11thGradeDirectly);
  }

  // NO IELTS Required Filter
  if (state.noIeltsOnly) {
    list = list.filter(u => u.ieltsRequired === false);
  }

  // Language Filter
  if (state.language !== 'all') {
    list = list.filter(u => u.languages.some(l => l.toLowerCase().includes(state.language.toLowerCase())));
  }

  // Difficulty Filter
  if (state.difficulty !== 'all') {
    list = list.filter(u => u.difficulty === state.difficulty);
  }

  // Sorting
  list.sort((a, b) => {
    switch (state.sortBy) {
      case 'cheapest':
        return (a.tuitionUSD ?? Infinity) - (b.tuitionUSD ?? Infinity);
      case 'rank':
        return (a.qsRank ?? Infinity) - (b.qsRank ?? Infinity);
      case 'deadline':
        return new Date(a.deadlineDate) - new Date(b.deadlineDate);
      case 'name':
        return a.name.localeCompare(b.name);
      default:
        return 0;
    }
  });

  return list;
}

// Evaluate Chances with Minimum vs Recommended IELTS thresholds
function evaluateChance(uni) {
  if (!state.chanceProfile.active) return null;

  const { gpa, examType, examScore, satScore, budget } = state.chanceProfile;
  let academicScore = 0; // 0 to 100
  let feedback = [];

  // GPA Evaluation (scale 5.0)
  if (gpa !== null) {
    if (uni.minGPA == null) {
      academicScore += 25;
      feedback.push(t('verificationNote'));
    } else if (gpa >= uni.minGPA) {
      academicScore += 35;
    } else if (gpa >= uni.minGPA - 0.3) {
      academicScore += 20;
      feedback.push(`GPA ${gpa} (порог ${uni.minGPA})`);
    } else {
      academicScore += 10;
      feedback.push(`Требуется GPA от ${uni.minGPA}`);
    }
  } else {
    academicScore += 25;
  }

  // Language & Exam Evaluation (Minimum vs Recommended)
  if (examType === 'none') {
    // Student has NO language certificate
    if (uni.ieltsRequired === false) {
      academicScore += 40;
      feedback.push('✓ Подходит: IELTS не требуется (внутр. экзамен / язык)');
    } else if (uni.ieltsRequired == null || uni.minIELTS == null) {
      academicScore += 20;
      feedback.push(t('verificationNote'));
    } else {
      academicScore += 5;
      feedback.push(`Обязателен IELTS (мин. ${uni.minIELTS}, реком. ${uni.recommendedIELTS})`);
    }
  } else if (examType === 'ielts') {
    if (examScore !== null) {
      if (uni.ieltsRequired === false) {
        academicScore += 40;
        feedback.push(`IELTS ${examScore} — сильное преимущество!`);
      } else if (uni.ieltsRequired == null || uni.minIELTS == null) {
        academicScore += 25;
        feedback.push(t('verificationNote'));
      } else {
        const rec = uni.recommendedIELTS || uni.minIELTS;
        if (examScore >= rec) {
          academicScore += 40;
          feedback.push(`✓ IELTS ${examScore} — идеальный балл для гранта (реком. ${rec})`);
        } else if (examScore >= uni.minIELTS) {
          academicScore += 30;
          feedback.push(`✓ IELTS ${examScore} проходит порог ${uni.minIELTS} (для гранта лучше ${rec})`);
        } else if (examScore >= uni.minIELTS - 0.5) {
          academicScore += 15;
          feedback.push(`IELTS ${examScore} чуть ниже порога ${uni.minIELTS}`);
        } else {
          academicScore += 5;
          feedback.push(`Нужен IELTS от ${uni.minIELTS} (реком. ${rec})`);
        }
      }
    } else {
      academicScore += 25;
    }
  } else if (examType === 'toefl') {
    if (examScore !== null) {
      const minT = uni.minTOEFL;
      const recT = uni.recommendedTOEFL || minT;
      if (minT == null) {
        academicScore += 25;
        feedback.push(t('verificationNote'));
      } else if (examScore >= recT) {
        academicScore += 40;
        feedback.push(`✓ TOEFL ${examScore} — отличный балл для гранта`);
      } else if (examScore >= minT) {
        academicScore += 30;
        feedback.push(`✓ TOEFL ${examScore} принят (порог ${minT})`);
      } else {
        academicScore += 15;
        feedback.push(`Нужен TOEFL от ${minT}`);
      }
    } else {
      academicScore += 25;
    }
  } else if (examType === 'duolingo') {
    if (examScore !== null) {
      const minD = uni.minDuolingo;
      const recD = uni.recommendedDuolingo || minD;
      if (minD != null && examScore >= recD) {
        academicScore += 40;
        feedback.push(`✓ Duolingo ${examScore} — конкурентный балл`);
      } else if (minD != null && examScore >= minD) {
        academicScore += 30;
        feedback.push(`✓ Duolingo ${examScore} принят (порог ${minD})`);
      } else if (minD != null) {
        academicScore += 15;
        feedback.push(`Нужен Duolingo ${minD}+`);
      } else {
        academicScore += 25;
        feedback.push(t('verificationNote'));
      }
    } else {
      academicScore += 25;
    }
  }

  // SAT Evaluation
  if (satScore !== null && satScore > 0) {
    if (uni.minSAT) {
      const recSAT = uni.recommendedSAT || uni.minSAT;
      if (satScore >= recSAT) {
        academicScore += 25;
        feedback.push(`✓ Топ SAT ${satScore} (реком. ${recSAT})`);
      } else if (satScore >= uni.minSAT) {
        academicScore += 18;
        feedback.push(`✓ SAT ${satScore} проходит (реком. ${recSAT})`);
      } else {
        academicScore += 8;
        feedback.push(`SAT ${satScore} ниже рекомендуемого ${recSAT}`);
      }
    } else {
      if (satScore >= 1250) {
        academicScore += 15;
        feedback.push(`SAT ${satScore} — сильный бонус к досье`);
      }
    }
  } else {
    if (uni.minSAT && uni.minSAT >= 1350) {
      academicScore -= 10;
      feedback.push(`Рекомендуется сдать SAT (от ${uni.minSAT})`);
    } else {
      academicScore += 15;
    }
  }

  // Financial Fit
  let isOverBudget = false;
  if (budget !== null && uni.tuitionUSD != null) {
    if (budget === 0) {
      if (!uni.fullGrantAvailable && uni.tuitionUSD > 0) {
        isOverBudget = true;
      }
    } else if (uni.tuitionUSD > budget && !uni.fullGrantAvailable) {
      isOverBudget = true;
    }
  }

  if (isOverBudget) {
    return {
      status: 'over-budget',
      label: t('chanceOverBudget'),
      hint: `Контракт $${uni.tuitionUSD.toLocaleString()}/год при бюджете $${budget ? budget.toLocaleString() : 0}`
    };
  }

  if (academicScore >= 80) {
    return {
      status: 'high',
      label: t('chanceHigh'),
      hint: feedback.length ? feedback.slice(0, 2).join(' • ') : 'Высокие шансы на поступление и грант!'
    };
  } else if (academicScore >= 50) {
    return {
      status: 'moderate',
      label: t('chanceModerate'),
      hint: feedback.length ? feedback.slice(0, 2).join(' • ') : 'Хорошие шансы при сильном эссе'
    };
  } else {
    return {
      status: 'challenging',
      label: t('chanceChallenging'),
      hint: feedback.length ? feedback.slice(0, 2).join(' • ') : 'Высокий конкурс'
    };
  }
}

// Render University Cards Grid
function renderCatalog() {
  const container = document.getElementById('unis-container');
  const countEl = document.getElementById('search-results-count');
  if (!container) return;

  const universities = getFilteredAndSortedUnis();

  if (countEl) {
    countEl.innerHTML = `${t('statUnis')}: <span class="counter-highlight">${universities.length}</span> / ${UNIVERSITIES_DATA.length}`;
  }

  if (universities.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <h3 class="empty-title">${t('noUnisFound')}</h3>
        <p class="empty-desc">${t('noUnisFoundHint')}</p>
        <button class="btn-empty-reset" onclick="resetAllFilters()">${t('resetFilters')}</button>
      </div>
    `;
    return;
  }

  container.innerHTML = universities.map(uni => {
    const isFav = state.favorites.has(uni.id);
    const isCompared = state.compareList.has(uni.id);
    const chance = evaluateChance(uni);

    // Badges
    const badge11 = uni.accepts11thGradeDirectly === true
      ? `<span class="badge badge-direct-11">✓ ${t('badgeDirect11')}</span>`
      : uni.accepts11thGradeDirectly === false
        ? `<span class="badge badge-need-foundation">⚠ ${t('badgeNeedFoundation')}</span>`
        : `<span class="badge">${t('verificationNote')}</span>`;

    const badgeGrant = uni.fullGrantAvailable
      ? `<span class="badge badge-grant">★ ${t('badgeFullGrant')}</span>`
      : '';

    // No IELTS vs IELTS Requirement Badge
    const badgeIelts = uni.ieltsRequired === false
      ? `<span class="badge badge-no-ielts" title="${state.lang === 'ru' ? uni.ieltsAlternativeNote : t('detailsRussianOnly')}">✓ ${t('badgeNoIelts')}</span>`
      : uni.ieltsRequired === true && uni.minIELTS != null
        ? `<span class="badge badge-ielts-req">${t('ieltsMinBadge').replace('{min}', uni.minIELTS).replace('{recommended}', uni.recommendedIELTS ?? uni.minIELTS)}</span>`
        : `<span class="badge">${t('verificationNote')}</span>`;

    const badgeLang = `<span class="badge badge-lang">${getUniversityLanguageNames(uni.primaryLanguage)}</span>`;
    const sourceUrl = safeExternalUrl(uni.sourceUrl);
    const dataVerificationLabel = uni.verified ? t('dataVerified') : t('dataUnverified');
    const dataMeta = `
      <div class="card-data-meta">
        <span class="${uni.verified ? 'verified-label' : 'unverified-label'}">${dataVerificationLabel}</span>
        <span>${t('dataUpdated')}: ${getUniversityDisplayDate(uni.lastUpdated)}</span>
        ${sourceUrl ? `<a href="${sourceUrl}" target="_blank" rel="noopener noreferrer">${t('officialSource')}</a>` : ''}
        <a class="btn-report-error" href="${universityReportUrl(uni)}" target="_blank" rel="noopener noreferrer">${t('reportError')}</a>
      </div>
    `;

    // Chance Ribbon
    const chanceHtml = chance ? `
      <div class="card-chance-ribbon ${chance.status}">
        <span>● ${chance.label}</span>
        <span style="font-weight: 500; font-size: 0.72rem; opacity: 0.9;">${state.lang === 'ru' ? chance.hint : t('chanceHintLimited')}</span>
      </div>
    ` : '';

    const tuitionText = uni.tuitionUSD == null
      ? `<span class="cost-value">${t('verificationNote')}</span>`
      : uni.tuitionUSD === 0
      ? `<span class="cost-value free">${t('tuitionFree')}</span>`
      : `<span class="cost-value">$${uni.tuitionUSD.toLocaleString(getUniversityIntlLocale())} <span class="cost-sub">/ ${t('perYear')}</span></span>`;

    // Detailed exam specs text for card
    let examSummary;
    if (uni.ieltsRequired === false) {
      examSummary = `<span class="spec-val" style="color: #059669;" title="${state.lang === 'ru' ? uni.ieltsAlternativeNote : t('detailsRussianOnly')}">${t('noIeltsAlternativeShort')}</span>`;
    } else if (uni.ieltsRequired === true && uni.minIELTS != null) {
      examSummary = `<span class="spec-val">${t('ieltsMinBadge').replace('{min}', uni.minIELTS).replace('{recommended}', uni.recommendedIELTS ?? uni.minIELTS)}</span>`;
    } else {
      examSummary = `<span class="spec-val">${t('verificationNote')}</span>`;
    }

    const imageUrl = safeExternalUrl(uni.image);
    return `
      <article class="uni-card" data-id="${uni.id}">
        <div class="card-media">
          ${imageUrl ? `<img class="card-img" src="${imageUrl}" alt="${t('campusImageUnverified')}: ${uni.name}" loading="lazy">` : ''}
          <div class="card-media-overlay"></div>
          
          <div class="card-media-top">
            <span class="card-country-badge">${uni.flag} ${uni.city}, ${getUniversityCountryName(uni)}</span>
            <div class="card-actions-top">
              <button class="card-icon-btn ${isCompared ? 'is-compare' : ''}" 
                      title="${t('btnCompare')}" 
                      aria-label="${t('btnCompare')}: ${uni.name}"
                      onclick="toggleCompare('${uni.id}')">
                <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
              </button>
              <button class="card-icon-btn ${isFav ? 'is-fav' : ''}" 
                      title="${t('btnFavorite')}" 
                      aria-label="${t('btnFavorite')}: ${uni.name}"
                      onclick="toggleFavorite('${uni.id}')">
                <svg width="15" height="15" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
              </button>
            </div>
          </div>

          <div class="card-media-bottom">
            <span class="card-rank-badge">🏆 QS ${uni.qsRank == null ? t('verificationNote') : `#${uni.qsRank}`}</span>
            ${uni.acceptanceRate ? `<span class="card-acceptance-rate">${t('acceptanceRate')}: ${uni.acceptanceRate}</span>` : ''}
          </div>
        </div>

        ${chanceHtml}

        <div class="card-body">
          <h3 class="card-uni-name">${uni.name}</h3>
          <p class="card-uni-native">${uni.nativeName}</p>
          ${dataMeta}

          <div class="card-tags-row">
            ${badgeIelts}
            ${badge11}
            ${badgeGrant}
            ${badgeLang}
          </div>

          <div class="card-cost-box">
            <div class="cost-item">
              <span class="cost-caption">${t('tuitionLabel')}</span>
              ${tuitionText}
            </div>
            <div class="cost-item">
              <span class="cost-caption">${t('livingCostLabel')}</span>
              <span class="cost-value">${uni.livingCostUSDMonth.total == null ? t('verificationNote') : `~$${uni.livingCostUSDMonth.total} <span class="cost-sub">/ ${t('perMonth')}</span>`}</span>
            </div>
          </div>

          <div class="card-specs-row">
            <div class="spec-item" title="${t('minimumGpaTitle')}">
              <span>GPA:</span>
              <span class="spec-val">${uni.minGPA == null ? t('verificationNote') : `${uni.minGPA}/5.0`}</span>
            </div>
            <div class="spec-item" title="${t('languageRequirements')}">
              <span>IELTS:</span>
              ${examSummary}
            </div>
            <div class="spec-item" title="${t('flightFromBishkek')}">
              <span>✈ ${t('flightFromBishkek')}:</span>
              <span class="spec-val">${uni.livingCostUSDMonth.flightBishkek == null ? t('verificationNote') : `~$${uni.livingCostUSDMonth.flightBishkek}`}</span>
            </div>
          </div>

          <div class="card-footer">
            <div class="deadline-indicator">
              <span class="deadline-sub">${t('deadlineLabel')}</span>
              <span class="deadline-date">${getUniversityDeadlineLabel({ name: uni.nextDeadline, date: uni.deadlineDate })}</span>
            </div>
            <button class="btn-card-details" aria-label="${t('details')}: ${uni.name}" onclick="navigateToUniversityPage('${uni.id}')">
              <span>${t('btnDetails')}</span>
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
            </button>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

// Active Filter Chips Bar
function renderActiveFilters() {
  const container = document.getElementById('active-filters-chips');
  if (!container) return;

  const chips = [];

  if (state.searchQuery.trim()) {
    chips.push({ key: 'search', label: `${t('activeSearch')}: "${state.searchQuery}"` });
  }
  if (state.region !== 'all') {
    chips.push({ key: 'region', label: `${t('activeRegion')}: ${getRegionName(state.region)}` });
  }
  if (state.maxBudget < 70000) {
    chips.push({ key: 'budget', label: `${t('activeBudget')}: ${t('budgetMax')} $${Number(state.maxBudget).toLocaleString()}` });
  }
  if (state.fullGrantOnly) {
    chips.push({ key: 'grant', label: t('activeGrant') });
  }
  if (state.direct11Only) {
    chips.push({ key: '11grade', label: t('direct11Only') });
  }
  if (state.noIeltsOnly) {
    chips.push({ key: 'noielts', label: t('noIeltsOnly') });
  }
  if (state.language !== 'all') {
    chips.push({ key: 'lang', label: `${t('filterLanguage')}: ${getUniversityLanguageNames(state.language)}` });
  }
  if (state.difficulty !== 'all') {
    const difficultyLabels = {
      moderate: 'diffModerate',
      competitive: 'diffCompetitive',
      ultra_competitive: 'diffUltra'
    };
    chips.push({ key: 'difficulty', label: `${t('filterDifficulty')}: ${t(difficultyLabels[state.difficulty] || 'diffAll')}` });
  }
  if (state.activeView === 'favorites') {
    chips.push({ key: 'view', label: t('activeFavorites') });
  }

  if (chips.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <span>${t('activeFiltersLabel')}</span>
    ${chips.map(c => `
      <span class="active-chip">
        ${c.label}
        <span class="active-chip-remove" onclick="removeActiveFilter('${c.key}')">&times;</span>
      </span>
    `).join('')}
    <button class="btn-reset-filters" onclick="resetAllFilters()">${t('resetFilters')}</button>
  `;
}

function getRegionName(reg) {
  switch (reg) {
    case 'europe': return t('regionEurope');
    case 'asia': return t('regionAsia');
    case 'north_america': return t('regionNorthAmerica');
    case 'middle_east': return t('regionMiddleEast');
    default: return reg;
  }
}

function removeActiveFilter(key) {
  switch (key) {
    case 'search':
      state.searchQuery = '';
      const input = document.getElementById('search-input');
      if (input) input.value = '';
      break;
    case 'region':
      state.region = 'all';
      updateRegionChipsUI();
      break;
    case 'budget':
      state.maxBudget = 70000;
      const slider = document.getElementById('budget-range');
      if (slider) slider.value = 70000;
      updateStaticTexts();
      break;
    case 'grant':
      state.fullGrantOnly = false;
      const grantCheck = document.getElementById('filter-grant-full');
      if (grantCheck) grantCheck.checked = false;
      break;
    case '11grade':
      state.direct11Only = false;
      const gradeCheck = document.getElementById('filter-direct-11');
      if (gradeCheck) gradeCheck.checked = false;
      break;
    case 'noielts':
      state.noIeltsOnly = false;
      const ieltsCheck = document.getElementById('filter-no-ielts');
      if (ieltsCheck) ieltsCheck.checked = false;
      break;
    case 'lang':
      state.language = 'all';
      const langSel = document.getElementById('filter-language');
      if (langSel) langSel.value = 'all';
      break;
    case 'difficulty':
      state.difficulty = 'all';
      const diffSel = document.getElementById('filter-difficulty');
      if (diffSel) diffSel.value = 'all';
      break;
    case 'view':
      state.activeView = 'catalog';
      document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
      document.querySelector('[data-view="catalog"]')?.classList.add('active');
      break;
  }
  renderActiveFilters();
  renderCatalog();
}

function resetAllFilters() {
  state.searchQuery = '';
  state.region = 'all';
  state.maxBudget = 70000;
  state.fullGrantOnly = false;
  state.direct11Only = false;
  state.noIeltsOnly = false;
  state.language = 'all';
  state.difficulty = 'all';
  state.activeView = 'catalog';

  const sInput = document.getElementById('search-input');
  if (sInput) sInput.value = '';

  const bSlider = document.getElementById('budget-range');
  if (bSlider) bSlider.value = 70000;

  const gCheck = document.getElementById('filter-grant-full');
  if (gCheck) gCheck.checked = false;

  const dCheck = document.getElementById('filter-direct-11');
  if (dCheck) dCheck.checked = false;

  const iCheck = document.getElementById('filter-no-ielts');
  if (iCheck) iCheck.checked = false;

  const lSel = document.getElementById('filter-language');
  if (lSel) lSel.value = 'all';

  const diffSel = document.getElementById('filter-difficulty');
  if (diffSel) diffSel.value = 'all';

  updateRegionChipsUI();
  updateStaticTexts();
  renderActiveFilters();
  renderCatalog();
}

function updateRegionChipsUI() {
  document.querySelectorAll('.region-chip-btn').forEach(btn => {
    if (btn.dataset.region === state.region) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

// Toggle Favorite
function toggleFavorite(uniId) {
  if (state.favorites.has(uniId)) {
    state.favorites.delete(uniId);
  } else {
    state.favorites.add(uniId);
  }
  localStorage.setItem('edupath_favs', JSON.stringify(Array.from(state.favorites)));
  updateStaticTexts();
  renderCatalog();
}

// Toggle Compare
function toggleCompare(uniId) {
  if (state.compareList.has(uniId)) {
    state.compareList.delete(uniId);
  } else {
    if (state.compareList.size >= 4) {
      window.alert(t('compareMaxLimit'));
      return;
    }
    state.compareList.add(uniId);
  }
  localStorage.setItem('edupath_compare', JSON.stringify(Array.from(state.compareList)));
  updateCompareBar();
  renderCatalog();
}

// Update Floating Comparison Bar
function updateCompareBar() {
  const bar = document.getElementById('compare-floating-bar');
  const countEl = document.getElementById('compare-bar-count');
  const avatarsEl = document.getElementById('compare-bar-avatars');
  if (!bar) return;

  const count = state.compareList.size;
  if (count === 0) {
    bar.classList.remove('active');
    return;
  }

  bar.classList.add('active');
  if (countEl) countEl.textContent = count;

  if (avatarsEl) {
    const unis = UNIVERSITIES_DATA.filter(u => state.compareList.has(u.id));
    avatarsEl.innerHTML = unis.map(u => `<span class="compare-mini-flag" title="${u.name}">${u.flag}</span>`).join('');
  }
}

function clearCompare() {
  state.compareList.clear();
  localStorage.setItem('edupath_compare', JSON.stringify([]));
  updateCompareBar();
  renderCatalog();
}

// Open Compare Modal Table
function openCompareModal() {
  const modal = document.getElementById('compare-modal');
  const tableContent = document.getElementById('compare-table-container');
  if (!modal || !tableContent) return;

  const unis = UNIVERSITIES_DATA.filter(u => state.compareList.has(u.id));
  if (unis.length === 0) return;

  tableContent.innerHTML = `
    <table class="compare-table">
      <thead>
        <tr>
          <th>${t('compareParameter')}</th>
          ${unis.map(u => `
            <th>
              <div class="compare-col-header">
                <span style="font-size: 1.2rem;">${u.flag} ${getUniversityCountryName(u)}</span>
                <span style="font-size: 0.95rem; font-weight: 800;">${u.name}</span>
                <button class="btn-remove-compare-col" onclick="toggleCompare('${u.id}'); openCompareModal();">✕ ${t('compareRemove')}</button>
              </div>
            </th>
          `).join('')}
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${t('compareParamRank')}</td>
          ${unis.map(u => `<td><strong>QS ${u.qsRank == null ? t('verificationNote') : `#${u.qsRank}`}</strong>${u.acceptanceRate ? ` (${t('acceptanceRate')}: ${u.acceptanceRate})` : ''}</td>`).join('')}
        </tr>
        <tr>
          <td>${t('dataUpdated')}</td>
          ${unis.map(u => `<td><strong class="${u.verified ? 'verified-label' : 'unverified-label'}">${u.verified ? t('dataVerified') : t('dataUnverified')}</strong><br>${getUniversityDisplayDate(u.lastUpdated)}</td>`).join('')}
        </tr>
        <tr>
          <td>${t('compareParamExams')}</td>
          ${unis.map(u => `
            <td>
              <div style="margin-bottom: 6px;">
                ${u.ieltsRequired === false
                  ? `<span class="badge badge-no-ielts" style="font-size: 0.8rem;">${t('badgeNoIelts')}</span>`
                  : u.ieltsRequired === true && u.minIELTS != null
                    ? `<span class="badge badge-ielts-req" style="font-size: 0.8rem;">${t('ieltsMinBadge').replace('{min}', u.minIELTS).replace('{recommended}', u.recommendedIELTS ?? u.minIELTS)}</span>`
                    : `<span class="badge">${t('verificationNote')}</span>`}
              </div>
              <div style="font-size: 0.78rem; color: #1e3a8a; font-weight: 700; margin-bottom: 4px;">${state.lang === 'ru' ? u.ieltsNote || '' : t('detailsRussianOnly')}</div>
              <div style="font-size: 0.76rem; color: #334155;"><strong>${t('ieltsAlternatives')}:</strong> ${state.lang === 'ru' ? u.ieltsAlternativeNote || t('verificationNote') : t('detailsRussianOnly')}</div>
              ${u.minSAT ? `<div style="font-size: 0.78rem; margin-top: 4px;"><strong>SAT:</strong> ${t('minimumLabel')} ${u.minSAT} (${t('recommendedLabel')} ${u.recommendedSAT || u.minSAT}+)</div>` : ''}
              ${u.minTOEFL ? `<div style="font-size: 0.78rem;"><strong>TOEFL:</strong> ${t('minimumLabel')} ${u.minTOEFL} (${t('recommendedLabel')} ${u.recommendedTOEFL || u.minTOEFL}+)</div>` : ''}
              ${u.minDuolingo ? `<div style="font-size: 0.78rem;"><strong>Duolingo:</strong> ${t('minimumLabel')} ${u.minDuolingo} (${t('recommendedLabel')} ${u.recommendedDuolingo || u.minDuolingo}+)</div>` : ''}
            </td>
          `).join('')}
        </tr>
        <tr>
          <td>${t('compareParamTuition')}</td>
          ${unis.map(u => `
            <td>
              <strong>${u.tuitionUSD == null ? t('verificationNote') : u.tuitionUSD === 0 ? t('tuitionFree') : '$' + u.tuitionUSD.toLocaleString() + ' / ' + t('perYear')}</strong>
              <div style="font-size: 0.76rem; color: #64748b;">${state.lang === 'ru' ? u.tuitionLocal : ''}</div>
            </td>
          `).join('')}
        </tr>
        <tr>
          <td>${t('compareParamLiving')}</td>
          ${unis.map(u => `
            <td>
              <strong>${u.livingCostUSDMonth.total == null ? t('verificationNote') : `~$${u.livingCostUSDMonth.total} / ${t('perMonth')}`}</strong>
              <div style="font-size: 0.74rem; color: #64748b;">
                ${t('livingHousing')}: ${u.livingCostUSDMonth.housing == null ? t('verificationNote') : `~$${u.livingCostUSDMonth.housing}`}<br>
                ${t('livingFood')}: ${u.livingCostUSDMonth.food == null ? t('verificationNote') : `~$${u.livingCostUSDMonth.food}`}<br>
                ${t('flightFromBishkek')}: ${u.livingCostUSDMonth.flightBishkek == null ? t('verificationNote') : `~$${u.livingCostUSDMonth.flightBishkek}`}
              </div>
            </td>
          `).join('')}
        </tr>
        <tr>
          <td>${t('compareParam11thGrade')}</td>
          ${unis.map(u => `
            <td>
              ${u.accepts11thGradeDirectly === true
                ? `<span class="badge badge-direct-11">✓ ${t('badgeDirect11')}</span>`
                : u.accepts11thGradeDirectly === false
                  ? `<span class="badge badge-need-foundation">⚠ ${t('badgeNeedFoundation')}</span>`
                  : `<span class="badge">${t('verificationNote')}</span>`}
              <div style="font-size: 0.78rem; margin-top: 6px;">${state.lang === 'ru' ? u.admissionRouteDescription || t('verificationNote') : t('detailsRussianOnly')}</div>
            </td>
          `).join('')}
        </tr>
        <tr>
          <td>${t('compareParamGrants')}</td>
          ${unis.map(u => `
            <td>
              <strong>${state.lang === 'ru' ? u.grantType || t('verificationNote') : t('detailsRussianOnly')}</strong>
              <div style="font-size: 0.78rem; margin-top: 4px; color: #475569;">${state.lang === 'ru' ? u.grantDetails || t('verificationNote') : t('detailsRussianOnly')}</div>
            </td>
          `).join('')}
        </tr>
        <tr>
          <td>${t('compareParamLanguage')}</td>
          ${unis.map(u => `<td>${getUniversityLanguageNames(u.languages.join(', '))}</td>`).join('')}
        </tr>
        <tr>
          <td>${t('compareParamVisa')}</td>
          ${unis.map(u => `
            <td>
              ${state.lang === 'ru' ? `<strong>${u.visaGuideKG.embassyName || t('verificationNote')}</strong><div style="font-size: 0.76rem; color: #64748b; margin-top: 4px;">${u.visaGuideKG.address || t('verificationNote')}</div><div style="font-size: 0.76rem; margin-top: 4px;">${t('visaFinancialProof')}: ${u.visaGuideKG.bankProof || t('verificationNote')}</div>` : t('detailsRussianOnly')}
            </td>
          `).join('')}
        </tr>
        <tr>
          <td>${t('compareParamDeadline')}</td>
          ${unis.map(u => `<td><strong style="color: #d97706;">${getUniversityDeadlineLabel({ name: u.nextDeadline, date: u.deadlineDate })}</strong></td>`).join('')}
        </tr>
      </tbody>
    </table>
  `;

  modal.classList.add('open');
}

// Open IELTS Country Guide Modal
function openIeltsGuideModal() {
  const modal = document.getElementById('ielts-guide-modal');
  if (!modal) return;
  const content = document.getElementById('ielts-guide-content');
  const unavailable = document.getElementById('ielts-guide-unavailable');
  const russianContent = state.lang === 'ru';
  if (content) content.hidden = !russianContent;
  if (unavailable) unavailable.hidden = russianContent;
  modal.classList.add('open');
}

// Open University Detail Modal with Tabs & Interactive Checklist
function openUniModal(uniId) {
  const uni = UNIVERSITIES_DATA.find(u => u.id === uniId);
  if (!uni) return;

  state.activeModalUniId = uniId;
  state.activeModalTab = 'overview';

  const modal = document.getElementById('uni-detail-modal');
  if (!modal) return;

  // Header info
  document.getElementById('modal-uni-banner').src = uni.image;
  document.getElementById('modal-uni-title').textContent = uni.name;
  document.getElementById('modal-uni-country').innerHTML = `${uni.flag} ${uni.city}, ${uni.country} • QS #${uni.qsRank}`;

  // Populate Tab 1: Overview
  const tabOverview = document.getElementById('tab-pane-overview');
  if (tabOverview) {
    tabOverview.innerHTML = `
      <div class="alert-box ${!uni.ieltsRequired ? 'success' : 'info'}">
        <strong>${!uni.ieltsRequired ? '✓ IELTS НЕ ОБЯЗАТЕЛЕН' : 'Языковые требования для учебы на английском:'}</strong>
        <p style="margin-top: 4px;">${uni.ieltsNote || ''} ${uni.ieltsAlternativeNote}</p>
      </div>

      <div class="guide-section-block">
        <h4 class="guide-block-title">Об университете</h4>
        <p style="font-size: 0.95rem; color: #334155; line-height: 1.6; margin-bottom: 14px;">
          ${uni.name} (${uni.nativeName}) — ведущее учебное заведение в ${uni.country}, занимающее #${uni.qsRank} место в мировом рейтинге QS и #${uni.theRank} по версии Times Higher Education. Процент зачисления составляет около ${uni.acceptanceRate}.
        </p>
      </div>

      <div class="guide-section-block">
        <h4 class="guide-block-title">Калькулятор и детальные расходы в месяц</h4>
        <div class="cost-breakdown-grid">
          <div class="breakdown-card">
            <span class="breakdown-title">Обучение в год</span>
            <span class="breakdown-amount" style="color: ${uni.tuitionUSD === 0 ? '#059669' : '#1e3a8a'}">
              ${uni.tuitionUSD === 0 ? 'Бесплатно' : '$' + uni.tuitionUSD.toLocaleString()}
            </span>
            <span style="font-size: 0.74rem; color: #64748b;">${uni.tuitionLocal}</span>
          </div>
          <div class="breakdown-card">
            <span class="breakdown-title">Проживание / Общежитие</span>
            <span class="breakdown-amount">~$${uni.livingCostUSDMonth.housing}</span>
            <span style="font-size: 0.74rem; color: #64748b;">в месяц</span>
          </div>
          <div class="breakdown-card">
            <span class="breakdown-title">Питание и супермаркет</span>
            <span class="breakdown-amount">~$${uni.livingCostUSDMonth.food}</span>
            <span style="font-size: 0.74rem; color: #64748b;">в месяц</span>
          </div>
          <div class="breakdown-card">
            <span class="breakdown-title">Медицинская страховка</span>
            <span class="breakdown-amount">~$${uni.livingCostUSDMonth.insurance}</span>
            <span style="font-size: 0.74rem; color: #64748b;">в месяц</span>
          </div>
          <div class="breakdown-card">
            <span class="breakdown-title">Транспорт</span>
            <span class="breakdown-amount">~$${uni.livingCostUSDMonth.transport}</span>
            <span style="font-size: 0.74rem; color: #64748b;">в месяц</span>
          </div>
          <div class="breakdown-card">
            <span class="breakdown-title">✈ Перелет из Бишкека</span>
            <span class="breakdown-amount">~$${uni.livingCostUSDMonth.flightBishkek}</span>
            <span style="font-size: 0.74rem; color: #64748b;">в одну сторону</span>
          </div>
        </div>
      </div>

      <div class="guide-section-block">
        <h4 class="guide-block-title">Популярные направления обучения</h4>
        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
          ${uni.popularMajors.map(m => `<span class="badge badge-lang" style="font-size: 0.85rem; padding: 6px 12px;">🎓 ${m}</span>`).join('')}
        </div>
      </div>

      <div class="guide-section-block" style="margin-top: 20px;">
        <h4 class="guide-block-title">Официальные ресурсы</h4>
        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
          <a href="${uni.officialWebsite}" target="_blank" rel="noopener noreferrer" class="btn-card-details" style="text-decoration: none;">
            Официальный сайт вуза ↗
          </a>
          <a href="${uni.applicationPortal}" target="_blank" rel="noopener noreferrer" class="btn-calc-apply" style="text-decoration: none;">
            Портал подачи документов ↗
          </a>
        </div>
      </div>
    `;
  }

  // Populate Tab 2: Admission 11th Grade Route & Detailed Exam Requirements
  const tabAdmission = document.getElementById('tab-pane-admission');
  if (tabAdmission) {
    const alertType = uni.accepts11thGradeDirectly ? 'success' : 'warning';
    const alertTitle = uni.accepts11thGradeDirectly
      ? '✓ Прямое поступление после 11 класса школы Кыргызстана'
      : '⚠ Требуется дополнительный подготовительный год';

    tabAdmission.innerHTML = `
      <div class="alert-box ${alertType}">
        <strong>${alertTitle}</strong>
        <p style="margin-top: 6px;">${uni.admissionRouteDescription}</p>
      </div>

      <div class="guide-section-block">
        <h4 class="guide-block-title">Языковые стандарты и рекомендуемые баллы</h4>
        <table class="visa-details-table">
          <tr>
            <td>Требование к IELTS:</td>
            <td>
              ${!uni.ieltsRequired
                ? '<strong style="color: #059669;">✓ IELTS НЕ ОБЯЗАТЕЛЕН</strong>'
                : '<strong>Минимальный порог: ' + uni.minIELTS + '</strong> <br><strong style="color: #2563eb;">Рекомендуемый для 100% гранта: ' + uni.recommendedIELTS + '+</strong>'}
            </td>
          </tr>
          <tr>
            <td>Специфика языка обучения:</td>
            <td>${uni.ieltsNote || 'Обучение ведется на английском языке.'}</td>
          </tr>
          <tr>
            <td>Как поступить / альтернативы:</td>
            <td>${uni.ieltsAlternativeNote}</td>
          </tr>
          <tr>
            <td>Тест SAT (College Board):</td>
            <td>
              ${uni.minSAT
                ? '<strong>Минимум: ' + uni.minSAT + '</strong> (Рекомендуется: ' + (uni.recommendedSAT || uni.minSAT) + '+ для гранта)'
                : 'Не обязателен (но высокий балл усиливает шансы)'}
            </td>
          </tr>
          <tr>
            <td>Тест TOEFL iBT:</td>
            <td>${uni.minTOEFL ? '<strong>Минимум: ' + uni.minTOEFL + '</strong> (Рекомендуется: ' + (uni.recommendedTOEFL || uni.minTOEFL) + '+)' : 'Не требуется'}</td>
          </tr>
          <tr>
            <td>Duolingo English Test (DET):</td>
            <td>${uni.minDuolingo ? '<strong>Минимум: ' + uni.minDuolingo + '</strong> (Рекомендуется: ' + (uni.recommendedDuolingo || uni.minDuolingo) + '+)' : 'Не принимается'}</td>
          </tr>
          <tr>
            <td>Минимальный школьный GPA:</td>
            <td><strong>${uni.minGPA} из 5.0</strong> (Табель оценок за 10–11 классы)</td>
          </tr>
          <tr>
            <td>Ближайший дедлайн приема:</td>
            <td><strong style="color: #d97706;">${uni.nextDeadline} (${uni.intakeSeason})</strong></td>
          </tr>
        </table>
      </div>
    `;
  }

  // Populate Tab 3: Grants
  const tabGrants = document.getElementById('tab-pane-grants');
  if (tabGrants) {
    tabGrants.innerHTML = `
      <div class="alert-box ${uni.fullGrantAvailable ? 'success' : 'info'}">
        <strong>${uni.grantType}</strong>
        <p style="margin-top: 6px;">${uni.grantDetails}</p>
      </div>

      <div class="guide-section-block">
        <h4 class="guide-block-title">Доступные стипендиальные программы</h4>
        <ul style="padding-left: 20px; line-height: 1.8; color: #334155;">
          ${uni.grantNames.map(g => `<li><strong>${g}</strong></li>`).join('')}
        </ul>
      </div>

      <div class="guide-section-block">
        <h4 class="guide-block-title">Как получить финансирование</h4>
        <p style="font-size: 0.92rem; color: #475569; line-height: 1.6; margin-bottom: 16px;">
          Подача на стипендию обычно осуществляется одновременно с подачей документов в университет либо через национальные межправительственные платформы.
        </p>
        <a href="${uni.grantLink}" target="_blank" rel="noopener noreferrer" class="btn-calc-apply" style="display: inline-flex; align-items: center; gap: 6px; text-decoration: none;">
          Официальный портал стипендии ↗
        </a>
      </div>
    `;
  }

  // Populate Tab 4: Visa Guide KG
  const tabVisa = document.getElementById('tab-pane-visa');
  if (tabVisa) {
    const v = uni.visaGuideKG;
    tabVisa.innerHTML = `
      <div class="guide-section-block">
        <h4 class="guide-block-title">Где подавать на студенческую визу</h4>
        <table class="visa-details-table">
          <tr>
            <td>Дипломатическое представительство:</td>
            <td><strong>${v.embassyName}</strong></td>
          </tr>
          <tr>
            <td>Адрес в Бишкеке / регионе:</td>
            <td>${v.address}</td>
          </tr>
          <tr>
            <td>Тип визы / ВНЖ:</td>
            <td><strong>${v.visaType}</strong></td>
          </tr>
          <tr>
            <td>Подтверждение финансов:</td>
            <td>${v.bankProof}</td>
          </tr>
          <tr>
            <td>Сроки рассмотрения:</td>
            <td><strong>${v.processingWeeks}</strong></td>
          </tr>
        </table>
      </div>

      <div class="alert-box info">
        <strong>💡 Важная подсказка для граждан Кыргызстана:</strong>
        <p style="margin-top: 6px;">${v.keyTips}</p>
      </div>
    `;
  }

  // Populate Tab 5: Interactive Document Checklist
  renderChecklistTab(uni);

  // Switch to first tab UI
  document.querySelectorAll('.modal-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === 'overview');
  });
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === 'tab-pane-overview');
  });

  modal.classList.add('open');
}

// Render Interactive Checklist Tab with Live Progress
function renderChecklistTab(uni) {
  const tabChecklist = document.getElementById('tab-pane-checklist');
  if (!tabChecklist) return;

  const uniChecklist = state.checklist[uni.id] || {};
  const totalDocs = uni.documentRequirements.length;
  const doneDocs = uni.documentRequirements.filter(id => uniChecklist[id]).length;
  const percent = totalDocs > 0 ? Math.round((doneDocs / totalDocs) * 100) : 0;

  tabChecklist.innerHTML = `
    <div class="checklist-progress-bar-wrap">
      <div class="progress-header">
        <span>${t('checklistProgress')}</span>
        <span>${doneDocs} из ${totalDocs} (${percent}%)</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill" style="width: ${percent}%;"></div>
      </div>
    </div>

    <div class="checklist-items-list">
      ${uni.documentRequirements.map(docId => {
        const docDef = DOCUMENT_DEFINITIONS[docId] || {
          title: { ru: docId, kg: docId, en: docId },
          desc: { ru: '', kg: '', en: '' }
        };
        const isChecked = !!uniChecklist[docId];
        const docTitle = docDef.title[state.lang] || docDef.title.ru;
        const docDesc = docDef.desc[state.lang] || docDef.desc.ru;

        return `
          <label class="checklist-item ${isChecked ? 'done' : ''}" onclick="toggleChecklistItem('${uni.id}', '${docId}', event)">
            <input type="checkbox" class="checklist-checkbox" ${isChecked ? 'checked' : ''} onchange="toggleChecklistItem('${uni.id}', '${docId}', event)">
            <div class="checklist-content">
              <div class="checklist-item-title">${docTitle}</div>
              <div class="checklist-item-desc">${docDesc}</div>
            </div>
          </label>
        `;
      }).join('')}
    </div>
  `;
}

// Toggle individual document in checklist
function toggleChecklistItem(uniId, docId, event) {
  event.stopPropagation();
  if (!state.checklist[uniId]) {
    state.checklist[uniId] = {};
  }
  state.checklist[uniId][docId] = !state.checklist[uniId][docId];
  localStorage.setItem('edupath_checklist', JSON.stringify(state.checklist));

  const uni = UNIVERSITIES_DATA.find(u => u.id === uniId);
  if (uni) {
    renderChecklistTab(uni);
  }
}

// Close Modals
function closeAllModals() {
  document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('open'));
  state.activeModalUniId = null;
}

// Initialize Event Listeners
function initEventListeners() {
  // Language Switcher
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const lang = btn.dataset.lang;
      state.lang = lang;
      localStorage.setItem('edupath_lang', lang);
      updateStaticTexts();
      renderActiveFilters();
      renderCatalog();
      if (state.activeModalUniId) {
        openUniModal(state.activeModalUniId);
      }
      renderUniversityRoute();
      if (document.getElementById('ielts-guide-modal')?.classList.contains('open')) {
        openIeltsGuideModal();
      }
    });
  });

  // Navigation Links
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const view = link.dataset.view;
      if (view !== 'ielts_guide' && window.location.hash.startsWith('#/university/')) {
        window.location.hash = '#catalog-section';
      }
      if (view === 'favorites') {
        state.activeView = 'favorites';
      } else if (view === 'calculator') {
        state.activeView = 'catalog';
        document.getElementById('chance-calculator')?.scrollIntoView({ behavior: 'smooth' });
      } else if (view === 'ielts_guide') {
        openIeltsGuideModal();
        return;
      } else if (view === 'catalog') {
        state.activeView = 'catalog';
        document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
      }

      document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');

      renderActiveFilters();
      renderCatalog();
    });
  });

  // Search Input
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      renderActiveFilters();
      renderCatalog();
    });
  }

  // Region Buttons
  document.querySelectorAll('.region-chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.region = btn.dataset.region;
      updateRegionChipsUI();
      renderActiveFilters();
      renderCatalog();
    });
  });

  // Budget Slider
  const budgetRange = document.getElementById('budget-range');
  if (budgetRange) {
    budgetRange.addEventListener('input', (e) => {
      state.maxBudget = Number(e.target.value);
      updateStaticTexts();
      renderActiveFilters();
      renderCatalog();
    });
  }

  // 100% Grant Checkbox
  const grantFullCheck = document.getElementById('filter-grant-full');
  if (grantFullCheck) {
    grantFullCheck.addEventListener('change', (e) => {
      state.fullGrantOnly = e.target.checked;
      renderActiveFilters();
      renderCatalog();
    });
  }

  // 11-th Grade Direct Entry Checkbox
  const direct11Check = document.getElementById('filter-direct-11');
  if (direct11Check) {
    direct11Check.addEventListener('change', (e) => {
      state.direct11Only = e.target.checked;
      renderActiveFilters();
      renderCatalog();
    });
  }

  // NO IELTS Checkbox
  const noIeltsCheck = document.getElementById('filter-no-ielts');
  if (noIeltsCheck) {
    noIeltsCheck.addEventListener('change', (e) => {
      state.noIeltsOnly = e.target.checked;
      renderActiveFilters();
      renderCatalog();
    });
  }

  // Language Select
  const langSelect = document.getElementById('filter-language');
  if (langSelect) {
    langSelect.addEventListener('change', (e) => {
      state.language = e.target.value;
      renderActiveFilters();
      renderCatalog();
    });
  }

  // Difficulty Select
  const diffSelect = document.getElementById('filter-difficulty');
  if (diffSelect) {
    diffSelect.addEventListener('change', (e) => {
      state.difficulty = e.target.value;
      renderActiveFilters();
      renderCatalog();
    });
  }

  // Sort Select
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      state.sortBy = e.target.value;
      renderCatalog();
    });
  }

  // Chance Calculator: Exam type switcher
  const examTypeSelect = document.getElementById('calc-exam-type');
  const examScoreInput = document.getElementById('calc-exam-score');
  const examScoreWrap = document.getElementById('calc-exam-score-wrap');
  if (examTypeSelect) {
    examTypeSelect.addEventListener('change', (e) => {
      const type = e.target.value;
      if (type === 'none') {
        if (examScoreWrap) examScoreWrap.style.display = 'none';
      } else {
        if (examScoreWrap) examScoreWrap.style.display = 'block';
        if (type === 'ielts') {
          examScoreInput.placeholder = 'Напр. 6.5 или 7.0';
          examScoreInput.step = '0.5';
          examScoreInput.min = '4.0';
          examScoreInput.max = '9.0';
        } else if (type === 'toefl') {
          examScoreInput.placeholder = 'Напр. 85 или 100';
          examScoreInput.step = '1';
          examScoreInput.min = '40';
          examScoreInput.max = '120';
        } else if (type === 'duolingo') {
          examScoreInput.placeholder = 'Напр. 115 или 130';
          examScoreInput.step = '5';
          examScoreInput.min = '60';
          examScoreInput.max = '160';
        }
      }
    });
  }

  // Chance Calculator Action
  const btnCalcApply = document.getElementById('btn-calc-apply');
  if (btnCalcApply) {
    btnCalcApply.addEventListener('click', () => {
      const gpaInput = document.getElementById('calc-gpa');
      const examTypeVal = document.getElementById('calc-exam-type')?.value || 'ielts';
      const examScoreVal = document.getElementById('calc-exam-score')?.value;
      const satScoreVal = document.getElementById('calc-sat-score')?.value;
      const budgetInput = document.getElementById('calc-budget');

      const gpa = gpaInput && gpaInput.value ? parseFloat(gpaInput.value) : null;
      const examScore = examScoreVal ? parseFloat(examScoreVal) : null;
      const satScore = satScoreVal ? parseFloat(satScoreVal) : null;
      const budget = budgetInput && budgetInput.value !== '' ? parseFloat(budgetInput.value) : null;

      state.chanceProfile = {
        gpa,
        examType: examTypeVal,
        examScore,
        satScore,
        budget,
        active: true
      };
      renderCatalog();
      document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
    });
  }

  const btnCalcReset = document.getElementById('btn-calc-reset');
  if (btnCalcReset) {
    btnCalcReset.addEventListener('click', () => {
      document.getElementById('calc-gpa').value = '';
      if (document.getElementById('calc-exam-score')) document.getElementById('calc-exam-score').value = '';
      if (document.getElementById('calc-sat-score')) document.getElementById('calc-sat-score').value = '';
      document.getElementById('calc-budget').value = '';
      if (document.getElementById('calc-exam-type')) document.getElementById('calc-exam-type').value = 'ielts';
      if (examScoreWrap) examScoreWrap.style.display = 'block';

      state.chanceProfile = {
        gpa: null,
        examType: 'ielts',
        examScore: null,
        satScore: null,
        budget: null,
        active: false
      };
      renderCatalog();
    });
  }

  // Modal Tabs Switch
  document.querySelectorAll('.modal-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabKey = btn.dataset.tab;
      state.activeModalTab = tabKey;

      document.querySelectorAll('.modal-tab-btn').forEach(b => b.classList.toggle('active', b === btn));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.toggle('active', p.id === `tab-pane-${tabKey}`));
    });
  });

  // Mobile Filters Toggle
  const mobileBtn = document.getElementById('mobile-filter-trigger');
  const sidebar = document.getElementById('filters-sidebar');
  if (mobileBtn && sidebar) {
    mobileBtn.addEventListener('click', () => {
      sidebar.classList.toggle('mobile-open');
    });
  }

  // Close modals on backdrop click or Escape key
  document.querySelectorAll('.modal-backdrop').forEach(b => {
    b.addEventListener('click', (e) => {
      if (e.target === b) closeAllModals();
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllModals();
  });
}
