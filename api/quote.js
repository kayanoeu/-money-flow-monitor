const YAHOO_MAP = {
  // ドル・指数
  'DXY':     'DX-Y.NYB',
  'SOX':     '^SOX',
  'JP225':   '^N225',
  // コモディティ
  'XAU/USD': 'GC=F',
  'XCU/USD': 'HG=F',
  'WTI/USD': 'CL=F',
  // 暗号資産
  'BTC/USD': 'BTC-USD',
  // ボラ指数
  '^VIX':    '^VIX',
  '^MOVE':   '^MOVE',
  // 債券ETF
  'HYG':'HYG','JNK':'JNK','TLT':'TLT','SHY':'SHY','LQD':'LQD',
  // セクターETF（12種）
  'XLK':'XLK','XLF':'XLF','XLE':'XLE','XLI':'XLI','XLB':'XLB',
  'XLV':'XLV','XLY':'XLY','XLP':'XLP','XLU':'XLU','XLC':'XLC','XLRE':'XLRE',
  // ファクターETF
  'IWF':'IWF','IWM':'IWM','QUAL':'QUAL','USMV':'USMV','MTUM':'MTUM',
  'EWJ':'EWJ','DXJ':'DXJ',
  // FX
  'USD/JPY':'USDJPY=X','AUD/JPY':'AUDJPY=X',
  'EUR/JPY':'EURJPY=X','CHF/JPY':'CHFJPY=X',
};

async function fromYahoo(symbol) {
  const yahooSymbol = YAHOO_MAP[symbol] ?? symbol;
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=10d&includePrePost=false`;
  const r = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Origin': 'https://finance.yahoo.com',
      'Referer': 'https://finance.yahoo.com/',
    }
  });
  if (!r.ok) throw new Error(`Yahoo HTTP ${r.status}`);
  const text = await r.text();
  if (!text || text.length < 10) throw new Error(`empty response for ${yahooSymbol}`);
  const json = JSON.parse(text);
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error(`no result for ${yahooSymbol}`);
  const closes = result.indicators.quote[0].close.filter(v => v != null);
  if (closes.length < 2) throw new Error(`not enough closes for ${yahooSymbol}`);
  const last = closes[closes.length - 1];
  const prev = closes.find(v => v !== last) ?? closes[closes.length - 2];
  return { last, prev, change: last - prev, changePct: ((last - prev) / prev) * 100 };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: 'symbol required' });

  try {
    const apiKey = process.env.TWELVE_DATA_KEY;
    if (!apiKey) throw new Error('no API key');
    const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`TD HTTP ${r.status}`);
    const d = await r.json();
    if (d.status === 'error' || !d.close) throw new Error(`TD: ${d.message || 'no close'}`);
    const last = parseFloat(d.close);
    const prev = parseFloat(d.previous_close);
    return res.status(200).json({ last, prev, change: last - prev, changePct: ((last - prev) / prev) * 100 });
  } catch (e) {
    console.log(`TD failed [${symbol}]: ${e.message}`);
  }

  try {
    const data = await fromYahoo(symbol);
    return res.status(200).json(data);
  } catch (e) {
    console.error(`Yahoo failed [${symbol}]: ${e.message}`);
    return res.status(502).json({ error: `both failed: ${e.message}` });
  }
}
