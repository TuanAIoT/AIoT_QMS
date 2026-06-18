# Web Teller Rules

Web Teller phục vụ cán bộ tại quầy.

Luồng chính:

Đăng nhập
→ Chọn quầy
→ Bắt đầu ca
→ Gọi số
→ Recall / Skip / Transfer / Finish
→ Kết thúc ca

Web Teller sử dụng REST API cho lệnh nghiệp vụ.

Web Teller không được trực tiếp gửi lệnh đến Display hoặc Audio Service.

Realtime topic:

- hcc/counter/{counterId}/events

Mock mode:

- VITE_API_MODE=mock

Real mode:

- VITE_API_MODE=http