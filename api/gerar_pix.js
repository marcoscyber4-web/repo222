const fs = require('fs');
const path = require('path');

function jsonResponse(res, data, code = 200) {
  res.status(code);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.json(data);
}

function loadEnvFile(filePath) {
  try {
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      return;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === '' || trimmed[0] === '#') continue;
      
      const pos = trimmed.indexOf('=');
      if (pos === -1) continue;
      
      const key = trimmed.substring(0, pos).trim();
      let val = trimmed.substring(pos + 1).trim();
      
      if (val !== '' && (val[0] === '"' || val[0] === "'")) {
        val = val.slice(1, -1);
      }
      
      if (key !== '') {
        process.env[key] = val;
      }
    }
  } catch (error) {
    // Ignore errors
  }
}

function gerarTelefone11Digitos() {
  const ddd = String(Math.floor(Math.random() * 89) + 11).padStart(2, '0');
  const resto = '9' + String(Math.floor(Math.random() * 100000000)).padStart(8, '0');
  return ddd + resto;
}

module.exports = async (req, res) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return jsonResponse(res, { success: false, message: 'Método não permitido' }, 405);
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
    return jsonResponse(res, { success: false, message: 'JSON inválido' }, 400);
  }

  if (!input || typeof input !== 'object') {
    return jsonResponse(res, { success: false, message: 'JSON inválido' }, 400);
  }

  const nome = (input.nome || '').trim();
  let cpf = (input.cpf || '').replace(/\D/g, '');

  if (nome === '' || cpf === '' || cpf.length < 11) {
    return jsonResponse(res, { 
      success: false, 
      message: 'Dados insuficientes: nome e CPF são obrigatórios' 
    }, 400);
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

  // Carrega .env do projeto (um nível acima deste arquivo)
  const envPath = path.join(__dirname, '..', '.env');
  loadEnvFile(envPath);

  const publicKey = process.env.PLUGGOU_PUBLIC_KEY || '';
  const secretKey = process.env.PLUGGOU_SECRET_KEY || '';

  if (publicKey === '' || secretKey === '') {
    return jsonResponse(res, {
      success: false,
      message: 'Chaves da Pluggou não configuradas. Defina PLUGGOU_PUBLIC_KEY e PLUGGOU_SECRET_KEY no ambiente.'
    }, 500);
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
      return jsonResponse(res, { 
        success: false, 
        message: 'Resposta inválida da Pluggou', 
        httpStatus: statusCode 
      }, 502);
    }

    if (!api || typeof api !== 'object') {
      return jsonResponse(res, { 
        success: false, 
        message: 'Resposta inválida da Pluggou', 
        httpStatus: statusCode 
      }, 502);
    }

    const apiSuccess = api.success === true;
    if (!apiSuccess) {
      const message = api.message || 'Falha ao criar pagamento';
      return jsonResponse(res, { 
        success: false, 
        message: message, 
        httpStatus: statusCode 
      }, 400);
    }

    const data = api.data || {};
    const transactionId = String(data.id || '');
    const emv = String(data.pix?.emv || '');

    if (transactionId === '' || emv === '') {
      return jsonResponse(res, { 
        success: false, 
        message: 'Resposta da Pluggou incompleta' 
      }, 502);
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

    return jsonResponse(res, normalized, 200);
  } catch (error) {
    return jsonResponse(res, { 
      success: false, 
      message: 'Erro de rede: ' + error.message 
    }, 502);
  }
};
