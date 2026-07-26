import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

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

console.log(`Applied ${replacements} direct terminology improvements to core translations.`);
