const state = {
  userId: "",
  userName: "",
  driverId: "",
  vehicleId: "",
  rideId: "",
  ridePrice: "",
  paymentId: "",
  rideStatus: "",
  nextStep: "Crie ou entre em uma conta",
};

const output = document.getElementById("output");
const flash = document.getElementById("flash");
const sessionName = document.getElementById("session-name");
const sessionMeta = document.getElementById("session-meta");
const summaryPrice = document.getElementById("summary-price");
const summaryStatus = document.getElementById("summary-status");
const summarySubstatus = document.getElementById("summary-substatus");
const summaryNextStep = document.getElementById("summary-next-step");
const sessionRide = document.getElementById("session-ride");
const sessionDriver = document.getElementById("session-driver");
const sessionVehicle = document.getElementById("session-vehicle");
const sessionPayment = document.getElementById("session-payment");
const simulationHeadline = document.getElementById("simulation-headline");
const simulationBody = document.getElementById("simulation-body");
const rideHeadline = document.getElementById("ride-headline");
const rideBody = document.getElementById("ride-body");
const simulationList = document.getElementById("simulation-list");
const historyList = document.getElementById("history-list");

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

function syncInputs() {
  document.querySelectorAll("[data-fill]").forEach((input) => {
    const key = input.dataset.fill;
    if (state[key] !== "" && !input.matches(":focus")) {
      input.value = state[key];
    }
  });
}

function stageFromState() {
  if (state.rideStatus === "completed") return "review";
  if (["accepted", "arrived", "in_progress"].includes(state.rideStatus)) return "operations";
  if (state.paymentId || state.rideStatus === "requested") return "payment";
  if (state.rideId) return "ride";
  if (state.vehicleId || state.driverId) return "driver";
  return "account";
}

function updateTimeline() {
  const order = ["account", "driver", "simulation", "ride", "payment", "operations", "review"];
  const currentStage = stageFromState();
  const currentIndex = order.indexOf(currentStage);

  document.querySelectorAll("#journey-timeline li").forEach((item) => {
    const itemIndex = order.indexOf(item.dataset.stage);
    item.classList.toggle("active", item.dataset.stage === currentStage);
    item.classList.toggle("done", itemIndex < currentIndex);
  });
}

function updateSession() {
  sessionName.textContent = state.userName
    ? `${state.userName} (${state.userId})`
    : "Nenhum usuario conectado";

  const details = [];
  if (state.driverId) details.push(`driver ${state.driverId}`);
  if (state.vehicleId) details.push(`vehicle ${state.vehicleId}`);
  if (state.rideId) details.push(`ride ${state.rideId}`);
  if (state.paymentId) details.push(`payment ${state.paymentId}`);

  sessionMeta.textContent =
    details.length > 0
      ? `Contexto atual: ${details.join(" | ")}`
      : "Cadastre ou autentique um passageiro para preencher IDs automaticamente nas etapas seguintes.";

  sessionRide.textContent = state.rideId || "-";
  sessionDriver.textContent = state.driverId || "-";
  sessionVehicle.textContent = state.vehicleId || "-";
  sessionPayment.textContent = state.paymentId || "-";

  summaryPrice.textContent = formatCurrency(state.ridePrice);
  summaryStatus.textContent = state.rideStatus || "Sem corrida ativa";
  summaryNextStep.textContent = state.nextStep;

  syncInputs();
  updateTimeline();
}

function renderOutput(title, payload) {
  output.textContent = `${title}\n\n${JSON.stringify(payload, null, 2)}`;
}

function showFlash(message, kind = "success") {
  flash.textContent = message;
  flash.className = `flash ${kind}`;
}

function setNextStep(message, substatus) {
  state.nextStep = message;
  if (substatus) {
    summarySubstatus.textContent = substatus;
  }
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
    setNextStep(
      user.driverDetails?.driverId ? "Cadastre um veiculo para o motorista." : "Ative o perfil de motorista.",
      "Conta autenticada e pronta para seguir o fluxo."
    );
  }

  if (driver?.id) {
    state.driverId = driver.id;
    setNextStep("Cadastre um veiculo para concluir o setup do motorista.", "Perfil de motorista ativo.");
  }

  if (vehicle?.id) {
    state.vehicleId = vehicle.id;
    setNextStep("Rode uma simulacao ou solicite uma corrida.", "Motorista e veiculo prontos para operar.");
  }

  if (ride?.id) {
    state.rideId = ride.id;
    state.rideStatus = ride.status || state.rideStatus;
    if (ride.price) {
      state.ridePrice = ride.price;
    }
  }

  if (payload?.tripDetails?.priceBRL) {
    state.ridePrice = payload.tripDetails.priceBRL;
    state.rideStatus = payload?.ride?.status || "awaiting_payment";
    rideHeadline.textContent = `Corrida #${payload?.ride?.id || state.rideId} criada`;
    rideBody.textContent = `${payload.tripDetails.distanceKm} km estimados, ${payload.tripDetails.estimatedTimeMinutes} min e valor ${formatCurrency(payload.tripDetails.priceBRL)}.`;
    setNextStep("Gere o pagamento para liberar a corrida aos motoristas.", "Corrida aguardando confirmacao financeira.");
  }

  if (payload?.driverApproach) {
    state.rideStatus = payload?.ride?.status || "accepted";
    rideHeadline.textContent = "Corrida aceita";
    rideBody.textContent = `Motorista a ${payload.driverApproach.distanceToPickupKm} km do embarque. ETA ${payload.driverApproach.estimatedArrivalMinutes} min.`;
    setNextStep("Atualize a corrida para arrived, in_progress e completed.", "Despacho confirmado.");
  }

  if (payment?.id) {
    state.paymentId = payment.id;
    setNextStep("Confirme o pagamento para liberar o aceite.", "Pagamento criado com status pending.");
  }

  if (payload?.updateDetails?.paymentId) {
    state.paymentId = payload.updateDetails.paymentId;
    if (payload.updateDetails.newStatus === "completed") {
      state.rideStatus = "requested";
      setNextStep("Aceite a corrida com motorista e veiculo.", "Pagamento concluido e corrida liberada.");
    }
  }

  if (payload?.updateDetails?.rideId) {
    state.rideId = payload.updateDetails.rideId;
    state.rideStatus = payload.updateDetails.currentStatus;

    const labels = {
      arrived: "Motorista chegou ao embarque.",
      in_progress: "Passageiro embarcado. Corrida em andamento.",
      completed: "Corrida concluida. Agora voce pode avaliar o motorista.",
    };

    setNextStep(
      payload.updateDetails.currentStatus === "completed"
        ? "Envie a avaliacao da corrida e consulte o historico."
        : "Continue a evolucao operacional da corrida.",
      labels[payload.updateDetails.currentStatus] || "Status atualizado."
    );

    rideHeadline.textContent = `Ride #${payload.updateDetails.rideId} em ${payload.updateDetails.currentStatus}`;
    rideBody.textContent = labels[payload.updateDetails.currentStatus] || "Status atualizado.";
  }

  if (payload?.rideStatus?.rideId) {
    state.rideId = payload.rideStatus.rideId;
    state.rideStatus = payload.rideStatus.status || "canceled";
    setNextStep("Crie uma nova corrida ou consulte o historico.", "Cancelamento registrado.");
  }

  if (payload?.ratingDetails) {
    setNextStep("Use esse score para validar a qualidade do motorista.", "Avaliacao consolidada.");
  }

  if (payload?.review?.rideId) {
    setNextStep("Consulte o historico do usuario para fechar o fluxo.", "Feedback salvo com sucesso.");
  }

  if (payload?.nearbyDrivers) {
    simulationHeadline.textContent = `${payload.nearbyDrivers.length} motoristas encontrados`;
    simulationBody.textContent = `ETA medio de ${payload.etaAverageMinutes} min para a regiao consultada.`;
    setNextStep("Com oferta validada, siga para a solicitacao da corrida.", "Simulacao concluida.");
  }

  if (payload?.history || payload?.rides) {
    setNextStep("Historico carregado para auditoria do usuario.", "Fluxo consultivo concluido.");
  }

  if (payload?.ride?.status && !payload?.driverApproach && !payload?.tripDetails) {
    state.rideStatus = payload.ride.status;
    rideHeadline.textContent = `Ride #${payload.ride.id} localizada`;
    rideBody.textContent = `Status atual ${payload.ride.status} para o trajeto ${payload.ride.pickupAddress} -> ${payload.ride.dropoffAddress}.`;
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

function bindForm(id, handler, afterRender) {
  document.getElementById(id).addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;

    try {
      const payload = await handler(parseForm(form));
      updateStateFromResponse(payload);
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

bindForm("register-form", (data) => request("POST", "/register", data));
bindForm("login-form", (data) => request("POST", "/login", data));
bindForm("driver-form", (data) => request("POST", "/driver/register", data));
bindForm("vehicle-form", (data) => request("POST", "/vehicle/add", data));
bindForm("driver-rating-form", (data) => request("GET", `/driver/${data.driverId}/rating`));
bindForm(
  "simulation-form",
  (data) => {
    const params = new URLSearchParams();

    if (data.lat && data.lng) {
      params.set("lat", data.lat);
      params.set("lng", data.lng);
    } else if (data.address) {
      params.set("address", data.address);
    }

    return request("GET", `/simulation/nearby-drivers?${params.toString()}`);
  },
  renderSimulation
);
bindForm("ride-request-form", (data) => request("POST", "/ride/request", data));
bindForm("ride-lookup-form", (data) => request("GET", `/ride/${data.rideId}`));
bindForm("ride-cancel-form", (data) => request("POST", "/ride/cancel", data));
bindForm("ride-history-form", (data) => request("GET", `/user/${data.userId}/rides`), renderHistory);
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

document.querySelectorAll("[data-jump]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelector(button.dataset.jump)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  });
});

updateSession();
