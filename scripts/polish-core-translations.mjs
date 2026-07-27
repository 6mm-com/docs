import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { locales } from "./locale-config.mjs";

const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const isMain =
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]) === new URL(import.meta.url).pathname;

const tradingApiPaths =
  /^(?:docs\.yml|docs\/pages\/(?:trading|getting-started|developer-api|sdk|solutions\/(?:matching-engine|operations-console))\/?)/;
const orderFocusedPaths =
  /^(?:docs\.yml|docs\/pages\/(?:trading\/(?:order-types|fees-and-slippage|take-profit-stop-loss)\.mdx|getting-started\/trading-workflow\.mdx|developer-api\/(?:rest-api(?:\/order)?|common-enums|websocket|websocket\/private-user-channel|integration-recommendations)\.mdx|sdk\/(?:trading-widget\/(?:overview|options-events)|agent-sdk\/(?:overview|php\/overview)|security\/webhooks-idempotency)\.mdx|solutions\/(?:matching-engine|operations-console)\.mdx))/;
const positionFocusedPaths =
  /^(?:docs\.yml|docs\/pages\/(?:trading|getting-started|developer-api\/(?:rest-api(?:\/position)?|common-enums|websocket|websocket\/private-user-channel|authentication)|sdk\/trading-widget|solutions\/(?:matching-engine|operations-console))\/?)/;
const agentSdkOverviewPath = /^docs\/pages\/sdk\/agent-sdk\/overview\.mdx$/;
const tradingWidgetOverviewPath =
  /^docs\/pages\/sdk\/trading-widget\/overview\.mdx$/;
const severeWebhookTerminologyPaths =
  /^(?:docs\.yml|docs\/pages\/(?:security-compliance\/security-architecture|sdk\/security\/(?:troubleshooting|secrets-signing)|sdk\/agent-sdk\/(?:overview|php\/quick-start|java\/quick-start))\.mdx)$/;
const allowedUrlJoinsByLocale = {
  ja: [/^URL\p{L}+$/u],
  "zh-CN": [/^URL\p{L}+$/u],
  "zh-TW": [/^URL\p{L}+$/u],
};

function shouldCheckUrlJoins(locale, relativePath) {
  return relativePath === "docs.yml" || relativePath.endsWith(".mdx");
}

function isAllowedUrlJoin(token, locale) {
  return (
    token === "URLs" ||
    (allowedUrlJoinsByLocale[locale] ?? []).some((pattern) =>
      pattern.test(token),
    )
  );
}

function mapOutsideProtectedMdx(content, transform) {
  const protectedSyntax =
    /(```[\s\S]*?```|`[^`\n]*`|\]\([^)\n]*\)|(?:href|src)=["'][^"']*["']|https?:\/\/[^\s)"']+)/g;
  return content
    .split(protectedSyntax)
    .map((segment, index) => (index % 2 === 1 ? segment : transform(segment)))
    .join("");
}

function unexpectedUrlJoins(content, locale) {
  const tokens = [];
  mapOutsideProtectedMdx(content, (segment) => {
    for (const match of segment.matchAll(/URL\p{L}+/gu)) {
      if (!isAllowedUrlJoin(match[0], locale)) tokens.push(match[0]);
    }
    return segment;
  });
  return [...new Set(tokens)];
}

function polishUnexpectedUrlJoins(content, locale, relativePath) {
  if (!shouldCheckUrlJoins(locale, relativePath)) return content;
  return mapOutsideProtectedMdx(content, (segment) =>
    segment.replace(/URL\p{L}+/gu, (token) =>
      isAllowedUrlJoin(token, locale) ? token : `URL ${token.slice(3)}`,
    ),
  );
}

function findUnexpectedUrlJoins(content, locale, relativePath) {
  if (!shouldCheckUrlJoins(locale, relativePath)) return [];
  return unexpectedUrlJoins(content, locale);
}

const qualityRulesByLocale = {
  it: [
    { pattern: /"Casa"/g, replacement: '"Pagina iniziale"', paths: /^docs\.yml$/ },
    {
      pattern: /Ragazz(?:i|ini) e Idempotenza/g,
      replacement: "Webhook e idempotenza",
      paths: severeWebhookTerminologyPaths,
    },
    { pattern: /Take Profitto/g, replacement: "Take Profit" },
    {
      pattern: /Moduli Motore e Core Abbinati/g,
      replacement: "Motore di matching e moduli core",
    },
    {
      pattern: /Sistema di scambio white-label/g,
      replacement: "Piattaforma di trading white-label",
    },
  ],
  de: [
    { pattern: /"Zuhause"/g, replacement: '"Startseite"', paths: /^docs\.yml$/ },
    { pattern: /Ordnungstypen/g, replacement: "Ordertypen", paths: orderFocusedPaths },
    { pattern: /Ordnungen/g, replacement: "Orders", paths: orderFocusedPaths },
    { pattern: /Ordnungs/g, replacement: "Order", paths: orderFocusedPaths },
    { pattern: /Ordnung/g, replacement: "Order", paths: orderFocusedPaths },
    { pattern: /Bestellungen/g, replacement: "Orders", paths: orderFocusedPaths },
    { pattern: /Bestellung/g, replacement: "Order", paths: orderFocusedPaths },
    { pattern: /Bestell(?=[A-Za-zÄÖÜäöüß])/g, replacement: "Order", paths: orderFocusedPaths },
    { pattern: /bestellungen/g, replacement: "Orders", paths: orderFocusedPaths },
    { pattern: /bestellung/g, replacement: "Order", paths: orderFocusedPaths },
    { pattern: /Veranstaltungen/g, replacement: "Ereignisse", paths: tradingApiPaths },
    { pattern: /Veranstaltung/g, replacement: "Ereignis", paths: tradingApiPaths },
    { pattern: /Randregeln/g, replacement: "Margin-Regeln" },
    {
      pattern: /Unterschrift der Anfrage/g,
      replacement: "Request-Signierung",
    },
    {
      pattern: /Abgleich von Engine und Kernmodulen/g,
      replacement: "Matching Engine und Kernmodule",
    },
    { pattern: /Ewige Kontrakte/g, replacement: "Perpetual Contracts" },
    { pattern: /ewige Kontrakte/g, replacement: "Perpetual Contracts" },
    {
      pattern: /Gewinn \/ Stop-Loss/g,
      replacement: "Take Profit / Stop Loss",
    },
  ],
  ru: [
    { pattern: /"Дом"/g, replacement: '"Главная"', paths: /^docs\.yml$/ },
    { pattern: /Порядками/g, replacement: "Ордерами", paths: orderFocusedPaths },
    { pattern: /порядками/g, replacement: "ордерами", paths: orderFocusedPaths },
    { pattern: /Порядков/g, replacement: "Ордеров", paths: orderFocusedPaths },
    { pattern: /порядков/g, replacement: "ордеров", paths: orderFocusedPaths },
    { pattern: /Порядки/g, replacement: "Ордера", paths: orderFocusedPaths },
    { pattern: /порядки/g, replacement: "ордера", paths: orderFocusedPaths },
    { pattern: /Порядка/g, replacement: "Ордера", paths: orderFocusedPaths },
    { pattern: /порядка/g, replacement: "ордера", paths: orderFocusedPaths },
    { pattern: /Порядку/g, replacement: "Ордеру", paths: orderFocusedPaths },
    { pattern: /порядку/g, replacement: "ордеру", paths: orderFocusedPaths },
    { pattern: /Порядке/g, replacement: "Ордере", paths: orderFocusedPaths },
    { pattern: /порядке/g, replacement: "ордере", paths: orderFocusedPaths },
    { pattern: /Порядок/g, replacement: "Ордер", paths: orderFocusedPaths },
    { pattern: /порядок/g, replacement: "ордер", paths: orderFocusedPaths },
    { pattern: /"Положение"/g, replacement: '"Позиция"', paths: /^docs\.yml$/ },
    { pattern: /Положения/g, replacement: "Позиции", paths: positionFocusedPaths },
    { pattern: /положения/g, replacement: "позиции", paths: positionFocusedPaths },
    { pattern: /Положений/g, replacement: "Позиций", paths: positionFocusedPaths },
    { pattern: /положений/g, replacement: "позиций", paths: positionFocusedPaths },
    { pattern: /Положение/g, replacement: "Позиция", paths: positionFocusedPaths },
    { pattern: /положение/g, replacement: "позиция", paths: positionFocusedPaths },
    { pattern: /API звонки/g, replacement: "API-вызовы" },
    { pattern: /обратные звонки/g, replacement: "обратные вызовы" },
    { pattern: /Обратные звонки/g, replacement: "Обратные вызовы" },
    { pattern: /Позвоните/g, replacement: "Вызовите" },
    { pattern: /позвоните/g, replacement: "вызовите" },
    { pattern: /звонком/g, replacement: "вызовом" },
    { pattern: /звонок/g, replacement: "вызов" },
    { pattern: /Вечные контракты/g, replacement: "Бессрочные контракты" },
    { pattern: /вечные контракты/g, replacement: "бессрочные контракты" },
    { pattern: /Вечного счёта/g, replacement: "счёта бессрочных контрактов" },
    { pattern: /вечной торговли/g, replacement: "торговли бессрочными контрактами" },
    { pattern: /вечную торговлю/g, replacement: "торговлю бессрочными контрактами" },
    {
      pattern: /Механика рычага/g,
      replacement: "Механика кредитного плеча",
    },
    { pattern: /Правила маржины/g, replacement: "Правила маржи" },
    {
      pattern: /Система обмена с белой этикеткой/g,
      replacement: "White-label биржа",
    },
    { pattern: /белой этикеткой/g, replacement: "собственной маркой" },
    {
      pattern: /производных производов/g,
      replacement: "производных продуктов",
    },
  ],
  uk: [
    { pattern: /"Дім"/g, replacement: '"Головна"', paths: /^docs\.yml$/ },
    { pattern: /Порядок/g, replacement: "Ордер", paths: orderFocusedPaths },
    { pattern: /порядок/g, replacement: "ордер", paths: orderFocusedPaths },
    { pattern: /Положення/g, replacement: "Позиції", paths: positionFocusedPaths },
    { pattern: /положення/g, replacement: "позиції", paths: positionFocusedPaths },
    {
      pattern: /Система обміну білими марками/g,
      replacement: "White-label біржа",
    },
    {
      pattern: /Механіка важеля/g,
      replacement: "Механіка кредитного плеча",
    },
  ],
  fr: [
    {
      pattern: /Programme de prime (?:sur les|d['’]?) insectes/g,
      replacement: "Programme de bug bounty",
    },
    {
      pattern: /Crochets et Idempotence/g,
      replacement: "Webhooks et idempotence",
      paths: severeWebhookTerminologyPaths,
    },
    { pattern: /\bPostes\b/g, replacement: "Positions", paths: positionFocusedPaths },
    { pattern: /\bpostes\b/g, replacement: "positions", paths: positionFocusedPaths },
    { pattern: /\bPoste\b/g, replacement: "Position", paths: positionFocusedPaths },
    { pattern: /\bposte\b/g, replacement: "position", paths: positionFocusedPaths },
    {
      pattern: /Modules de Moteur et Core Correspondants/g,
      replacement: "Moteur de matching et modules principaux",
    },
    { pattern: /Système de Commerce/g, replacement: "Système de trading" },
    { pattern: /frais et glissements/g, replacement: "frais et slippage" },
  ],
  "es-419": [
    {
      pattern: /Programa de (?:Recompensas?|Caza) por Insectos/g,
      replacement: "Programa de Recompensas por Vulnerabilidades",
    },
    {
      pattern: /Motor de Coincidencia y Módulos Básicos/g,
      replacement: "Motor de matching y módulos principales",
    },
    {
      pattern: /Sistema de Comercio API \/ SDK Embebido/g,
      replacement: "Sistema de trading con API / SDK embebidos",
    },
  ],
  "es-ES": [
    {
      pattern: /Programa de (?:Recompensas?|Caza) por Insectos/g,
      replacement: "Programa de Recompensas por Vulnerabilidades",
    },
    {
      pattern: /Emparejamiento de Motores y Módulos Básicos/g,
      replacement: "Motor de matching y módulos principales",
    },
    {
      pattern: /Sistema de Comercio API \/ SDK Embedded/g,
      replacement: "Sistema de trading con API / SDK integrados",
    },
  ],
  "pt-BR": [
    { pattern: /"Casa"/g, replacement: '"Início"', paths: /^docs\.yml$/ },
    {
      pattern: /Programa de (?:Recompensas?|Recompensa|Caça) por Insetos/g,
      replacement: "Programa de Recompensas por Vulnerabilidades",
    },
    {
      pattern: /Sistema de Troca de Marca Branca/g,
      replacement: "Plataforma de negociação white-label",
    },
    {
      pattern: /Motor Correspondente & Módulos Core/g,
      replacement: "Motor de matching e módulos principais",
    },
    { pattern: /Lucro \/ Stop Loss/g, replacement: "Take Profit / Stop Loss" },
  ],
  "pt-PT": [
    { pattern: /"Casa"/g, replacement: '"Início"', paths: /^docs\.yml$/ },
    {
      pattern: /Programa de (?:Recompensas?|Recompensa|Caça) por Insetos/g,
      replacement: "Programa de Recompensas por Vulnerabilidades",
    },
    {
      pattern: /Sistema de Troca de Marca Branca/g,
      replacement: "Plataforma de negociação white-label",
    },
    {
      pattern: /Motor Correspondente e Módulos Core/g,
      replacement: "Motor de matching e módulos principais",
    },
    {
      pattern: /Aceitar Lucro \/ Stop Loss/g,
      replacement: "Take Profit / Stop Loss",
    },
  ],
  id: [
    {
      pattern: /Sistem Pertukaran Label Putih/g,
      replacement: "Platform trading white-label",
    },
    { pattern: /Kontrak abadi/g, replacement: "Kontrak perpetual" },
    { pattern: /kontrak abadi/g, replacement: "kontrak perpetual" },
    {
      pattern: /Modul Mesin & Inti yang Cocok/g,
      replacement: "Mesin pencocokan dan modul inti",
    },
  ],
  pl: [
    { pattern: /"Dom"/g, replacement: '"Strona główna"', paths: /^docs\.yml$/ },
    {
      pattern: /Program nagród (?:za|na) robaki/g,
      replacement: "Program Bug Bounty",
    },
    {
      pattern: /Dowiedz sięWebSocket,\s*/g,
      replacement: "Dowiedz się, ",
      paths: /^docs\/pages\/developer-api\/overview\.mdx$/,
    },
    {
      pattern: /System wymiany białej etykiety/g,
      replacement: "Platforma transakcyjna white-label",
    },
    { pattern: /Kontrakty wieczyste/g, replacement: "Kontrakty perpetual" },
    { pattern: /kontrakty wieczyste/g, replacement: "kontrakty perpetual" },
    { pattern: /Typy zamówień/g, replacement: "Typy zleceń" },
    { pattern: /typy zamówień/g, replacement: "typy zleceń" },
    {
      pattern: /Podpisywanie wniosków/g,
      replacement: "Podpisywanie żądań",
    },
  ],
  vi: [
    { pattern: /Thứ tự/g, replacement: "Lệnh", paths: orderFocusedPaths },
    { pattern: /thứ tự/g, replacement: "lệnh", paths: orderFocusedPaths },
    {
      pattern: /Idmpotency/g,
      replacement: "Idempotency",
      paths: agentSdkOverviewPath,
    },
    {
      pattern: /Tính tương đồng/g,
      replacement: "Tính lũy đẳng",
    },
    {
      pattern: /tính tương đồng/g,
      replacement: "tính lũy đẳng",
    },
    {
      pattern: /Hệ thống Trao đổi nhãn trắng/g,
      replacement: "Nền tảng giao dịch white-label",
    },
    {
      pattern: /Trao đổi nhãn trắng/g,
      replacement: "Sàn giao dịch white-label",
    },
    {
      pattern: /trao đổi nhãn trắng/g,
      replacement: "sàn giao dịch white-label",
    },
    {
      pattern: /Hợp đồng vĩnh viễn/g,
      replacement: "Hợp đồng vĩnh cửu",
    },
    {
      pattern: /Hợp đồng Vĩnh viễn/g,
      replacement: "Hợp đồng Vĩnh cửu",
    },
    {
      pattern: /hợp đồng vĩnh viễn/g,
      replacement: "hợp đồng vĩnh cửu",
    },
  ],
  "zh-TW": [
    { pattern: /昆蟲(?:懸賞|賞金)計畫/g, replacement: "漏洞懸賞計畫" },
    {
      pattern: /Webhook 與冪性/g,
      replacement: "Webhook 與冪等",
      paths: agentSdkOverviewPath,
    },
    { pattern: /勳章與職位/g, replacement: "訂單與倉位", paths: tradingApiPaths },
    { pattern: /秩序/g, replacement: "訂單", paths: orderFocusedPaths },
    { pattern: /職位/g, replacement: "倉位", paths: positionFocusedPaths },
    { pattern: /位置/g, replacement: "倉位", paths: positionFocusedPaths },
    { pattern: /永久合約/g, replacement: "永續合約" },
    { pattern: /白標交換/g, replacement: "白標交易所" },
    { pattern: /階冪性/g, replacement: "訂單冪等性" },
    { pattern: /冪性/g, replacement: "冪等性" },
    { pattern: /網鉤/g, replacement: "Webhook" },
    { pattern: /網路鉤/g, replacement: "Webhook" },
  ],
  ja: [
    { pattern: /階級と役職/g, replacement: "注文とポジション", paths: tradingApiPaths },
    { pattern: /秩序/g, replacement: "注文", paths: orderFocusedPaths },
    { pattern: /役職/g, replacement: "ポジション", paths: positionFocusedPaths },
    { pattern: /位置/g, replacement: "ポジション", paths: positionFocusedPaths },
    { pattern: /永久契約/g, replacement: "無期限契約" },
    { pattern: /ホワイトラベル交換/g, replacement: "ホワイトラベル取引所" },
    { pattern: /空席/g, replacement: "オープンポジション" },
    { pattern: /清算行動/g, replacement: "清算の仕組み" },
    { pattern: /冪性/g, replacement: "冪等性" },
  ],
  ko: [
    { pattern: /영구 계약/g, replacement: "무기한 계약" },
    { pattern: /계급 및 직책/g, replacement: "주문 및 포지션" },
    { pattern: /수업료 구조/g, replacement: "수수료 구조" },
    { pattern: /API Key 경영/g, replacement: "API Key 관리" },
    { pattern: /공석/g, replacement: "오픈 포지션" },
    { pattern: /등대성/g, replacement: "멱등성" },
    {
      pattern: /화이트라벨 교환 시스템/g,
      replacement: "화이트라벨 거래소 시스템",
    },
    { pattern: /건축 및 책임/g, replacement: "아키텍처 및 책임" },
  ],
  ar: [
    { pattern: /"المنزل"/g, replacement: '"الرئيسية"', paths: /^docs\.yml$/ },
    {
      pattern: /برنامج مكافآت الحشرات/g,
      replacement: "برنامج مكافآت اكتشاف الثغرات",
    },
    { pattern: /الترتيبات/g, replacement: "الأوامر", paths: orderFocusedPaths },
    { pattern: /الترتيب/g, replacement: "الأمر", paths: orderFocusedPaths },
    { pattern: /المواقع/g, replacement: "المراكز", paths: positionFocusedPaths },
    { pattern: /الموقع/g, replacement: "المركز", paths: positionFocusedPaths },
    {
      pattern: /Idemopency/g,
      replacement: "عدم تكرار المعالجة",
    },
    {
      pattern: /توقيع طلبات التوقيع/g,
      replacement: "توقيع الطلبات",
    },
    {
      pattern: /نظام التبادل الأبيض/g,
      replacement: "منصة تداول بعلامة بيضاء",
    },
  ],
  tr: [
    {
      pattern: /Beyaz etiketli değişim sistemi/g,
      replacement: "White-label borsa sistemi",
    },
    {
      pattern: /Sürekli Sözleşmeler/g,
      replacement: "Süresiz Vadeli İşlemler",
    },
    { pattern: /Sipariş [Tt]ür/g, replacement: "Emir tür" },
    { pattern: /sipariş tür/g, replacement: "emir tür" },
    {
      pattern: /Risk ve Tasfiye Etme/g,
      replacement: "Risk ve Likidasyon",
    },
  ],
  el: [
    {
      pattern: /Σύστημα ανταλλαγής λευκής ετικέτας/g,
      replacement: "Πλατφόρμα συναλλαγών white-label",
    },
    {
      pattern: /Σύστημα Ανταλλαγής Λευκής Ετικέτας/g,
      replacement: "Πλατφόρμα Συναλλαγών White-label",
    },
    {
      pattern: /Τύποι Παραγγελιών/g,
      replacement: "Τύποι Εντολών",
    },
    {
      pattern: /τύποι παραγγελιών/g,
      replacement: "τύποι εντολών",
    },
    {
      pattern: /Αίτημα υπογραφής/g,
      replacement: "Υπογραφή αιτήματος",
    },
  ],
};

const coreSeoOverrides = {
  ja: {
    home: "デジタル資産取引ソリューション、Developer API、Trading Widget SDK、Agent SDK、セキュリティ、コンプライアンス、パートナーサポートに関する6MM公式ドキュメントをご覧ください。",
    agentHeadline: "Java・PHP バックエンド統合向け 6MM Agent SDK",
    agentDescription: "6MM Agent SDK を使用して、Java・PHP バックエンドからの署名付き API 呼び出し、ユーザー紐付け、資産振替、取引入口 URL の生成、冪等処理、Webhook 検証を実装します。",
  },
  ru: {
    home: "Официальная документация 6MM по решениям для торговли цифровыми активами, Developer API, Trading Widget SDK, Agent SDK, безопасности, комплаенсу и поддержке партнёров.",
    agentHeadline: "6MM Agent SDK для интеграции Java- и PHP-бэкендов",
    agentDescription: "Используйте 6MM Agent SDK для подписанных API-вызовов из Java- и PHP-бэкендов, привязки пользователей, переводов активов, создания URL входа в торговлю, идемпотентной обработки и проверки вебхуков.",
  },
  "es-419": {
    home: "Consulta la documentación oficial de 6MM sobre soluciones de trading de activos digitales, Developer API, Trading Widget SDK, Agent SDK, seguridad, cumplimiento y soporte para socios.",
    agentHeadline: "6MM Agent SDK para integrar backends en Java y PHP",
    agentDescription: "Usa 6MM Agent SDK para realizar llamadas API firmadas desde backends en Java y PHP, vincular usuarios, transferir activos, generar URL de acceso al trading, garantizar la idempotencia y verificar webhooks.",
  },
  it: {
    home: "Consulta la documentazione ufficiale 6MM su soluzioni di trading di asset digitali, Developer API, Trading Widget SDK, Agent SDK, sicurezza, conformità e supporto ai partner.",
    agentHeadline: "6MM Agent SDK per l’integrazione backend in Java e PHP",
    agentDescription: "Usa 6MM Agent SDK per effettuare chiamate API firmate da backend Java e PHP, associare gli utenti, trasferire asset, generare URL di accesso al trading, gestire l’idempotenza e verificare i webhook.",
  },
  fr: {
    home: "Consultez la documentation officielle 6MM sur les solutions de trading d’actifs numériques, la Developer API, le Trading Widget SDK, l’Agent SDK, la sécurité, la conformité et le support partenaire.",
    agentHeadline: "6MM Agent SDK pour l’intégration de backends Java et PHP",
    agentDescription: "Utilisez 6MM Agent SDK pour effectuer des appels API signés depuis des backends Java et PHP, associer les utilisateurs, transférer des actifs, générer des URL d’accès au trading, assurer l’idempotence et vérifier les webhooks.",
  },
  de: {
    home: "Entdecken Sie die offizielle 6MM-Dokumentation zu Digital-Asset-Handelslösungen, Developer API, Trading Widget SDK, Agent SDK, Sicherheit, Compliance und Partner-Support.",
    agentHeadline: "6MM Agent SDK für die Integration von Java- und PHP-Backends",
    agentDescription: "Nutzen Sie das 6MM Agent SDK für signierte API-Aufrufe aus Java- und PHP-Backends, Benutzerverknüpfung, Asset-Transfers, Trading-Einstiegs-URLs, idempotente Verarbeitung und Webhook-Verifizierung.",
  },
  "zh-TW": {
    home: "查看 6MM 官方文件，涵蓋數位資產交易解決方案、Developer API、Trading Widget SDK、Agent SDK、安全、合規與合作夥伴支援。",
    agentHeadline: "適用於 Java 與 PHP 後端整合的 6MM Agent SDK",
    agentDescription: "使用 6MM Agent SDK 在 Java 與 PHP 後端完成已簽章的 API 呼叫、使用者綁定、資產劃轉、交易入口 URL 建立、冪等處理及 Webhook 驗證。",
  },
  "pt-BR": {
    home: "Consulte a documentação oficial da 6MM sobre soluções de negociação de ativos digitais, Developer API, Trading Widget SDK, Agent SDK, segurança, conformidade e suporte a parceiros.",
    agentHeadline: "6MM Agent SDK para integração de backends Java e PHP",
    agentDescription: "Use o 6MM Agent SDK para fazer chamadas de API assinadas em backends Java e PHP, vincular usuários, transferir ativos, gerar URLs de acesso à negociação, garantir idempotência e verificar webhooks.",
  },
  id: {
    home: "Jelajahi dokumentasi resmi 6MM tentang solusi perdagangan aset digital, Developer API, Trading Widget SDK, Agent SDK, keamanan, kepatuhan, dan dukungan mitra.",
    agentHeadline: "6MM Agent SDK untuk integrasi backend Java dan PHP",
    agentDescription: "Gunakan 6MM Agent SDK untuk panggilan API yang ditandatangani dari backend Java dan PHP, pengikatan pengguna, transfer aset, pembuatan URL akses trading, pemrosesan idempoten, dan verifikasi webhook.",
  },
  pl: {
    home: "Poznaj oficjalną dokumentację 6MM dotyczącą rozwiązań do handlu aktywami cyfrowymi, Developer API, Trading Widget SDK, Agent SDK, bezpieczeństwa, zgodności i wsparcia partnerów.",
    agentHeadline: "6MM Agent SDK do integracji backendów Java i PHP",
    agentDescription: "Użyj 6MM Agent SDK do podpisanych wywołań API z backendów Java i PHP, powiązywania użytkowników, transferów aktywów, generowania adresów URL wejścia do handlu, obsługi idempotencji i weryfikacji webhooków.",
  },
  vi: {
    home: "Khám phá tài liệu chính thức của 6MM về giải pháp giao dịch tài sản số, Developer API, Trading Widget SDK, Agent SDK, bảo mật, tuân thủ và hỗ trợ đối tác.",
    agentHeadline: "6MM Agent SDK cho tích hợp backend Java và PHP",
    agentDescription: "Sử dụng 6MM Agent SDK để thực hiện lệnh gọi API có chữ ký từ backend Java và PHP, liên kết người dùng, chuyển tài sản, tạo URL truy cập giao dịch, bảo đảm tính lũy đẳng và xác minh webhook.",
  },
  uk: {
    home: "Офіційна документація 6MM щодо рішень для торгівлі цифровими активами, Developer API, Trading Widget SDK, Agent SDK, безпеки, комплаєнсу та підтримки партнерів.",
    agentHeadline: "6MM Agent SDK для інтеграції Java- і PHP-бекендів",
    agentDescription: "Використовуйте 6MM Agent SDK для підписаних API-викликів із Java- і PHP-бекендів, прив’язування користувачів, переказів активів, створення URL входу в торгівлю, ідемпотентної обробки та перевірки вебхуків.",
  },
  "pt-PT": {
    home: "Consulte a documentação oficial da 6MM sobre soluções de negociação de ativos digitais, Developer API, Trading Widget SDK, Agent SDK, segurança, conformidade e apoio a parceiros.",
    agentHeadline: "6MM Agent SDK para integração de backends Java e PHP",
    agentDescription: "Utilize o 6MM Agent SDK para chamadas API assinadas em backends Java e PHP, associar utilizadores, transferir ativos, gerar URLs de acesso à negociação, garantir a idempotência e verificar webhooks.",
  },
  "es-ES": {
    home: "Consulta la documentación oficial de 6MM sobre soluciones de trading de activos digitales, Developer API, Trading Widget SDK, Agent SDK, seguridad, cumplimiento normativo y soporte a socios.",
    agentHeadline: "6MM Agent SDK para integrar backends en Java y PHP",
    agentDescription: "Utiliza 6MM Agent SDK para realizar llamadas API firmadas desde backends en Java y PHP, vincular usuarios, transferir activos, generar URL de acceso al trading, garantizar la idempotencia y verificar webhooks.",
  },
  ar: {
    home: "اطّلع على وثائق 6MM الرسمية لحلول تداول الأصول الرقمية وDeveloper API وTrading Widget SDK وAgent SDK والأمان والامتثال ودعم الشركاء.",
    agentHeadline: "6MM Agent SDK لتكامل خدمات Java وPHP الخلفية",
    agentDescription: "استخدم 6MM Agent SDK لتنفيذ استدعاءات API موقّعة من خدمات Java وPHP الخلفية، وربط المستخدمين، وتحويل الأصول، وإنشاء روابط الدخول إلى التداول، وضمان عدم تكرار المعالجة، والتحقق من Webhook.",
  },
};

const coreFieldOverridesByLocale = {
  ja: {
    "docs/pages/sdk/trading-widget/overview.mdx": {
      description:
        "6MM のデジタル資産取引ターミナルをパートナーサイトに組み込み、安全な認証、表示制御、ランタイムメソッド、ライフサイクルイベントを利用する方法を説明します。",
    },
    "docs/pages/resources/overview.mdx": {
      description:
        "テンプレート、本番チェックリスト、ブランド素材、運用引き継ぎガイド、連絡先、パートナーサポートを含む、6MM の統合・ローンチ資料をご確認ください。",
    },
  },
  "es-419": {
    "docs/pages/developer-api/overview.mdx": {
      description:
        "Aprende a integrar 6MM Developer API, incluida la autenticación, la firma de solicitudes, los endpoints REST, los flujos WebSocket, la gestión de errores y las recomendaciones para producción.",
    },
  },
  it: {
    "docs/pages/home.mdx": {
      title: "6MM Documentazione sull’infrastruttura di trading",
    },
  },
  fr: {
    "docs/pages/security-compliance/overview.mdx": {
      headline:
        "Sécurité et conformité de 6MM pour les intégrations de trading",
    },
    "docs/pages/resources/overview.mdx": {
      description:
        "Découvrez les ressources d’intégration et de lancement de 6MM, notamment les modèles, les listes de contrôle de production, les ressources de marque, les guides de transfert opérationnel, les contacts et le support partenaire.",
    },
  },
  de: {
    "docs/pages/developer-api/overview.mdx": {
      description:
        "Erfahren Sie, wie Sie die 6MM Developer API integrieren, einschließlich Authentifizierung, Request Signing, REST-Endpunkten, WebSocket-Streams, Fehlerbehandlung und Hinweisen für den Produktivbetrieb.",
    },
  },
  "zh-TW": {
    "docs/pages/resources/overview.mdx": {
      description:
        "查看 6MM 整合與上線資源，包括範本、正式上線檢查表、品牌素材、營運交接指南、聯絡資訊與合作夥伴支援。",
    },
  },
  "pt-BR": {
    "docs/pages/resources/overview.mdx": {
      description:
        "Encontre recursos de integração e lançamento da 6MM, incluindo modelos, checklists de produção, ativos de marca, orientações para a transição operacional, contatos e suporte a parceiros.",
    },
  },
  id: {
    "docs/pages/resources/overview.mdx": {
      headline:
        "Dokumentasi Sumber Daya Integrasi dan Dukungan Mitra 6MM",
    },
  },
  pl: {
    "docs/pages/developer-api/overview.mdx": {
      description:
        "Dowiedz się, jak zintegrować się z 6MM Developer API, w tym z uwierzytelnianiem, podpisywaniem żądań, punktami końcowymi REST, strumieniami WebSocket, obsługą błędów i wytycznymi dotyczącymi środowiska produkcyjnego.",
    },
  },
  vi: {
    "docs/pages/sdk/trading-widget/overview.mdx": {
      description:
        "Tìm hiểu cách nhúng thiết bị đầu cuối giao dịch tài sản số 6MM vào trang web của đối tác với cơ chế xác thực an toàn, điều khiển hiển thị, phương thức runtime và sự kiện vòng đời.",
    },
  },
  uk: {
    "docs/pages/developer-api/overview.mdx": {
      description:
        "Дізнайтеся, як інтегрувати 6MM Developer API, зокрема автентифікацію, підписання запитів, кінцеві точки REST, потоки WebSocket, обробку помилок і рекомендації щодо робочого середовища.",
    },
    "docs/pages/resources/overview.mdx": {
      description:
        "Знайдіть ресурси 6MM для інтеграції та запуску, зокрема шаблони, контрольні списки для робочого середовища, бренд-матеріали, настанови з операційної передачі, контакти й підтримку партнерів.",
    },
  },
  "pt-PT": {
    "docs/pages/home.mdx": {
      title: "6MM Documentação da Infraestrutura de Negociação",
    },
    "docs/pages/developer-api/overview.mdx": {
      headline:
        "Documentação da 6MM Developer API para plataformas de negociação",
    },
  },
  ar: {
    "docs/pages/sdk/trading-widget/overview.mdx": {
      headline: "وثائق تكامل 6MM Trading Widget SDK",
    },
  },
};

const coreTextReplacementsByLocale = {
  ja: {
    "docs/pages/home.mdx": [
      [
        "認証、リクエスト署名、エンドポイントの REST 、 WebSocket ストリーム、本番エラー処理を統合します。",
        "認証、リクエスト署名、REST エンドポイント、WebSocket ストリーム、本番環境のエラー処理を統合します。",
      ],
    ],
  },
  ru: {
    "docs/pages/home.mdx": [
      [
        "Выбирайте встроенную торговлю, белую биржу, институциональную ликвидность или поддержку комплаенса и лицензирования.",
        "Выберите встроенную торговлю, биржу под собственной маркой, институциональную ликвидность или поддержку по вопросам комплаенса и лицензирования.",
      ],
      [
        "Интегрируйте аутентификацию, подписывание запросов, REST конечных точек, WebSocket потоков и обработку ошибок в производстве.",
        "Интегрируйте аутентификацию, подписание запросов, конечные точки REST, потоки WebSocket и обработку ошибок в рабочей среде.",
      ],
      [
        "Внедрить 6MM интерфейс для торговли цифровыми активами в партнёрский веб-продукт.",
        "Внедрите интерфейс 6MM для торговли цифровыми активами в партнёрский веб-продукт.",
      ],
    ],
  },
  "es-419": {
    "docs/pages/home.mdx": [
      [
        "Integra autenticación, firma de solicitudes, REST endpoints, WebSocket flujos y manejo de errores de producción.",
        "Integra la autenticación, la firma de solicitudes, los endpoints REST, los flujos WebSocket y la gestión de errores en producción.",
      ],
      [
        "Integra la 6MM interfaz de trading de activos digitales dentro de un producto web de un socio.",
        "Integra la interfaz de trading de activos digitales de 6MM en el producto web de un socio.",
      ],
    ],
  },
  it: {
    "docs/pages/home.mdx": [
      [
        "Incorpora l'interfaccia di trading di 6MM asset digitali all'interno di un prodotto web partner.",
        "Incorpora l’interfaccia 6MM per il trading di asset digitali in un prodotto web del partner.",
      ],
      [
        "Rivedere i controlli di sicurezza, la preparazione alla conformità e le responsabilità di produzione.",
        "Rivedi i controlli di sicurezza, la preparazione alla conformità e le responsabilità in produzione.",
      ],
    ],
  },
  fr: {
    "docs/pages/home.mdx": [
      ['title="Trading Solutions"', 'title="Solutions de trading"'],
      [
        "Intégrez l’authentification, la signature de requêtes, les terminaux REST , les flux WebSocket et la gestion des erreurs de production.",
        "Intégrez l’authentification, la signature des requêtes, les points de terminaison REST, les flux WebSocket et la gestion des erreurs en production.",
      ],
    ],
  },
  de: {
    "docs/pages/home.mdx": [
      [
        "Integrieren Sie die 6MM digitale Vermögenshandelsoberfläche in ein Partner-Webprodukt.",
        "Integrieren Sie die digitale Asset-Handelsoberfläche von 6MM in ein Partner-Webprodukt.",
      ],
    ],
    "docs/pages/sdk/trading-widget/overview.mdx": [
      [
        "Der öffentliche Integrationspfad bleibt unter dem v1-Skript URL stabil.",
        "Die öffentliche Integrations-URL bleibt unter dem v1-Skriptpfad stabil.",
      ],
    ],
  },
  "zh-TW": {
    "docs/pages/home.mdx": [
      [
        "整合認證、請求簽署、 REST 端點、 WebSocket 串流及生產錯誤處理。",
        "整合認證、請求簽署、REST 端點、WebSocket 串流與正式環境錯誤處理。",
      ],
      [
        "從後端處理簽名、使用者綁定、傳輸和 webhook 驗證。",
        "從後端處理簽章、使用者綁定、資產劃轉與 Webhook 驗證。",
      ],
    ],
  },
  "pt-BR": {
    "docs/pages/home.mdx": [
      [
        "Integre autenticação, assinatura de requisições, endpoints REST , fluxos de WebSocket e manejo de erros de produção.",
        "Integre autenticação, assinatura de requisições, endpoints REST, fluxos WebSocket e tratamento de erros em produção.",
      ],
      [
        "Incorpore a 6MM interface de negociação de ativos digitais dentro do produto web de um parceiro.",
        "Incorpore a interface de negociação de ativos digitais da 6MM ao produto web de um parceiro.",
      ],
    ],
  },
  id: {
    "docs/pages/home.mdx": [
      [
        "Tinjau kontrol keamanan, persiapan kepatuhan, dan tanggung jawab produksi.",
        "Tinjau kontrol keamanan, kesiapan kepatuhan, dan tanggung jawab operasional di lingkungan produksi.",
      ],
    ],
  },
  pl: {
    "docs/pages/home.mdx": [
      [
        "Umieść 6MM interfejs handlu aktywami cyfrowymi w partnerskim produkcie internetowym.",
        "Umieść interfejs 6MM do handlu aktywami cyfrowymi w partnerskim produkcie internetowym.",
      ],
      [
        "Przegląd kontroli bezpieczeństwa, przygotowania do zgodności oraz obowiązków produkcyjnych.",
        "Przejrzyj mechanizmy kontroli bezpieczeństwa, przygotowanie do zgodności oraz obowiązki w środowisku produkcyjnym.",
      ],
    ],
    "docs/pages/sdk/agent-sdk/overview.mdx": [
      [
        "Partner endpoint for 6MM webhook notifications.",
        "Punkt końcowy partnera do odbierania powiadomień webhook od 6MM.",
      ],
    ],
  },
  vi: {
    "docs/pages/home.mdx": [
      [
        "Tích hợp xác thực, ký yêu cầu, điểm cuối REST , luồng WebSocket và xử lý lỗi sản xuất.",
        "Tích hợp xác thực, ký yêu cầu, endpoint REST, luồng WebSocket và xử lý lỗi trong môi trường production.",
      ],
      [
        "Xử lý việc ký, liên kết người dùng, chuyển giao và xác minh webhook từ backend của bạn.",
        "Xử lý việc ký, liên kết người dùng, chuyển tài sản và xác minh Webhook từ backend.",
      ],
    ],
    "docs/pages/sdk/agent-sdk/overview.mdx": [
      [
        'title="Webhooks & Idempotency"',
        'title="Webhook và tính lũy đẳng"',
      ],
    ],
  },
  uk: {
    "docs/pages/home.mdx": [
      [
        "Підготувати матеріали для запуску, брендові активи, оперативну передачу, запити на підтримку та ділові контакти.",
        "Підготуйте матеріали для запуску, бренд-матеріали, операційну передачу, запити до служби підтримки та ділові контакти.",
      ],
    ],
  },
  "pt-PT": {
    "docs/pages/home.mdx": [
      [
        "Incorpore a 6MM interface de negociação de ativos digitais dentro de um produto web parceiro.",
        "Incorpore a interface de negociação de ativos digitais da 6MM num produto web do parceiro.",
      ],
    ],
  },
  "es-ES": {
    "docs/pages/home.mdx": [
      [
        "Integra autenticación, firma de solicitudes, REST endpoints, WebSocket flujos y gestión de errores de producción.",
        "Integra la autenticación, la firma de solicitudes, los endpoints REST, los flujos WebSocket y la gestión de errores en producción.",
      ],
      [
        "Integra la 6MM interfaz de trading de activos digitales dentro de un producto web de socios.",
        "Integra la interfaz de trading de activos digitales de 6MM en el producto web de un socio.",
      ],
      [
        "Preparar los materiales de lanzamiento, los activos de marca, la transferencia operativa, solicitudes de soporte y contactos empresariales.",
        "Prepara los materiales de lanzamiento, los activos de marca, el traspaso operativo, las solicitudes de soporte y los contactos empresariales.",
      ],
    ],
  },
  ar: {
    "docs/pages/home.mdx": [
      [
        "دمج المصادقة، توقيع الطلبات، نقاط REST النهائية، تدفقات WebSocket ، والتعامل مع أخطاء الإنتاج.",
        "ادمج المصادقة وتوقيع الطلبات ونقاط نهاية REST وتدفّقات WebSocket ومعالجة أخطاء بيئة الإنتاج.",
      ],
      [
        "تعامل مع التوقيع، وربط المستخدم، والنقلات، والتحقق من webhook من الخلفية.",
        "أدِر التوقيع وربط المستخدم وتحويل الأصول والتحقق من Webhook من نظامك الخلفي.",
      ],
    ],
    "docs/pages/sdk/agent-sdk/overview.mdx": [
      [
        "يخزن الواجهة الخلفية معرف الأعمال المرتجع وتعالج webhooks لاحقا بشكل متكامل.",
        "يخزّن النظام الخلفي معرّف العملية المُعاد، ثم يعالج إشعارات Webhook اللاحقة بصورة تضمن عدم تكرار المعالجة.",
      ],
    ],
  },
};

const approvedAgentOverviewIntroByLocale = {
  ru: "Используйте Agent SDK, когда вашему бэкенду необходимо связать пользователя партнёра, перемещать активы в рамках утверждённого рабочего процесса, запрашивать торговые записи, создавать URL для входа во встроенную торговлю или проверять уведомления Webhook. Используйте [Trading Widget SDK](/ru/sdk/trading-widget/overview) отдельно, когда партнёрский фронтенд должен отображать торговый интерфейс.",
  "es-419":
    "Usa el Agent SDK cuando tu backend necesite vincular a un usuario socio, mover activos mediante un flujo aprobado, consultar registros de trading, crear una URL de acceso al trading embebido o verificar notificaciones de Webhook. Usa el [Trading Widget SDK](/es-419/sdk/trading-widget/overview) por separado cuando el frontend del socio necesite mostrar la interfaz de trading.",
  it: "Usa l’Agent SDK quando il backend deve associare un utente partner, trasferire asset tramite un flusso approvato, consultare i registri di trading, creare un URL di accesso al trading integrato o verificare le notifiche Webhook. Usa separatamente il [Trading Widget SDK](/it/sdk/trading-widget/overview) quando il frontend del partner deve mostrare l’interfaccia di trading.",
  fr: "Utilisez l’Agent SDK lorsque votre backend doit associer un utilisateur partenaire, transférer des actifs via un workflow approuvé, consulter les historiques de trading, créer une URL d’accès au trading intégré ou vérifier les notifications Webhook. Utilisez le [Trading Widget SDK](/fr/sdk/trading-widget/overview) séparément lorsque le frontend partenaire doit afficher l’interface de trading.",
  de: "Verwenden Sie das Agent SDK, wenn Ihr Backend einen Partnerbenutzer verknüpfen, Assets über einen genehmigten Workflow übertragen, Handelsdaten abfragen, eine Einstiegs-URL für den eingebetteten Handel erstellen oder Webhook-Benachrichtigungen prüfen muss. Verwenden Sie das [Trading Widget SDK](/de/sdk/trading-widget/overview) separat, wenn das Partner-Frontend die Handelsoberfläche anzeigen soll.",
  "pt-BR":
    "Use o Agent SDK quando o backend precisar vincular um usuário parceiro, transferir ativos por um fluxo aprovado, consultar registros de negociação, criar uma URL de acesso à negociação incorporada ou verificar notificações de webhook. Use o [Trading Widget SDK](/pt-BR/sdk/trading-widget/overview) separadamente quando o frontend do parceiro precisar exibir a interface de negociação.",
  id: "Gunakan Agent SDK saat backend Anda perlu menghubungkan pengguna mitra, memindahkan aset melalui alur kerja yang disetujui, membaca catatan perdagangan, membuat URL akses embedded trading, atau memverifikasi notifikasi webhook. Gunakan [Trading Widget SDK](/id/sdk/trading-widget/overview) secara terpisah saat frontend mitra perlu menampilkan antarmuka trading.",
  pl: "Użyj Agent SDK, gdy backend musi powiązać użytkownika partnera, przenosić aktywa w zatwierdzonym procesie, pobierać dane transakcyjne, utworzyć adres URL wejścia do handlu osadzonego lub zweryfikować powiadomienia webhook. Użyj [Trading Widget SDK](/pl/sdk/trading-widget/overview) osobno, gdy frontend partnera ma wyświetlać interfejs handlowy.",
  vi: "Sử dụng Agent SDK khi backend cần liên kết người dùng đối tác, chuyển tài sản qua quy trình đã được phê duyệt, truy vấn lịch sử giao dịch, tạo URL truy cập giao dịch nhúng hoặc xác minh thông báo Webhook. Sử dụng [Trading Widget SDK](/vi/sdk/trading-widget/overview) riêng khi frontend đối tác cần hiển thị giao diện giao dịch.",
  uk: "Використовуйте Agent SDK, коли бекенду потрібно пов’язати користувача партнера, перемістити активи за затвердженим робочим процесом, отримати торгові записи, створити URL для входу у вбудовану торгівлю або перевірити сповіщення Webhook. Використовуйте [Trading Widget SDK](/uk/sdk/trading-widget/overview) окремо, коли партнерський фронтенд має відображати торговий інтерфейс.",
  "pt-PT":
    "Utilize o Agent SDK quando o backend precisar de associar um utilizador parceiro, transferir ativos através de um fluxo aprovado, consultar registos de negociação, criar um URL de acesso à negociação incorporada ou verificar notificações de webhook. Utilize o [Trading Widget SDK](/pt-PT/sdk/trading-widget/overview) separadamente quando o frontend do parceiro tiver de apresentar a interface de negociação.",
  "es-ES":
    "Utiliza el Agent SDK cuando tu backend necesite vincular a un usuario socio, transferir activos mediante un flujo aprobado, consultar registros de trading, crear una URL de acceso al trading integrado o verificar notificaciones de Webhook. Utiliza el [Trading Widget SDK](/es-ES/sdk/trading-widget/overview) por separado cuando el frontend del socio necesite mostrar la interfaz de trading.",
  ar: "استخدم Agent SDK عندما يحتاج نظامك الخلفي إلى ربط مستخدم تابع للشريك، أو نقل الأصول عبر سير عمل معتمد، أو الاستعلام عن سجلات التداول، أو إنشاء عنوان URL للدخول إلى التداول المضمّن، أو التحقق من إشعارات Webhook. استخدم [Trading Widget SDK](/ar/sdk/trading-widget/overview) بشكل منفصل عندما تحتاج الواجهة الأمامية للشريك إلى عرض واجهة التداول.",
};

function setFrontmatterField(content, field, value) {
  const serialized = `${field}: ${JSON.stringify(value)}`;
  const pattern = new RegExp(`^${field}:.*$`, "m");
  if (pattern.test(content)) return content.replace(pattern, serialized);
  return content.replace(/^title:.*$/m, (line) => `${line}\n${serialized}`);
}

function setUniqueLineContaining(content, marker, value) {
  const lines = content.split("\n");
  const matches = lines
    .map((line, index) => (line.includes(marker) ? index : -1))
    .filter((index) => index >= 0);
  if (matches.length !== 1) return content;
  lines[matches[0]] = value;
  return lines.join("\n");
}

function applyApprovedCoreCopy(content, locale, relativePath) {
  let output = content;
  const fields =
    coreFieldOverridesByLocale[locale]?.[relativePath] ?? {};
  for (const [field, value] of Object.entries(fields)) {
    output = setFrontmatterField(output, field, value);
  }
  const replacements =
    coreTextReplacementsByLocale[locale]?.[relativePath] ?? [];
  for (const [from, to] of replacements) {
    output = output.split(from).join(to);
  }
  const agentIntro = approvedAgentOverviewIntroByLocale[locale];
  if (agentIntro && agentSdkOverviewPath.test(relativePath)) {
    output = setUniqueLineContaining(
      output,
      "[Trading Widget SDK](",
      agentIntro,
    );
  }
  return output;
}

export function polishMachineTranslation(content, locale, relativePath) {
  let output = content;
  output = polishUnexpectedUrlJoins(output, locale, relativePath);
  for (const rule of qualityRulesByLocale[locale] ?? []) {
    if (rule.paths && !rule.paths.test(relativePath)) continue;
    output = output.replace(rule.pattern, rule.replacement);
  }
  const directReplacements =
    replacementsByFile[`fern/translations/${locale}/${relativePath}`] ?? {};
  for (const [from, to] of Object.entries(directReplacements)) {
    output = output.split(from).join(to);
  }
  const core = coreSeoOverrides[locale];
  if (core && relativePath === "docs/pages/home.mdx") {
    output = setFrontmatterField(output, "description", core.home);
  }
  if (core && relativePath === "docs/pages/sdk/agent-sdk/overview.mdx") {
    output = setFrontmatterField(output, "title", "6MM Agent SDK");
    output = setFrontmatterField(output, "headline", core.agentHeadline);
    output = setFrontmatterField(
      output,
      "description",
      core.agentDescription,
    );
  }
  output = applyApprovedCoreCopy(output, locale, relativePath);
  return output;
}

const forbiddenChecksByLocale = {
  de: [
    /Ordnungstypen/,
    /Optionen & Veranstaltungen/,
    /Randregeln/,
    /Unterschrift der Anfrage/,
  ],
  ru: [
    /API звонки/,
    /"Порядок"/,
    /"Положение"/,
    /Вечные контракты/,
    /Механика рычага/,
    /Правила маржины/,
  ],
  fr: [
    /prime (?:sur les|d['’]?) insectes/i,
    /"Poste"/,
    /Modules de Moteur et Core Correspondants/,
  ],
  it: [/Take Profitto/, /Moduli Motore e Core Abbinati/],
  "es-419": [
    /Recompensas? por Insectos/i,
    /Motor de Coincidencia y Módulos Básicos/,
  ],
  "es-ES": [
    /Recompensas? por Insectos/i,
    /Emparejamiento de Motores y Módulos Básicos/,
  ],
  "pt-BR": [
    /(?:Recompensa|Caça) por Insetos/i,
    /Sistema de Troca de Marca Branca/,
  ],
  "pt-PT": [
    /(?:Recompensa|Caça) por Insetos/i,
    /Sistema de Troca de Marca Branca/,
  ],
  id: [/Sistem Pertukaran Label Putih/, /[Kk]ontrak abadi/],
  pl: [
    /nagrod(?:y|ę) (?:za|na) robaki/i,
    /Dowiedz sięWebSocket/,
    /System wymiany białej etykiety/,
    /[Kk]ontrakty wieczyste/,
    /[Tt]ypy zamówień/,
  ],
  vi: [
    /"Thứ tự"/,
    /[Tt]ính tương đồng/,
    /Trao đổi nhãn trắng/,
    /[Hh]ợp đồng [Vv]ĩnh viễn/,
  ],
  "zh-TW": [
    /昆蟲(?:懸賞|賞金)計畫/,
    /"秩序"/,
    /"職位"/,
    /永久合約/,
    /白標交換/,
    /階冪性/,
    /冪性/,
    /網(?:路)?鉤/,
  ],
  ja: [/永久契約/, /ホワイトラベル交換/, /空席/, /清算行動/, /冪性/],
  ko: [
    /영구 계약/,
    /계급 및 직책/,
    /수업료 구조/,
    /API Key 경영/,
    /공석/,
    /등대성/,
  ],
  ar: [
    /مكافآت الحشرات/,
    /"الترتيب"/,
    /"الموقع"/,
    /Idemopency/,
    /توقيع طلبات التوقيع/,
    /نظام التبادل الأبيض/,
  ],
  uk: [/Система обміну білими марками/, /Механіка важеля/],
  tr: [
    /Beyaz etiketli değişim sistemi/,
    /Sürekli Sözleşmeler/,
    /[Ss]ipariş [Tt]ür/,
    /Risk ve Tasfiye Etme/,
  ],
  el: [
    /Σύστημα [Αα]νταλλαγής [Λλ]ευκής [Εε]τικέτας/,
    /[Ττ]ύποι [Ππ]αραγγελιών/,
    /Αίτημα υπογραφής/,
  ],
};
const agentCardForbiddenChecksByLocale = {
  vi: [/Idmpotency/],
  "zh-TW": [/Webhook 與冪性/],
};
const scopedForbiddenChecksByLocale = {
  fr: [
    {
      pattern: /Crochets et Idempotence/,
      paths: severeWebhookTerminologyPaths,
    },
  ],
  it: [
    {
      pattern: /Ragazz(?:i|ini) e Idempotenza/,
      paths: severeWebhookTerminologyPaths,
    },
  ],
};

export function findTranslationQualityIssues(content, locale, relativePath) {
  const patterns = [
    ...(forbiddenChecksByLocale[locale] ?? []),
    ...(agentSdkOverviewPath.test(relativePath)
      ? agentCardForbiddenChecksByLocale[locale] ?? []
      : []),
    ...(scopedForbiddenChecksByLocale[locale] ?? [])
      .filter((rule) => rule.paths.test(relativePath))
      .map((rule) => rule.pattern),
  ];
  const issues = patterns
    .filter((pattern) => pattern.test(content))
    .map((pattern) => pattern.source);
  for (const token of findUnexpectedUrlJoins(content, locale, relativePath)) {
    issues.push(`unexpected URL word join: ${token}`);
  }
  const core = coreSeoOverrides[locale];
  if (
    core &&
    relativePath === "docs/pages/home.mdx" &&
    !content.includes(`description: ${JSON.stringify(core.home)}`)
  ) {
    issues.push("approved home description is missing");
  }
  if (core && relativePath === "docs/pages/sdk/agent-sdk/overview.mdx") {
    for (const expected of [
      'title: "6MM Agent SDK"',
      `headline: ${JSON.stringify(core.agentHeadline)}`,
      `description: ${JSON.stringify(core.agentDescription)}`,
    ]) {
      if (!content.includes(expected)) {
        issues.push(`approved Agent SDK metadata is missing: ${expected}`);
      }
    }
  }
  const fields =
    coreFieldOverridesByLocale[locale]?.[relativePath] ?? {};
  for (const [field, value] of Object.entries(fields)) {
    const expected = `${field}: ${JSON.stringify(value)}`;
    if (!content.includes(expected)) {
      issues.push(`approved core metadata is missing: ${expected}`);
    }
  }
  for (const [, expected] of
    coreTextReplacementsByLocale[locale]?.[relativePath] ?? []) {
    if (!content.includes(expected)) {
      issues.push(`approved core copy is missing: ${expected}`);
    }
  }
  const agentIntro = approvedAgentOverviewIntroByLocale[locale];
  if (
    agentIntro &&
    agentSdkOverviewPath.test(relativePath) &&
    !content.includes(agentIntro)
  ) {
    issues.push("approved Agent SDK introduction is missing");
  }
  return issues;
}

const replacementsByFile = {
  "fern/translations/ja/docs.yml": {
    '"解決策"': '"ソリューション"',
    '"SDKs"': '"SDK"',
    '"6MM SDKs"': '"6MM SDK"',
    '"リソースと支援"': '"リソースとサポート"',
    '"6MM トレーディングソリューションズ"': '"6MM 取引ソリューション"',
    '"ホワイトラベル交換システム"': '"ホワイトラベル取引所システム"',
    '"コンプライアンス・ライセンスおよび取引技術"':
      '"コンプライアンス、ライセンス、取引技術"',
    '"コンプライアンスとローンチ"': '"コンプライアンスと本番公開"',
    '"生産開始チェックリスト"': '"本番公開チェックリスト"',
    '"トレーディングの基本"': '"取引の基本"',
    '"資産移転"': '"資産振替"',
    '"永久契約"': '"無期限契約"',
    '"レバレッジ・メカニクス"': '"レバレッジの仕組み"',
    '"マージンルール"': '"証拠金ルール"',
    '"階級と役職"': '"注文とポジション"',
    '"注文の種類"': '"注文タイプ"',
    '"利益確定/ストップロス"': '"利確・損切り"',
    '"料金とスリッピング"': '"手数料とスリッページ"',
    '"料金体系"': '"手数料体系"',
    '"統合設定"': '"接続準備"',
    '"環境と一般的な慣習"': '"環境と共通ルール"',
    '"秩序"': '"注文"',
    '"位置"': '"ポジション"',
    '"共通の列挙"': '"共通列挙型"',
    '"生産準備状態"': '"本番準備"',
    '"秘密と署名"': '"シークレットと署名"',
    '"ウェブフックと冪等性"': '"Webhook と冪等性"',
    '"埋め込みトークンの作成"': '"Embed Token を作成"',
    '"セキュリティと作戦"': '"セキュリティと運用"',
    '"打ち上げ材料"': '"本番公開資料"',
    '"ビジネス問い合わせ"': '"ビジネスに関するお問い合わせ"',
    '"支援"': '"サポート"',
  },
  "fern/translations/zh-TW/docs.yml": {
    '"SDKs"': '"SDK"',
    '"6MM SDKs"': '"6MM SDK"',
    '"安全性與合規"': '"安全與合規"',
    '"概述"': '"總覽"',
    '"架構與職責"': '"架構與職責邊界"',
    '"市場深度與利差"': '"市場深度與價差"',
    '"白標交換"': '"白標交易所"',
    '"白標交換系統"': '"白標交易所系統"',
    '"匹配引擎與核心模組"': '"撮合引擎與核心模組"',
    '"作戰控制台"': '"營運控制台"',
    '"合規與啟動"': '"合規與上線"',
    '"合規授權與交易技術"': '"合規牌照與交易技術"',
    '"授權支援"': '"牌照支援"',
    '"生產啟動清單"': '"正式上線檢查表"',
    '"永久合約"': '"永續合約"',
    '"勳章與職位"': '"訂單與倉位"',
    '"獲利了結/停損"': '"止盈／止損"',
    '"費用與滑落"': '"手續費與滑價"',
    '"收費結構"': '"費率結構"',
    '"公共端點"': '"公開端點"',
    '"秩序"': '"訂單"',
    '"職位"': '"倉位"',
    '"市場數據"': '"行情資料"',
    '"公共市場頻道"': '"公開行情頻道"',
    '"私人用戶通道"': '"私有使用者頻道"',
    '"常見的列舉"': '"常用列舉"',
    '"請求簽署"': '"請求簽章"',
    '"秘密與簽名"': '"密鑰與簽章"',
    '"Webhook 與冪性"': '"Webhook 與冪等"',
    '"建立嵌入令牌"': '"建立 Embed Token"',
    '"選項與活動"': '"參數與事件"',
    '"安全與行動"': '"安全與維運"',
    '"昆蟲懸賞計畫"': '"漏洞懸賞計畫"',
    '"條款與條件"': '"服務條款"',
    '"發射材料"': '"上線資料"',
    '"合作夥伴入職"': '"合作夥伴接入流程"',
    '"安全報告"': '"安全通報"',
    '"商業諮詢"': '"商務合作"',
    '"支持"': '"服務支援"',
    '"品牌與資產"': '"品牌與素材"',
    '"資產下載"': '"素材下載"',
  },
  "fern/translations/ja/docs/pages/home.mdx": {
    "APIs、SDKs": "API、SDK",
    "ホワイトラベル取引、機関の流動性": "ホワイトラベル取引所、機関投資家向け流動性",
    ">解決策を選ぶ<": ">ソリューションを選ぶ<",
    ">SDKsを見る<": ">SDK を見る<",
    "<span>ホワイトラベル交換</span>": "<span>ホワイトラベル取引所</span>",
    "<span>機関投資家の流動性</span>": "<span>機関投資家向け流動性</span>",
    "<span>SDKs</span>": "<span>SDK</span>",
    "<strong>選べ</strong>": "<strong>選定</strong>",
    "<strong>理解してください</strong>": "<strong>理解</strong>",
    "<strong>開局</strong>": "<strong>本番公開</strong>",
    "永久契約、注文、マージン": "無期限契約、注文、証拠金",
    "ビジネス目標を組み込み取引、ホワイトラベル取引、流動性、またはコンプライアンスおよびライセンスサポートにマッピングしてください。":
      "ビジネス目標を、組み込み取引、ホワイトラベル取引所、流動性、コンプライアンスおよびライセンス支援の各選択肢に対応付けます。",
    "APIs、Trading Widget SDK、Agent SDKsを使って":
      "API、Trading Widget SDK、Agent SDK を使って",
    "セキュリティ、ウェブフック": "セキュリティ、Webhook",
    '<h2 id="start-by-goal">スタートバイゴール</h2>':
      '<h2 id="start-by-goal">目的別に探す</h2>',
    "既存のアプリ、ウォレット、証券ポータル、ビジネスシステムに永続取引を追加しましょう。":
      "既存のアプリ、ウォレット、証券会社ポータル、ビジネスシステムに無期限契約の取引機能を追加します。",
    'title="ホワイトラベル交換システム"': 'title="ホワイトラベル取引所システム"',
    '<h2 id="enter-by-team">チーム別エントリー</h2>':
      '<h2 id="enter-by-team">チーム別に探す</h2>',
    'title="製品と運営"': 'title="プロダクトと運用"',
    'title="リソースと支援"': 'title="リソースとサポート"',
    "REST APIs": "REST API",
    "Agent SDKs": "Agent SDK",
    "API 通話モデル": "API 呼び出しモデル",
    "生産責任": "本番運用時の責任",
    "リソースと支援": "リソースとサポート",
    '<h2 id="launch-readiness">発射準備</h2>':
      '<h2 id="launch-readiness">本番公開の準備</h2>',
  },
  "fern/translations/zh-TW/docs/pages/home.mdx": {
    "解決方案、 APIs、 SDKs": "解決方案、API、SDK",
    "白標交易、機構流動性": "白標交易所、機構級流動性",
    "生產線上線前": "正式上線前",
    "機構級流動性、 API / SDK": "機構級流動性、API / SDK",
    ">查看 SDKs<": ">查看 SDK<",
    "<span>白標交換</span>": "<span>白標交易所</span>",
    "<span>合規與執照</span>": "<span>合規與牌照支援</span>",
    "<span>SDKs</span>": "<span>SDK</span>",
    "使用 APIs、 Trading Widget SDK和 Agent SDKs":
      "使用 API、Trading Widget SDK 與 Agent SDK",
    "<strong>明白</strong>": "<strong>理解</strong>",
    "<strong>發射</strong>": "<strong>上線</strong>",
    "清算行為": "清算機制",
    "準備安全、webhook、品牌資產、支援切換及生產準備檢查。":
      "完成安全性、Webhook、品牌素材、支援交接與生產就緒檢查。",
    '<h2 id="start-by-goal">起始至目標</h2>':
      '<h2 id="start-by-goal">按目標開始</h2>',
    'title="白標交換系統"': 'title="白標交易所系統"',
    '<h2 id="enter-by-team">依團隊輸入</h2>':
      '<h2 id="enter-by-team">按團隊瀏覽</h2>',
    '<h2 id="enter-by-team">依隊伍報名</h2>':
      '<h2 id="enter-by-team">按團隊瀏覽</h2>',
    "REST APIs": "REST API",
    "Agent SDKs": "Agent SDK",
    "API 通話模式": "API 呼叫模型",
    "安全性與合規": "安全與合規",
    'title="資產下載"': 'title="素材下載"',
    "參賽橫幅": "入口橫幅",
    "卡片輸入素材": "卡片入口素材",
    '<h2 id="launch-readiness">發射準備</h2>':
      '<h2 id="launch-readiness">正式上線準備</h2>',
  },
};

async function localizableFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await localizableFiles(entryPath)));
    } else if (entry.name === "docs.yml" || entry.name.endsWith(".mdx")) {
      files.push(entryPath);
    }
  }
  return files;
}

if (isMain) {
  let replacements = 0;

  for (const [relativePath, dictionary] of Object.entries(replacementsByFile)) {
    const filePath = path.join(projectRoot, relativePath);
    let content = await readFile(filePath, "utf8");
    for (const [from, to] of Object.entries(dictionary)) {
      const next = content.split(from).join(to);
      if (next !== content) {
        replacements += content.split(from).length - 1;
        content = next;
      }
    }
    await writeFile(filePath, content, "utf8");
  }

  for (const locale of locales.filter((item) => !item.default)) {
    const localeRoot = path.join(
      projectRoot,
      "fern",
      "translations",
      locale.code,
    );
    for (const filePath of await localizableFiles(localeRoot)) {
      const relativePath = path.relative(localeRoot, filePath);
      const content = await readFile(filePath, "utf8");
      const polished = polishMachineTranslation(
        content,
        locale.code,
        relativePath,
      );
      if (polished !== content) {
        replacements += 1;
        await writeFile(filePath, polished, "utf8");
      }
    }
  }

  console.log(
    `Applied ${replacements} direct terminology improvements to translations.`,
  );
}
