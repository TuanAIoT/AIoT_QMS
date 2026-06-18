# Tuấn Scope

## IN_SCOPE

### Web_Teller

Frontend for counter staff. It sends business commands through Local REST API and subscribes to counter-specific MQTT updates. It must not publish commands directly to Display or Audio.

### Display_Central

Local-site public display application. It subscribes to Local MQTT events and presents current calls, queue state, and configured content. It is distinct from the Central Server.

### Web_Admin_Local

Local-site administration frontend for counters, staff, devices, content, local configuration, audio routing, dashboards, and reports exposed by the Local Server contract.

### Web_Central_Admin

Central administration frontend for multi-site monitoring, aggregated reporting, site context, and Backend-mediated remote operations.

### Zalo_App

Citizen-facing Zalo application for booking and QR-related flows exposed by the Central Backend. The exact booking/check-in contract is pending Backend confirmation.

### Linux_Audio_Service

Linux service on the local RK3588 environment. It subscribes through MQTT TCP and plays TTS/audio only when Server-side routing selects the server speaker path.

### Frontend development mocks

- Mock Local REST API
- Mock Central REST API
- Mock MQTT event simulator
- Seed data and deterministic error/delay scenarios

Mocks support development only. They must implement DRAFT contracts without representing provisional assumptions as official Backend behavior.

## OUT_OF_SCOPE

- Production Local Backend
- Production Central Backend
- Production MongoDB
- Production EMQX Broker
- Queue algorithm
- EWT calculation
- Load balancing
- Sync engine
- Kiosk Android
- Tablet Android

Tuấn's applications may display or consume results from out-of-scope components, but must not reimplement their business authority in UI code.

## OWNER_PENDING

### Display_Service_Quality

- Ownership: `OWNER_PENDING`
- Phase: `NOT_IN_PHASE_1`
- Open question: Web application owned by Tuấn or Tablet Android application owned by Duy.
- Implementation rule: Do not create functionality, scaffold, or runtime-specific design until ownership is confirmed.
- Survey timeout rule: The UI must read `surveyTimeoutSeconds` from Server configuration. A temporary mock value is allowed only with `BACKEND_CONFIRMATION_REQUIRED`; neither 15 nor 30 seconds may be hardcoded as the product rule.
