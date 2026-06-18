# Local Flow

## 1. Local authority

The Local Server or Mock Local Server is the authoritative source for queue, ticket, counter session, device, and local configuration state. Local browser applications must not create an alternate source of truth by sending business events directly to each other.

The core flow is:

```text
REST command -> Local validation/state transition -> MQTT state event -> UI/Audio reaction
```

## 2. Web_Teller startup

1. `Web_Teller` authenticates with the Local Server through REST.
2. It loads the counters and other required initial data through REST.
3. The staff member selects a counter and starts or restores a counter session through REST.
4. `Web_Teller` connects to MQTT over WebSocket.
5. It subscribes to the counter-specific realtime topic.
6. It reconciles MQTT updates with the last REST state rather than assuming the UI is authoritative.

The exact authentication payload, session payload, initial data requirements, and MQTT payload are `BACKEND_CONFIRMATION_REQUIRED`.

## 3. Queue command flow

The same command pattern applies to call next, recall, skip, transfer, finish, and assisted ticketing:

1. Staff triggers an action in `Web_Teller`.
2. The component calls the shared API client.
3. The API client sends a REST request to the Local Server.
4. The Local Server authenticates, authorizes, validates, and applies the state transition.
5. The Local Server returns the command result.
6. The Local Server or its Queue Engine publishes the resulting MQTT event.
7. `Display_Central`, `Linux_Audio_Service`, and other applicable devices consume that event.
8. `Web_Teller` receives the counter-specific update and reconciles its local view.

`Web_Teller` must not publish call, recall, transfer, finish, display, or audio events directly.

## 4. Display flow

1. `Display_Central` loads configuration/content through REST only when a confirmed endpoint exists.
2. It connects to the Local broker through MQTT over WebSocket.
3. It validates every MQTT envelope and event-specific payload before processing.
4. It ignores events for another `locationId`.
5. For QoS 1 messages, it records recently processed `eventId` values and ignores duplicates.
6. It renders loading, empty, connected, reconnecting, and error states.

The display remains independent of Central Server availability.

## 5. Audio flow

1. Local Admin configuration selects the audio routing mode.
2. The Local Server decides whether the server-speaker route or Kiosk-speaker route applies.
3. For the server-speaker route, the Local Server publishes an audio command.
4. `Linux_Audio_Service` receives the command through MQTT TCP.
5. It validates the payload, checks `locationId`, and deduplicates by `eventId` before playback.
6. It plays the approved TTS/audio content and records only non-sensitive operational information.

TTS provider, payload content, retry policy, interruption policy, and acknowledgement behavior are `BACKEND_CONFIRMATION_REQUIRED`.

## 6. Local Admin flow

`Web_Admin_Local` uses REST for configuration mutations and management commands. Realtime dashboard information may use MQTT over WebSocket or the documented live API after Backend confirmation.

Remote device actions follow this path:

```text
Web_Admin_Local -> REST -> Local Server -> MQTT device command -> target device
```

The Admin UI does not publish authoritative device commands directly.

## 7. Survey configuration boundary

`Display_Service_Quality` is `OWNER_PENDING` and `NOT_IN_PHASE_1`; this section documents only the required boundary.

- Survey duration must come from Server configuration as `surveyTimeoutSeconds`.
- UI code must not hardcode 15 or 30 seconds as the product rule.
- A later mock may supply a temporary value marked `BACKEND_CONFIRMATION_REQUIRED`.
- Tablet control payload, survey submission payload, ownership, and runtime remain undecided.

## 8. Offline and reconnect behavior

- Loss of Internet/Central connectivity must not stop Local queue operations.
- Loss of Local REST prevents new commands and must produce an explicit error state.
- Loss of MQTT switches consumers to reconnecting/stale state; it must not fabricate new queue state.
- After reconnect, applications must reload an authoritative REST snapshot when the confirmed contract supports it, then resume MQTT updates.
- QoS 1 duplicates are expected and handled through `eventId`.
- Malformed or unrecognized MQTT payloads are rejected and logged without sensitive citizen data.

The precise snapshot/recovery endpoints and ordering guarantees are `BACKEND_CONFIRMATION_REQUIRED`.

## 9. Security rules

- Never place raw CCCD in MQTT messages, browser logs, service logs, seed data, or error messages.
- Central-facing data may contain `citizenHash`, not raw CCCD.
- Do not commit credentials, tokens, passwords, or production URLs.
- Authentication and MQTT authorization must be enforced by the Server/Broker contract, not simulated as UI-only security.
