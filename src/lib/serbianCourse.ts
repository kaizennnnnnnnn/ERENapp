// ═══════════════════════════════════════════════════════════════════════════════
// SERBIAN LANGUAGE COURSE — taught by Professor Eren
// A complete beginner course: alphabet → words → phrases → sentences → dialogues
// Each lesson has vocabulary flashcards + a quiz. One lesson per day.
// ═══════════════════════════════════════════════════════════════════════════════

export interface Word {
  serbian: string   // Serbian word (Latin script)
  cyrillic: string  // Serbian Cyrillic
  english: string   // English translation
  pronunciation: string // phonetic hint
}

export interface Lesson {
  id: number
  title: string         // e.g. "Greetings"
  titleSr: string       // Serbian title
  category: string      // topic category
  description: string   // short blurb
  words: Word[]
  sentences: { serbian: string; english: string }[]
  quiz: { question: string; options: string[]; answer: number }[] // answer = index of correct option
}

export const SERBIAN_COURSE: Lesson[] = [
  // ── UNIT 1: BASICS ─────────────────────────────────────────────────────────
  {
    id: 1,
    title: 'Greetings',
    titleSr: 'Pozdravi',
    category: 'Basics',
    description: 'Say hello, goodbye, and basic pleasantries.',
    words: [
      { serbian: 'Zdravo', cyrillic: 'Здраво', english: 'Hello', pronunciation: 'ZDRAH-voh' },
      { serbian: 'Ćao', cyrillic: 'Ћао', english: 'Hi / Bye', pronunciation: 'CHOW' },
      { serbian: 'Dobro jutro', cyrillic: 'Добро јутро', english: 'Good morning', pronunciation: 'DOH-broh YOO-troh' },
      { serbian: 'Dobar dan', cyrillic: 'Добар дан', english: 'Good day', pronunciation: 'DOH-bar dahn' },
      { serbian: 'Dobro veče', cyrillic: 'Добро вече', english: 'Good evening', pronunciation: 'DOH-broh VEH-cheh' },
      { serbian: 'Laku noć', cyrillic: 'Лаку ноћ', english: 'Good night', pronunciation: 'LAH-koo nohch' },
      { serbian: 'Doviđenja', cyrillic: 'Довиђења', english: 'Goodbye', pronunciation: 'doh-vee-JEH-nyah' },
      { serbian: 'Hvala', cyrillic: 'Хвала', english: 'Thank you', pronunciation: 'HVAH-lah' },
    ],
    sentences: [
      { serbian: 'Zdravo, kako si?', english: 'Hello, how are you?' },
      { serbian: 'Dobro jutro, prijatelju!', english: 'Good morning, friend!' },
      { serbian: 'Hvala ti puno!', english: 'Thank you very much!' },
    ],
    quiz: [
      { question: 'How do you say "Hello" in Serbian?', options: ['Ćao', 'Zdravo', 'Hvala', 'Molim'], answer: 1 },
      { question: 'What does "Hvala" mean?', options: ['Hello', 'Goodbye', 'Thank you', 'Sorry'], answer: 2 },
      { question: '"Dobro jutro" means...', options: ['Good night', 'Good morning', 'Good evening', 'Goodbye'], answer: 1 },
    ],
  },
  {
    id: 2,
    title: 'Introductions',
    titleSr: 'Upoznavanje',
    category: 'Basics',
    description: 'Introduce yourself and ask names.',
    words: [
      { serbian: 'Ja', cyrillic: 'Ја', english: 'I', pronunciation: 'yah' },
      { serbian: 'Ti', cyrillic: 'Ти', english: 'You', pronunciation: 'tee' },
      { serbian: 'Ime', cyrillic: 'Име', english: 'Name', pronunciation: 'EE-meh' },
      { serbian: 'sam', cyrillic: 'сам', english: 'am', pronunciation: 'sahm' },
      { serbian: 'Drago mi je', cyrillic: 'Драго ми је', english: 'Nice to meet you', pronunciation: 'DRAH-goh mee yeh' },
      { serbian: 'Kako se zoveš?', cyrillic: 'Како се зовеш?', english: 'What is your name?', pronunciation: 'KAH-koh seh ZOH-vesh' },
      { serbian: 'Zovem se...', cyrillic: 'Зовем се...', english: 'My name is...', pronunciation: 'ZOH-vem seh' },
      { serbian: 'Odakle si?', cyrillic: 'Одакле си?', english: 'Where are you from?', pronunciation: 'OH-dahk-leh see' },
    ],
    sentences: [
      { serbian: 'Zdravo, ja sam Eren.', english: 'Hello, I am Eren.' },
      { serbian: 'Kako se zoveš?', english: 'What is your name?' },
      { serbian: 'Drago mi je, ja sam iz Srbije.', english: 'Nice to meet you, I am from Serbia.' },
    ],
    quiz: [
      { question: 'How do you say "My name is..." in Serbian?', options: ['Ja sam...', 'Zovem se...', 'Imam...', 'Idem...'], answer: 1 },
      { question: '"Kako se zoveš?" means...', options: ['How are you?', 'Where are you?', 'What is your name?', 'Who are you?'], answer: 2 },
      { question: '"Drago mi je" means...', options: ['I am sorry', 'Nice to meet you', 'Thank you', 'See you later'], answer: 1 },
    ],
  },
  {
    id: 3,
    title: 'Numbers 1-10',
    titleSr: 'Brojevi 1-10',
    category: 'Basics',
    description: 'Learn to count from one to ten.',
    words: [
      { serbian: 'Jedan', cyrillic: 'Један', english: 'One', pronunciation: 'YEH-dahn' },
      { serbian: 'Dva', cyrillic: 'Два', english: 'Two', pronunciation: 'dvah' },
      { serbian: 'Tri', cyrillic: 'Три', english: 'Three', pronunciation: 'tree' },
      { serbian: 'Četiri', cyrillic: 'Четири', english: 'Four', pronunciation: 'CHEH-tee-ree' },
      { serbian: 'Pet', cyrillic: 'Пет', english: 'Five', pronunciation: 'peht' },
      { serbian: 'Šest', cyrillic: 'Шест', english: 'Six', pronunciation: 'shehst' },
      { serbian: 'Sedam', cyrillic: 'Седам', english: 'Seven', pronunciation: 'SEH-dahm' },
      { serbian: 'Osam', cyrillic: 'Осам', english: 'Eight', pronunciation: 'OH-sahm' },
      { serbian: 'Devet', cyrillic: 'Девет', english: 'Nine', pronunciation: 'DEH-veht' },
      { serbian: 'Deset', cyrillic: 'Десет', english: 'Ten', pronunciation: 'DEH-seht' },
    ],
    sentences: [
      { serbian: 'Imam dva brata.', english: 'I have two brothers.' },
      { serbian: 'Eren ima četiri šape.', english: 'Eren has four paws.' },
      { serbian: 'Imam pet godina.', english: 'I am five years old.' },
    ],
    quiz: [
      { question: 'What is "Three" in Serbian?', options: ['Dva', 'Tri', 'Četiri', 'Pet'], answer: 1 },
      { question: '"Sedam" means...', options: ['Six', 'Seven', 'Eight', 'Nine'], answer: 1 },
      { question: 'How do you say "Ten"?', options: ['Devet', 'Deset', 'Osam', 'Sedam'], answer: 1 },
    ],
  },
  {
    id: 4,
    title: 'Colors',
    titleSr: 'Boje',
    category: 'Basics',
    description: 'Learn the names of common colors.',
    words: [
      { serbian: 'Crvena', cyrillic: 'Црвена', english: 'Red', pronunciation: 'TSRR-veh-nah' },
      { serbian: 'Plava', cyrillic: 'Плава', english: 'Blue', pronunciation: 'PLAH-vah' },
      { serbian: 'Zelena', cyrillic: 'Зелена', english: 'Green', pronunciation: 'ZEH-leh-nah' },
      { serbian: 'Žuta', cyrillic: 'Жута', english: 'Yellow', pronunciation: 'ZHOO-tah' },
      { serbian: 'Bela', cyrillic: 'Бела', english: 'White', pronunciation: 'BEH-lah' },
      { serbian: 'Crna', cyrillic: 'Црна', english: 'Black', pronunciation: 'TSRR-nah' },
      { serbian: 'Narandžasta', cyrillic: 'Наранџаста', english: 'Orange', pronunciation: 'nah-RAHN-jah-stah' },
      { serbian: 'Ljubičasta', cyrillic: 'Љубичаста', english: 'Purple', pronunciation: 'lyoo-BEE-chah-stah' },
    ],
    sentences: [
      { serbian: 'Eren je bela mačka.', english: 'Eren is a white cat.' },
      { serbian: 'Nebo je plavo.', english: 'The sky is blue.' },
      { serbian: 'Trava je zelena.', english: 'The grass is green.' },
    ],
    quiz: [
      { question: '"Crvena" means...', options: ['Blue', 'Green', 'Red', 'Yellow'], answer: 2 },
      { question: 'How do you say "White"?', options: ['Crna', 'Bela', 'Plava', 'Žuta'], answer: 1 },
      { question: '"Zelena" is which color?', options: ['Green', 'Yellow', 'Orange', 'Purple'], answer: 0 },
    ],
  },
  {
    id: 5,
    title: 'Family',
    titleSr: 'Porodica',
    category: 'People',
    description: 'Words for family members.',
    words: [
      { serbian: 'Mama', cyrillic: 'Мама', english: 'Mom', pronunciation: 'MAH-mah' },
      { serbian: 'Tata', cyrillic: 'Тата', english: 'Dad', pronunciation: 'TAH-tah' },
      { serbian: 'Brat', cyrillic: 'Брат', english: 'Brother', pronunciation: 'braht' },
      { serbian: 'Sestra', cyrillic: 'Сестра', english: 'Sister', pronunciation: 'SEH-strah' },
      { serbian: 'Baba', cyrillic: 'Баба', english: 'Grandmother', pronunciation: 'BAH-bah' },
      { serbian: 'Deda', cyrillic: 'Деда', english: 'Grandfather', pronunciation: 'DEH-dah' },
      { serbian: 'Porodica', cyrillic: 'Породица', english: 'Family', pronunciation: 'poh-ROH-dee-tsah' },
      { serbian: 'Dete', cyrillic: 'Дете', english: 'Child', pronunciation: 'DEH-teh' },
    ],
    sentences: [
      { serbian: 'Moja mama je lepa.', english: 'My mom is beautiful.' },
      { serbian: 'Imam jednog brata.', english: 'I have one brother.' },
      { serbian: 'Volim svoju porodicu.', english: 'I love my family.' },
    ],
    quiz: [
      { question: '"Sestra" means...', options: ['Brother', 'Sister', 'Mother', 'Father'], answer: 1 },
      { question: 'How do you say "Dad"?', options: ['Mama', 'Baba', 'Tata', 'Deda'], answer: 2 },
      { question: '"Baba" means...', options: ['Baby', 'Grandmother', 'Aunt', 'Sister'], answer: 1 },
    ],
  },
  {
    id: 6,
    title: 'Animals',
    titleSr: 'Životinje',
    category: 'Nature',
    description: 'Learn animal names in Serbian.',
    words: [
      { serbian: 'Mačka', cyrillic: 'Мачка', english: 'Cat', pronunciation: 'MAHCH-kah' },
      { serbian: 'Pas', cyrillic: 'Пас', english: 'Dog', pronunciation: 'pahs' },
      { serbian: 'Ptica', cyrillic: 'Птица', english: 'Bird', pronunciation: 'PTEE-tsah' },
      { serbian: 'Riba', cyrillic: 'Риба', english: 'Fish', pronunciation: 'REE-bah' },
      { serbian: 'Miš', cyrillic: 'Миш', english: 'Mouse', pronunciation: 'meesh' },
      { serbian: 'Konj', cyrillic: 'Коњ', english: 'Horse', pronunciation: 'koh-nyeh' },
      { serbian: 'Krava', cyrillic: 'Крава', english: 'Cow', pronunciation: 'KRAH-vah' },
      { serbian: 'Zec', cyrillic: 'Зец', english: 'Rabbit', pronunciation: 'zehts' },
    ],
    sentences: [
      { serbian: 'Eren je lepa mačka.', english: 'Eren is a beautiful cat.' },
      { serbian: 'Pas trči u parku.', english: 'The dog is running in the park.' },
      { serbian: 'Riba pliva u vodi.', english: 'The fish swims in water.' },
    ],
    quiz: [
      { question: 'How do you say "Cat" in Serbian?', options: ['Pas', 'Mačka', 'Miš', 'Zec'], answer: 1 },
      { question: '"Riba" means...', options: ['Bird', 'Dog', 'Fish', 'Horse'], answer: 2 },
      { question: '"Zec" is a...', options: ['Mouse', 'Cow', 'Horse', 'Rabbit'], answer: 3 },
    ],
  },
  {
    id: 7,
    title: 'Food & Drink',
    titleSr: 'Hrana i piće',
    category: 'Daily Life',
    description: 'Common food and drink vocabulary.',
    words: [
      { serbian: 'Hleb', cyrillic: 'Хлеб', english: 'Bread', pronunciation: 'hlehb' },
      { serbian: 'Voda', cyrillic: 'Вода', english: 'Water', pronunciation: 'VOH-dah' },
      { serbian: 'Mleko', cyrillic: 'Млеко', english: 'Milk', pronunciation: 'MLEH-koh' },
      { serbian: 'Meso', cyrillic: 'Месо', english: 'Meat', pronunciation: 'MEH-soh' },
      { serbian: 'Jabuka', cyrillic: 'Јабука', english: 'Apple', pronunciation: 'YAH-boo-kah' },
      { serbian: 'Sir', cyrillic: 'Сир', english: 'Cheese', pronunciation: 'seer' },
      { serbian: 'Kafa', cyrillic: 'Кафа', english: 'Coffee', pronunciation: 'KAH-fah' },
      { serbian: 'Čaj', cyrillic: 'Чај', english: 'Tea', pronunciation: 'chay' },
    ],
    sentences: [
      { serbian: 'Želim čašu vode, molim.', english: 'I would like a glass of water, please.' },
      { serbian: 'Eren voli mleko.', english: 'Eren loves milk.' },
      { serbian: 'Hleb je svež.', english: 'The bread is fresh.' },
    ],
    quiz: [
      { question: '"Voda" means...', options: ['Milk', 'Water', 'Coffee', 'Tea'], answer: 1 },
      { question: 'How do you say "Bread"?', options: ['Meso', 'Sir', 'Hleb', 'Jabuka'], answer: 2 },
      { question: '"Kafa" is...', options: ['Tea', 'Coffee', 'Milk', 'Juice'], answer: 1 },
    ],
  },
  {
    id: 8,
    title: 'Body Parts',
    titleSr: 'Delovi tela',
    category: 'People',
    description: 'Learn body parts in Serbian.',
    words: [
      { serbian: 'Glava', cyrillic: 'Глава', english: 'Head', pronunciation: 'GLAH-vah' },
      { serbian: 'Ruka', cyrillic: 'Рука', english: 'Hand / Arm', pronunciation: 'ROO-kah' },
      { serbian: 'Noga', cyrillic: 'Нога', english: 'Leg / Foot', pronunciation: 'NOH-gah' },
      { serbian: 'Oko', cyrillic: 'Око', english: 'Eye', pronunciation: 'OH-koh' },
      { serbian: 'Nos', cyrillic: 'Нос', english: 'Nose', pronunciation: 'nohs' },
      { serbian: 'Usta', cyrillic: 'Уста', english: 'Mouth', pronunciation: 'OO-stah' },
      { serbian: 'Uvo', cyrillic: 'Уво', english: 'Ear', pronunciation: 'OO-voh' },
      { serbian: 'Srce', cyrillic: 'Срце', english: 'Heart', pronunciation: 'SRR-tseh' },
    ],
    sentences: [
      { serbian: 'Eren ima plave oči.', english: 'Eren has blue eyes.' },
      { serbian: 'Moja glava me boli.', english: 'My head hurts.' },
      { serbian: 'Srce kuca brzo.', english: 'The heart beats fast.' },
    ],
    quiz: [
      { question: '"Glava" means...', options: ['Hand', 'Head', 'Heart', 'Eye'], answer: 1 },
      { question: 'How do you say "Heart"?', options: ['Srce', 'Oko', 'Nos', 'Uvo'], answer: 0 },
      { question: '"Ruka" is...', options: ['Leg', 'Nose', 'Hand / Arm', 'Ear'], answer: 2 },
    ],
  },
  {
    id: 9,
    title: 'Days of the Week',
    titleSr: 'Dani u nedelji',
    category: 'Time',
    description: 'Learn the days of the week.',
    words: [
      { serbian: 'Ponedeljak', cyrillic: 'Понедељак', english: 'Monday', pronunciation: 'POH-neh-deh-lyahk' },
      { serbian: 'Utorak', cyrillic: 'Уторак', english: 'Tuesday', pronunciation: 'OO-toh-rahk' },
      { serbian: 'Sreda', cyrillic: 'Среда', english: 'Wednesday', pronunciation: 'SREH-dah' },
      { serbian: 'Četvrtak', cyrillic: 'Четвртак', english: 'Thursday', pronunciation: 'CHEHT-vrr-tahk' },
      { serbian: 'Petak', cyrillic: 'Петак', english: 'Friday', pronunciation: 'PEH-tahk' },
      { serbian: 'Subota', cyrillic: 'Субота', english: 'Saturday', pronunciation: 'SOO-boh-tah' },
      { serbian: 'Nedelja', cyrillic: 'Недеља', english: 'Sunday', pronunciation: 'NEH-deh-lyah' },
      { serbian: 'Dan', cyrillic: 'Дан', english: 'Day', pronunciation: 'dahn' },
    ],
    sentences: [
      { serbian: 'Danas je ponedeljak.', english: 'Today is Monday.' },
      { serbian: 'Subota je moj omiljeni dan.', english: 'Saturday is my favorite day.' },
      { serbian: 'Vidimo se u petak!', english: 'See you on Friday!' },
    ],
    quiz: [
      { question: '"Sreda" is which day?', options: ['Monday', 'Tuesday', 'Wednesday', 'Thursday'], answer: 2 },
      { question: 'How do you say "Friday"?', options: ['Petak', 'Subota', 'Nedelja', 'Utorak'], answer: 0 },
      { question: '"Nedelja" means...', options: ['Saturday', 'Sunday', 'Week', 'Month'], answer: 1 },
    ],
  },
  {
    id: 10,
    title: 'Weather',
    titleSr: 'Vreme',
    category: 'Nature',
    description: 'Talk about the weather.',
    words: [
      { serbian: 'Sunce', cyrillic: 'Сунце', english: 'Sun', pronunciation: 'SOON-tseh' },
      { serbian: 'Kiša', cyrillic: 'Киша', english: 'Rain', pronunciation: 'KEE-shah' },
      { serbian: 'Sneg', cyrillic: 'Снег', english: 'Snow', pronunciation: 'snegh' },
      { serbian: 'Vetar', cyrillic: 'Ветар', english: 'Wind', pronunciation: 'VEH-tar' },
      { serbian: 'Toplo', cyrillic: 'Топло', english: 'Warm', pronunciation: 'TOH-ploh' },
      { serbian: 'Hladno', cyrillic: 'Хладно', english: 'Cold', pronunciation: 'HLAHD-noh' },
      { serbian: 'Oblačno', cyrillic: 'Облачно', english: 'Cloudy', pronunciation: 'OH-blach-noh' },
      { serbian: 'Lepo', cyrillic: 'Лепо', english: 'Beautiful / Nice', pronunciation: 'LEH-poh' },
    ],
    sentences: [
      { serbian: 'Danas je lepo vreme.', english: 'Today the weather is nice.' },
      { serbian: 'Napolju pada kiša.', english: 'It is raining outside.' },
      { serbian: 'Zimi je hladno.', english: 'In winter it is cold.' },
    ],
    quiz: [
      { question: '"Kiša" means...', options: ['Snow', 'Rain', 'Wind', 'Sun'], answer: 1 },
      { question: 'How do you say "Cold"?', options: ['Toplo', 'Lepo', 'Hladno', 'Oblačno'], answer: 2 },
      { question: '"Sunce" is...', options: ['Moon', 'Star', 'Cloud', 'Sun'], answer: 3 },
    ],
  },
  {
    id: 11,
    title: 'Around the House',
    titleSr: 'Oko kuće',
    category: 'Daily Life',
    description: 'Objects and rooms in a home.',
    words: [
      { serbian: 'Kuća', cyrillic: 'Кућа', english: 'House', pronunciation: 'KOO-chah' },
      { serbian: 'Soba', cyrillic: 'Соба', english: 'Room', pronunciation: 'SOH-bah' },
      { serbian: 'Sto', cyrillic: 'Сто', english: 'Table', pronunciation: 'stoh' },
      { serbian: 'Stolica', cyrillic: 'Столица', english: 'Chair', pronunciation: 'STOH-lee-tsah' },
      { serbian: 'Vrata', cyrillic: 'Врата', english: 'Door', pronunciation: 'VRAH-tah' },
      { serbian: 'Prozor', cyrillic: 'Прозор', english: 'Window', pronunciation: 'PROH-zor' },
      { serbian: 'Krevet', cyrillic: 'Кревет', english: 'Bed', pronunciation: 'KREH-veht' },
      { serbian: 'Kuhinja', cyrillic: 'Кухиња', english: 'Kitchen', pronunciation: 'KOO-hee-nyah' },
    ],
    sentences: [
      { serbian: 'Eren spava na krevetu.', english: 'Eren sleeps on the bed.' },
      { serbian: 'Kuhinja je čista.', english: 'The kitchen is clean.' },
      { serbian: 'Otvori prozor, molim te.', english: 'Open the window, please.' },
    ],
    quiz: [
      { question: '"Krevet" means...', options: ['Chair', 'Table', 'Bed', 'Door'], answer: 2 },
      { question: 'How do you say "Window"?', options: ['Vrata', 'Prozor', 'Sto', 'Soba'], answer: 1 },
      { question: '"Kuća" is...', options: ['Kitchen', 'Room', 'House', 'Chair'], answer: 2 },
    ],
  },
  {
    id: 12,
    title: 'Common Verbs',
    titleSr: 'Česti glagoli',
    category: 'Grammar',
    description: 'Essential everyday verbs.',
    words: [
      { serbian: 'Biti', cyrillic: 'Бити', english: 'To be', pronunciation: 'BEE-tee' },
      { serbian: 'Imati', cyrillic: 'Имати', english: 'To have', pronunciation: 'EE-mah-tee' },
      { serbian: 'Ići', cyrillic: 'Ићи', english: 'To go', pronunciation: 'EE-chee' },
      { serbian: 'Jesti', cyrillic: 'Јести', english: 'To eat', pronunciation: 'YEH-stee' },
      { serbian: 'Piti', cyrillic: 'Пити', english: 'To drink', pronunciation: 'PEE-tee' },
      { serbian: 'Voleti', cyrillic: 'Волети', english: 'To love', pronunciation: 'VOH-leh-tee' },
      { serbian: 'Spavati', cyrillic: 'Спавати', english: 'To sleep', pronunciation: 'SPAH-vah-tee' },
      { serbian: 'Raditi', cyrillic: 'Радити', english: 'To work', pronunciation: 'RAH-dee-tee' },
    ],
    sentences: [
      { serbian: 'Ja volim da jedem.', english: 'I love to eat.' },
      { serbian: 'Eren voli da spava.', english: 'Eren loves to sleep.' },
      { serbian: 'Idemo u park!', english: 'Let\'s go to the park!' },
    ],
    quiz: [
      { question: '"Jesti" means...', options: ['To drink', 'To eat', 'To sleep', 'To go'], answer: 1 },
      { question: 'How do you say "To love"?', options: ['Imati', 'Voleti', 'Raditi', 'Biti'], answer: 1 },
      { question: '"Spavati" means...', options: ['To work', 'To go', 'To sleep', 'To have'], answer: 2 },
    ],
  },
  {
    id: 13,
    title: 'Emotions',
    titleSr: 'Emocije',
    category: 'People',
    description: 'Express feelings and emotions.',
    words: [
      { serbian: 'Srećan', cyrillic: 'Срећан', english: 'Happy', pronunciation: 'SREH-chan' },
      { serbian: 'Tužan', cyrillic: 'Тужан', english: 'Sad', pronunciation: 'TOO-zhahn' },
      { serbian: 'Ljut', cyrillic: 'Љут', english: 'Angry', pronunciation: 'lyoot' },
      { serbian: 'Umoran', cyrillic: 'Уморан', english: 'Tired', pronunciation: 'OO-moh-rahn' },
      { serbian: 'Gladan', cyrillic: 'Гладан', english: 'Hungry', pronunciation: 'GLAH-dahn' },
      { serbian: 'Žedan', cyrillic: 'Жедан', english: 'Thirsty', pronunciation: 'ZHEH-dahn' },
      { serbian: 'Uplašen', cyrillic: 'Уплашен', english: 'Scared', pronunciation: 'OO-plah-shehn' },
      { serbian: 'Uzbuđen', cyrillic: 'Узбуђен', english: 'Excited', pronunciation: 'ooz-BOO-jehn' },
    ],
    sentences: [
      { serbian: 'Eren je srećan danas.', english: 'Eren is happy today.' },
      { serbian: 'Ja sam umoran.', english: 'I am tired.' },
      { serbian: 'Mačka je gladna.', english: 'The cat is hungry.' },
    ],
    quiz: [
      { question: '"Srećan" means...', options: ['Sad', 'Happy', 'Angry', 'Tired'], answer: 1 },
      { question: 'How do you say "Hungry"?', options: ['Žedan', 'Umoran', 'Gladan', 'Ljut'], answer: 2 },
      { question: '"Umoran" means...', options: ['Excited', 'Scared', 'Thirsty', 'Tired'], answer: 3 },
    ],
  },
  {
    id: 14,
    title: 'At the Store',
    titleSr: 'U prodavnici',
    category: 'Daily Life',
    description: 'Shopping vocabulary and phrases.',
    words: [
      { serbian: 'Prodavnica', cyrillic: 'Продавница', english: 'Store / Shop', pronunciation: 'proh-DAHV-nee-tsah' },
      { serbian: 'Novac', cyrillic: 'Новац', english: 'Money', pronunciation: 'NOH-vahts' },
      { serbian: 'Cena', cyrillic: 'Цена', english: 'Price', pronunciation: 'TSEH-nah' },
      { serbian: 'Koliko?', cyrillic: 'Колико?', english: 'How much?', pronunciation: 'KOH-lee-koh' },
      { serbian: 'Skupo', cyrillic: 'Скупо', english: 'Expensive', pronunciation: 'SKOO-poh' },
      { serbian: 'Jeftino', cyrillic: 'Јефтино', english: 'Cheap', pronunciation: 'YEHF-tee-noh' },
      { serbian: 'Molim', cyrillic: 'Молим', english: 'Please / Excuse me', pronunciation: 'MOH-leem' },
      { serbian: 'Račun', cyrillic: 'Рачун', english: 'Bill / Check', pronunciation: 'RAH-choon' },
    ],
    sentences: [
      { serbian: 'Koliko ovo košta?', english: 'How much does this cost?' },
      { serbian: 'To je previše skupo.', english: 'That is too expensive.' },
      { serbian: 'Račun, molim.', english: 'The bill, please.' },
    ],
    quiz: [
      { question: '"Koliko?" means...', options: ['Where?', 'When?', 'How much?', 'Why?'], answer: 2 },
      { question: 'How do you say "Expensive"?', options: ['Jeftino', 'Skupo', 'Cena', 'Novac'], answer: 1 },
      { question: '"Molim" means...', options: ['Thank you', 'Sorry', 'Please', 'Hello'], answer: 2 },
    ],
  },
  {
    id: 15,
    title: 'Useful Phrases',
    titleSr: 'Korisne fraze',
    category: 'Conversation',
    description: 'Everyday phrases you will use a lot.',
    words: [
      { serbian: 'Da', cyrillic: 'Да', english: 'Yes', pronunciation: 'dah' },
      { serbian: 'Ne', cyrillic: 'Не', english: 'No', pronunciation: 'neh' },
      { serbian: 'Izvini', cyrillic: 'Извини', english: 'Sorry / Excuse me', pronunciation: 'eez-VEE-nee' },
      { serbian: 'Nema problema', cyrillic: 'Нема проблема', english: 'No problem', pronunciation: 'NEH-mah proh-BLEH-mah' },
      { serbian: 'Razumem', cyrillic: 'Разумем', english: 'I understand', pronunciation: 'RAH-zoo-mem' },
      { serbian: 'Ne razumem', cyrillic: 'Не разумем', english: 'I don\'t understand', pronunciation: 'neh RAH-zoo-mem' },
      { serbian: 'Govorite li engleski?', cyrillic: 'Говорите ли енглески?', english: 'Do you speak English?', pronunciation: 'GOH-voh-ree-teh lee ehn-GLEH-skee' },
      { serbian: 'Pomozite!', cyrillic: 'Помозите!', english: 'Help!', pronunciation: 'POH-moh-zee-teh' },
    ],
    sentences: [
      { serbian: 'Izvini, ne razumem srpski.', english: 'Sorry, I don\'t understand Serbian.' },
      { serbian: 'Da, razumem!', english: 'Yes, I understand!' },
      { serbian: 'Govorite li engleski?', english: 'Do you speak English?' },
    ],
    quiz: [
      { question: '"Razumem" means...', options: ['I speak', 'I understand', 'I know', 'I want'], answer: 1 },
      { question: 'How do you say "No"?', options: ['Da', 'Ne', 'Ni', 'Nu'], answer: 1 },
      { question: '"Izvini" means...', options: ['Thank you', 'Please', 'Sorry', 'Hello'], answer: 2 },
    ],
  },
]

// Helper: get the lesson for today (cycles through all lessons)
export function getTodaysLesson(): Lesson {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000)
  return SERBIAN_COURSE[dayOfYear % SERBIAN_COURSE.length]
}

export function getLessonById(id: number): Lesson | undefined {
  return SERBIAN_COURSE.find(l => l.id === id)
}
