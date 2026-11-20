/**
 * EduPath KG (БилимГид) — Core Application Logic
 * Interactive Search, Filters, Chance Matcher, Comparison, Favorites, and Document Checklist.
 */

// Application State
const state = {
  lang: localStorage.getItem('edupath_lang') || 'ru',
  searchQuery: '',
  region: 'all',
  maxBudget: 70000,
  fullGrantOnly: false,
  direct11Only: false,
  language: 'all',
  difficulty: 'all',
  sortBy: 'cheapest',
  activeView: 'catalog', // 'catalog' | 'favorites'
  favorites: new Set(JSON.parse(localStorage.getItem('edupath_favs') || '[]')),
  compareList: new Set(JSON.parse(localStorage.getItem('edupath_compare') || '[]')),
  chanceProfile: {
    gpa: null,
    ielts: null,
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
  updateStaticTexts();
  renderCounters();
  renderActiveFilters();
  renderCatalog();
  updateCompareBar();
});

// Update Static UI Texts based on current language
function updateStaticTexts() {
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

  if (elTotal) elTotal.textContent = UNIVERSITIES_DATA.length;
  if (elGrants) elGrants.textContent = UNIVERSITIES_DATA.filter(u => u.fullGrantAvailable).length;
  
  const countries = new Set(UNIVERSITIES_DATA.map(u => u.country));
  if (elCountries) elCountries.textContent = countries.size;

  if (elDirect11) elDirect11.textContent = UNIVERSITIES_DATA.filter(u => u.accepts11thGradeDirectly).length;
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
      const inMajors = u.popularMajors.some(m => m.toLowerCase().includes(q));
      const inGrants = u.grantNames.some(g => g.toLowerCase().includes(q));
      return inName || inNative || inCountry || inCity || inMajors || inGrants;
    });
  }

  // Region Filter
  if (state.region !== 'all') {
    list = list.filter(u => u.region === state.region);
  }

  // Budget Filter
  if (state.maxBudget < 70000) {
    list = list.filter(u => {
      if (u.tuitionUSD <= state.maxBudget) return true;
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
        return a.tuitionUSD - b.tuitionUSD;
      case 'rank':
        return a.qsRank - b.qsRank;
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

// Calculate Chances for a given University
function evaluateChance(uni) {
  if (!state.chanceProfile.active) return null;

  const { gpa, ielts, budget } = state.chanceProfile;
  let academicScore = 0; // 0 to 100
  let feedback = [];

  // GPA Evaluation (scale 5.0)
  if (gpa !== null) {
    if (gpa >= uni.minGPA) {
      academicScore += 50;
    } else if (gpa >= uni.minGPA - 0.3) {
      academicScore += 30;
      feedback.push(`GPA ${gpa} чуть ниже порога ${uni.minGPA}`);
    } else {
      academicScore += 10;
      feedback.push(`Требуется GPA от ${uni.minGPA}`);
    }
  } else {
    academicScore += 40;
  }

  // IELTS Evaluation
  if (ielts !== null && uni.minIELTS) {
    if (ielts >= uni.minIELTS) {
      academicScore += 50;
    } else if (ielts >= uni.minIELTS - 0.5) {
      academicScore += 30;
      feedback.push(`IELTS ${ielts} (рекомендуется ${uni.minIELTS})`);
    } else {
      academicScore += 10;
      feedback.push(`Нужен IELTS ${uni.minIELTS}+`);
    }
  } else {
    academicScore += 40;
  }

  // Financial Fit
  let isOverBudget = false;
  if (budget !== null) {
    if (budget === 0) {
      // User only wants full grants
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
      hint: feedback.length ? feedback.join(' • ') : 'Отличный профиль для зачисления!'
    };
  } else if (academicScore >= 55) {
    return {
      status: 'moderate',
      label: t('chanceModerate'),
      hint: feedback.length ? feedback.join(' • ') : 'Хорошие шансы при сильном эссе'
    };
  } else {
    return {
      status: 'challenging',
      label: t('chanceChallenging'),
      hint: feedback.length ? feedback.join(' • ') : 'Высокий конкурс'
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
    const badge11 = uni.accepts11thGradeDirectly
      ? `<span class="badge badge-direct-11">✓ ${t('badgeDirect11')}</span>`
      : `<span class="badge badge-need-foundation">⚠ ${t('badgeNeedFoundation')}</span>`;

    const badgeGrant = uni.fullGrantAvailable
      ? `<span class="badge badge-grant">★ ${t('badgeFullGrant')}</span>`
      : '';

    const badgeLang = `<span class="badge badge-lang">${uni.primaryLanguage}</span>`;

    // Chance Ribbon
    const chanceHtml = chance ? `
      <div class="card-chance-ribbon ${chance.status}">
        <span>● ${chance.label}</span>
        <span style="font-weight: 500; font-size: 0.72rem; opacity: 0.9;">${chance.hint}</span>
      </div>
    ` : '';

    const tuitionText = uni.tuitionUSD === 0 
      ? `<span class="cost-value free">${t('tuitionFree')}</span>`
      : `<span class="cost-value">$${uni.tuitionUSD.toLocaleString()} <span class="cost-sub">/ год</span></span>`;

    return `
      <article class="uni-card" data-id="${uni.id}">
        <div class="card-media">
          <img class="card-img" src="${uni.image}" alt="${uni.name}" loading="lazy">
          <div class="card-media-overlay"></div>
          
          <div class="card-media-top">
            <span class="card-country-badge">${uni.flag} ${uni.city}, ${uni.country}</span>
            <div class="card-actions-top">
              <button class="card-icon-btn ${isCompared ? 'is-compare' : ''}" 
                      title="${t('btnCompare')}" 
                      onclick="toggleCompare('${uni.id}')">
                <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
              </button>
              <button class="card-icon-btn ${isFav ? 'is-fav' : ''}" 
                      title="${t('btnFavorite')}" 
                      onclick="toggleFavorite('${uni.id}')">
                <svg width="15" height="15" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
              </button>
            </div>
          </div>

          <div class="card-media-bottom">
            <span class="card-rank-badge">🏆 QS #${uni.qsRank}</span>
            <span class="card-acceptance-rate">Прием: ${uni.acceptanceRate}</span>
          </div>
        </div>

        ${chanceHtml}

        <div class="card-body">
          <h3 class="card-uni-name">${uni.name}</h3>
          <p class="card-uni-native">${uni.nativeName}</p>

          <div class="card-tags-row">
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
              <span class="cost-value">~$${uni.livingCostUSDMonth.total} <span class="cost-sub">/ мес</span></span>
            </div>
          </div>

          <div class="card-specs-row">
            <div class="spec-item" title="Минимальный GPA аттестата">
              <span>GPA:</span>
              <span class="spec-val">${uni.minGPA}/5.0</span>
            </div>
            <div class="spec-item" title="Требуемый балл IELTS">
              <span>IELTS:</span>
              <span class="spec-val">${uni.minIELTS || 'Не обязателен'}</span>
            </div>
            <div class="spec-item" title="Авиабилет из аэропорта Манас">
              <span>✈ Бишкек:</span>
              <span class="spec-val">~$${uni.livingCostUSDMonth.flightBishkek}</span>
            </div>
          </div>

          <div class="card-footer">
            <div class="deadline-indicator">
              <span class="deadline-sub">${t('deadlineLabel')}</span>
              <span class="deadline-date">${uni.nextDeadline}</span>
            </div>
            <button class="btn-card-details" onclick="openUniModal('${uni.id}')">
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
    chips.push({ key: 'search', label: `Поиск: "${state.searchQuery}"` });
  }
  if (state.region !== 'all') {
    chips.push({ key: 'region', label: `Регион: ${getRegionName(state.region)}` });
  }
  if (state.maxBudget < 70000) {
    chips.push({ key: 'budget', label: `Бюджет: до $${Number(state.maxBudget).toLocaleString()}` });
  }
  if (state.fullGrantOnly) {
    chips.push({ key: 'grant', label: `Только 100% гранты` });
  }
  if (state.direct11Only) {
    chips.push({ key: '11grade', label: `Прямое после 11 кл.` });
  }
  if (state.language !== 'all') {
    chips.push({ key: 'lang', label: `Язык: ${state.language}` });
  }
  if (state.difficulty !== 'all') {
    chips.push({ key: 'difficulty', label: `Сложность: ${state.difficulty}` });
  }
  if (state.activeView === 'favorites') {
    chips.push({ key: 'view', label: `Только избранное` });
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
      alert('Можно одновременно сравнивать до 4 университетов.');
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
          <th>Параметр сравнения</th>
          ${unis.map(u => `
            <th>
              <div class="compare-col-header">
                <span style="font-size: 1.2rem;">${u.flag} ${u.country}</span>
                <span style="font-size: 0.95rem; font-weight: 800;">${u.name}</span>
                <button class="btn-remove-compare-col" onclick="toggleCompare('${u.id}'); openCompareModal();">✕ Убрать</button>
              </div>
            </th>
          `).join('')}
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${t('compareParamRank')}</td>
          ${unis.map(u => `<td><strong>QS #${u.qsRank}</strong> (Прием: ${u.acceptanceRate})</td>`).join('')}
        </tr>
        <tr>
          <td>${t('compareParamTuition')}</td>
          ${unis.map(u => `
            <td>
              <strong>${u.tuitionUSD === 0 ? 'Бесплатно' : '$' + u.tuitionUSD.toLocaleString() + ' / год'}</strong>
              <div style="font-size: 0.76rem; color: #64748b;">${u.tuitionLocal}</div>
            </td>
          `).join('')}
        </tr>
        <tr>
          <td>${t('compareParamLiving')}</td>
          ${unis.map(u => `
            <td>
              <strong>~$${u.livingCostUSDMonth.total} / мес</strong>
              <div style="font-size: 0.74rem; color: #64748b;">
                Жилье: ~$${u.livingCostUSDMonth.housing}<br>
                Еда: ~$${u.livingCostUSDMonth.food}<br>
                Рейс из Бишкека: ~$${u.livingCostUSDMonth.flightBishkek}
              </div>
            </td>
          `).join('')}
        </tr>
        <tr>
          <td>${t('compareParam11thGrade')}</td>
          ${unis.map(u => `
            <td>
              ${u.accepts11thGradeDirectly 
                ? '<span class="badge badge-direct-11">✓ Прямое после 11 кл.</span>' 
                : '<span class="badge badge-need-foundation">⚠ Нужен 1 курс / Studienkolleg</span>'}
              <div style="font-size: 0.78rem; margin-top: 6px;">${u.admissionRouteDescription}</div>
            </td>
          `).join('')}
        </tr>
        <tr>
          <td>${t('compareParamGrants')}</td>
          ${unis.map(u => `
            <td>
              <strong>${u.grantType}</strong>
              <div style="font-size: 0.78rem; margin-top: 4px; color: #475569;">${u.grantDetails}</div>
            </td>
          `).join('')}
        </tr>
        <tr>
          <td>${t('compareParamMinScores')}</td>
          ${unis.map(u => `
            <td>
              <div>GPA: <strong>${u.minGPA} / 5.0</strong></div>
              <div>IELTS: <strong>${u.minIELTS || 'Не требуется'}</strong></div>
              ${u.minSAT ? `<div>SAT: <strong>${u.minSAT}+</strong></div>` : ''}
            </td>
          `).join('')}
        </tr>
        <tr>
          <td>${t('compareParamLanguage')}</td>
          ${unis.map(u => `<td>${u.languages.join(', ')}</td>`).join('')}
        </tr>
        <tr>
          <td>${t('compareParamVisa')}</td>
          ${unis.map(u => `
            <td>
              <strong>${u.visaGuideKG.embassyName}</strong>
              <div style="font-size: 0.76rem; color: #64748b; margin-top: 4px;">${u.visaGuideKG.address}</div>
              <div style="font-size: 0.76rem; margin-top: 4px;">Финансы: ${u.visaGuideKG.bankProof}</div>
            </td>
          `).join('')}
        </tr>
        <tr>
          <td>${t('compareParamDeadline')}</td>
          ${unis.map(u => `<td><strong style="color: #d97706;">${u.nextDeadline}</strong></td>`).join('')}
        </tr>
      </tbody>
    </table>
  `;

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

  // Populate Tab 2: Admission 11th Grade Route
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
        <h4 class="guide-block-title">Академические требования</h4>
        <table class="visa-details-table">
          <tr>
            <td>Минимальный школьный GPA:</td>
            <td><strong>${uni.minGPA} из 5.0</strong> (Табель оценок за 10–11 классы)</td>
          </tr>
          <tr>
            <td>Английский язык:</td>
            <td><strong>IELTS ${uni.minIELTS || '—'} / TOEFL ${uni.minTOEFL || '—'}</strong></td>
          </tr>
          ${uni.minSAT ? `
          <tr>
            <td>Тест SAT (College Board):</td>
            <td><strong>от ${uni.minSAT} баллов</strong> (Сдача в тест-центрах Silk Road или АУЦА в Бишкеке)</td>
          </tr>` : ''}
          <tr>
            <td>Внутренние экзамены:</td>
            <td>${uni.internalExamAvailable ? 'Доступен внутренний экзамен / онлайн-собеседование' : 'Вступительные экзамены отсутствуют (конкурс документов)'}</td>
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
    });
  });

  // Navigation Links
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const view = link.dataset.view;
      if (view === 'favorites') {
        state.activeView = 'favorites';
      } else if (view === 'calculator') {
        state.activeView = 'catalog';
        document.getElementById('chance-calculator')?.scrollIntoView({ behavior: 'smooth' });
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

  // Chance Calculator Inputs
  const btnCalcApply = document.getElementById('btn-calc-apply');
  if (btnCalcApply) {
    btnCalcApply.addEventListener('click', () => {
      const gpaInput = document.getElementById('calc-gpa');
      const ieltsInput = document.getElementById('calc-ielts');
      const budgetInput = document.getElementById('calc-budget');

      const gpa = gpaInput && gpaInput.value ? parseFloat(gpaInput.value) : null;
      const ielts = ieltsInput && ieltsInput.value ? parseFloat(ieltsInput.value) : null;
      const budget = budgetInput && budgetInput.value !== '' ? parseFloat(budgetInput.value) : null;

      if (gpa === null && ielts === null && budget === null) {
        alert('Пожалуйста, введите хотя бы один параметр для расчета.');
        return;
      }

      state.chanceProfile = { gpa, ielts, budget, active: true };
      renderCatalog();
      document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
    });
  }

  const btnCalcReset = document.getElementById('btn-calc-reset');
  if (btnCalcReset) {
    btnCalcReset.addEventListener('click', () => {
      document.getElementById('calc-gpa').value = '';
      document.getElementById('calc-ielts').value = '';
      document.getElementById('calc-budget').value = '';
      state.chanceProfile = { gpa: null, ielts: null, budget: null, active: false };
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
