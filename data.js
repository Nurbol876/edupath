/**
 * Shared document definitions. University records and interface translations
 * are loaded from JSON files by data-loader.js.
 */

let UNIVERSITIES_DATA = [];

const DOCUMENT_DEFINITIONS = {
  attestat: {
    id: "attestat",
    icon: "award",
    title: {
      ru: "Школьный аттестат о среднем образовании (11 классов)",
      kg: "Орто билим жөнүндө мектеп аттестаты (11 класс)",
      en: "High School Diploma / Attestat (11 years)"
    },
    desc: {
      ru: "Оригинал и нотариальная копия вкладыша с оценками за 10–11 классы",
      kg: "10–11-класстардын баалары бар түп нускасы жана нотариалдык көчүрмөсү",
      en: "Original and certified copy of final grades transcript (grades 10-11)"
    }
  },
  translation_notary: {
    id: "translation_notary",
    icon: "file-text",
    title: {
      ru: "Нотариально заверенный перевод документов",
      kg: "Документтердин нотариалдык күбөлөндүрүлгөн котормосу",
      en: "Notarized Official Translation"
    },
    desc: {
      ru: "Перевод на английский/немецкий/турецкий в аккредитованном бюро переводов в Бишкеке/Оше",
      kg: "Бишкек же Оштогу котормо бюросунан англис/немис/түрк тилине которуу",
      en: "Translation into English/German/target language by certified translator"
    }
  },
  apostille: {
    id: "apostille",
    icon: "check-circle",
    title: {
      ru: "Апостиль на аттестат в Минюсте КР",
      kg: "КР Юстиция министрлигинен аттестатка апостиль",
      en: "Apostille from Ministry of Justice KR"
    },
    desc: {
      ru: "Штамп апостиля на оригинал документа или его нотариальную копию (ул. М. Ганди / ЦОН)",
      kg: "Документтин түп нускасына же нотариалдык көчүрмөсүнө апостиль мөөрү",
      en: "Apostille stamp for international legalization in Hague Convention member states"
    }
  },
  ielts: {
    id: "ielts",
    icon: "globe",
    title: {
      ru: "Языковой сертификат (IELTS / TOEFL / Duolingo / TestDaF)",
      kg: "Тил билүү сертификаты (IELTS / TOEFL / Duolingo / TestDaF)",
      en: "Language Proficiency Certificate"
    },
    desc: {
      ru: "Официальный сертификат экзаменационного центра (British Council / Nova в Бишкеке)",
      kg: "Бишкектеги экзамен борборлорунун расмий сертификаты",
      en: "Official test results from testing agency sent directly to the institution"
    }
  },
  sat: {
    id: "sat",
    icon: "bar-chart-2",
    title: {
      ru: "Стандартизированный тест SAT / ACT",
      kg: "SAT / ACT стандартизацияланган тести",
      en: "SAT / ACT Standardized Test"
    },
    desc: {
      ru: "Баллы Digital SAT (тестирование проводится в тест-центрах Silk Road / АУЦА в Бишкеке)",
      kg: "Digital SAT баллдары (Бишкекте Silk Road / АУЦА тест борборлорунда өткөрүлөт)",
      en: "Official score report sent via College Board"
    }
  },
  motivation_letter: {
    id: "motivation_letter",
    icon: "edit-3",
    title: {
      ru: "Мотивационное эссе (Statement of Purpose / Personal Essay)",
      kg: "Мотивациялык кат / эссе",
      en: "Motivation Letter / Personal Statement"
    },
    desc: {
      ru: "Обоснование выбора специальности, академических целей и связь с развитием Кыргызстана",
      kg: "Кесип тандоонун, максаттардын негиздемеси жана Кыргызстандын өнүгүшү менен байланышы",
      en: "Personal background, academic interests, career goals and fit for program"
    }
  },
  recommendations: {
    id: "recommendations",
    icon: "users",
    title: {
      ru: "Рекомендательные письма (2–3 шт.)",
      kg: "Сунуштама каттар (2–3 даана)",
      en: "Letters of Recommendation (2-3)"
    },
    desc: {
      ru: "Письма от учителей математики, английского или директора школы на бланке с печатью",
      kg: "Мектептин мугалимдеринен же директорунан мөөр басылган сунуштамалар",
      en: "Written on official school letterhead by high school teachers or mentors"
    }
  },
  cv: {
    id: "cv",
    icon: "user",
    title: {
      ru: "Академическое резюме (CV / Resume)",
      kg: "Академиялык резюме (CV)",
      en: "Academic CV / Resume"
    },
    desc: {
      ru: "Структурированный список достижений, волонтерства, олимпиад и проектов",
      kg: "Жетишкендиктердин, ыктыярдуулуктун, олимпиадалардын тизмеси",
      en: "Summary of academic awards, extracurriculars, volunteer work and skills"
    }
  },
  bank_statement: {
    id: "bank_statement",
    icon: "credit-card",
    title: {
      ru: "Банковская выписка о наличии средств",
      kg: "Каражаттын бар экендиги тууралуу банктык маалымкат",
      en: "Official Bank Statement / Proof of Funds"
    },
    desc: {
      ru: "Справка с мокрой печатью из банка КР (Демир, Оптима, KICB, MBank, РСК/Элдик) с переводом",
      kg: "КР банктарынан мөөр басылган маалымкат (Демир, Оптима, KICB ж.б.)",
      en: "Bank balance certificate showing sufficient funds to cover tuition and living"
    }
  },
  medical_086: {
    id: "medical_086",
    icon: "activity",
    title: {
      ru: "Медицинская справка (Форма 086/у или Health Certificate)",
      kg: "Медициналык маалымкат (086/у формасы)",
      en: "Medical Examination Certificate"
    },
    desc: {
      ru: "Результаты флюорографии, анализ на ВИЧ/гепатит и прививочная карта",
      kg: "Флюорография, ВИЧ/гепатит анализдери жана эмдөө картасы",
      en: "Chest X-ray, infectious disease screening and vaccination record"
    }
  },
  tunduk_police: {
    id: "tunduk_police",
    icon: "shield",
    title: {
      ru: "Справка о несудимости (портал «Түндүк»)",
      kg: "Соттолбогондугу тууралуу маалымкат («Түндүк» порталы)",
      en: "Police Clearance Certificate (Tündük portal)"
    },
    desc: {
      ru: "Электронная справка с QR-кодом с госпортала portal.tunduk.gov.kg с апостилем",
      kg: "portal.tunduk.gov.kg мамлекеттик порталынан QR-коддуу электрондук маалымкат",
      en: "National criminal record certificate issued via Kyrgyz e-government portal"
    }
  },
  ort_certificate: {
    id: "ort_certificate",
    icon: "file-check",
    title: {
      ru: "Сертификат ОРТ / ЖРТ (Кыргызстан)",
      kg: "ЖРТ сертификаты (Кыргызстан)",
      en: "National Admission Test (ORT / JRT)"
    },
    desc: {
      ru: "Оригинал сертификата Общереспубликанского тестирования с баллами основного и предметных тестов",
      kg: "Жалпы республикалык тестирлөөнүн негизги жана предметтик баллдары бар сертификаты",
      en: "National Kyrgyz University entrance test certificate"
    }
  }
};

// UI Localization Dictionary
let I18N = { ru: {}, kg: {}, en: {} };
