// API convertida de PHP para Node.js (compatível com Vercel)
module.exports = async (req, res) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método não permitido' });
  }

  let input;
  try {
    let body = req.body;
    if (typeof body === 'string') {
      body = body || '{}';
      input = JSON.parse(body);
    } else {
      input = body || {};
    }
  } catch (error) {
    return res.status(400).json({ success: false, message: 'JSON inválido' });
  }

  if (!input || typeof input !== 'object') {
    return res.status(400).json({ success: false, message: 'JSON inválido' });
  }

  const nome = (input.nome || '').trim();
  let cpf = (input.cpf || '').replace(/\D/g, '');

  if (nome === '' || cpf === '' || cpf.length < 11) {
    return res.status(400).json({ 
      success: false, 
      message: 'Dados insuficientes: nome e CPF são obrigatórios' 
    });
  }

  function gerarTelefone11Digitos() {
    const ddd = String(Math.floor(Math.random() * 89) + 11).padStart(2, '0');
    const resto = '9' + String(Math.floor(Math.random() * 100000000)).padStart(8, '0');
    return ddd + resto;
  }

  const buyerPhone = gerarTelefone11Digitos();

  const payload = {
    payment_method: 'pix',
    amount: 13845,
    buyer: {
      buyer_name: nome,
      buyer_document: cpf,
      buyer_phone: buyerPhone,
    },
  };

  // Carrega variáveis de ambiente
  const publicKey = process.env.PLUGGOU_PUBLIC_KEY || '';
  const secretKey = process.env.PLUGGOU_SECRET_KEY || '';

  if (publicKey === '' || secretKey === '') {
    return res.status(500).json({
      success: false,
      message: 'Chaves da Pluggou não configuradas. Defina PLUGGOU_PUBLIC_KEY e PLUGGOU_SECRET_KEY no ambiente.'
    });
  }

  const url = 'https://api.pluggoutech.com/api/transactions';
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Public-Key': publicKey,
        'X-Secret-Key': secretKey,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    const statusCode = response.status;
    const responseBody = await response.text();

    let api;
    try {
      api = JSON.parse(responseBody);
    } catch (error) {
      return res.status(502).json({ 
        success: false, 
        message: 'Resposta inválida da Pluggou', 
        httpStatus: statusCode 
      });
    }

    if (!api || typeof api !== 'object') {
      return res.status(502).json({ 
        success: false, 
        message: 'Resposta inválida da Pluggou', 
        httpStatus: statusCode 
      });
    }

    const apiSuccess = api.success === true;
    if (!apiSuccess) {
      const message = api.message || 'Falha ao criar pagamento';
      return res.status(400).json({ 
        success: false, 
        message: message, 
        httpStatus: statusCode 
      });
    }

    const data = api.data || {};
    const transactionId = String(data.id || '');
    const emv = String(data.pix?.emv || '');

    if (transactionId === '' || emv === '') {
      return res.status(502).json({ 
        success: false, 
        message: 'Resposta da Pluggou incompleta' 
      });
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const expiresAt = tomorrow.toISOString().split('T')[0];

    const normalized = {
      success: true,
      transactionId: transactionId,
      qrCode: emv,
      qrCodeUrl: '',
      expiresAt: expiresAt,
      amount: 13845,
      status: 'waiting_payment',
    };

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json(normalized);
  } catch (error) {
    return res.status(502).json({ 
      success: false, 
      message: 'Erro de rede: ' + error.message 
    });
  }
};
