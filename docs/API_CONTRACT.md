# REST API Contract

> Document status: **DRAFT**. Endpoint candidates below are transcribed from the QMS V6.0 DOCX source. They are not official Backend APIs until confirmed.

## 1. Contract rules

- Confirmed Local base path: `/api/v1`.
- Business commands from `Web_Teller` use REST.
- UI components use the shared API client; components do not call `fetch` directly.
- This document does not define undocumented fields.
- Raw CCCD must not appear in Central requests/responses, URLs, logs, or mock fixtures.
- Only these entry statuses are allowed: `CONFIRMED`, `PROVISIONAL`, `BACKEND_CONFIRMATION_REQUIRED`.

## 2. Status definitions

| Status | Meaning |
|---|---|
| CONFIRMED | Explicitly approved as an official contract. |
| PROVISIONAL | Supported by workspace-level direction but not fully approved by Backend. |
| BACKEND_CONFIRMATION_REQUIRED | Candidate from source material or an unresolved detail; must not be treated as official. |

## 3. Shared response concerns

The following are not specified by the source and require Backend confirmation:

- Success envelope and pagination format
- Error envelope, error codes, validation details, and HTTP status mapping
- JWT access/refresh token fields, expiry, rotation, and revocation
- Location/counter/session authorization rules
- Idempotency keys and duplicate command behavior
- Date/time format beyond the examples in the DOCX

Where a table cell says “Not specified,” the later mock must use an explicitly documented temporary shape and mark it `BACKEND_CONFIRMATION_REQUIRED`.

## 4. Auth endpoints

| Method | Path | Consumer App | Request payload | Response payload | Error responses | Authentication | Mock behavior | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|
| POST | `/api/v1/auth/login` | Web_Teller, Web_Admin_Local | Not specified | Not specified; expected authentication result | Not specified | Login credential mechanism is pending | Accept configured seed users; temporary token shape must be documented | BACKEND_CONFIRMATION_REQUIRED | Endpoint is listed in DOCX; credential and token schemas are absent. |
| POST | `/api/v1/auth/logout` | Web_Teller, Web_Admin_Local | Not specified | Not specified | Not specified | JWT Bearer is proposed in DOCX; exact rule pending | End mock session/token | BACKEND_CONFIRMATION_REQUIRED | Logout invalidation behavior is unknown. |
| POST | `/api/v1/auth/refresh` | Web_Teller, Web_Admin_Local | Not specified | Not specified | Not specified | Refresh-token mechanism pending | Rotate or return a temporary mock token according to documented mock mode | BACKEND_CONFIRMATION_REQUIRED | Refresh token storage and rotation require confirmation. |
| POST | `/api/v1/auth/change-password` | Web_Teller, Web_Admin_Local | Not specified | Not specified | Not specified | JWT Bearer candidate; exact policy pending | Update seed-user password only in resettable mock state | BACKEND_CONFIRMATION_REQUIRED | Password policy is unknown. |

## 5. Dashboard endpoints

| Method | Path | Consumer App | Request payload | Response payload | Error responses | Authentication | Mock behavior | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|
| GET | `/api/v1/dashboard/summary` | Web_Admin_Local | Query parameters not specified | Summary schema not specified | Not specified | JWT Bearer candidate | Return aggregate values derived from mock state | BACKEND_CONFIRMATION_REQUIRED | Listed as realtime overview. |
| GET | `/api/v1/dashboard/counters` | Web_Admin_Local | Query parameters not specified | Counter status schema not specified | Not specified | JWT Bearer candidate | Return current mock counters | BACKEND_CONFIRMATION_REQUIRED | Location scoping requires confirmation. |
| GET | `/api/v1/dashboard/devices` | Web_Admin_Local | Query parameters not specified | Device status schema not specified | Not specified | JWT Bearer candidate | Return current mock device health | BACKEND_CONFIRMATION_REQUIRED | Heartbeat/offline rules require confirmation. |
| GET | `/api/v1/dashboard/live` | Web_Admin_Local | Query parameters not specified | SSE event schema not specified | Not specified | JWT Bearer candidate | Emit deterministic mock metrics with configurable delay/disconnect | BACKEND_CONFIRMATION_REQUIRED | DOCX proposes SSE every 5 seconds; MQTT versus SSE choice is unresolved. |

## 6. Queue endpoints

| Method | Path | Consumer App | Request payload | Response payload | Error responses | Authentication | Mock behavior | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|
| POST | `/api/v1/queue/ticket` | Kiosk Android (external dependency) | Ticket creation schema not specified | Created ticket schema not specified | Not specified | Device/user authentication pending | Create a non-sensitive mock ticket and publish Server-originated MQTT state | BACKEND_CONFIRMATION_REQUIRED | Kiosk is out of Tuấn's scope; endpoint affects Display/Teller tests. |
| POST | `/api/v1/queue/ticket/assisted` | Web_Teller | Assisted ticket schema not specified | Created ticket schema not specified | Not specified | JWT Bearer candidate | Create ticket with mock source `STAFF`; publish Server-originated MQTT state | BACKEND_CONFIRMATION_REQUIRED | No raw CCCD in mock payload/log. |
| GET | `/api/v1/queue/waiting` | Web_Teller, Display_Central when confirmed | Filters not specified | Waiting-list schema not specified | Not specified | JWT Bearer/device policy pending | Return waiting tickets from authoritative mock state | BACKEND_CONFIRMATION_REQUIRED | Snapshot/reconnect use is not confirmed. |
| GET | `/api/v1/queue/estimate/{serviceId}` | Web_Teller or other UI when required | `serviceId`; other parameters not specified | EWT response schema not specified | Not specified | Authentication policy pending | Return a deterministic configured value; do not implement EWT algorithm | BACKEND_CONFIRMATION_REQUIRED | EWT calculation is out of scope. |
| POST | `/api/v1/queue/call-next` | Web_Teller | Counter/session command schema not specified | Called ticket/result schema not specified | Not specified | JWT Bearer candidate | Transition authoritative mock state, then publish MQTT as Local Server | BACKEND_CONFIRMATION_REQUIRED | Web_Teller must not publish the event itself. |
| POST | `/api/v1/queue/recall` | Web_Teller | Recall command schema not specified | Recall result schema not specified | Not specified | JWT Bearer candidate | Validate current mock state, then publish recall/audio/display events as Server | BACKEND_CONFIRMATION_REQUIRED | Idempotency and recall count unknown. |
| POST | `/api/v1/queue/skip` | Web_Teller | Skip command schema not specified | Skip result schema not specified | Not specified | JWT Bearer candidate | Apply mock transition and publish resulting state | BACKEND_CONFIRMATION_REQUIRED | Resulting status/order rules unknown. |
| POST | `/api/v1/queue/transfer` | Web_Teller | Transfer command schema not specified | Transfer result schema not specified | Not specified | JWT Bearer candidate | Move ticket in mock state and publish resulting Server event | BACKEND_CONFIRMATION_REQUIRED | Destination validation and multi-service behavior unknown. |
| POST | `/api/v1/queue/finish` | Web_Teller | Finish command schema not specified | Finish result schema not specified | Not specified | JWT Bearer candidate | Finish mock transaction and publish resulting Server event | BACKEND_CONFIRMATION_REQUIRED | Survey trigger and next-service behavior unknown. |
| POST | `/api/v1/queue/cancel` | Consumer not identified in source | Cancel command schema not specified | Cancel result schema not specified | Not specified | Authentication policy pending | Cancel eligible mock ticket | BACKEND_CONFIRMATION_REQUIRED | Consumer and state rules require confirmation. |

## 7. Counter session endpoints

| Method | Path | Consumer App | Request payload | Response payload | Error responses | Authentication | Mock behavior | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|
| POST | `/api/v1/counter-session/start` | Web_Teller | Counter/session start schema not specified | Session schema not specified | Not specified | JWT Bearer candidate | Start one resettable mock session | BACKEND_CONFIRMATION_REQUIRED | Ticket-number reset policy is Server-owned. |
| POST | `/api/v1/counter-session/end` | Web_Teller | Session end schema not specified | Session summary schema not specified | Not specified | JWT Bearer candidate | End active mock session | BACKEND_CONFIRMATION_REQUIRED | End-of-day behavior is separate and unresolved. |
| GET | `/api/v1/counter-session/active` | Web_Teller | Counter selection parameters not specified | Active session schema not specified | Not specified | JWT Bearer candidate | Return active mock session or empty state | BACKEND_CONFIRMATION_REQUIRED | Restore-session behavior requires confirmation. |

## 8. Device endpoints

| Method | Path | Consumer App | Request payload | Response payload | Error responses | Authentication | Mock behavior | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|
| GET | `/api/v1/devices` | Web_Admin_Local | Filters/pagination not specified | Device list schema not specified | Not specified | JWT Bearer candidate | List mock devices | BACKEND_CONFIRMATION_REQUIRED | Device types originate in DOCX only. |
| POST | `/api/v1/devices` | Web_Admin_Local | Device creation schema not specified | Created device schema not specified | Not specified | JWT Bearer/RBAC pending | Add device to resettable mock state | BACKEND_CONFIRMATION_REQUIRED | Credentials and MQTT identity handling unknown. |
| GET | `/api/v1/devices/{id}` | Web_Admin_Local | `id` | Device schema not specified | Not specified | JWT Bearer/RBAC pending | Return matching mock device | BACKEND_CONFIRMATION_REQUIRED | Identifier format unknown. |
| PUT | `/api/v1/devices/{id}` | Web_Admin_Local | Device update schema not specified | Updated device schema not specified | Not specified | JWT Bearer/RBAC pending | Update allowed mock fields | BACKEND_CONFIRMATION_REQUIRED | Update semantics and immutable fields unknown. |
| DELETE | `/api/v1/devices/{id}` | Web_Admin_Local | `id`; body not specified | Delete result not specified | Not specified | JWT Bearer/RBAC pending | Remove or mark mock device according to temporary documented behavior | BACKEND_CONFIRMATION_REQUIRED | Hard versus soft delete unknown. |
| POST | `/api/v1/devices/{id}/reboot` | Web_Admin_Local | Reboot command schema not specified | Command acceptance/result schema not specified | Not specified | JWT Bearer/RBAC pending | Record command and simulate Local Server MQTT publication | BACKEND_CONFIRMATION_REQUIRED | Submission must not be treated as execution success. |
| POST | `/api/v1/devices/{id}/sync` | Web_Admin_Local | Sync command schema not specified | Sync result schema not specified | Not specified | JWT Bearer/RBAC pending | Simulate configuration sync lifecycle | BACKEND_CONFIRMATION_REQUIRED | Sync engine is out of scope. |

## 9. Staff, counter, and service endpoints

| Method | Path | Consumer App | Request payload | Response payload | Error responses | Authentication | Mock behavior | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|
| GET | `/api/v1/staffs` | Web_Admin_Local | Filters/pagination not specified | Staff list schema not specified | Not specified | JWT Bearer/RBAC pending | List non-sensitive seed staff | BACKEND_CONFIRMATION_REQUIRED | Naming is transcribed exactly from DOCX. |
| POST | `/api/v1/staffs` | Web_Admin_Local | Staff creation schema not specified | Created staff schema not specified | Not specified | JWT Bearer/RBAC pending | Add mock staff | BACKEND_CONFIRMATION_REQUIRED | Personal-data fields require review. |
| GET | `/api/v1/staffs/{id}` | Web_Admin_Local | `id` | Staff schema not specified | Not specified | JWT Bearer/RBAC pending | Return mock staff | BACKEND_CONFIRMATION_REQUIRED | Identifier format unknown. |
| PUT | `/api/v1/staffs/{id}` | Web_Admin_Local | Staff update schema not specified | Updated staff schema not specified | Not specified | JWT Bearer/RBAC pending | Update allowed mock fields | BACKEND_CONFIRMATION_REQUIRED | Validation rules unknown. |
| DELETE | `/api/v1/staffs/{id}` | Web_Admin_Local | `id`; body not specified | Delete result not specified | Not specified | JWT Bearer/RBAC pending | Remove/deactivate according to temporary documented behavior | BACKEND_CONFIRMATION_REQUIRED | Hard versus soft delete unknown. |
| GET | `/api/v1/counters` | Web_Teller, Web_Admin_Local | Filters not specified | Counter list schema not specified | Not specified | JWT Bearer candidate | List mock counters | BACKEND_CONFIRMATION_REQUIRED | Teller selection requirements unknown. |
| POST | `/api/v1/counters` | Web_Admin_Local | Counter creation schema not specified | Created counter schema not specified | Not specified | JWT Bearer/RBAC pending | Add mock counter | BACKEND_CONFIRMATION_REQUIRED | Pool/load-balancing fields are Backend-owned. |
| GET | `/api/v1/counters/{id}` | Web_Admin_Local | `id` | Counter schema not specified | Not specified | JWT Bearer/RBAC pending | Return mock counter | BACKEND_CONFIRMATION_REQUIRED | Identifier format unknown. |
| PUT | `/api/v1/counters/{id}` | Web_Admin_Local | Counter update schema not specified | Updated counter schema not specified | Not specified | JWT Bearer/RBAC pending | Update mock counter | BACKEND_CONFIRMATION_REQUIRED | Active-session update restrictions unknown. |
| DELETE | `/api/v1/counters/{id}` | Web_Admin_Local | `id`; body not specified | Delete result not specified | Not specified | JWT Bearer/RBAC pending | Remove/deactivate according to temporary documented behavior | BACKEND_CONFIRMATION_REQUIRED | Hard versus soft delete unknown. |
| GET | `/api/v1/services` | Web_Teller, Web_Admin_Local | Filters not specified | Service/pool list schema not specified | Not specified | Authentication policy pending | Return mock services and configured assignment result only | BACKEND_CONFIRMATION_REQUIRED | Mock must not implement production load balancing. |
| POST | `/api/v1/services` | Web_Admin_Local | Service/pool creation schema not specified | Created service schema not specified | Not specified | JWT Bearer/RBAC pending | Add mock service configuration | BACKEND_CONFIRMATION_REQUIRED | DOCX combines service and pool behavior; contract needs clarification. |

## 10. Content and report endpoints

| Method | Path | Consumer App | Request payload | Response payload | Error responses | Authentication | Mock behavior | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|
| GET | `/api/v1/contents` | Web_Admin_Local, Display_Central when confirmed | Filters not specified | Content list schema not specified | Not specified | Authentication policy pending | Return metadata for safe local fixture assets | BACKEND_CONFIRMATION_REQUIRED | Media URL/storage contract unknown. |
| POST | `/api/v1/contents/upload` | Web_Admin_Local | Multipart/schema not specified | Uploaded content schema not specified | Not specified | JWT Bearer/RBAC pending | Simulate metadata creation without production storage | BACKEND_CONFIRMATION_REQUIRED | Size/type/security limits unknown. |
| GET | `/api/v1/reports/services` | Web_Admin_Local | Filters/date range not specified | Service report schema not specified | Not specified | JWT Bearer/RBAC pending | Return deterministic fixture report | BACKEND_CONFIRMATION_REQUIRED | Aggregation is Backend-owned. |
| GET | `/api/v1/reports/staffs` | Web_Admin_Local | Filters/date range not specified | Staff report schema not specified | Not specified | JWT Bearer/RBAC pending | Return deterministic fixture report | BACKEND_CONFIRMATION_REQUIRED | Naming is transcribed from DOCX. |
| GET | `/api/v1/reports/surveys` | Web_Admin_Local | Filters/date range not specified | Survey report schema not specified | Not specified | JWT Bearer/RBAC pending | Return deterministic fixture report | BACKEND_CONFIRMATION_REQUIRED | Survey ownership remains pending. |
| GET | `/api/v1/reports/export/pdf` | Web_Admin_Local | Export filters not specified | Binary/file response not specified | Not specified | JWT Bearer/RBAC pending | Return a deterministic fixture or explicit not-implemented mock response | BACKEND_CONFIRMATION_REQUIRED | Export headers and generation behavior unknown. |
| GET | `/api/v1/reports/export/excel` | Web_Admin_Local | Export filters not specified | Binary/file response not specified | Not specified | JWT Bearer/RBAC pending | Return a deterministic fixture or explicit not-implemented mock response | BACKEND_CONFIRMATION_REQUIRED | Export format and headers unknown. |

## 11. Log and synchronization endpoints

| Method | Path | Consumer App | Request payload | Response payload | Error responses | Authentication | Mock behavior | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|
| GET | `/api/v1/logs/audit` | Web_Admin_Local | Filters/pagination not specified | Audit list schema not specified | Not specified | JWT Bearer/RBAC pending | Return sanitized mock audit events | BACKEND_CONFIRMATION_REQUIRED | Never include raw CCCD. |
| POST | `/api/v1/logs/journey` | Kiosk Android (external dependency) | Journey schema not specified | Acknowledgement not specified | Not specified | Device authentication pending | Accept sanitized fixture events | BACKEND_CONFIRMATION_REQUIRED | Earlier prose uses `/api/local/logs/journey`; path conflict remains. |
| POST | `/api/v1/logs/upload-monthly` | Kiosk Android (external dependency) | File/schema not specified | Acknowledgement not specified | Not specified | Device authentication pending | Simulate accepted/rejected upload | BACKEND_CONFIRMATION_REQUIRED | Deletion after 200 OK is described in DOCX but not confirmed. |
| POST | `/api/v1/sync/upload` | Backend sync agent, not a Tuấn UI | Sync schema not specified | Sync result schema not specified | Not specified | Service authentication pending | Simulate success/conflict/failure without implementing sync engine | BACKEND_CONFIRMATION_REQUIRED | Sync engine is out of scope. |
| POST | `/api/v1/sync/download` | Backend sync agent, not a Tuấn UI | Sync request schema not specified | Configuration/delta schema not specified | Not specified | Service authentication pending | Return deterministic sync fixture | BACKEND_CONFIRMATION_REQUIRED | Direction and naming require Backend review. |
| GET | `/api/v1/sync/status` | Web_Admin_Local | Query parameters not specified | Sync status schema not specified | Not specified | JWT Bearer/RBAC pending | Return configurable online/delayed/error state | BACKEND_CONFIRMATION_REQUIRED | UI only displays status; it does not own sync. |

## 12. Kiosk and survey-related endpoints

| Method | Path | Consumer App | Request payload | Response payload | Error responses | Authentication | Mock behavior | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|
| GET | `/api/v1/local/kiosk-config` | Kiosk Android (external dependency) | Device identity/query not specified | Kiosk configuration schema not specified | Not specified | Device authentication pending | Return sanitized device configuration fixture | BACKEND_CONFIRMATION_REQUIRED | Kiosk is out of scope. |
| GET | `/api/v1/local/services` | Kiosk Android (external dependency) | Filters not specified | Service list schema not specified | Not specified | Device authentication pending | Return mock services | BACKEND_CONFIRMATION_REQUIRED | Duplicates general `/services`; intended distinction unclear. |
| GET | `/api/v1/local/procedures` | Kiosk Android (external dependency) | Search/filter parameters not specified | Procedure list schema not specified | Not specified | Device authentication pending | Return deterministic procedure fixtures | BACKEND_CONFIRMATION_REQUIRED | Global versus Local override behavior unknown. |
| POST | `/api/v1/local/survey/submit` | Kiosk Android (external dependency) | Survey submission schema not specified | Submission acknowledgement not specified | Not specified | Device/session authentication pending | Store sanitized survey in resettable mock state | BACKEND_CONFIRMATION_REQUIRED | Kiosk survey is distinct from counter survey in DOCX. |
| GET | `/api/v1/local/tablets/{id}/config` | Display_Service_Quality or Tablet Android; ownership pending | `id` | Configuration schema must eventually include `surveyTimeoutSeconds`; remaining fields unspecified | Not specified | Device authentication pending | Return temporary `surveyTimeoutSeconds` explicitly marked `BACKEND_CONFIRMATION_REQUIRED` | BACKEND_CONFIRMATION_REQUIRED | Do not implement consumer while ownership is pending. |
| POST | `/api/v1/local/counter-survey/submit` | Display_Service_Quality or Tablet Android; ownership pending | Counter survey schema not specified | Submission acknowledgement not specified | Not specified | Device/session authentication pending | Accept sanitized fixture only after ownership work is authorized | BACKEND_CONFIRMATION_REQUIRED | No Phase 1 implementation. |

## 13. Central and Zalo API gaps

The DOCX describes capabilities but does not provide endpoint paths or schemas for:

- Central authentication and RBAC
- Global/site dashboard and reports
- Central device/configuration commands
- Zalo booking, QR issuance, booking status, cancellation, and check-in
- ZNS notification orchestration

No endpoints are created for these capabilities in this DRAFT. All are `BACKEND_CONFIRMATION_REQUIRED`.
