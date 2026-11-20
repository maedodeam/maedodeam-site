// Grupos de palavras do "Quem Não Combina" (EN e PT são listas próprias, não traduções).
// Regra: nenhuma palavra aparece como membro em dois grupos do mesmo idioma, e nenhum membro é ambíguo com outro grupo
// (ex.: sem "orange" em frutas e cores, sem "Swift" em linguagens porque é uma ave).
export interface WordGroup {
  cat: string;
  members: string[];
  /** intrusos sutis (nível alto): parecem da categoria, mas não são */
  hard: string[];
}

export const GROUPS_EN: WordGroup[] = [
  { cat: "FRUITS", members: ["Apple", "Banana", "Mango", "Grape", "Cherry", "Pear", "Lemon", "Plum"], hard: ["Carrot", "Potato", "Onion", "Broccoli"] },
  { cat: "LANGUAGES", members: ["Python", "Ruby", "Kotlin", "Perl", "JavaScript", "TypeScript", "PHP", "Haskell"], hard: ["Cobra", "Anaconda", "Diamond"] },
  { cat: "OFFICE", members: ["Stapler", "Pencil", "Folder", "Printer", "Eraser", "Scissors", "Notebook"], hard: ["Pillow", "Toaster", "Sofa"] },
  { cat: "MAMMALS", members: ["Cat", "Dog", "Horse", "Whale", "Bat", "Cow", "Rabbit"], hard: ["Shark", "Penguin", "Lizard"] },
  { cat: "PLANETS", members: ["Mars", "Venus", "Jupiter", "Saturn", "Neptune", "Uranus", "Earth"], hard: ["Moon", "Sun", "Comet"] },
  { cat: "COLORS", members: ["Red", "Blue", "Green", "Purple", "Pink", "Gray", "Yellow"], hard: ["Paint", "Rainbow", "Crayon"] },
  { cat: "INSTRUMENTS", members: ["Guitar", "Piano", "Drums", "Violin", "Flute", "Trumpet", "Cello"], hard: ["Microphone", "Radio", "Headphones"] },
  { cat: "SPORTS", members: ["Soccer", "Tennis", "Golf", "Hockey", "Rugby", "Boxing", "Cycling"], hard: ["Stadium", "Trophy", "Whistle"] },
  { cat: "WEATHER", members: ["Rain", "Snow", "Fog", "Hail", "Wind", "Thunder"], hard: ["Umbrella", "Puddle", "Raincoat"] },
  { cat: "VEHICLES", members: ["Car", "Bus", "Truck", "Train", "Bike", "Plane", "Boat"], hard: ["Road", "Garage", "Tire"] },
  { cat: "BODY PARTS", members: ["Arm", "Leg", "Nose", "Elbow", "Knee", "Ear", "Chin"], hard: ["Glove", "Sock", "Hat"] },
  { cat: "DESSERTS", members: ["Cake", "Cookie", "Pudding", "Brownie", "Pie", "Donut", "Muffin"], hard: ["Sugar", "Oven", "Flour"] },
  { cat: "KITCHEN TOOLS", members: ["Spoon", "Fork", "Ladle", "Whisk", "Spatula", "Knife", "Tongs"], hard: ["Soup", "Recipe", "Apron"] },
  { cat: "COUNTRIES", members: ["Brazil", "Japan", "Canada", "Egypt", "Chile", "Kenya", "Italy"], hard: ["Paris", "Tokyo", "Africa"] },
  { cat: "SHAPES", members: ["Circle", "Square", "Triangle", "Oval", "Hexagon", "Star"], hard: ["Cube", "Sphere", "Pyramid"] },
  { cat: "BIRDS", members: ["Eagle", "Parrot", "Owl", "Pigeon", "Duck", "Crow", "Toucan"], hard: ["Bat", "Butterfly", "Balloon"] },
  { cat: "TECH", members: ["Smartwatch", "Router", "Webcam", "Tablet", "Laptop", "Modem", "Scanner"], hard: ["Desk", "Chair", "Lamp"] },
  { cat: "CLOTHES", members: ["Shirt", "Jeans", "Jacket", "Scarf", "Dress", "Sweater", "Shorts"], hard: ["Hanger", "Closet", "Laundry"] },
  { cat: "FEELINGS", members: ["Happy", "Sad", "Angry", "Scared", "Calm", "Proud"], hard: ["Smile", "Tears", "Hug"] },
  { cat: "JOBS", members: ["Doctor", "Teacher", "Pilot", "Chef", "Nurse", "Lawyer", "Farmer"], hard: ["Hospital", "Salary", "Uniform"] },
  { cat: "TREES", members: ["Oak", "Pine", "Maple", "Birch", "Willow", "Cedar", "Elm"], hard: ["Rose", "Tulip", "Grass"] },
  { cat: "DRINKS", members: ["Coffee", "Tea", "Juice", "Milk", "Soda", "Water", "Lemonade"], hard: ["Cup", "Ice", "Straw"] },
  { cat: "METALS", members: ["Iron", "Copper", "Tin", "Zinc", "Nickel", "Aluminum", "Titanium"], hard: ["Glass", "Wood", "Stone"] },
  { cat: "NUMBERS", members: ["Seven", "Twelve", "Forty", "Nine", "Hundred", "Three"], hard: ["First", "Many", "Plenty"] },
  { cat: "MONTHS", members: ["March", "April", "July", "October", "June", "May"], hard: ["Monday", "Summer", "Easter"] },
  { cat: "INSECTS", members: ["Ant", "Bee", "Beetle", "Wasp", "Moth", "Termite"], hard: ["Spider", "Worm", "Snail"] },
];

export const GROUPS_PT: WordGroup[] = [
  { cat: "FRUTAS", members: ["Maçã", "Banana", "Manga", "Uva", "Caju", "Goiaba", "Abacaxi", "Mamão"], hard: ["Cenoura", "Batata", "Cebola", "Alface"] },
  { cat: "LINGUAGENS", members: ["Python", "Ruby", "Kotlin", "Perl", "JavaScript", "TypeScript", "PHP", "Haskell"], hard: ["Cobra", "Jiboia", "Sucuri"] },
  { cat: "ESCRITÓRIO", members: ["Grampeador", "Lápis", "Pasta", "Impressora", "Borracha", "Tesoura", "Caderno"], hard: ["Travesseiro", "Torradeira", "Sofá"] },
  { cat: "MAMÍFEROS", members: ["Gato", "Cachorro", "Cavalo", "Baleia", "Morcego", "Vaca", "Coelho"], hard: ["Tubarão", "Pinguim", "Jacaré"] },
  { cat: "PLANETAS", members: ["Marte", "Vênus", "Júpiter", "Saturno", "Netuno", "Urano", "Terra"], hard: ["Lua", "Sol", "Cometa"] },
  { cat: "CORES", members: ["Vermelho", "Azul", "Verde", "Roxo", "Cinza", "Amarelo", "Lilás"], hard: ["Tinta", "Arco-íris", "Giz"] },
  { cat: "INSTRUMENTOS", members: ["Violão", "Piano", "Sanfona", "Violino", "Flauta", "Trompete", "Cavaquinho"], hard: ["Microfone", "Rádio", "Fone"] },
  { cat: "ESPORTES", members: ["Futebol", "Vôlei", "Handebol", "Golfe", "Judô", "Surfe", "Basquete"], hard: ["Estádio", "Troféu", "Apito"] },
  { cat: "CLIMA", members: ["Chuva", "Neve", "Neblina", "Granizo", "Vento", "Trovão"], hard: ["Guarda-chuva", "Poça", "Capa"] },
  { cat: "VEÍCULOS", members: ["Carro", "Ônibus", "Caminhão", "Trem", "Bicicleta", "Avião", "Barco"], hard: ["Estrada", "Garagem", "Pneu"] },
  { cat: "CORPO", members: ["Braço", "Perna", "Nariz", "Cotovelo", "Joelho", "Orelha", "Queixo"], hard: ["Luva", "Meia", "Chapéu"] },
  { cat: "SOBREMESAS", members: ["Bolo", "Pudim", "Brigadeiro", "Sorvete", "Torta", "Quindim", "Pavê"], hard: ["Açúcar", "Forno", "Farinha"] },
  { cat: "UTENSÍLIOS", members: ["Colher", "Garfo", "Concha", "Batedor", "Espátula", "Faca", "Pegador"], hard: ["Sopa", "Receita", "Avental"] },
  { cat: "PAÍSES", members: ["Brasil", "Japão", "Canadá", "Egito", "Chile", "Quênia", "Itália", "México"], hard: ["Paris", "Tóquio", "África"] },
  { cat: "FORMAS", members: ["Círculo", "Quadrado", "Triângulo", "Oval", "Hexágono", "Estrela"], hard: ["Cubo", "Esfera", "Pirâmide"] },
  { cat: "AVES", members: ["Águia", "Papagaio", "Coruja", "Pombo", "Pato", "Tucano", "Beija-flor"], hard: ["Morcego", "Borboleta", "Pipa"] },
  { cat: "TECNOLOGIA", members: ["Mouse", "Roteador", "Webcam", "Tablet", "Notebook", "Modem", "Scanner"], hard: ["Mesa", "Cadeira", "Luminária"] },
  { cat: "ROUPAS", members: ["Camisa", "Calça", "Jaqueta", "Cachecol", "Vestido", "Blusa", "Bermuda"], hard: ["Cabide", "Armário", "Varal"] },
  { cat: "EMOÇÕES", members: ["Alegria", "Tristeza", "Raiva", "Medo", "Calma", "Orgulho"], hard: ["Sorriso", "Lágrima", "Abraço"] },
  { cat: "PROFISSÕES", members: ["Médico", "Professor", "Piloto", "Cozinheiro", "Enfermeiro", "Advogado", "Agricultor"], hard: ["Hospital", "Salário", "Uniforme"] },
  { cat: "ÁRVORES", members: ["Ipê", "Pinheiro", "Jatobá", "Carvalho", "Mangueira", "Eucalipto", "Jequitibá"], hard: ["Rosa", "Margarida", "Grama"] },
  { cat: "BEBIDAS", members: ["Café", "Chá", "Suco", "Leite", "Refrigerante", "Água", "Limonada"], hard: ["Copo", "Gelo", "Canudo"] },
  { cat: "METAIS", members: ["Ferro", "Cobre", "Estanho", "Zinco", "Níquel", "Alumínio", "Titânio"], hard: ["Vidro", "Madeira", "Pedra"] },
  { cat: "NÚMEROS", members: ["Sete", "Doze", "Quarenta", "Nove", "Cem", "Três"], hard: ["Primeiro", "Muitos", "Vários"] },
  { cat: "MESES", members: ["Março", "Abril", "Julho", "Outubro", "Junho", "Maio"], hard: ["Segunda", "Verão", "Carnaval"] },
  { cat: "INSETOS", members: ["Formiga", "Abelha", "Besouro", "Vespa", "Mariposa", "Cupim", "Grilo"], hard: ["Aranha", "Minhoca", "Caracol"] },
];
