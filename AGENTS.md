# QMS Tuấn Workspace

## Phạm vi

Repository này chỉ chứa phần việc do Tuấn phụ trách:

- Web_Teller
- Display_Central
- Display_Service_Quality
- Web_Admin_Local
- Web_Central_Admin
- Zalo_App
- Linux_Audio_Service

Backend Local, Backend Central, MongoDB và MQTT Broker thật do thành viên khác phụ trách.

Trong quá trình phát triển, sử dụng mock trong thư mục /mocks.

## Kiến trúc

Hệ thống sử dụng mô hình Local-First.

Ứng dụng Local giao tiếp với Local Server qua:

- REST API `/api/v1`
- MQTT over WebSocket đối với ứng dụng trình duyệt
- MQTT TCP đối với Linux_Audio_Service

Không tạo giao tiếp trực tiếp giữa Web_Teller và Display_Central.

Web_Teller gọi REST API.
Local Server hoặc Mock Local Server phát MQTT.
Display và Audio Service nhận MQTT.

## Source of truth

- REST API: `/docs/API_CONTRACT.md`
- MQTT: `/docs/MQTT_CONTRACT.md`
- TypeScript contracts: `/packages/contracts`
- API client dùng chung: `/packages/api-client`
- MQTT client dùng chung: `/packages/mqtt-client`

Không tự ý tạo endpoint hoặc MQTT payload mới.

Khi thiếu contract:

1. Ghi rõ giả định.
2. Đánh dấu `BACKEND_CONFIRMATION_REQUIRED`.
3. Cập nhật mock.
4. Không coi giả định là API chính thức.

## Bảo mật

- Không dùng số CCCD thật trong dữ liệu test.
- Không ghi số CCCD thô vào log.
- Không commit token, password hoặc production URL.
- Central chỉ nhận citizenHash, không nhận CCCD thô.

## Quy tắc code

- Sử dụng TypeScript strict.
- Mỗi App phải build độc lập.
- Chỉ đưa code vào `/packages` khi có ít nhất hai App sử dụng.
- Component không gọi fetch trực tiếp; sử dụng api-client.
- MQTT payload phải được kiểm tra trước khi xử lý.
- Mỗi màn hình phải có loading, empty và error state.

## Kiểm tra bắt buộc

Trước khi kết thúc một nhiệm vụ:

- chạy lint
- chạy typecheck
- chạy test liên quan
- chạy build App bị ảnh hưởng
- liệt kê file đã thay đổi
- ghi rõ nội dung chưa kiểm tra được