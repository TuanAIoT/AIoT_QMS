# MQTT Contract

> Document status: **DRAFT**. Topic candidates from the QMS V6.0 DOCX are not official until Backend confirms them.

## 1. Fixed architecture rules

- Local Server or Mock Local Server publishes primary queue state events.
- `Web_Teller` sends business commands through REST, not MQTT.
- `Web_Teller` may subscribe to counter-specific realtime updates.
- Browser applications use MQTT over WebSocket.
- `Linux_Audio_Service` uses MQTT TCP.
- QoS 1 may deliver duplicates. Important events require `eventId` and consumer deduplication.
- Raw CCCD is prohibited in MQTT payloads and logs.

## 2. Status values

Only `CONFIRMED`, `PROVISIONAL`, and `BACKEND_CONFIRMATION_REQUIRED` are used for contract entries.

## 3. Proposed common envelope

The field names below are required by the frontend architecture, but their types and complete envelope remain `BACKEND_CONFIRMATION_REQUIRED`:

```json
{
  "eventId": "BACKEND_CONFIRMATION_REQUIRED",
  "locationId": "BACKEND_CONFIRMATION_REQUIRED",
  "timestamp": "BACKEND_CONFIRMATION_REQUIRED",
  "data": {}
}
```

- `eventId`: Stable unique identity for deduplicating retries/duplicates.
- `locationId`: Site boundary used to reject cross-location events.
- `timestamp`: Server event time; format and clock-skew rules require confirmation.
- `data`: Event-specific payload. No event-specific schema is invented in this DRAFT.

## 4. Topic matrix

| Topic | Publisher | Subscriber | QoS | Retain | Payload | eventId | locationId | timestamp | Duplicate handling | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `hcc/counter/{counterId}/events` | Local Server / Queue Engine | Web_Teller for the selected counter | Not specified | Not specified | Common envelope; event union schema not specified | Required for important events; type pending | Required; type pending | Required; format pending | Deduplicate QoS 1 events by `eventId`; reconcile with REST snapshot | PROVISIONAL | Topic appears in `apps/Web_Teller/AGENTS.md`; payload and QoS still need Backend confirmation. Web_Teller subscribes only. |
| `hcc/queue/call` | Local Server / Queue Engine | Display_Central, survey device when applicable, Linux_Audio_Service routing, LED | QoS 1 candidate from DOCX | Not specified | Common envelope; called-ticket/counter fields not specified | Required | Required | Required | Ignore previously processed `eventId`; playback/display must be idempotent | BACKEND_CONFIRMATION_REQUIRED | DOCX lists Teller as a publisher in places; architecture decision overrides that. |
| `hcc/queue/recall` | Local Server / Queue Engine | Display_Central, Linux_Audio_Service routing, LED | QoS 1 candidate | Not specified | Common envelope; recall fields not specified | Required | Required | Required | Deduplicate by `eventId`; Backend must define whether intentional recalls use new IDs | BACKEND_CONFIRMATION_REQUIRED | Web_Teller triggers recall by REST only. |
| `hcc/queue/transfer` | Local Server / Queue Engine | Display_Central and affected counter subscribers | QoS 1 candidate | Not specified | Common envelope; source/destination fields not specified | Required | Required | Required | Deduplicate by `eventId`; consumers apply transition idempotently | BACKEND_CONFIRMATION_REQUIRED | DOCX publisher assignment is replaced by Server authority. |
| `hcc/queue/finish` | Local Server / Queue Engine | Counter subscribers and survey device when applicable | QoS 1 candidate | Not specified | Common envelope; finished ticket/survey trigger fields not specified | Required | Required | Required | Deduplicate by `eventId`; survey UI must not restart timeout for duplicate | BACKEND_CONFIRMATION_REQUIRED | `Display_Service_Quality` remains OWNER_PENDING. |
| `hcc/audio/play` | Local Server / Queue Engine | Linux_Audio_Service or Kiosk audio consumer according to Server routing | QoS not specified | Not specified | Common envelope; text/audio URI/voice/retry fields not specified | Required | Required | Required | Audio consumer deduplicates by `eventId` to prevent repeated playback | BACKEND_CONFIRMATION_REQUIRED | TTS provider and content contract are pending. No raw CCCD. |
| `hcc/display/update` | Local Server / Queue Engine | Display_Central | QoS 0 candidate from DOCX | Not specified | Common envelope; display snapshot/delta schema not specified | Required field; importance rules pending | Required | Required | Ignore duplicate `eventId`; tolerate loss if Backend confirms snapshot semantics | BACKEND_CONFIRMATION_REQUIRED | Exact relationship to queue topics requires confirmation. |
| `hcc/display/led-update` | Local Server / Queue Engine | LED firmware | QoS not specified | Not specified | Common envelope; LED layout fields not specified | Required for important commands | Required | Required | LED/consumer behavior requires Backend/firmware confirmation | BACKEND_CONFIRMATION_REQUIRED | LED implementation is outside Tuấn's scope. |
| `hcc/tablet/{counterId}/control` | Local Server / Queue Engine | Survey device for the counter | QoS 1 candidate | Not specified | Common envelope; control command and `surveyTimeoutSeconds` schema not specified | Required | Required | Required | Deduplicate by `eventId`; duplicate survey event must not reset timeout | BACKEND_CONFIRMATION_REQUIRED | No implementation while Display_Service_Quality ownership is pending. |
| `hcc/tablet/status` | Tablet Android or confirmed survey runtime | Local Server | QoS 0 candidate | Not specified | Common envelope; battery/mode/version fields not specified | Required field; uniqueness rule pending | Required | Required | Server may ignore duplicate/out-of-order status by identity/time | BACKEND_CONFIRMATION_REQUIRED | Tablet Android is out of scope; publisher may change after ownership decision. |
| `hcc/kiosk/tickets` | Local Server / Queue Engine if retained as a state event | Queue/display consumers to be confirmed | QoS 1 candidate | Not specified | Common envelope; new-ticket fields not specified | Required | Required | Required | Deduplicate by `eventId` | BACKEND_CONFIRMATION_REQUIRED | DOCX says Kiosk publishes after REST creation, conflicting with Server authority. Topic purpose or removal must be confirmed. |
| `hcc/kiosk/heartbeat` | Kiosk Android | Local Server | QoS 0 candidate | Not specified | Common envelope; printer/reader/scanner/battery fields not specified | Required field; heartbeat identity semantics pending | Required | Required | Server uses latest timestamp/device identity; duplicate policy pending | BACKEND_CONFIRMATION_REQUIRED | Kiosk Android is outside Tuấn's scope. |
| `hcc/kiosk/services/update` | Local Server / Queue Engine | Kiosk Android devices | QoS not specified | Not specified | Common envelope; service/next-number fields not specified | Required for important changes | Required | Required | Deduplicate by `eventId`; snapshot versus delta pending | BACKEND_CONFIRMATION_REQUIRED | Kiosk consumer is outside Tuấn's scope. |
| `hcc/device/{deviceId}/control` | Local Server after REST/Backend authorization | Target Local device | QoS 1 candidate | Not specified | Common envelope; command, expiry, correlation, and parameters not specified | Required | Required | Required | Device deduplicates by `eventId`; expired/replayed commands must not execute | BACKEND_CONFIRMATION_REQUIRED | Proposed commands include reboot/shutdown/restart/sync, but official enum is pending. |
| `hcc/device/heartbeat` | Local devices | Local Server | QoS 0 candidate | Not specified | Common envelope; device status schema not specified | Required field; heartbeat identity semantics pending | Required | Required | Server evaluates latest valid timestamp; offline threshold pending | BACKEND_CONFIRMATION_REQUIRED | DOCX also has device-specific heartbeat topics; consolidation is unresolved. |
| `config/location_{X}` | Central Backend through Backend-owned channel, or Local Server after sync; publisher boundary unresolved | Local Server for location X | QoS 1 candidate | Not specified | Common envelope; configuration/OTA schema not specified | Required | Required | Required | Deduplicate by `eventId`; apply configuration idempotently and enforce version ordering | BACKEND_CONFIRMATION_REQUIRED | Topic syntax, Central-to-Local transport, signing, and authorization are unresolved. |

## 5. Connection expectations

| Consumer | Connection | Current requirement |
|---|---|---|
| Web_Teller | MQTT over WebSocket | Subscribe to selected counter events; no queue command publishing. |
| Display_Central | MQTT over WebSocket | Subscribe to confirmed Local display/queue events. |
| Web_Admin_Local | MQTT over WebSocket when confirmed | Realtime status only; REST remains the mutation channel. |
| Display_Service_Quality | Undecided | Do not implement before ownership/runtime confirmation. |
| Linux_Audio_Service | MQTT TCP | Subscribe to confirmed audio commands and deduplicate playback. |

## 6. Validation and security

- Validate the common envelope before inspecting `data`.
- Validate event-specific `data` before updating UI or playing audio.
- Reject missing/invalid `eventId`, `locationId`, or `timestamp` according to the eventual confirmed schema.
- Never log full payloads when they may contain personal data.
- Never include raw CCCD in any MQTT event.
- MQTT authentication, TLS, client identity, ACLs, session policy, Last Will, keepalive, and reconnect backoff are `BACKEND_CONFIRMATION_REQUIRED`.
