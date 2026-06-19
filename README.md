# QMS Tuấn Workspace

Monorepo chứa các Web App, Linux service, package dùng chung và development mock thuộc phạm vi của Tuấn trong hệ thống QMS Local-First.

> **Contract warning:** `docs/API_CONTRACT.md` và `docs/MQTT_CONTRACT.md` hiện là DRAFT. Không coi endpoint, topic hoặc payload `BACKEND_CONFIRMATION_REQUIRED` là contract Backend chính thức.

## 1. Yêu cầu môi trường

- Node.js 20 trở lên
- Corepack đi kèm Node.js
- pnpm 9.x, workspace ghim phiên bản `9.15.9`

Kiểm tra môi trường:

```powershell
node --version
corepack --version
pnpm --version
```

## 2. Cài pnpm

Khuyến nghị dùng Corepack để khớp phiên bản trong `package.json`:

```powershell
corepack enable
corepack prepare pnpm@9.15.9 --activate
```

Nếu Corepack đi kèm Node.js cũ gặp lỗi xác minh signing key, có thể cài đúng phiên bản đã ghim:

```powershell
npm install --global pnpm@9.15.9
```

## 3. Cài dependency

Tại thư mục root:

```powershell
Set-Location 'E:\AIoT\Code\Web\QMS'
pnpm install
```

## 4. Chạy từng App

```powershell
pnpm dev:display-central
pnpm dev:display-service-quality
pnpm dev:web-admin-local
pnpm dev:web-central-admin
pnpm dev:web-teller
pnpm dev:zalo-app
pnpm dev:linux-audio-service
```

Cũng có thể dùng filter trực tiếp:

```powershell
pnpm --filter @qms/web-teller dev
```

`Display_Service_Quality` chỉ là skeleton với trạng thái `OWNER_PENDING` và `NOT_IN_PHASE_1`.

## 5. Build toàn workspace

```powershell
pnpm build
```

Build một App độc lập:

```powershell
pnpm --filter @qms/web-teller build
```

## 6. Chạy lint

```powershell
pnpm lint
```

## 7. Chạy typecheck

```powershell
pnpm typecheck
```

## 8. Chạy test

```powershell
pnpm test
```

## 9. Cấu trúc thư mục

- `apps/`: sáu React/Vite Web App và `Linux_Audio_Service`.
- `packages/`: contract, client, utility, UI và configuration package dùng chung.
- `mocks/`: skeleton Mock Local, Mock Central, MQTT simulator và seed data.
- `tests/e2e/`: vị trí dành cho end-to-end tests sau này.
- `infra/`: tài liệu giữ chỗ cho MQTT, systemd và nginx; chưa có cấu hình production.
- `docs/`: kiến trúc và contract DRAFT.

Workspace có 18 project: một root project, 7 App, 6 shared package và 4 mock package. Các lệnh root `build`, `typecheck` và `test` dùng `pnpm -r`, vì vậy pnpm báo `17 of 18 workspace projects`: 17 project con được thực thi, còn root chỉ điều phối lệnh. Root không có build/typecheck target riêng; cho root tham gia recursive command sẽ gọi lại chính lệnh điều phối.

## 10. Giới hạn giai đoạn hiện tại

Workspace hiện chỉ có skeleton kỹ thuật. Chưa triển khai UI nghiệp vụ, authentication, API endpoint, MQTT topic/payload, MongoDB, queue algorithm, EWT, load balancing, sync engine, audio playback hoặc production infrastructure.
