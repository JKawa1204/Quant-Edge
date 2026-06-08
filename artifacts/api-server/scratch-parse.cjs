const fs = require('fs');
const symbols = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'HINDUNILVR', 'ICICIBANK', 'WIPRO', 'AXISBANK', 'BHARTIARTL', 'KOTAKBANK', 'LT', 'ITC', 'BAJFINANCE', 'MARUTI', 'SUNPHARMA', 'TITAN', 'ULTRACEMCO', 'ADANIPORTS', 'POWERGRID', 'NTPC', 'ADANIENT', 'APOLLOHOSP', 'ASIANPAINT', 'BAJAJ-AUTO', 'BAJAJFINSV', 'BPCL', 'BRITANNIA', 'CIPLA', 'COALINDIA', 'DIVISLAB', 'DRREDDY', 'EICHERMOT', 'GRASIM', 'HCLTECH', 'HDFCLIFE', 'HEROMOTOCO', 'HINDALCO', 'INDUSINDBK', 'JSWSTEEL', 'M&M', 'NESTLEIND', 'ONGC', 'SBILIFE', 'SBIN', 'TATACONSUM', 'TATAMOTORS', 'TATASTEEL', 'TECHM', 'SHRIRAMFIN', 'TRENT'];
const map = {};
const lines = fs.readFileSync('NSEScripMaster.txt', 'utf8').split('\n');
for (const line of lines) {
  const cols = line.split(',');
  if (cols.length > 60) {
    const sym = cols[60].replace(/\"/g, '').trim();
    const isec = cols[1].replace(/\"/g, '').trim();
    if (symbols.includes(sym)) {
      map[sym] = isec;
    }
  }
}
console.log(JSON.stringify(map, null, 2));
