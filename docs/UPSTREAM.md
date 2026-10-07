# Clawd 升级维护

使用未修改的 [Clawd on Desk](https://github.com/rullerzhou-afk/clawd-on-desk)，package 1.2.0，锁定 commit `c0b0c13be63bc2fddceb07da6bc92d06efccf975`。版本记录在 `host/upstream.json`。

主题采用原生支持的透明动画 WebP 与 schemaVersion 1。日常维护转换后模型的渲染、主题映射和素材；三个 harness 的事件接入交给 Clawd。

| 上游范围 | 升级时检查 |
|---|---|
| theme schema、loader、资源 sanitizer | 31 个主题通过 CLI 校验，预览和实际宿主能加载 |
| 状态机、睡眠和反应 | 单次出错/完成、坐下/深睡/起身、任务优先级和点击/拖拽 |
| Codex / Claude / DSH 适配器 | hook 路径、事件支持版本、真实短会话；DSH 仍是上游 experimental 集成 |
| Electron、图像解码、窗口 | 384×416 / 60 fps 素材播放、透明背景、缩放和多显示器 |

升级时保留当前安装，在新检出中选择明确的上游 commit。运行主题校验、项目测试、相关上游测试和真实桌面检查后，再更新版本锁定与安装副本。