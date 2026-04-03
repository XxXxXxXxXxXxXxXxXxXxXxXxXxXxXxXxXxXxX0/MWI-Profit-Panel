import globals from "./globals";
import zhTranslation from "./zhTranslation";

export function getItemName(itemHrid) {
    if (globals.isZHInGameSetting) return ZHitemNames[itemHrid];
    else return globals.initClientData_itemDetailMap[itemHrid].name;
}

export function getActionName(actionHrid) {
    if (globals.isZHInGameSetting) return ZHActionNames[actionHrid];
    else return globals.initClientData_actionDetailMap[actionHrid].name;
}

export function getItemValuation(hrid, marketJson) {
    const item = globals.initClientData_itemDetailMap[hrid];
    if (!item) { console.log(`${hrid} can't found the item detail`); return { bid: 0, ask: 0 }; }
    if (item?.isTradable) {
        const ret = { ...marketJson.market[item.name] };
        if (ret.bid == -1 && ret.ask == -1) ret.ask = ret.bid = 1e9;
        else if (ret.bid == -1 || ret.ask == -1) ret.ask = ret.bid = Math.max(ret.ask, ret.bid);
        if (globals.medianMarketJson?.market) {
            const median = globals.medianMarketJson.market[item.name];
            ret.medianAsk = median?.ask ?? 0;
            ret.medianBid = median?.bid ?? 0;
        }
        return ret;
    }
    else if (item?.isOpenable) {
        const openedItems = globals.initClientData_openableLootDropMap[hrid];
        const valuation = { bid: 0, ask: 0, medianAsk: 0, medianBid: 0 };
        for (const openedItem of openedItems) {
            const openedValuation = getItemValuation(openedItem.itemHrid, marketJson);
            valuation.bid += openedItem.dropRate * (openedItem.minCount + openedItem.maxCount) / 2 * openedValuation.bid;
            valuation.ask += openedItem.dropRate * (openedItem.minCount + openedItem.maxCount) / 2 * openedValuation.ask;
            valuation.medianBid += openedItem.dropRate * (openedItem.minCount + openedItem.maxCount) / 2 * (openedValuation?.medianBid ?? 0);
            valuation.medianAsk += openedItem.dropRate * (openedItem.minCount + openedItem.maxCount) / 2 * (openedValuation?.medianAsk ?? 0);
        }
        return valuation;
    }
    else if (hrid === "/items/coin") return { ask: 1, bid: 1, medianAsk: 1, medianBid: 1 };
    else if (hrid === "/items/cowbell") {
        const pack = getItemValuation("/items/bag_of_10_cowbells", marketJson);
        return { ask: pack.ask / 10, bid: pack.bid / 10, medianAsk: (pack?.medianAsk ?? 0) / 10, medianBid: (pack?.medianBid ?? 0) / 10 };
    }
    else return { ask: item.sellPrice, bid: item.sellPrice, medianAsk: item.sellPrice, medianBid: item.sellPrice };
}

// 修改参数，增加 personalBuffs 默认值
export function getDropTableInfomation(dropTable, marketJson, teaBuffs = { processing: 0 }, personalBuffs = { processing: 0 }) {
    const valuationResult = { ask: 0, bid: 0 };
    const dropItems = [];

    // 计算总加工概率 (茶 + 卷轴/个人加成)
    const totalProcessingRate = (teaBuffs.processing || 0) + (personalBuffs.processing || 0);

    for (const drop of dropTable) {
        const valuation = getItemValuation(drop.itemHrid, marketJson);
        let dropCount = ((drop.minCount + drop.maxCount) / 2) * drop.dropRate;

        // 使用总加工概率进行判断
        if (globals.processingMap && totalProcessingRate > 0) {
            const processingAction = globals.processingMap[drop.itemHrid];
            if (processingAction) {
                // 产出的加工后物品数量
                const outputItemHrid = processingAction.outputItems[0].itemHrid;
                const outValuation = getItemValuation(outputItemHrid, marketJson);
                
                // 计算触发加工的期望数量
                const outputCount = (totalProcessingRate / 100) * drop.dropRate;
                
                valuationResult.ask += outValuation.ask * outputCount;
                valuationResult.bid += outValuation.bid * outputCount;
                dropItems.push({ name: getItemName(outputItemHrid), ...outValuation, count: outputCount });

                // 减少原始未加工物品的数量 (消耗掉的原料)
                dropCount -= outputCount * processingAction.inputItems[0].count;
            }
        }
        valuationResult.ask += valuation.ask * dropCount;
        valuationResult.bid += valuation.bid * dropCount;
        dropItems.push({ itemHrid: drop.itemHrid, name: getItemName(drop.itemHrid), ...valuation, count: dropCount });
    }

    return { ...valuationResult, dropItems };
}

export function getSvg(iconId) {
    if (globals.initClientData_itemDetailMap[`/items/${iconId}`])
        return `items_sprite.9c39e2ec.svg#${iconId}`
    return `actions_sprite.e6388cbc.svg#${iconId}`
}

export function formatNumber(val) {
    let number = Number(val);
    const abs = Math.abs(number);
    if (abs < 10) return Number(Math.trunc(number * 1000) / 1000);
    else if (abs < 1000) return Number(Math.trunc(number * 10) / 10);
    else if (abs < 1e5) return Math.trunc(number);
    else if (abs < 1e6) return `${Number(Math.trunc(number / 100) / 10)}k`;
    else if (abs < 1e9) return `${Number(Math.trunc(number / 1e4) / 100)}M`;
    else if (abs < 1e12) return `${Number(Math.trunc(number / 1e7) / 100)}B`;
    else return `${Math.trunc(number / 1e12)}T`;
}

export function getSign(val) {
    if (val > 0) return '↑';
    else if (val < 0) return '↓';
    return '';
}

export function getDuration(date) {
    return formatDuration(Date.now() - date.getTime());
}

export function mooketStatus() {
    try {
        if (mwi?.game) {
            return `已安装`;
        }
        return `加载异常`;
    }
    catch (e) { }
    return `未安装`;
}

export function formatDuration(diffMs) {
    const diffSeconds = Math.floor(diffMs / 1000);
    if (diffSeconds < 60) return `${diffSeconds}秒前`;

    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}分钟前`;

    const diffHours = Math.floor(diffMinutes / 60);
    return `${diffHours}小时 ${diffMinutes - diffHours * 60}分钟前`;
}

export function getMwiObj() {
    try {
        if (mwi) return mwi;
        return null;
    }
    catch (e) {
        return null;
    }
}

export function inverseKV(obj) {
    const retobj = {};
    for (const key in obj) {
        retobj[obj[key]] = key;
    }
    return retobj;
}

// 完整的物品名称翻译
export const ZHitemNames = zhTranslation.itemNames;

// 完整的动作名称翻译
export const ZHActionNames = zhTranslation.actionNames;

export const processingCategory = {
    "/action_types/cheesesmithing": ["/action_categories/cheesesmithing/material", "/action_categories/cheesesmithing/labyrinth"],
    "/action_types/crafting": ["/action_categories/crafting/lumber", "/action_categories/crafting/special", "/action_categories/crafting/labyrinth", "/action_categories/crafting/dungeon_keys"],
    "/action_types/tailoring": ["/action_categories/tailoring/material", "/action_categories/tailoring/labyrinth"],
};

export const ZHActionTypeNames = {
    milking: "\u6324\u5976",
    foraging: "\u91c7\u6458",
    woodcutting: "\u4f10\u6728",
    cheesesmithing: "\u5976\u916a\u953b\u9020",
    crafting: "\u5236\u4f5c",
    tailoring: "\u7f1d\u7eab",
    cooking: "\u70f9\u996a",
    brewing: "\u51b2\u6ce1",
}

const OneSecond = 1000;
const OneMinute = 60 * OneSecond;
const OneHour = 60 * OneMinute;
export const TimeSpan = {
    TEN_SECONDS: 10 * OneSecond,
    FIVE_MINUTES: 5 * OneMinute,
    HALF_HOURS: 30 * OneMinute,
    ONE_HOURS: OneHour,
    FOUR_HOURS: 4 * OneHour,
}
