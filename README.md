# spDJ

为[卫戍协议](https://github.com/sganggs/Stronghold-Protocol) 0.3.3 提供网页端自定义 BGM / DJ 播放器。非官方同人模块。

## 开始使用

只需服主安装。玩家打开原来的地址即可，电脑和手机不用另装软件。

解压游戏后的文件夹叫 `Stronghold-Protocol`。模块文件放在：

```
Stronghold-Protocol/public/sp-lite/
```

安装程序还会改这一个文件：

```
Stronghold-Protocol/public/index.html
```

### Windows

1. 关闭游戏服务。
2. 把本文件夹放到 `Stronghold-Protocol/spDJ/`，双击 `Stronghold-Protocol/spDJ/windows/install.bat`。
3. 重新启动游戏，并刷新浏览器。

更新本模块时再双击一次这个 bat。更新游戏前先双击 `Stronghold-Protocol/spDJ/windows/uninstall.bat`，更新完成后再安装。

### Linux

1. 关闭游戏服务。
2. 把本文件夹放到 `Stronghold-Protocol/spDJ/`，然后执行：

```sh
sh Stronghold-Protocol/spDJ/linux/install.sh Stronghold-Protocol
```

3. 重新启动游戏服务，并刷新浏览器。

更新本模块时再执行一次上面的命令。更新游戏前先执行：

```sh
sh Stronghold-Protocol/spDJ/linux/uninstall.sh Stronghold-Protocol
```

不能放进游戏的插件工作台。

## 目录

```
public/sp-lite/   模块脚本与皮肤资源
mod.json
README.md
LICENSE
NOTICE.md
windows/          Windows 安装与卸载
linux/            Linux 安装与卸载
```

## 功能

- 悬浮球打开迷你 DJ 面板，可替换原 BGM
- 本地上传单曲 / 文件夹，列表循环 / 单曲 / 随机
- BPM 粗估与精确分析，可选 mix 智能接曲
- 放电 / 锐舞动效，阿米娅 / mmk 皮肤
- 手机与桌面浏览器可用

## 兼容

电脑、手机和平板浏览器都可以使用。只改网页播放层，不改对局，也不另开端口。放进已有的 0.3.3 游戏目录后，由原来的网站一起提供。服主和玩家都不用再安装运行环境。

音频仅在用户本机浏览器解码播放。

## 许可与声明

本模块自己编写的代码以 **GPL-3.0-or-later** 发布，全文见 [LICENSE](LICENSE)。

非官方、非商业同人模块，与上海鹰角网络科技有限公司、Yostar 及卫戍协议原作者没有关系，未获其授权。本仓库不包含游戏美术、音乐、文本或数据，这些内容版权归原权利人所有，不适用上述许可证。按原样提供，不提供担保。完整说明见 [NOTICE.md](NOTICE.md)。
