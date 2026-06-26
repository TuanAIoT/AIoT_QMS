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
pnpm dev:mock-zalo-qms
pnpm dev:linux-audio-service
```

Cũng có thể dùng filter trực tiếp:

```powershell
pnpm --filter @qms/web-teller dev
```

`Display_Service_Quality` chỉ là skeleton với trạng thái `OWNER_PENDING` và `NOT_IN_PHASE_1`.

### Zalo App MVP với mock API

`apps/Zalo_App` hiện có MVP Zalo Mini App để lấy số thứ tự qua mock API local. Đây chưa phải backend thật, chưa tích hợp OA message, webhook, access token, app secret hoặc dữ liệu công dân.

Tạo file `apps/Zalo_App/.env.development` từ `.env.example` nếu cần cấu hình lại:

```powershell
Copy-Item apps\Zalo_App\.env.example apps\Zalo_App\.env.development
```

Giá trị development mặc định:

```dotenv
VITE_ZALO_BROWSER_DEVELOPMENT=true
VITE_QMS_API_BASE_URL=http://127.0.0.1:3003
```

Chạy mock API:

```powershell
pnpm dev:mock-zalo-qms
```

Chạy Zalo App local ở terminal khác:

```powershell
pnpm dev:zalo-app
```

Các endpoint mock chính:

- `GET /health`
- `GET /api/zalo/services`
- `POST /api/zalo/tickets`
- `GET /api/zalo/tickets/:ticketId`
- `POST /api/zalo/dev/reset`
- `POST /api/zalo/dev/call-next`

Build để deploy Development bằng Zalo CLI:

```powershell
pnpm --filter @qms/zalo-app build
pnpm --filter @qms/zalo-app zmp:sync-config
pnpm --filter @qms/zalo-app zmp:deploy
```

`APP_ID` và `VITE_ZALO_MINI_APP_ID` là định danh public của Mini App, không phải secret. Không commit token, app secret hoặc production endpoint.

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

Workspace có 19 project: một root project, 7 App, 6 shared package và 5 mock package. Các lệnh root `build`, `typecheck` và `test` dùng `pnpm -r`, vì vậy pnpm báo `18 of 19 workspace projects`: 18 project con được thực thi, còn root chỉ điều phối lệnh. Root không có build/typecheck target riêng; cho root tham gia recursive command sẽ gọi lại chính lệnh điều phối.

## 10. Giới hạn giai đoạn hiện tại

Workspace hiện vẫn ở giai đoạn development/mock. Chưa triển khai backend thật, authentication production, MQTT production, MongoDB, queue algorithm, EWT, load balancing, sync engine, audio playback hoặc production infrastructure.
