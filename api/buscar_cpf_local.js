module.exports = async (req, res) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  const cpf = req.query.cpf || '';

  if (!cpf || cpf.length < 11) {
    res.status(400);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.json({
      success: false,
      message: 'CPF inválido',
    });
  }

  // Retorna que não encontrou no banco local
  // (implementar lógica de banco de dados se necessário)
  res.status(200);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.json({
    success: false,
    message: 'CPF não encontrado no banco local',
    data: null,
  });
};
