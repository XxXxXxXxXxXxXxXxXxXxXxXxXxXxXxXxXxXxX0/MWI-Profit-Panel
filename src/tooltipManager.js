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
        pointerEvents: 'none',
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
        console.log(item);
        return "";
    }
    const diff = item[type] - item[medianType];
    if (diff == 0) return "(-)";
    const sign = diff > 0 ? "↑" : "↓";
    const num = formatNumber(Math.abs(diff));
    return ` (${sign}${num})`;
}

function setupTooltipEvents(tooltip, tooltipContent) {
    let tooltipTimer = null;

    document.addEventListener('mouseover', (e) => {
        const itemContainer = e.target.closest('.Item_item__2De2O.Profit-pannel');
        if (!itemContainer) {
            tooltip.style.display = 'none';
            return;
        }

        const tooltipData = itemContainer.dataset.tooltip;
        if (!tooltipData) return;

        try {
            const data = JSON.parse(tooltipData);
            tooltipContent.innerHTML = formatTooltipContent(data);
            tooltip.style.display = 'block';

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
        if (!e.relatedTarget || !e.relatedTarget.closest('.Item_item__2De2O.Profit-pannel')) {
            tooltipTimer = setTimeout(() => {
                tooltip.style.display = 'none';
            }, 0);
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


    // 格式化tooltip内容
    const content =
        `
        <div class="ItemTooltipText_name__2JAHA"><span>${data.actionNames}</span></div>

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
                            <!--th style="text-align: right;">精华</th>-->
                            <th style="text-align: right;">稀有</th>
                            <th style="text-align: right;">经验</th>
                        </tr>
                        <tr style="border-bottom: 1px solid #804600;">
                            <td style="text-align: right;"><b>社区</b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.communityBuff.action_speed)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.communityBuff.efficiency)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.communityBuff.processing)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.communityBuff.gathering)} </b></td>
                            <!--td style="text-align: right;"><b> ${formatPercent(data.communityBuff.essence_find)} </b></td>-->
                            <td style="text-align: right;"><b> ${formatPercent(data.communityBuff.rare_find)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.communityBuff.wisdom)} </b></td>
                        </tr>
                        <tr style="border-bottom: 1px solid #804600;">
                            <td style="text-align: right;"><b>茶</b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.teaBuffs.action_speed)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.teaBuffs.efficiency)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.teaBuffs.processing)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.teaBuffs.gathering)} </b></td>
                            <!--td style="text-align: right;"><b> ${formatPercent(data.teaBuffs.essence_find)} </b></td>-->
                            <td style="text-align: right;"><b> ${formatPercent(data.teaBuffs.rare_find)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.teaBuffs.wisdom)} </b></td>
                        </tr>
                        <tr style="border-bottom: 1px solid #804600;">
                            <td style="text-align: right;"><b>装备</b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.equipmentBuff.action_speed)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.equipmentBuff.efficiency)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.equipmentBuff.processing)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.equipmentBuff.gathering)} </b></td>
                            <!--td style="text-align: right;"><b> ${formatPercent(data.equipmentBuff.essence_find)} </b></td>-->
                            <td style="text-align: right;"><b> ${formatPercent(data.equipmentBuff.rare_find)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.equipmentBuff.wisdom)} </b></td>
                        </tr>
                        <tr style="border-bottom: 1px solid #804600;">
                            <td style="text-align: right;"><b>等级</b></td>
                            <td style="text-align: right;"><b> - </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.levelEffBuff)} </b></td>
                            <td style="text-align: right;"><b> - </b></td>
                            <td style="text-align: right;"><b> - </b></td>
                        </tr>
                        <tr style="border-bottom: 1px solid #804600;">
                            <td style="text-align: right;"><b>房子</b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.houseBuff.action_speed)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.houseBuff.efficiency)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.houseBuff.processing)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.houseBuff.gathering)} </b></td>
                            <!--td style="text-align: right;"><b> ${formatPercent(data.houseBuff.essence_find)} </b></td>-->
                            <td style="text-align: right;"><b> ${formatPercent(data.houseBuff.rare_find)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.houseBuff.wisdom)} </b></td>
                        </tr>
                        <tr style="border-bottom: 1px solid #804600;">
                            <td style="text-align: right;"><b>成就</b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.achievementBuff.action_speed)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.achievementBuff.efficiency)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.achievementBuff.processing)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.achievementBuff.gathering)} </b></td>
                            <!--td style="text-align: right;"><b> ${formatPercent(data.achievementBuff.essence_find)} </b></td>-->
                            <td style="text-align: right;"><b> ${formatPercent(data.achievementBuff.rare_find)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.achievementBuff.wisdom)} </b></td>
                        </tr>
                        <tr style="border-bottom: 1px solid #804600;">
                            <td style="text-align: right;"><b>卷轴</b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.personalBuff.action_speed)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.personalBuff.efficiency)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.personalBuff.processing)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.personalBuff.gathering)} </b></td>
                            <!--td style="text-align: right;"><b> ${formatPercent(data.personalBuff.essence_find)} </b></td>-->
                            <td style="text-align: right;"><b> ${formatPercent(data.personalBuff.rare_find)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.personalBuff.wisdom)} </b></td>
                        </tr>
                    </tbody>
                </table>
            </div>
            ${(() => {
                // 内部逻辑判断：有的显示数值，没有或为0显示 -
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
