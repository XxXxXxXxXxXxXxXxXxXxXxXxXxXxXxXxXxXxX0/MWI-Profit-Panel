import globals from './globals'
import { preFetchData } from './marketService';
import { waitForPannels, refreshProfitPanel } from './panelManager'
import { processingCategory, ZHitemNames } from './utils';
import LostTrackerExpectEstimate from './LostTrackerExpectEstimate'
import { validateProfitSettings } from './settingsPanel';

// --- 1. 环境初始化 ---
window["MWIProfitPanel_Globals"] = globals;
if (!window.getMwiObj) window.getMwiObj = () => window.mwi || null;

const updateLangStatus = () => {
    const lang = localStorage.getItem("i18nextLng")?.toLowerCase();
    globals.isZHInGameSetting = lang ? lang.startsWith("zh") : false;
};
updateLangStatus();

// --- 2. WebSocket Hook (Symbol 标记防冲突版) ---
const PROCESSED_MARK = Symbol('MWI_PROFIT_PROCESSED');

function hookWS() {
    const dataProperty = Object.getOwnPropertyDescriptor(MessageEvent.prototype, "data");
    if (!dataProperty || !dataProperty.get) return;
    const oriGet = dataProperty.get;

    Object.defineProperty(MessageEvent.prototype, "data", {
        get: function() {
            const message = oriGet.call(this);
            const socket = this.currentTarget;
            if (!(socket instanceof WebSocket)) return message;
            
            const url = socket.url;
            if (!url.includes("milkywayidle.com/ws") && !url.includes("milkywayidlecn.com/ws")) return message;

            if (this[PROCESSED_MARK]) return message;
            this[PROCESSED_MARK] = true;

            if (typeof message === 'string' && message.includes('"type":')) {
                return handleMessage(message);
            }
            return message;
        },
        configurable: true,
        enumerable: true
    });
}

// --- 3. 核心修复：handleMessage 必须显式触发布局刷新 ---
function handleMessage(message) {
    try {
        const obj = JSON.parse(message);
        if (!obj || !obj.type) return message;

        // 统一强制刷新函数：确保数据写完后 UI 立即重绘
        const forceUpdateUI = () => {
            globals.hasMarketItemUpdate = true;
            // 延迟一丢丢确保 Proxy 数据写完，然后强制执行重绘
            setTimeout(() => refreshProfitPanel(true), 0);
        };

        switch (obj.type) {
            case "init_character_data":
                Object.keys(obj).forEach(key => {
                    if (key.includes('Map') || key === 'characterSkills' || key === 'characterItems') {
                        globals[`initCharacterData_${key}`] = obj[key];
                    }
                });
                waitForPannels();
                break;

            case "init_client_data":
                globals.initClientData_actionDetailMap = obj.actionDetailMap;
                globals.initClientData_itemDetailMap = obj.itemDetailMap;
                globals.initClientData_openableLootDropMap = obj.openableLootDropMap;
                forceUpdateUI();
                break;

            case "market_item_order_books_updated":
                if (globals.freshnessMarketJson && obj.marketItemOrderBooks) {
                    globals.freshnessMarketJson.updateDataFromMarket(obj.marketItemOrderBooks);
                    forceUpdateUI();
                }
                break;

            case "skills_updated":
                // 技能升级时，游戏 state 更新稍慢，需要延迟获取
                setTimeout(() => {
                    const mwiObj = window.getMwiObj();
                    if (mwiObj?.game?.state?.characterSkillMap) {
                        globals.initCharacterData_characterSkills = [...mwiObj.game.state.characterSkillMap.values()];
                        forceUpdateUI();
                    }
                }, 150);
                break;

            case "loot_log_updated":
                globals.lootLog = obj.lootLog;
                LostTrackerExpectEstimate();
                break;

            default:
                // 处理装备(equipment)、喝茶(consumable)、成就(achievements)等所有实时增益更新
                if (obj.type.endsWith("_updated")) {
                    const mapKey = obj.type.replace('_updated', '') + 'ActionTypeBuffsMap';
                    // 修正：部分更新消息的字段名可能不带 ActionType
                    const possibleKeys = [mapKey, obj.type.replace('_updated', '') + 'BuffsMap'];
                    
                    possibleKeys.forEach(k => {
                        if (obj[k]) {
                            globals[`initCharacterData_${k}`] = obj[k];
                            forceUpdateUI();
                        }
                    });
                }
                break;
        }
    } catch (err) { }
    return message;
}

// --- 4. 映射订阅 ---
globals.subscribe((key, value) => {
    if (key === "initClientData_actionDetailMap") {
        const pMap = {};
        for (const [actionHrid, actionDetail] of Object.entries(value)) {
            const categories = processingCategory[actionDetail.type];
            if (categories && categories.indexOf(actionDetail.category) !== -1) {
                pMap[actionDetail.inputItems[0].itemHrid] = actionDetail;
            }
        }
        globals.processingMap = pMap;
    }
    if (key === "initClientData_itemDetailMap") {
        const en2Zh = {};
        for (const [hrid, item] of Object.entries(value)) {
            en2Zh[item.name] = ZHitemNames[hrid] || item.name;
        }
        globals.en2ZhMap = en2Zh;
    }
});

// --- 5. 初始化 ---
const savedSettings = GM_getValue('profitSettings');
globals.profitSettings = validateProfitSettings(JSON.parse(savedSettings || JSON.stringify({
    materialPriceMode: 'ask', productPriceMode: 'bid',
    dataSourceKeys: ['Official', 'MooketApi', 'Mooket'],
    actionCategories: ['milking', 'foraging', 'woodcutting', 'cheesesmithing', 'crafting', 'tailoring', 'cooking', 'brewing']
})));

const initCD = localStorage.getItem("initClientData");
if (initCD) {
    try {
        const obj = JSON.parse(LZString.decompressFromUTF16(initCD));
        globals.initClientData_actionDetailMap = obj.actionDetailMap || {};
        globals.initClientData_itemDetailMap = obj.itemDetailMap || {};
        globals.initClientData_openableLootDropMap = obj.openableLootDropMap || {};
    } catch (e) {}
}

hookWS();
preFetchData();
GM_addStyle(GM_getResourceText("bootstrapCSS"));
