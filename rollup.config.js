import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { babel } from '@rollup/plugin-babel';
import fs from 'fs';

let last = Date.now();
const isDev = process.env.NODE_ENV === 'development';

// 从 package.json 读取版本号
const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));
const version = pkg.version;

function updateBanner() {
    if (Date.now() - last > 1000) last = Date.now();
    const banner = `// ==UserScript==
// @name         MWI Profit Panel - Dev
// @namespace    http://tampermonkey.net/
// @version      ${version}-alpha${last}
// @description  Development version of MWI Profit Panel
// @author       MengLan
// @match        https://www.milkywayidle.com/*
// @match        https://test.milkywayidle.com/*
// @match        https://www.milkywayidlecn.com/*
// @match        https://test.milkywayidlecn.com/*
// @grant        GM_addStyle
// @grant        GM_getResourceText
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      localhost
// @connect      raw.githubusercontent.com
// @connect      ghproxy.net
// @connect      mooket.qi-e.top
// @require      https://cdn.jsdelivr.net/npm/bootstrap@5.3.7/dist/js/bootstrap.bundle.min.js
// @require      https://cdn.jsdelivr.net/npm/lz-string@1.5.0/libs/lz-string.min.js
// @resource     bootstrapCSS  https://cdn.jsdelivr.net/npm/bootstrap@5.3.7/dist/css/bootstrap.min.css
// @downloadURL  http://localhost:8088/MWI-Profit-Panel-Dev.user.js
// @updateURL    http://localhost:8088/MWI-Profit-Panel-Dev.meta.js
// ==/UserScript==`

    fs.writeFileSync('dist/MWI-Profit-Panel-Dev.meta.js', banner);
    return banner;
}

const prodBanner = `// ==UserScript==
// @name         MWI Profit Panel
// @namespace    http://tampermonkey.net/
// @version      ${version}
// @description  milkywayidle游戏利润插件，在右面板添加了根据当前市场数据计算出来的收益详情，掉落记录展示了掉落详情
// @author       MengLan
// @match        https://www.milkywayidle.com/*
// @match        https://test.milkywayidle.com/*
// @match        https://www.milkywayidlecn.com/*
// @match        https://test.milkywayidlecn.com/*
// @grant        GM_addStyle
// @grant        GM_getResourceText
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      raw.githubusercontent.com
// @connect      ghproxy.net
// @connect      mooket.qi-e.top
// @require      https://cdn.jsdelivr.net/npm/bootstrap@5.3.7/dist/js/bootstrap.bundle.min.js
// @require      https://cdn.jsdelivr.net/npm/lz-string@1.5.0/libs/lz-string.min.js
// @resource     bootstrapCSS  https://cdn.jsdelivr.net/npm/bootstrap@5.3.7/dist/css/bootstrap.min.css
// @license      MIT
// ==/UserScript==`;

export default {
    input: 'src/index.js',
    output: {
        file: isDev ? 'dist/MWI-Profit-Panel-Dev.user.js' : 'dist/MWI-Profit-Panel.user.js',
        format: 'iife',
        banner: () => isDev ? updateBanner() : prodBanner,
    },
    plugins: [
        nodeResolve(),
        commonjs(),
        babel({
            babelHelpers: 'bundled',
        }),
        // versionUpdatePlugin(),
    ],
    watch: {
        buildDelay: 100,
        clearScreen: false,
        skipWrite: false,
        exclude: ['node_modules/**'],
        include: ['src/**'],
    }
};
