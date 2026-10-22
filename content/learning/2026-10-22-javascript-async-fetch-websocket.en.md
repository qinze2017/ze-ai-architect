+++
title = "Senior Java: JavaScript Async, Fetch/AJAX, and WebSocket"
date = 2026-10-22
draft = false
summary = "From the event loop to asynchronous HTTP and WebSocket, design reliable shared data updates across web and mobile."
tags = ["JavaScript", "WebSocket", "AJAX", "Fetch API", "Full-Stack", "Architecture"]
categories = ["Learning"]
showComments = true
+++

## Learning goals

Explain synchronous vs. asynchronous JavaScript, the roles of Promise and the **event loop**, the difference between **Fetch/AJAX** and **WebSocket**, and how to keep a web application and a mobile client consistent when data changes.

**Illustrative business scenario:** a platform for automated poultry-farm operations processes invoices, calculates fees, and displays measurements. This architecture example is for learning; it does **not** claim these exact implementation choices were used in a particular past project.

## 1. Synchronous vs. asynchronous execution

Synchronous code runs in order. With an asynchronous operation, such as an HTTP request or timer, JavaScript can continue executing other tasks without waiting for that result. A callback or Promise continuation runs later.

~~~javascript
console.log("A");
setTimeout(() => console.log("B"), 0);
Promise.resolve().then(() => console.log("C"));
console.log("D");
// A → D → C → B
~~~

The synchronous statements run first. The Promise callback is a **microtask**, which runs before the timer task in this example. The **event loop** coordinates the queues and execution.

**async/await** is readable syntax for working with Promises; it does not automatically spawn a thread. Await suspends the rest of the current async function, not the entire user interface.

## 2. Fetch and AJAX: asynchronous HTTP

Imagine a measurement dashboard that calls GET /api/measurements:

~~~javascript
async function loadMeasurements() {
  const response = await fetch("/api/measurements");
  if (!response.ok) {
    throw new Error("HTTP " + response.status);
  }
  const data = await response.json();
  document.querySelector("#temperature").textContent =
    String(data.temperature);
}

loadMeasurements().catch(console.error);
~~~

Equivalent style with jQuery AJAX:

~~~javascript
$.ajax({
  url: "/api/measurements",
  method: "GET",
  success: function (data) {
    updateDashboard(data);
  },
  error: function (xhr) {
    console.error("Request failed:", xhr.status);
  }
});
~~~

Both approaches **initiate an HTTP request from the client** and process its response. Neither keeps listening for server changes. To refresh periodically, use **polling**.

**Common Fetch pitfall:** a 404 or 500 response normally does not reject the Promise; check response.ok. Network failures usually do reject it.

## 3. WebSocket: persistent two-way communication

WebSocket normally begins with an HTTP Upgrade handshake, then uses a long-lived connection for bidirectional messages. The server can push a measurement-updated notification without waiting for a new HTTP request. Production connections normally use **wss://**.

~~~javascript
const socket = new WebSocket("wss://your-domain.test/ws/measurements");

socket.addEventListener("message", (event) => {
  try {
    const message = JSON.parse(event.data);
    if (message.type === "measurement.updated") {
      refreshMeasurements(); // Re-fetch authoritative state
    }
  } catch (error) {
    console.error("Invalid message", error);
  }
});

socket.addEventListener("close", () => {
  console.warn("Disconnected: reconnect and resync required");
});
~~~

This is an **educational fragment, not a production-ready client**. Production needs authentication, subscription authorization, backoff-based reconnection, connection liveness checks, and error observability.

| Technology | Communication model | Typical usage |
| --- | --- | --- |
| Fetch / AJAX | Client-initiated HTTP request | Query measurements, submit fees |
| Polling | Repeated HTTP requests | Basic automatic dashboard refresh |
| WebSocket | Persistent bidirectional connection | Update notifications, live measurements |
| SSE | Server-to-client event stream over HTTP | One-way live updates |

**Do not conflate JavaScript asynchrony (an execution model) with WebSocket (a communication protocol).** Sharing data between web and mobile does not by itself prove WebSocket was used.

## 4. Architecture exercise: shared state for web and mobile

A reliable design can work as follows:

1. A web or mobile client calls a REST API to read current fees and measurements.
2. When a user edits a fee, the back end validates rules and persists the change.
3. **After the transaction commits**, publish a “fee updated” event so clients are not notified about changes that did not commit.
4. WebSocket subscribers receive the event and fetch the latest snapshot through the API.
5. After reconnecting, clients reload authoritative state; **WebSocket messages are not the source of truth**.

Two clients can edit the same fee at the same time. Message delivery does not resolve the conflict. The back end still needs a concurrency policy, for example an **optimistic locking version** and an HTTP 409 response for stale updates.

### Failure modes worth designing for

- **Missed updates while offline:** reload a snapshot or resume from an event cursor.
- **Duplicate/out-of-order events:** include entity IDs, versions, or sequence numbers; make handlers idempotent.
- **Unauthorized subscriptions:** authenticate clients and enforce access control for each data stream.
- **Crash after commit but before notification:** consider a transactional outbox and worker for critical event delivery.

## 5. Fifteen-minute hands-on practice

1. Fetch data from a disposable GET /api/measurements endpoint; handle HTTP failures.
2. Add a five-second polling interval, ensuring requests do not overlap.
3. Write a WebSocket message handler that simulates a measurement.updated event and re-fetches current data.
4. Simulate a 30-second disconnection. How should the client recover changes it missed?

**Acceptance criteria:** explain the event loop and Promise continuations, HTTP request/response, server-initiated events, and the difference between an update notification and committed database state.

## 6. Senior developer interview questions

**Q1. Does await block the entire browser UI?** No. It suspends the continuation of the async function. Heavy synchronous JavaScript can still block the main thread.

**Q2. Is Fetch the same as WebSocket?** No. Fetch uses HTTP request/response; WebSocket keeps an open bidirectional connection.

**Q3. How do you recover from a dropped WebSocket connection?** Reconnect with backoff, then fetch the latest state or resume from a durable event cursor. Do not assume notifications never go missing.

**Q4. How do you prevent lost updates when two clients edit the same fee?** Detect conflicts server-side, for example through optimistic locking, then provide an explicit retry or conflict-resolution path.

## Takeaway

**Asynchrony avoids blocking while waiting. Fetch/AJAX makes HTTP requests. WebSocket sends messages over a persistent two-way connection. Transactions and concurrency control protect business-state consistency.** Choose a design based on latency, operational complexity, and reliability requirements.

References: [MDN JavaScript execution model](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Execution_model) · [MDN Using Fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch) · [MDN WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)
