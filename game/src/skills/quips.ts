// Frases do narrador maluco no Game Over, escolhidas pelos resultados REAIS da partida (perfil de habilidades).
//
// Regras do humor: brinca com o que aconteceu NAQUELA partida, nunca com a pessoa (inteligência, capacidade, corpo,
// idade, origem…). Sem insultos, sem diagnósticos, para todas as idades. Quem leva a piada é o jogo, os objetos do
// escritório, o caos — não o jogador.
//
// Seleção (ver pickQuip): cada frase tem UMA condição clara; as condições têm prioridade. Partida curta demais ou com
// poucas habilidades avaliadas só recebe frases de "partida curta" (não se tira conclusão de pouca amostra). As
// frases sobre habilidades exigem STRONG_CHALLENGES fases na habilidade. O histórico para não repetir fica só em
// memória (some ao fechar a página) e nada disto vai para a telemetria.
import type { Lang, Text } from "../core/types.ts";
import { STRONG_CHALLENGES, type Profile, type SkillKey } from "./profile.ts";

export type Cond =
  /** A melhor habilidade é `hi`, a pior é `lo`, com grande distância entre elas. */
  | { k: "pair"; hi: SkillKey; lo: SkillKey }
  /** A melhor habilidade é `s`, com taxa alta. */
  | { k: "high"; s: SkillKey }
  /** A pior habilidade é `s`, com taxa baixa. */
  | { k: "low"; s: SkillKey }
  | { k: "balanced" }
  | { k: "excellent" }
  | { k: "short" }
  | { k: "long" }
  | { k: "zero-wins" }
  | { k: "extremes" }
  | { k: "spiky" }
  | { k: "half" }
  | { k: "record" }
  | { k: "easy-trip" }
  | { k: "wtf-all-won" }
  | { k: "wtf-all-lost" }
  | { k: "wtf-ko" }
  | { k: "wtf-insane-ko" }
  | { k: "wtf-tourist" }
  /** Mais derrotas que vitórias: o próprio jogo assume a culpa. Não conclui nada sobre habilidades. */
  | { k: "blame" }
  | { k: "any" };

export interface Quip extends Text {
  id: string;
  when: Cond;
}

/** Fatos da partida que as condições leem (além do perfil). */
export interface MatchFacts {
  profile: Profile;
  /** WTF do microgame que tirou a última vida ("" se não foi WTF). */
  lostToWtf: "" | "normal" | "insane";
  /** Dificuldade do microgame que tirou a última vida (0 se desconhecida). */
  lostToDifficulty: number;
  newBest: boolean;
}

// Limiares (taxas de 0 a 1). Partida "curta": menos de SHORT_PLAYED fases ou menos de 3 habilidades com amostra forte.
export const SHORT_PLAYED = 6;
export const LONG_PLAYED = 40;
const HIGH = 0.75;
const LOW = 0.35;
const PAIR_GAP = 0.35;

const PRIORITY: Record<Cond["k"], number> = {
  short: 100,
  pair: 96,
  "zero-wins": 94,
  excellent: 92,
  "wtf-insane-ko": 90,
  "wtf-ko": 88,
  long: 86,
  extremes: 84,
  high: 80,
  "easy-trip": 78,
  low: 74,
  "wtf-all-won": 72,
  "wtf-all-lost": 70,
  spiky: 66,
  balanced: 62,
  half: 56,
  "wtf-tourist": 52,
  record: 46,
  blame: 70,
  any: 10,
};

/** Prioridade de uma frase nesta partida. "A culpa é do jogo" disputa de igual para igual com as de partida curta. */
function priorityOf(c: Cond, f: MatchFacts): number {
  return c.k === "blame" && isShort(f.profile) ? PRIORITY.short : PRIORITY[c.k];
}

const q = (id: string, when: Cond, pt: string, en: string): Quip => ({ id, when, pt, en });
const pair = (hi: SkillKey, lo: SkillKey): Cond => ({ k: "pair", hi, lo });
const high = (s: SkillKey): Cond => ({ k: "high", s });
const low = (s: SkillKey): Cond => ({ k: "low", s });

export const QUIPS: readonly Quip[] = [
  // ---------- contrastes: as duas características mais marcantes do radar ----------
  q("re-pr-1", pair("re", "pr"), "REAGIU ANTES DE TUDO. ACERTOU DEPOIS DE NADA.", "REACTED BEFORE EVERYTHING. HIT AFTER NOTHING."),
  q("re-pr-2", pair("re", "pr"), "MÃOS MAIS RÁPIDAS QUE A LUZ. MIRA MAIS SOLTA QUE CONFETE.", "HANDS FASTER THAN LIGHT. AIM LOOSER THAN CONFETTI."),
  q("re-pr-3", pair("re", "pr"), "CHEGOU PRIMEIRO. NO LUGAR ERRADO. COM MUITO ESTILO.", "FIRST TO ARRIVE. WRONG SPOT. GREAT STYLE."),
  q("ti-me-1", pair("ti", "me"), "SABIA EXATAMENTE QUANDO. SÓ NÃO LEMBRAVA O QUÊ.", "KNEW EXACTLY WHEN. JUST FORGOT WHAT."),
  q("ti-me-2", pair("ti", "me"), "RITMO DE RELÓGIO SUÍÇO. LEMBRANÇAS DE BOLHA DE SABÃO.", "SWISS-WATCH RHYTHM. SOAP-BUBBLE MEMORIES."),
  q("ti-me-3", pair("ti", "me"), "TUDO NO TEMPO CERTO. NA ORDEM QUE O DESTINO QUIS.", "EVERYTHING RIGHT ON TIME. IN WHATEVER ORDER FATE CHOSE."),
  q("lo-re-1", pair("lo", "re"), "RESOLVEU O ENIGMA. O ENIGMA JÁ TINHA IDO PRA CASA.", "SOLVED THE RIDDLE. THE RIDDLE HAD ALREADY GONE HOME."),
  q("lo-re-2", pair("lo", "re"), "PENSA COMO XADREZ. REAGE COMO DOMINGO DE MANHÃ.", "THINKS LIKE CHESS. REACTS LIKE A SUNDAY MORNING."),
  q("lo-re-3", pair("lo", "re"), "A RESPOSTA CERTA, ENTREGUE EM ATÉ CINCO DIAS ÚTEIS.", "THE RIGHT ANSWER, DELIVERED IN 3 TO 5 BUSINESS DAYS."),
  q("pe-co-1", pair("pe", "co"), "VIU TUDO. O CORPO PREFERIU NÃO COMENTAR.", "SAW EVERYTHING. THE BODY DECLINED TO COMMENT."),
  q("pe-co-2", pair("pe", "co"), "OLHOS DE ÁGUIA. VOLANTE DE CARRINHO DE MERCADO.", "EAGLE EYES. SHOPPING-CART STEERING."),
  q("pe-co-3", pair("pe", "co"), "ENXERGOU O CAMINHO. E DESVIOU DELE COM PRECISÃO.", "SPOTTED THE PATH. THEN AVOIDED IT PERFECTLY."),
  q("re-lo-1", pair("re", "lo"), "REFLEXOS DE NINJA. ESTRATÉGIA DE BATATA.", "NINJA REFLEXES. POTATO STRATEGY."),
  q("re-lo-2", pair("re", "lo"), "REAGE PRIMEIRO. PENSAR FICOU AGENDADO PRA PRÓXIMA.", "REACTS FIRST. THINKING IS SCHEDULED FOR NEXT TIME."),
  q("au-ti-1", pair("au", "ti"), "PACIÊNCIA DE MONGE. PONTUALIDADE DE ÔNIBUS ATRASADO.", "MONK-LEVEL PATIENCE. LATE-BUS PUNCTUALITY."),
  q("au-ti-2", pair("au", "ti"), "NÃO CAIU EM NENHUMA PEGADINHA. NEM NA HORA DE APERTAR.", "FELL FOR NO TRICKS. NOT EVEN THE ONE CALLED 'NOW'."),
  q("me-co-1", pair("me", "co"), "LEMBROU DE TUDO. ATÉ DE TROPEÇAR.", "REMEMBERED EVERYTHING. INCLUDING HOW TO TRIP."),
  q("me-co-2", pair("me", "co"), "MEMÓRIA DE ARQUIVO DE AÇO. CONTROLES DE GELATINA.", "FILING-CABINET MEMORY. JELLY CONTROLS."),

  // ---------- habilidade em destaque (a melhor da partida) ----------
  q("re-hi-1", high("re"), "VOCÊ NÃO REAGIU. VOCÊ VIU O FUTURO.", "YOU DIDN'T REACT. YOU SAW THE FUTURE."),
  q("re-hi-2", high("re"), "MAIS RÁPIDO QUE MENSAGEM DO CHEFE NO SÁBADO.", "FASTER THAN THE BOSS'S SATURDAY MESSAGE."),
  q("re-hi-3", high("re"), "AS MOSCAS DO ESCRITÓRIO FORAM AVISADAS.", "THE OFFICE FLIES HAVE BEEN WARNED."),
  q("re-hi-4", high("re"), "SEU TEMPO DE REAÇÃO PEDIU AUTÓGRAFO.", "YOUR REACTION TIME ASKED FOR AN AUTOGRAPH."),
  q("ti-hi-1", high("ti"), "O METRÔNOMO AGORA SEGUE VOCÊ.", "THE METRONOME FOLLOWS YOU NOW."),
  q("ti-hi-2", high("ti"), "PONTUAL COMO UM RELÓGIO QUE TOMOU TRÊS CAFÉS.", "PUNCTUAL LIKE A CLOCK ON ITS THIRD COFFEE."),
  q("ti-hi-3", high("ti"), "VOCÊ NÃO ESPERA O MOMENTO. O MOMENTO ESPERA VOCÊ.", "YOU DON'T WAIT FOR THE MOMENT. IT WAITS FOR YOU."),
  q("ti-hi-4", high("ti"), "TORRADA PEGA NO AR. TODAS. SEMPRE.", "EVERY TOAST, CAUGHT MIDAIR. EVERY TIME."),
  q("pr-hi-1", high("pr"), "ACERTA UM GRÃO DE CAFÉ A TRÊS SALAS DE DISTÂNCIA.", "HITS A COFFEE BEAN THREE ROOMS AWAY."),
  q("pr-hi-2", high("pr"), "MIRA TÃO BOA QUE O ALVO PEDIU DESCULPAS.", "AIM SO GOOD THE TARGET APOLOGIZED."),
  q("pr-hi-3", high("pr"), "AS RÉGUAS DO ESCRITÓRIO TE CHAMAM DE CHEFE.", "THE OFFICE RULERS CALL YOU BOSS."),
  q("pr-hi-4", high("pr"), "ENFIOU A LINHA DE PRIMEIRA. A AGULHA FICOU EMOCIONADA.", "THREADED IT FIRST TRY. THE NEEDLE GOT EMOTIONAL."),
  q("co-hi-1", high("co"), "DESVIOU DE TUDO. ATÉ DE REUNIÃO.", "DODGED EVERYTHING. EVEN MEETINGS."),
  q("co-hi-2", high("co"), "EQUILIBROU A VASSOURA, A BANDEJA E A SEGUNDA-FEIRA.", "BALANCED THE BROOM, THE TRAY AND MONDAY."),
  q("co-hi-3", high("co"), "SE MEXE COMO GATO NO TECLADO. SÓ QUE ÚTIL.", "MOVES LIKE A CAT ON A KEYBOARD. BUT USEFUL."),
  q("co-hi-4", high("co"), "O CORREDOR DE LASERS EXIGE UMA REVANCHE.", "THE LASER HALLWAY DEMANDS A REMATCH."),
  q("au-hi-1", high("au"), "NÃO APERTOU O BOTÃO. O BOTÃO FICOU OFENDIDO.", "DIDN'T PRESS THE BUTTON. THE BUTTON IS OFFENDED."),
  q("au-hi-2", high("au"), "O 'RESPONDER A TODOS' TREMEU NA SUA PRESENÇA.", "'REPLY ALL' TREMBLED IN YOUR PRESENCE."),
  q("au-hi-3", high("au"), "CALMA DE LESMA ZEN. NO MELHOR SENTIDO.", "ZEN-SNAIL CALM. IN THE BEST WAY."),
  q("au-hi-4", high("au"), "PEGADINHA? VOCÊ ACENOU E PASSOU RETO.", "A TRAP? YOU WAVED AND WALKED RIGHT PAST."),
  q("pe-hi-1", high("pe"), "ACHOU O ESTAGIÁRIO NA MULTIDÃO E O WI-FI NA PAREDE.", "FOUND THE INTERN IN THE CROWD AND THE WI-FI IN THE WALL."),
  q("pe-hi-2", high("pe"), "VÊ ATÉ O PIXEL QUE O DESIGNER ESQUECEU.", "SPOTS EVEN THE PIXEL THE DESIGNER FORGOT."),
  q("pe-hi-3", high("pe"), "OLHOS DE CORUJA COM LUPA E LANTERNA.", "OWL EYES WITH A MAGNIFIER AND A FLASHLIGHT."),
  q("pe-hi-4", high("pe"), "NENHUMA MEIA SEM PAR ESCAPOU DE VOCÊ.", "NO LONELY SOCK ESCAPED YOU."),
  q("me-hi-1", high("me"), "LEMBROU ATÉ DO QUE O JOGO TINHA ESQUECIDO.", "REMEMBERED THINGS THE GAME HAD FORGOTTEN."),
  q("me-hi-2", high("me"), "GUARDOU A SENHA DO COFRE E O CAFÉ DE TODO MUNDO.", "KEPT THE SAFE CODE AND EVERYONE'S COFFEE ORDER."),
  q("me-hi-3", high("me"), "UM ELEFANTE LIGOU PEDINDO DICAS.", "AN ELEPHANT CALLED ASKING FOR TIPS."),
  q("me-hi-4", high("me"), "PISCOU E MESMO ASSIM NÃO PERDEU NADA.", "BLINKED AND STILL MISSED NOTHING."),
  q("lo-hi-1", high("lo"), "RESOLVEU O SUDOKU ANTES DE ELE SE APRESENTAR.", "SOLVED THE SUDOKU BEFORE IT INTRODUCED ITSELF."),
  q("lo-hi-2", high("lo"), "AS ENGRENAGENS GIRAM PRO LADO QUE VOCÊ MANDA.", "THE GEARS TURN WHICHEVER WAY YOU SAY."),
  q("lo-hi-3", high("lo"), "A CALCULADORA DO ESCRITÓRIO PEDIU FÉRIAS.", "THE OFFICE CALCULATOR ASKED FOR A VACATION."),
  q("lo-hi-4", high("lo"), "PENSOU TRÊS JOGADAS À FRENTE. O JOGO SÓ TINHA DUAS.", "THOUGHT THREE MOVES AHEAD. THE GAME ONLY HAD TWO."),

  // ---------- habilidade que tirou folga (a pior da partida) — a piada é com a situação, não com a pessoa ----------
  q("re-lo-a", low("re"), "OS REFLEXOS FORAM TIRAR UMA SONECA. VOLTAM JÁ.", "YOUR REFLEXES WENT FOR A NAP. BACK SOON."),
  q("re-lo-b", low("re"), "A MOSCA AGRADECE A OPORTUNIDADE.", "THE FLY THANKS YOU FOR THE OPPORTUNITY."),
  q("re-lo-c", low("re"), "TUDO EM CÂMERA LENTA. FICOU MUITO CINEMATOGRÁFICO.", "ALL IN SLOW MOTION. VERY CINEMATIC."),
  q("ti-lo-a", low("ti"), "O RITMO ESTAVA PERFEITO. PARA OUTRA MÚSICA.", "THE RHYTHM WAS PERFECT. FOR A DIFFERENT SONG."),
  q("ti-lo-b", low("ti"), "A TORRADA PULOU. O CACHORRO MANDA UM OBRIGADO.", "THE TOAST JUMPED. THE DOG SAYS THANKS."),
  q("ti-lo-c", low("ti"), "O RELÓGIO E VOCÊ ESTÃO EM FUSOS DIFERENTES HOJE.", "YOU AND THE CLOCK WERE IN DIFFERENT TIME ZONES TODAY."),
  q("pr-lo-a", low("pr"), "O ALVO ESTAVA LOGO ALI. VOCÊ FOI LOGO LÁ.", "THE TARGET WAS RIGHT HERE. YOU WENT RIGHT THERE."),
  q("pr-lo-b", low("pr"), "ACERTO EM CHEIO... NA PAREDE DO LADO.", "A PERFECT HIT... ON THE WALL NEXT TO IT."),
  q("pr-lo-c", low("pr"), "TRAÇOS ARTÍSTICOS. O CONTRATO QUERIA UMA ASSINATURA.", "VERY ARTISTIC STROKES. THE CONTRACT WANTED A SIGNATURE."),
  q("co-lo-a", low("co"), "OS GRAMPEADORES TE ACHARAM. TODAS AS VEZES.", "THE STAPLERS FOUND YOU. EVERY SINGLE TIME."),
  q("co-lo-b", low("co"), "A VASSOURA CAIU. MAS CAIU BONITO.", "THE BROOM FELL. BEAUTIFULLY, THOUGH."),
  q("co-lo-c", low("co"), "DANÇOU COM OS OBSTÁCULOS. ELES CONDUZIRAM.", "DANCED WITH THE OBSTACLES. THEY LED."),
  q("au-lo-a", low("au"), "O BOTÃO DIZIA 'NÃO APERTE'. VOCÊ LEU COMO CONVITE.", "THE BUTTON SAID 'DON'T'. YOU READ IT AS AN INVITATION."),
  q("au-lo-b", low("au"), "TODA PEGADINHA GANHOU UM FÃ HOJE.", "EVERY TRAP GAINED A FAN TODAY."),
  q("au-lo-c", low("au"), "O CHEFE NÃO MANDOU. VOCÊ FEZ ASSIM MESMO. COM ENTUSIASMO.", "THE BOSS DIDN'T SAY. YOU DID IT ANYWAY. WITH GUSTO."),
  q("pe-lo-a", low("pe"), "O ESTAGIÁRIO SEGUE ESCONDIDO. ELE ESTÁ MUITO ORGULHOSO.", "THE INTERN IS STILL HIDING. HE'S VERY PROUD."),
  q("pe-lo-b", low("pe"), "AS DIFERENÇAS ERAM SUTIS. UM POUQUINHO SUTIS DEMAIS.", "THE DIFFERENCES WERE SUBTLE. A LITTLE TOO SUBTLE."),
  q("pe-lo-c", low("pe"), "O CAMALEÃO VENCEU ESTA RODADA. ELE TREINOU A VIDA TODA.", "THE CHAMELEON WON THIS ROUND. IT TRAINED ITS WHOLE LIFE."),
  q("me-lo-a", low("me"), "A MEMÓRIA FOI BUSCAR CAFÉ E SE PERDEU NO CORREDOR.", "YOUR MEMORY WENT FOR COFFEE AND GOT LOST IN THE HALLWAY."),
  q("me-lo-b", low("me"), "A SENHA DO COFRE VOOU. E LEVOU AS OUTRAS JUNTO.", "THE SAFE CODE FLEW AWAY. IT TOOK THE OTHERS WITH IT."),
  q("me-lo-c", low("me"), "O PEDIDO ERA SIMPLES. O PEDIDO FOI EMBORA.", "THE ORDER WAS SIMPLE. THEN THE ORDER LEFT."),
  q("lo-lo-a", low("lo"), "OS ENIGMAS VENCERAM HOJE. AMANHÃ É OUTRO PUZZLE.", "THE RIDDLES WON TODAY. TOMORROW IS ANOTHER PUZZLE."),
  q("lo-lo-b", low("lo"), "AS ENGRENAGENS GIRARAM PRO LADO DA SURPRESA.", "THE GEARS TURNED TOWARD SURPRISE."),
  q("lo-lo-c", low("lo"), "A MATEMÁTICA DE HOJE FOI ARTE ABSTRATA.", "TODAY'S MATH WAS ABSTRACT ART."),

  // ---------- equilibrado ----------
  q("bal-1", { k: "balanced" }, "UM POUCO DE TUDO. TUDO UM POUCO.", "A LITTLE OF EVERYTHING. EVERYTHING A LITTLE."),
  q("bal-2", { k: "balanced" }, "EQUILIBRADO COMO UMA TORRE DE COPOS. POR ENQUANTO.", "BALANCED LIKE A TOWER OF CUPS. FOR NOW."),
  q("bal-3", { k: "balanced" }, "O CANIVETE SUÍÇO DO CAOS.", "THE SWISS ARMY KNIFE OF CHAOS."),
  q("bal-4", { k: "balanced" }, "NENHUMA HABILIDADE FICOU COM CIÚMES HOJE.", "NO SKILL GOT JEALOUS TODAY."),
  q("bal-5", { k: "balanced" }, "O RADAR VIROU UM CÍRCULO. O RADAR ESTÁ CONFUSO.", "THE RADAR TURNED INTO A CIRCLE. THE RADAR IS CONFUSED."),
  q("bal-6", { k: "balanced" }, "IGUALMENTE IMPREVISÍVEL EM TODAS AS FRENTES.", "EQUALLY UNPREDICTABLE ON ALL FRONTS."),
  q("bal-7", { k: "balanced" }, "DEMOCRACIA PERFEITA ENTRE OS SEUS DEDOS.", "A PERFECT DEMOCRACY BETWEEN YOUR FINGERS."),
  q("bal-8", { k: "balanced" }, "TODAS AS HABILIDADES VIERAM PRA FESTA. NINGUÉM DANÇOU SOZINHO.", "EVERY SKILL CAME TO THE PARTY. NOBODY DANCED ALONE."),

  // ---------- excelente ----------
  q("ex-1", { k: "excellent" }, "VOCÊ NÃO JOGOU. VOCÊ DEMITIU O CAOS.", "YOU DIDN'T PLAY. YOU FIRED THE CHAOS."),
  q("ex-2", { k: "excellent" }, "O JOGO VAI PRECISAR DE UM MINUTO.", "THE GAME NEEDS A MINUTE."),
  q("ex-3", { k: "excellent" }, "300 MICROGAMES E NENHUM SABE O QUE FAZER COM VOCÊ.", "300 MICROGAMES AND NOT ONE KNOWS WHAT TO DO WITH YOU."),
  q("ex-4", { k: "excellent" }, "O CHEFE QUER SEU AUTÓGRAFO. E TE DAR UM AUMENTO.", "THE BOSS WANTS YOUR AUTOGRAPH. AND TO GIVE YOU A RAISE."),
  q("ex-5", { k: "excellent" }, "ISSO FOI UMA PARTIDA OU UM TUTORIAL AO CONTRÁRIO?", "WAS THAT A MATCH OR A REVERSE TUTORIAL?"),
  q("ex-6", { k: "excellent" }, "AS FASES DIFÍCEIS ESTÃO REPENSANDO A CARREIRA.", "THE HARD LEVELS ARE RETHINKING THEIR CAREERS."),
  q("ex-7", { k: "excellent" }, "MODO LENDA DE FLIPERAMA DESBLOQUEADO (NA NOSSA OPINIÃO).", "ARCADE LEGEND MODE UNLOCKED (IN OUR OPINION)."),
  q("ex-8", { k: "excellent" }, "O CAOS TENTOU. O CAOS PEDIU ÁGUA.", "CHAOS TRIED. CHAOS NEEDS A GLASS OF WATER."),

  // ---------- partida curta: sem conclusões sobre habilidades ----------
  q("sh-1", { k: "short" }, "FOI RÁPIDO. O RADAR NEM TERMINOU DE LIGAR.", "THAT WAS FAST. THE RADAR WASN'T EVEN ON YET."),
  q("sh-2", { k: "short" }, "UM AQUECIMENTO DE RESPEITO.", "A VERY RESPECTABLE WARM-UP."),
  q("sh-3", { k: "short" }, "TRAILER EXCELENTE. CADÊ O FILME?", "GREAT TRAILER. WHERE'S THE MOVIE?"),
  q("sh-4", { k: "short" }, "DADOS INSUFICIENTES. DRAMA SUFICIENTE.", "NOT ENOUGH DATA. PLENTY OF DRAMA."),
  q("sh-5", { k: "short" }, "ENTROU, OLHOU EM VOLTA, SAIU. UM CLÁSSICO.", "WALKED IN, LOOKED AROUND, LEFT. A CLASSIC."),
  q("sh-6", { k: "short" }, "O CAFÉ NEM TEVE TEMPO DE ESFRIAR.", "THE COFFEE DIDN'T EVEN HAVE TIME TO COOL."),
  q("sh-7", { k: "short" }, "O PERFIL AINDA ESTÁ CARREGANDO. MAIS UMA?", "PROFILE STILL LOADING. ONE MORE ROUND?"),
  q("sh-8", { k: "short" }, "ISSO CONTA COMO PISCADA COMPETITIVA.", "THAT COUNTS AS COMPETITIVE BLINKING."),

  // ---------- partida excepcionalmente longa ----------
  q("lg-1", { k: "long" }, "VOCÊ FICOU TANTO QUE O JOGO MUDOU DE ESTAÇÃO.", "YOU STAYED SO LONG THE GAME CHANGED SEASONS."),
  q("lg-2", { k: "long" }, "O ESCRITÓRIO FECHOU HÁ HORAS. VOCÊ CONTINUOU.", "THE OFFICE CLOSED HOURS AGO. YOU KEPT GOING."),
  q("lg-3", { k: "long" }, "MARATONA DE MICROGAMES. MEDALHA IMAGINÁRIA, SUOR REAL.", "A MICROGAME MARATHON. IMAGINARY MEDAL, REAL SWEAT."),
  q("lg-4", { k: "long" }, "AS FASES COMEÇARAM A VOLTAR SÓ PRA TE VER DE NOVO.", "THE LEVELS STARTED COMING BACK JUST TO SEE YOU AGAIN."),
  q("lg-5", { k: "long" }, "O ÔNIBUS DAS 17H58 PASSOU DUAS VEZES.", "THE 5:58 BUS CAME BY TWICE."),
  q("lg-6", { k: "long" }, "RESISTÊNCIA DE PLANTA DE PLÁSTICO.", "PLASTIC-PLANT STAMINA."),
  q("lg-7", { k: "long" }, "O CRONÔMETRO PRECISOU SENTAR UM POUCO.", "THE STOPWATCH HAD TO SIT DOWN FOR A BIT."),
  q("lg-8", { k: "long" }, "O CAOS ACELEROU. VOCÊ ACELEROU JUNTO E ACENOU.", "CHAOS SPED UP. YOU SPED UP TOO AND WAVED."),

  // ---------- resultados inusitados ----------
  q("zw-1", { k: "zero-wins" }, "ZERO VITÓRIAS. CEM POR CENTO DE PRESENÇA.", "ZERO WINS. ONE HUNDRED PERCENT ATTENDANCE."),
  q("zw-2", { k: "zero-wins" }, "INVICTO NA NOBRE ARTE DE TENTAR.", "UNDEFEATED IN THE NOBLE ART OF TRYING."),
  q("zw-3", { k: "zero-wins" }, "OS MICROGAMES VENCERAM. MAS ESTÃO SE SENTINDO CULPADOS.", "THE MICROGAMES WON. BUT THEY FEEL KIND OF GUILTY."),
  q("xt-1", { k: "extremes" }, "CEM POR CENTO NUMA COISA. ZERO EM OUTRA. CONVICÇÃO TOTAL.", "100% AT ONE THING. 0% AT ANOTHER. TOTAL COMMITMENT."),
  q("xt-2", { k: "extremes" }, "PERFEIÇÃO E CAOS NA MESMA PARTIDA. COMBO RARO.", "PERFECTION AND CHAOS IN ONE MATCH. RARE COMBO."),
  q("sp-1", { k: "spiky" }, "SEU RADAR PARECE UMA ESTRELA-DO-MAR SURPRESA.", "YOUR RADAR LOOKS LIKE A SURPRISED STARFISH."),
  q("sp-2", { k: "spiky" }, "UM GRÁFICO COM MAIS PONTAS QUE UM GRAMPEADOR ABERTO.", "A CHART WITH MORE SPIKES THAN AN OPEN STAPLER."),
  q("hf-1", { k: "half" }, "METADE HERÓI. METADE PLOT TWIST.", "HALF HERO. HALF PLOT TWIST."),
  q("hf-2", { k: "half" }, "GANHOU METADE. A OUTRA METADE FOI CONTEÚDO.", "WON HALF. THE OTHER HALF WAS CONTENT."),
  q("rc-1", { k: "record" }, "RECORDE NOVO. TROFÉU IMAGINÁRIO, ORGULHO REAL.", "NEW RECORD. IMAGINARY TROPHY, REAL PRIDE."),
  q("rc-2", { k: "record" }, "SUPEROU VOCÊ MESMO. VOCÊ MESMO MANDOU PARABÉNS.", "YOU BEAT YOURSELF. YOURSELF SAYS CONGRATS."),
  q("et-1", { k: "easy-trip" }, "SOBREVIVEU ÀS DIFÍCEIS. TROPEÇOU NUMA FÁCIL. ARTE PURA.", "SURVIVED THE HARD ONES. TRIPPED ON AN EASY ONE. PURE ART."),
  q("et-2", { k: "easy-trip" }, "DERROTADO PELO MAIS SIMPLES. O MAIS SIMPLES COMEMOROU MUITO.", "TAKEN DOWN BY THE SIMPLEST ONE. IT CELEBRATED A LOT."),

  // ---------- WTF Moments ----------
  q("wa-1", { k: "wtf-all-won" }, "OS MOMENTOS WTF ACHARAM VOCÊ ESTRANHO.", "THE WTF MOMENTS FOUND YOU WEIRD."),
  q("wa-2", { k: "wtf-all-won" }, "O ABSURDO TE RECONHECEU COMO UM DOS SEUS.", "THE ABSURD RECOGNIZED YOU AS ONE OF ITS OWN."),
  q("wa-3", { k: "wtf-all-won" }, "ENTENDEU O NONSENSE. O NONSENSE NÃO ENTENDEU VOCÊ.", "YOU GOT THE NONSENSE. THE NONSENSE DIDN'T GET YOU."),
  q("wl-1", { k: "wtf-all-lost" }, "O ABSURDO VENCEU. MAS PEDIU DESCULPAS.", "THE ABSURD WON. BUT IT APOLOGIZED."),
  q("wl-2", { k: "wtf-all-lost" }, "A LESMA MANDOU LEMBRANÇAS.", "THE SNAIL SENDS ITS REGARDS."),
  q("wk-1", { k: "wtf-ko" }, "GAME OVER POR MOTIVOS PSICODÉLICOS.", "GAME OVER FOR PSYCHEDELIC REASONS."),
  q("wk-2", { k: "wtf-ko" }, "PERDER PRA UM MOMENTO WTF CONTA COMO EXPERIÊNCIA CULTURAL.", "LOSING TO A WTF MOMENT COUNTS AS A CULTURAL EXPERIENCE."),
  q("wi-1", { k: "wtf-insane-ko" }, "A REALIDADE DERRETEU PRIMEIRO. VOCÊ SÓ ACOMPANHOU.", "REALITY MELTED FIRST. YOU JUST FOLLOWED ALONG."),
  q("wi-2", { k: "wtf-insane-ko" }, "O UNIVERSO FICOU DE CABEÇA PRA BAIXO. NÃO FOI CULPA SUA.", "THE UNIVERSE WENT UPSIDE DOWN. NOT YOUR FAULT."),
  q("wt-1", { k: "wtf-tourist" }, "VISITOU O ABSURDO VÁRIAS VEZES. VOLTOU COM LEMBRANCINHA.", "VISITED THE ABSURD SEVERAL TIMES. BROUGHT BACK SOUVENIRS."),
  q("wt-2", { k: "wtf-tourist" }, "PASSAPORTE CARIMBADO EM TRÊS DIMENSÕES ESQUISITAS.", "PASSPORT STAMPED IN THREE WEIRD DIMENSIONS."),

  // ---------- o próprio jogo assume a culpa (mais derrotas que vitórias) ----------
  q("bl-1", { k: "blame" }, "FOI MAL. O UNIVERSO ESTAVA MAL CALIBRADO.", "SORRY. THE UNIVERSE WAS MISCALIBRATED."),
  q("bl-2", { k: "blame" }, "DERROTA CONFIRMADA. JUSTIÇA QUESTIONÁVEL.", "DEFEAT CONFIRMED. JUSTICE QUESTIONABLE."),
  q("bl-3", { k: "blame" }, "O JOGO GANHOU. SUSPEITAMOS DE TRAPAÇA.", "THE GAME WON. WE SUSPECT CHEATING."),
  q("bl-4", { k: "blame" }, "VOCÊ PERDEU. O CAOS EXIGE RECONTAGEM.", "YOU LOST. CHAOS DEMANDS A RECOUNT."),
  q("bl-5", { k: "blame" }, "NÃO FOI UM ERRO. FOI UMA DECISÃO ARTÍSTICA.", "NOT A MISTAKE. AN ARTISTIC DECISION."),
  q("bl-6", { k: "blame" }, "O ESTAGIÁRIO PROGRAMOU ESSA FASE. ELE JÁ FOI ADVERTIDO.", "THE INTERN CODED THAT LEVEL. HE'S BEEN WARNED."),
  q("bl-7", { k: "blame" }, "CULPA NOSSA. O CRONÔMETRO TOMOU CAFÉ DEMAIS.", "OUR FAULT. THE TIMER HAD WAY TOO MUCH COFFEE."),
  q("bl-8", { k: "blame" }, "O JUIZ ERA UM GRAMPEADOR. CABE RECURSO.", "THE REFEREE WAS A STAPLER. YOU CAN APPEAL."),
  q("bl-9", { k: "blame" }, "PEDIMOS DESCULPAS: A GRAVIDADE ESTAVA EM MANUTENÇÃO.", "WE APOLOGIZE: GRAVITY WAS UNDER MAINTENANCE."),
  q("bl-10", { k: "blame" }, "DERROTA ENCAMINHADA AO COMITÊ DE PATOS DE BORRACHA.", "LOSS FORWARDED TO THE RUBBER DUCK COMMITTEE."),
  q("bl-11", { k: "blame" }, "O JOGO TROPEÇOU NO PRÓPRIO CABO. VOCÊ SÓ CAIU JUNTO.", "THE GAME TRIPPED ON ITS OWN CABLE. YOU JUST FELL WITH IT."),
  q("bl-12", { k: "blame" }, "AS FASES COMBINARAM TUDO ENTRE SI. TEMOS PRINTS.", "THE LEVELS PLANNED THIS TOGETHER. WE HAVE SCREENSHOTS."),
  q("bl-13", { k: "blame" }, "ERRO 404: VITÓRIA NÃO ENCONTRADA. JÁ OLHAMOS EMBAIXO DA MESA.", "ERROR 404: WIN NOT FOUND. WE CHECKED UNDER THE DESK."),
  q("bl-14", { k: "blame" }, "O CHEFE APERTOU O BOTÃO ERRADO DE NOVO.", "THE BOSS PRESSED THE WRONG BUTTON AGAIN."),
  q("bl-15", { k: "blame" }, "A FÍSICA DESTE JOGO FOI FEITA NUMA SEXTA ÀS 17H59.", "THIS GAME'S PHYSICS WAS MADE ON A FRIDAY AT 5:59 PM."),
  q("bl-16", { k: "blame" }, "DERROTA ARQUIVADA EM 'COISAS QUE NUNCA ACONTECERAM'.", "LOSS FILED UNDER 'THINGS THAT NEVER HAPPENED'."),
  q("bl-17", { k: "blame" }, "A LESMA SUBORNOU O PLACAR. ESTAMOS INVESTIGANDO.", "THE SNAIL BRIBED THE SCOREBOARD. WE'RE INVESTIGATING."),
  q("bl-18", { k: "blame" }, "AS INSTRUÇÕES ESTAVAM DE CABEÇA PRA BAIXO. CULPA NOSSA.", "THE INSTRUCTIONS WERE UPSIDE DOWN. OUR BAD."),
  q("bl-19", { k: "blame" }, "RECALCULANDO A ROTA... QUEM SE PERDEU FOI O JOGO.", "RECALCULATING... THE GAME GOT LOST, NOT YOU."),
  q("bl-20", { k: "blame" }, "REVIMOS O REPLAY: A FASE PISCOU PRIMEIRO.", "WE CHECKED THE REPLAY: THE LEVEL BLINKED FIRST."),
  q("bl-21", { k: "blame" }, "O SERVIDOR DO DESTINO CAIU. ABRIMOS UM CHAMADO.", "FATE'S SERVER WENT DOWN. WE OPENED A TICKET."),
  q("bl-22", { k: "blame" }, "ALGUÉM DERRUBOU CAFÉ NO CÓDIGO. NÃO FOI VOCÊ.", "SOMEONE SPILLED COFFEE ON THE CODE. IT WASN'T YOU."),

  // ---------- qualquer partida (reserva) ----------
  q("any-1", { k: "any" }, "O CAOS LEVOU ESTA. A REVANCHE ESTÁ A UM BOTÃO.", "CHAOS TOOK THIS ONE. THE REMATCH IS ONE BUTTON AWAY."),
  q("any-2", { k: "any" }, "FIM DE JOGO. COMEÇO DE LENDA (TALVEZ).", "GAME OVER. A LEGEND BEGINS (MAYBE)."),
  q("any-3", { k: "any" }, "OS MICROGAMES EXIGEM UMA REVANCHE.", "THE MICROGAMES DEMAND A REMATCH."),
  q("any-4", { k: "any" }, "PARTIDA DIGNA DE DOCUMENTÁRIO DE NATUREZA.", "A MATCH WORTHY OF A NATURE DOCUMENTARY."),
  q("any-5", { k: "any" }, "NARRADOR AQUI: EU TAMBÉM NÃO ENTENDI O QUE ACONTECEU.", "NARRATOR HERE: I DON'T KNOW WHAT HAPPENED EITHER."),
  q("any-6", { k: "any" }, "AS VIDAS ACABARAM. A VONTADE, NÃO.", "OUT OF LIVES. NOT OUT OF MOJO."),
];

// ---------------- condições ----------------

/** Partida curta demais para conclusões. */
export function isShort(p: Profile): boolean {
  return p.played < SHORT_PLAYED || p.ranked.length < 3;
}

export function matches(c: Cond, f: MatchFacts): boolean {
  const p = f.profile;
  if (c.k === "short") return isShort(p);
  if (c.k === "any") return true;
  if (c.k === "blame") return p.played > 0 && p.wins * 2 < p.played;
  if (isShort(p)) return false; // sem amostra, nenhuma conclusão
  const top = p.ranked[0];
  const bottom = p.ranked[p.ranked.length - 1];
  const spread = top.rate - bottom.rate;
  switch (c.k) {
    case "pair":
      return top.key === c.hi && bottom.key === c.lo && top.rate >= HIGH - 0.1 && bottom.rate <= LOW + 0.1 && spread >= PAIR_GAP;
    case "high":
      return top.key === c.s && top.rate >= HIGH && spread >= 0.15;
    case "low":
      return bottom.key === c.s && bottom.rate <= LOW && spread >= 0.15;
    case "balanced":
      return p.ranked.length >= 4 && spread <= 0.2 && p.wins > 0;
    case "excellent":
      return p.played >= 15 && p.wins / p.played >= 0.85;
    case "long":
      return p.played >= LONG_PLAYED;
    case "zero-wins":
      return p.wins === 0;
    case "extremes":
      return p.ranked.some((s) => s.rate === 1 && s.n >= 4) && p.ranked.some((s) => s.rate === 0 && s.n >= STRONG_CHALLENGES);
    case "spiky":
      return p.ranked.length >= 4 && spread >= 0.8;
    case "half":
      return p.played >= 10 && p.wins * 2 === p.played;
    case "record":
      return f.newBest && p.played >= 8;
    case "easy-trip":
      return f.lostToDifficulty === 1 && p.played >= 20;
    case "wtf-all-won":
      return p.wtfPlayed >= 2 && p.wtfWins === p.wtfPlayed;
    case "wtf-all-lost":
      return p.wtfPlayed >= 2 && p.wtfWins === 0;
    case "wtf-ko":
      return f.lostToWtf === "normal";
    case "wtf-insane-ko":
      return f.lostToWtf === "insane";
    case "wtf-tourist":
      return p.wtfPlayed >= 3;
  }
}

// ---------------- escolha ----------------

/** Quantas frases recentes evitar (o histórico vive só na memória desta página). */
export const RECENT = 24;
/** Frases com prioridade até esta distância da melhor disputam no sorteio (variedade sem perder o foco). */
const TIER = 6;

export class QuipPicker {
  private recent: string[] = [];
  private readonly random: () => number;

  constructor(random: () => number = Math.random) {
    this.random = random;
  }

  pick(f: MatchFacts): Quip {
    const cands = QUIPS.filter((x) => matches(x.when, f)).map((x) => ({ x, pr: priorityOf(x.when, f) }));
    cands.sort((a, b) => b.pr - a.pr);
    const fresh = cands.filter((c) => !this.recent.includes(c.x.id));
    let chosen: Quip;
    if (fresh.length) {
      const top = fresh[0].pr;
      const tier = fresh.filter((c) => c.pr >= top - TIER);
      chosen = tier[Math.min(tier.length - 1, Math.floor(this.random() * tier.length))].x;
    } else {
      // tudo já saiu recentemente: a que saiu há mais tempo
      chosen = cands.reduce((a, b) => (this.recent.indexOf(a.x.id) <= this.recent.indexOf(b.x.id) ? a : b)).x;
    }
    this.recent = [...this.recent.filter((id) => id !== chosen.id), chosen.id].slice(-RECENT);
    return chosen;
  }
}

export function quipText(x: Quip, lang: Lang): string {
  return x[lang];
}
