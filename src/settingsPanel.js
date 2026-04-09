import globals from './globals.js';
import { refreshProfitPanel } from './panelManager.js';
import { t } from './utils.js'; // 引入 t 函数

/**
 * 动态生成模态框 HTML
 * 确保每次打开设置时都能根据当前语言渲染文本
 */
const getModalHTML = () => `
    <div class="modal fade" id="profitSettingsModal" tabindex="-1" style="z-index: 100000;" aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content" style="color: orange;height: 100%;">
                <div class="modal-header">
                    <h5 class="modal-title">${t('收益设置', 'Profit Settings')}</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <div class="mb-3">
                        <label class="form-label">${t('原料进货方式', 'Material Buy Mode')}</label>
                        <select class="form-select" id="materialPriceMode">
                            <option value="ask">${t('高买', 'Ask (High)')}</option>
                            <option value="bid">${t('低买', 'Bid (Low)')}</option>
                        </select>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">${t('产品出货方式', 'Product Sell Mode')}</label>
                        <select class="form-select" id="productPriceMode">
                            <option value="ask">${t('高卖', 'Ask (High)')}</option>
                            <option value="bid">${t('低卖', 'Bid (Low)')}</option>
                        </select>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">${t('显示的动作分类', 'Action Categories')}</label>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="milkingCheck" value="milking">
                            <label class="form-check-label" for="milkingCheck">${t('挤奶', 'Milking')}</label>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="foragingCheck" value="foraging">
                            <label class="form-check-label" for="foragingCheck">${t('采摘', 'Foraging')}</label>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="woodcuttingCheck" value="woodcutting">
                            <label class="form-check-label" for="woodcuttingCheck">${t('伐木', 'Woodcutting')}</label>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="cheesesmithingCheck" value="cheesesmithing">
                            <label class="form-check-label" for="cheesesmithingCheck">${t('奶酪锻造', 'Cheesesmithing')}</label>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="craftingCheck" value="crafting">
                            <label class="form-check-label" for="craftingCheck">${t('制作', 'Crafting')}</label>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="tailoringCheck" value="tailoring">
                            <label class="form-check-label" for="tailoringCheck">${t('缝纫', 'Tailoring')}</label>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="cookingCheck" value="cooking">
                            <label class="form-check-label" for="cookingCheck">${t('烹饪', 'Cooking')}</label>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="brewingCheck" value="brewing">
                            <label class="form-check-label" for="brewingCheck">${t('冲泡', 'Brewing')}</label>
                        </div>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">${t('数据来源 (暂时不生效)', 'Data Sources (WIP)')}</label>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="officialCheck" value="Official">
                            <label class="form-check-label" for="officialCheck">${t('官方市场', 'Official Market')}</label>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="mooketApiCheck" value="MooketApi">
                            <label class="form-check-label" for="mooketApiCheck">Mooket API</label>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="mooketCheck" value="Mooket">
                            <label class="form-check-label" for="mooketCheck">${t('Mooket实时', 'Mooket Realtime')}</label>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">${t('取消', 'Cancel')}</button>
                    <button type="button" class="btn btn-primary" id="saveSettingsBtn">${t('保存设置', 'Save Settings')}</button>
                </div>
            </div>
        </div>
    </div>
`;

export function validateProfitSettings(settings) {
    const validCategories = ['milking', 'foraging', 'woodcutting', 'cheesesmithing', 'crafting', 'tailoring', 'cooking', 'brewing'];
    const validDataSources = ['Official', 'MooketApi', 'Mooket'];

    // 验证price modes
    if (!['ask', 'bid'].includes(settings.materialPriceMode)) {
        settings.materialPriceMode = 'ask';
    }
    if (!['ask', 'bid'].includes(settings.productPriceMode)) {
        settings.productPriceMode = 'bid';
    }

    // 验证dataSourceKeys
    if (!Array.isArray(settings.dataSourceKeys)) {
        settings.dataSourceKeys = validDataSources;
    } else {
        settings.dataSourceKeys = settings.dataSourceKeys.filter(src => validDataSources.includes(src));
        if (settings.dataSourceKeys.length === 0) {
            settings.dataSourceKeys = validDataSources;
        }
    }

    // 验证actionCategories
    if (!Array.isArray(settings.actionCategories)) {
        settings.actionCategories = validCategories;
    } else {
        settings.actionCategories = settings.actionCategories.filter(cat => validCategories.includes(cat));
        if (settings.actionCategories.length === 0) {
            settings.actionCategories = validCategories;
        }
    }

    return settings;
}

export function initSettingsPanel() {
    // 设置按钮点击事件
    document.addEventListener('click', (e) => {
        if (e.target.closest('#profitSettingsBtn')) {
            // 每次点击时生成最新的 HTML 确保翻译正确
            document.body.insertAdjacentHTML('beforeend', getModalHTML());
            const modal = new bootstrap.Modal(document.getElementById('profitSettingsModal'));

            // 设置模态框隐藏时的清理事件
            document.getElementById('profitSettingsModal').addEventListener('hidden.bs.modal', () => {
                const modalEl = document.getElementById('profitSettingsModal');
                if (modalEl) {
                    modalEl.remove();
                }
            });

            // 保存设置事件
            document.getElementById('saveSettingsBtn').addEventListener('click', () => {
                const actionCategories = Array.from(document.querySelectorAll('#profitSettingsModal .modal-body > div:nth-child(3) input[type="checkbox"][value]:checked'))
                    .map(checkbox => checkbox.value);

                const dataSourceKeys = Array.from(document.querySelectorAll('#profitSettingsModal .modal-body > div:nth-child(4) input[type="checkbox"][value]:checked'))
                    .map(checkbox => checkbox.value);

                const settings = {
                    materialPriceMode: document.getElementById('materialPriceMode').value,
                    productPriceMode: document.getElementById('productPriceMode').value,
                    dataSourceKeys: dataSourceKeys,
                    actionCategories: actionCategories
                };
                globals.profitSettings = validateProfitSettings(settings);

                bootstrap.Modal.getInstance(document.getElementById('profitSettingsModal')).hide();
            });

            // 加载当前设置
            const settings = globals.profitSettings;
            document.getElementById('materialPriceMode').value = settings.materialPriceMode;
            document.getElementById('productPriceMode').value = settings.productPriceMode;
            
            // 设置默认数据来源选项
            const dataSourceCheckboxes = document.querySelectorAll('#profitSettingsModal .modal-body > div:nth-child(4) input[type="checkbox"][value]');
            if (settings.dataSourceKeys) {
                dataSourceCheckboxes.forEach(checkbox => {
                    checkbox.checked = settings.dataSourceKeys.includes(checkbox.value);
                });
            } else {
                dataSourceCheckboxes.forEach(checkbox => {
                    checkbox.checked = true;
                });
            }

            // 设置默认分类选项
            const checkboxes = document.querySelectorAll('#profitSettingsModal .modal-body > div:nth-child(3) input[type="checkbox"][value]');
            if (settings.actionCategories) {
                checkboxes.forEach(checkbox => {
                    checkbox.checked = settings.actionCategories.includes(checkbox.value);
                });
            } else {
                checkboxes.forEach(checkbox => {
                    checkbox.checked = true;
                });
            }
            modal.show();
        }
    });

    globals.subscribe((key, value) => {
        if (key === "profitSettings") {
            refreshProfitPanel(true);
            GM_setValue("profitSettings", JSON.stringify(value));
        }
    });
}
