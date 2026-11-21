// Frases do Caça ao Erro (uma lista por idioma; o erro de digitação é criado na hora).
import type { Lang } from "../../core/types.ts";

export const SHORT: Record<Lang, string[]> = {
  en: [
    "The printer ate my report",
    "Coffee fixes every meeting",
    "Please reply before lunch",
    "My chair squeaks again",
    "The boss loves spreadsheets",
    "Nobody reads the manual",
    "This meeting could be an email",
    "Save the file twice",
    "Lunch is in the fridge",
    "Turn it off and on again",
  ],
  pt: [
    "A impressora comeu meu relatório",
    "Café resolve qualquer reunião",
    "Responda antes do almoço",
    "Minha cadeira rangeu de novo",
    "O chefe adora planilhas",
    "Ninguém lê o manual",
    "Essa reunião podia ser email",
    "Salve o arquivo duas vezes",
    "O almoço está na geladeira",
    "Desliga e liga de novo",
  ],
};

export const LONG: Record<Lang, string[]> = {
  en: [
    "The quarterly report is late because the printer jammed again",
    "Please remember to water the plant on the second floor",
    "Someone microwaved fish in the kitchen and everybody noticed",
    "The new intern accidentally replied to the whole company",
    "Our weekly planning meeting has moved to Friday afternoon",
    "Nobody knows who owns the stapler on the front desk",
    "The elevator music played the same song all week long",
    "Remember to change your password before the deadline tomorrow",
  ],
  pt: [
    "O relatório trimestral atrasou porque a impressora travou de novo",
    "Lembre de regar a planta que fica no segundo andar",
    "Alguém esquentou peixe na copa e todo mundo percebeu",
    "O estagiário novo respondeu para a empresa inteira",
    "A reunião semanal de planejamento mudou para sexta à tarde",
    "Ninguém sabe de quem é o grampeador da recepção",
    "A música do elevador tocou a mesma canção a semana toda",
    "Lembre de trocar sua senha antes do prazo de amanhã",
  ],
};
