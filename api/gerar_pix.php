<?php
header('Content-Type: application/json; charset=utf-8');

function jsonResponse($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function loadEnvFile(string $path): void {
    if (!is_file($path) || !is_readable($path)) {
        return;
    }
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#') continue;
        $pos = strpos($line, '=');
        if ($pos === false) continue;
        $key = trim(substr($line, 0, $pos));
        $val = trim(substr($line, $pos + 1));
        if ($val !== '' && ($val[0] === '"' || $val[0] === "'")) {
            $val = trim($val, "\"'");
        }
        if ($key !== '') {
            putenv("$key=$val");
            $_ENV[$key] = $val;
        }
    }
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['success' => false, 'message' => 'Método não permitido'], 405);
}

$raw = file_get_contents('php://input');
$input = json_decode($raw, true);
if (!is_array($input)) {
    jsonResponse(['success' => false, 'message' => 'JSON inválido'], 400);
}

$nome = isset($input['nome']) ? trim($input['nome']) : '';
$cpf = isset($input['cpf']) ? preg_replace('/\D/', '', (string)$input['cpf']) : '';

if ($nome === '' || $cpf === '' || strlen($cpf) < 11) {
    jsonResponse(['success' => false, 'message' => 'Dados insuficientes: nome e CPF são obrigatórios'], 400);
}

function gerarTelefone11Digitos(): string {
    $ddd = str_pad((string)random_int(11, 99), 2, '0', STR_PAD_LEFT);
    $resto = '9' . str_pad((string)random_int(0, 99999999), 8, '0', STR_PAD_LEFT);
    return $ddd . $resto;
}

$buyerPhone = gerarTelefone11Digitos();

$payload = [
    'payment_method' => 'pix',
    'amount' => 13845,
    'buyer' => [
        'buyer_name' => $nome,
        'buyer_document' => $cpf,
        'buyer_phone' => $buyerPhone,
    ],
];

// Carrega .env do projeto (um nível acima deste arquivo)
loadEnvFile(dirname(__DIR__) . '/.env');

$publicKey = getenv('PLUGGOU_PUBLIC_KEY') ?: '';
$secretKey = getenv('PLUGGOU_SECRET_KEY') ?: '';

if ($publicKey === '' || $secretKey === '') {
    jsonResponse([
        'success' => false,
        'message' => 'Chaves da Pluggou não configuradas. Defina PLUGGOU_PUBLIC_KEY e PLUGGOU_SECRET_KEY no ambiente.'
    ], 500);
}

$url = 'https://api.pluggoutech.com/api/transactions';
$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'X-Public-Key: ' . $publicKey,
        'X-Secret-Key: ' . $secretKey,
    ],
    CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    CURLOPT_TIMEOUT => 20,
]);

$responseBody = curl_exec($ch);
$curlErr = curl_error($ch);
$statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($responseBody === false) {
    jsonResponse(['success' => false, 'message' => 'Erro de rede: ' . $curlErr], 502);
}

$api = json_decode($responseBody, true);
if (!is_array($api)) {
    jsonResponse(['success' => false, 'message' => 'Resposta inválida da Pluggou', 'httpStatus' => $statusCode], 502);
}

$apiSuccess = isset($api['success']) ? (bool)$api['success'] : false;
if (!$apiSuccess) {
    $message = $api['message'] ?? 'Falha ao criar pagamento';
    jsonResponse(['success' => false, 'message' => $message, 'httpStatus' => $statusCode], 400);
}

$data = $api['data'] ?? [];
$transactionId = isset($data['id']) ? (string)$data['id'] : '';
$emv = isset($data['pix']['emv']) ? (string)$data['pix']['emv'] : '';

if ($transactionId === '' || $emv === '') {
    jsonResponse(['success' => false, 'message' => 'Resposta da Pluggou incompleta'], 502);
}

$normalized = [
    'success' => true,
    'transactionId' => $transactionId,
    'qrCode' => $emv,
    'qrCodeUrl' => '',
    'expiresAt' => date('Y-m-d', time() + 86400),
    'amount' => 13845,
    'status' => 'waiting_payment',
];

jsonResponse($normalized, 200);
