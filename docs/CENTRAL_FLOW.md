# Central Flow

## 1. Central boundary

The Central Server owns multi-site aggregation, Central authentication/authorization, remote operation orchestration, Zalo backend processing, and synchronization with Local Servers. Its production implementation is out of Tuấn's scope.

`Web_Central_Admin` and `Zalo_App` are consumers of Central APIs. They must not bypass the Central Backend to access MongoDB, a Local device, or a Local MQTT broker.

## 2. Local-to-Central synchronization

```text
Local Server
  -> Backend-owned sync engine/retry queue
  -> Central Server
  -> Central persistence and aggregation
  -> Web_Central_Admin queries aggregated/site-scoped views
```

The frontend does not implement sync conflict resolution, retry queues, delta selection, or location assignment. These are Backend responsibilities.

All synchronized records must preserve site isolation. Raw CCCD must never be synchronized. Only an approved `citizenHash` may cross the Local-to-Central boundary.

## 3. Web_Central_Admin flow

1. The administrator authenticates with the Central Server.
2. The UI loads global or permitted site context.
3. The administrator selects a site using the organization/location hierarchy.
4. Queries and reports are sent to Central REST endpoints scoped by Backend authorization.
5. A remote operation is submitted to the Central Server.
6. The Central Backend validates authorization and routes the command to the correct Local Server.
7. The Local Server publishes any required local device command and reports the result back through Backend-owned channels.

The UI must never publish a Local device MQTT command directly. Central endpoint paths, command result model, delivery acknowledgement, and audit behavior are `BACKEND_CONFIRMATION_REQUIRED`.

## 4. Central-to-Local configuration and device control

The DOCX source proposes a site-scoped MQTT configuration topic, but its official topic and payload are not confirmed. The architectural path is fixed as:

```text
Web_Central_Admin -> Central REST API -> Central Backend -> Local Server -> Local MQTT/device action
```

Backend must enforce location scope, RBAC, audit logging, command identity, expiry, and duplicate handling. The frontend displays Backend-reported status and must not assume that submission means device execution succeeded.

## 5. Zalo booking/check-in flow

```text
Citizen in Zalo_App
  -> Central booking API
  -> Central Backend creates an approved booking/QR representation
  -> Backend-owned synchronization makes allowed data available to the target Local Server
  -> Citizen presents QR at the site
  -> Local Server validates/checks in the booking
  -> Local Server creates or activates local queue state
  -> Local Server publishes local MQTT state events
```

The exact booking endpoints, QR contents, identity fields, appointment priority rules, synchronization timing, offline check-in rules, cancellation rules, and ZNS notification behavior are `BACKEND_CONFIRMATION_REQUIRED`.

`Zalo_App` must not publish local queue events. It must not send raw CCCD to Central.

## 6. Failure behavior

- If Central is unavailable, existing Local queue operations continue.
- `Web_Central_Admin` shows loading, empty, error, and stale-data states as applicable.
- A queued remote command must display its Backend-provided lifecycle; the UI must not invent delivery success.
- Zalo booking failure or delayed synchronization must not corrupt Local queue state.
- Retry, ordering, conflict resolution, and recovery are Backend-owned and require an official contract.

## 7. Data protection

- Central receives `citizenHash` only when required by the approved contract.
- Raw CCCD is prohibited in requests, responses, MQTT payloads, logs, analytics, URLs, QR codes, and mock data.
- Central APIs must enforce RBAC and site context on the Backend.
- Production URLs, client secrets, access tokens, and MQTT credentials must not be committed.
