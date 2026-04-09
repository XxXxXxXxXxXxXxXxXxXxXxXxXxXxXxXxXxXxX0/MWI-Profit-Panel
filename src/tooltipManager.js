import { formatNumber, t } from './utils.js'; // 引入 t 函数

/**
 * 创建 Tooltip 并注入全局清理样式
 */
export function createTooltip() {
    // 1. 增强型样式注入
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
                width: 70px !important; 
                background: #2b1a0a !important;
                color: #f1e4d3 !important;
                border: 1px solid #804600 !important;
                border-radius: 3px !important;
                padding: 2px 4px !important;
                margin: 0 4px !important;
                font-family: inherit !important;
                font-size: 12px !important;
                outline: none !important;
                cursor: text !important;
            }

            /* 确保数字微调按钮（上下箭头）显示且易于点击 */
            .profit-lvl-input::-webkit-inner-spin-button, 
            .profit-lvl-input::-webkit-outer-spin-button { 
                opacity: 1 !important;
                height: 18px !important;
                cursor: pointer !important;
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
        zIndex: '10000', 
        display: 'none',
        pointerEvents: 'auto', 
        margin: '0px',
        inset: '0px auto auto 0px'
    });

    const tooltipInner = document.createElement('div');
    tooltipInner.className = 'MuiTooltip-tooltip MuiTooltip-tooltipPlacementTop css-1spb1s5';
    tooltipInner.style.minWidth = "340px";
    tooltipInner.style.pointerEvents = 'auto';

    const tooltipContent = document.createElement('div');
    tooltipContent.className = 'ItemTooltipText_itemTooltipText__zFq3A';
    tooltipContent.style.pointerEvents = 'auto';

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
    if (isNaN(seconds) || seconds === Infinity || seconds <= 0) return "-";
    const days = Math.floor(seconds / 86400);
    const hrs = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    
    const dStr = t('天', 'd');
    const hStr = t('时', 'h');
    const mStr = t('分', 'm');
    
    return days > 0 ? `${days}${dStr} ${hrs}${hStr}` : `${hrs}${hStr} ${mins}${mStr}`;
}

// 核心计算逻辑
function calculateNeedToLevelSimple(data, targetLvl) {
    const initCD = localStorage.getItem("initClientData");
    if (!initCD) return null;
    
    try {
        const decomCD = JSON.parse(LZString.decompressFromUTF16(initCD));
        const expTable = decomCD.levelExperienceTable;
        
        const skill = (window.MWIProfitPanel_Globals?.initCharacterData_characterSkills || [])
            .find(s => s.skillHrid === data.skillHrid);
        
        if (!skill || !expTable || !data.expPerHour || data.expPerHour <= 0) return null;

        const currentExp = skill.experience;
        const targetTotalExp = expTable[targetLvl];
        
        if (!targetTotalExp || targetTotalExp <= currentExp) return null;

        const remainingExpTotal = targetTotalExp - currentExp;
        const totalTimeSec = (remainingExpTotal / data.expPerHour) * 3600;
        const totalActions = Math.ceil(remainingExpTotal / data.expPerAction);

        return { numOfActions: totalActions, timeSec: totalTimeSec };
    } catch (e) {
        return null;
    }
}

function setupTooltipEvents(tooltip, tooltipContent) {
    let tooltipTimer = null;

    document.addEventListener('mouseover', (e) => {
        const itemContainer = e.target.closest('.Item_item__2De2O.Profit-pannel');
        
        if (e.target.closest('#profit-tooltip')) {
            if (tooltipTimer) clearTimeout(tooltipTimer);
            return;
        }

        if (!itemContainer) {
            if (!tooltipTimer) {
                tooltipTimer = setTimeout(() => {
                    tooltip.style.display = 'none';
                    tooltipTimer = null;
                }, 150);
            }
            return;
        }

        const tooltipData = itemContainer.dataset.tooltip;
        if (!tooltipData) return;

        try {
            if (tooltipTimer) clearTimeout(tooltipTimer);
            tooltipTimer = null;

            const data = JSON.parse(tooltipData);
            tooltipContent.innerHTML = formatTooltipContent(data);
            tooltip.style.display = 'block';

            const input = tooltipContent.querySelector('.profit-lvl-input');
            const resultDisplay = tooltipContent.querySelector('.profit-lvl-result');
            
            if (input && resultDisplay) {
                const updateDisplay = () => {
                    const target = parseInt(input.value);
                    const res = calculateNeedToLevelSimple(data, target);
                    if (res) {
                        resultDisplay.innerHTML = `${t('还需', 'Need')}: <b>${formatNumber(res.numOfActions)}</b> ${t('次', 'times')} [${timeReadable(res.timeSec)}]`;
                    } else {
                        resultDisplay.innerHTML = `${t('还需', 'Need')}: -`;
                    }
                };

                input.addEventListener('input', updateDisplay);
                input.addEventListener('change', updateDisplay);

                const stopProp = (ev) => ev.stopPropagation();
                input.addEventListener('click', stopProp);
                input.addEventListener('mousedown', stopProp);
                input.addEventListener('mouseup', stopProp);
            }

            const rect = itemContainer.getBoundingClientRect();
            const xPos = Math.max(0, rect.left - tooltip.offsetWidth);
            const yPos = Math.max(0, rect.bottom - tooltip.offsetHeight);
            tooltip.style.transform = `translate(${xPos}px, ${yPos}px)`;
            tooltip.setAttribute('data-popper-placement', 'left');

        } catch (e) {
            console.error('Failed to update tooltip:', e);
        }
    });

    document.addEventListener('mouseout', (e) => {
        const related = e.relatedTarget;
        if (related && related.closest('#profit-tooltip')) return;

        if (!tooltipTimer) {
            tooltipTimer = setTimeout(() => {
                tooltip.style.display = 'none';
                tooltipTimer = null;
            }, 150);
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
        totalInputAsk += (input.ask || 0) * input.count;
        totalInputBid += (input.bid || 0) * input.count;
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
        totalOuputAsk += (output.ask || 0) * output.count;
        totalOuputBid += (output.bid || 0) * output.count;
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

    const skill = (window.MWIProfitPanel_Globals?.initCharacterData_characterSkills || [])
        .find(s => s.skillHrid === data.skillHrid);
    const targetLvlInitial = (skill?.level || 0) + 1;
    const initialNeed = calculateNeedToLevelSimple(data, targetLvlInitial);
    
    const estimateHtml = initialNeed ? `
        <div style="background: rgba(128, 70, 0, 0.05); border: 1px solid rgba(128, 70, 0, 0.2); border-radius: 4px; padding: 6px; margin: 8px 0; font-size: 11px; color: #804600; pointer-events: auto;">
            <div style="display: flex; align-items: center; margin-bottom: 4px;">
                <span>${t('升到', 'Level to')}</span>
                <input type="number" class="profit-lvl-input" value="${targetLvlInitial}" min="${targetLvlInitial}" max="200" step="1">
                <span>${t('级预估:', ' Est:')}</span>
            </div>
            <div class="profit-lvl-result">
                ${t('还需', 'Need')}: <b>${formatNumber(initialNeed.numOfActions)}</b> ${t('次', 'times')} [${timeReadable(initialNeed.timeSec)}]
            </div>
        </div>
    ` : '';

    const content =
        `
        <div class="ItemTooltipText_name__2JAHA"><span>${data.actionNames}</span></div>
            
            ${estimateHtml}

            <div style="color: #804600; font-size: 10px;">
                <table style="width:100%; border-collapse: collapse;">
                    <tbody>
                        <tr style="border-bottom: 1px solid #804600;">
                            <th style="text-align: left;">${t('原料', 'Material')}</th>
                            <th style="text-align: center;">${t('数量', 'Qty')}</th>
                            <th style="text-align: right;">${t('出售价', 'Ask')}</th>
                            <th style="text-align: left;"></th>
                            <th style="text-align: right;">${t('收购价', 'Bid')}</th>
                            <th style="text-align: left;"></th>
                            <th style="text-align: right;">${t('数量/小时', 'Qty/h')}</th>
                        </tr>
                        <tr style="border-bottom: 1px solid #804600;">
                            <td style="text-align: left;"><b>${t('合计', 'Total')}</b></td>
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
            <div><strong>${t('每小时支出:', 'Expenditure/h:')}</strong> ${formatNumber(data.expendPerHour)}</div>
            <div style="color: #804600; font-size: 10px;">
                <table style="width:100%; border-collapse: collapse;">
                    <tbody>
                        <tr style="border-bottom: 1px solid #804600;">
                            <th style="text-align: left;">${t('产出', 'Output')}</th>
                            <th style="text-align: center;">${t('数量', 'Qty')}</th>
                            <th style="text-align: right;">${t('出售价', 'Ask')}</th>
                            <th style="text-align: left;"></th>
                            <th style="text-align: right;">${t('收购价', 'Bid')}</th>
                            <th style="text-align: left;"></th>
                            <th style="text-align: right;">${t('数量/小时', 'Qty/h')}</th>
                        </tr>
                        <tr style="border-bottom: 1px solid #804600;">
                            <td style="text-align: left;"><b>${t('合计', 'Total')}</b></td>
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
            <div><strong>${t('每小时收入(税后):', 'Income/h (Taxed):')}</strong> ${formatNumber(data.outputPerHour.bid)}</div>
            <div style="color: #804600; font-size: 10px;">
                <table style="width:100%; border-collapse: collapse;">
                    <tbody>
                        <tr style="border-bottom: 1px solid #804600;">
                            <th style="text-align: right;">${t('类型', 'Type')}</th>
                            <th style="text-align: right;">${t('速度', 'Spd')}</th>
                            <th style="text-align: right;">${t('效率', 'Effi')}</th>
                            <th style="text-align: right;">${t('加工', 'Proc')}</th>
                            <th style="text-align: right;">${t('数量/美食', 'Qty/Food')}</th>
                            <th style="text-align: right;">${t('稀有', 'Rare')}</th>
                            <th style="text-align: right;">${t('经验', 'Exp')}</th>
                        </tr>
                        <tr style="border-bottom: 1px solid #804600;">
                            <td style="text-align: right;"><b>${t('社区', 'Comm')}</b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.communityBuff.action_speed)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.communityBuff.efficiency)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.communityBuff.processing)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.communityBuff.gathering)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.communityBuff.rare_find)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.communityBuff.wisdom)} </b></td>
                        </tr>
                        <tr style="border-bottom: 1px solid #804600;">
                            <td style="text-align: right;"><b>${t('茶', 'Tea')}</b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.teaBuffs.action_speed)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.teaBuffs.efficiency)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.teaBuffs.processing)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.teaBuffs.gathering)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.teaBuffs.rare_find)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.teaBuffs.wisdom)} </b></td>
                        </tr>
                        <tr style="border-bottom: 1px solid #804600;">
                            <td style="text-align: right;"><b>${t('装备', 'Equip')}</b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.equipmentBuff.action_speed)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.equipmentBuff.efficiency)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.equipmentBuff.processing)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.equipmentBuff.gathering)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.equipmentBuff.rare_find)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.equipmentBuff.wisdom)} </b></td>
                        </tr>
                        <tr style="border-bottom: 1px solid #804600;">
                            <td style="text-align: right;"><b>${t('等级', 'Level')}</b></td>
                            <td style="text-align: right;"><b> - </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.levelEffBuff)} </b></td>
                            <td style="text-align: right;"><b> - </b></td>
                            <td style="text-align: right;"><b> - </b></td>
                            <td style="text-align: right;"><b> - </b></td>
                            <td style="text-align: right;"><b> - </b></td>
                        </tr>
                        <tr style="border-bottom: 1px solid #804600;">
                            <td style="text-align: right;"><b>${t('房子', 'House')}</b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.houseBuff.action_speed)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.houseBuff.efficiency)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.houseBuff.processing)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.houseBuff.gathering)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.houseBuff.rare_find)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.houseBuff.wisdom)} </b></td>
                        </tr>
                        <tr style="border-bottom: 1px solid #804600;">
                            <td style="text-align: right;"><b>${t('成就', 'Achiev')}</b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.achievementBuff.action_speed)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.achievementBuff.efficiency)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.achievementBuff.processing)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.achievementBuff.gathering)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.achievementBuff.rare_find)} </b></td>
                            <td style="text-align: right;"><b> ${formatPercent(data.achievementBuff.wisdom)} </b></td>
                        </tr>
                        <tr style="border-bottom: 1px solid #804600;">
                            <td style="text-align: right;"><b>${t('卷轴', 'Scroll')}</b></td>
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
                return `<div>MooPass ${t('经验加成', 'Exp Buff')}: ${displayValue}</div>`;
            })()}
            <div>${t('每小时动作:', 'Actions/h:')} ${data.actionPerHour.toFixed(2)}</div>
            <div>${t('茶减少消耗:', 'Tea Consumption Reduc:')} ${data.teaBuffs.artisan.toFixed(2)}%</div>
            <div><strong>${t('每小时利润(税后):', 'Profit/h (Taxed):')}</strong> ${formatNumber(data.profitPerHour)}</div>
            <div><strong>${t('单次经验值:', 'Exp per Action:')}</strong> ${formatNumber(data.expPerAction)}</div>
            <div><strong>${t('每小时经验值:', 'Exp per Hour:')}</strong> ${formatNumber(data.expPerHour)}</div>
        `;
    return content;
}
