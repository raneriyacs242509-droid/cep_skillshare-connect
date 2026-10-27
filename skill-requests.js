
const token = sessionStorage.getItem("token");

const receivedBox = document.getElementById("receivedRequests");
const sentBox = document.getElementById("sentRequests");

function makeElement(tag, text, className) {
  const element = document.createElement(tag);
  element.textContent = text;

  if (className) element.className = className;

  return element;
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Request failed.");
  }

  return data;
}

function addActionButton(card, label, status, id) {
  const button = makeElement("button", label);

  button.addEventListener("click", async () => {
    button.disabled = true;

    try {
      await apiRequest(`/api/skill-requests/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });

      await loadRequests();
    } catch (error) {
      alert(error.message);
      button.disabled = false;
    }
  });

  card.appendChild(button);
}

function showError(box, error) {
  box.replaceChildren(makeElement("p", error.message));
}

function renderReceived(requests) {
  receivedBox.replaceChildren();

  if (!requests.length) {
    receivedBox.appendChild(
      makeElement("p", "No one has requested your skills yet.")
    );
    return;
  }

  requests.forEach(request => {
    const card = makeElement("div", "", "request-card");
    const name = request.sender?.name || "A user";

    card.appendChild(
      makeElement("h4", `${name} wants to learn ${request.skill}`)
    );

    if (request.message) {
      card.appendChild(makeElement("p", request.message));
    }

    card.appendChild(
      makeElement("p", `Status: ${request.status}`, "request-status")
    );

    if (request.status === "Pending") {
      addActionButton(card, "Accept", "Accepted", request._id);
      addActionButton(card, "Decline", "Declined", request._id);
    }

    receivedBox.appendChild(card);
  });
}

function renderSent(requests) {
  sentBox.replaceChildren();

  if (!requests.length) {
    sentBox.appendChild(
      makeElement("p", "You haven't sent any learning requests yet.")
    );
    return;
  }

  requests.forEach(request => {
    const card = makeElement("div", "", "request-card");

    card.appendChild(
      makeElement(
        "h4",
        `You requested to learn ${request.skill} from ${
          request.receiver?.name || "a user"
        }`
      )
    );

    card.appendChild(
      makeElement("p", `Status: ${request.status}`, "request-status")
    );

    sentBox.appendChild(card);
  });
}

async function loadRequests() {
  if (!token) {
    window.location.href = "login.html";
    return;
  }

  try {
    const [received, sent] = await Promise.all([
      apiRequest("/api/skill-requests/received"),
      apiRequest("/api/skill-requests/sent")
    ]);

    renderReceived(received.requests);
    renderSent(sent.requests);
  } catch (error) {
    showError(receivedBox, error);
    showError(sentBox, error);
  }
}

loadRequests();
