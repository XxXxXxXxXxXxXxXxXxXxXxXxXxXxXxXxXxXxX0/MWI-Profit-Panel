import globals from "./globals";
import ProfitCaculation from "./profitCalculation";
import { getItemValuation, formatNumber, getSign } from "./utils";

const supportActionType = [
    "/action_types/milking",
    "/action_types/foraging",
    "/action_types/woodcutting",
    "/action_types/cheesesmithing",
    "/action_types/crafting",
    "/action_types/tailoring",
    "/action_types/cooking",
    "/action_types/brewing",
    // "/action_types/alchemy",
    // "/action_types/enhancing",
    // "/action_types/combat",
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

            // 计算预期收益
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

            // 生成显示元素

            const sign = getSign(excessProfit);
            const content = `支出: ${formatNumber(outcome)} 收入: ${formatNumber(actualIncome)} 预期盈利：${formatNumber(expectedProfit)} 实现盈利: ${formatNumber(profit)} (${sign}${Math.abs(excessPercent)}%)`;

            const colorIntensity = Math.min(Math.abs(excessPercent) / 20, 1) * 0.3 + 0.7;
            const color = excessProfit >= 0
                ? `rgb(${Math.floor(255 * colorIntensity)}, 0, 0)`  // 红色表示高于预期
                : `rgb(0, ${Math.floor(255 * colorIntensity)}, 0)`; // 绿色表示低于预期
            const span = document.createElement('span');
            span.style.marginLeft = '8px';
            span.style.color = color;
            span.textContent = content;

            // 添加到动作名称后面
            const actionNameSpan = lootElem.querySelector('span:not(.loot-log-index)');
            if (actionNameSpan) {
                actionNameSpan.appendChild(span);
            }
        });

        totalDuration /= 24 * 60 * 60 * 1000;
        const excessPercent = (totalExcessProfit / totalExpectedProfit * 100).toFixed(2);
        const content = `统计时长：${totalDuration.toFixed(2)}天 净利润: ${formatNumber(totalProfit)} (${formatNumber(totalProfit / totalDuration)}/天) 较预期: ${formatNumber(totalExcessProfit / totalDuration)}/天 (${excessPercent}%)`;
        const colorIntensity = Math.min(Math.abs(excessPercent) / 20, 1) * 0.2 + 0.8;
        const color = excessPercent >= 0
            ? `rgb(${Math.floor(255 * colorIntensity)}, 0, 0)`  // 红色表示高于预期
            : `rgb(0, ${Math.floor(255 * colorIntensity)}, 0)`; // 绿色表示低于预期
        const summarySpan = document.createElement('span');
        summarySpan.style.marginLeft = '8px';
        summarySpan.style.color = color;
        summarySpan.textContent = content;

        // 添加到顶部按钮行
        const buttonContainer = document.querySelector('.LootLogPanel_lootLogPanel__2013X div');
        if (buttonContainer) {
            buttonContainer.appendChild(summarySpan);
        }
    }, 200);
}
