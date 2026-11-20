// Carregado antes dos testes (node --import): liga os bots e oferece um canvas falso.
(globalThis as unknown as { BOTS: boolean }).BOTS = true;
