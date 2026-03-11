const state = {
  passenger: {
    loggedIn: false,
    userId: "",
    userName: "",
    rideId: "",
    ridePrice: "",
    paymentId: "",
    paymentStatus: "",
    rideStatus: "",
  },
  driver: {
    loggedIn: false,
    userId: "",
    userName: "",
    isDriver: false,
    driverId: "",
    vehicleId: "",
    vehicleFormOpen: true,
    ratingFormOpen: false,
    rideId: "",
    rideStatus: "",
  },
  shared: {
    rideId: "",
    ridePrice: "",
    paymentId: "",
    paymentStatus: "",
  },
};

const output = document.getElementById("output");
const flash = document.getElementById("flash");
const boardStatus = document.getElementById("board-status");
const boardMeta = document.getElementById("board-meta");
const sharedRide = document.getElementById("shared-ride");
const sharedPayment = document.getElementById("shared-payment");
const sharedPassenger = document.getElementById("shared-passenger");
const sharedDriver = document.getElementById("shared-driver");
const passengerMeta = document.getElementById("passenger-meta");
const driverMeta = document.getElementById("driver-meta");
const passengerAuthCard = document.getElementById("passenger-auth-card");
const driverAuthCard = document.getElementById("driver-auth-card");
const passengerSessionCard = document.querySelector(".passenger-session-card");
const driverSessionCard = document.querySelector(".driver-session-card");
const passengerSessionTitle = document.getElementById("passenger-session-title");
const passengerSessionCopy = document.getElementById("passenger-session-copy");
const driverSessionTitle = document.getElementById("driver-session-title");
const driverSessionCopy = document.getElementById("driver-session-copy");
const vehicleForm = document.getElementById("vehicle-form");
const toggleVehicleFormButton = document.getElementById("toggle-vehicle-form");
const driverRatingForm = document.getElementById("driver-rating-form");
const toggleDriverRatingFormButton = document.getElementById("toggle-driver-rating-form");
const driverVehicleBadge = document.getElementById("driver-vehicle-badge");
const simulationList = document.getElementById("simulation-list");
const historyList = document.getElementById("history-list");
const passengerCards = Array.from(document.querySelectorAll(".passenger-only"));
const driverCards = Array.from(document.querySelectorAll(".driver-only"));
const API_BASE_URL = "http://localhost:3000";

function formatCurrency(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    return "R$ --";
  }

  return amount.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

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

function getContextValue(context, key) {
  return state[context]?.[key] ?? "";
}

function syncInputs() {
  document.querySelectorAll("[data-fill]").forEach((input) => {
    const context = input.dataset.context || "shared";
    const key = input.dataset.fill;
    const value = getContextValue(context, key);

    if (value !== "" && !input.matches(":focus")) {
      input.value = value;
    }
  });
}

function renderPassengerLane() {
  const passenger = state.passenger;

  passengerAuthCard.hidden = passenger.loggedIn;
  passengerSessionCard.hidden = !passenger.loggedIn;

  if (passenger.loggedIn) {
    passengerSessionTitle.textContent = `${passenger.userName} (${passenger.userId})`;
    passengerSessionCopy.textContent = passenger.rideId
      ? `Sessao ativa com a corrida ${passenger.rideId} em status ${passenger.rideStatus || "em preparacao"}.`
      : "Sessao ativa. O bloco de cadastro/login foi recolhido e o fluxo do passageiro esta liberado.";
  }

  passengerCards.forEach((card) => {
    const stages = (card.dataset.passengerStage || "").split(/\s+/).filter(Boolean);
    const show = passenger.loggedIn && stages.some((stage) => {
      if (stage === "ready") {
        return !passenger.rideId || passenger.rideStatus === "canceled";
      }

      if (stage === "payment") {
        return (
          passenger.rideStatus === "awaiting_payment" ||
          (Boolean(passenger.paymentId) && !["completed", "requested", "accepted", "arrived", "in_progress", "canceled"].includes(passenger.rideStatus))
        );
      }

      if (stage === "closure") {
        return passenger.rideStatus === "completed";
      }

      return false;
    });

    card.hidden = !show;
  });

  passengerMeta.textContent = passenger.loggedIn
    ? passenger.rideId
      ? `Passageiro autenticado como ${passenger.userName}. Corrida atual ${passenger.rideId} com status ${passenger.rideStatus || "em preparacao"}.`
      : `Passageiro autenticado como ${passenger.userName}. Simulacao e solicitacao de corrida liberadas.`
    : "Cadastre ou autentique o passageiro para liberar simulacao, corrida e pagamento.";
}

function renderDriverLane() {
  const driver = state.driver;

  driverAuthCard.hidden = driver.loggedIn;
  driverSessionCard.hidden = !driver.loggedIn;

  if (driver.loggedIn) {
    driverSessionTitle.textContent = `${driver.userName} (${driver.userId})`;
    driverSessionCopy.textContent = driver.isDriver
      ? driver.vehicleId
        ? `Perfil de motorista ativo com veiculo ${driver.vehicleId}.`
        : "Perfil de motorista ativo. Falta cadastrar um veiculo para operar."
      : "Sessao ativa. O proximo passo e ativar o perfil de motorista.";
  }

  driverCards.forEach((card) => {
    const stages = (card.dataset.driverStage || "").split(/\s+/).filter(Boolean);
    const show = driver.loggedIn && stages.some((stage) => {
      if (stage === "profile") {
        return !driver.isDriver;
      }

      if (stage === "fleet") {
        return driver.isDriver && (!driver.vehicleId || driver.vehicleFormOpen || driver.ratingFormOpen);
      }

      if (stage === "dispatch") {
        return driver.isDriver && Boolean(driver.vehicleId);
      }

      return false;
    });

    card.hidden = !show;
  });

  if (driver.isDriver) {
    driverVehicleBadge.textContent = driver.vehicleId
      ? `Veiculo ativo: ${driver.vehicleId}`
      : "Nenhum veiculo cadastrado";
  } else {
    driverVehicleBadge.textContent = "Ative o perfil primeiro";
  }

  vehicleForm.hidden = !driver.vehicleFormOpen;
  driverRatingForm.hidden = !driver.ratingFormOpen;
  toggleVehicleFormButton.hidden = !driver.loggedIn || !driver.isDriver;
  toggleDriverRatingFormButton.hidden = !driver.loggedIn || !driver.isDriver;
  toggleVehicleFormButton.textContent = "Cadastrar veiculo";
  toggleDriverRatingFormButton.textContent = driver.ratingFormOpen ? "Esconder avaliacao" : "Consultar avaliacao";

  driverMeta.textContent = driver.loggedIn
    ? !driver.isDriver
      ? `Condutor autenticado como ${driver.userName}. Falta ativar o perfil de motorista.`
      : driver.vehicleId
        ? `Motorista autenticado como ${driver.userName}. Veiculo ${driver.vehicleId} pronto para despacho.`
        : `Motorista autenticado como ${driver.userName}. Falta cadastrar um veiculo para operar corridas.`
    : "Cadastre ou autentique o condutor para liberar perfil, veiculo, despacho e reputacao.";
}

function renderBoard() {
  sharedRide.textContent = state.shared.rideId || "-";
  sharedPayment.textContent = state.shared.paymentId || "-";
  sharedPassenger.textContent = state.passenger.userId || "-";
  sharedDriver.textContent = state.driver.driverId || "-";

  if (!state.passenger.loggedIn && !state.driver.loggedIn) {
    boardStatus.textContent = "Aguardando sessoes";
    boardMeta.textContent = "Autentique os dois lados separadamente para simular a jornada completa no mesmo navegador.";
  } else if (state.passenger.loggedIn && !state.driver.loggedIn) {
    boardStatus.textContent = "Passageiro ativo";
    boardMeta.textContent = "A trilha esquerda ja esta autenticada. Falta autenticar ou cadastrar o motorista na trilha direita.";
  } else if (!state.passenger.loggedIn && state.driver.loggedIn) {
    boardStatus.textContent = "Motorista ativo";
    boardMeta.textContent = "A trilha direita ja esta autenticada. Falta autenticar ou cadastrar o passageiro na trilha esquerda.";
  } else {
    boardStatus.textContent = "Dois lados ativos";
    boardMeta.textContent = state.shared.rideId
      ? `Corrida compartilhada ${state.shared.rideId} pronta para ser operada entre as duas colunas.`
      : "As duas sessoes estao ativas. Crie uma corrida na esquerda e aceite na direita.";
  }
}

function updateUi() {
  syncInputs();
  renderPassengerLane();
  renderDriverLane();
  renderBoard();
}

function renderOutput(title, payload) {
  output.textContent = `${title}\n\n${JSON.stringify(payload, null, 2)}`;
}

function showFlash(message, kind = "success") {
  flash.textContent = message;
  flash.className = `flash ${kind}`;
}

function renderSimulation(payload) {
  const drivers = payload?.nearbyDrivers || [];

  if (drivers.length === 0) {
    simulationList.textContent = "Nenhum motorista retornado pela simulacao.";
    simulationList.className = "data-list empty";
    return;
  }

  simulationList.className = "data-list";
  simulationList.innerHTML = drivers
    .map(
      (driver) => `
        <article class="data-row">
          <strong>${driver.name}</strong>
          <span>${driver.car}</span>
          <small>${driver.distanceKm} km • ETA ${driver.etaMinutes} min • nota ${driver.rating}</small>
        </article>
      `
    )
    .join("");
}

function renderHistory(payload) {
  const entries = payload?.history || payload?.rides || [];

  if (entries.length === 0) {
    historyList.textContent = payload?.message || "Nenhum historico encontrado.";
    historyList.className = "data-list empty";
    return;
  }

  historyList.className = "data-list";
  historyList.innerHTML = entries
    .map(
      (ride) => `
        <article class="data-row">
          <strong>Ride #${ride.id}</strong>
          <span>${ride.pickup_address || ride.pickupAddress} -> ${
            ride.dropoff_address || ride.dropoffAddress
          }</span>
          <small>${ride.status} • ${formatCurrency(ride.price)} • ${ride.distance} km</small>
        </article>
      `
    )
    .join("");
}

function updatePassengerState(payload, source) {
  const passenger = state.passenger;
  const user = payload?.user;
  const ride = payload?.ride;
  const payment = payload?.payment;

  if (source === "passenger-login-form" && user?.id) {
    passenger.loggedIn = true;
    passenger.userId = user.id;
    passenger.userName = user.name || "";
  }

  if (ride?.id) {
    passenger.rideId = ride.id;
    passenger.rideStatus = ride.status || passenger.rideStatus;
    passenger.ridePrice = ride.price || passenger.ridePrice;
    state.shared.rideId = ride.id;
    state.shared.ridePrice = ride.price || state.shared.ridePrice;
  }

  if (payload?.tripDetails?.priceBRL) {
    passenger.ridePrice = payload.tripDetails.priceBRL;
    passenger.rideStatus = payload?.ride?.status || "awaiting_payment";
    state.shared.ridePrice = payload.tripDetails.priceBRL;
  }

  if (payment?.id) {
    passenger.paymentId = payment.id;
    passenger.paymentStatus = payment.status || "pending";
    state.shared.paymentId = payment.id;
    state.shared.paymentStatus = payment.status || "pending";
  }

  if (payload?.updateDetails?.paymentId) {
    passenger.paymentId = payload.updateDetails.paymentId;
    state.shared.paymentId = payload.updateDetails.paymentId;
    passenger.paymentStatus = payload.updateDetails.newStatus || passenger.paymentStatus;
    state.shared.paymentStatus = payload.updateDetails.newStatus || state.shared.paymentStatus;

    if (payload.updateDetails.newStatus === "completed") {
      passenger.rideStatus = "requested";
    }
  }

  if (payload?.rideStatus?.rideId) {
    passenger.rideId = payload.rideStatus.rideId;
    passenger.rideStatus = payload.rideStatus.status || "canceled";

    if (passenger.rideStatus === "canceled") {
      passenger.paymentStatus = "";
      passenger.paymentId = "";
      state.shared.paymentStatus = "";
      state.shared.paymentId = "";
    }
  }

  if (payload?.updateDetails?.rideId) {
    passenger.rideId = payload.updateDetails.rideId;
    passenger.rideStatus = payload.updateDetails.currentStatus;
  }

  if (payload?.review?.rideId) {
    passenger.rideStatus = "completed";
  }

  if (passenger.rideStatus === "completed") {
    passenger.paymentStatus = "completed";
  }
}

function updateDriverState(payload, source) {
  const driverState = state.driver;
  const user = payload?.user;
  const driver = payload?.driver;
  const vehicle = payload?.vehicle;

  if (source === "driver-login-form" && user?.id) {
    driverState.loggedIn = true;
    driverState.userId = user.id;
    driverState.userName = user.name || "";
    driverState.isDriver = Boolean(user.isDriver);
    driverState.driverId = user.driverDetails?.driverId || driverState.driverId;
    driverState.vehicleId = user.driverDetails?.vehicleId || driverState.vehicleId;
    driverState.vehicleFormOpen = !driverState.vehicleId;
    driverState.ratingFormOpen = false;
  }

  if (driver?.id) {
    driverState.isDriver = true;
    driverState.driverId = driver.id;
    driverState.vehicleFormOpen = !driverState.vehicleId;
  }

  if (vehicle?.id) {
    driverState.vehicleId = vehicle.id;
    driverState.vehicleFormOpen = false;
  }

  if (payload?.driverApproach) {
    driverState.rideId = payload?.ride?.id || state.shared.rideId;
    driverState.rideStatus = payload?.ride?.status || "accepted";
  }

  if (payload?.updateDetails?.rideId) {
    driverState.rideId = payload.updateDetails.rideId;
    driverState.rideStatus = payload.updateDetails.currentStatus;
  }
}

function synchronizeSharedRideState() {
  if (state.passenger.rideId) {
    state.shared.rideId = state.passenger.rideId;
  }

  if (state.passenger.ridePrice) {
    state.shared.ridePrice = state.passenger.ridePrice;
  }

  if (state.passenger.paymentId) {
    state.shared.paymentId = state.passenger.paymentId;
  }

  if (state.passenger.paymentStatus) {
    state.shared.paymentStatus = state.passenger.paymentStatus;
  }

  if (state.shared.rideId && !state.driver.rideId) {
    state.driver.rideId = state.shared.rideId;
  }

  if (state.passenger.rideStatus === "requested" && state.driver.isDriver) {
    state.driver.rideStatus = "requested";
  }

  if (state.driver.rideStatus && state.driver.rideId === state.shared.rideId) {
    state.passenger.rideStatus = state.driver.rideStatus;
  }
}

async function request(method, url, body) {
  const response = await fetch(API_BASE_URL + url, {
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

function bindForm(id, handler, afterRender, stateUpdater) {
  document.getElementById(id).addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;

    try {
      const payload = await handler(parseForm(form));

      if (stateUpdater) {
        stateUpdater(payload, id);
      }

      synchronizeSharedRideState();
      updateUi();

      if (afterRender) {
        afterRender(payload);
      }

      renderOutput(`${form.querySelector("h3, h2, button")?.textContent || id}`, payload);
      showFlash(payload.message || "Operacao concluida.");
    } catch (error) {
      renderOutput(`Erro em ${id}`, { error: error.message });
      showFlash(error.message, "error");
    }
  });
}

bindForm("passenger-register-form", (data) => request("POST", "/register", data));
bindForm("passenger-login-form", (data) => request("POST", "/login", data), null, updatePassengerState);
bindForm("simulation-form", (data) => {
  const params = new URLSearchParams();

  if (data.lat && data.lng) {
    params.set("lat", data.lat);
    params.set("lng", data.lng);
  } else if (data.address) {
    params.set("address", data.address);
  }

  return request("GET", `/simulation/nearby-drivers?${params.toString()}`);
}, renderSimulation);
bindForm("ride-request-form", (data) => request("POST", "/ride/request", data), null, updatePassengerState);
bindForm("ride-lookup-form", (data) => request("GET", `/ride/${data.rideId}`), null, updatePassengerState);
bindForm("ride-cancel-form", (data) => request("POST", "/ride/cancel", data), null, updatePassengerState);
bindForm("ride-history-form", (data) => request("GET", `/user/${data.userId}/rides`), renderHistory);
bindForm("payment-create-form", (data) => request("POST", "/payment/create", data), null, updatePassengerState);
bindForm("payment-update-form", (data) => request("POST", "/payment/update", data), null, updatePassengerState);
bindForm("ride-rate-form", (data) => request("POST", "/ride/rate", data), null, updatePassengerState);

bindForm("driver-register-user-form", (data) => request("POST", "/register", data));
bindForm("driver-login-form", (data) => request("POST", "/login", data), null, updateDriverState);
bindForm("driver-form", (data) => request("POST", "/driver/register", data), null, updateDriverState);
bindForm("vehicle-form", (data) => request("POST", "/vehicle/add", data), null, updateDriverState);
bindForm("driver-rating-form", (data) => request("GET", `/driver/${data.driverId}/rating`));
bindForm("ride-accept-form", (data) => request("POST", "/ride/accept", data), null, updateDriverState);
bindForm("ride-status-form", (data) => request("POST", "/ride/status", data), null, (payload, source) => {
  updatePassengerState(payload, source);
  updateDriverState(payload, source);
});

document.getElementById("passenger-logout-button").addEventListener("click", () => {
  state.passenger = {
    loggedIn: false,
    userId: "",
    userName: "",
    rideId: "",
    ridePrice: "",
    paymentId: "",
    paymentStatus: "",
    rideStatus: "",
  };

  state.shared = {
    rideId: state.driver.rideId || "",
    ridePrice: "",
    paymentId: "",
    paymentStatus: "",
  };

  simulationList.textContent = "Nenhuma simulacao executada.";
  simulationList.className = "data-list empty";
  historyList.textContent = "Nenhum historico consultado.";
  historyList.className = "data-list empty";

  updateUi();
});

document.getElementById("driver-logout-button").addEventListener("click", () => {
  state.driver = {
    loggedIn: false,
    userId: "",
    userName: "",
    isDriver: false,
    driverId: "",
    vehicleId: "",
    vehicleFormOpen: true,
    ratingFormOpen: false,
    rideId: "",
    rideStatus: "",
  };

  updateUi();
});

toggleVehicleFormButton.addEventListener("click", () => {
  state.driver.vehicleFormOpen = !state.driver.vehicleFormOpen;
  updateUi();
});

toggleDriverRatingFormButton.addEventListener("click", () => {
  state.driver.ratingFormOpen = !state.driver.ratingFormOpen;
  updateUi();
});

document.getElementById("clear-output").addEventListener("click", () => {
  output.textContent = "Pronto para consumir a API local.";
  flash.className = "flash hidden";
  flash.textContent = "";
});

updateUi();
