# pi-desktop

An Electron application with React and TypeScript

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
$ pnpm install
```

### Development

```bash
$ pnpm dev
```

### Build

```bash
# For windows
$ pnpm build:win

# For macOS
$ pnpm build:mac

# For Linux
$ pnpm build:linux
```

## macOS 测试版安装

在接入 Developer ID 签名与公证前，GitHub Release 中的 macOS 测试构建会被 Gatekeeper 隔离。打开 DMG 后，将应用拖入“应用程序”，再在终端执行：

```bash
xattr -dr com.apple.quarantine "/Applications/pi-desktop.app"
```

这仅适用于测试版。正式公开发布应使用 Developer ID 签名与公证，不应要求用户执行此命令。
