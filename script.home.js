// ------------------------
// script.home.js (ALPHA ONLY)
// ------------------------

const ALPHA_KEY = "YOUR_ALPHA_KEY";
let chart = null;


// -----------------------------------------------------
// Fix canvas height to prevent infinite growth
// -----------------------------------------------------
function prepareChartCanvas() {
  const canvas = document.getElementById("stockChart");
  if (!canvas) return;

  canvas.height = 350;
  canvas.style.height = "350px";
  canvas.style.maxHeight = "350px";
}


// ------------------------
// 1. LOAD NEWS (Alpha Vantage)
// ------------------------
async function loadNews() {
  try {
    const res = await fetch(
      `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&topics=finance&apikey=${ALPHA_KEY}`
    );
    const data = await res.json();
    const articles = data?.feed;

    if (!Array.isArray(articles) || articles.length === 0) return;

    const featured = articles[0];

    document.getElementById("featured").innerHTML = `
      <img src="${featured.banner_image || "https://via.placeholder.com/800x400"}">
      <h2>${escapeHtml(featured.title)}</h2>
      <p>${escapeHtml(featured.summary)}</p>
      <a href="#" onclick="openArticle('${encodeURIComponent(featured.url)}');return false;">
        Read full article
      </a>
    `;

    const grid = document.getElementById("newsGrid");
    grid.innerHTML = "";

    articles.slice(1, 7).forEach(a => {
      grid.innerHTML += `
        <div class="news-card" onclick="openArticle('${encodeURIComponent(a.url)}')">
          <h4>${escapeHtml(a.title)}</h4>
          <p>${escapeHtml(a.summary.split(" ").slice(0, 20).join(" "))}...</p>
        </div>
      `;
    });

  } catch (err) {
    console.error("News error:", err);
  }
}


// ------------------------
// 2. MARKET MOVERS (Alpha Vantage)
// ------------------------
async function loadMovers() {
  try {
    const res = await fetch(
      `https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS&apikey=${ALPHA_KEY}`
    );
    const data = await res.json();

    fillList("gainers", data.top_gainers || []);
    fillList("losers", data.top_losers || []);
    fillList("active", data.most_actively_traded || []);

  } catch (err) {
    console.error("Movers error:", err);
  }
}

function fillList(id, arr) {
  const el = document.getElementById(id);
  if (!el) return;

  el.innerHTML = "";

  arr.slice(0, 5).forEach(item => {
    const symbol = item.ticker || item.symbol || "—";

    // MOST ACTIVE → show volume
    if (id === "active") {
      const volume = Number(item.volume || 0).toLocaleString();
      el.innerHTML += `
        <li>
          <strong>${symbol}</strong>
          <span class="neutral-text">${volume}</span>
        </li>
      `;
      return;
    }

    // GAINERS / LOSERS → show percentage
    const raw = item.change_percentage || "0%";
    const percent = parseFloat(raw);
    const cls = percent >= 0 ? "green-text" : "red";
    const arrow = percent >= 0 ? "▲" : "▼";

    el.innerHTML += `
      <li class="${cls}">
        <strong>${symbol}</strong>
        <span>${arrow} ${raw}</span>
      </li>
    `;
  });
}
// ------------------------
// 3. SEARCH STOCK (REPLACES FEATURED ONLY)
// ------------------------
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("searchBtn").addEventListener("click", getStock);
  document.getElementById("symbol").addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      getStock();
    }
  });
});

async function getStock() {
  const symbol = document.getElementById("symbol").value.trim().toUpperCase();
  if (!symbol) return;

  const featured = document.getElementById("featured");

  // Replace ONLY the headline article
  featured.innerHTML = `
    <h2>Loading ${symbol}...</h2>
    <canvas id="stockChart"></canvas>
    <div id="info"></div>
  `;

  const info = document.getElementById("info");

  try {
    const res = await fetch(
      `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${ALPHA_KEY}`
    );
    const data = await res.json();
    const daily = data["Time Series (Daily)"];

    if (!daily) {
      featured.innerHTML = "<p>No stock data found.</p>";
      return;
    }

    const dates = Object.keys(daily).slice(0, 30).reverse();
    const prices = dates.map(d => Number(daily[d]["4. close"]));

    info.innerHTML = `
      <b>${symbol}</b><br>
      Latest: $${prices.at(-1)}<br>
      Previous: $${prices.at(-2)}
    `;

    if (chart) chart.destroy();
    prepareChartCanvas();

    chart = new Chart(document.getElementById("stockChart"), {
      type: "line",
      data: {
        labels: dates,
        datasets: [{
          label: `${symbol} (30 days)`,
          data: prices,
          borderColor: "#24b36b",
          borderWidth: 2,
          tension: 0.3,
          fill: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false
      }
    });

  } catch (err) {
    console.error("Search error:", err);
    featured.innerHTML = "<p>Error loading stock data.</p>";
  }
}


// ------------------------
// UTILS
// ------------------------
function openArticle(encoded) {
  window.location.href = "article.html?url=" + encoded;
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}


// ------------------------
// INIT
// ------------------------
loadNews();
loadMovers();
