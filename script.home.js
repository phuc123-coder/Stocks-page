// ------------------------
// API Keys
// ------------------------
const MARKET_AUX_KEY = "YOUR_MARKETAUX_API_KEY";
const YAHOO_KEY = "YOUR_RAPIDAPI_KEY";
const ALPHA_KEY = "YOUR_ALPHA_KEY";


// ------------------------
// 1. Load Finance News (MarketAux)
// ------------------------
async function loadNews() {
  const url =
    `https://api.marketaux.com/v1/news/all?filter_entities=true&language=en&api_token=${MARKET_AUX_KEY}`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    const news = data.data;

    if (!news || news.length === 0) throw new Error("No news returned");

    // Random featured article
    const featured = news[Math.floor(Math.random() * news.length)];

    document.getElementById("featured").innerHTML = `
      <img src="${featured.image_url || 'https://via.placeholder.com/600x350'}">
      <h2>${featured.title}</h2>
      <p>${featured.description}</p>
    `;

    const grid = document.getElementById("newsGrid");
    grid.innerHTML = "";

    // 6 smaller articles
    news.slice(0, 6).forEach(article => {
      const summary = article.description
        .split(" ")
        .slice(0, 20)
        .join(" ") + "...";

      grid.innerHTML += `
        <div class="news-card">
          <h4>${article.title}</h4>
          <p>${summary}</p>
        </div>
      `;
    });

  } catch (err) {
    console.log("MarketAux failed, falling back to AlphaVantage...");
    loadNewsAlphaVantage();
  }
}


// ------------------------
// 1B. Fallback News from AlphaVantage
// ------------------------
async function loadNewsAlphaVantage() {
  const url =
    `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&topics=finance&apikey=${ALPHA_KEY}`;

  const res = await fetch(url);
  const data = await res.json();

  const articles = data.feed;

  if (!articles) return;

  // Featured
  const a = articles[0];

  document.getElementById("featured").innerHTML = `
    <img src="${a.banner_image || 'https://via.placeholder.com/600x350'}">
    <h2>${a.title}</h2>
    <p>${a.summary}</p>
  `;

  // Grid
  const grid = document.getElementById("newsGrid");
  grid.innerHTML = "";

  articles.slice(1, 7).forEach(n => {
    grid.innerHTML += `
      <div class="news-card">
        <h4>${n.title}</h4>
        <p>${n.summary.split(" ").slice(0, 20).join(" ")}...</p>
      </div>
    `;
  });
}


// ------------------------
// 2. Load Market Movers (Yahoo Finance → BEST QUALITY)
// ------------------------
async function loadMovers() {
  const url =
    "https://apidojo-yahoo-finance-v1.p.rapidapi.com/market/v2/get-summary?region=US";

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "X-RapidAPI-Key": YAHOO_KEY,
        "X-RapidAPI-Host": "apidojo-yahoo-finance-v1.p.rapidapi.com",
      },
    });

    const data = await res.json();

    const movers = data.marketSummaryAndSparkResponse.result;

    const gainers = movers.slice(0, 5);
    const losers = movers.slice(5, 10);
    const active = movers.slice(10, 15);

    fillList("gainers", gainers);
    fillList("losers", losers);
    fillList("active", active);

  } catch (err) {
    console.log("Yahoo failed, fallback to AlphaVantage...");
    loadMoversAlphaVantage();
  }
}


// ------------------------
// 2B. Fallback Market Movers (AlphaVantage)
// ------------------------
async function loadMoversAlphaVantage() {
  const url =
    `https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS&apikey=${ALPHA_KEY}`;

  const res = await fetch(url);
  const data = await res.json();

  fillList("gainers", data.top_gainers);
  fillList("losers", data.top_losers);
  fillList("active", data.most_actively_traded);
}


// ------------------------
// Helper for output
// ------------------------
function fillList(elementId, arr) {
  const el = document.getElementById(elementId);
  el.innerHTML = "";
  arr.slice(0, 5).forEach(s => {
    const symbol = s.symbol || s.ticker || s.shortName || "???";
    const change =
      s.regularMarketChangePercent?.fmt ||
      s.change_percentage ||
      "";

    el.innerHTML += `<li>${symbol} ${change}</li>`;
  });
}


// ------------------------
// Init
// ------------------------
loadNews();
loadMovers();
