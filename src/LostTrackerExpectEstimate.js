import globals from "./globals";
import ProfitCaculation from "./profitCalculation";
import { getItemValuation, formatNumber, getSign, t } from "./utils";

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
    // 强制延迟执行，确保 globals 语言状态已同步
    setTimeout(() => {
        const lootLogList = document.querySelectorAll('.LootLogPanel_actionLoots__3oTid .LootLogPanel_actionLoot__32gl_');
        // 增加对 globals.isZHInGameSetting 的二次检查
        if (!lootLogList.length || !Array.isArray(globals.lootLog)) return;

        let totalDuration = 0, totalProfit = 0, totalExcessProfit = 0, totalExpectedProfit = 0;
        const lootLogData = [...globals.lootLog].reverse();
        
        lootLogList.forEach((lootElem, idx) => {
            const logData = lootLogData[idx];
            if (!logData) return;

            const action = globals.initClientData_actionDetailMap[logData.actionHrid];
            if (!action || supportActionType.indexOf(action.type) === -1) return;

            const expected = ProfitCaculation(action, globals.medianMarketJson);

            let actualIncome = 0;
            Object.entries(logData.drops).forEach(([itemHash, count]) => {
                const itemHrid = itemHash.split("::")[0];
                const valuation = getItemValuation(itemHrid, globals.medianMarketJson);
                actualIncome += (valuation?.bid || 0) * count;
            });
            actualIncome *= 0.98;

            const startTime = new Date(logData.startTime);
            const endTime = new Date(logData.endTime);
            const durationHours = (endTime - startTime) / (1000 * 60 * 60);

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

            const sign = getSign(excessProfit);
            
            // --- 关键：使用 t() 获取翻译后的文本 ---
            const content = `${t('expend')}: ${formatNumber(outcome)} ${t('income')}: ${formatNumber(actualIncome)} ${t('expectedProfit')}: ${formatNumber(expectedProfit)} ${t('actualProfit')}: ${formatNumber(profit)} (${sign}${Math.abs(excessPercent)}%)`;

            const colorIntensity = Math.min(Math.abs(excessPercent) / 20, 1) * 0.3 + 0.7;
            const color = excessProfit >= 0
                ? `rgb(${Math.floor(255 * colorIntensity)}, 0, 0)` 
                : `rgb(0, ${Math.floor(255 * colorIntensity)}, 0)`;
            
            const span = document.createElement('span');
            span.style.marginLeft = '8px';
            span.style.color = color;
            span.textContent = content;

            const actionNameSpan = lootElem.querySelector('span:not(.loot-log-index)');
            if (actionNameSpan) {
                // 彻底清理旧的 span，防止刷新后中英重叠
                const oldSpans = actionNameSpan.querySelectorAll('.profit-tracker-span');
                oldSpans.forEach(s => s.remove());
                
                span.className = 'profit-tracker-span';
                actionNameSpan.appendChild(span);
            }
        });

        totalDuration /= 24 * 60 * 60 * 1000;
        const totalExcessPercent = (totalExcessProfit / totalExpectedProfit * 100).toFixed(2);
        
        // --- 汇总栏文本翻译 ---
        const summaryContent = `${t('statsDuration')}: ${totalDuration.toFixed(2)}${t('day')} ${t('netProfit')}: ${formatNumber(totalProfit)} (${formatNumber(totalProfit / totalDuration)}/${t('day')}) ${t('thanExpected')}: ${formatNumber(totalExcessProfit / totalDuration)}/${t('day')} (${totalExcessPercent}%)`;
        
        const summaryColorIntensity = Math.min(Math.abs(totalExcessPercent) / 20, 1) * 0.2 + 0.8;
        const summaryColor = totalExcessProfit >= 0
            ? `rgb(${Math.floor(255 * summaryColorIntensity)}, 0, 0)`
            : `rgb(0, ${Math.floor(255 * summaryColorIntensity)}, 0)`;
        
        const summarySpan = document.createElement('span');
        summarySpan.id = 'profit-tracker-summary';
        summarySpan.style.marginLeft = '12px';
        summarySpan.style.color = summaryColor;
        summarySpan.style.fontWeight = 'bold';
        summarySpan.textContent = summaryContent;

        const buttonContainer = document.querySelector('.LootLogPanel_lootLogPanel__2013X div');
        if (buttonContainer) {
            const oldSummary = document.getElementById('profit-tracker-summary');
            if (oldSummary) oldSummary.remove();
            buttonContainer.appendChild(summarySpan);
        }
    }, 200);
}
