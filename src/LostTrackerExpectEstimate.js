import globals from "./globals";
import ProfitCaculation from "./profitCalculation";
import { getItemValuation, formatNumber, getSign, t } from "./utils"; // 引入 t

const supportActionType = [
    "/action_types/milking",
    "/action_types/foraging",
    "/action_types/woodcutting",
    "/action_types/cheesesmithing",
    "/action_types/crafting",
    "/action_types/tailoring",
    "/action_types/cooking",
    "/action_types/brewing",
];

export default function LostTrackerExpectEstimate() {
    setTimeout(() => {
        const lootLogList = document.querySelectorAll('.LootLogPanel_actionLoots__3oTid .LootLogPanel_actionLoot__32gl_');
        if (!lootLogList.length || !Array.isArray(globals.lootLog)) return;

        let totalDuration = 0, totalProfit = 0, totalExcessProfit = 0, totalExpectedProfit = 0;
        const lootLogData = [...globals.lootLog].reverse();
        
        lootLogList.forEach((lootElem, idx) => {
            const logData = lootLogData[idx];
            if (!logData) return;

            // 获取action数据
            const action = globals.initClientData_actionDetailMap[logData.actionHrid];
            if (!action) return;
            if (supportActionType.indexOf(action.type) === -1) return;

            // 计算预期收益
            const expected = ProfitCaculation(action, globals.medianMarketJson);

            // 计算实际收益
            let actualIncome = 0;
            Object.entries(logData.drops).forEach(([itemHash, count]) => {
                const itemHrid = itemHash.split("::")[0];
                const valuation = getItemValuation(itemHrid, globals.medianMarketJson);
                actualIncome += (valuation?.bid || 0) * count;
            });
            actualIncome *= 0.98;

            // 计算持续时间（小时）
            const startTime = new Date(logData.startTime);
            const endTime = new Date(logData.endTime);
            const durationHours = (endTime - startTime) / (1000 * 60 * 60);

            // 计算收益逻辑
            const expectedIncome = expected.outputPerHour.bid * durationHours;
            const outcome = expected.expendPerHour * durationHours;
            const profit = actualIncome - outcome;
            const expectedProfit = expectedIncome - outcome;
            const excessProfit = actualIncome - expectedIncome;
            const excessPercent = (excessProfit / expectedProfit * 100).toFixed(2);

            totalDuration += endTime - startTime;
            totalProfit += profit;
            totalExcessProfit += excessProfit;
            totalExpectedProfit += expectedProfit;

            // --- 国际化修改内容 ---
            const sign = getSign(excessProfit);
            const content = `${t('支出', 'Expenses')}: ${formatNumber(outcome)} ` + 
                            `${t('收入', 'Revenue')}: ${formatNumber(actualIncome)} ` + 
                            `${t('预期盈利', 'Expected profit')}: ${formatNumber(expectedProfit)} ` + 
                            `${t('实现盈利', 'Actual profit')}: ${formatNumber(profit)} ` + 
                            `(${sign}${Math.abs(excessPercent)}%)`;

            const colorIntensity = Math.min(Math.abs(excessPercent) / 20, 1) * 0.3 + 0.7;
            const color = excessProfit >= 0
                ? `rgb(${Math.floor(255 * colorIntensity)}, 0, 0)`  // 高于预期显示红/绿（取决于游戏习惯，此处保留原逻辑）
                : `rgb(0, ${Math.floor(255 * colorIntensity)}, 0)`; 

            const span = document.createElement('span');
            span.style.marginLeft = '8px';
            span.style.color = color;
            span.textContent = content;

            const actionNameSpan = lootElem.querySelector('span:not(.loot-log-index)');
            if (actionNameSpan) {
                // 清除可能存在的旧统计，避免重复添加
                const oldStats = actionNameSpan.querySelector('.mwi-log-stats');
                if (oldStats) oldStats.remove();
                
                span.classList.add('mwi-log-stats');
                actionNameSpan.appendChild(span);
            }
        });

        // --- 顶部汇总统计国际化 ---
        totalDuration /= 24 * 60 * 60 * 1000; // 转换为天
        const totalExcessPercent = (totalExcessProfit / totalExpectedProfit * 100).toFixed(2);
        
        const summaryContent = `${t('统计时长', 'Duration')}: ${totalDuration.toFixed(2)}${t('天', 'd')} ` +
                               `${t('净利润', 'Net Profit')}: ${formatNumber(totalProfit)} ` +
                               `(${formatNumber(totalProfit / totalDuration)}/${t('天', 'd')}) ` +
                               `${t('较预期', 'vs Expected')}: ${formatNumber(totalExcessProfit / totalDuration)}/${t('天', 'd')} ` +
                               `(${totalExcessPercent}%)`;

        const colorIntensity = Math.min(Math.abs(totalExcessPercent) / 20, 1) * 0.2 + 0.8;
        const color = totalExcessProfit >= 0
            ? `rgb(${Math.floor(255 * colorIntensity)}, 0, 0)`
            : `rgb(0, ${Math.floor(255 * colorIntensity)}, 0)`;

        const summarySpan = document.createElement('span');
        summarySpan.style.marginLeft = '8px';
        summarySpan.style.color = color;
        summarySpan.textContent = summaryContent;
        summarySpan.classList.add('mwi-summary-stats');

        const buttonContainer = document.querySelector('.LootLogPanel_lootLogPanel__2013X div');
        if (buttonContainer) {
            // 清除旧汇总
            const oldSummary = buttonContainer.querySelector('.mwi-summary-stats');
            if (oldSummary) oldSummary.remove();
            buttonContainer.appendChild(summarySpan);
        }
    }, 200);
}
