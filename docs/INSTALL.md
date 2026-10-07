# MYSEKAI · Clawd 主题包

26 位角色、31 个 JP 模型版本，736 段 384×416 / 60 fps 透明动画。角色和白色花园椅保留高清渲染；WebP 质量 95，透明通道无损。

## 安装

1. 从 [Clawd on Desk 上游](https://github.com/rullerzhou-afk/clawd-on-desk) 安装宿主，并按其提示启用 Codex、Claude Code 或 DeepSeek Harness 接入。
2. 退出 Clawd，把本包 `themes` 内需要的 `pjsk-*` 文件夹复制到宿主用户数据目录的 `themes` 文件夹。Windows 默认路径为 `%APPDATA%\clawd-on-desk\themes`。
3. 重启，在 **设置 → 主题** 中选择角色。

升级时先备份个人修改，再替换同名角色的整个文件夹。每个角色可以单独安装，不需要宿主补丁。不含鼠标视线跟随。DSH 接入属于宿主 experimental 功能。

出错和完成动作只播放一次，随后恢复宿主判断的状态。空闲约 2 分钟进入浅睡，约 10 分钟坐椅深睡，唤醒时起身。实际事件触发取决于宿主和 harness 配置。

版本及动作明细见 `pack.json`；来源追踪见 `source-provenance.json` 和各主题 `source.json`。兼容性验证基线为 Clawd 1.2.0（commit c0b0c13be63bc2fddceb07da6bc92d06efccf975）。

非官方同人资源，游戏素材权利属于原权利人；详见 [来源与权利](docs/SOURCES.md)。
