function escapeUniversityHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function universityReportUrl(university) {
  const url = new URL('https://github.com/Nurbol876/edupath/issues/new');
  url.searchParams.set('title', `${t('reportIssueTitle')}: ${university.displayName || university.name}`);
  url.searchParams.set(
    'body',
    `${t('reportUniversity')}: ${university.displayName || university.name}\n${t('reportId')}: ${university.id}\n${t('reportPage')}: ${window.location.origin}${window.location.pathname}#/university/${university.id}\n${t('officialSource')}: ${university.sourceUrl || t('verificationNote')}\n\n${t('reportDescription')}:\n`
  );
  return url.href;
}

function safeExternalUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch (error) {
    return null;
  }
}

function getUniversityDisplayDate(value) {
  if (!value) return '';
  const parts = value.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return escapeUniversityHtml(value);
  return new Intl.DateTimeFormat(getUniversityIntlLocale(), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])));
}

function getUniversityIntlLocale() {
  return state.lang === 'kg' ? 'ky-KG' : state.lang === 'en' ? 'en-US' : 'ru-RU';
}

function getUniversityCountryName(university) {
  if (!university.countryCode || typeof Intl.DisplayNames !== 'function') {
    return university.country;
  }
  try {
    return new Intl.DisplayNames([getUniversityIntlLocale()], { type: 'region' }).of(university.countryCode)
      || university.country;
  } catch (error) {
    return university.country;
  }
}

function getUniversityLanguageNames(languages) {
  const keys = {
    Английский: 'langEnglish',
    Немецкий: 'langGerman',
    Турецкий: 'langTurkish',
    Корейский: 'langKorean',
    Китайский: 'langChinese',
    Чешский: 'langCzech'
  };
  return String(languages || '')
    .split(/\s*[/,]\s*/)
    .map(language => keys[language] ? t(keys[language]) : language)
    .join(' / ');
}

function getUniversityDeadlineLabel(deadline) {
  if (!deadline || (!deadline.name && !deadline.date)) {
    return t('noDeadline');
  }
  if (state.lang === 'ru') {
    return `${deadline.name || ''}${deadline.date ? ` — ${deadline.date}` : ''}`;
  }
  const eventName = /\(([^)]+)\)/.exec(deadline.name || '');
  const date = getUniversityDisplayDate(deadline.date);
  return `${date || t('noDeadline')}${eventName ? ` (${eventName[1]})` : ''}`;
}

function renderUniversityPage(universityId) {
  const page = document.getElementById('university-page');
  const catalog = document.getElementById('catalog-section');
  const university = UNIVERSITIES_DATA.find(item => item.id === universityId);
  if (!page || !catalog) return;

  page.hidden = false;
  catalog.hidden = true;

  if (!university) {
    page.innerHTML = `
      <div class="university-not-found">
        <h1>${t('universityNotFound')}</h1>
        <a class="btn-card-details" href="#catalog-section">${t('backToCatalog')}</a>
      </div>
    `;
    return;
  }

  const reportUrl = universityReportUrl(university);
  const sourceUrl = safeExternalUrl(university.sourceUrl);
  const applicationPortalUrl = safeExternalUrl(university.applicationPortal);
  const name = escapeUniversityHtml(university.name);
  const image = safeExternalUrl(university.image);
  const costs = university.livingCostUSDMonth || {};
  const deadlines = Array.isArray(university.deadlines) ? university.deadlines : [];
  const grants = Array.isArray(university.grantNames) ? university.grantNames : [];
  const programs = Array.isArray(university.popularMajors) ? university.popularMajors : [];
  const documents = Array.isArray(university.documentRequirements) ? university.documentRequirements : [];
  const reportLink = `<a class="btn-report-error" href="${reportUrl}" target="_blank" rel="noopener noreferrer">${t('reportError')}</a>`;
  const sourceLink = sourceUrl
    ? `<a href="${sourceUrl}" target="_blank" rel="noopener noreferrer">${t('officialSource')} ↗</a>`
    : `<span class="data-source-missing">${t('verificationNote')}</span>`;
  const deadlineList = deadlines.length
    ? `<ul>${deadlines.map(item => `<li>${escapeUniversityHtml(getUniversityDeadlineLabel(item))}</li>`).join('')}</ul>`
    : `<p>${t('noDeadline')}</p>`;
  const grantList = grants.length
    ? `<ul>${grants.map(grant => `<li>${escapeUniversityHtml(grant)}</li>`).join('')}</ul>`
    : `<p>${t('verificationNote')}</p>`;
  const programList = programs.length
    ? `<div class="university-chip-list">${programs.map(program => `<span class="badge badge-lang">${escapeUniversityHtml(program)}</span>`).join('')}</div>`
    : `<p>${t('verificationNote')}</p>`;
  const documentList = documents.length
    ? `<ul>${documents.map(document => {
      const definition = DOCUMENT_DEFINITIONS[document];
      const title = definition && definition.title
        ? definition.title[state.lang] || definition.title.ru
        : document;
      return `<li>${escapeUniversityHtml(title)}</li>`;
    }).join('')}</ul>`
    : `<p>${t('verificationNote')}</p>`;
  const originalVisa = university.visaGuideKG;
  const visaLabelKeys = {
    embassyName: 'visaEmbassy',
    address: 'visaAddress',
    city: 'visaCity',
    visaType: 'visaType',
    bankProof: 'visaFinancialProof',
    processingWeeks: 'visaProcessingTime',
    keyTips: 'visaTips'
  };
  const visaRows = originalVisa && state.lang === 'ru'
    ? Object.entries(originalVisa).map(([key, value]) => `
        <tr><th scope="row">${t(visaLabelKeys[key] || key)}</th><td>${escapeUniversityHtml(value)}</td></tr>
      `).join('')
    : `<tr><td colspan="2">${t('detailsRussianOnly')}</td></tr>`;
  const description = university.admissionRouteDescription || university.grantDetails || t('verificationNote');
  const localizedDescription = state.lang === 'ru'
    ? escapeUniversityHtml(description)
    : t('detailsRussianOnly');
  const grantDetails = state.lang === 'ru'
    ? escapeUniversityHtml(university.grantDetails || t('verificationNote'))
    : t('detailsRussianOnly');
  const pageTitle = `${university.name} — EduPath KG`;
  const verificationLabel = university.verified ? t('dataVerified') : t('dataUnverified');
  const pageDescription = `${university.name}, ${university.city}, ${university.country}. ${verificationLabel}.`;

  document.title = pageTitle;
  const descriptionMeta = document.querySelector('meta[name="description"]');
  if (descriptionMeta) descriptionMeta.content = pageDescription;
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.content = pageTitle;
  const ogDescription = document.querySelector('meta[property="og:description"]');
  if (ogDescription) ogDescription.content = pageDescription;

  page.innerHTML = `
    <article class="university-page">
      <a class="university-back-link" href="#catalog-section">← ${t('backToCatalog')}</a>
      <header class="university-page-header">
        ${image ? `<img class="university-page-image" src="${image}" alt="${t('campusImageUnverified')}" loading="lazy">` : ''}
        <div class="university-page-heading">
          <p class="university-location">${escapeUniversityHtml(university.flag || '')} ${escapeUniversityHtml(university.city)}, ${escapeUniversityHtml(getUniversityCountryName(university))}</p>
          <h1>${name}</h1>
          <p>${escapeUniversityHtml(university.nativeName || '')}</p>
          <div class="university-page-actions">
            <button type="button" class="btn-card-details" onclick="shareUniversity('${university.id}')">${t('share')}</button>
            <button type="button" class="btn-card-details" aria-pressed="${state.favorites.has(university.id)}" onclick="toggleFavorite('${university.id}'); renderUniversityPage('${university.id}')">${t('btnFavorite')}</button>
            <button type="button" class="btn-card-details" aria-pressed="${state.compareList.has(university.id)}" onclick="toggleCompare('${university.id}'); renderUniversityPage('${university.id}')">${t('btnCompare')}</button>
            ${reportLink}
          </div>
        </div>
      </header>

      <div class="university-data-meta">
        <span>${t('dataUpdated')}: ${getUniversityDisplayDate(university.lastUpdated)}</span>
        <strong class="${university.verified ? 'verified-label' : 'unverified-label'}">${verificationLabel}</strong>
        <span>${university.verified ? '' : t('verificationNote')}</span>
        ${sourceLink}
      </div>

      ${image ? `<p class="university-image-note">${t('campusImageUnverified')}</p>` : ''}

      <section class="university-info-section">
        <h2>${t('tabOverview')}</h2>
        <p>${localizedDescription}</p>
        <div class="university-facts-grid">
          <div><strong>QS</strong><span>${university.qsRank ? `#${escapeUniversityHtml(university.qsRank)}` : t('verificationNote')}</span></div>
          <div><strong>${t('tuition')}</strong><span>${university.tuitionUSD == null ? t('verificationNote') : `$${Number(university.tuitionUSD).toLocaleString(getUniversityIntlLocale())}`}</span></div>
          <div><strong>${t('filterLanguage')}</strong><span>${escapeUniversityHtml(getUniversityLanguageNames((university.languages || []).join(', ')) || t('verificationNote'))}</span></div>
          <div><strong>${t('direct11Only')}</strong><span>${university.accepts11thGradeDirectly == null ? t('verificationNote') : university.accepts11thGradeDirectly ? t('badgeDirect11') : t('badgeNeedFoundation')}</span></div>
        </div>
      </section>

      <section class="university-info-section">
        <h2>${t('programs')}</h2>
        ${programList}
      </section>

      <section class="university-info-section">
        <h2>${t('livingCosts')}</h2>
        <div class="university-facts-grid">
          ${[['housing', 'livingHousing'], ['food', 'livingFood'], ['transport', 'livingTransport'], ['insurance', 'livingInsurance']].map(([key, label]) => `
            <div><strong>${t(label)}</strong><span>${costs[key] == null ? t('verificationNote') : `~$${Number(costs[key]).toLocaleString(getUniversityIntlLocale())} ${t('perMonth')}`}</span></div>
          `).join('')}
        </div>
      </section>

      <section class="university-info-section">
        <h2>${t('grantTypes')}</h2>
        ${grantList}
        <p><strong>${t('grantCoverage')}:</strong> ${grantDetails}</p>
      </section>

      <section class="university-info-section">
        <h2>${t('deadlines')}</h2>
        ${deadlineList}
      </section>

      <section class="university-info-section">
        <h2>${t('tabAdmission11')}</h2>
        <p>${t('requirementsIELTS')} ${university.ieltsRequired === false ? t('badgeNoIelts') : university.minIELTS == null ? t('verificationNote') : escapeUniversityHtml(university.minIELTS)}</p>
        <p>${t('calcGpaLabel')} ${university.minGPA == null ? t('verificationNote') : escapeUniversityHtml(university.minGPA)}</p>
        ${documentList}
      </section>

      <section class="university-info-section">
        <h2>${t('tabVisaKG')}</h2>
        <table class="visa-details-table"><tbody>${visaRows}</tbody></table>
      </section>

      <footer class="university-page-footer">
        ${sourceLink}
        ${applicationPortalUrl ? `<a href="${applicationPortalUrl}" target="_blank" rel="noopener noreferrer">${t('applicationPortal')} ↗</a>` : ''}
        ${reportLink}
      </footer>
    </article>
  `;
}

function renderUniversityRoute() {
  const route = window.location.hash.match(/^#\/university\/([^/?#]+)$/);
  const page = document.getElementById('university-page');
  const catalog = document.getElementById('catalog-section');
  if (!page || !catalog) return;

  if (route) {
    renderUniversityPage(decodeURIComponent(route[1]));
    return;
  }

  page.hidden = true;
  catalog.hidden = false;
  document.title = t('catalogTitle');
  const descriptionMeta = document.querySelector('meta[name="description"]');
  if (descriptionMeta) {
    descriptionMeta.content = t('catalogDescription');
  }
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.content = t('catalogTitle');
  const ogDescription = document.querySelector('meta[property="og:description"]');
  if (ogDescription) {
    ogDescription.content = t('catalogDescription');
  }
}

function navigateToUniversityPage(universityId) {
  window.location.hash = `/university/${encodeURIComponent(universityId)}`;
  if (window.location.hash === `#/university/${encodeURIComponent(universityId)}`) {
    renderUniversityRoute();
  }
}

async function shareUniversity(universityId) {
  const university = UNIVERSITIES_DATA.find(item => item.id === universityId);
  if (!university) return;
  const shareData = {
    title: university.name,
    text: `${university.name} — EduPath KG`,
    url: `${window.location.origin}${window.location.pathname}#/university/${encodeURIComponent(university.id)}`
  };
  try {
    if (navigator.share) {
      await navigator.share(shareData);
    } else if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(shareData.url);
      window.alert(t('shareLinkCopied'));
    } else {
      window.prompt(t('shareLinkCopyPrompt'), shareData.url);
    }
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error('Unable to share university link:', error);
      window.alert(t('reportFallback'));
    }
  }
}

window.addEventListener('hashchange', renderUniversityRoute);
