import globals from './globals.js';
import { refreshProfitPanel } from './panelManager.js';

const modalHTML = `
            <div class="modal fade" id="profitSettingsModal" tabindex="-1" style="z-index: 100000;" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">收益设置</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <label class="form-label">原料进货方式</label>
                                <select class="form-select" id="materialPriceMode">
                                    <option value="ask">高买</option>
                                    <option value="bid">低买</option>
                                </select>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">产品出货方式</label>
                                <select class="form-select" id="productPriceMode">
                                    <option value="ask">高卖</option>
                                    <option value="bid">低卖</option>
                                </select>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">显示的动作分类</label>
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" id="milkingCheck" value="milking">
                                    <label class="form-check-label" for="milkingCheck">挤奶</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" id="foragingCheck" value="foraging">
                                    <label class="form-check-label" for="foragingCheck">采摘</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" id="woodcuttingCheck" value="woodcutting">
                                    <label class="form-check-label" for="woodcuttingCheck">伐木</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" id="cheesesmithingCheck" value="cheesesmithing">
                                    <label class="form-check-label" for="cheesesmithingCheck">奶锻制造</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" id="craftingCheck" value="crafting">
                                    <label class="form-check-label" for="craftingCheck">制作</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" id="tailoringCheck" value="tailoring">
                                    <label class="form-check-label" for="tailoringCheck">缝纫</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" id="cookingCheck" value="cooking">
                                    <label class="form-check-label" for="cookingCheck">烹饪</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" id="brewingCheck" value="brewing">
                                    <label class="form-check-label" for="brewingCheck">冲泡</label>
                                </div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">数据来源 (暂时不生效)</label>
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" id="officialCheck" value="Official">
                                    <label class="form-check-label" for="officialCheck">官方市场</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" id="mooketApiCheck" value="MooketApi">
                                    <label class="form-check-label" for="mooketApiCheck">Mooket API</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" id="mooketCheck" value="Mooket">
                                    <label class="form-check-label" for="mooketCheck">Mooket实时</label>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                            <button type="button" class="btn btn-primary" id="saveSettingsBtn">保存设置</button>
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
            // 创建并插入模态框HTML

            document.body.insertAdjacentHTML('beforeend', modalHTML);
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
            }
            else {
                // 默认全选
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
                // 默认全选
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
