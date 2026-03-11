const state = {
  userId: "",
  userName: "",
  driverId: "",
  vehicleId: "",
  rideId: "",
  ridePrice: "",
  paymentId: "",
};

const output = document.getElementById("output");
const flash = document.getElementById("flash");
const sessionName = document.getElementById("session-name");
const sessionMeta = document.getElementById("session-meta");

function parseForm(form) {
  const formData = new FormData(form);
  const data = {};

  for (const [key, value] of formData.entries()) {
    if (value === "") {
      continue;
    }

    const field = form.querySelector(`[name="${key}"]`);
    data[key] = field?.type === "number" ? Number(value) : value;
  }

  return data;
}

function syncInputs() {
  document.querySelectorAll("[data-fill]").forEach((input) => {
    const key = input.dataset.fill;
    if (state[key] !== "" && !input.matches(":focus")) {
      input.value = state[key];
    }
  });
}

function updateSession() {
  sessionName.textContent = state.userName
    ? `${state.userName} (${state.userId})`
    : "Nenhum usuário logado";

  const details = [];
  if (state.driverId) details.push(`driver ${state.driverId}`);
  if (state.vehicleId) details.push(`vehicle ${state.vehicleId}`);
  if (state.rideId) details.push(`ride ${state.rideId}`);
  if (state.paymentId) details.push(`payment ${state.paymentId}`);

  sessionMeta.textContent =
    details.length > 0
      ? `Contexto atual: ${details.join(" • ")}`
      : "Faça login ou cadastre um usuário para preencher IDs automaticamente.";

  syncInputs();
}

function renderOutput(title, payload) {
  output.textContent = `${title}\n\n${JSON.stringify(payload, null, 2)}`;
}

function showFlash(message, kind = "success") {
  flash.textContent = message;
  flash.className = `flash ${kind}`;
}

function updateStateFromResponse(payload) {
  const user = payload?.user;
  const driver = payload?.driver;
  const vehicle = payload?.vehicle;
  const ride = payload?.ride;
  const payment = payload?.payment;

  if (user?.id) {
    state.userId = user.id;
    state.userName = user.name || state.userName;
    if (user.driverDetails?.driverId) {
      state.driverId = user.driverDetails.driverId;
    }
  }

  if (driver?.id) {
    state.driverId = driver.id;
  }

  if (vehicle?.id) {
    state.vehicleId = vehicle.id;
  }

  if (ride?.id) {
    state.rideId = ride.id;
    if (ride.price) {
      state.ridePrice = ride.price;
    }
  }

  if (payload?.tripDetails?.priceBRL) {
    state.ridePrice = payload.tripDetails.priceBRL;
  }

  if (payment?.id) {
    state.paymentId = payment.id;
  }

  updateSession();
}

async function request(method, url, body) {
  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || payload.message || "Requisicao falhou.");
  }

  return payload;
}

function bindForm(id, handler) {
  document.getElementById(id).addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;

    try {
      const payload = await handler(parseForm(form));
      updateStateFromResponse(payload);
      renderOutput(`${form.querySelector("h3, h2, button")?.textContent || id}`, payload);
      showFlash(payload.message || "Operacao concluida.");
    } catch (error) {
      renderOutput(`Erro em ${id}`, { error: error.message });
      showFlash(error.message, "error");
    }
  });
}

bindForm("register-form", (data) => request("POST", "/register", data));
bindForm("login-form", (data) => request("POST", "/login", data));
bindForm("driver-form", (data) => request("POST", "/driver/register", data));
bindForm("vehicle-form", (data) => request("POST", "/vehicle/add", data));
bindForm("driver-rating-form", (data) => request("GET", `/driver/${data.driverId}/rating`));
bindForm("simulation-form", (data) => {
  const params = new URLSearchParams();

  if (data.lat && data.lng) {
    params.set("lat", data.lat);
    params.set("lng", data.lng);
  } else if (data.address) {
    params.set("address", data.address);
  }

  return request("GET", `/simulation/nearby-drivers?${params.toString()}`);
});
bindForm("ride-request-form", (data) => request("POST", "/ride/request", data));
bindForm("ride-lookup-form", (data) => request("GET", `/ride/${data.rideId}`));
bindForm("ride-cancel-form", (data) => request("POST", "/ride/cancel", data));
bindForm("ride-history-form", (data) => request("GET", `/user/${data.userId}/rides`));
bindForm("payment-create-form", (data) => request("POST", "/payment/create", data));
bindForm("payment-update-form", (data) => request("POST", "/payment/update", data));
bindForm("ride-accept-form", (data) => request("POST", "/ride/accept", data));
bindForm("ride-status-form", (data) => request("POST", "/ride/status", data));
bindForm("ride-rate-form", (data) => request("POST", "/ride/rate", data));

document.getElementById("clear-output").addEventListener("click", () => {
  output.textContent = "Pronto para consumir a API local.";
  flash.className = "flash hidden";
  flash.textContent = "";
});

updateSession();
