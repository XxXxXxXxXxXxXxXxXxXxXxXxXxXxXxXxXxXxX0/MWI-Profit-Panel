import { formatNumber } from './utils.js';

/**
 * 创建 Tooltip 并注入全局清理样式
 */
export function createTooltip() {
    // 1. 增强型样式注入：只在不存在时注入一次
    if (!document.getElementById('mwi-profit-cleaner')) {
        const styleElement = document.createElement('style');
        styleElement.id = 'mwi-profit-cleaner';
        styleElement.innerHTML = `
            /* 仅当 script_key 是我们 Profit-pannel 的直接后代时隐藏 */
            .Profit-pannel > .script_key {
                display: none !important;
                visibility: hidden !important;
            }
            /* 交互输入框样式优化 */
            .profit-lvl-input {
                width: 60px; /* 增加宽度适配三位数 */
                background: #2b1a0a;
                color: #f1e4d3;
                border: 1px solid #804600;
                border-radius: 3px;
                padding: 2px 4px;
                margin: 0 4px;
                font-family: inherit;
                font-size: 12px;
                outline: none;
            }
            /* 确保数字微调按钮（上下箭头）始终显示 */
            .profit-lvl-input::-webkit-inner-spin-button, 
            .profit-lvl-input::-webkit-outer-spin-button { 
                opacity: 1 !important;
                height: 20px;
            }
        `;
        document.head.appendChild(styleElement);
    }

    // 2. 创建 Tooltip 容器元素
    const tooltip = document.createElement('div');
    tooltip.id = 'profit-tooltip';
    tooltip.setAttribute('role', 'tooltip');
    tooltip.className = 'MuiPopper-root MuiTooltip-popper css-55b9xc';
    
    // 设置基础样式
    Object.assign(tooltip.style, {
        position: 'absolute',
        zIndex: '9999',
        display: 'none',
        pointerEvents: 'auto', // 关键：允许鼠标交互点击输入框
        margin: '0px',
        inset: '0px auto auto 0px'
    });

    const tooltipInner = document.createElement('div');
    tooltipInner.className = 'MuiTooltip-tooltip MuiTooltip-tooltipPlacementTop css-1spb1s5';
    tooltipInner.style.minWidth = "340px";

    const tooltipContent = document.createElement('div');
    tooltipContent.className = 'ItemTooltipText_itemTooltipText__zFq3A';

    // 层级组装
    tooltipInner.appendChild(tooltipContent);
    tooltip.appendChild(tooltipInner);
    document.body.appendChild(tooltip);

    // 3. 绑定鼠标事件
    setupTooltipEvents(tooltip, tooltipContent);

    return {
        container: tooltip,
        content: tooltipContent
    };
}

function generateDiffInfo(item, type) {
    const medianType = type == "ask" ? "medianAsk" : "medianBid";
    if (!item[type] || !item[medianType]) {
        return "";
    }
    const diff = item[type] - item[medianType];
    if (diff == 0) return "(-)";
    const sign = diff > 0 ? "↑" : "↓";
    const num = formatNumber(Math.abs(diff));
    return ` (${sign}${num})`;
}

// 辅助函数：格式化可读时间
function timeReadable(seconds) {
    if (isNaN(seconds) || seconds === Infinity) return "-";
    const days = Math.floor(seconds / 86400);
    const hrs = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return days > 0 ? `${days}天 ${hrs}时` : `${hrs}时 ${mins}分`;
}

// 核心计算逻辑：阶梯式升级预估
function calculateNeedToLevel(data, targetLvl) {
    const initCD = localStorage.getItem("initClientData");
    if (!initCD) return null;
    
    try {
        const decomCD = JSON.parse(LZString.decompressFromUTF16(initCD));
        const expTable = decomCD.levelExperienceTable;
        
        const skill = (window.MWIProfitPanel_Globals?.initCharacterData_characterSkills || [])
            .find(s => s.skillHrid === data.skillHrid);
        
        if (!skill || !expTable) return null;

        const currentLvl = skill.level;
        const currentExp = skill.experience;
        const baseTimeSec = data.baseTimePerActionSec; 
        const expPerAction = data.expPerAction;
        const currentEffBuff = data.totalEffBuff || 0; 

        let totalTimeSec = 0;
        let totalActions = 0;

        for (let lvl = currentLvl; lvl < targetLvl; lvl++) {
            let needExp = (lvl === currentLvl) 
                ? (expTable[lvl + 1] - currentExp) 
                : (expTable[lvl + 1] - expTable[lvl]);
            
            const actionsToNext = Math.ceil(needExp / expPerAction);
            totalActions += actionsToNext;

            const stepEff = (currentEffBuff + (lvl - currentLvl)) / 100;
            totalTimeSec += (actionsToNext * baseTimeSec) / (1 + stepEff);
        }

        return { numOfActions: totalActions, timeSec: totalTimeSec };
    } catch (e) {
        console.error("Calculation error", e);
        return null;
    }
}

function setupTooltipEvents(tooltip, tooltipContent) {
    let tooltipTimer = null;

    document.addEventListener('mouseover', (e) => {
        const itemContainer = e.target.closest('.Item_item__2De2O.Profit-pannel');
        if (!itemContainer) {
            // 如果鼠标移入的是 tooltip 本身，不隐藏
            if (e.target.closest('#profit-tooltip')) return;
            tooltip.style.display = 'none';
            return;
        }

        const tooltipData = itemContainer.dataset.tooltip;
        if (!tooltipData) return;

        try {
            const data = JSON.parse(tooltipData);
            tooltipContent.innerHTML = formatTooltipContent(data);
            tooltip.style.display = 'block';

            // 绑定输入框事件
            const input = tooltipContent.querySelector('.profit-lvl-input');
            const resultDisplay = tooltipContent.querySelector('.profit-lvl-result');
            if (input && resultDisplay) {
                const updateDisplay = () => {
                    const target = parseInt(input.value);
                    const res = calculateNeedToLevel(data, target);
                    if (res) {
                        resultDisplay.innerHTML = `还需: <b>${formatNumber(res.numOfActions)}</b> 次 [${timeReadable(res.timeSec)}]`;
                    }
                };
                // 监听 input 和 change 以支持打字输入和上下箭头点击
                input.addEventListener('input', updateDisplay);
                input.addEventListener('change', updateDisplay);
                input.addEventListener('click', (ev) => ev.stopPropagation());
            }

            // 计算并设置位置
            const rect = itemContainer.getBoundingClientRect();
            const xPos = Math.max(0, rect.left - tooltip.offsetWidth);
            const yPos = Math.max(0, rect.bottom - tooltip.offsetHeight);
            tooltip.style.transform = `translate(${xPos}px, ${yPos}px)`;
            tooltip.setAttribute('data-popper-placement', 'left');

            if (tooltipTimer) clearTimeout(tooltipTimer);
        } catch (e) {
            console.error('Failed to parse tooltip data:', e);
        }
    });

    document.addEventListener('mouseout', (e) => {
        // 如果移出到 tooltip 内部（包括输入框），则不消失
        if (e.relatedTarget && e.relatedTarget.closest('#profit-tooltip')) return;
        
        if (!e.relatedTarget || !e.relatedTarget.closest('.Item_item__2De2O.Profit-pannel')) {
            tooltipTimer = setTimeout(() => {
                tooltip.style.display = 'none';
            }, 100);
        }
    });
}

function formatPercent(percent) {
    const val = parseFloat(percent);
    if (!percent || isNaN(val) || Math.abs(val) < 0.0001) {
        return "-";
    }
    const formatted = val.toFixed(2);
    return val > 0 ? `+${formatted}%` : `${formatted}%`;
}

function formatTooltipContent(data) {
    let totalInputAsk = 0, totalInputBid = 0;
    let totalInputMedianAsk = 0, totalInputMedianBid = 0;
    const inputTableHtmls = [];
    for (const input of data.inputItems) {
        totalInputAsk += input.ask * input.count;
        totalInputBid += input.bid * input.count;
        totalInputMedianAsk += (input.medianAsk ?? 0) * input.count;
        totalInputMedianBid += (input.medianBid ?? 0) * input.count;
        const tableHtml =
            `
                    <tr>
                        <td style="text-align: left;">${input.name}</td>
                        <td style="text-align: right;">${formatNumber(input.count)}</td>
                        <td style="text-align: right;">${formatNumber(input.ask)}</td>
                        <td style="text-align: left;">${generateDiffInfo(input, "ask")}</td>
                        <td style="text-align: right;">${formatNumber(input.bid)}</td>
                        <td style="text-align: left;">${generateDiffInfo(input, "bid")}</td>
                        <td style="text-align: right;">${formatNumber(input.countPerHour)}</td>
                    </tr>
                `;
        inputTableHtmls.push(tableHtml);
    }

    let totalOuputAsk = 0, totalOuputBid = 0;
    let totalOutputMedianAsk = 0, totalOutputMedianBid = 0;
    const onputTableHtmls = [];
    for (const output of data.outputItems) {
        totalOuputAsk += output.ask * output.count;
        totalOuputBid += output.bid * output.count;
        totalOutputMedianAsk += (output.medianAsk ?? 0) * output.count;
        totalOutputMedianBid += (output.medianBid ?? 0) * output.count;
        const tableHtml =
            `
                    <tr>
                        <td style="text-align: left;">${output.name}</td>
                        <td style="text-align: right;">${formatNumber(output.count)}</td>
                        <td style="text-align: right;">${formatNumber(output.ask)}</td>
                        <td style="text-align: left;">${generateDiffInfo(output, "ask")}</td>
                        <td style="text-align: right;">${formatNumber(output.bid)}</td>
                        <td style="text-align: left;">${generateDiffInfo(output, "bid")}</td>
                        <td style="text-align: right;">${formatNumber(output.countPerHour)}</td>
                    </tr>
                `;
        onputTableHtmls.push(tableHtml);
    }

    // 预估升级初始计算逻辑
    const skill = (window.MWIProfitPanel_Globals?.initCharacterData_characterSkills || [])
        .find(s => s.skillHrid === data.skillHrid);
    const currentLevel = skill ? skill.level : 0;
    const targetLvlInitial = currentLevel + 1;
    const initialNeed = calculateNeedToLevel(data, targetLvlInitial);
    
    const estimateHtml = initialNeed ? `
        <div style="background: rgba(128, 70, 0, 0.05); border: 1px solid rgba(128, 70, 0, 0.2); border-radius: 4px; padding: 6px; margin: 8px 0; font-size: 11px; color: #804600;">
            <div style="display: flex; align-items: center; margin-bottom: 4px;">
                <span>升到</span>
                <input type="number" class="profit-lvl-input" value="${targetLvlInitial}" min="${targetLvlInitial}" max="200" step="1">
                <span>级预估:</span>
            </div>
            <div class="profit-lvl-result">
                还需: <b>${formatNumber(initialNeed.numOfActions)}</b> 次 [${timeReadable(initialNeed.timeSec)}]
            </div>
        </div>
    ` : '';

    // 格式化tooltip内容
    const content =
        `
        <div class="ItemTooltipText_name__2JAHA"><span>${data.actionNames}</span></div>
            
            ${estimateHtml}

            <div style="color: #804600; font-size: 10px;">
                <table style="width:100%; border-collapse: collapse;">
                    <tbody>
                        <tr style="border-bottom: 1px solid #804600;">
                            <th style="text-align: left;">原料</th>
                            <th style="text-align: center;">数量</th>
                            <th style="text-align: right;">出售价</th>
                            <th style="text-align: left;"></th>
                            <th style="text-align: right;">收购价</th>
                            <th style="text-align: left;"></th>
                            <th style="text-align: right;">数量/小时</th>
                        </tr>
                        <tr style="border-bottom: 1px solid #804600;">
                            <td style="text-align: left;"><b>合计</b></td>
                            <td style="text-align: right;"><b>/</b></td>
                            <td style="text-align: right;"><b>${formatNumber(totalInputAsk)}</b></td>
                            <th style="text-align: left;">${generateDiffInfo({ ask: totalInputAsk, medianAsk: totalInputMedianAsk }, "ask")}</th>
                            <td style="text-align: right;"><b>${formatNumber(totalInputBid)}</b></td>
                            <th style="text-align: left;">${generateDiffInfo({ bid: totalInputBid, medianBid: totalInputMedianBid }, "bid")}</th>
                            <td style="text-align: right;"><b>/</b></td>
                        </tr>
                        ${inputTableHtmls.join('\n')}
                    </tbody>
                </table>
            </div>
            <div><strong>每小时支出:</strong> ${formatNumber(data.expendPerHour)}</div>
            <div style="color: #804600; font-size: 10px;">
                <table style="width:100%; border-collapse: collapse;">
                    <tbody>
                        <tr style="border-bottom: 1px solid #804600;">
                            <th style="text-align: left;">产出</th>
                            <th style="text-align: center;">数量</th>
                            <th style="text-align: right;">出售价</th>
                            <th style="text-align: left;"></th>
                            <th style="text-align: right;">收购价</th>
                            <th style="text-align: left;"></th>
                            <th style="text-align: right;">数量/小时</th>
                        </tr>
                        <tr style="border-bottom: 1px solid #804600;">
                            <td style="text-align: left;"><b>合计</b></td>
                            <td style="text-align: right;"><b>/</b></td>
                            <td style="text-align: right;"><b>${formatNumber(totalOuputAsk)}</b></td>
                            <th style="text-align: left;">${generateDiffInfo({ ask: totalOuputAsk, medianAsk: totalOutputMedianAsk }, "ask")}</th>
                            <td style="text-align: right;"><b>${formatNumber(totalOuputBid)}</b></td>
                            <th style="text-align: left;">${generateDiffInfo({ bid: totalOuputBid, medianBid: totalOutputMedianBid }, "bid")}</th>
                            <td style="text-align: right;"><b>/</b></td>
                        </tr>
                        ${onputTableHtmls.join('\n')}
                    </tbody>
                </table>
            </div>
            <div><strong>每小时收入(税后):</strong> ${formatNumber(data.outputPerHour.bid)}</div>
            <div style="color: #804600; font-size: 10px;">
                <table style="width:100%; border-collapse: collapse;">
                    <tbody>
                        <tr style="border-bottom: 1px solid #804600;">
                            <th style="text-align: right;">类型</th>
                            <th style="text-align: right;">速度</th>
                            <th style="text-align: right;">效率</th>
                            <th style="text-align: right;">加工</th>
                            <th style="text-align: right;">数量/美食</th>
                            <th style="text-align: right;">稀有</th>
                            <th style="text-align: right;">经验</th>
                        </tr>
                        <tr style="border-bottom: 1px solid #804600;">
                            <td style="text-align: right;"><b>社区</b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.communityBuff.action_speed)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.communityBuff.efficiency)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.communityBuff.processing)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.communityBuff.gathering)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.communityBuff.rare_find)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.communityBuff.wisdom)} </b></td>
                        </tr>
                        <tr style="border-bottom: 1px solid #804600;">
                            <td style="text-align: right;"><b>茶</b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.teaBuffs.action_speed)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.teaBuffs.efficiency)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.teaBuffs.processing)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.teaBuffs.gathering)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.teaBuffs.rare_find)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.teaBuffs.wisdom)} </b></td>
                        </tr>
                        <tr style="border-bottom: 1px solid #804600;">
                            <td style="text-align: right;"><b>装备</b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.equipmentBuff.action_speed)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.equipmentBuff.efficiency)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.equipmentBuff.processing)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.equipmentBuff.gathering)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.equipmentBuff.rare_find)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.equipmentBuff.wisdom)} </b></td>
                        </tr>
                        <tr style="border-bottom: 1px solid #804600;">
                            <td style="text-align: right;"><b>等级</b></td>
                            <td style="text-align: right;"><b> - </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.levelEffBuff)} </b></td>
                            <td style="text-align: right;"><b> - </b></td>
                            <td style="text-align: right;"><b> - </b></td>
                            <td style="text-align: right;"><b> - </b></td>
                            <td style="text-align: right;"><b> - </b></td>
                        </tr>
                        <tr style="border-bottom: 1px solid #804600;">
                            <td style="text-align: right;"><b>房子</b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.houseBuff.action_speed)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.houseBuff.efficiency)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.houseBuff.processing)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.houseBuff.gathering)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.houseBuff.rare_find)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.houseBuff.wisdom)} </b></td>
                        </tr>
                        <tr style="border-bottom: 1px solid #804600;">
                            <td style="text-align: right;"><b>成就</b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.achievementBuff.action_speed)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.achievementBuff.efficiency)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.achievementBuff.processing)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.achievementBuff.gathering)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.achievementBuff.rare_find)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.achievementBuff.wisdom)} </b></td>
                        </tr>
                        <tr style="border-bottom: 1px solid #804600;">
                            <td style="text-align: right;"><b>卷轴</b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.personalBuff.action_speed)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.personalBuff.efficiency)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.personalBuff.processing)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.personalBuff.gathering)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.personalBuff.rare_find)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.personalBuff.wisdom)} </b></td>
                        </tr>
                    </tbody>
                </table>
            </div>
            ${(() => {
                const wisdomValue = data.mooPassBuff?.wisdom;
                const displayValue = (wisdomValue && wisdomValue > 0) 
                    ? formatPercent(wisdomValue) 
                    : "-";
                return `<div>MooPass经验加成: ${displayValue}</div>`;
            })()}
            <div>每小时动作: ${data.actionPerHour.toFixed(2)}次</div>
            <div>茶减少消耗: ${data.teaBuffs.artisan.toFixed(2)}%</div>
            <div><strong>每小时利润(税后):</strong> ${formatNumber(data.profitPerHour)}</div>
            <div><strong>单次经验值:</strong> ${formatNumber(data.expPerAction)}</div>
            <div><strong>每小时经验值:</strong> ${formatNumber(data.expPerHour)}</div>
        `;
    return content;
}
