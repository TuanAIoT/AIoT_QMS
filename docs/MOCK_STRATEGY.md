# Mock Strategy

> This document defines the future mock architecture only. No mock server or runtime is created in the current documentation task.

## 1. Goals

Mocks allow Tuấn's applications to develop independently while the production Local Backend, Central Backend, MongoDB, and MQTT infrastructure are owned by other team members.

Mocks must:

- Follow the same public API-client and MQTT-client boundaries used with real Servers.
- Model Server-authoritative state transitions.
- Keep unconfirmed fields and behavior visibly marked `BACKEND_CONFIRMATION_REQUIRED`.
- Be deterministic, resettable, and safe for tests.
- Contain no real CCCD, production token, password, or production URL.
- Avoid implementing production queue, EWT, load-balancing, or sync algorithms.

## 2. Mock Local Server

The future Mock Local Server represents the Local Server boundary for frontend development.

Responsibilities:

- Expose only endpoint candidates documented in `API_CONTRACT.md`.
- Maintain an in-memory or fixture-backed authoritative state for counters, sessions, tickets, devices, content, and local configuration.
- Process `Web_Teller` commands through REST.
- Publish resulting MQTT events as the Local Server/Queue Engine identity.
- Provide deterministic loading, empty, success, validation failure, authorization failure, and Server failure scenarios.
- Support local operation without a Mock Central Server.

It must not allow `Web_Teller` to publish call, recall, transfer, finish, display, or audio commands directly.

## 3. Mock Central Server

The future Mock Central Server supports `Web_Central_Admin` and `Zalo_App` after their Central API contracts are documented.

Responsibilities:

- Provide site-scoped administration and reporting fixtures.
- Simulate remote command submission and lifecycle without directly controlling a Local device from the UI.
- Simulate Zalo booking and check-in only after official request/response contracts exist.
- Simulate Local synchronization states without implementing a production sync engine.
- Enforce the rule that Central receives only approved fields and never raw CCCD.

No Central endpoint path is invented in this phase because the source documents do not specify them.

## 4. MQTT Simulator

The future MQTT Simulator represents Server-published events and device-originated status events defined in `MQTT_CONTRACT.md`.

Required capabilities:

- Browser MQTT over WebSocket scenarios.
- MQTT TCP scenarios for `Linux_Audio_Service`.
- Valid event emission using `eventId`, `locationId`, and `timestamp`.
- Duplicate delivery for QoS 1 validation.
- Out-of-order, delayed, malformed, unknown-version, wrong-location, and disconnected scenarios.
- Reconnection and event replay scenarios once Backend defines session behavior.
- Server identity as publisher for primary queue/display/audio state events.

The simulator must not make a DOCX payload example an official contract.

## 5. Seed data

Seed data should include:

- At least two locations to test location isolation.
- Multiple counters with open, closed, busy, and offline states.
- Staff accounts using clearly fictional names and credentials.
- Waiting, called, serving, skipped, transferred, finished, and cancelled ticket scenarios where supported by the confirmed contract.
- Empty queue and no-active-session scenarios.
- Online/offline display and audio devices.
- Safe content metadata and report fixtures.
- A survey configuration fixture containing `surveyTimeoutSeconds` only after ownership work is allowed.

Seed rules:

- Never use a real CCCD.
- Prefer no CCCD-shaped value at all. If an identity-like fixture is unavoidable, label it synthetic and keep it out of logs and Central fixtures.
- `citizenHash` fixtures must be obviously synthetic and non-reversible test values.
- Temporary schemas/defaults must carry `BACKEND_CONFIRMATION_REQUIRED` in documentation or fixture metadata.

## 6. Error simulation modes

The future mock configuration should support deterministic named modes rather than random failures:

| Mode | Expected simulation |
|---|---|
| `normal` | Successful REST and MQTT behavior. |
| `empty` | Valid empty datasets and no active queue/session. |
| `unauthorized` | Authentication/authorization failure using the later confirmed error envelope. |
| `validation_error` | Invalid command using the later confirmed validation envelope. |
| `server_error` | Local or Central request failure. |
| `mqtt_disconnected` | Broker unavailable or connection dropped. |
| `mqtt_duplicate` | Repeat QoS 1 event with the same `eventId`. |
| `mqtt_malformed` | Invalid envelope or event-specific payload. |
| `wrong_location` | Valid-looking event with a different `locationId`. |
| `central_offline` | Local remains operational while Central is unavailable. |
| `remote_command_pending` | Central accepts a command but Local execution is not yet acknowledged. |

Exact HTTP status codes and error bodies remain `BACKEND_CONFIRMATION_REQUIRED`.

## 7. Delay simulation

Delay must be configurable per scenario or endpoint rather than embedded in UI components. Suggested categories are immediate, normal latency, slow response, and timeout; numeric values are development configuration, not product contracts.

MQTT delay simulation must also support reordered delivery. UI tests should verify loading, stale, reconnecting, and error states without relying on a fixed network duration.

`surveyTimeoutSeconds` is a Server configuration field, not network delay configuration. A temporary mock value may be selected later but must be marked `BACKEND_CONFIRMATION_REQUIRED`.

## 8. Reset behavior

The future mock must provide a deterministic reset mechanism available to development and tests, not production UI.

Reset restores:

- Original seed users and sessions
- Counter and ticket states
- Device status and content fixtures
- Mock Central site data
- Event sequence/deduplication records
- Selected simulation mode and delays

The reset transport and command are intentionally not defined until the mock runtime is chosen. It must not be added to the production API contract.

## 9. Replacing mocks with real Servers

UI components must remain unchanged when switching environments.

The intended boundary is:

```text
UI component
  -> application service/hook
  -> shared api-client or mqtt-client interface
  -> mock adapter OR real network adapter
```

Environment configuration selects the adapter/base URL/broker connection. Components consume typed results and view states, never mock-specific fixture structures. Existing `Web_Teller` guidance uses `VITE_API_MODE=mock` and `VITE_API_MODE=http`; the final cross-app environment convention should be documented before implementation.

Contract tests should run the same behavioral expectations against mock adapters and, when available, Backend integration environments.

## 10. Mock acceptance criteria

- REST mutation produces state change only inside the Mock Local Server.
- Resulting realtime event is published by the Mock Local Server identity.
- Duplicate QoS 1 events do not duplicate display transitions or audio playback.
- Central-offline mode leaves Local flows operational.
- No fixture or log contains raw CCCD.
- Reset produces identical seed state.
- Switching mock/real transport requires configuration changes, not UI component edits.
