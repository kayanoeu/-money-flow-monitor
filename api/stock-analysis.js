export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    const { stockInfo, macroScores } = body;

    const prompt = `あなたは日本株専門のマクロアナリストです。
以下の情報を元に、この銘柄と現在のマクロ環境の相性を分析してください。

## 銘柄情報
- 銘柄名: ${stockInfo.name}
- 証券コード: ${stockInfo.code}
- 現在値: ${stockInfo.price}円
- 前日比: ${stockInfo.change}円 (${stockInfo.changePct}%)
- 業種推定: ${stockInfo.sector}

## 現在のマクロ環境スコア
- レジーム判定: ${macroScores.regime}
- 総合スコア: ${macroScores.normalized}/10
- L1流動性バイアス: ${macroScores.l1}
- L2金利/クレジット: ${macroScores.l2}
- L3クロスアセット: ${macroScores.l3}
- L4セクターローテーション: ${macroScores.l4}
- L5日本フロー: ${macroScores.l5}

## 出力形式（必ずJSON形式で出力）
{
  "matchScore": 75,
  "matchLabel": "相性良好",
  "summary": "現在の環境との相性を1〜2文で",
  "positives": ["プラス要因1", "プラス要因2"],
  "negatives": ["リスク要因1", "リスク要因2"],
  "suggestion": "具体的な戦略示唆を1文で"
}

matchScoreは0〜100の整数。
matchLabelは「非常に良好/良好/中立/要注意/不向き」のいずれか。
専門用語には括弧で簡単な説明を補足すること。
JSONのみ出力し、前後に余計なテキストを含めないこと。`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) throw new Error(`Anthropic HTTP ${response.status}`);
    const data = await response.json();
    const text = data.content?.[0]?.text ?? '{}';
    const clean = text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);
    return res.status(200).json(result);

  } catch(e) {
    console.error('stock-analysis error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
