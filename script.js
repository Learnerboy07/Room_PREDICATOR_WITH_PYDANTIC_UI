// ---------------------------------------------------------
// Night Shift — Room Type Predictor
// Talks to the FastAPI /predict endpoint.
// Change API_URL below if your server runs somewhere else.
// ---------------------------------------------------------

const API_URL = "http://127.0.0.1:8000";

const form = document.getElementById("predict-form");
const submitBtn = document.getElementById("submit-btn");

const stateIdle = document.getElementById("state-idle");
const stateLoading = document.getElementById("state-loading");
const stateError = document.getElementById("state-error");
const stateResult = document.getElementById("state-result");
const errorText = document.getElementById("error-text");

const resultValue = document.getElementById("result-value");
const resultConfidence = document.getElementById("result-confidence");
const barsContainer = document.getElementById("bars");

const statusDot = document.getElementById("status-dot");
const statusText = document.getElementById("status-text");

const availabilityInput = document.getElementById("availability_365");
const availabilityOut = document.getElementById("availability_365_out");

availabilityInput.addEventListener("input", () => {
  availabilityOut.textContent = availabilityInput.value;
});

// ---------------------------------------------------------
// API health check — pings the root endpoint on load
// ---------------------------------------------------------
async function checkApiHealth() {
  try {
    const res = await fetch(`${API_URL}/`, { method: "GET" });
    if (res.ok) {
      statusDot.classList.add("online");
      statusText.textContent = "API online";
    } else {
      throw new Error("bad response");
    }
  } catch (err) {
    statusDot.classList.add("offline");
    statusText.textContent = "API unreachable";
  }
}
checkApiHealth();

// ---------------------------------------------------------
// Room type labels, keyed by how many probability classes
// the model returns. Falls back to generic labels if the
// pipeline was trained with a different class set.
// ---------------------------------------------------------
function labelsForLength(n) {
  const known = {
    3: ["Entire home/apt", "Private room", "Shared room"],
    4: ["Entire home/apt", "Hotel room", "Private room", "Shared room"],
  };
  if (known[n]) return known[n];
  return Array.from({ length: n }, (_, i) => `Category ${i + 1}`);
}

function showState(state) {
  [stateIdle, stateLoading, stateError, stateResult].forEach((el) => {
    el.classList.add("output-state--hidden");
  });
  state.classList.remove("output-state--hidden");
}

function collectPayload() {
  const data = new FormData(form);
  return {
    latitude: parseFloat(data.get("latitude")),
    longitude: parseFloat(data.get("longitude")),
    price: parseFloat(data.get("price")),
    minimum_nights: parseInt(data.get("minimum_nights"), 10),
    number_of_reviews: parseInt(data.get("number_of_reviews"), 10),
    reviews_per_month: parseFloat(data.get("reviews_per_month")),
    calculated_host_listings_count: parseInt(data.get("calculated_host_listings_count"), 10),
    availability_365: parseInt(data.get("availability_365"), 10),
    neighbourhood_group: data.get("neighbourhood_group"),
    neighbourhood: data.get("neighbourhood"),
  };
}

function renderResult(payload) {
  const { Predicted_room_type, Probability } = payload;

  resultValue.textContent = Predicted_room_type;

  const labels = labelsForLength(Probability.length);
  const maxProb = Math.max(...Probability);
  resultConfidence.textContent = `${Math.round(maxProb * 100)}% confidence`;

  const rows = labels
    .map((label, i) => ({ label, value: Probability[i] }))
    .sort((a, b) => b.value - a.value);

  barsContainer.innerHTML = "";
  rows.forEach((row) => {
    const isPredicted = row.label === Predicted_room_type;
    const pct = Math.round(row.value * 100);

    const bar = document.createElement("div");
    bar.className = "bar" + (isPredicted ? " is-predicted" : "");
    bar.innerHTML = `
      <div class="bar__meta">
        <span>${row.label}</span>
        <span>${pct}%</span>
      </div>
      <div class="bar__track">
        <div class="bar__fill" style="width: 0%"></div>
      </div>
    `;
    barsContainer.appendChild(bar);
  });

  showState(stateResult);

  // Trigger the width transition on the next frame so it animates
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      barsContainer.querySelectorAll(".bar__fill").forEach((fill, i) => {
        fill.style.width = `${Math.round(rows[i].value * 100)}%`;
      });
    });
  });
}

async function handleSubmit(event) {
  event.preventDefault();

  const payload = collectPayload();

  submitBtn.disabled = true;
  submitBtn.classList.add("is-loading");
  showState(stateLoading);

  try {
    const res = await fetch(`${API_URL}/predict`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      let message = `Request failed (${res.status})`;
      try {
        const errBody = await res.json();
        if (errBody.detail) {
          message = Array.isArray(errBody.detail)
            ? errBody.detail.map((d) => d.msg || JSON.stringify(d)).join(", ")
            : String(errBody.detail);
        } else if (errBody.error) {
          message = errBody.error;
        }
      } catch (_) {
        /* response wasn't JSON, keep default message */
      }
      throw new Error(message);
    }

    const data = await res.json();
    renderResult(data);
  } catch (err) {
    errorText.textContent = err.message || "Couldn't reach the API. Is it running?";
    showState(stateError);
  } finally {
    submitBtn.disabled = false;
    submitBtn.classList.remove("is-loading");
  }
}

form.addEventListener("submit", handleSubmit);
