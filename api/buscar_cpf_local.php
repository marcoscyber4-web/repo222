<?php
header('Content-Type: application/json; charset=utf-8');

function jsonResponse($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$cpf = isset($_GET['cpf']) ? preg_replace('/\D/', '', (string)$_GET['cpf']) : '';

if ($cpf === '' || strlen($cpf) < 11) {
    jsonResponse([
        'success' => false,
        'message' => 'CPF inválido'
    ], 400);
}

// Retorna que não encontrou no banco local
// (implementar lógica de banco de dados se necessário)
jsonResponse([
    'success' => false,
    'message' => 'CPF não encontrado no banco local',
    'data' => null
], 200);
