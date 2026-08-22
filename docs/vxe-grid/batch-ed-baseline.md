Baseline 完成:`, no source files were modified.

**输出**: `/home/u1/iris-ui/docs/vxe-grid/batch-ed-baseline.md`(79 行)— git status 确认唯一新增为本 doc,其余 M/?? 均为既有 dirty。

**核实的事实**(实测):

- HEAD `7e14ccab`(批 EC 已合入);manifest IrisTable **207 props/33 events** → ED → **208 props**
- 验证快照:react 256 files **2987/2987**、core **1641/1641**(批 EC gate 快照)
- 对比咽喉 `compareDiff = diffRows(liveData, compareWith, rowKey)`(Table.tsx:1381,方向 before=live/after=快照)+ `compareDiffRef/compareWithRef` 镜像(:4785–4788)→ merge 直接复用现成 `RowDiff.added/changed`,零新 diff 逻辑
- 写回咽喉 `commitRowList(next, type)`(:3983)= recordHistory→recordUndo→recordAudit→setLiveData→onDataChange——merge 走它自动获得审计/撤销/版本全通道;`AuditLogType` 联合无 exhaustive switch,加 `'merge'` 类型安全(AuditPanel 原文渲染,零 i18n)
- 工具栏 gate(:7950 列表尾)逐批追加先例;撤销簇后(:8067 前)为按钮插入位;en/zh i18n 键位、测试先例(batch-ec 19例/≤500行)均核实

**设计要点**: `mergeCompare?: boolean`(props/advanced.ts,compareWith 后)> changed 原地替换 + added 按快照序追加 + **removed 不动**(spec 限 changed/added)> 浅拷贝行(不 alias 快照元素)> gate `|| mergeCompare`(compareWith 本身不渲染工具栏)> 文本标签按钮 `data-iris-table-compare-merge`,无可合并时 disabled + `length===0` 早退双保险幂等> en `'Merge compare'` / zh `'合并差异'`。

**文件图 7 项**: advanced.ts、Table.tsx、core audit-log.ts(+`'merge'` 类型成员)、core i18n-messages.ts、plugin-locale-zh、新 test/batch-ed.test.tsx、manifest 重新生成。

**测试计划 19 例**: 门控 5(off/无 compareWith/无 rowKey/一致快照 disabled/移除消失) · 合并结果 8(原地替换/追加序/removed 不动/未变保留/空表全 add/键空跳/幂等/合并后 attrs 翻转) · 通道 5(onDataChange/单条 audit 'merge'/undo/版本 restore/选中保持) · 契约 3(attr+disabled、en、zh 覆写)。另有 9 条显式 fiat 供 gate 仲裁。
