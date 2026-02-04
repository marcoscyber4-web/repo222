// API convertida de PHP para Node.js (compatível com Vercel)
module.exports = async (req, res) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  const cpf = (req.query.cpf || '').replace(/\D/g, '');

  if (cpf === '' || cpf.length < 11) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(400).json({
      success: false,
      message: 'CPF inválido'
    });
  }

  // Retorna que não encontrou no banco local
  // (implementar lógica de banco de dados se necessário)
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(200).json({
    success: false,
    message: 'CPF não encontrado no banco local',
    data: null
  });
};
