来源：https://github.com/nextapps-de/flexsearch
版本：0.8.212（dist/flexsearch.compact.min.js，UMD）
许可：Apache-2.0（全文见 flexsearch.LICENSE.txt）
为什么是 compact：只有 compact / bundle 构建带 Charset（内置 CJK 编码器），light 构建的 Charset 是 null。
为什么不用 bundle：bundle 多出的 Document / Worker / 索引导出我们暂时用不到，gzip 后 17.7KB vs compact 10.8KB。
更新方式：npm i flexsearch@<版本> 后重新拷这两个文件（见 STRUCTURE.md）。
