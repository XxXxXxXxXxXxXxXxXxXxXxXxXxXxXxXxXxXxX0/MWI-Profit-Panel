import globals from './globals.js';
import { GenerateDom } from './domGenerator.js';
import { createTooltip } from './tooltipManager.js';
import { initSettingsPanel } from './settingsPanel.js';
import { formatDuration, getMwiObj, t } from './utils.js';

let initialized = false;

function getCurrentTradingMode() {
    const settings = globals.profitSettings;
    return `${settings.materialPriceMode}-${settings.productPriceMode}`;
}

function setTradingMode(materialMode, productMode) {
    const settings = globals.profitSettings;
    globals.profitSettings = {
        ...settings,
        materialPriceMode: materialMode,
        productPriceMode: productMode
    };
}

function generateTradingModeButtons() {
    const currentMode = getCurrentTradingMode();
    const modes = [
        { key: 'ask-bid', label: t('askBid'), material: 'ask', product: 'bid' },
        { key: 'ask-ask', label: t('askAsk'), material: 'ask', product: 'ask' },
        { key: 'bid-ask', label: t('bidAsk'), material: 'bid', product: 'ask' },
        { key: 'bid-bid', label: t('bidBid'), material: 'bid', product: 'bid' }
    ];

    return modes.map(mode => `
        <label class="trading-mode-option" style="
            display: flex; 
            align-items: center; 
            margin-right: 6px; 
            padding: 3px 6px; 
            cursor: pointer; 
            font-size: 0.72em;
            border-radius: 3px;
            background: ${currentMode === mode.key ? '#007bff' : '#f8f9fa'};
            color: ${currentMode === mode.key ? 'white' : '#333'};
            border: 1px solid ${currentMode === mode.key ? '#007bff' : '#dee2e6'};
            transition: all 0.2s ease;
        ">
            <input type="radio" name="tradingMode" value="${mode.key}" ${currentMode === mode.key ? 'checked' : ''} 
                   style="display: none;" data-material="${mode.material}" data-product="${mode.product}">
            <span style="white-space: nowrap;">${mode.label}</span>
        </label>
    `).join('');
}

export async function waitForPannels() {
    if (!globals.freshnessMarketJson?.market) {
        setTimeout(waitForPannels, 1000);
        return;
    }

    const rightPanelContainers = document.querySelectorAll("div.CharacterManagement_tabsComponentContainer__3oI5G");
    const leftPanelContainers = document.querySelectorAll("div.GamePage_middlePanel__ubts7 .MuiTabs-root");
    const targetNodes = [...rightPanelContainers, ...leftPanelContainers];
    
    targetNodes.forEach(container => {
        if (container.querySelector('.income-tab')) return;

        const tabsContainer = container.querySelector('div.MuiTabs-flexContainer');
        const tabPanelsContainer =
            container.querySelector('div.TabsComponent_tabPanelsContainer__26mzo') ||
            container.querySelector('div.MuiTabPanel-root');

        if (!tabsContainer || !tabPanelsContainer) return;

        const newTabButton = document.createElement('button');
        newTabButton.className = 'MuiButtonBase-root MuiTab-root MuiTab-textColorPrimary css-1q2h7u5 income-tab';
        
        // 保持原始 HTML 结构：Badge容器 -> 文本节点 + Badge小圆点
        newTabButton.innerHTML = `
            <span class="MuiBadge-root TabsComponent_badge__1Du26 css-1rzb3uu">
                ${t('incomeTab')}
                <span class="MuiBadge-badge MuiBadge-standard MuiBadge-invisible MuiBadge-anchorOriginTopRight MuiBadge-anchorOriginTopRightRectangular MuiBadge-overlapRectangular MuiBadge-colorWarning css-dpce5z"></span>
            </span>
            <span class="MuiTouchRipple-root css-w0pj6f"></span>
        `;
        tabsContainer.appendChild(newTabButton);

        const newPanel = document.createElement('div');
        newPanel.className = 'TabPanel_tabPanel__tXMJF TabPanel_hidden__26UM3 income-panel';
        newPanel.innerHTML = `
            <div class="Inventory_inventory__17CH2 profit-pannel">
                <h1 class="HousePanel_title__2fQ1U" style="position: relative; width: fit-content; margin: 4px auto 8px; font-size: 18px; font-weight: 600;">
                    <div class="profit-title-text">${t('productionProfitDetails')}</div>
                    <div class="HousePanel_guideTooltipContainer__1lAt1" style="position: absolute; left: 100%; top: 0; margin-top: 1px; margin-left: 12px;">
                        <div class="GuideTooltip_guideTooltip__1tVq-" id="profitSettingsBtn" style="cursor: pointer">
                            <svg role="img" aria-label="Guide" class="Icon_icon__2LtL_" width="100%" height="100%">
                                <use href="/static/media/misc_sprite.6b3198dc.svg#settings"></use>
                            </svg>
                        </div>
                    </div>
                </h1>
                <div style="display: flex; align-items: center; justify-content: space-between; margin: 0 10px 8px; flex-wrap: wrap;">
                    <span class="profit-stat-text" style="color: green; font-size: 0.8em; margin-bottom: 4px;">${globals.freshnessMarketJson.stat()}</span>
                    <div id="tradingModeContainer" style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
                        ${generateTradingModeButtons()}
                    </div>
                </div>
                <div class="Inventory_items__6SXv0 script_buildScore_added script_invSort_added">
                    ${GenerateDom(globals.freshnessMarketJson)}
                </div>
            </div>
        `;
        tabPanelsContainer.appendChild(newPanel);
        setupTabSwitching(newTabButton, newPanel, tabPanelsContainer, container);

        if (!initialized) {
            createTooltip();
            setupClickActions();
            initSettingsPanel();
            setInterval(() => refreshProfitPanel(), 1000);
            initialized = true;
        }
    });

    setTimeout(waitForPannels, 1000);
}

function setupTabSwitching(newTabButton, newPanel, tabPanelsContainer, container) {
    newTabButton.addEventListener('click', () => {
        container.querySelectorAll('.MuiTab-root').forEach(btn => btn.classList.remove('Mui-selected'));
        newTabButton.classList.add('Mui-selected');
        tabPanelsContainer.querySelectorAll('.TabPanel_tabPanel__tXMJF').forEach(panel => {
            panel.classList.add('TabPanel_hidden__26UM3');
        });
        newPanel.classList.remove('TabPanel_hidden__26UM3');
    });

    container.querySelectorAll('.MuiTab-root:not(.income-tab)').forEach(btn => {
        btn.addEventListener('click', () => {
            newPanel.classList.add('TabPanel_hidden__26UM3');
            newTabButton.classList.remove('Mui-selected');
            btn.classList.add('Mui-selected');
            const tabIndex = Array.from(btn.parentNode.children)
                .filter(el => !el.classList.contains('income-tab'))
                .indexOf(btn);
            tabPanelsContainer.querySelectorAll('.TabPanel_tabPanel__tXMJF:not(.income-panel)').forEach((panel, index) => {
                panel.classList.toggle('TabPanel_hidden__26UM3', index !== tabIndex);
            });
        });
    });
}

function setupClickActions() {
    document.addEventListener('click', (e) => {
        const tradingModeLabel = e.target.closest('.trading-mode-option');
        if (tradingModeLabel) {
            const radio = tradingModeLabel.querySelector('input[type="radio"]');
            if (radio) {
                setTradingMode(radio.dataset.material, radio.dataset.product);
                refreshProfitPanel(true);
            }
            return;
        }

        const itemContainer = e.target.closest('.Item_item__2De2O.Profit-pannel');
        if (!itemContainer) return;
        try {
            const data = JSON.parse(itemContainer.dataset.tooltip);
            if (data?.actionHrid && getMwiObj()?.game?.handleGoToAction) {
                getMwiObj().game.handleGoToAction(data.actionHrid);
            }
        } catch (e) { console.error(e); }
    });
}

export function refreshProfitPanel(force = false) {
    if (!globals.freshnessMarketJson?.market) return;

    // 1. 更新 Tab 按钮文本 (使用安全更新：只改文本节点)
    document.querySelectorAll('.income-tab .MuiBadge-root').forEach(badgeRoot => {
        if (badgeRoot.childNodes[0].nodeType === Node.TEXT_NODE) {
            badgeRoot.childNodes[0].textContent = t('incomeTab');
        }
    });

    // 2. 更新面板内部内容
    document.querySelectorAll('.profit-pannel').forEach(panel => {
        // 更新标题
        const titleText = panel.querySelector('.profit-title-text');
        if (titleText) titleText.textContent = t('productionProfitDetails');

        // 更新统计信息
        const statText = panel.querySelector('.profit-stat-text');
        if (statText) statText.textContent = globals.freshnessMarketJson.stat();

        // 更新交易模式按钮
        const tradingModeContainer = panel.querySelector('#tradingModeContainer');
        if (tradingModeContainer) {
            const currentMode = getCurrentTradingMode();
            tradingModeContainer.querySelectorAll('.trading-mode-option').forEach(label => {
                const radio = label.querySelector('input[type="radio"]');
                const isSelected = radio.value === currentMode;
                label.style.background = isSelected ? '#007bff' : '#f8f9fa';
                label.style.color = isSelected ? 'white' : '#333';
                label.style.borderColor = isSelected ? '#007bff' : '#dee2e6';
                radio.checked = isSelected;
                
                const span = label.querySelector('span');
                if (span) {
                    const modeMap = {
                        'ask-bid': t('askBid'), 'ask-ask': t('askAsk'),
                        'bid-ask': t('bidAsk'), 'bid-bid': t('bidBid')
                    };
                    span.textContent = modeMap[radio.value] || span.textContent;
                }
            });
        }

        // 强制刷新列表
        if (force || globals.hasMarketItemUpdate) {
            const itemsContainer = panel.querySelector('.Inventory_items__6SXv0');
            if (itemsContainer) {
                itemsContainer.innerHTML = GenerateDom(globals.freshnessMarketJson);
                globals.hasMarketItemUpdate = false;
            }
        }
    });
}
