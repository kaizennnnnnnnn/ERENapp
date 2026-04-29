// ═══════════════════════════════════════════════════════════════════════════════
// SERBIAN LANGUAGE COURSE — taught by Professor Eren
// Duolingo-style hierarchy: Sections → Units → small Lessons (3-5 words each).
// Each lesson generates 10-15 mixed exercises via buildExercises().
// ═══════════════════════════════════════════════════════════════════════════════

export interface Word {
  serbian: string
  cyrillic: string
  english: string
  pronunciation: string
}

export interface QuizItem {
  question: string
  options: string[]
  answer: number   // index of correct option
}

export interface Sentence {
  serbian: string
  english: string
}

export interface Lesson {
  id: number
  title: string
  titleSr: string
  category: string
  description: string
  words: Word[]
  sentences: Sentence[]
  quiz: QuizItem[]
}

// ─── Compact helpers so the course data below stays readable ───────────────
const w = (sr: string, cy: string, en: string, pron: string): Word =>
  ({ serbian: sr, cyrillic: cy, english: en, pronunciation: pron })
const s = (sr: string, en: string): Sentence => ({ serbian: sr, english: en })
const q = (question: string, options: string[], answer: number): QuizItem =>
  ({ question, options, answer })

let _lid = 0
function L(title: string, titleSr: string, category: string, words: Word[], sentences: Sentence[], quiz: QuizItem[]): Lesson {
  return { id: ++_lid, title, titleSr, category, description: '', words, sentences, quiz }
}

// ═══════════════════════════════════════════════════════════════════════════════
// THE COURSE — every lesson is small (3-5 words), so a session is ~3-5 min.
// ═══════════════════════════════════════════════════════════════════════════════
export const SERBIAN_COURSE: Lesson[] = [

  // ════════════════════════════════════════════════════════════════════════
  // SECTION 1 · STARTING OUT (Početak)
  // ════════════════════════════════════════════════════════════════════════

  // ─── UNIT: Hello! (Pozdrav) ───
  L('Hello', 'Zdravo', 'hello', [
    w('Zdravo', 'Здраво', 'Hello', 'ZDRAH-voh'),
    w('Ćao', 'Ћао', 'Hi', 'CHOW'),
  ], [
    s('Zdravo!', 'Hello!'),
    s('Ćao, Eren!', 'Hi, Eren!'),
  ], [
    q('"Zdravo" means...', ['Bye', 'Hello', 'Sorry', 'Thanks'], 1),
    q('How do you say "Hi"?', ['Ćao', 'Da', 'Ne', 'Hvala'], 0),
    q('Greet someone with...', ['Hvala', 'Zdravo', 'Izvini', 'Ne'], 1),
  ]),
  L('Bye', 'Doviđenja', 'hello', [
    w('Doviđenja', 'Довиђења', 'Goodbye', 'doh-vee-JEH-nyah'),
    w('Vidimo se', 'Видимо се', 'See you', 'VEE-dee-moh seh'),
  ], [
    s('Doviđenja, Eren!', 'Goodbye, Eren!'),
    s('Vidimo se sutra.', 'See you tomorrow.'),
  ], [
    q('"Doviđenja" means...', ['Hello', 'Goodbye', 'Please', 'Thanks'], 1),
    q('How to say "See you"?', ['Vidimo se', 'Hvala', 'Zdravo', 'Da'], 0),
    q('Use "Doviđenja" when...', ['Meeting', 'Leaving', 'Apologizing', 'Eating'], 1),
  ]),
  L('Morning', 'Dobro jutro', 'hello', [
    w('Dobro jutro', 'Добро јутро', 'Good morning', 'DOH-broh YOO-troh'),
    w('Jutro', 'Јутро', 'Morning', 'YOO-troh'),
    w('Dobar dan', 'Добар дан', 'Good day', 'DOH-bar dahn'),
  ], [
    s('Dobro jutro!', 'Good morning!'),
    s('Dobar dan, Eren.', 'Good day, Eren.'),
  ], [
    q('"Dobro jutro" means...', ['Goodnight', 'Good morning', 'Hello', 'Goodbye'], 1),
    q('How to say "Good day"?', ['Dobar dan', 'Laku noć', 'Hvala', 'Ćao'], 0),
    q('"Jutro" alone means...', ['Day', 'Morning', 'Night', 'Evening'], 1),
  ]),
  L('Evening', 'Veče', 'hello', [
    w('Dobro veče', 'Добро вече', 'Good evening', 'DOH-broh VEH-cheh'),
    w('Laku noć', 'Лаку ноћ', 'Good night', 'LAH-koo nohch'),
    w('Veče', 'Вече', 'Evening', 'VEH-cheh'),
  ], [
    s('Dobro veče!', 'Good evening!'),
    s('Laku noć, Eren.', 'Good night, Eren.'),
  ], [
    q('"Laku noć" means...', ['Good morning', 'Good night', 'Goodbye', 'Hello'], 1),
    q('How to say "Good evening"?', ['Dobar dan', 'Dobro veče', 'Dobro jutro', 'Ćao'], 1),
    q('"Veče" means...', ['Morning', 'Day', 'Evening', 'Night'], 2),
  ]),

  // ─── UNIT: Manners (Ljubaznost) ───
  L('Thanks', 'Hvala', 'manners', [
    w('Hvala', 'Хвала', 'Thank you', 'HVAH-lah'),
    w('Hvala lepo', 'Хвала лепо', 'Thank you kindly', 'HVAH-lah LEH-poh'),
  ], [
    s('Hvala!', 'Thanks!'),
    s('Hvala lepo, Eren.', 'Thank you kindly, Eren.'),
  ], [
    q('"Hvala" means...', ['Hello', 'Thank you', 'Sorry', 'Please'], 1),
    q('Polite "thanks" is...', ['Ćao', 'Hvala lepo', 'Doviđenja', 'Zdravo'], 1),
    q('After someone helps you, say...', ['Ne', 'Hvala', 'Da', 'Izvini'], 1),
  ]),
  L('Please', 'Molim', 'manners', [
    w('Molim', 'Молим', 'Please', 'MOH-leem'),
    w('Molim te', 'Молим те', 'Please (to friend)', 'MOH-leem teh'),
    w('Izvolite', 'Изволите', 'Here you go', 'eez-VOH-lee-teh'),
  ], [
    s('Molim te, Eren.', 'Please, Eren.'),
    s('Izvolite, hvala.', 'Here you go, thanks.'),
  ], [
    q('"Molim" means...', ['Sorry', 'Please / You\'re welcome', 'Thanks', 'Yes'], 1),
    q('Saying "please" to a friend...', ['Molim te', 'Hvala', 'Ćao', 'Da'], 0),
    q('"Izvolite" is used when...', ['Apologizing', 'Offering / handing over', 'Greeting', 'Refusing'], 1),
  ]),
  L('Sorry', 'Izvini', 'manners', [
    w('Izvini', 'Извини', 'Sorry', 'eez-VEE-nee'),
    w('Oprosti', 'Опрости', 'Forgive me', 'oh-PROH-stee'),
    w('Pardon', 'Пардон', 'Pardon', 'PAR-don'),
  ], [
    s('Izvini, Eren!', 'Sorry, Eren!'),
    s('Oprosti, molim te.', 'Forgive me, please.'),
  ], [
    q('"Izvini" means...', ['Hello', 'Sorry', 'Please', 'Thanks'], 1),
    q('"Oprosti" is closer to...', ['Forgive me', 'See you', 'Good night', 'Yes'], 0),
    q('After bumping into someone say...', ['Hvala', 'Izvini', 'Ne', 'Da'], 1),
  ]),
  L('Yes & No', 'Da i Ne', 'manners', [
    w('Da', 'Да', 'Yes', 'dah'),
    w('Ne', 'Не', 'No', 'neh'),
    w('Možda', 'Можда', 'Maybe', 'MOZH-dah'),
  ], [
    s('Da, hvala.', 'Yes, thanks.'),
    s('Ne, izvini.', 'No, sorry.'),
    s('Možda sutra.', 'Maybe tomorrow.'),
  ], [
    q('"Da" means...', ['No', 'Yes', 'Maybe', 'Hello'], 1),
    q('"Ne" means...', ['Yes', 'No', 'And', 'But'], 1),
    q('Uncertain answer is...', ['Da', 'Ne', 'Možda', 'Ćao'], 2),
  ]),

  // ─── UNIT: Me & You (Ja i Ti) ───
  L('I, You', 'Ja, Ti', 'me-you', [
    w('Ja', 'Ја', 'I', 'yah'),
    w('Ti', 'Ти', 'You', 'tee'),
  ], [
    s('Ja sam Eren.', 'I am Eren.'),
    s('Ti si moj prijatelj.', 'You are my friend.'),
  ], [
    q('"Ja" means...', ['You', 'I', 'He', 'We'], 1),
    q('"Ti" means...', ['I', 'You', 'They', 'She'], 1),
    q('To say "I" use...', ['Ti', 'On', 'Ja', 'Mi'], 2),
  ]),
  L('To Be', 'Biti', 'me-you', [
    w('Sam', 'Сам', 'Am', 'sahm'),
    w('Si', 'Си', 'Are (you)', 'see'),
    w('Je', 'Је', 'Is', 'yeh'),
  ], [
    s('Ja sam srećan.', 'I am happy.'),
    s('Ti si dobar.', 'You are good.'),
    s('On je mačka.', 'He is a cat.'),
  ], [
    q('"Sam" goes with...', ['Ti', 'On', 'Ja', 'Mi'], 2),
    q('"Si" goes with...', ['Ja', 'Ti', 'On', 'Oni'], 1),
    q('"Je" means...', ['Am', 'Are', 'Is', 'Be'], 2),
  ]),
  L('He, She', 'On, Ona', 'me-you', [
    w('On', 'Он', 'He', 'ohn'),
    w('Ona', 'Она', 'She', 'OH-nah'),
    w('Ono', 'Оно', 'It', 'OH-noh'),
  ], [
    s('On je Eren.', 'He is Eren.'),
    s('Ona je dobra.', 'She is good.'),
  ], [
    q('"On" means...', ['She', 'He', 'It', 'They'], 1),
    q('"Ona" means...', ['He', 'She', 'We', 'You'], 1),
    q('"Ono" refers to...', ['He', 'She', 'It', 'They'], 2),
  ]),
  L('We, They', 'Mi, Oni', 'me-you', [
    w('Mi', 'Ми', 'We', 'mee'),
    w('Oni', 'Они', 'They', 'OH-nee'),
    w('Smo', 'Смо', 'Are (we)', 'smoh'),
    w('Su', 'Су', 'Are (they)', 'soo'),
  ], [
    s('Mi smo prijatelji.', 'We are friends.'),
    s('Oni su mačke.', 'They are cats.'),
  ], [
    q('"Mi" means...', ['I', 'You', 'We', 'They'], 2),
    q('"Oni" means...', ['We', 'They', 'You all', 'He'], 1),
    q('"Smo" goes with...', ['Ja', 'Ti', 'Mi', 'Oni'], 2),
  ]),

  // ─── UNIT: Names (Imena) ───
  L('My Name', 'Moje ime', 'names', [
    w('Ime', 'Име', 'Name', 'EE-meh'),
    w('Zovem se', 'Зовем се', 'My name is', 'ZOH-vem seh'),
  ], [
    s('Zovem se Eren.', 'My name is Eren.'),
    s('Moje ime je Eren.', 'My name is Eren.'),
  ], [
    q('"Ime" means...', ['Family', 'Name', 'Friend', 'Day'], 1),
    q('"Zovem se" means...', ['What is your name?', 'My name is', 'Nice to meet you', 'See you'], 1),
    q('How to introduce yourself?', ['Hvala lepo', 'Zovem se Eren', 'Doviđenja', 'Da'], 1),
  ]),
  L('Your Name?', 'Kako se zoveš?', 'names', [
    w('Kako', 'Како', 'How', 'KAH-koh'),
    w('Kako se zoveš?', 'Како се зовеш?', 'What is your name?', 'KAH-koh seh ZOH-vesh'),
  ], [
    s('Kako se zoveš?', 'What is your name?'),
    s('Kako si?', 'How are you?'),
  ], [
    q('"Kako se zoveš?" means...', ['How old are you?', 'What is your name?', 'Where are you?', 'Who is that?'], 1),
    q('"Kako" means...', ['What', 'Where', 'How', 'Why'], 2),
    q('To ask name use...', ['Kako se zoveš', 'Hvala', 'Doviđenja', 'Da'], 0),
  ]),
  L('Nice to Meet You', 'Drago mi je', 'names', [
    w('Drago mi je', 'Драго ми је', 'Nice to meet you', 'DRAH-goh mee yeh'),
    w('Takođe', 'Такође', 'Likewise', 'tah-KOH-jeh'),
  ], [
    s('Drago mi je, Eren.', 'Nice to meet you, Eren.'),
    s('Takođe, hvala.', 'Likewise, thanks.'),
  ], [
    q('"Drago mi je" means...', ['Goodbye', 'Nice to meet you', 'Sorry', 'Thank you'], 1),
    q('"Takođe" means...', ['Sorry', 'Likewise', 'Yes', 'No'], 1),
    q('After "Drago mi je" reply with...', ['Hvala', 'Takođe', 'Doviđenja', 'Ne'], 1),
  ]),
  L('Where From', 'Odakle si?', 'names', [
    w('Odakle', 'Одакле', 'Where from', 'oh-DAHK-leh'),
    w('Iz', 'Из', 'From', 'eez'),
    w('Srbija', 'Србија', 'Serbia', 'SUR-bee-yah'),
  ], [
    s('Odakle si?', 'Where are you from?'),
    s('Ja sam iz Srbije.', 'I am from Serbia.'),
  ], [
    q('"Odakle si?" means...', ['Who are you?', 'Where are you from?', 'How old are you?', 'What is your name?'], 1),
    q('"Iz" means...', ['To', 'In', 'From', 'And'], 2),
    q('"Srbija" is the country...', ['Croatia', 'Serbia', 'Bosnia', 'Slovenia'], 1),
  ]),

  // ════════════════════════════════════════════════════════════════════════
  // SECTION 2 · NUMBERS & PEOPLE (Brojevi i Ljudi)
  // ════════════════════════════════════════════════════════════════════════

  // ─── UNIT: 1 to 5 (Jedan do pet) ───
  L('One & Two', 'Jedan, Dva', 'numbers-low', [
    w('Jedan', 'Један', 'One', 'YEH-dahn'),
    w('Dva', 'Два', 'Two', 'dvah'),
  ], [
    s('Jedan, dva.', 'One, two.'),
    s('Imam dva brata.', 'I have two brothers.'),
  ], [
    q('"Jedan" means...', ['One', 'Two', 'Three', 'Five'], 0),
    q('"Dva" means...', ['One', 'Two', 'Four', 'Ten'], 1),
    q('How to say "Two"?', ['Tri', 'Dva', 'Pet', 'Jedan'], 1),
  ]),
  L('Three & Four', 'Tri, Četiri', 'numbers-low', [
    w('Tri', 'Три', 'Three', 'tree'),
    w('Četiri', 'Четири', 'Four', 'CHEH-tee-ree'),
  ], [
    s('Eren ima četiri šape.', 'Eren has four paws.'),
    s('Tri prijatelja.', 'Three friends.'),
  ], [
    q('"Tri" means...', ['One', 'Two', 'Three', 'Four'], 2),
    q('"Četiri" means...', ['Five', 'Three', 'Four', 'Two'], 2),
    q('A cat has ___ legs:', ['Tri', 'Pet', 'Dva', 'Četiri'], 3),
  ]),
  L('Five', 'Pet', 'numbers-low', [
    w('Pet', 'Пет', 'Five', 'peht'),
    w('Brojevi', 'Бројеви', 'Numbers', 'BROH-yeh-vee'),
  ], [
    s('Imam pet godina.', 'I am five years old.'),
    s('Brojevi: jedan, dva, tri, četiri, pet.', 'Numbers: one, two, three, four, five.'),
  ], [
    q('"Pet" means...', ['Three', 'Four', 'Five', 'Six'], 2),
    q('"Brojevi" means...', ['Letters', 'Numbers', 'Words', 'Names'], 1),
    q('5 in Serbian is...', ['Pet', 'Šest', 'Tri', 'Dva'], 0),
  ]),

  // ─── UNIT: 6 to 10 (Šest do deset) ───
  L('Six & Seven', 'Šest, Sedam', 'numbers-high', [
    w('Šest', 'Шест', 'Six', 'shehst'),
    w('Sedam', 'Седам', 'Seven', 'SEH-dahm'),
  ], [
    s('Šest jabuka.', 'Six apples.'),
    s('Sedam dana u nedelji.', 'Seven days in a week.'),
  ], [
    q('"Šest" means...', ['Five', 'Six', 'Seven', 'Eight'], 1),
    q('"Sedam" means...', ['Six', 'Seven', 'Eight', 'Nine'], 1),
    q('A week has ___ days:', ['Pet', 'Šest', 'Sedam', 'Osam'], 2),
  ]),
  L('Eight & Nine', 'Osam, Devet', 'numbers-high', [
    w('Osam', 'Осам', 'Eight', 'OH-sahm'),
    w('Devet', 'Девет', 'Nine', 'DEH-veht'),
  ], [
    s('Osam mačaka.', 'Eight cats.'),
    s('Devet riba.', 'Nine fish.'),
  ], [
    q('"Osam" means...', ['Seven', 'Eight', 'Nine', 'Ten'], 1),
    q('"Devet" means...', ['Eight', 'Nine', 'Ten', 'Six'], 1),
    q('How to say "Nine"?', ['Šest', 'Devet', 'Osam', 'Pet'], 1),
  ]),
  L('Ten', 'Deset', 'numbers-high', [
    w('Deset', 'Десет', 'Ten', 'DEH-seht'),
  ], [
    s('Deset prstiju.', 'Ten fingers.'),
    s('Imam deset godina.', 'I am ten years old.'),
  ], [
    q('"Deset" means...', ['Nine', 'Ten', 'Eleven', 'Twelve'], 1),
    q('How many fingers?', ['Pet', 'Deset', 'Osam', 'Šest'], 1),
    q('After "devet" comes...', ['Osam', 'Sedam', 'Deset', 'Pet'], 2),
  ]),

  // ─── UNIT: Family (Porodica) ───
  L('Mom & Dad', 'Mama i Tata', 'family', [
    w('Mama', 'Мама', 'Mom', 'MAH-mah'),
    w('Tata', 'Тата', 'Dad', 'TAH-tah'),
  ], [
    s('Moja mama je lepa.', 'My mom is beautiful.'),
    s('Tata, ja sam umoran.', 'Dad, I am tired.'),
  ], [
    q('"Mama" means...', ['Sister', 'Mom', 'Aunt', 'Friend'], 1),
    q('"Tata" means...', ['Uncle', 'Brother', 'Dad', 'Grandpa'], 2),
    q('Your father is...', ['Brat', 'Tata', 'Mama', 'Deda'], 1),
  ]),
  L('Brother & Sister', 'Brat i Sestra', 'family', [
    w('Brat', 'Брат', 'Brother', 'braht'),
    w('Sestra', 'Сестра', 'Sister', 'SEH-strah'),
  ], [
    s('Imam jednog brata.', 'I have one brother.'),
    s('Moja sestra je dobra.', 'My sister is good.'),
  ], [
    q('"Brat" means...', ['Sister', 'Brother', 'Friend', 'Child'], 1),
    q('"Sestra" means...', ['Mom', 'Sister', 'Aunt', 'Daughter'], 1),
    q('How to say "Brother"?', ['Brat', 'Sestra', 'Tata', 'Mama'], 0),
  ]),
  L('Grandparents', 'Baba i Deda', 'family', [
    w('Baba', 'Баба', 'Grandma', 'BAH-bah'),
    w('Deda', 'Деда', 'Grandpa', 'DEH-dah'),
  ], [
    s('Baba peče hleb.', 'Grandma bakes bread.'),
    s('Deda spava.', 'Grandpa is sleeping.'),
  ], [
    q('"Baba" means...', ['Mom', 'Grandma', 'Aunt', 'Sister'], 1),
    q('"Deda" means...', ['Dad', 'Grandpa', 'Uncle', 'Brother'], 1),
    q('Mom\'s mom is your...', ['Sestra', 'Mama', 'Baba', 'Tetka'], 2),
  ]),
  L('Family', 'Porodica', 'family', [
    w('Porodica', 'Породица', 'Family', 'poh-ROH-dee-tsah'),
    w('Dete', 'Дете', 'Child', 'DEH-teh'),
    w('Moja', 'Моја', 'My (fem.)', 'MOH-yah'),
    w('Moj', 'Мој', 'My (masc.)', 'moy'),
  ], [
    s('Volim svoju porodicu.', 'I love my family.'),
    s('Moja sestra i moj brat.', 'My sister and my brother.'),
  ], [
    q('"Porodica" means...', ['Friend', 'Family', 'Home', 'Town'], 1),
    q('"Moj" is used for...', ['Female words', 'Male words', 'Both', 'Numbers'], 1),
    q('"My sister" is...', ['Moj sestra', 'Moja sestra', 'Mi sestra', 'Tvoja sestra'], 1),
  ]),

  // ─── UNIT: Body (Telo) ───
  L('Head', 'Glava', 'body', [
    w('Glava', 'Глава', 'Head', 'GLAH-vah'),
    w('Kosa', 'Коса', 'Hair', 'KOH-sah'),
  ], [
    s('Moja glava me boli.', 'My head hurts.'),
    s('Eren ima belu kosu.', 'Eren has white hair.'),
  ], [
    q('"Glava" means...', ['Hand', 'Head', 'Heart', 'Foot'], 1),
    q('"Kosa" means...', ['Eye', 'Hair', 'Nose', 'Mouth'], 1),
    q('Top of body is...', ['Noga', 'Ruka', 'Glava', 'Stomak'], 2),
  ]),
  L('Eyes & Mouth', 'Oči i Usta', 'body', [
    w('Oko', 'Око', 'Eye', 'OH-koh'),
    w('Usta', 'Уста', 'Mouth', 'OO-stah'),
    w('Nos', 'Нос', 'Nose', 'nohs'),
  ], [
    s('Eren ima plave oči.', 'Eren has blue eyes.'),
    s('Mali nos.', 'A small nose.'),
  ], [
    q('"Oko" means...', ['Ear', 'Eye', 'Nose', 'Mouth'], 1),
    q('"Usta" means...', ['Eye', 'Hand', 'Mouth', 'Heart'], 2),
    q('"Nos" means...', ['Mouth', 'Nose', 'Ear', 'Eye'], 1),
  ]),
  L('Hands & Legs', 'Ruke i Noge', 'body', [
    w('Ruka', 'Рука', 'Hand / Arm', 'ROO-kah'),
    w('Noga', 'Нога', 'Leg / Foot', 'NOH-gah'),
    w('Prst', 'Прст', 'Finger', 'puhrst'),
  ], [
    s('Imam dve ruke.', 'I have two hands.'),
    s('Noga me boli.', 'My leg hurts.'),
  ], [
    q('"Ruka" means...', ['Leg', 'Hand / Arm', 'Head', 'Foot'], 1),
    q('"Noga" means...', ['Hand', 'Leg', 'Eye', 'Heart'], 1),
    q('A finger is...', ['Ruka', 'Noga', 'Prst', 'Glava'], 2),
  ]),
  L('Heart & Body', 'Srce i Telo', 'body', [
    w('Srce', 'Срце', 'Heart', 'SUR-tseh'),
    w('Telo', 'Тело', 'Body', 'TEH-loh'),
    w('Uvo', 'Уво', 'Ear', 'OO-voh'),
  ], [
    s('Srce kuca brzo.', 'The heart beats fast.'),
    s('Tvoje telo je dobro.', 'Your body is good.'),
  ], [
    q('"Srce" means...', ['Hand', 'Heart', 'Hair', 'Eye'], 1),
    q('"Telo" means...', ['Friend', 'Family', 'Body', 'House'], 2),
    q('"Uvo" means...', ['Eye', 'Ear', 'Nose', 'Mouth'], 1),
  ]),

  // ════════════════════════════════════════════════════════════════════════
  // SECTION 3 · WORLD AROUND YOU (Svet)
  // ════════════════════════════════════════════════════════════════════════

  // ─── UNIT: Colors (Boje) ───
  L('Red & Blue', 'Crvena i Plava', 'colors', [
    w('Crvena', 'Црвена', 'Red', 'TSUR-veh-nah'),
    w('Plava', 'Плава', 'Blue', 'PLAH-vah'),
    w('Boja', 'Боја', 'Color', 'BOY-ah'),
  ], [
    s('Crvena jabuka.', 'A red apple.'),
    s('Plavo nebo.', 'Blue sky.'),
  ], [
    q('"Crvena" means...', ['Blue', 'Red', 'Green', 'Yellow'], 1),
    q('"Plava" means...', ['Red', 'Blue', 'Black', 'White'], 1),
    q('"Boja" means...', ['Number', 'Color', 'Shape', 'Animal'], 1),
  ]),
  L('Green & Yellow', 'Zelena i Žuta', 'colors', [
    w('Zelena', 'Зелена', 'Green', 'ZEH-leh-nah'),
    w('Žuta', 'Жута', 'Yellow', 'ZHOO-tah'),
  ], [
    s('Zelena trava.', 'Green grass.'),
    s('Žuto sunce.', 'Yellow sun.'),
  ], [
    q('"Zelena" means...', ['Yellow', 'Green', 'Red', 'Blue'], 1),
    q('"Žuta" means...', ['Yellow', 'White', 'Black', 'Pink'], 0),
    q('Grass is...', ['Crvena', 'Zelena', 'Plava', 'Crna'], 1),
  ]),
  L('White & Black', 'Bela i Crna', 'colors', [
    w('Bela', 'Бела', 'White', 'BEH-lah'),
    w('Crna', 'Црна', 'Black', 'TSUR-nah'),
    w('Siva', 'Сива', 'Gray', 'SEE-vah'),
  ], [
    s('Eren je bela mačka.', 'Eren is a white cat.'),
    s('Crna noć.', 'Black night.'),
  ], [
    q('"Bela" means...', ['Black', 'White', 'Brown', 'Gray'], 1),
    q('"Crna" means...', ['White', 'Black', 'Blue', 'Red'], 1),
    q('"Siva" means...', ['Pink', 'Gray', 'Brown', 'Yellow'], 1),
  ]),
  L('Orange & Purple', 'Narandžasta i Ljubičasta', 'colors', [
    w('Narandžasta', 'Наранџаста', 'Orange', 'nah-RAHN-jah-stah'),
    w('Ljubičasta', 'Љубичаста', 'Purple', 'lyoo-BEE-chah-stah'),
    w('Roze', 'Розе', 'Pink', 'ROH-zeh'),
  ], [
    s('Narandžasta lopta.', 'An orange ball.'),
    s('Ljubičasti cvet.', 'A purple flower.'),
  ], [
    q('"Narandžasta" means...', ['Yellow', 'Orange', 'Red', 'Pink'], 1),
    q('"Ljubičasta" means...', ['Pink', 'Purple', 'Blue', 'Green'], 1),
    q('"Roze" means...', ['Orange', 'Purple', 'Pink', 'Red'], 2),
  ]),

  // ─── UNIT: Animals (Životinje) ───
  L('Cat & Dog', 'Mačka i Pas', 'animals', [
    w('Mačka', 'Мачка', 'Cat', 'MAHCH-kah'),
    w('Pas', 'Пас', 'Dog', 'pahs'),
  ], [
    s('Eren je lepa mačka.', 'Eren is a beautiful cat.'),
    s('Pas trči u parku.', 'The dog runs in the park.'),
  ], [
    q('"Mačka" means...', ['Dog', 'Cat', 'Mouse', 'Bird'], 1),
    q('"Pas" means...', ['Cat', 'Dog', 'Cow', 'Horse'], 1),
    q('Eren is a...', ['Pas', 'Mačka', 'Riba', 'Ptica'], 1),
  ]),
  L('Fish & Bird', 'Riba i Ptica', 'animals', [
    w('Riba', 'Риба', 'Fish', 'REE-bah'),
    w('Ptica', 'Птица', 'Bird', 'PTEE-tsah'),
  ], [
    s('Riba pliva u vodi.', 'A fish swims in water.'),
    s('Ptica peva.', 'A bird sings.'),
  ], [
    q('"Riba" means...', ['Bird', 'Fish', 'Frog', 'Rabbit'], 1),
    q('"Ptica" means...', ['Mouse', 'Bird', 'Cat', 'Fish'], 1),
    q('What flies?', ['Riba', 'Ptica', 'Krava', 'Pas'], 1),
  ]),
  L('Mouse & Rabbit', 'Miš i Zec', 'animals', [
    w('Miš', 'Миш', 'Mouse', 'meesh'),
    w('Zec', 'Зец', 'Rabbit', 'zehts'),
  ], [
    s('Mačka lovi miša.', 'The cat hunts the mouse.'),
    s('Mali zec.', 'A small rabbit.'),
  ], [
    q('"Miš" means...', ['Cat', 'Mouse', 'Bird', 'Bear'], 1),
    q('"Zec" means...', ['Mouse', 'Rabbit', 'Dog', 'Cow'], 1),
    q('Eren chases a...', ['Krava', 'Konj', 'Miš', 'Pas'], 2),
  ]),
  L('Farm Animals', 'Životinje na farmi', 'animals', [
    w('Krava', 'Крава', 'Cow', 'KRAH-vah'),
    w('Konj', 'Коњ', 'Horse', 'kohny'),
    w('Životinja', 'Животиња', 'Animal', 'zhee-voh-TEE-nyah'),
  ], [
    s('Krava daje mleko.', 'A cow gives milk.'),
    s('Beli konj.', 'A white horse.'),
  ], [
    q('"Krava" means...', ['Horse', 'Cow', 'Pig', 'Sheep'], 1),
    q('"Konj" means...', ['Cow', 'Horse', 'Dog', 'Goat'], 1),
    q('"Životinja" means...', ['Plant', 'Animal', 'Person', 'Place'], 1),
  ]),

  // ─── UNIT: Food (Hrana) ───
  L('Bread', 'Hleb', 'food', [
    w('Hleb', 'Хлеб', 'Bread', 'hlehb'),
    w('Hrana', 'Храна', 'Food', 'HRAH-nah'),
  ], [
    s('Hleb je svež.', 'The bread is fresh.'),
    s('Hrana je dobra.', 'The food is good.'),
  ], [
    q('"Hleb" means...', ['Bread', 'Cheese', 'Apple', 'Meat'], 0),
    q('"Hrana" means...', ['Drink', 'Food', 'Bread', 'Cake'], 1),
    q('Daily bread is...', ['Sir', 'Hleb', 'Mleko', 'Voda'], 1),
  ]),
  L('Meat & Cheese', 'Meso i Sir', 'food', [
    w('Meso', 'Месо', 'Meat', 'MEH-soh'),
    w('Sir', 'Сир', 'Cheese', 'seer'),
  ], [
    s('Eren voli meso.', 'Eren loves meat.'),
    s('Beli sir.', 'White cheese.'),
  ], [
    q('"Meso" means...', ['Cheese', 'Meat', 'Bread', 'Fish'], 1),
    q('"Sir" means...', ['Salt', 'Sugar', 'Cheese', 'Soup'], 2),
    q('Made from milk:', ['Hleb', 'Meso', 'Sir', 'Voće'], 2),
  ]),
  L('Apple & Fruit', 'Jabuka i Voće', 'food', [
    w('Jabuka', 'Јабука', 'Apple', 'YAH-boo-kah'),
    w('Voće', 'Воће', 'Fruit', 'VOH-cheh'),
    w('Banana', 'Банана', 'Banana', 'bah-NAH-nah'),
  ], [
    s('Crvena jabuka.', 'A red apple.'),
    s('Volim voće.', 'I love fruit.'),
  ], [
    q('"Jabuka" means...', ['Banana', 'Apple', 'Orange', 'Grape'], 1),
    q('"Voće" means...', ['Vegetable', 'Fruit', 'Bread', 'Meat'], 1),
    q('A common fruit is...', ['Sir', 'Hleb', 'Jabuka', 'Meso'], 2),
  ]),
  L('Salt & Sugar', 'So i Šećer', 'food', [
    w('So', 'Со', 'Salt', 'soh'),
    w('Šećer', 'Шећер', 'Sugar', 'SHEH-cher'),
  ], [
    s('Treba mi so.', 'I need salt.'),
    s('Slatki šećer.', 'Sweet sugar.'),
  ], [
    q('"So" means...', ['Sugar', 'Salt', 'Pepper', 'Oil'], 1),
    q('"Šećer" means...', ['Salt', 'Sugar', 'Honey', 'Flour'], 1),
    q('Sweet stuff:', ['So', 'Šećer', 'Hleb', 'Sir'], 1),
  ]),

  // ─── UNIT: Drinks (Pića) ───
  L('Water', 'Voda', 'drinks', [
    w('Voda', 'Вода', 'Water', 'VOH-dah'),
    w('Piće', 'Пиће', 'Drink', 'PEE-cheh'),
  ], [
    s('Želim vode.', 'I want water.'),
    s('Hladno piće.', 'A cold drink.'),
  ], [
    q('"Voda" means...', ['Milk', 'Water', 'Juice', 'Tea'], 1),
    q('"Piće" means...', ['Food', 'Drink', 'Glass', 'Cup'], 1),
    q('When thirsty drink...', ['Hleb', 'Sir', 'Voda', 'Meso'], 2),
  ]),
  L('Milk', 'Mleko', 'drinks', [
    w('Mleko', 'Млеко', 'Milk', 'MLEH-koh'),
  ], [
    s('Eren voli mleko.', 'Eren loves milk.'),
    s('Toplo mleko.', 'Warm milk.'),
  ], [
    q('"Mleko" means...', ['Water', 'Milk', 'Tea', 'Coffee'], 1),
    q('Cats love...', ['Hleb', 'Mleko', 'So', 'Šećer'], 1),
    q('White drink:', ['Voda', 'Mleko', 'Čaj', 'Kafa'], 1),
  ]),
  L('Coffee', 'Kafa', 'drinks', [
    w('Kafa', 'Кафа', 'Coffee', 'KAH-fah'),
  ], [
    s('Crna kafa.', 'Black coffee.'),
    s('Volim kafu.', 'I love coffee.'),
  ], [
    q('"Kafa" means...', ['Tea', 'Coffee', 'Juice', 'Water'], 1),
    q('Bitter morning drink:', ['Mleko', 'Kafa', 'Čaj', 'Voda'], 1),
    q('How to ask for coffee?', ['Vodu, molim', 'Čaj, molim', 'Kafu, molim', 'Mleko, molim'], 2),
  ]),
  L('Tea', 'Čaj', 'drinks', [
    w('Čaj', 'Чај', 'Tea', 'chai'),
    w('Topao', 'Топао', 'Warm', 'TOH-pow'),
    w('Hladan', 'Хладан', 'Cold', 'HLAH-dahn'),
  ], [
    s('Topao čaj.', 'Warm tea.'),
    s('Hladan čaj.', 'Cold tea.'),
  ], [
    q('"Čaj" means...', ['Coffee', 'Tea', 'Water', 'Juice'], 1),
    q('"Topao" means...', ['Cold', 'Warm', 'Sweet', 'Sour'], 1),
    q('"Hladan" means...', ['Hot', 'Cold', 'Warm', 'New'], 1),
  ]),

  // ─── UNIT: Weather (Vreme) ───
  L('Sun', 'Sunce', 'weather', [
    w('Sunce', 'Сунце', 'Sun', 'SOON-tseh'),
    w('Lepo', 'Лепо', 'Beautiful / Nice', 'LEH-poh'),
  ], [
    s('Sunce sija.', 'The sun is shining.'),
    s('Danas je lepo.', 'Today is nice.'),
  ], [
    q('"Sunce" means...', ['Moon', 'Sun', 'Star', 'Cloud'], 1),
    q('"Lepo" means...', ['Bad', 'Beautiful / Nice', 'Cold', 'Wet'], 1),
    q('Yellow in the sky:', ['Mesec', 'Zvezde', 'Sunce', 'Oblak'], 2),
  ]),
  L('Rain', 'Kiša', 'weather', [
    w('Kiša', 'Киша', 'Rain', 'KEE-shah'),
    w('Oblačno', 'Облачно', 'Cloudy', 'OH-blach-noh'),
  ], [
    s('Pada kiša.', 'It is raining.'),
    s('Oblačno je danas.', 'It is cloudy today.'),
  ], [
    q('"Kiša" means...', ['Snow', 'Rain', 'Wind', 'Sun'], 1),
    q('"Oblačno" means...', ['Sunny', 'Cloudy', 'Snowy', 'Windy'], 1),
    q('Falls from clouds:', ['Sunce', 'Kiša', 'Vetar', 'Sneg'], 1),
  ]),
  L('Snow', 'Sneg', 'weather', [
    w('Sneg', 'Снег', 'Snow', 'snehg'),
    w('Hladno', 'Хладно', 'Cold', 'HLAHD-noh'),
    w('Zima', 'Зима', 'Winter', 'ZEE-mah'),
  ], [
    s('Pada sneg.', 'It is snowing.'),
    s('Zimi je hladno.', 'In winter it is cold.'),
  ], [
    q('"Sneg" means...', ['Rain', 'Snow', 'Wind', 'Sun'], 1),
    q('"Hladno" means...', ['Warm', 'Cold', 'Hot', 'Sweet'], 1),
    q('"Zima" is the season:', ['Spring', 'Summer', 'Autumn', 'Winter'], 3),
  ]),
  L('Wind', 'Vetar', 'weather', [
    w('Vetar', 'Ветар', 'Wind', 'VEH-tahr'),
    w('Toplo', 'Топло', 'Warm', 'TOH-ploh'),
    w('Leto', 'Лето', 'Summer', 'LEH-toh'),
  ], [
    s('Jak vetar.', 'A strong wind.'),
    s('Leti je toplo.', 'In summer it is warm.'),
  ], [
    q('"Vetar" means...', ['Rain', 'Wind', 'Snow', 'Sun'], 1),
    q('"Toplo" means...', ['Cold', 'Warm', 'Wet', 'Cloudy'], 1),
    q('"Leto" is the season:', ['Winter', 'Spring', 'Summer', 'Fall'], 2),
  ]),

  // ════════════════════════════════════════════════════════════════════════
  // SECTION 4 · DAILY LIFE (Svaki dan)
  // ════════════════════════════════════════════════════════════════════════

  // ─── UNIT: At Home (Kod kuće) ───
  L('House', 'Kuća', 'home', [
    w('Kuća', 'Кућа', 'House', 'KOO-chah'),
    w('Soba', 'Соба', 'Room', 'SOH-bah'),
  ], [
    s('Velika kuća.', 'A big house.'),
    s('Moja soba.', 'My room.'),
  ], [
    q('"Kuća" means...', ['Room', 'House', 'Door', 'Window'], 1),
    q('"Soba" means...', ['House', 'Room', 'Garden', 'Roof'], 1),
    q('You live in a...', ['Sto', 'Kuća', 'Krevet', 'Vrata'], 1),
  ]),
  L('Door & Window', 'Vrata i Prozor', 'home', [
    w('Vrata', 'Врата', 'Door', 'VRAH-tah'),
    w('Prozor', 'Прозор', 'Window', 'PROH-zor'),
  ], [
    s('Otvori vrata.', 'Open the door.'),
    s('Veliki prozor.', 'A big window.'),
  ], [
    q('"Vrata" means...', ['Window', 'Door', 'Wall', 'Floor'], 1),
    q('"Prozor" means...', ['Door', 'Window', 'Roof', 'Stairs'], 1),
    q('You enter through a...', ['Prozor', 'Vrata', 'Krevet', 'Sto'], 1),
  ]),
  L('Table & Chair', 'Sto i Stolica', 'home', [
    w('Sto', 'Сто', 'Table', 'stoh'),
    w('Stolica', 'Столица', 'Chair', 'STOH-lee-tsah'),
  ], [
    s('Sto je velik.', 'The table is big.'),
    s('Sedi na stolicu.', 'Sit on the chair.'),
  ], [
    q('"Sto" means...', ['Chair', 'Table', 'Bed', 'Door'], 1),
    q('"Stolica" means...', ['Table', 'Chair', 'Bed', 'Lamp'], 1),
    q('You sit on a...', ['Sto', 'Stolica', 'Krevet', 'Vrata'], 1),
  ]),
  L('Bed', 'Krevet', 'home', [
    w('Krevet', 'Кревет', 'Bed', 'KREH-veht'),
    w('Spavati', 'Спавати', 'To sleep', 'SPAH-vah-tee'),
  ], [
    s('Eren spava na krevetu.', 'Eren sleeps on the bed.'),
    s('Idem da spavam.', 'I am going to sleep.'),
  ], [
    q('"Krevet" means...', ['Chair', 'Bed', 'Table', 'Door'], 1),
    q('"Spavati" means...', ['To eat', 'To sleep', 'To run', 'To play'], 1),
    q('Sleep on a...', ['Sto', 'Stolica', 'Krevet', 'Prozor'], 2),
  ]),
  L('Kitchen', 'Kuhinja', 'home', [
    w('Kuhinja', 'Кухиња', 'Kitchen', 'KOO-hee-nyah'),
    w('Kupatilo', 'Купатило', 'Bathroom', 'KOO-pah-tee-loh'),
  ], [
    s('Kuhinja je čista.', 'The kitchen is clean.'),
    s('Idem u kupatilo.', 'I am going to the bathroom.'),
  ], [
    q('"Kuhinja" means...', ['Bedroom', 'Kitchen', 'Bathroom', 'Garden'], 1),
    q('"Kupatilo" means...', ['Kitchen', 'Bedroom', 'Bathroom', 'Living room'], 2),
    q('Where you cook:', ['Soba', 'Kuhinja', 'Kupatilo', 'Prozor'], 1),
  ]),

  // ─── UNIT: Days (Dani) ───
  L('Mon-Wed', 'Pon, Uto, Sre', 'days', [
    w('Ponedeljak', 'Понедељак', 'Monday', 'POH-neh-deh-lyahk'),
    w('Utorak', 'Уторак', 'Tuesday', 'OO-toh-rahk'),
    w('Sreda', 'Среда', 'Wednesday', 'SREH-dah'),
  ], [
    s('Danas je ponedeljak.', 'Today is Monday.'),
    s('Sutra je utorak.', 'Tomorrow is Tuesday.'),
  ], [
    q('"Ponedeljak" is...', ['Sunday', 'Monday', 'Tuesday', 'Friday'], 1),
    q('"Sreda" is...', ['Tuesday', 'Wednesday', 'Thursday', 'Saturday'], 1),
    q('After Monday comes...', ['Sreda', 'Utorak', 'Petak', 'Subota'], 1),
  ]),
  L('Thu & Fri', 'Čet i Pet', 'days', [
    w('Četvrtak', 'Четвртак', 'Thursday', 'CHEHT-vur-tahk'),
    w('Petak', 'Петак', 'Friday', 'PEH-tahk'),
  ], [
    s('Petak je lep dan.', 'Friday is a nice day.'),
    s('Vidimo se u četvrtak.', 'See you on Thursday.'),
  ], [
    q('"Četvrtak" is...', ['Wednesday', 'Thursday', 'Friday', 'Saturday'], 1),
    q('"Petak" is...', ['Friday', 'Saturday', 'Thursday', 'Sunday'], 0),
    q('Day before "Subota":', ['Četvrtak', 'Sreda', 'Petak', 'Nedelja'], 2),
  ]),
  L('Weekend', 'Vikend', 'days', [
    w('Subota', 'Субота', 'Saturday', 'SOO-boh-tah'),
    w('Nedelja', 'Недеља', 'Sunday', 'NEH-deh-lyah'),
    w('Vikend', 'Викенд', 'Weekend', 'VEE-kehnd'),
  ], [
    s('Subota je moj dan.', 'Saturday is my day.'),
    s('Lep vikend!', 'Have a nice weekend!'),
  ], [
    q('"Subota" is...', ['Friday', 'Saturday', 'Sunday', 'Monday'], 1),
    q('"Nedelja" is...', ['Saturday', 'Sunday', 'Week', 'All of those'], 3),
    q('"Vikend" means...', ['Workday', 'Weekend', 'Year', 'Hour'], 1),
  ]),
  L('Today & Tomorrow', 'Danas i Sutra', 'days', [
    w('Danas', 'Данас', 'Today', 'DAH-nahs'),
    w('Sutra', 'Сутра', 'Tomorrow', 'SOO-trah'),
    w('Juče', 'Јуче', 'Yesterday', 'YOO-cheh'),
    w('Dan', 'Дан', 'Day', 'dahn'),
  ], [
    s('Danas je lep dan.', 'Today is a nice day.'),
    s('Vidimo se sutra.', 'See you tomorrow.'),
  ], [
    q('"Danas" means...', ['Yesterday', 'Today', 'Tomorrow', 'Always'], 1),
    q('"Sutra" means...', ['Today', 'Tomorrow', 'Yesterday', 'Now'], 1),
    q('"Juče" means...', ['Today', 'Tomorrow', 'Yesterday', 'Soon'], 2),
  ]),

  // ─── UNIT: Verbs (Glagoli) ───
  L('To Be / Have', 'Biti / Imati', 'verbs', [
    w('Biti', 'Бити', 'To be', 'BEE-tee'),
    w('Imati', 'Имати', 'To have', 'EE-mah-tee'),
    w('Imam', 'Имам', 'I have', 'EE-mahm'),
  ], [
    s('Imam mačku.', 'I have a cat.'),
    s('Ja sam srećan.', 'I am happy.'),
  ], [
    q('"Biti" means...', ['To have', 'To be', 'To go', 'To eat'], 1),
    q('"Imati" means...', ['To want', 'To have', 'To love', 'To know'], 1),
    q('"Imam mačku" =', ['I want a cat', 'I have a cat', 'I see a cat', 'I am a cat'], 1),
  ]),
  L('To Go / Come', 'Ići / Doći', 'verbs', [
    w('Ići', 'Ићи', 'To go', 'EE-chee'),
    w('Doći', 'Доћи', 'To come', 'DOH-chee'),
    w('Idem', 'Идем', 'I go', 'EE-dem'),
  ], [
    s('Idem u park.', 'I am going to the park.'),
    s('Dođi ovamo!', 'Come here!'),
  ], [
    q('"Ići" means...', ['To come', 'To go', 'To stay', 'To run'], 1),
    q('"Doći" means...', ['To go', 'To come', 'To leave', 'To stop'], 1),
    q('"Idem" means...', ['I come', 'I go', 'I see', 'I run'], 1),
  ]),
  L('To Eat / Drink', 'Jesti / Piti', 'verbs', [
    w('Jesti', 'Јести', 'To eat', 'YEH-stee'),
    w('Piti', 'Пити', 'To drink', 'PEE-tee'),
    w('Pijem', 'Пијем', 'I drink', 'PEE-yem'),
  ], [
    s('Volim da jedem.', 'I love to eat.'),
    s('Pijem vodu.', 'I drink water.'),
  ], [
    q('"Jesti" means...', ['To drink', 'To eat', 'To sleep', 'To go'], 1),
    q('"Piti" means...', ['To eat', 'To drink', 'To love', 'To sleep'], 1),
    q('"Pijem" means...', ['I eat', 'I drink', 'I sleep', 'I work'], 1),
  ]),
  L('To Love / Want', 'Voleti / Želeti', 'verbs', [
    w('Voleti', 'Волети', 'To love', 'VOH-leh-tee'),
    w('Želeti', 'Желети', 'To want', 'ZHEH-leh-tee'),
    w('Volim', 'Волим', 'I love', 'VOH-leem'),
  ], [
    s('Volim Erena.', 'I love Eren.'),
    s('Želim vodu.', 'I want water.'),
  ], [
    q('"Voleti" means...', ['To want', 'To love', 'To know', 'To eat'], 1),
    q('"Želeti" means...', ['To love', 'To want', 'To need', 'To have'], 1),
    q('"Volim te" =', ['I see you', 'I love you', 'I know you', 'I help you'], 1),
  ]),
  L('To Sleep / Work', 'Spavati / Raditi', 'verbs', [
    w('Spavati', 'Спавати', 'To sleep', 'SPAH-vah-tee'),
    w('Raditi', 'Радити', 'To work', 'RAH-dee-tee'),
    w('Igrati', 'Играти', 'To play', 'EE-grah-tee'),
  ], [
    s('Eren voli da spava.', 'Eren loves to sleep.'),
    s('Tata radi.', 'Dad is working.'),
  ], [
    q('"Spavati" means...', ['To work', 'To sleep', 'To eat', 'To play'], 1),
    q('"Raditi" means...', ['To play', 'To work', 'To rest', 'To learn'], 1),
    q('"Igrati" means...', ['To sleep', 'To eat', 'To play', 'To work'], 2),
  ]),

  // ─── UNIT: Emotions (Emocije) ───
  L('Happy', 'Srećan', 'emotions', [
    w('Srećan', 'Срећан', 'Happy (m)', 'SREH-chan'),
    w('Srećna', 'Срећна', 'Happy (f)', 'SREH-chnah'),
  ], [
    s('Eren je srećan.', 'Eren is happy.'),
    s('Mama je srećna.', 'Mom is happy.'),
  ], [
    q('"Srećan" means...', ['Sad', 'Happy', 'Tired', 'Angry'], 1),
    q('Use "Srećna" for...', ['Boys', 'Girls', 'Animals', 'Numbers'], 1),
    q('A happy cat is...', ['Tužan', 'Srećan', 'Ljut', 'Umoran'], 1),
  ]),
  L('Sad & Angry', 'Tužan i Ljut', 'emotions', [
    w('Tužan', 'Тужан', 'Sad', 'TOO-zhahn'),
    w('Ljut', 'Љут', 'Angry', 'lyoot'),
  ], [
    s('Eren je tužan.', 'Eren is sad.'),
    s('Tata je ljut.', 'Dad is angry.'),
  ], [
    q('"Tužan" means...', ['Happy', 'Sad', 'Tired', 'Angry'], 1),
    q('"Ljut" means...', ['Calm', 'Angry', 'Tired', 'Hungry'], 1),
    q('Opposite of "Srećan":', ['Lep', 'Tužan', 'Mali', 'Brz'], 1),
  ]),
  L('Tired & Hungry', 'Umoran i Gladan', 'emotions', [
    w('Umoran', 'Уморан', 'Tired', 'OO-moh-rahn'),
    w('Gladan', 'Гладан', 'Hungry', 'GLAH-dahn'),
  ], [
    s('Ja sam umoran.', 'I am tired.'),
    s('Mačka je gladna.', 'The cat is hungry.'),
  ], [
    q('"Umoran" means...', ['Hungry', 'Tired', 'Awake', 'Bored'], 1),
    q('"Gladan" means...', ['Tired', 'Hungry', 'Thirsty', 'Cold'], 1),
    q('Eren wants food when...', ['Umoran', 'Gladan', 'Žedan', 'Srećan'], 1),
  ]),
  L('Thirsty & Scared', 'Žedan i Uplašen', 'emotions', [
    w('Žedan', 'Жедан', 'Thirsty', 'ZHEH-dahn'),
    w('Uplašen', 'Уплашен', 'Scared', 'OO-plah-shehn'),
    w('Uzbuđen', 'Узбуђен', 'Excited', 'ooz-BOO-jehn'),
  ], [
    s('Žedan sam.', 'I am thirsty.'),
    s('Uplašen pas.', 'A scared dog.'),
  ], [
    q('"Žedan" means...', ['Hungry', 'Thirsty', 'Tired', 'Sad'], 1),
    q('"Uplašen" means...', ['Excited', 'Scared', 'Surprised', 'Angry'], 1),
    q('"Uzbuđen" means...', ['Tired', 'Excited', 'Hungry', 'Calm'], 1),
  ]),

  // ─── UNIT: Shopping (Kupovina) ───
  L('Store & Money', 'Prodavnica i Novac', 'shop', [
    w('Prodavnica', 'Продавница', 'Store', 'proh-DAHV-nee-tsah'),
    w('Novac', 'Новац', 'Money', 'NOH-vahts'),
  ], [
    s('Idem u prodavnicu.', 'I am going to the store.'),
    s('Treba mi novac.', 'I need money.'),
  ], [
    q('"Prodavnica" means...', ['Bank', 'Store', 'School', 'Park'], 1),
    q('"Novac" means...', ['Card', 'Money', 'Time', 'Help'], 1),
    q('Buy with...', ['Hleb', 'Novac', 'Voda', 'Sir'], 1),
  ]),
  L('How Much?', 'Koliko?', 'shop', [
    w('Koliko', 'Колико', 'How much', 'KOH-lee-koh'),
    w('Cena', 'Цена', 'Price', 'TSEH-nah'),
    w('Skupo', 'Скупо', 'Expensive', 'SKOO-poh'),
  ], [
    s('Koliko košta?', 'How much does it cost?'),
    s('To je skupo.', 'That is expensive.'),
  ], [
    q('"Koliko" means...', ['Where', 'How much', 'Why', 'When'], 1),
    q('"Cena" means...', ['Money', 'Price', 'Sale', 'Tax'], 1),
    q('"Skupo" means...', ['Cheap', 'Expensive', 'Free', 'Used'], 1),
  ]),
  L('Cheap & Bill', 'Jeftino i Račun', 'shop', [
    w('Jeftino', 'Јефтино', 'Cheap', 'YEHF-tee-noh'),
    w('Račun', 'Рачун', 'Bill / Receipt', 'RAH-choon'),
  ], [
    s('Ovo je jeftino.', 'This is cheap.'),
    s('Račun, molim.', 'The bill, please.'),
  ], [
    q('"Jeftino" means...', ['Expensive', 'Cheap', 'Big', 'Old'], 1),
    q('"Račun" means...', ['Money', 'Card', 'Bill / Receipt', 'List'], 2),
    q('Opposite of "skupo":', ['Lepo', 'Veliko', 'Jeftino', 'Toplo'], 2),
  ]),

  // ─── UNIT: Phrases (Fraze) ───
  L('Understand', 'Razumem', 'phrases', [
    w('Razumem', 'Разумем', 'I understand', 'RAH-zoo-mem'),
    w('Ne razumem', 'Не разумем', 'I don\'t understand', 'neh RAH-zoo-mem'),
  ], [
    s('Razumem te.', 'I understand you.'),
    s('Izvini, ne razumem.', 'Sorry, I don\'t understand.'),
  ], [
    q('"Razumem" means...', ['I know', 'I understand', 'I see', 'I hear'], 1),
    q('"Ne razumem" means...', ['I know', 'I understand', 'I don\'t understand', 'I disagree'], 2),
    q('Polite "I don\'t get it":', ['Hvala', 'Ne razumem', 'Da', 'Doviđenja'], 1),
  ]),
  L('Help', 'Pomoć', 'phrases', [
    w('Pomozite!', 'Помозите!', 'Help!', 'POH-moh-zee-teh'),
    w('Pomoć', 'Помоћ', 'Help', 'POH-mohch'),
  ], [
    s('Pomozite, molim!', 'Help, please!'),
    s('Treba mi pomoć.', 'I need help.'),
  ], [
    q('"Pomozite" means...', ['Stop', 'Help', 'Wait', 'Go'], 1),
    q('"Pomoć" means...', ['Stop', 'Help', 'Time', 'End'], 1),
    q('In emergency say...', ['Hvala', 'Doviđenja', 'Pomozite', 'Da'], 2),
  ]),
  L('Speak English?', 'Govorite li engleski?', 'phrases', [
    w('Govoriti', 'Говорити', 'To speak', 'goh-VOH-ree-tee'),
    w('Engleski', 'Енглески', 'English', 'ehn-GLEH-skee'),
    w('Srpski', 'Српски', 'Serbian', 'SUR-pskee'),
  ], [
    s('Govorite li engleski?', 'Do you speak English?'),
    s('Učim srpski.', 'I am learning Serbian.'),
  ], [
    q('"Govoriti" means...', ['To hear', 'To speak', 'To read', 'To write'], 1),
    q('"Engleski" means...', ['Spanish', 'English', 'German', 'French'], 1),
    q('"Srpski" means...', ['Russian', 'Croatian', 'Serbian', 'Slovak'], 2),
  ]),
  L('No Problem', 'Nema problema', 'phrases', [
    w('Nema problema', 'Нема проблема', 'No problem', 'NEH-mah proh-BLEH-mah'),
    w('U redu', 'У реду', 'Okay', 'oo REH-doo'),
  ], [
    s('Nema problema!', 'No problem!'),
    s('U redu, hvala.', 'Okay, thanks.'),
  ], [
    q('"Nema problema" means...', ['Big problem', 'No problem', 'Maybe', 'Yes'], 1),
    q('"U redu" means...', ['Stop', 'Okay', 'Sorry', 'Goodbye'], 1),
    q('Reply to "thanks":', ['Doviđenja', 'Nema problema / U redu', 'Da', 'Ne'], 1),
  ]),

  // ════════════════════════════════════════════════════════════════════════
  // SECTION 5 · GOING OUT (Izlazak)
  // ════════════════════════════════════════════════════════════════════════

  // ─── UNIT: Time (Vreme) ───
  L('What Time?', 'Koliko je sati?', 'time', [
    w('Sat', 'Сат', 'Hour / Clock', 'saht'),
    w('Koliko je sati?', 'Колико је сати?', 'What time is it?', 'KOH-lee-koh yeh SAH-tee'),
  ], [
    s('Koliko je sati?', 'What time is it?'),
    s('Šest sati.', 'Six o\'clock.'),
  ], [
    q('"Sat" means...', ['Hour / Clock', 'Year', 'Week', 'Minute'], 0),
    q('Asking the time:', ['Kako se zoveš?', 'Koliko je sati?', 'Odakle si?', 'Kako si?'], 1),
    q('"Šest sati" means...', ['Six years', 'Six o\'clock', 'Six days', 'Six months'], 1),
  ]),
  L('Minute & Second', 'Minut i Sekunda', 'time', [
    w('Minut', 'Минут', 'Minute', 'MEE-noot'),
    w('Sekunda', 'Секунда', 'Second', 'SEH-koon-dah'),
  ], [
    s('Sačekaj minut.', 'Wait a minute.'),
    s('Pet sekundi.', 'Five seconds.'),
  ], [
    q('"Minut" means...', ['Hour', 'Minute', 'Second', 'Day'], 1),
    q('"Sekunda" means...', ['Minute', 'Second', 'Hour', 'Year'], 1),
    q('60 seconds make a...', ['Sat', 'Minut', 'Dan', 'Sekunda'], 1),
  ]),
  L('Now & Later', 'Sada i Kasnije', 'time', [
    w('Sada', 'Сада', 'Now', 'SAH-dah'),
    w('Kasnije', 'Касније', 'Later', 'KAH-snee-yeh'),
  ], [
    s('Idemo sada.', 'Let\'s go now.'),
    s('Vidimo se kasnije.', 'See you later.'),
  ], [
    q('"Sada" means...', ['Later', 'Now', 'Soon', 'Then'], 1),
    q('"Kasnije" means...', ['Now', 'Later', 'Yesterday', 'Today'], 1),
    q('Opposite of "sada":', ['Danas', 'Kasnije', 'Sutra', 'Juče'], 1),
  ]),
  L('Early & Late', 'Rano i Kasno', 'time', [
    w('Rano', 'Рано', 'Early', 'RAH-noh'),
    w('Kasno', 'Касно', 'Late', 'KAHS-noh'),
  ], [
    s('Ustajem rano.', 'I get up early.'),
    s('Kasno je.', 'It is late.'),
  ], [
    q('"Rano" means...', ['Late', 'Early', 'Soon', 'Now'], 1),
    q('"Kasno" means...', ['Early', 'Late', 'Soon', 'Then'], 1),
    q('Going to bed at midnight is...', ['Rano', 'Kasno', 'Sada', 'Sutra'], 1),
  ]),

  // ─── UNIT: Around Town (Po gradu) ───
  L('Directions', 'Pravac', 'town', [
    w('Levo', 'Лево', 'Left', 'LEH-voh'),
    w('Desno', 'Десно', 'Right', 'DEHS-noh'),
    w('Pravo', 'Право', 'Straight', 'PRAH-voh'),
  ], [
    s('Idi levo.', 'Go left.'),
    s('Pravo, pa desno.', 'Straight, then right.'),
  ], [
    q('"Levo" means...', ['Right', 'Left', 'Up', 'Down'], 1),
    q('"Desno" means...', ['Left', 'Right', 'Front', 'Back'], 1),
    q('"Pravo" means...', ['Straight', 'Around', 'Up', 'Stop'], 0),
  ]),
  L('Places', 'Mesta', 'town', [
    w('Park', 'Парк', 'Park', 'pahrk'),
    w('Škola', 'Школа', 'School', 'SHKOH-lah'),
    w('Bolnica', 'Болница', 'Hospital', 'BOHL-nee-tsah'),
  ], [
    s('Idem u park.', 'I am going to the park.'),
    s('Škola je velika.', 'The school is big.'),
  ], [
    q('"Park" means...', ['Park', 'Office', 'Garden', 'Yard'], 0),
    q('"Škola" means...', ['House', 'School', 'Hospital', 'Church'], 1),
    q('"Bolnica" means...', ['Bank', 'School', 'Hospital', 'Library'], 2),
  ]),
  L('Transport', 'Prevoz', 'town', [
    w('Auto', 'Ауто', 'Car', 'OW-toh'),
    w('Autobus', 'Аутобус', 'Bus', 'OW-toh-boos'),
    w('Voz', 'Воз', 'Train', 'voz'),
  ], [
    s('Crveni auto.', 'A red car.'),
    s('Voz dolazi.', 'The train is coming.'),
  ], [
    q('"Auto" means...', ['Bike', 'Bus', 'Car', 'Truck'], 2),
    q('"Autobus" means...', ['Train', 'Bus', 'Plane', 'Boat'], 1),
    q('"Voz" means...', ['Car', 'Bus', 'Train', 'Bike'], 2),
  ]),
  L('Where?', 'Gde?', 'town', [
    w('Gde', 'Где', 'Where', 'gdeh'),
    w('Ovde', 'Овде', 'Here', 'OHV-deh'),
    w('Tamo', 'Тамо', 'There', 'TAH-moh'),
  ], [
    s('Gde si?', 'Where are you?'),
    s('Tamo je park.', 'The park is there.'),
  ], [
    q('"Gde" means...', ['When', 'Where', 'Why', 'How'], 1),
    q('"Ovde" means...', ['There', 'Here', 'Where', 'Inside'], 1),
    q('"Tamo" means...', ['Here', 'There', 'Now', 'Then'], 1),
  ]),

  // ─── UNIT: At the Café (U kafiću) ───
  L('Order', 'Naručivanje', 'cafe', [
    w('Naručiti', 'Наручити', 'To order', 'nah-ROO-chee-tee'),
    w('Želim', 'Желим', 'I want', 'ZHEH-leem'),
  ], [
    s('Želim kafu, molim.', 'I want a coffee, please.'),
    s('Šta želite?', 'What would you like?'),
  ], [
    q('"Naručiti" means...', ['To eat', 'To order', 'To pay', 'To leave'], 1),
    q('"Želim" means...', ['I have', 'I love', 'I want', 'I see'], 2),
    q('To order food say...', ['Doviđenja', 'Želim...', 'Hvala', 'Da'], 1),
  ]),
  L('Menu', 'Jelovnik', 'cafe', [
    w('Jelovnik', 'Јеловник', 'Menu', 'YEH-lov-neek'),
    w('Konobar', 'Конобар', 'Waiter', 'KOH-noh-bahr'),
  ], [
    s('Jelovnik, molim.', 'The menu, please.'),
    s('Konobar dolazi.', 'The waiter is coming.'),
  ], [
    q('"Jelovnik" means...', ['Bill', 'Menu', 'Tip', 'Plate'], 1),
    q('"Konobar" means...', ['Cook', 'Waiter', 'Owner', 'Customer'], 1),
    q('Ask for the menu:', ['Račun, molim', 'Jelovnik, molim', 'Voda, molim', 'Hvala'], 1),
  ]),
  L('Polite Forms', 'Učtivo obraćanje', 'cafe', [
    w('Molim vas', 'Молим вас', 'Please (formal)', 'MOH-leem vahs'),
    w('Hvala vam', 'Хвала вам', 'Thank you (formal)', 'HVAH-lah vahm'),
  ], [
    s('Molim vas, čaj.', 'Please, tea.'),
    s('Hvala vam puno!', 'Thank you very much!'),
  ], [
    q('"Molim vas" is...', ['Casual please', 'Formal please', 'Sorry', 'Hello'], 1),
    q('"Hvala vam" is...', ['Casual thanks', 'Formal thanks', 'Greeting', 'Apology'], 1),
    q('Used with strangers / elders:', ['Molim te', 'Molim vas', 'Hej', 'Ćao'], 1),
  ]),
  L('Pay', 'Plaćanje', 'cafe', [
    w('Platiti', 'Платити', 'To pay', 'PLAH-tee-tee'),
    w('Kartica', 'Картица', 'Card', 'KAR-tee-tsah'),
    w('Gotovina', 'Готовина', 'Cash', 'goh-TOH-vee-nah'),
  ], [
    s('Mogu li da platim?', 'Can I pay?'),
    s('Karticom ili gotovinom?', 'By card or cash?'),
  ], [
    q('"Platiti" means...', ['To pay', 'To eat', 'To leave', 'To order'], 0),
    q('"Kartica" means...', ['Cash', 'Card', 'Bill', 'Receipt'], 1),
    q('"Gotovina" means...', ['Card', 'Cash', 'Tip', 'Coin'], 1),
  ]),

  // ─── UNIT: Bigger Numbers (Veći brojevi) ───
  L('11-13', '11-13', 'numbers-big', [
    w('Jedanaest', 'Једанаест', '11', 'YEH-dah-nah-est'),
    w('Dvanaest', 'Дванаест', '12', 'DVAH-nah-est'),
    w('Trinaest', 'Тринаест', '13', 'TREE-nah-est'),
  ], [
    s('Imam dvanaest godina.', 'I am twelve years old.'),
    s('Trinaest mačaka!', 'Thirteen cats!'),
  ], [
    q('"Jedanaest" is...', ['10', '11', '12', '13'], 1),
    q('"Dvanaest" is...', ['11', '12', '13', '14'], 1),
    q('"Trinaest" is...', ['12', '13', '14', '15'], 1),
  ]),
  L('14-17', '14-17', 'numbers-big', [
    w('Četrnaest', 'Четрнаест', '14', 'CHEH-tur-nah-est'),
    w('Petnaest', 'Петнаест', '15', 'PET-nah-est'),
    w('Šesnaest', 'Шеснаест', '16', 'SHES-nah-est'),
    w('Sedamnaest', 'Седамнаест', '17', 'SEH-dahm-nah-est'),
  ], [
    s('Petnaest minuta.', 'Fifteen minutes.'),
    s('Sedamnaest godina.', 'Seventeen years.'),
  ], [
    q('"Petnaest" is...', ['14', '15', '16', '17'], 1),
    q('"Šesnaest" is...', ['15', '16', '17', '18'], 1),
    q('"Sedamnaest" is...', ['16', '17', '18', '19'], 1),
  ]),
  L('20-50', '20-50', 'numbers-big', [
    w('Dvadeset', 'Двадесет', '20', 'DVAH-deh-seht'),
    w('Trideset', 'Тридесет', '30', 'TREE-deh-seht'),
    w('Pedeset', 'Педесет', '50', 'PEH-deh-seht'),
  ], [
    s('Dvadeset prijatelja.', 'Twenty friends.'),
    s('Pedeset eura.', 'Fifty euros.'),
  ], [
    q('"Dvadeset" is...', ['10', '15', '20', '25'], 2),
    q('"Trideset" is...', ['20', '30', '40', '50'], 1),
    q('"Pedeset" is...', ['40', '50', '60', '70'], 1),
  ]),
  L('100 & 1000', '100 i 1000', 'numbers-big', [
    w('Sto', 'Сто', '100', 'stoh'),
    w('Hiljada', 'Хиљада', '1000', 'HEE-lyah-dah'),
  ], [
    s('Sto eura.', 'A hundred euros.'),
    s('Hiljada zvezda.', 'A thousand stars.'),
  ], [
    q('"Sto" as a number is...', ['10', '50', '100', '1000'], 2),
    q('"Hiljada" is...', ['100', '500', '1000', '10000'], 2),
    q('A hundred is...', ['Pet', 'Sto', 'Hiljada', 'Deset'], 1),
  ]),

  // ─── UNIT: Conjugations (Konjugacije) ───
  L('To Be · Singular', 'Biti — jednina', 'conjug', [
    w('Ja sam', 'Ја сам', 'I am', 'yah sahm'),
    w('Ti si', 'Ти си', 'You are', 'tee see'),
    w('On je', 'Он је', 'He is', 'ohn yeh'),
  ], [
    s('Ja sam Eren.', 'I am Eren.'),
    s('Ti si lep.', 'You are nice.'),
    s('On je mačak.', 'He is a cat.'),
  ], [
    q('"Ja sam" means...', ['I have', 'I am', 'I go', 'I want'], 1),
    q('"Ti si" means...', ['I am', 'You are', 'He is', 'We are'], 1),
    q('"On je" means...', ['She is', 'He is', 'It is', 'They are'], 1),
  ]),
  L('To Be · Plural', 'Biti — množina', 'conjug', [
    w('Mi smo', 'Ми смо', 'We are', 'mee smoh'),
    w('Vi ste', 'Ви сте', 'You all are', 'vee steh'),
    w('Oni su', 'Они су', 'They are', 'OH-nee soo'),
  ], [
    s('Mi smo prijatelji.', 'We are friends.'),
    s('Oni su mačke.', 'They are cats.'),
  ], [
    q('"Mi smo" means...', ['I am', 'You are', 'We are', 'They are'], 2),
    q('"Vi ste" means...', ['I am', 'You all are', 'They are', 'We are'], 1),
    q('"Oni su" means...', ['They are', 'We are', 'You are', 'He is'], 0),
  ]),
  L('To Have', 'Imati', 'conjug', [
    w('Imam', 'Имам', 'I have', 'EE-mahm'),
    w('Imaš', 'Имаш', 'You have', 'EE-mash'),
    w('Ima', 'Има', 'He / She has', 'EE-mah'),
  ], [
    s('Imam mačku.', 'I have a cat.'),
    s('Imaš li vode?', 'Do you have water?'),
    s('Eren ima ribu.', 'Eren has a fish.'),
  ], [
    q('"Imam" means...', ['I am', 'I have', 'I want', 'I go'], 1),
    q('"Imaš" means...', ['I have', 'You have', 'They have', 'We have'], 1),
    q('"Ima" goes with...', ['Ja', 'Ti', 'On / Ona', 'Mi'], 2),
  ]),
  L('To Want', 'Hteti', 'conjug', [
    w('Hoću', 'Хоћу', 'I want', 'HOH-choo'),
    w('Hoćeš', 'Хоћеш', 'You want', 'HOH-chesh'),
    w('Hoće', 'Хоће', 'He / She wants', 'HOH-cheh'),
  ], [
    s('Hoću mleko.', 'I want milk.'),
    s('Hoćeš li čaj?', 'Do you want tea?'),
  ], [
    q('"Hoću" means...', ['I have', 'I want', 'I love', 'I am'], 1),
    q('"Hoćeš" goes with...', ['Ja', 'Ti', 'On', 'Mi'], 1),
    q('"Hoće" means...', ['I want', 'You want', 'He/She wants', 'They want'], 2),
  ]),
  L('To Go', 'Ići', 'conjug', [
    w('Idem', 'Идем', 'I go', 'EE-dem'),
    w('Ideš', 'Идеш', 'You go', 'EE-desh'),
    w('Ide', 'Иде', 'He / She goes', 'EE-deh'),
  ], [
    s('Idem u park.', 'I am going to the park.'),
    s('Kuda ideš?', 'Where are you going?'),
    s('Eren ide kući.', 'Eren is going home.'),
  ], [
    q('"Idem" means...', ['I have', 'I go', 'I want', 'I see'], 1),
    q('"Ideš" goes with...', ['Ja', 'Ti', 'On', 'Mi'], 1),
    q('"Ide" means...', ['I go', 'You go', 'He/She goes', 'They go'], 2),
  ]),
]

// ═══════════════════════════════════════════════════════════════════════════
// SECTIONS & UNITS — the visual hierarchy on the course map
// ═══════════════════════════════════════════════════════════════════════════

export interface Unit {
  id: string
  title: string
  titleSr: string
  description: string
  color: string
  edgeColor: string
  lessonIds: number[]
}

export interface Section {
  id: string
  title: string
  titleSr: string
  description: string
  unitIds: string[]
  themeColor: string
  themeEdge: string
}

export const SERBIAN_UNITS: Unit[] = [
  // Section 1
  { id: 'u-hello',   title: 'Hello!',          titleSr: 'Pozdrav',     description: 'Greetings, hi & bye.',    color: '#A78BFA', edgeColor: '#4C1D95', lessonIds: [1, 2, 3, 4] },
  { id: 'u-manners', title: 'Manners',         titleSr: 'Ljubaznost',  description: 'Thanks, please, sorry.',  color: '#F472B6', edgeColor: '#9D174D', lessonIds: [5, 6, 7, 8] },
  { id: 'u-meyou',   title: 'Me & You',        titleSr: 'Ja i Ti',     description: 'I, you, he, she, we.',    color: '#34D399', edgeColor: '#065F46', lessonIds: [9, 10, 11, 12] },
  { id: 'u-names',   title: 'Names',           titleSr: 'Imena',       description: 'Introduce yourself.',     color: '#FBBF24', edgeColor: '#92400E', lessonIds: [13, 14, 15, 16] },
  // Section 2
  { id: 'u-num1',    title: '1 to 5',          titleSr: 'Brojevi 1-5', description: 'Counting low.',           color: '#60A5FA', edgeColor: '#1E40AF', lessonIds: [17, 18, 19] },
  { id: 'u-num2',    title: '6 to 10',         titleSr: 'Brojevi 6-10',description: 'Counting up.',            color: '#3B82F6', edgeColor: '#1E3A8A', lessonIds: [20, 21, 22] },
  { id: 'u-fam',     title: 'Family',          titleSr: 'Porodica',    description: 'Family members.',         color: '#F87171', edgeColor: '#7F1D1D', lessonIds: [23, 24, 25, 26] },
  { id: 'u-body',    title: 'Body',            titleSr: 'Telo',        description: 'Body parts.',             color: '#FB923C', edgeColor: '#9A3412', lessonIds: [27, 28, 29, 30] },
  // Section 3
  { id: 'u-color',   title: 'Colors',          titleSr: 'Boje',        description: 'Basic colors.',           color: '#A78BFA', edgeColor: '#5B21B6', lessonIds: [31, 32, 33, 34] },
  { id: 'u-anim',    title: 'Animals',         titleSr: 'Životinje',   description: 'Pets and farm.',          color: '#10B981', edgeColor: '#064E3B', lessonIds: [35, 36, 37, 38] },
  { id: 'u-food',    title: 'Food',            titleSr: 'Hrana',       description: 'Bread, meat, fruit.',     color: '#F59E0B', edgeColor: '#78350F', lessonIds: [39, 40, 41, 42] },
  { id: 'u-drink',   title: 'Drinks',          titleSr: 'Pića',        description: 'Water, milk, coffee.',    color: '#06B6D4', edgeColor: '#155E75', lessonIds: [43, 44, 45, 46] },
  { id: 'u-weather', title: 'Weather',         titleSr: 'Vreme',       description: 'Sun, rain, snow.',        color: '#0EA5E9', edgeColor: '#0C4A6E', lessonIds: [47, 48, 49, 50] },
  // Section 4
  { id: 'u-home',    title: 'At Home',         titleSr: 'Kod kuće',    description: 'House and rooms.',        color: '#EC4899', edgeColor: '#831843', lessonIds: [51, 52, 53, 54, 55] },
  { id: 'u-days',    title: 'Days of the Week',titleSr: 'Dani',        description: 'Mon, Tue, Wed…',          color: '#8B5CF6', edgeColor: '#4C1D95', lessonIds: [56, 57, 58, 59] },
  { id: 'u-verbs',   title: 'Verbs',           titleSr: 'Glagoli',     description: 'Common actions.',         color: '#F43F5E', edgeColor: '#881337', lessonIds: [60, 61, 62, 63, 64] },
  { id: 'u-emo',     title: 'Emotions',        titleSr: 'Emocije',     description: 'Happy, sad, tired.',      color: '#FB7185', edgeColor: '#9F1239', lessonIds: [65, 66, 67, 68] },
  { id: 'u-shop',    title: 'Shopping',        titleSr: 'Kupovina',    description: 'Store and prices.',       color: '#FBBF24', edgeColor: '#B45309', lessonIds: [69, 70, 71] },
  { id: 'u-phr',     title: 'Phrases',         titleSr: 'Fraze',       description: 'Useful expressions.',     color: '#22D3EE', edgeColor: '#0E7490', lessonIds: [72, 73, 74, 75] },
  // Section 5
  { id: 'u-time',    title: 'Telling Time',    titleSr: 'Vreme',       description: 'Hours, minutes, now & later.', color: '#FACC15', edgeColor: '#854D0E', lessonIds: [76, 77, 78, 79] },
  { id: 'u-town',    title: 'Around Town',     titleSr: 'Po gradu',    description: 'Directions and places.',  color: '#22C55E', edgeColor: '#14532D', lessonIds: [80, 81, 82, 83] },
  { id: 'u-cafe',    title: 'At the Café',     titleSr: 'U kafiću',    description: 'Order, pay, be polite.',  color: '#F59E0B', edgeColor: '#7C2D12', lessonIds: [84, 85, 86, 87] },
  { id: 'u-bigNum',  title: 'Bigger Numbers',  titleSr: 'Veći brojevi',description: '11 to 1000.',             color: '#06B6D4', edgeColor: '#155E75', lessonIds: [88, 89, 90, 91] },
  { id: 'u-conjug',  title: 'Conjugations',    titleSr: 'Konjugacije', description: 'Verbs across persons.',   color: '#EF4444', edgeColor: '#7F1D1D', lessonIds: [92, 93, 94, 95, 96] },
]

export const SERBIAN_SECTIONS: Section[] = [
  {
    id: 'sec-1', title: 'Starting Out', titleSr: 'Početak',
    description: 'Greetings, manners, and your first words.',
    themeColor: '#A78BFA', themeEdge: '#4C1D95',
    unitIds: ['u-hello', 'u-manners', 'u-meyou', 'u-names'],
  },
  {
    id: 'sec-2', title: 'Numbers & People', titleSr: 'Brojevi i Ljudi',
    description: 'Count to ten, name your family.',
    themeColor: '#60A5FA', themeEdge: '#1E40AF',
    unitIds: ['u-num1', 'u-num2', 'u-fam', 'u-body'],
  },
  {
    id: 'sec-3', title: 'World Around You', titleSr: 'Svet oko tebe',
    description: 'Colors, animals, food, weather.',
    themeColor: '#10B981', themeEdge: '#064E3B',
    unitIds: ['u-color', 'u-anim', 'u-food', 'u-drink', 'u-weather'],
  },
  {
    id: 'sec-4', title: 'Daily Life', titleSr: 'Svaki dan',
    description: 'Home, days, verbs, emotions, shopping, phrases.',
    themeColor: '#EC4899', themeEdge: '#831843',
    unitIds: ['u-home', 'u-days', 'u-verbs', 'u-emo', 'u-shop', 'u-phr'],
  },
  {
    id: 'sec-5', title: 'Going Out', titleSr: 'Izlazak',
    description: 'Time, navigation, café manners, big numbers, verb forms.',
    themeColor: '#FACC15', themeEdge: '#854D0E',
    unitIds: ['u-time', 'u-town', 'u-cafe', 'u-bigNum', 'u-conjug'],
  },
]

// Flat ordered list of every lesson id, walking sections → units in order.
// Used to compute "is lesson N unlocked" by checking the previous one.
export const ORDERED_LESSON_IDS: number[] =
  SERBIAN_SECTIONS.flatMap(sec =>
    sec.unitIds.flatMap(uid => SERBIAN_UNITS.find(u => u.id === uid)!.lessonIds)
  )

// ─── Compatibility helpers ─────────────────────────────────────────────────
export function getTodaysLesson(): Lesson {
  const day = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000)
  return SERBIAN_COURSE[day % SERBIAN_COURSE.length]
}
export function getLessonById(id: number): Lesson | undefined {
  return SERBIAN_COURSE.find(l => l.id === id)
}
export function getUnitById(id: string): Unit | undefined {
  return SERBIAN_UNITS.find(u => u.id === id)
}
export function getSectionForUnit(unitId: string): Section | undefined {
  return SERBIAN_SECTIONS.find(s => s.unitIds.includes(unitId))
}

// ═══════════════════════════════════════════════════════════════════════════
// EXERCISE TYPES & GENERATION (unchanged from prior version)
// ═══════════════════════════════════════════════════════════════════════════

export type Exercise =
  | { kind: 'mc'; promptLang: 'sr' | 'en'; prompt: string; answer: string; options: string[]; pronunciation?: string; srKey?: string }
  | { kind: 'pairs'; pairs: { sr: string; en: string }[] }
  | { kind: 'order'; english: string; sr: string; tiles: string[] }
  // Listen — TTS plays the Serbian word, the player picks the matching written
  // Serbian form from 4 options. Tests phoneme recognition specifically (a
  // skill the other exercise types don't really exercise).
  | { kind: 'listen'; sr: string; en: string; options: string[]; pronunciation?: string }

export interface WordStat {
  sr: string
  en: string
  lessonId: number
  attempts: number
  correct: number
  lastWrongAt?: number
}
export type WordStats = Record<string, WordStat>

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function buildExercises(lesson: Lesson): Exercise[] {
  const list: Exercise[] = []
  const words = lesson.words

  const allOtherSr = SERBIAN_COURSE
    .filter(l => l.id !== lesson.id)
    .flatMap(l => l.words.map(w => w.serbian))
  const allOtherEn = SERBIAN_COURSE
    .filter(l => l.id !== lesson.id)
    .flatMap(l => l.words.map(w => w.english))

  // Pairs warm-up — only if there are enough words for it to make sense.
  if (words.length >= 3) {
    const subset = shuffle(words).slice(0, Math.min(5, words.length))
    list.push({ kind: 'pairs', pairs: subset.map(w => ({ sr: w.serbian, en: w.english })) })
  }

  // Translate sr → en — for every word at least once.
  for (const wd of shuffle(words)) {
    const sameLessonDistractors = shuffle(words.filter(x => x.serbian !== wd.serbian).map(x => x.english))
    const externalDistractors = shuffle(allOtherEn.filter(e => e !== wd.english))
    const distractors = shuffle([...sameLessonDistractors, ...externalDistractors]).slice(0, 3)
    list.push({
      kind: 'mc', promptLang: 'sr', prompt: wd.serbian, answer: wd.english,
      options: shuffle([wd.english, ...distractors]),
      pronunciation: wd.pronunciation,
      srKey: wd.serbian,
    })
  }

  // Translate en → sr — for every word.
  for (const wd of shuffle(words)) {
    const sameLessonDistractors = shuffle(words.filter(x => x.serbian !== wd.serbian).map(x => x.serbian))
    const externalDistractors = shuffle(allOtherSr.filter(s => s !== wd.serbian))
    const distractors = shuffle([...sameLessonDistractors, ...externalDistractors]).slice(0, 3)
    list.push({
      kind: 'mc', promptLang: 'en', prompt: wd.english, answer: wd.serbian,
      options: shuffle([wd.serbian, ...distractors]),
      srKey: wd.serbian,
    })
  }

  // Listen exercises — pick 1-2 single-token words (phrases like "Ja sam"
  // can also work but read more like a sentence). Distractors are other
  // Serbian forms with similar length so it tests audible recognition,
  // not just spelling distinctness.
  const listenWords = words.filter(wd => !wd.serbian.includes(' '))
  for (const wd of shuffle(listenWords).slice(0, Math.min(2, listenWords.length))) {
    const distractors = shuffle(allOtherSr.filter(s2 => s2 !== wd.serbian && !s2.includes(' '))).slice(0, 3)
    list.push({
      kind: 'listen',
      sr: wd.serbian,
      en: wd.english,
      options: shuffle([wd.serbian, ...distractors]),
      pronunciation: wd.pronunciation,
    })
  }

  // Word order from sentences.
  for (const sent of lesson.sentences) {
    const cleanWords = sent.serbian
      .split(/\s+/)
      .map(wd => wd.replace(/[.,!?]+$/g, ''))
      .filter(Boolean)
    if (cleanWords.length < 2) continue
    const distractorPool = allOtherSr.filter(d => !cleanWords.includes(d) && !d.includes(' '))
    const distractors = shuffle(distractorPool).slice(0, Math.min(2, Math.max(1, 4 - cleanWords.length)))
    list.push({
      kind: 'order',
      english: sent.english,
      sr: cleanWords.join(' '),
      tiles: shuffle([...cleanWords, ...distractors]),
    })
  }

  // Quiz items.
  for (const qz of lesson.quiz) {
    list.push({
      kind: 'mc',
      promptLang: 'en',
      prompt: qz.question,
      answer: qz.options[qz.answer],
      options: qz.options.slice(),
    })
  }

  const head = list.find(e => e.kind === 'pairs')
  const rest = shuffle(list.filter(e => e !== head))
  return head ? [head, ...rest] : rest
}

export function getStrugglingWords(stats: WordStats, now: number = Date.now()): WordStat[] {
  const RECENT_WRONG_MS = 30 * 60 * 1000
  return Object.values(stats)
    .filter(s => {
      if (s.attempts === 0) return false
      const rate = s.correct / s.attempts
      const recentWrong = s.lastWrongAt && (now - s.lastWrongAt) < RECENT_WRONG_MS
      return (rate < 0.8 && s.attempts >= 2) || recentWrong
    })
    .sort((a, b) => (a.correct / a.attempts) - (b.correct / b.attempts))
}

export function buildReviewExercises(stats: WordStats, max = 8): Exercise[] {
  const struggling = getStrugglingWords(stats).slice(0, max)
  if (struggling.length === 0) return []

  const allSr = SERBIAN_COURSE.flatMap(l => l.words.map(wd => wd.serbian))
  const allEn = SERBIAN_COURSE.flatMap(l => l.words.map(wd => wd.english))
  const list: Exercise[] = []

  for (const sw of struggling) {
    const wrongRate = 1 - sw.correct / sw.attempts
    list.push({
      kind: 'mc', promptLang: 'sr', prompt: sw.sr, answer: sw.en,
      options: shuffle([sw.en, ...shuffle(allEn.filter(e => e !== sw.en)).slice(0, 3)]),
      srKey: sw.sr,
    })
    if (wrongRate > 0.4) {
      list.push({
        kind: 'mc', promptLang: 'en', prompt: sw.en, answer: sw.sr,
        options: shuffle([sw.sr, ...shuffle(allSr.filter(x => x !== sw.sr)).slice(0, 3)]),
        srKey: sw.sr,
      })
    }
  }
  return shuffle(list)
}
