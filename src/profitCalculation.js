import globals from './globals';
import buffs from './buffs';
import {
    getItemName,
    getActionName,
    getItemValuation,
    getDropTableInfomation,
} from './utils';

export default function ProfitCaculation(action, marketJson) {
    const isProduction = action.inputItems?.length > 0;
    const actionHrid = action.hrid;

    const buyMode = globals.profitSettings.materialPriceMode || 'bid';
    const sellMode = globals.profitSettings.productPriceMode || 'ask';

    // 1. 获取所有 Buff 来源
    const teaBuffs = buffs.getTeaBuffs(action.type);
    const communityBuff = buffs.getCommunityBuff(action.type);
    const achievementBuff = buffs.getAchievementBuff(action.type);
    const personalBuff = buffs.getPersonalBuff(action.type);
    const mooPassBuff = buffs.getMooPassBuff(action.type);
    const houseBuff = buffs.getHouseBuff(action.type);
    const equipmentBuff = buffs.getEquipmentBuff(action.type);

    // 2. 饮品消耗计算
    const drinksConsumedHourAskPrice = { ask: 0, bid: 0 };
    const drinksList = globals.initCharacterData_actionTypeDrinkSlotsMap[action.type] || [];
    const drinkItems = [];
    for (const drink of drinksList) {
        if (!drink?.itemHrid) continue;
        const valuation = getItemValuation(drink.itemHrid, marketJson);
        drinksConsumedHourAskPrice.ask += (valuation?.ask ?? 0) * 12;
        drinksConsumedHourAskPrice.bid += (valuation?.bid ?? 0) * 12;
        drinkItems.push({ ...valuation, name: getItemName(drink.itemHrid), countPerHour: 12 });
    }

    // 3. 等级效率加成
    const requiredLevel = action.levelRequirement.level;
    let currentLevel = requiredLevel;
    const skill = globals.initCharacterData_characterSkills.find(s => s.skillHrid === action.levelRequirement.skillHrid);
    if (skill) currentLevel = skill.level;
    const levelEffBuff = Math.max(currentLevel - requiredLevel, 0);

    // 4. 动作频率计算 (3s Cap 逻辑)
    const baseTimePerActionSec = action.baseTimeCost / 1000000000;
    // 速度加成堆叠：装备 + 卷轴 (假设为同类 ActionSpeed)
    const totalActionSpeed = (equipmentBuff.action_speed || 0) + (personalBuff.action_speed || 0) + (mooPassBuff.action_speed || 0);
    const calculatedTime = baseTimePerActionSec / (1 + totalActionSpeed / 100);
    const actualTimePerActionSec = Math.max(3, calculatedTime); 
    
    // 总效率：等级 + 房子 + 茶 + 装备 + 社区 + 成就 + 卷轴
    const totalEffBuff = levelEffBuff + houseBuff.efficiency + teaBuffs.efficiency + 
                        equipmentBuff.efficiency + communityBuff.efficiency + 
                        achievementBuff.efficiency + personalBuff.efficiency;
    const actionPerHour = (3600 / actualTimePerActionSec) * (1 + totalEffBuff / 100);

    // 5. 经验值计算 (Wisdom)
    const baseExpGain = action.experienceGain?.value ?? 0;
    const totalWisdomBuff = (teaBuffs.wisdom || 0) + (communityBuff.wisdom || 0) + 
                            (equipmentBuff.wisdom || 0) + (houseBuff.wisdom || 0) + 
                            (achievementBuff.wisdom || 0) + (personalBuff.wisdom || 0) + 
                            (mooPassBuff.wisdom || 0);
    // 单次经验四舍五入保留1位小数
    const expPerAction = Math.round(((1 + totalWisdomBuff / 100) * baseExpGain) * 10) / 10;
    const expPerHour = expPerAction * actionPerHour;

    // 6. 产量与产出计算
    let inputItems = [];
    const totalResourcesPricePerAction = { ask: 0, bid: 0 };
    let basicOutputValuationPerAction = { ask: 0, bid: 0 };
    const outputItems = [];

    if (isProduction) {
        inputItems = JSON.parse(JSON.stringify(action.inputItems));
        for (const item of inputItems) {
            item.name = getItemName(item.itemHrid);
            Object.assign(item, getItemValuation(item.itemHrid, marketJson));
            item.count *= (1 - teaBuffs.artisan / 100); // 茶减少原料消耗
            totalResourcesPricePerAction.ask += item.ask * item.count;
            totalResourcesPricePerAction.bid += item.bid * item.count;
        }
        if (action.upgradeItemHrid) {
            const valuation = getItemValuation(action.upgradeItemHrid, marketJson);
            totalResourcesPricePerAction.ask += (valuation?.ask || 0);
            totalResourcesPricePerAction.bid += (valuation?.bid || 0);
            inputItems.push({ name: getItemName(action.upgradeItemHrid), ...valuation, count: 1 });
        }
        for (const output of action.outputItems) {
            const valuation = getItemValuation(output.itemHrid, marketJson);
            basicOutputValuationPerAction.ask += valuation.ask * output.count;
            basicOutputValuationPerAction.bid += valuation.bid * output.count;
            outputItems.push({ name: getItemName(output.itemHrid), ...valuation, count: output.count });
        }
    } else {
        basicOutputValuationPerAction = getDropTableInfomation(action.dropTable, marketJson, teaBuffs, personalBuff);
        outputItems.push(...basicOutputValuationPerAction.dropItems);
    }

    // 7. 产量增益 (Gathering) 应用
    const totalGatheringBuff = (teaBuffs.gathering || 0) + (communityBuff.gathering || 0) + 
                               (achievementBuff.gathering || 0) + (personalBuff.gathering || 0);
    const quantityBuf = (100 + totalGatheringBuff) / 100;
    
    basicOutputValuationPerAction.ask *= quantityBuf;
    basicOutputValuationPerAction.bid *= quantityBuf;
    outputItems.forEach(item => { item.count *= quantityBuf; });

    // 8. 修正：每小时产出数量 (actionOutputPerHour)
    // 采集类：(1.0 * 产量倍率) * 每小时动作数
    // 生产类：直接等于每小时动作数
    const actionOutputPerHour = isProduction ? actionPerHour : (actionPerHour * quantityBuf);

    // 9. 特殊掉落 (精华与稀有)
    const applyDropTable = (table, buff) => {
        if (!Array.isArray(table)) return { ask: 0, bid: 0 };
        const val = getDropTableInfomation(table, marketJson);
        const buf = (100 + buff) / 100;
        val.ask *= buf; val.bid *= buf;
        val.dropItems?.forEach(i => { i.count *= buf; outputItems.push(i); });
        return val;
    };

    const essenceVal = applyDropTable(action.essenceDropTable, equipmentBuff.essence_find);
    const rareVal = applyDropTable(action.rareDropTable, houseBuff.rare_find + equipmentBuff.rare_find + achievementBuff.rare_find + personalBuff.rare_find);

    // 10. 最终利润统计
    const totalAskPerAction = basicOutputValuationPerAction.ask + essenceVal.ask + rareVal.ask;
    const totalBidPerAction = basicOutputValuationPerAction.bid + essenceVal.bid + rareVal.bid;
    
    const outputPerHour = {
        ask: totalAskPerAction * actionPerHour * 0.98,
        bid: totalBidPerAction * actionPerHour * 0.98,
    };
    
    const expendPerHour = (totalResourcesPricePerAction[buyMode] * actionPerHour) + drinksConsumedHourAskPrice[buyMode];
    const profitPerHour = outputPerHour[sellMode] - expendPerHour;

    // 补充 countPerHour 数据用于 UI
    inputItems.forEach(i => i.countPerHour = i.count * actionPerHour);
    drinkItems.forEach(i => i.count = i.countPerHour / actionPerHour);
    inputItems.push(...drinkItems);
    outputItems.forEach(i => i.countPerHour = i.count * actionPerHour);

    return {
        actionNames: getActionName(action.hrid),
        actionHrid,
        inputItems,
        outputItems,
        actionPerHour,
        actionOutputPerHour, // 核心：根据采集/生产自动切换的产出频率
        expendPerHour,
        outputPerHour,
        profitPerHour,
        expPerHour,
        expPerAction,
        processingOutputPerHour: (basicOutputValuationPerAction?.totalProcessingCount || 0) * actionPerHour,
        
        // Buff 对象返回供 UI 使用
        teaBuffs, communityBuff, houseBuff, equipmentBuff, achievementBuff, personalBuff, mooPassBuff,
        levelEffBuff,
        profitPerDay: profitPerHour * 24,
        ProfitMargin: expendPerHour > 0 ? (100 * profitPerHour / expendPerHour) : 0
    };
}
