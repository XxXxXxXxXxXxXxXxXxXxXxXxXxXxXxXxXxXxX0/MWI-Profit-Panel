import globals from "./globals";

class Buff {
    constructor() {
        this.artisan = 0;              // "Reduces required materials during production"
        this.action_speed = 0;         // "Decreases time cost for the action"
        this.alchemy_success = 0;      // "Multiplicative bonus to success rate while alchemizing"
        this.blessed = 0;              // "Chance to gain +2 instead of +1 on enhancing success"
        this.combat_drop_quantity = 0; // "Increases quantity of combat loot",
        this.efficiency = 0;           // "Chance of repeating the action instantly"
        this.essence_find = 0;         // "Increases drop rate of essences"
        this.enhancing_success = 0;    // "Multiplicative bonus to success rate while enhancing",
        this.gathering = 0;            // "Increases gathering quantity"
        this.wisdom = 0;               // "Increases experience gained"
        this.processing = 0;           // "Chance to instantly convert gathered resource into processed material"
        this.rare_find = 0;            // "Increases rare item drop rate"
    }

    static fromBuffs(buffs) {
        const buff = new Buff();
        if (!buffs) return buff;

        for (const { typeHrid, flatBoost } of buffs) {
            switch (typeHrid) {
                case "/buff_types/artisan":
                    buff.artisan += flatBoost * 100; break;
                case "/buff_types/action_level":
                    buff.efficiency -= flatBoost; break;
                case "/buff_types/action_speed":
                    buff.action_speed += flatBoost * 100; break;
                case "/buff_types/alchemy_success":
                    buff.alchemy_success += flatBoost * 100; break;
                case "/buff_types/blessed":
                    buff.blessed += flatBoost * 100; break;
                case "/buff_types/combat_drop_quantity":
                    buff.combat_drop_quantity += flatBoost * 100; break;
                case "/buff_types/essence_find":
                    buff.essence_find += flatBoost * 100; break;
                case "/buff_types/efficiency":
                    buff.efficiency += flatBoost * 100; break;
                case "/buff_types/enhancing_success":
                    buff.enhancing_success += flatBoost * 100; break;
                case "/buff_types/gathering":
                case "/buff_types/gourmet":
                    buff.gathering += flatBoost * 100; break;
                case "/buff_types/wisdom":
                    buff.wisdom += flatBoost * 100; break;
                case "/buff_types/processing":
                    buff.processing += flatBoost * 100; break;
                case "/buff_types/rare_find":
                    buff.rare_find += flatBoost * 100; break;
                default:
                    if (typeHrid.endsWith("_level")) buff.efficiency += flatBoost;
                    else console.error(`unhandled buff type - ${typeHrid}`);
                    break;
            }
        }
        for (const key in buff) {
            if (typeof buff[key] === 'number') {
                // 使用 Number.EPSILON 确保浮点数计算精度，然后四舍五入
                buff[key] = Math.round((buff[key] + Number.EPSILON) * 100) / 100;
            }
        }
        return buff;
    }
}

class BuffsProvider {
    constructor() {
        // 缓存所有buff数据
        this.buffCache = {
            community: new Map(),
            tea: new Map(),
            equipment: new Map(),
            house: new Map(),
            achievement: new Map(), // 新增：成就缓存
            // mooPass: new Map(),
        };

        // 订阅全局数据变化
        globals.subscribe((key, value) => {
            if (key === 'initCharacterData_communityActionTypeBuffsMap') this.updateBuffCache('community', value);
            else if (key === 'initCharacterData_consumableActionTypeBuffsMap') this.updateBuffCache('tea', value);
            else if (key === 'initCharacterData_equipmentActionTypeBuffsMap') this.updateBuffCache('equipment', value);
            else if (key === 'initCharacterData_houseActionTypeBuffsMap') this.updateBuffCache('house', value);
            else if (key === 'initCharacterData_achievementActionTypeBuffsMap') this.updateBuffCache('achievement', value); // 新增订阅
        });

        this.updateBuffCache('community', globals.initCharacterData_communityActionTypeBuffsMap);
        this.updateBuffCache('tea', globals.initCharacterData_consumableActionTypeBuffsMap);
        this.updateBuffCache('equipment', globals.initCharacterData_equipmentActionTypeBuffsMap);
        this.updateBuffCache('house', globals.initCharacterData_houseActionTypeBuffsMap);
        this.updateBuffCache('achievement', globals.initCharacterData_achievementActionTypeBuffsMap); // 新增初始调用
        // updateBuffCache('mooPass', globals.initCharacterData_houseActionTypeBuffsMap);
    }

    updateBuffCache(type, data) {
        this.clearCache(type);
        for (const [actionType, buffs] of Object.entries(data)) {
            this.buffCache[type].set(actionType, Buff.fromBuffs(buffs));
        }
    }

    clearCache(type) {
        if (this.buffCache[type]) {
            this.buffCache[type].clear();
        }
    }

    getCommunityBuff(actionTypeHrid) {
        return this.buffCache.community.get(actionTypeHrid) || new Buff();
    }

    getTeaBuffs(actionTypeHrid) {
        return this.buffCache.tea.get(actionTypeHrid) || new Buff();
    }

    getHouseBuff(actionTypeHrid) {
        return this.buffCache.house.get(actionTypeHrid) || new Buff();
    }

    getEquipmentBuff(actionTypeHrid) {
        return this.buffCache.equipment.get(actionTypeHrid) || new Buff();
    }
    // 在 BuffsProvider 类中添加新方法
    getAchievementBuff(actionTypeHrid) {
    return this.buffCache.achievement.get(actionTypeHrid) || new Buff();
    }
}

// "community_buffs_updated" === e.type ? this.handleMessageCommunityBuffsUpdated(e)
export default new BuffsProvider();
