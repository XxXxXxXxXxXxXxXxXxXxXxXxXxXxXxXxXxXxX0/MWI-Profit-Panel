// 全局状态管理器
class GlobalState {
    constructor() {
        this._state = {
            initClientData_itemDetailMap: {},
            initClientData_actionDetailMap: {},
            initClientData_openableLootDropMap: {},
            initCharacterData_characterSkills: [],
            initCharacterData_actionTypeDrinkSlotsMap: {},
            initCharacterData_characterHouseRoomMap: {},
            initCharacterData_characterItems: [],
            initCharacterData_noncombatStats: {},
            initCharacterData_communityActionTypeBuffsMap: {},
            initCharacterData_consumableActionTypeBuffsMap: {},
            initCharacterData_houseActionTypeBuffsMap: {},
            initCharacterData_equipmentActionTypeBuffsMap: {},
            initCharacterData_achievementActionTypeBuffsMap: {},
            initCharacterData_personalActionTypeBuffsMap: {},
            initCharacterData_mooPassActionTypeBuffsMap: {}, 
            hasMarketItemUpdate: false,
            isZHInGameSetting: false,
            freshnessMarketJson: {},
            medianMarketJson: {},
            processingMap: {},
            en2ZhMap: {},
            lootLog: [],
            profitSettings: {},
            itemEnhanceLevelToBuffBonusMap: {
                0: 0, 1: 2, 2: 4.2, 3: 6.6, 4: 9.2, 5: 12,
                6: 15, 7: 18.2, 8: 21.6, 9: 25.2, 10: 29,
                11: 33.4, 12: 38.4, 13: 44, 14: 50.2, 15: 57,
                16: 64.4, 17: 72.4, 18: 81, 19: 90.2, 20: 100,
            }
        };

        this._listeners = new Set();

        return new Proxy(this, {
            get(target, prop) {
                if (prop in target._state) {
                    return target._state[prop];
                }
                return target[prop];
            },
            set(target, prop, value) {
                if (prop in target._state) {
                    target._state[prop] = value;
                    target._notifyListeners(prop, value);
                    return true;
                }
                target[prop] = value;
                return true;
            }
        });
    }

    _notifyListeners(prop, value) {
        this._listeners.forEach(cb => cb(prop, value));
    }

    subscribe(callback) {
        this._listeners.add(callback);
        return () => this._listeners.delete(callback);
    }
}

export default new GlobalState();
