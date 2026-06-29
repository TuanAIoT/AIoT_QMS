# Zalo QMS Public API Contract

> Status: **DRAFT - BACKEND_CONFIRMATION_REQUIRED**
>
> Tài liệu này được suy ra từ frontend hiện tại ở `apps/Zalo_App/src/qms-api.ts`, `apps/Zalo_App/src/App.tsx` và mock API ở `mocks/mock-zalo-qms-server`.
>
> Mục tiêu là mô tả đúng **public API dành riêng cho Zalo Mini App** mà backend thật cần thay thế. Tài liệu này **không** mở rộng sang API CRUD quản trị nội bộ.

## Mục lục

- [1. Mục tiêu](#1-mục-tiêu)
- [2. Phạm vi và nguồn suy ra contract](#2-phạm-vi-và-nguồn-suy-ra-contract)
- [3. Base URL](#3-base-url)
- [4. Format response chung](#4-format-response-chung)
- [5. Bảo mật, PII và nguyên tắc public API](#5-bảo-mật-pii-và-nguyên-tắc-public-api)
- [6. Kiểu dữ liệu dùng chung](#6-kiểu-dữ-liệu-dùng-chung)
- [7. Endpoint contract](#7-endpoint-contract)
  - [7.1 GET /locations](#71-get-locations)
  - [7.2 GET /locations/{locationId}/areas](#72-get-locationslocationidareas)
  - [7.3 GET /locations/{locationId}/services?areaId={areaId}](#73-get-locationslocationidservicesareaidareaid)
  - [7.4 POST /bookings](#74-post-bookings)
  - [7.5 GET /locations/{locationId}/bookings/current](#75-get-locationslocationidbookingscurrent)
  - [7.6 GET /locations/{locationId}/bookings/history](#76-get-locationslocationidbookingshistory)
  - [7.7 GET /bookings/{ticketId}](#77-get-bookingsticketid)
  - [7.8 POST /bookings/{ticketId}/cancel](#78-post-bookingsticketidcancel)
  - [7.9 GET /locations/{locationId}/queue-status](#79-get-locationslocationidqueue-status)
- [8. Endpoint dev/mock không thuộc public contract production](#8-endpoint-devmock-không-thuộc-public-contract-production)
- [9. Idempotency và chống tạo trùng](#9-idempotency-và-chống-tạo-trùng)
- [10. Authentication / Zalo identity](#10-authentication--zalo-identity)
- [11. CORS / preview / production](#11-cors--preview--production)
- [12. Mapping gợi ý sang backend hiện có](#12-mapping-gợi-ý-sang-backend-hiện-có)
- [13. Checklist backend cần xác nhận](#13-checklist-backend-cần-xác-nhận)

## 1. Mục tiêu

API public này phục vụ riêng cho Zalo Mini App để:

- lấy danh sách đơn vị;
- lấy lĩnh vực theo đơn vị;
- lấy dịch vụ theo lĩnh vực;
- đặt số;
- xem phiếu hiện tại;
- xem lịch sử;
- xem chi tiết phiếu / QR;
- hủy phiếu;
- xem tình hình số thứ tự.

Backend thật cần thay mock server nhưng giữ response shape ổn định để frontend hiện tại hoạt động đúng.

## 2. Phạm vi và nguồn suy ra contract

Contract này được suy ra từ các file hiện tại:

- `apps/Zalo_App/src/qms-api.ts`
- `apps/Zalo_App/src/App.tsx`
- `mocks/mock-zalo-qms-server/src/server.ts`
- `mocks/mock-zalo-qms-server/src/state.ts`
- `mocks/mock-zalo-qms-server/test/mock-zalo-qms-server.test.ts`

Format tài liệu được giữ nhất quán với `docs/API_CONTRACT.md` và `docs/MQTT_CONTRACT.md`: mọi điểm chưa chắc chắn đều ghi rõ `BACKEND_CONFIRMATION_REQUIRED`.

## 3. Base URL

Ví dụ:

- Development mock: `http://localhost:3023/api/zalo`
- Production: `https://<domain>/api/zalo`

Yêu cầu:

- Production bắt buộc dùng HTTPS.
- Public Zalo API phải tách biệt khỏi API quản trị nội bộ.
- Frontend hiện tại nối path theo dạng `baseUrl + /api/zalo/...`.

## 4. Format response chung

Frontend hiện tại chấp nhận cả:

1. dữ liệu thẳng;
2. hoặc wrapped success envelope:

```json
{
  "ok": true,
  "data": {}
}
```

Mock server hiện đang trả theo envelope trên. Backend production nên giữ đúng envelope này.

Error response đề xuất:

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dữ liệu không hợp lệ"
  }
}
```

Frontend hiện tại xử lý:

- HTTP status code
- `error.code`
- `error.message`

Error code đề xuất cho backend public:

- `VALIDATION_ERROR`
- `NOT_FOUND`
- `BOOKING_CONFLICT`
- `RATE_LIMITED`
- `QUEUE_UNAVAILABLE`
- `INTERNAL_ERROR`

Error code thực tế đang có trong mock:

- `REQUEST_TOO_LARGE`
- `INVALID_JSON`
- `INVALID_REQUEST`
- `UNKNOWN_SERVICE`
- `UNKNOWN_AREA`
- `LOCATION_NOT_FOUND`
- `SERVICE_MISMATCH`
- `TICKET_NOT_FOUND`
- `TICKET_TERMINAL`
- `NOT_FOUND`
- `INTERNAL_ERROR`

Backend cần xác nhận bộ error code chính thức cho production.

## 5. Bảo mật, PII và nguyên tắc public API

- Public API này chỉ dành cho Zalo Mini App.
- Không dùng trực tiếp các API admin CRUD cho Mini App.
- Không trả `fullName` trong queue status.
- Không trả phone/email/CCCD/address cá nhân trong queue status.
- Không log token, raw QR payload, Zalo access token.
- Zalo App chỉ gửi `fullName` khi tạo booking.
- Backend cần xác nhận chính sách lưu trữ, masking và retention của `fullName`.
- QR/check-in token phải là opaque token hoặc random token, không chứa dữ liệu cá nhân plain text.
- Public API cần rate limit.
- CORS phải phù hợp với Mini App preview và production.

Lưu ý quan trọng về frontend hiện tại:

- `qms-api.ts` hiện **đang parse `fullName`, `qrPayload`, `checkInExpiresAt`, `canCancel` như field bắt buộc trên ticket payload**.
- UI hiện không hiển thị `fullName`, nhưng frontend hiện tại vẫn cần field này để parse thành công.
- Nếu backend muốn rút gọn public payload để tránh trả `fullName`, frontend cần được cập nhật tương ứng trong một thay đổi khác. Điều này hiện là `BACKEND_CONFIRMATION_REQUIRED`.

## 6. Kiểu dữ liệu dùng chung

### 6.1 Location

| Field | Type | Required | Notes |
|---|---|---:|---|
| `locationId` | string | Yes | Public identifier của đơn vị |
| `locationName` | string | Yes | Tên đơn vị |
| `address` | string | Yes | Địa chỉ hiển thị |

### 6.2 Area

| Field | Type | Required | Notes |
|---|---|---:|---|
| `areaId` | string | Yes | Public identifier của lĩnh vực |
| `areaName` | string | Yes | Tên lĩnh vực |
| `locationId` | string | Yes | Đơn vị mà area đang được trả về |

### 6.3 Service

| Field | Type | Required | Notes |
|---|---|---:|---|
| `serviceId` | string | Yes | Public identifier của dịch vụ |
| `serviceName` | string | Yes | Tên dịch vụ |
| `serviceCode` | string | Yes | Mã dịch vụ |
| `areaId` | string | Yes | Lĩnh vực chứa dịch vụ |
| `locationId` | string | Yes | Đơn vị chứa dịch vụ |
| `description` | string \| null | Yes | Mock/frontend hiện parse `null` hoặc string |
| `bookingEnabled` | boolean | Yes | Có cho đặt số không |

### 6.4 Ticket

| Field | Type | Required by current frontend | Notes |
|---|---|---:|---|
| `ticketId` | string | Yes | Public ticket identifier |
| `ticketNumber` | string | Yes | Mock hiện trả chuỗi dạng `"0001"`; UI tự thêm `#` khi hiển thị |
| `locationId` | string | Yes | Đơn vị |
| `locationName` | string | Yes | Tên đơn vị |
| `areaId` | string | Yes | Lĩnh vực |
| `areaName` | string | Yes | Tên lĩnh vực |
| `serviceId` | string | Yes | Dịch vụ |
| `serviceName` | string | Yes | Tên dịch vụ |
| `fullName` | string | Yes | Frontend hiện parse bắt buộc; backend cần xác nhận public payload có giữ field này không |
| `bookingDate` | string | Yes | Format `YYYY-MM-DD` |
| `status` | string | Yes | Enum bên dưới |
| `createdAt` | string | Yes | ISO datetime |
| `updatedAt` | string | Yes | ISO datetime |
| `checkInExpiresAt` | string | Yes | ISO datetime |
| `qrPayload` | string | Yes | Frontend hiện dùng để render QR |
| `canCancel` | boolean | Yes | Có cho phép hủy không |

### 6.5 Queue ticket

| Field | Type | Required | Notes |
|---|---|---:|---|
| `ticketId` | string | Yes | Dùng để highlight “Phiếu của bạn” |
| `ticketNumber` | string | Yes | Chuỗi số phiếu |
| `serviceName` | string | Yes | Tên dịch vụ |

### 6.6 Queue counter

| Field | Type | Required | Notes |
|---|---|---:|---|
| `counterId` | string | Yes | Public counter identifier |
| `counterName` | string | Yes | Tên quầy |
| `serviceId` | string | Yes | Dịch vụ tại quầy |
| `serviceName` | string | Yes | Tên dịch vụ |
| `status` | `"OPEN"` \| `"CLOSED"` | Yes | Frontend hiện chỉ parse 2 trạng thái này |
| `currentTicket` | object \| null | Yes | Queue ticket hoặc `null` |
| `nextTicket` | object \| null | Yes | Queue ticket hoặc `null` |
| `waitingCount` | number | Yes | Số lượng chờ |
| `waitingTickets` | array | Yes | Danh sách chờ |
| `updatedAt` | string | Yes | ISO datetime |

### 6.7 Queue status

| Field | Type | Required | Notes |
|---|---|---:|---|
| `locationId` | string | Yes | Đơn vị đang xem |
| `locationName` | string | Yes | Tên đơn vị |
| `updatedAt` | string | Yes | ISO datetime |
| `counters` | array | Yes | Danh sách quầy |

### 6.8 Enum hiện tại trong frontend

`QmsTicketStatus`:

- `WAITING`
- `CALLED`
- `SERVING`
- `COMPLETED`
- `CANCELLED`
- `EXPIRED`

`QmsCounter.status`:

- `OPEN`
- `CLOSED`

Lưu ý:

- Prompt nghiệp vụ có đề xuất thêm `PAUSED`, `FINISHED`, `SKIPPED`.
- Tuy nhiên frontend hiện tại **chưa parse các giá trị đó**.
- Nếu backend muốn dùng enum khác, frontend cần được cập nhật sau. Đây là `BACKEND_CONFIRMATION_REQUIRED`.

## 7. Endpoint contract

## 7.1 GET /locations

Mục đích: lấy danh sách đơn vị.

Path đầy đủ theo base URL: `/api/zalo/locations`

### Request

Không có body. Không có query bắt buộc.

### Response fields

`data` là mảng `Location`.

### Example response

```json
{
  "ok": true,
  "data": [
    {
      "locationId": "loc-cumta",
      "locationName": "TRUNG TÂM PHỤC VỤ HÀNH CHÍNH CÔNG XÃ CƯ MTA",
      "address": "01 Đường Mô Phỏng, Xã Cư Mta, Tỉnh Đắk Lắk"
    }
  ]
}
```

### Backend mapping gợi ý

| Backend source | Public field | Notes |
|---|---|---|
| `Organization._id` hoặc `Organization.idOrg` | `locationId` | Backend cần chốt identifier public |
| `Organization.name` | `locationName` | Tên hiển thị |
| metadata địa chỉ / cấu hình đơn vị | `address` | Nếu chưa có field chính thức, backend cần bổ sung |

### Backend cần xác nhận

- `locationId` public dùng `_id` hay `idOrg`?
- Backend hiện có field địa chỉ chính thức chưa?

## 7.2 GET /locations/{locationId}/areas

Mục đích: lấy danh sách lĩnh vực theo đơn vị.

Path đầy đủ theo base URL: `/api/zalo/locations/{locationId}/areas`

### Path params

| Param | Type | Required | Notes |
|---|---|---:|---|
| `locationId` | string | Yes | Identifier của đơn vị |

### Response fields

`data` là mảng `Area`.

### Example response

```json
{
  "ok": true,
  "data": [
    {
      "areaId": "area-justice",
      "areaName": "Tư pháp, hộ tịch",
      "locationId": "loc-cumta"
    }
  ]
}
```

### Backend mapping gợi ý

- Nếu backend chưa có bảng `Area`, có thể tạm map từ cấu hình danh mục công việc của đơn vị.
- `locationId` phải được giữ lại trong payload vì frontend hiện parse field này.

### Backend cần xác nhận

- Backend đã có thực thể `Area` chính thức chưa?
- Nếu chưa, `areaId` sẽ map từ đâu?

## 7.3 GET /locations/{locationId}/services?areaId={areaId}

Mục đích: lấy danh sách dịch vụ theo đơn vị và lĩnh vực.

Path đầy đủ theo base URL: `/api/zalo/locations/{locationId}/services`

### Path params

| Param | Type | Required | Notes |
|---|---|---:|---|
| `locationId` | string | Yes | Identifier của đơn vị |

### Query params

| Param | Type | Required | Notes |
|---|---|---:|---|
| `areaId` | string | No in parser, but required by current flow | Frontend booking flow luôn truyền khi đã chọn lĩnh vực |

### Response fields

`data` là mảng `Service`.

### Example response

```json
{
  "ok": true,
  "data": [
    {
      "serviceId": "svc-justice-1",
      "serviceCode": "A01",
      "serviceName": "Khai sinh, khai tử",
      "areaId": "area-justice",
      "locationId": "loc-cumta",
      "description": "Tiếp nhận hộ tịch",
      "bookingEnabled": true
    }
  ]
}
```

### Backend mapping gợi ý

| Backend source | Public field | Notes |
|---|---|---|
| `Service._id` hoặc `Service.idService` | `serviceId` | Backend cần chốt identifier public |
| `Service.idService` hoặc mã nghiệp vụ | `serviceCode` | Mã hiển thị ngắn |
| `Service.name` | `serviceName` | Tên dịch vụ |
| liên kết service -> area | `areaId` | Backend cần có mapping rõ ràng |
| liên kết service -> organization | `locationId` | Đơn vị |
| mô tả nghiệp vụ | `description` | Có thể là `null` |
| trạng thái cấu hình service | `bookingEnabled` | `true` nếu cho phép đặt số |

### Backend cần xác nhận

- `serviceId` public dùng `_id` hay `idService`?
- `areaId` map từ mô hình dữ liệu nào?
- Khi service không khả dụng thì trả `bookingEnabled=false` hay loại khỏi list?

## 7.4 POST /bookings

Mục đích: tạo lượt đặt số.

Path đầy đủ theo base URL: `/api/zalo/bookings`

### Request body

| Field | Type | Required | Notes |
|---|---|---:|---|
| `locationId` | string | Yes | Phải khớp với đơn vị |
| `areaId` | string | Yes | Phải khớp với lĩnh vực |
| `serviceId` | string | Yes | Phải khớp với dịch vụ |
| `fullName` | string | Yes | Dữ liệu PII duy nhất app gửi khi tạo booking |
| `bookingDate` | string | Yes | Format `YYYY-MM-DD` |

### Example request

```json
{
  "locationId": "loc-cumta",
  "areaId": "area-justice",
  "serviceId": "svc-justice-1",
  "fullName": "Nguyen Van A",
  "bookingDate": "2026-06-29"
}
```

### Response fields

`data` là `Ticket` đầy đủ theo parser hiện tại.

### Example response

```json
{
  "ok": true,
  "data": {
    "ticketId": "ticket-123",
    "ticketNumber": "0003",
    "locationId": "loc-cumta",
    "locationName": "TRUNG TÂM PHỤC VỤ HÀNH CHÍNH CÔNG XÃ CƯ MTA",
    "areaId": "area-justice",
    "areaName": "Tư pháp, hộ tịch",
    "serviceId": "svc-justice-1",
    "serviceName": "Khai sinh, khai tử",
    "fullName": "Nguyen Van A",
    "bookingDate": "2026-06-29",
    "status": "WAITING",
    "createdAt": "2026-06-29T08:00:00.000Z",
    "updatedAt": "2026-06-29T08:00:00.000Z",
    "checkInExpiresAt": "2026-06-29T08:45:00.000Z",
    "qrPayload": "opaque-or-encoded-qr-token",
    "canCancel": true
  }
}
```

### Validation rules cần có

- Không cho booking ngày quá khứ.
- `locationId`, `areaId`, `serviceId` phải khớp nhau.
- Service phải đang cho đặt số.
- Chống double submit / idempotency.
- Nên giới hạn số active booking theo user theo rule nghiệp vụ.

### Lưu ý bảo mật

- `fullName` hiện đang được app gửi.
- `qrPayload` hiện được frontend dùng để render QR trực tiếp.
- Backend production nên cân nhắc trả opaque token hoặc QR token an toàn hơn, nhưng nếu đổi field shape thì frontend phải cập nhật.

## 7.5 GET /locations/{locationId}/bookings/current

Mục đích: lấy phiếu đang hoạt động của user hiện tại trong một đơn vị.

Path đầy đủ theo base URL: `/api/zalo/locations/{locationId}/bookings/current`

### Path params

| Param | Type | Required | Notes |
|---|---|---:|---|
| `locationId` | string | Yes | Đơn vị đang truy vấn |

### Response

- `data` là `Ticket`
- hoặc `null` nếu không có booking hiện tại

### Example response khi có booking

```json
{
  "ok": true,
  "data": {
    "ticketId": "ticket-123",
    "ticketNumber": "0003",
    "locationId": "loc-cumta",
    "locationName": "TRUNG TÂM PHỤC VỤ HÀNH CHÍNH CÔNG XÃ CƯ MTA",
    "areaId": "area-justice",
    "areaName": "Tư pháp, hộ tịch",
    "serviceId": "svc-justice-1",
    "serviceName": "Khai sinh, khai tử",
    "fullName": "Nguyen Van A",
    "bookingDate": "2026-06-29",
    "status": "WAITING",
    "createdAt": "2026-06-29T08:00:00.000Z",
    "updatedAt": "2026-06-29T08:00:00.000Z",
    "checkInExpiresAt": "2026-06-29T08:45:00.000Z",
    "qrPayload": "opaque-or-encoded-qr-token",
    "canCancel": true
  }
}
```

### Example response khi không có booking

```json
{
  "ok": true,
  "data": null
}
```

### Backend cần xác nhận

- User identity được bind thế nào với booking?
- Có cho phép 1 user có active booking ở nhiều location cùng lúc không?

## 7.6 GET /locations/{locationId}/bookings/history

Mục đích: lấy lịch sử booking của user theo một đơn vị.

Path đầy đủ theo base URL: `/api/zalo/locations/{locationId}/bookings/history`

### Path params

| Param | Type | Required | Notes |
|---|---|---:|---|
| `locationId` | string | Yes | Đơn vị đang truy vấn |

### Response

`data` là mảng `Ticket`.

### Example response

```json
{
  "ok": true,
  "data": [
    {
      "ticketId": "ticket-123",
      "ticketNumber": "0003",
      "locationId": "loc-cumta",
      "locationName": "TRUNG TÂM PHỤC VỤ HÀNH CHÍNH CÔNG XÃ CƯ MTA",
      "areaId": "area-justice",
      "areaName": "Tư pháp, hộ tịch",
      "serviceId": "svc-justice-1",
      "serviceName": "Khai sinh, khai tử",
      "fullName": "Nguyen Van A",
      "bookingDate": "2026-06-29",
      "status": "COMPLETED",
      "createdAt": "2026-06-29T08:00:00.000Z",
      "updatedAt": "2026-06-29T08:05:00.000Z",
      "checkInExpiresAt": "2026-06-29T08:45:00.000Z",
      "qrPayload": "opaque-or-encoded-qr-token",
      "canCancel": false
    }
  ]
}
```

### Lưu ý

- Frontend hiện tại parse đầy đủ `Ticket` kể cả lịch sử.
- UI không hiển thị `fullName`, nhưng parser hiện vẫn cần field đó.
- Nếu backend muốn loại `fullName` hoặc `qrPayload` khỏi list history, frontend cần cập nhật sau.

## 7.7 GET /bookings/{ticketId}

Mục đích: lấy chi tiết phiếu và dữ liệu QR.

Path đầy đủ theo base URL: `/api/zalo/bookings/{ticketId}`

### Path params

| Param | Type | Required | Notes |
|---|---|---:|---|
| `ticketId` | string | Yes | Không nên dễ đoán |

### Response

`data` là `Ticket`.

### Example response

```json
{
  "ok": true,
  "data": {
    "ticketId": "ticket-123",
    "ticketNumber": "0003",
    "locationId": "loc-cumta",
    "locationName": "TRUNG TÂM PHỤC VỤ HÀNH CHÍNH CÔNG XÃ CƯ MTA",
    "areaId": "area-justice",
    "areaName": "Tư pháp, hộ tịch",
    "serviceId": "svc-justice-1",
    "serviceName": "Khai sinh, khai tử",
    "fullName": "Nguyen Van A",
    "bookingDate": "2026-06-29",
    "status": "WAITING",
    "createdAt": "2026-06-29T08:00:00.000Z",
    "updatedAt": "2026-06-29T08:00:00.000Z",
    "checkInExpiresAt": "2026-06-29T08:45:00.000Z",
    "qrPayload": "opaque-or-encoded-qr-token",
    "canCancel": true
  }
}
```

### Security rules

- User chỉ được xem ticket của chính họ.
- `ticketId` không được đoán dễ.
- QR token nên có TTL hoặc trạng thái hiệu lực.

## 7.8 POST /bookings/{ticketId}/cancel

Mục đích: hủy lượt đặt số.

Path đầy đủ theo base URL: `/api/zalo/bookings/{ticketId}/cancel`

### Path params

| Param | Type | Required | Notes |
|---|---|---:|---|
| `ticketId` | string | Yes | Ticket cần hủy |

### Request body

Hiện tại frontend không gửi body cho action cancel.

Backend production có thể hỗ trợ body mở rộng sau này, nhưng nếu bắt buộc body thì frontend cần thay đổi.

### Response

Mock hiện trả lại full `Ticket` sau khi cập nhật trạng thái.

### Example response

```json
{
  "ok": true,
  "data": {
    "ticketId": "ticket-123",
    "ticketNumber": "0003",
    "locationId": "loc-cumta",
    "locationName": "TRUNG TÂM PHỤC VỤ HÀNH CHÍNH CÔNG XÃ CƯ MTA",
    "areaId": "area-justice",
    "areaName": "Tư pháp, hộ tịch",
    "serviceId": "svc-justice-1",
    "serviceName": "Khai sinh, khai tử",
    "fullName": "Nguyen Van A",
    "bookingDate": "2026-06-29",
    "status": "CANCELLED",
    "createdAt": "2026-06-29T08:00:00.000Z",
    "updatedAt": "2026-06-29T08:10:00.000Z",
    "checkInExpiresAt": "2026-06-29T08:45:00.000Z",
    "qrPayload": "opaque-or-encoded-qr-token",
    "canCancel": false
  }
}
```

### Rules

- Chỉ hủy được booking còn active.
- User chỉ được hủy booking của chính họ.
- Nếu trạng thái đã terminal thì trả conflict phù hợp.

## 7.9 GET /locations/{locationId}/queue-status

Mục đích: xem tình hình số thứ tự theo đơn vị.

Path đầy đủ theo base URL: `/api/zalo/locations/{locationId}/queue-status`

### Path params

| Param | Type | Required | Notes |
|---|---|---:|---|
| `locationId` | string | Yes | Đơn vị đang xem |

### Response

`data` là `QueueStatus`.

### Example response

```json
{
  "ok": true,
  "data": {
    "locationId": "loc-cumta",
    "locationName": "TRUNG TÂM PHỤC VỤ HÀNH CHÍNH CÔNG XÃ CƯ MTA",
    "updatedAt": "2026-06-29T08:00:00.000Z",
    "counters": [
      {
        "counterId": "loc-cumta-counter-01",
        "counterName": "Quầy 01",
        "serviceId": "svc-justice-1",
        "serviceName": "Khai sinh, khai tử",
        "status": "OPEN",
        "currentTicket": {
          "ticketId": "ticket-0001",
          "ticketNumber": "0001",
          "serviceName": "Khai sinh, khai tử"
        },
        "nextTicket": {
          "ticketId": "ticket-0002",
          "ticketNumber": "0002",
          "serviceName": "Khai sinh, khai tử"
        },
        "waitingCount": 3,
        "waitingTickets": [
          {
            "ticketId": "ticket-0002",
            "ticketNumber": "0002",
            "serviceName": "Khai sinh, khai tử"
          }
        ],
        "updatedAt": "2026-06-29T08:00:00.000Z"
      }
    ]
  }
}
```

### Important security rules

- Không trả `fullName`.
- Không trả phone/email/CCCD.
- Không trả địa chỉ cá nhân.
- Không trả QR payload.

### Important behavior notes

- Frontend dùng `currentBooking.ticketId` để highlight “Phiếu của bạn”.
- Mock hiện trả tối đa `20` waiting tickets đầu tiên mỗi quầy.
- Backend production có thể giảm về `10` hoặc số khác, nhưng cần xác nhận nếu UI cần đầy đủ hơn.

### Backend cần xác nhận

- Queue status đọc từ realtime queue, DB, MQTT projection hay service riêng?
- Có cần polling là đủ hay sẽ có WebSocket/SSE sau này?
- Có cần thêm `PAUSED`/`SKIPPED`/`FINISHED` hay giữ đúng enum hiện tại cho frontend?

## 8. Endpoint dev/mock không thuộc public contract production

Các endpoint dưới đây đang tồn tại ở mock để phục vụ QA/dev, nhưng **không nên coi là public production contract cho Mini App**:

- `GET /health`
- `GET /api/zalo/locations/{locationId}`
- `GET /api/zalo/services`
- `GET /api/zalo/bookings`
- `GET /api/zalo/tickets`
- `POST /api/zalo/dev/reset`
- `POST /api/zalo/dev/call-next`

Đặc biệt:

- `/api/zalo/dev/reset`
- `/api/zalo/dev/call-next`

là endpoint dev-only, không được public ra production Mini App.

## 9. Idempotency và chống tạo trùng

Backend nên hỗ trợ ít nhất một trong các cách:

1. Header:

```http
Idempotency-Key: <uuid>
```

2. Hoặc rule backend:

- 1 active booking / user / service / bookingDate
- request trùng trả lại booking đang có thay vì tạo mới

Frontend hiện có chống double click ở UI, nhưng backend vẫn phải tự bảo vệ.

## 10. Authentication / Zalo identity

Mock hiện không áp auth thật.

Backend production cần xác nhận:

- Mini App lấy identity bằng cách nào?
- Backend nhận access token / session token nào?
- Có cần Bearer token riêng cho public API không?
- Cơ chế bind Zalo user với booking ra sao?
- Có cho phép guest booking không?

Ràng buộc quan trọng:

- `GET /bookings/current`
- `GET /bookings/history`
- `GET /bookings/{ticketId}`
- `POST /bookings/{ticketId}/cancel`

đều phải được authorize theo đúng user sở hữu booking, không được dựa vào dữ liệu client tự khai để đọc booking của người khác.

## 11. CORS / preview / production

Backend cần hỗ trợ:

- development localhost;
- Zalo Mini App preview domain;
- production domain.

Yêu cầu:

- Không dùng wildcard CORS trong production nếu có credential/session.
- Allowed origins cần phù hợp cho preview và domain release thật.
- Mock hiện đang dùng `Access-Control-Allow-Origin: *` chỉ để phục vụ development.

## 12. Mapping gợi ý sang backend hiện có

Các mapping dưới đây chỉ là gợi ý, chưa phải official contract:

| Public concept | Backend source gợi ý | Status |
|---|---|---|
| `locationId` | `Organization._id` hoặc `Organization.idOrg` | BACKEND_CONFIRMATION_REQUIRED |
| `locationName` | `Organization.name` | BACKEND_CONFIRMATION_REQUIRED |
| `address` | metadata/config bổ sung của `Organization` | BACKEND_CONFIRMATION_REQUIRED |
| `areaId` | bảng `Area` hoặc danh mục mapping riêng | BACKEND_CONFIRMATION_REQUIRED |
| `serviceId` | `Service._id` hoặc `Service.idService` | BACKEND_CONFIRMATION_REQUIRED |
| `serviceCode` | `Service.idService` hoặc mã service công khai | BACKEND_CONFIRMATION_REQUIRED |
| booking storage | `Booking`, `QueueTicket` hoặc model tương đương | BACKEND_CONFIRMATION_REQUIRED |
| queue runtime | queue service / projection / DB snapshot | BACKEND_CONFIRMATION_REQUIRED |
| QR token | `CheckInToken` opaque token | BACKEND_CONFIRMATION_REQUIRED |
| idempotency | `IdempotencyKey` store hoặc unique rule | BACKEND_CONFIRMATION_REQUIRED |

## 13. Checklist backend cần xác nhận

1. Dùng `Organization._id` hay `Organization.idOrg` làm `locationId` public?
2. Backend hiện có field địa chỉ chính thức cho organization chưa?
3. Backend có bảng `Area` chưa, hay cần tạo?
4. `Service` map sang `areaId` thế nào?
5. `serviceId` public dùng `_id` hay `idService`?
6. Booking sẽ lưu vào collection/model nào?
7. Có cần thêm `Booking`, `QueueTicket`, `CheckInToken`, `IdempotencyKey` không?
8. `fullName` có tiếp tục xuất hiện trong public ticket payload không, hay frontend cần đổi parser để loại field này?
9. `qrPayload` hiện tại có phải giữ đúng field name đó không, hay backend muốn chuyển sang `qrToken`/opaque token?
10. QR token TTL bao lâu?
11. Một user được có bao nhiêu booking active?
12. Có cho hủy khi ticket đang `SERVING` không?
13. Queue status lấy từ realtime queue, DB, MQTT hay service riêng?
14. Có cần WebSocket/SSE sau này không hay polling là đủ?
15. Chính sách lưu `fullName` bao lâu?
16. Có cần masking `fullName` trong admin/log không?
17. Rate limit theo user, IP hay Zalo user id?
18. Production base URL là gì?
19. Cơ chế auth public Zalo App là gì?
20. Có giữ đúng enum hiện tại (`WAITING`, `CALLED`, `SERVING`, `COMPLETED`, `CANCELLED`, `EXPIRED`, `OPEN`, `CLOSED`) để tương thích frontend hiện có không?

