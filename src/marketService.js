import { formatNumber, getDuration, getMwiObj, TimeSpan, } from './utils.js';
import globals from './globals.js';


const officialConfig = {
    cacheKey: "officialMarketDataCache",
    targetUrls: ["https://www.milkywayidle.com/game_data/marketplace.json", "https://www.milkywayidlecn.com/game_data/marketplace.json"],
    dataTransfer: data => {
        data.market = data.marketData;
        delete data.marketData;
        data.time = data.timestamp;
        delete data.timestamp;
    },
    dataRefreshInterval: TimeSpan.FOUR_HOURS,
};

const mooketConfig = {
    cacheKey: "mooketMarketDataCache",
    targetUrls: ["https://mooket.qi-e.top/market/api.json"],
    dataTransfer: data => {
        data.market = data.marketData;
        delete data.marketData;
        data.time = data.timestamp;
        delete data.timestamp;
    },
    dataRefreshInterval: TimeSpan.HALF_HOURS,
};

class MWIApiMarketJson {
    constructor(config) {
        this.dataRefreshInterval = config.dataRefreshInterval || TimeSpan.ONE_HOURS;
        this.cacheMaxAge = TimeSpan.FIVE_MINUTES;
        this.retryInterval = TimeSpan.TEN_SECONDS;
        this.refreshTimer = null;
        this.data = null;

        this.cacheKey = config.cacheKey;
        this.targetUrls = config.targetUrls;
        this.dataTransfer = config.dataTransfer;

        this.fetchMarketJson();

        return new Proxy(this, {
            get(target, prop) {
                if (target.data) return target.data[prop];
                return null;
            },
            set(target, prop, value) {
                // Cant be set outside
                return true;
            }
        });
    }

    clearRefreshTimer() {
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = null;
        }
    };

    schedualNextRefresh({ data, timestamp }) {
        if (data) {
            this.data = data;
            dispatchEvent(new CustomEvent(this.cacheKey, { detail: data }));
            globals.hasMarketItemUpdate = true; // 主动刷新数据
        }

        const now = Date.now();
        const cacheAge = now - timestamp;
        const dataAge = data?.time ? now - new Date(data.time * 1000).getTime() : this.dataRefreshInterval;
        const nextRefreshTime = data ? Math.max(this.dataRefreshInterval - dataAge, this.cacheMaxAge - cacheAge, this.retryInterval) : this.retryInterval;
        this.clearRefreshTimer();
        this.refreshTimer = setTimeout(async () => {
            this.clearRefreshTimer();
            await this.fetchMarketJson();
        }, nextRefreshTime);
    }

    fetchMarketJson() {
        // 检查缓存
        const cachedData = localStorage.getItem(this.cacheKey);
        if (cachedData) {
            try {
                const { data, timestamp } = JSON.parse(cachedData);
                const now = Date.now();
                const cacheAge = now - timestamp;
                const dataAge = data?.time ? now - new Date(data.time * 1000).getTime() : this.dataRefreshInterval;

                // 如果数据未过期（1小时内）或 缓存足够新（5分钟内）
                if (dataAge < this.dataRefreshInterval || cacheAge < this.cacheMaxAge) {
                    this.schedualNextRefresh({ data, timestamp });
                    return data;
                }
            } catch (e) {
                console.error('Failed to parse cache:', e);
            }
        }

        return new Promise((resolve) => {
            const urls = this.targetUrls;

            let currentIndex = 0;

            const tryNextUrl = () => {
                if (currentIndex >= urls.length) {
                    // 所有URL尝试失败，返回缓存或null
                    if (cachedData) {
                        try {
                            const { data } = JSON.parse(cachedData);

                            resolve(data);
                        } catch (e) {
                            resolve(null);
                        }
                    }
                    else {
                        resolve(null);
                    }
                    return;
                }

                try {
                    GM_xmlhttpRequest({
                        method: "GET",
                        url: urls[currentIndex],
                        onload: (response) => {
                            try {
                                let data = JSON.parse(response.responseText);
                                if (this.dataTransfer) this.dataTransfer(data);
                                if (!data?.market) {
                                    throw new Error('Invalid market data structure');
                                }

                                // 更新缓存
                                localStorage.setItem(this.cacheKey, JSON.stringify({
                                    data,
                                    timestamp: Date.now(),
                                }));

                                resolve(data);
                            } catch (e) {
                                console.error('Failed to parse market data:', e);
                                currentIndex++;
                                tryNextUrl();
                            }
                        },
                        onerror: function (error) {
                            console.error(`Failed to fetch market data from ${urls[currentIndex]}:`, error);
                            currentIndex++;
                            tryNextUrl();
                        }
                    });
                } catch (error) {
                    console.error('Request setup failed:', error);
                    currentIndex++;
                    tryNextUrl();
                }
            };

            tryNextUrl();
        }).then(data => {
            this.schedualNextRefresh({ data, timestamp: Date.now() });
            return data;
        });
    }
}

class MooketMarketRealtime {
    constructor(updateCallback) {
        this.mwi = getMwiObj();
        this.updateCallback = updateCallback;
        addEventListener('MWICoreItemPriceUpdated', (e) => {
            console.log({ detail: e.detail });
            const price = this.parseRealtimePrice(e.detail)
            if (price) {
                this.updateCallback(price);
            }
        });
    }

    parseRealtimePrice({ priceObj, itemHridLevel }) {
        if (!itemHridLevel) return;
        const [itemHrid, level] = itemHridLevel.split(":");
        if (level !== "0") return;

        const item = globals.initClientData_itemDetailMap[itemHrid];
        return {
            name: item.name,
            ask: priceObj.ask,
            bid: priceObj.bid,
            time: priceObj.time,
        };
    }
}

const DataSourceKey = {
    Official: "Official",
    MooketApi: "MooketApi",
    Mooket: "Mooket",
    User: "User",
    Init: "Init",
};

// MedianMarketCache - 管理历史市场数据快照
class MedianMarketCache {
    constructor() {
        this.cacheKey = "medianMarketSnapshotCache";
        this.data = null;
        this.loadFromCache();

        return new Proxy(this, {
            get(target, prop) {
                // 优先返回目标对象自身的方法和属性
                if (prop in target && typeof target[prop] === 'function') {
                    return target[prop].bind(target);
                }
                if (prop === 'market') {
                    return target.data || {};
                }
                if (target.data && prop in target.data) {
                    return target.data[prop];
                }
                return target[prop];
            },
            set(target, prop, value) {
                // 不允许外部直接设置
                return true;
            }
        });
    }

    loadFromCache() {
        try {
            const cached = localStorage.getItem(this.cacheKey);
            if (cached) {
                this.data = JSON.parse(cached);
                console.log('[MedianMarketCache] 从缓存加载历史数据');
            }
        } catch (e) {
            console.error('[MedianMarketCache] 加载缓存失败:', e);
        }
    }

    update(currentMarketData) {
        try {
            // 深拷贝当前市场数据作为新的历史快照
            this.data = JSON.parse(JSON.stringify(currentMarketData));
            // 持久化到 localStorage
            localStorage.setItem(this.cacheKey, JSON.stringify(this.data));
            console.log('[MedianMarketCache] 更新历史数据快照');
        } catch (e) {
            console.error('[MedianMarketCache] 更新快照失败:', e);
        }
    }

    setDefault(defaultMarketData) {
        // 仅在首次初始化且没有缓存数据时使用
        if (!this.data && defaultMarketData) {
            this.data = JSON.parse(JSON.stringify(defaultMarketData));
            localStorage.setItem(this.cacheKey, JSON.stringify(this.data));
            console.log('[MedianMarketCache] 设置默认历史数据');
        }
    }
}

class UnifyMarketData {
    constructor(itemDetailMap) {
        this.market = {};
        this.name2Hrid = {};
        this.statMap = {
            src: {},
            oldestItem: {},
            newestItem: {},
        };
        this.time = Date.now() / 1000;
        this.initMarketData(itemDetailMap);

        if (globals.profitSettings.dataSourceKeys.includes(DataSourceKey.Official)) {
            addEventListener(officialConfig.cacheKey, (e) => this.updateDataFromOfficialStyle(e.detail, DataSourceKey.Official));
            this.officialMarketJson = new MWIApiMarketJson(officialConfig);
        }
        if (globals.profitSettings.dataSourceKeys.includes(DataSourceKey.MooketApi)) {
            addEventListener(mooketConfig.cacheKey, e => this.updateDataFromOfficialStyle(e.detail, DataSourceKey.MooketApi));
            this.mooketMarketJson = new MWIApiMarketJson(mooketConfig);
        }
        if (globals.profitSettings.dataSourceKeys.includes(DataSourceKey.Mooket)) {
            this.mooketRealtime = new MooketMarketRealtime(item => this.updateRealtimePrice(item));
        }
    }

    initMarketData(itemDetailMap) {
        for (const [hrid, item] of Object.entries(itemDetailMap)) {
            if (item?.isTradable) {
                this.market[item.name] = {
                    ask: item.sellPrice,
                    bid: item.sellPrice,
                    time: 0,
                    src: DataSourceKey.Init,
                };
                this.name2Hrid[item.name] = hrid;
            }
        }
        this.mergeFromCache();

        this.postUpdate();
    }

    updateDataFromOfficialStyle(marketJson, src) {
        // 在更新新数据前，先保存当前数据作为历史快照
        if (globals.medianMarketJson?.update) {
            globals.medianMarketJson.update(this.market);
        }

        const time = marketJson.time;
        for (const [name, item] of Object.entries(this.market)) {
            if (item.time > time) continue;
            const hrid = this.name2Hrid[name];
            const newPrice = marketJson?.market[hrid];
            if (!newPrice || !newPrice["0"]) continue;
            const level0 = newPrice["0"];
            Object.assign(item, {
                ask: level0.a,
                bid: level0.b,
                src,
                time
            });
        }
        this.postUpdate();
    }

    updateRealtimePrice(item) {
        const targetItem = this.market[item.name];
        if (targetItem?.time < item?.time) {
            Object.assign(targetItem, {
                ask: item.ask,
                bid: item.bid,
                src: DataSourceKey.Mooket,
                time: item.time,
            });
            this.postUpdate();
        }
    }

    updateDataFromMarket(marketItemOrderBooks) {
        const itemHrid = marketItemOrderBooks?.itemHrid;
        if (itemHrid) {
            const item = globals.initClientData_itemDetailMap[itemHrid];
            const orderBook = marketItemOrderBooks?.orderBooks[0];
            const ask = orderBook?.asks?.length > 0 ? orderBook.asks[0].price : item.sellPrice;
            const bid = orderBook?.bids?.length > 0 ? orderBook.bids[0].price : item.sellPrice;
            const targetItem = this.market[item.name];
            Object.assign(targetItem, {
                ask,
                bid,
                src: DataSourceKey.User,
                time: Date.now() / 1000,
            });
            this.postUpdate();
        }
    }

    postUpdate() {
        const newStas = {};
        let oldestItem = {
            name: "",
            time: Date.now() / 1000,
        }
        let newestItem = {
            name: "",
            time: 0,
        }
        let total = 0;
        for (const [name, item] of Object.entries(this.market)) {
            if (!newStas[item.src]) newStas[item.src] = 0;
            newStas[item.src]++;
            if (item.time < oldestItem.time) oldestItem = {
                name,
                time: item.time,
            }
            if (item.time > newestItem.time) newestItem = {
                name,
                time: item.time,
            }
            ++total;
        }
        this.time = oldestItem.time;
        Object.assign(this.statMap, { src: { ...newStas, total }, oldestItem, newestItem });

        this.dumpToCache();
        globals.hasMarketItemUpdate = true;
    }

    mergeFromCache() {
        const cacheMarket = JSON.parse(GM_getValue('UnifyMarketData', '{}'));
        for (const [name, item] of Object.entries(this.market)) if (cacheMarket[name]) {
            const { ask, bid, src, time } = cacheMarket[name];
            if (DataSourceKey[src]) {
                Object.assign(item, { ask, bid, src, time });
            }
        }
    }

    dumpToCache() {
        GM_setValue('UnifyMarketData', JSON.stringify(this.market));
    }

    stat() {
        const dataSrcArr = [];
        for (const [k, val] of Object.entries(DataSourceKey)) {
            if (this.statMap.src[val]) {
                dataSrcArr.push(`${val} (${formatNumber(this.statMap.src[val] * 100 / this.statMap.src.total)}%)`);
            }
        }
        const oldestStr = `${globals.en2ZhMap[this.statMap.oldestItem.name]}(${getDuration(new Date(this.statMap.oldestItem.time * 1000))})`;
        const newestStr = `${globals.en2ZhMap[this.statMap.newestItem.name]}(${getDuration(new Date(this.statMap.newestItem.time * 1000))})`;

        return `最旧：${oldestStr} 数据来源：[${dataSrcArr.join(',')}]`;
    }
}

export async function preFetchData() {
    // 初始化历史数据缓存
    globals.medianMarketJson = new MedianMarketCache();

    // 初始化统一市场数据
    globals.freshnessMarketJson = new UnifyMarketData(globals.initClientData_itemDetailMap);

    // 如果是第一次运行（没有历史缓存），使用初始市场数据作为默认值
    if (globals.medianMarketJson?.setDefault) {
        globals.medianMarketJson.setDefault(globals.freshnessMarketJson.market);
    }
};
