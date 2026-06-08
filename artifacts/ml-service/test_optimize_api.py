import requests

symbols = ["RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "ICICIBANK.NS", "INFY.NS", "ITC.NS", "SBIN.NS", "BHARTIARTL.NS", "BAJFINANCE.NS", "LICI.NS"]

res = requests.post("http://localhost:5000/ml/optimize", json={
    "symbols": symbols,
    "method": "markowitz",
    "riskTolerance": "medium"
})

print(res.status_code)
print(res.text)
