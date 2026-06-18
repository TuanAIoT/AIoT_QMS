# Application Matrix

> REST endpoints and MQTT topics in this table reference DRAFT contracts. They are not official until their contract entries are confirmed.

| App | Owner | Runtime | Deploy location | REST Server | REST endpoints | MQTT connection type | MQTT publish | MQTT subscribe | Phase | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Web_Teller | Tuấn | Browser Web App | Local LAN, staff device | Local Server | Auth, counter session, waiting queue, assisted ticket, call/recall/skip/transfer/finish | MQTT over WebSocket | None for queue commands | Counter-specific realtime topic | Phase 1 | IN_SCOPE | Business commands use REST. Must not publish directly to Display or Audio. |
| Display_Central | Tuấn | Browser/Web display runtime | Local display box or Smart TV | Local Server when configuration/content requires REST | Display configuration/content endpoints are not confirmed | MQTT over WebSocket | None | Queue call/recall/display updates | Phase 1 | IN_SCOPE | Local public display; not the Central Server. |
| Linux_Audio_Service | Tuấn | Linux service | Local RK3588/Box | Local Server only if audio/config retrieval is later confirmed | No confirmed REST endpoint | MQTT TCP | Operational status only if later confirmed | Audio play commands | Phase 1 | IN_SCOPE | Must tolerate duplicate QoS 1 commands by `eventId`. No raw CCCD in audio payload/log. |
| Web_Admin_Local | Tuấn | Browser Web App | Local LAN | Local Server | Dashboard, devices, staffs, counters, services, content, reports, logs, sync status | MQTT over WebSocket where realtime dashboard is required | None for authoritative state events | Local status/configuration events, exact topics pending | Phase 2 | IN_SCOPE | Mutations use REST; realtime display may subscribe to MQTT. |
| Display_Service_Quality | OWNER_PENDING | Web or Android is undecided | Local counter/tablet | Local Server | Tablet configuration and survey submission candidates | MQTT type undecided | None until ownership is confirmed | Tablet control candidate | NOT_IN_PHASE_1 | OWNER_PENDING | Do not implement. `surveyTimeoutSeconds` comes from Server configuration. |
| Web_Central_Admin | Tuấn | Browser Web App | Central administration environment | Central Server | Central endpoints not specified in source | MQTT use is not confirmed | None | None unless Backend confirms a Central realtime channel | Phase 3 | IN_SCOPE | Remote Local actions must be mediated by Central Backend. |
| Zalo_App | Tuấn | Zalo Mini App | Zalo platform/Internet | Central Server | Booking and QR/check-in endpoints not specified in source | None currently confirmed | None | None | Phase 3 | IN_SCOPE | Must not directly control Local devices or send raw CCCD to Central. |

## Development support components

| App | Owner | Runtime | Deploy location | REST Server | REST endpoints | MQTT connection type | MQTT publish | MQTT subscribe | Phase | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Mock Local Server | Tuấn | Development tooling, runtime undecided | Developer machine/CI | Itself | DRAFT Local API contract | Development broker/client, implementation deferred | Simulates Local Server events | May consume simulated device input only when contract requires it | Pre-Phase 1 | IN_SCOPE | Not created in this documentation task. |
| Mock Central Server | Tuấn | Development tooling, runtime undecided | Developer machine/CI | Itself | DRAFT Central API contract | Not yet decided | Only Backend-equivalent simulated events after contract approval | Not yet decided | Before Phase 3 | IN_SCOPE | Not created in this documentation task. |
| MQTT Simulator | Tuấn | Development tooling, runtime undecided | Developer machine/CI | N/A | N/A | WebSocket and TCP simulation as needed | DRAFT events as Local Server/Queue Engine identity | Test clients | Pre-Phase 1 | IN_SCOPE | Must support duplicate, delay, disconnect, malformed payload, and replay scenarios. |
