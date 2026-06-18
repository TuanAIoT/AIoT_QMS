# Decisions Pending

> This file records unresolved decisions. It does not choose an answer for any item below.

## 1. Ownership of Display_Service_Quality

- Current state: `OWNER_PENDING`, `NOT_IN_PHASE_1`.
- Decision required: Is it a Web application owned by Tuấn or the Tablet Android application owned by Duy?
- Impact: Runtime, project ownership, MQTT connection type, API consumer, packaging, and test responsibility.
- Until resolved: Do not scaffold or implement the application.

## 2. Survey timeout: 15 or 30 seconds

- Fixed decision: UI must receive `surveyTimeoutSeconds` from Server configuration and must not hardcode either value.
- Pending decision: Official Server default, allowed range, per-site/per-device override, missing-value fallback, and whether an active survey reacts to configuration changes.
- Source conflict: The DOCX contains both 15-second and 30-second descriptions.
- Temporary mock value: Allowed only when marked `BACKEND_CONFIRMATION_REQUIRED`.

## 3. Official MQTT payload for each topic

- Confirm exact topic names, publisher ACL, subscriber ACL, QoS, retain, envelope version, and event-specific `data` schemas.
- Confirm types and generation rules for `eventId`, `locationId`, and `timestamp`.
- Confirm duplicate, ordering, replay, expiry, acknowledgement, and retained-message behavior.
- Resolve overlap among queue topics, display topics, device heartbeat topics, and the counter-specific topic.
- Status: `BACKEND_CONFIRMATION_REQUIRED`.

## 4. Official API requests and responses

- Confirm which candidate Local endpoints remain valid.
- Confirm request/response schema, pagination, filtering, validation, error envelope, HTTP status codes, idempotency, and authorization for each endpoint.
- Define Central and Zalo endpoint paths; none are specified in the source.
- Resolve `/api/local/...` references versus the `/api/v1` base path and `/api/v1/local/...` candidate paths.
- Status: `BACKEND_CONFIRMATION_REQUIRED`.

## 5. Login and refresh-token mechanism

- Confirm login identifiers and credential policy.
- Confirm access-token/refresh-token schema, transport, storage, expiry, rotation, revocation, logout behavior, and clock-skew handling.
- Confirm Local versus Central authentication separation and offline behavior.
- Confirm RBAC and location/counter/session authorization.
- Status: `BACKEND_CONFIRMATION_REQUIRED`.

## 6. Web_Central_Admin control of Local devices

- Fixed architecture: UI submits to Central Backend; it never publishes directly to a Local broker/device.
- Confirm command API, RBAC, location scoping, audit fields, command ID, expiry, delivery state, acknowledgement, retry, cancellation, and result reporting.
- Confirm whether Central-to-Local transport is MQTT, sync queue, or another Backend-owned mechanism.
- Status: `BACKEND_CONFIRMATION_REQUIRED`.

## 7. Zalo booking and check-in flow

- Confirm booking endpoints and request/response fields.
- Confirm QR format, signing, expiry, cancellation, replay protection, and offline validation.
- Confirm how booking data reaches the target Local Server and how delayed synchronization is handled.
- Confirm appointment priority, check-in timing, ticket activation, and notification rules.
- Confirm what citizen data is required while preserving the prohibition on raw CCCD at Central.
- Status: `BACKEND_CONFIRMATION_REQUIRED`.

## 8. TTS content and provider

- Confirm provider: FPT.AI, Viettel TTS, local/offline TTS, prerecorded audio, or a supported combination.
- Confirm command payload: text versus audio URI/blob/reference, voice, language, speed, volume, cache key, and fallback.
- Confirm outage behavior, retry, cancellation, interruption/queueing, acknowledgement, and privacy-safe logging.
- Confirm how server-speaker and kiosk-speaker routes are represented.
- Status: `BACKEND_CONFIRMATION_REQUIRED`.

## 9. MQTT authentication

- Confirm TLS requirements for LAN WebSocket and TCP connections.
- Confirm username/password, JWT, client certificate, or other client authentication.
- Confirm client ID convention, credential provisioning/rotation, topic ACLs, site isolation, session persistence, keepalive, Last Will, and reconnect policy.
- Confirm separate permissions for browser apps, Linux audio, Android devices, Local Server, and Central integration.
- Status: `BACKEND_CONFIRMATION_REQUIRED`.

## 10. Additional contract conflicts requiring resolution

- DOCX sometimes identifies `Web_Teller` as an MQTT publisher, while approved architecture requires Server publication for primary state events.
- DOCX proposes both consolidated and device-specific heartbeat topics.
- DOCX contains a UML `Ticket.cccdNumber` field, conflicting with current data-minimization and Central privacy rules.
- `Display_Central` naming may be confused with Central Server and should be clarified in product/UI naming if needed.
- DOCX describes Tablet as Duy's Android scope while the workspace lists `Display_Service_Quality` under Tuấn's repository scope.
- DOCX technology descriptions vary between React/Java and Kotlin for Kiosk; Kiosk remains out of Tuấn's scope but integration contracts need one owner.
