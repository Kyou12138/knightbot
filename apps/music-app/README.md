# Music App

免费跨平台音乐播放器（iOS / Android / Web），默认接入 `music-api.gdstudio.xyz`。

## 功能

- 歌曲搜索（多音源切换：`netease / tencent / kugou`）
- 音质切换（128k / 320k）
- 在线播放（播放/暂停/上下曲/进度拖动）
- 播放模式（顺序播放 / 单曲循环 / 随机播放）
- 封面与歌词展示
- LRC 时间轴歌词高亮滚动
- 本地收藏与最近播放（重启后保留）
- 春节氛围 UI（红金主题 + 灯笼窗花装饰）

## 本地启动

```bash
cd apps/music-app
npm install
npm run start
```

常用命令：

- `npm run android`
- `npm run ios`
- `npm run web`
- `npm run typecheck`

## 接口说明

接口文档：`https://music-api.gdstudio.xyz/api.php`

当前使用：

- `types=search`
- `types=url`
- `types=pic`
- `types=lyric`

说明：该 API 有频率限制（约 1 秒一次），项目中已做基础节流控制。

## 目录结构

```txt
apps/music-app
  App.tsx
  src/
    api/musicApi.ts
    hooks/useAudioPlayer.ts
    components/
    styles/
```
