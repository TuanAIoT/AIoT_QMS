# QMS System Overview

> Status: Architecture draft for frontend development. REST and MQTT details remain subject to Backend confirmation.

## 1. Architectural principles

QMS follows a **Local-First** architecture. Operations at a deployment site must continue when the Internet or Central Server is unavailable. The Local Server is the authority for local queue state, ticket state, counter state, device coordination, and realtime events.

The main principles are:

- Local operation does not depend on Central connectivity.
- Business commands are sent to a Server through REST, not directly between UI applications.
- The Local Server or Mock Local Server is the source of truth for local state and publishes MQTT state events.
- Browser applications connect to MQTT through WebSocket.
- `Linux_Audio_Service` connects to MQTT through TCP.
- Central synchronization is eventually consistent and owned by the Backend team.
- Raw CCCD data must not be sent to Central, included in MQTT payloads, or written to logs.

## 2. Main system areas

### 2.1. Local Server

The Local Server runs at each deployment location and owns the local operational state. Its expected responsibilities include REST API handling, authentication enforcement, queue processing, counter sessions, device coordination, content/configuration delivery, publishing MQTT events, and synchronization with Central.

The production Local Backend, MongoDB, production MQTT broker, queue algorithm, EWT calculation, load balancing, and sync engine are not owned by Tuấn. During frontend development, these dependencies are represented by mocks under `/mocks`.

### 2.2. Central Server

The Central Server is the Backend platform for cross-location administration, aggregated reporting, remote configuration, Zalo-related backend operations, and Local-to-Central synchronization. It is not part of Tuấn's implementation scope.

Central must receive only data allowed for aggregation. In particular, it may receive `citizenHash`, but must never receive raw CCCD data.

### 2.3. REST API

REST is used for commands, queries, authentication, configuration, and reports. The Local REST base path is `/api/v1`.

`Web_Teller` sends queue commands by REST. A successful UI action does not directly command Display or Audio. The Local Server processes the command and then publishes the corresponding MQTT state event.

Components must use the shared API client rather than calling `fetch` directly. Endpoint details remain DRAFT in `API_CONTRACT.md` until Backend confirms them.

### 2.4. MQTT

MQTT distributes realtime state and device commands after Server-side processing.

- Local Server or Mock Local Server publishes primary queue state events.
- Browser applications use MQTT over WebSocket.
- `Linux_Audio_Service` uses MQTT over TCP.
- Browser applications may subscribe to topics relevant to their role.
- `Web_Teller` may subscribe to counter-specific realtime updates, but must not publish call, recall, transfer, or finish events to Display or Audio.
- QoS 1 consumers must tolerate duplicate delivery. Important payloads require an `eventId` for deduplication.

Topic names and payload schemas remain DRAFT in `MQTT_CONTRACT.md` until Backend confirms them.

## 3. Applications owned by Tuấn

- `Web_Teller`
- `Display_Central`
- `Web_Admin_Local`
- `Web_Central_Admin`
- `Zalo_App`
- `Linux_Audio_Service`
- Mock REST and Mock MQTT facilities required for frontend development

`Display_Service_Quality` is recorded as `OWNER_PENDING` and `NOT_IN_PHASE_1`. No functionality may be implemented for it until ownership and runtime are confirmed.

## 4. Components not owned by Tuấn

- Production Local Backend and Central Backend
- Production MongoDB and EMQX infrastructure
- Queue algorithm, EWT calculation, load balancing, and synchronization engine
- Kiosk Android and Tablet Android applications
- Production device firmware and production deployment infrastructure owned by other team members

## 5. Local Teller flow

```text
User action in Web_Teller
  -> REST command to Local Server
  -> Local Server validates and updates authoritative state
  -> Local Server publishes MQTT event
  -> Display_Central updates its view
  -> Linux_Audio_Service plays audio when routing selects server speaker
  -> Web_Teller receives counter-specific realtime state when applicable
```

There is no direct `Web_Teller -> Display_Central` or `Web_Teller -> Linux_Audio_Service` command channel.

## 6. Zalo and Central flow

```text
Zalo_App
  -> Central Server REST API
  -> Central Backend stores/processes booking data
  -> Backend-owned synchronization delivers allowed booking/check-in data to Local Server
  -> Local Server validates the booking or QR during local check-in
  -> Local Server creates/activates local queue state and publishes local MQTT events
```

The exact booking, QR, synchronization, and check-in contracts are `BACKEND_CONFIRMATION_REQUIRED`. `Zalo_App` must not connect directly to a Local device or publish local queue events.

## 7. Display_Central versus Central Server

`Display_Central` is the public-facing display application deployed at a Local site, typically on a Linux/Android display box or Smart TV environment. It subscribes to the Local MQTT broker and renders local queue information.

`Central Server` is the multi-site Backend platform hosted in the central infrastructure. It aggregates data and coordinates cross-site administration. Despite the similar names, `Display_Central` is not the Central Server and must remain operational when Central connectivity is lost.

## 8. Contract precedence

The working order of authority is:

1. Approved architecture decisions in `AGENTS.md` and reviewed decisions.
2. Confirmed entries in `API_CONTRACT.md` and `MQTT_CONTRACT.md`.
3. TypeScript contracts under `/packages/contracts` after implementation begins.
4. DOCX source documents as requirement references only.

When a contract is missing, document the assumption, mark it `BACKEND_CONFIRMATION_REQUIRED`, update the mock in the later implementation phase, and do not present it as an official Backend contract.
