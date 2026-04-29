// ═══════════════════════════════════════════════════════════════════════════════
// SERBIAN LANGUAGE COURSE — taught by Professor Eren
// Duolingo-style hierarchy: Sections → Units → Lessons.
// Each lesson covers ~4-5 themed words plus 2-3 sentences + 4 quiz items, so
// buildExercises() can generate ~14-18 short exercises per session.
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
export const SERBIAN_COURSE: Lesson[] = [

  // ════════════════════════════════════════════════════════════════════════
  // SECTION 1 · STARTING OUT (Početak)
  // ════════════════════════════════════════════════════════════════════════

  // ─── UNIT: Hello! (Pozdrav) ───
  L('Hello', 'Zdravo', 'hello', [
    w('Zdravo', 'Здраво', 'Hello', 'ZDRAH-voh'),
    w('Ćao', 'Ћао', 'Hi', 'CHOW'),
    w('Hej', 'Хеј', 'Hey', 'hey'),
    w('Prijatelj', 'Пријатељ', 'Friend', 'pree-YAH-tel'),
    w('Kako si?', 'Како си?', 'How are you?', 'KAH-koh see'),
  ], [
    s('Zdravo, prijatelju!', 'Hello, friend!'),
    s('Ćao, Eren!', 'Hi, Eren!'),
    s('Hej, kako si?', 'Hey, how are you?'),
  ], [
    q('"Zdravo" means...', ['Bye', 'Hello', 'Sorry', 'Thanks'], 1),
    q('How do you say "Hi"?', ['Ćao', 'Da', 'Ne', 'Hvala'], 0),
    q('"Prijatelj" means...', ['Family', 'Friend', 'Stranger', 'Neighbor'], 1),
    q('Asking how someone is:', ['Ćao', 'Kako si?', 'Hvala', 'Da'], 1),
  ]),
  L('Bye', 'Doviđenja', 'hello', [
    w('Doviđenja', 'Довиђења', 'Goodbye', 'doh-vee-JEH-nyah'),
    w('Vidimo se', 'Видимо се', 'See you', 'VEE-dee-moh seh'),
    w('Ćao', 'Ћао', 'Bye', 'CHOW'),
    w('Zbogom', 'Збогом', 'Farewell', 'ZBOH-gohm'),
    w('Pozdrav', 'Поздрав', 'Greetings / Bye', 'POHZ-drahv'),
  ], [
    s('Doviđenja, Eren!', 'Goodbye, Eren!'),
    s('Vidimo se sutra.', 'See you tomorrow.'),
    s('Pozdrav, prijatelju!', 'Greetings, friend!'),
  ], [
    q('"Doviđenja" means...', ['Hello', 'Goodbye', 'Please', 'Thanks'], 1),
    q('"Vidimo se" means...', ['Hello', 'See you', 'Sorry', 'Yes'], 1),
    q('"Zbogom" is...', ['A formal farewell', 'A greeting', 'An apology', 'A thanks'], 0),
    q('"Ćao" can mean...', ['Only Hi', 'Only Bye', 'Both Hi and Bye', 'Sorry'], 2),
  ]),
  L('Morning & Day', 'Jutro i Dan', 'hello', [
    w('Dobro jutro', 'Добро јутро', 'Good morning', 'DOH-broh YOO-troh'),
    w('Jutro', 'Јутро', 'Morning', 'YOO-troh'),
    w('Dobar dan', 'Добар дан', 'Good day', 'DOH-bar dahn'),
    w('Dan', 'Дан', 'Day', 'dahn'),
    w('Lepo', 'Лепо', 'Nice / Beautiful', 'LEH-poh'),
  ], [
    s('Dobro jutro, mama!', 'Good morning, mom!'),
    s('Dobar dan, prijatelju.', 'Good day, friend.'),
    s('Lep dan!', 'Nice day!'),
  ], [
    q('"Dobro jutro" means...', ['Good night', 'Good morning', 'Hello', 'Goodbye'], 1),
    q('"Dobar dan" means...', ['Good morning', 'Good day', 'Good night', 'See you'], 1),
    q('"Jutro" alone means...', ['Day', 'Morning', 'Night', 'Evening'], 1),
    q('"Lepo" means...', ['Bad', 'Far', 'Nice', 'Loud'], 2),
  ]),
  L('Evening & Night', 'Veče i Noć', 'hello', [
    w('Dobro veče', 'Добро вече', 'Good evening', 'DOH-broh VEH-cheh'),
    w('Veče', 'Вече', 'Evening', 'VEH-cheh'),
    w('Laku noć', 'Лаку ноћ', 'Good night', 'LAH-koo nohch'),
    w('Noć', 'Ноћ', 'Night', 'nohch'),
    w('Slatki snovi', 'Слатки снови', 'Sweet dreams', 'SLAHT-kee SNOH-vee'),
  ], [
    s('Dobro veče, prijatelju.', 'Good evening, friend.'),
    s('Laku noć, Eren!', 'Good night, Eren!'),
    s('Slatki snovi, mama.', 'Sweet dreams, mom.'),
  ], [
    q('"Laku noć" means...', ['Good morning', 'Good night', 'Goodbye', 'Hello'], 1),
    q('"Dobro veče" means...', ['Good day', 'Good evening', 'Good morning', 'Hi'], 1),
    q('"Veče" means...', ['Morning', 'Day', 'Evening', 'Night'], 2),
    q('"Slatki snovi" means...', ['Sweet treats', 'Sweet dreams', 'Good night', 'See you'], 1),
  ]),

  // ─── UNIT: Manners (Ljubaznost) ───
  L('Thanks', 'Hvala', 'manners', [
    w('Hvala', 'Хвала', 'Thank you', 'HVAH-lah'),
    w('Hvala lepo', 'Хвала лепо', 'Thank you kindly', 'HVAH-lah LEH-poh'),
    w('Hvala ti', 'Хвала ти', 'Thanks (informal)', 'HVAH-lah tee'),
    w('Mnogo', 'Много', 'A lot / Very', 'MNOH-goh'),
    w('Puno', 'Пуно', 'A lot / Many', 'POO-noh'),
  ], [
    s('Hvala mnogo!', 'Thanks a lot!'),
    s('Hvala ti, prijatelju.', 'Thanks, friend.'),
    s('Hvala lepo, Eren.', 'Thank you kindly, Eren.'),
  ], [
    q('"Hvala" means...', ['Hello', 'Thank you', 'Sorry', 'Please'], 1),
    q('Polite "thanks" is...', ['Ćao', 'Hvala lepo', 'Doviđenja', 'Zdravo'], 1),
    q('"Mnogo" means...', ['Little', 'A lot', 'Very few', 'Once'], 1),
    q('Casual "thanks":', ['Hvala vam', 'Hvala ti', 'Doviđenja', 'Zbogom'], 1),
  ]),
  L('Please', 'Molim', 'manners', [
    w('Molim', 'Молим', 'Please / You\'re welcome', 'MOH-leem'),
    w('Molim te', 'Молим те', 'Please (informal)', 'MOH-leem teh'),
    w('Molim vas', 'Молим вас', 'Please (formal)', 'MOH-leem vahs'),
    w('Izvolite', 'Изволите', 'Here you go', 'eez-VOH-lee-teh'),
    w('Naravno', 'Наравно', 'Of course', 'NAH-rahv-noh'),
  ], [
    s('Molim te, Eren.', 'Please, Eren.'),
    s('Izvolite, hvala.', 'Here you go, thanks.'),
    s('Naravno, prijatelju.', 'Of course, friend.'),
  ], [
    q('"Molim" means...', ['Sorry', 'Please / You\'re welcome', 'Thanks', 'Yes'], 1),
    q('Saying "please" to a friend:', ['Molim te', 'Molim vas', 'Hvala', 'Da'], 0),
    q('"Izvolite" is used when...', ['Apologizing', 'Offering / handing over', 'Greeting', 'Refusing'], 1),
    q('"Naravno" means...', ['Maybe', 'Of course', 'Never', 'Sometimes'], 1),
  ]),
  L('Sorry', 'Izvini', 'manners', [
    w('Izvini', 'Извини', 'Sorry (informal)', 'eez-VEE-nee'),
    w('Izvinite', 'Извините', 'Sorry (formal)', 'eez-VEE-nee-teh'),
    w('Oprosti', 'Опрости', 'Forgive me', 'oh-PROH-stee'),
    w('Žao mi je', 'Жао ми је', 'I am sorry', 'ZHAH-oh mee yeh'),
    w('Pardon', 'Пардон', 'Pardon', 'PAR-don'),
  ], [
    s('Izvini, ne razumem.', 'Sorry, I don\'t understand.'),
    s('Žao mi je, prijatelju.', 'I am sorry, friend.'),
    s('Oprosti, molim te.', 'Forgive me, please.'),
  ], [
    q('"Izvini" means...', ['Hello', 'Sorry', 'Please', 'Thanks'], 1),
    q('"Žao mi je" means...', ['I am happy', 'I am sorry', 'I don\'t know', 'I see'], 1),
    q('Formal "sorry":', ['Izvini', 'Izvinite', 'Hvala', 'Da'], 1),
    q('After bumping someone, say...', ['Hvala', 'Izvini', 'Da', 'Pardon, izvini'], 3),
  ]),
  L('Yes & No', 'Da i Ne', 'manners', [
    w('Da', 'Да', 'Yes', 'dah'),
    w('Ne', 'Не', 'No', 'neh'),
    w('Možda', 'Можда', 'Maybe', 'MOZH-dah'),
    w('Naravno', 'Наравно', 'Of course', 'NAH-rahv-noh'),
    w('Nikad', 'Никад', 'Never', 'NEE-kahd'),
  ], [
    s('Da, hvala.', 'Yes, thanks.'),
    s('Ne, izvini.', 'No, sorry.'),
    s('Možda sutra.', 'Maybe tomorrow.'),
  ], [
    q('"Da" means...', ['No', 'Yes', 'Maybe', 'Hello'], 1),
    q('"Ne" means...', ['Yes', 'No', 'And', 'But'], 1),
    q('"Možda" means...', ['Of course', 'Never', 'Maybe', 'Always'], 2),
    q('"Nikad" means...', ['Always', 'Sometimes', 'Never', 'Often'], 2),
  ]),

  // ─── UNIT: Me & You (Ja i Ti) ───
  L('I, You', 'Ja, Ti', 'me-you', [
    w('Ja', 'Ја', 'I', 'yah'),
    w('Ti', 'Ти', 'You (informal)', 'tee'),
    w('Vi', 'Ви', 'You (formal/plural)', 'vee'),
    w('Mi', 'Ми', 'We', 'mee'),
    w('Oni', 'Они', 'They', 'OH-nee'),
  ], [
    s('Ja sam Eren.', 'I am Eren.'),
    s('Ti si moj prijatelj.', 'You are my friend.'),
    s('Mi smo srećni.', 'We are happy.'),
  ], [
    q('"Ja" means...', ['You', 'I', 'He', 'We'], 1),
    q('"Ti" means...', ['I', 'You (informal)', 'They', 'She'], 1),
    q('Formal "you":', ['Ja', 'Ti', 'Vi', 'On'], 2),
    q('"Mi" means...', ['I', 'You', 'We', 'They'], 2),
  ]),
  L('To Be', 'Biti', 'me-you', [
    w('Sam', 'Сам', 'Am (I am)', 'sahm'),
    w('Si', 'Си', 'Are (you are)', 'see'),
    w('Je', 'Је', 'Is', 'yeh'),
    w('Smo', 'Смо', 'Are (we are)', 'smoh'),
    w('Su', 'Су', 'Are (they are)', 'soo'),
  ], [
    s('Ja sam srećan.', 'I am happy.'),
    s('Ti si dobar.', 'You are good.'),
    s('On je mačka.', 'He is a cat.'),
  ], [
    q('"Sam" goes with...', ['Ti', 'On', 'Ja', 'Mi'], 2),
    q('"Si" goes with...', ['Ja', 'Ti', 'On', 'Oni'], 1),
    q('"Je" means...', ['Am', 'Are', 'Is', 'Be'], 2),
    q('"Smo" goes with...', ['Ja', 'Ti', 'Mi', 'On'], 2),
  ]),
  L('He, She, It', 'On, Ona, Ono', 'me-you', [
    w('On', 'Он', 'He', 'ohn'),
    w('Ona', 'Она', 'She', 'OH-nah'),
    w('Ono', 'Оно', 'It', 'OH-noh'),
    w('Oni', 'Они', 'They (m)', 'OH-nee'),
    w('One', 'Оне', 'They (f)', 'OH-neh'),
  ], [
    s('On je Eren.', 'He is Eren.'),
    s('Ona je dobra.', 'She is good.'),
    s('Oni su mačke.', 'They are cats.'),
  ], [
    q('"On" means...', ['She', 'He', 'It', 'They'], 1),
    q('"Ona" means...', ['He', 'She', 'We', 'You'], 1),
    q('"Ono" refers to...', ['He', 'She', 'It', 'They'], 2),
    q('"Oni" means...', ['He', 'She', 'They (m)', 'We'], 2),
  ]),
  L('We, You all, They', 'Mi, Vi, Oni', 'me-you', [
    w('Mi', 'Ми', 'We', 'mee'),
    w('Vi', 'Ви', 'You all', 'vee'),
    w('Oni', 'Они', 'They', 'OH-nee'),
    w('Smo', 'Смо', 'Are (we)', 'smoh'),
    w('Ste', 'Сте', 'Are (you all)', 'steh'),
  ], [
    s('Mi smo prijatelji.', 'We are friends.'),
    s('Vi ste dobri.', 'You all are good.'),
    s('Oni su mačke.', 'They are cats.'),
  ], [
    q('"Mi" means...', ['I', 'You', 'We', 'They'], 2),
    q('"Vi" means...', ['I', 'You all', 'We', 'They'], 1),
    q('"Smo" goes with...', ['Ja', 'Ti', 'Mi', 'Oni'], 2),
    q('"Ste" goes with...', ['Mi', 'Vi', 'Oni', 'On'], 1),
  ]),

  // ─── UNIT: Names (Imena) ───
  L('My Name', 'Moje ime', 'names', [
    w('Ime', 'Име', 'Name', 'EE-meh'),
    w('Zovem se', 'Зовем се', 'My name is', 'ZOH-vem seh'),
    w('Prezime', 'Презиме', 'Surname', 'PREH-zee-meh'),
    w('Gospodin', 'Господин', 'Mr.', 'GOH-spoh-deen'),
    w('Gospođa', 'Госпођа', 'Mrs.', 'GOH-spoh-jah'),
  ], [
    s('Zovem se Eren.', 'My name is Eren.'),
    s('Moje ime je Eren.', 'My name is Eren.'),
    s('Gospodin Eren.', 'Mr. Eren.'),
  ], [
    q('"Ime" means...', ['Family', 'Name', 'Friend', 'Day'], 1),
    q('"Zovem se" means...', ['Your name is', 'My name is', 'Nice to meet you', 'See you'], 1),
    q('"Prezime" means...', ['First name', 'Surname', 'Nickname', 'Title'], 1),
    q('"Gospodin" means...', ['Mr.', 'Mrs.', 'Doctor', 'Friend'], 0),
  ]),
  L('Your Name?', 'Kako se zoveš?', 'names', [
    w('Kako', 'Како', 'How', 'KAH-koh'),
    w('Kako se zoveš?', 'Како се зовеш?', 'What is your name?', 'KAH-koh seh ZOH-vesh'),
    w('Tvoje', 'Твоје', 'Your', 'TVOH-yeh'),
    w('Čije', 'Чије', 'Whose', 'CHEE-yeh'),
    w('Ovo', 'Ово', 'This', 'OH-voh'),
  ], [
    s('Kako se zoveš?', 'What is your name?'),
    s('Tvoje ime je lepo.', 'Your name is beautiful.'),
    s('Čije je ovo?', 'Whose is this?'),
  ], [
    q('"Kako se zoveš?" means...', ['How old are you?', 'What is your name?', 'Where are you?', 'Who is that?'], 1),
    q('"Kako" means...', ['What', 'Where', 'How', 'Why'], 2),
    q('"Tvoje" means...', ['My', 'Your', 'Our', 'Their'], 1),
    q('"Ovo" means...', ['That', 'This', 'Where', 'Here'], 1),
  ]),
  L('Nice to Meet You', 'Drago mi je', 'names', [
    w('Drago mi je', 'Драго ми је', 'Nice to meet you', 'DRAH-goh mee yeh'),
    w('Takođe', 'Такође', 'Likewise', 'tah-KOH-jeh'),
    w('Prijatno', 'Пријатно', 'Pleased', 'PREE-yaht-noh'),
    w('Upoznati', 'Упознати', 'To meet', 'oo-POH-znah-tee'),
    w('Drago', 'Драго', 'Glad', 'DRAH-goh'),
  ], [
    s('Drago mi je, Eren.', 'Nice to meet you, Eren.'),
    s('Takođe, prijatno.', 'Likewise, pleased.'),
    s('Drago mi je upoznati te.', 'It\'s nice to meet you.'),
  ], [
    q('"Drago mi je" means...', ['Goodbye', 'Nice to meet you', 'Sorry', 'Thank you'], 1),
    q('"Takođe" means...', ['Sorry', 'Likewise', 'Yes', 'No'], 1),
    q('"Prijatno" means...', ['Sad', 'Pleased', 'Tired', 'Sorry'], 1),
    q('After "Drago mi je" reply with...', ['Hvala', 'Takođe', 'Doviđenja', 'Ne'], 1),
  ]),
  L('Where From', 'Odakle si?', 'names', [
    w('Odakle', 'Одакле', 'Where from', 'oh-DAHK-leh'),
    w('Iz', 'Из', 'From', 'eez'),
    w('Srbija', 'Србија', 'Serbia', 'SUR-bee-yah'),
    w('Grad', 'Град', 'City', 'grahd'),
    w('Selo', 'Село', 'Village', 'SEH-loh'),
  ], [
    s('Odakle si?', 'Where are you from?'),
    s('Ja sam iz Srbije.', 'I am from Serbia.'),
    s('Volim ovaj grad.', 'I love this city.'),
  ], [
    q('"Odakle si?" means...', ['Who are you?', 'Where are you from?', 'How old are you?', 'What is your name?'], 1),
    q('"Iz" means...', ['To', 'In', 'From', 'And'], 2),
    q('"Grad" means...', ['Country', 'City', 'Village', 'House'], 1),
    q('"Selo" means...', ['City', 'Village', 'Forest', 'Sea'], 1),
  ]),

  // ════════════════════════════════════════════════════════════════════════
  // SECTION 2 · NUMBERS & PEOPLE (Brojevi i Ljudi)
  // ════════════════════════════════════════════════════════════════════════

  // ─── UNIT: 1 to 5 ───
  L('One & Two', 'Jedan, Dva', 'numbers-low', [
    w('Jedan', 'Један', 'One', 'YEH-dahn'),
    w('Dva', 'Два', 'Two', 'dvah'),
    w('Broj', 'Број', 'Number', 'broy'),
    w('Koliko', 'Колико', 'How many', 'KOH-lee-koh'),
    w('Nula', 'Нула', 'Zero', 'NOO-lah'),
  ], [
    s('Jedan, dva.', 'One, two.'),
    s('Imam dva brata.', 'I have two brothers.'),
    s('Koliko ima?', 'How many are there?'),
  ], [
    q('"Jedan" means...', ['One', 'Two', 'Three', 'Five'], 0),
    q('"Dva" means...', ['One', 'Two', 'Four', 'Ten'], 1),
    q('"Broj" means...', ['Word', 'Letter', 'Number', 'Name'], 2),
    q('"Nula" means...', ['One', 'Zero', 'Half', 'Last'], 1),
  ]),
  L('Three & Four', 'Tri, Četiri', 'numbers-low', [
    w('Tri', 'Три', 'Three', 'tree'),
    w('Četiri', 'Четири', 'Four', 'CHEH-tee-ree'),
    w('Prvi', 'Први', 'First', 'PUR-vee'),
    w('Drugi', 'Други', 'Second', 'DROO-gee'),
    w('Treći', 'Трећи', 'Third', 'TREH-chee'),
  ], [
    s('Eren ima četiri šape.', 'Eren has four paws.'),
    s('Tri prijatelja.', 'Three friends.'),
    s('Prvi dan u školi.', 'First day at school.'),
  ], [
    q('"Tri" means...', ['One', 'Two', 'Three', 'Four'], 2),
    q('"Četiri" means...', ['Five', 'Three', 'Four', 'Two'], 2),
    q('"Prvi" means...', ['Last', 'First', 'Second', 'Third'], 1),
    q('"Drugi" means...', ['First', 'Second', 'Other', 'Both 2 and 3'], 3),
  ]),
  L('Five', 'Pet', 'numbers-low', [
    w('Pet', 'Пет', 'Five', 'peht'),
    w('Brojevi', 'Бројеви', 'Numbers', 'BROH-yeh-vee'),
    w('Šape', 'Шапе', 'Paws', 'SHAH-peh'),
    w('Godine', 'Године', 'Years', 'GOH-dee-neh'),
    w('Prst', 'Прст', 'Finger', 'puhrst'),
  ], [
    s('Imam pet godina.', 'I am five years old.'),
    s('Pet šapa.', 'Five paws.'),
    s('Pet prstiju.', 'Five fingers.'),
  ], [
    q('"Pet" means...', ['Three', 'Four', 'Five', 'Six'], 2),
    q('"Brojevi" means...', ['Letters', 'Numbers', 'Words', 'Names'], 1),
    q('"Šape" means...', ['Hands', 'Paws', 'Tails', 'Ears'], 1),
    q('"Godine" means...', ['Days', 'Years', 'Hours', 'Weeks'], 1),
  ]),

  // ─── UNIT: 6 to 10 ───
  L('Six & Seven', 'Šest, Sedam', 'numbers-high', [
    w('Šest', 'Шест', 'Six', 'shehst'),
    w('Sedam', 'Седам', 'Seven', 'SEH-dahm'),
    w('Više', 'Више', 'More', 'VEE-sheh'),
    w('Manje', 'Мање', 'Less', 'MAH-nyeh'),
    w('Opet', 'Опет', 'Again', 'OH-peht'),
  ], [
    s('Šest jabuka.', 'Six apples.'),
    s('Sedam dana u nedelji.', 'Seven days in a week.'),
    s('Više od pet.', 'More than five.'),
  ], [
    q('"Šest" means...', ['Five', 'Six', 'Seven', 'Eight'], 1),
    q('"Sedam" means...', ['Six', 'Seven', 'Eight', 'Nine'], 1),
    q('"Više" means...', ['Less', 'More', 'Same', 'Few'], 1),
    q('A week has ___ days:', ['Pet', 'Šest', 'Sedam', 'Osam'], 2),
  ]),
  L('Eight & Nine', 'Osam, Devet', 'numbers-high', [
    w('Osam', 'Осам', 'Eight', 'OH-sahm'),
    w('Devet', 'Девет', 'Nine', 'DEH-veht'),
    w('Skoro', 'Скоро', 'Almost', 'SKOH-roh'),
    w('Gotovo', 'Готово', 'Nearly', 'GOH-toh-voh'),
    w('Malo', 'Мало', 'A little', 'MAH-loh'),
  ], [
    s('Osam mačaka.', 'Eight cats.'),
    s('Skoro devet sati.', 'Almost nine o\'clock.'),
    s('Malo vode.', 'A little water.'),
  ], [
    q('"Osam" means...', ['Seven', 'Eight', 'Nine', 'Ten'], 1),
    q('"Devet" means...', ['Eight', 'Nine', 'Ten', 'Six'], 1),
    q('"Skoro" means...', ['Never', 'Almost', 'Always', 'Long ago'], 1),
    q('"Malo" means...', ['A lot', 'A little', 'Many', 'Some'], 1),
  ]),
  L('Ten', 'Deset', 'numbers-high', [
    w('Deset', 'Десет', 'Ten', 'DEH-seht'),
    w('Prsti', 'Прсти', 'Fingers', 'PUR-stee'),
    w('Sve', 'Све', 'All / Everything', 'sveh'),
    w('Ukupno', 'Укупно', 'In total', 'oo-KOOP-noh'),
    w('Decenija', 'Деценија', 'Decade', 'deh-TSEH-nee-yah'),
  ], [
    s('Deset prstiju.', 'Ten fingers.'),
    s('Imam deset godina.', 'I am ten years old.'),
    s('Ukupno deset.', 'Ten in total.'),
  ], [
    q('"Deset" means...', ['Nine', 'Ten', 'Eleven', 'Twelve'], 1),
    q('"Prsti" means...', ['Hands', 'Fingers', 'Toes', 'Feet'], 1),
    q('"Sve" means...', ['Some', 'All', 'None', 'Few'], 1),
    q('After "devet" comes...', ['Osam', 'Sedam', 'Deset', 'Pet'], 2),
  ]),

  // ─── UNIT: Family (Porodica) ───
  L('Mom & Dad', 'Mama i Tata', 'family', [
    w('Mama', 'Мама', 'Mom', 'MAH-mah'),
    w('Tata', 'Тата', 'Dad', 'TAH-tah'),
    w('Roditelji', 'Родитељи', 'Parents', 'roh-DEE-teh-lyee'),
    w('Lepa', 'Лепа', 'Beautiful (f)', 'LEH-pah'),
    w('Dobar', 'Добар', 'Good (m)', 'DOH-bar'),
  ], [
    s('Moja mama je lepa.', 'My mom is beautiful.'),
    s('Tata je dobar.', 'Dad is good.'),
    s('Volim svoje roditelje.', 'I love my parents.'),
  ], [
    q('"Mama" means...', ['Sister', 'Mom', 'Aunt', 'Friend'], 1),
    q('"Tata" means...', ['Uncle', 'Brother', 'Dad', 'Grandpa'], 2),
    q('"Roditelji" means...', ['Children', 'Parents', 'Cousins', 'Grandparents'], 1),
    q('"Lepa" describes a...', ['Boy', 'Girl', 'Both', 'Object'], 1),
  ]),
  L('Brother & Sister', 'Brat i Sestra', 'family', [
    w('Brat', 'Брат', 'Brother', 'braht'),
    w('Sestra', 'Сестра', 'Sister', 'SEH-strah'),
    w('Mlađi', 'Млађи', 'Younger', 'MLAH-jee'),
    w('Stariji', 'Старији', 'Older', 'STAH-ree-yee'),
    w('Blizanci', 'Близанци', 'Twins', 'blee-ZAHN-tsee'),
  ], [
    s('Imam jednog brata.', 'I have one brother.'),
    s('Moja sestra je mlađa.', 'My sister is younger.'),
    s('Mi smo blizanci.', 'We are twins.'),
  ], [
    q('"Brat" means...', ['Sister', 'Brother', 'Friend', 'Child'], 1),
    q('"Sestra" means...', ['Mom', 'Sister', 'Aunt', 'Daughter'], 1),
    q('"Mlađi" means...', ['Older', 'Younger', 'Same age', 'Tall'], 1),
    q('"Blizanci" means...', ['Cousins', 'Twins', 'Siblings', 'Triplets'], 1),
  ]),
  L('Grandparents', 'Baba i Deda', 'family', [
    w('Baba', 'Баба', 'Grandma', 'BAH-bah'),
    w('Deda', 'Деда', 'Grandpa', 'DEH-dah'),
    w('Unuk', 'Унук', 'Grandson', 'OO-nook'),
    w('Unuka', 'Унука', 'Granddaughter', 'oo-NOO-kah'),
    w('Stariji', 'Старији', 'Older', 'STAH-ree-yee'),
  ], [
    s('Baba peče hleb.', 'Grandma bakes bread.'),
    s('Deda priča priče.', 'Grandpa tells stories.'),
    s('Ja sam unuk.', 'I am the grandson.'),
  ], [
    q('"Baba" means...', ['Mom', 'Grandma', 'Aunt', 'Sister'], 1),
    q('"Deda" means...', ['Dad', 'Grandpa', 'Uncle', 'Brother'], 1),
    q('"Unuk" means...', ['Granddaughter', 'Grandson', 'Cousin', 'Nephew'], 1),
    q('Mom\'s mom is your...', ['Sestra', 'Mama', 'Baba', 'Tetka'], 2),
  ]),
  L('My Family', 'Moja Porodica', 'family', [
    w('Porodica', 'Породица', 'Family', 'poh-ROH-dee-tsah'),
    w('Dete', 'Дете', 'Child', 'DEH-teh'),
    w('Moja', 'Моја', 'My (fem.)', 'MOH-yah'),
    w('Moj', 'Мој', 'My (masc.)', 'moy'),
    w('Naša', 'Наша', 'Our (fem.)', 'NAH-shah'),
  ], [
    s('Volim svoju porodicu.', 'I love my family.'),
    s('Moja sestra i moj brat.', 'My sister and my brother.'),
    s('Naša porodica je velika.', 'Our family is big.'),
  ], [
    q('"Porodica" means...', ['Friend', 'Family', 'Home', 'Town'], 1),
    q('"Moj" is used for...', ['Female words', 'Male words', 'Both', 'Numbers'], 1),
    q('"Naša" means...', ['My', 'Your', 'Our', 'Their'], 2),
    q('"Dete" means...', ['Adult', 'Child', 'Pet', 'Sibling'], 1),
  ]),

  // ─── UNIT: Body (Telo) ───
  L('Head', 'Glava', 'body', [
    w('Glava', 'Глава', 'Head', 'GLAH-vah'),
    w('Kosa', 'Коса', 'Hair', 'KOH-sah'),
    w('Lice', 'Лице', 'Face', 'LEE-tseh'),
    w('Čelo', 'Чело', 'Forehead', 'CHEH-loh'),
    w('Mozak', 'Мозак', 'Brain', 'MOH-zahk'),
  ], [
    s('Moja glava me boli.', 'My head hurts.'),
    s('Eren ima belu kosu.', 'Eren has white hair.'),
    s('Lepo lice.', 'A beautiful face.'),
  ], [
    q('"Glava" means...', ['Hand', 'Head', 'Heart', 'Foot'], 1),
    q('"Kosa" means...', ['Eye', 'Hair', 'Nose', 'Mouth'], 1),
    q('"Lice" means...', ['Body', 'Face', 'Eye', 'Heart'], 1),
    q('"Mozak" means...', ['Heart', 'Brain', 'Bone', 'Skin'], 1),
  ]),
  L('Eyes & Mouth', 'Oči i Usta', 'body', [
    w('Oko', 'Око', 'Eye', 'OH-koh'),
    w('Usta', 'Уста', 'Mouth', 'OO-stah'),
    w('Nos', 'Нос', 'Nose', 'nohs'),
    w('Jezik', 'Језик', 'Tongue / Language', 'YEH-zeek'),
    w('Zubi', 'Зуби', 'Teeth', 'ZOO-bee'),
  ], [
    s('Eren ima plave oči.', 'Eren has blue eyes.'),
    s('Mali nos.', 'A small nose.'),
    s('Beli zubi.', 'White teeth.'),
  ], [
    q('"Oko" means...', ['Ear', 'Eye', 'Nose', 'Mouth'], 1),
    q('"Usta" means...', ['Eye', 'Hand', 'Mouth', 'Heart'], 2),
    q('"Nos" means...', ['Mouth', 'Nose', 'Ear', 'Eye'], 1),
    q('"Jezik" can mean...', ['Tongue', 'Language', 'Both', 'Neither'], 2),
  ]),
  L('Hands & Legs', 'Ruke i Noge', 'body', [
    w('Ruka', 'Рука', 'Hand / Arm', 'ROO-kah'),
    w('Noga', 'Нога', 'Leg / Foot', 'NOH-gah'),
    w('Prst', 'Прст', 'Finger', 'puhrst'),
    w('Koleno', 'Колено', 'Knee', 'KOH-leh-noh'),
    w('Lakat', 'Лакат', 'Elbow', 'LAH-kaht'),
  ], [
    s('Imam dve ruke.', 'I have two hands.'),
    s('Noga me boli.', 'My leg hurts.'),
    s('Pet prstiju.', 'Five fingers.'),
  ], [
    q('"Ruka" means...', ['Leg', 'Hand / Arm', 'Head', 'Foot'], 1),
    q('"Noga" means...', ['Hand', 'Leg', 'Eye', 'Heart'], 1),
    q('"Prst" means...', ['Hand', 'Foot', 'Finger', 'Knee'], 2),
    q('"Koleno" means...', ['Elbow', 'Knee', 'Ankle', 'Wrist'], 1),
  ]),
  L('Heart & Body', 'Srce i Telo', 'body', [
    w('Srce', 'Срце', 'Heart', 'SUR-tseh'),
    w('Telo', 'Тело', 'Body', 'TEH-loh'),
    w('Uvo', 'Уво', 'Ear', 'OO-voh'),
    w('Leđa', 'Леђа', 'Back', 'LEH-jah'),
    w('Stomak', 'Стомак', 'Stomach', 'STOH-mahk'),
  ], [
    s('Srce kuca brzo.', 'The heart beats fast.'),
    s('Tvoje telo je dobro.', 'Your body is good.'),
    s('Boli me stomak.', 'My stomach hurts.'),
  ], [
    q('"Srce" means...', ['Hand', 'Heart', 'Hair', 'Eye'], 1),
    q('"Telo" means...', ['Friend', 'Family', 'Body', 'House'], 2),
    q('"Uvo" means...', ['Eye', 'Ear', 'Nose', 'Mouth'], 1),
    q('"Stomak" means...', ['Heart', 'Back', 'Stomach', 'Chest'], 2),
  ]),

  // ════════════════════════════════════════════════════════════════════════
  // SECTION 3 · WORLD AROUND YOU (Svet)
  // ════════════════════════════════════════════════════════════════════════

  // ─── UNIT: Colors (Boje) ───
  L('Red & Blue', 'Crvena i Plava', 'colors', [
    w('Crvena', 'Црвена', 'Red', 'TSUR-veh-nah'),
    w('Plava', 'Плава', 'Blue', 'PLAH-vah'),
    w('Boja', 'Боја', 'Color', 'BOY-ah'),
    w('Jabuka', 'Јабука', 'Apple', 'YAH-boo-kah'),
    w('Nebo', 'Небо', 'Sky', 'NEH-boh'),
  ], [
    s('Crvena jabuka.', 'A red apple.'),
    s('Plavo nebo.', 'Blue sky.'),
    s('Lepa boja.', 'A beautiful color.'),
  ], [
    q('"Crvena" means...', ['Blue', 'Red', 'Green', 'Yellow'], 1),
    q('"Plava" means...', ['Red', 'Blue', 'Black', 'White'], 1),
    q('"Boja" means...', ['Number', 'Color', 'Shape', 'Animal'], 1),
    q('"Nebo" means...', ['Cloud', 'Sky', 'Sun', 'Star'], 1),
  ]),
  L('Green & Yellow', 'Zelena i Žuta', 'colors', [
    w('Zelena', 'Зелена', 'Green', 'ZEH-leh-nah'),
    w('Žuta', 'Жута', 'Yellow', 'ZHOO-tah'),
    w('Trava', 'Трава', 'Grass', 'TRAH-vah'),
    w('Sunce', 'Сунце', 'Sun', 'SOON-tseh'),
    w('List', 'Лист', 'Leaf', 'leest'),
  ], [
    s('Zelena trava.', 'Green grass.'),
    s('Žuto sunce.', 'Yellow sun.'),
    s('Žuti list.', 'A yellow leaf.'),
  ], [
    q('"Zelena" means...', ['Yellow', 'Green', 'Red', 'Blue'], 1),
    q('"Žuta" means...', ['Yellow', 'White', 'Black', 'Pink'], 0),
    q('"Trava" means...', ['Tree', 'Grass', 'Flower', 'Bush'], 1),
    q('Grass is...', ['Crvena', 'Zelena', 'Plava', 'Crna'], 1),
  ]),
  L('White & Black', 'Bela i Crna', 'colors', [
    w('Bela', 'Бела', 'White', 'BEH-lah'),
    w('Crna', 'Црна', 'Black', 'TSUR-nah'),
    w('Siva', 'Сива', 'Gray', 'SEE-vah'),
    w('Mačka', 'Мачка', 'Cat', 'MAHCH-kah'),
    w('Oblak', 'Облак', 'Cloud', 'OH-blahk'),
  ], [
    s('Eren je bela mačka.', 'Eren is a white cat.'),
    s('Crna noć.', 'Black night.'),
    s('Sivi oblak.', 'A gray cloud.'),
  ], [
    q('"Bela" means...', ['Black', 'White', 'Brown', 'Gray'], 1),
    q('"Crna" means...', ['White', 'Black', 'Blue', 'Red'], 1),
    q('"Siva" means...', ['Pink', 'Gray', 'Brown', 'Yellow'], 1),
    q('"Oblak" means...', ['Sky', 'Cloud', 'Rain', 'Wind'], 1),
  ]),
  L('Orange & Purple', 'Narandžasta i Ljubičasta', 'colors', [
    w('Narandžasta', 'Наранџаста', 'Orange', 'nah-RAHN-jah-stah'),
    w('Ljubičasta', 'Љубичаста', 'Purple', 'lyoo-BEE-chah-stah'),
    w('Roze', 'Розе', 'Pink', 'ROH-zeh'),
    w('Lopta', 'Лопта', 'Ball', 'LOHP-tah'),
    w('Cvet', 'Цвет', 'Flower', 'tsveht'),
  ], [
    s('Narandžasta lopta.', 'An orange ball.'),
    s('Ljubičasti cvet.', 'A purple flower.'),
    s('Roze haljina.', 'A pink dress.'),
  ], [
    q('"Narandžasta" means...', ['Yellow', 'Orange', 'Red', 'Pink'], 1),
    q('"Ljubičasta" means...', ['Pink', 'Purple', 'Blue', 'Green'], 1),
    q('"Roze" means...', ['Orange', 'Purple', 'Pink', 'Red'], 2),
    q('"Cvet" means...', ['Tree', 'Flower', 'Leaf', 'Plant'], 1),
  ]),

  // ─── UNIT: Animals (Životinje) ───
  L('Cat & Dog', 'Mačka i Pas', 'animals', [
    w('Mačka', 'Мачка', 'Cat', 'MAHCH-kah'),
    w('Pas', 'Пас', 'Dog', 'pahs'),
    w('Mače', 'Маче', 'Kitten', 'MAH-cheh'),
    w('Štene', 'Штене', 'Puppy', 'SHTEH-neh'),
    w('Životinja', 'Животиња', 'Animal', 'zhee-voh-TEE-nyah'),
  ], [
    s('Eren je lepa mačka.', 'Eren is a beautiful cat.'),
    s('Pas trči u parku.', 'The dog runs in the park.'),
    s('Malo mače.', 'A little kitten.'),
  ], [
    q('"Mačka" means...', ['Dog', 'Cat', 'Mouse', 'Bird'], 1),
    q('"Pas" means...', ['Cat', 'Dog', 'Cow', 'Horse'], 1),
    q('"Mače" means...', ['Cat', 'Kitten', 'Dog', 'Puppy'], 1),
    q('"Štene" means...', ['Kitten', 'Puppy', 'Foal', 'Calf'], 1),
  ]),
  L('Fish & Bird', 'Riba i Ptica', 'animals', [
    w('Riba', 'Риба', 'Fish', 'REE-bah'),
    w('Ptica', 'Птица', 'Bird', 'PTEE-tsah'),
    w('Perje', 'Перје', 'Feathers', 'PEHR-yeh'),
    w('Peraje', 'Пераје', 'Fins', 'PEH-rah-yeh'),
    w('Leteti', 'Летети', 'To fly', 'LEH-teh-tee'),
  ], [
    s('Riba pliva u vodi.', 'A fish swims in water.'),
    s('Ptica peva.', 'A bird sings.'),
    s('Ptice lete.', 'Birds fly.'),
  ], [
    q('"Riba" means...', ['Bird', 'Fish', 'Frog', 'Rabbit'], 1),
    q('"Ptica" means...', ['Mouse', 'Bird', 'Cat', 'Fish'], 1),
    q('"Perje" means...', ['Fur', 'Feathers', 'Skin', 'Scales'], 1),
    q('"Leteti" means...', ['To swim', 'To fly', 'To run', 'To walk'], 1),
  ]),
  L('Mouse & Rabbit', 'Miš i Zec', 'animals', [
    w('Miš', 'Миш', 'Mouse', 'meesh'),
    w('Zec', 'Зец', 'Rabbit', 'zehts'),
    w('Brz', 'Брз', 'Fast', 'burz'),
    w('Mali', 'Мали', 'Small', 'MAH-lee'),
    w('Šuma', 'Шума', 'Forest', 'SHOO-mah'),
  ], [
    s('Mačka lovi miša.', 'The cat hunts the mouse.'),
    s('Mali zec.', 'A small rabbit.'),
    s('Zec u šumi.', 'A rabbit in the forest.'),
  ], [
    q('"Miš" means...', ['Cat', 'Mouse', 'Bird', 'Bear'], 1),
    q('"Zec" means...', ['Mouse', 'Rabbit', 'Dog', 'Cow'], 1),
    q('"Brz" means...', ['Slow', 'Fast', 'Big', 'Quiet'], 1),
    q('"Šuma" means...', ['Field', 'Forest', 'River', 'Mountain'], 1),
  ]),
  L('Farm Animals', 'Životinje na farmi', 'animals', [
    w('Krava', 'Крава', 'Cow', 'KRAH-vah'),
    w('Konj', 'Коњ', 'Horse', 'kohny'),
    w('Ovca', 'Овца', 'Sheep', 'OHV-tsah'),
    w('Koza', 'Коза', 'Goat', 'KOH-zah'),
    w('Životinje', 'Животиње', 'Animals', 'zhee-voh-TEE-nyeh'),
  ], [
    s('Krava daje mleko.', 'A cow gives milk.'),
    s('Beli konj.', 'A white horse.'),
    s('Ovca i koza.', 'A sheep and a goat.'),
  ], [
    q('"Krava" means...', ['Horse', 'Cow', 'Pig', 'Sheep'], 1),
    q('"Konj" means...', ['Cow', 'Horse', 'Dog', 'Goat'], 1),
    q('"Ovca" means...', ['Cow', 'Sheep', 'Goat', 'Horse'], 1),
    q('"Koza" means...', ['Sheep', 'Cow', 'Goat', 'Donkey'], 2),
  ]),

  // ─── UNIT: Food (Hrana) ───
  L('Bread', 'Hleb', 'food', [
    w('Hleb', 'Хлеб', 'Bread', 'hlehb'),
    w('Hrana', 'Храна', 'Food', 'HRAH-nah'),
    w('Doručak', 'Доручак', 'Breakfast', 'DOH-roo-chahk'),
    w('Gladan', 'Гладан', 'Hungry (m)', 'GLAH-dahn'),
    w('Sveže', 'Свеже', 'Fresh', 'SVEH-zheh'),
  ], [
    s('Hleb je svež.', 'The bread is fresh.'),
    s('Doručak je gotov.', 'Breakfast is ready.'),
    s('Gladan sam.', 'I am hungry.'),
  ], [
    q('"Hleb" means...', ['Bread', 'Cheese', 'Apple', 'Meat'], 0),
    q('"Hrana" means...', ['Drink', 'Food', 'Bread', 'Cake'], 1),
    q('"Doručak" means...', ['Lunch', 'Breakfast', 'Dinner', 'Snack'], 1),
    q('"Gladan" means...', ['Tired', 'Hungry', 'Thirsty', 'Sad'], 1),
  ]),
  L('Meat & Cheese', 'Meso i Sir', 'food', [
    w('Meso', 'Месо', 'Meat', 'MEH-soh'),
    w('Sir', 'Сир', 'Cheese', 'seer'),
    w('Piletina', 'Пилетина', 'Chicken', 'pee-LEH-tee-nah'),
    w('Povrće', 'Поврће', 'Vegetables', 'POHV-cheh'),
    w('Kuvati', 'Кувати', 'To cook', 'KOO-vah-tee'),
  ], [
    s('Eren voli meso.', 'Eren loves meat.'),
    s('Beli sir.', 'White cheese.'),
    s('Volim piletinu.', 'I love chicken.'),
  ], [
    q('"Meso" means...', ['Cheese', 'Meat', 'Bread', 'Fish'], 1),
    q('"Sir" means...', ['Salt', 'Sugar', 'Cheese', 'Soup'], 2),
    q('"Piletina" means...', ['Beef', 'Chicken', 'Pork', 'Lamb'], 1),
    q('"Povrće" means...', ['Fruit', 'Vegetables', 'Spice', 'Grain'], 1),
  ]),
  L('Apple & Fruit', 'Jabuka i Voće', 'food', [
    w('Jabuka', 'Јабука', 'Apple', 'YAH-boo-kah'),
    w('Voće', 'Воће', 'Fruit', 'VOH-cheh'),
    w('Banana', 'Банана', 'Banana', 'bah-NAH-nah'),
    w('Narandža', 'Наранџа', 'Orange', 'NAH-rahn-jah'),
    w('Grožđe', 'Грожђе', 'Grapes', 'GROHZH-jeh'),
  ], [
    s('Crvena jabuka.', 'A red apple.'),
    s('Volim voće.', 'I love fruit.'),
    s('Slatka narandža.', 'A sweet orange.'),
  ], [
    q('"Jabuka" means...', ['Banana', 'Apple', 'Orange', 'Grape'], 1),
    q('"Voće" means...', ['Vegetable', 'Fruit', 'Bread', 'Meat'], 1),
    q('"Narandža" means...', ['Apple', 'Banana', 'Orange', 'Grapes'], 2),
    q('"Grožđe" means...', ['Orange', 'Apple', 'Grapes', 'Cherries'], 2),
  ]),
  L('Salt & Sugar', 'So i Šećer', 'food', [
    w('So', 'Со', 'Salt', 'soh'),
    w('Šećer', 'Шећер', 'Sugar', 'SHEH-cher'),
    w('Biber', 'Бибер', 'Pepper', 'BEE-ber'),
    w('Slano', 'Слано', 'Salty', 'SLAH-noh'),
    w('Slatko', 'Слатко', 'Sweet', 'SLAHT-koh'),
  ], [
    s('Treba mi so.', 'I need salt.'),
    s('Slatki šećer.', 'Sweet sugar.'),
    s('So i biber.', 'Salt and pepper.'),
  ], [
    q('"So" means...', ['Sugar', 'Salt', 'Pepper', 'Oil'], 1),
    q('"Šećer" means...', ['Salt', 'Sugar', 'Honey', 'Flour'], 1),
    q('"Biber" means...', ['Salt', 'Pepper', 'Spice', 'Sauce'], 1),
    q('"Slatko" means...', ['Salty', 'Sweet', 'Sour', 'Bitter'], 1),
  ]),

  // ─── UNIT: Drinks (Pića) ───
  L('Water', 'Voda', 'drinks', [
    w('Voda', 'Вода', 'Water', 'VOH-dah'),
    w('Piće', 'Пиће', 'Drink', 'PEE-cheh'),
    w('Čaša', 'Чаша', 'Glass', 'CHAH-shah'),
    w('Hladno', 'Хладно', 'Cold', 'HLAHD-noh'),
    w('Žedan', 'Жедан', 'Thirsty', 'ZHEH-dahn'),
  ], [
    s('Želim vode.', 'I want water.'),
    s('Hladno piće.', 'A cold drink.'),
    s('Čaša vode, molim.', 'A glass of water, please.'),
  ], [
    q('"Voda" means...', ['Milk', 'Water', 'Juice', 'Tea'], 1),
    q('"Piće" means...', ['Food', 'Drink', 'Glass', 'Cup'], 1),
    q('"Čaša" means...', ['Cup', 'Glass', 'Bottle', 'Jug'], 1),
    q('"Žedan" means...', ['Hungry', 'Thirsty', 'Tired', 'Cold'], 1),
  ]),
  L('Milk', 'Mleko', 'drinks', [
    w('Mleko', 'Млеко', 'Milk', 'MLEH-koh'),
    w('Jogurt', 'Јогурт', 'Yogurt', 'YOH-goort'),
    w('Krem', 'Крем', 'Cream', 'krehm'),
    w('Beli', 'Бели', 'White (m)', 'BEH-lee'),
    w('Topao', 'Топао', 'Warm', 'TOH-pow'),
  ], [
    s('Eren voli mleko.', 'Eren loves milk.'),
    s('Toplo mleko.', 'Warm milk.'),
    s('Jogurt za doručak.', 'Yogurt for breakfast.'),
  ], [
    q('"Mleko" means...', ['Water', 'Milk', 'Tea', 'Coffee'], 1),
    q('"Jogurt" means...', ['Cream', 'Yogurt', 'Cheese', 'Butter'], 1),
    q('"Krem" means...', ['Milk', 'Yogurt', 'Cream', 'Cheese'], 2),
    q('Cats love...', ['Hleb', 'Mleko', 'So', 'Šećer'], 1),
  ]),
  L('Coffee', 'Kafa', 'drinks', [
    w('Kafa', 'Кафа', 'Coffee', 'KAH-fah'),
    w('Espreso', 'Еспресо', 'Espresso', 'EH-spreh-soh'),
    w('Šolja', 'Шоља', 'Cup', 'SHOH-lyah'),
    w('Jaka', 'Јака', 'Strong (f)', 'YAH-kah'),
    w('Crna', 'Црна', 'Black (f)', 'TSUR-nah'),
  ], [
    s('Crna kafa.', 'Black coffee.'),
    s('Volim kafu.', 'I love coffee.'),
    s('Šolja espresa.', 'A cup of espresso.'),
  ], [
    q('"Kafa" means...', ['Tea', 'Coffee', 'Juice', 'Water'], 1),
    q('"Šolja" means...', ['Glass', 'Cup', 'Plate', 'Bowl'], 1),
    q('"Jaka" means...', ['Weak', 'Strong', 'Sweet', 'Hot'], 1),
    q('Bitter morning drink:', ['Mleko', 'Kafa', 'Čaj', 'Voda'], 1),
  ]),
  L('Tea', 'Čaj', 'drinks', [
    w('Čaj', 'Чај', 'Tea', 'chai'),
    w('Topao', 'Топао', 'Warm (m)', 'TOH-pow'),
    w('Hladan', 'Хладан', 'Cold (m)', 'HLAH-dahn'),
    w('Šolja', 'Шоља', 'Cup', 'SHOH-lyah'),
    w('Biljni', 'Биљни', 'Herbal', 'BEEL-yih-nee'),
  ], [
    s('Topao čaj.', 'Warm tea.'),
    s('Biljni čaj.', 'Herbal tea.'),
    s('Šolja čaja.', 'A cup of tea.'),
  ], [
    q('"Čaj" means...', ['Coffee', 'Tea', 'Water', 'Juice'], 1),
    q('"Topao" means...', ['Cold', 'Warm', 'Sweet', 'Sour'], 1),
    q('"Hladan" means...', ['Hot', 'Cold', 'Warm', 'New'], 1),
    q('"Biljni" means...', ['Black', 'Herbal', 'Sweet', 'Strong'], 1),
  ]),

  // ─── UNIT: Weather (Vreme) ───
  L('Sun', 'Sunce', 'weather', [
    w('Sunce', 'Сунце', 'Sun', 'SOON-tseh'),
    w('Lepo', 'Лепо', 'Beautiful / Nice', 'LEH-poh'),
    w('Sjajno', 'Сјајно', 'Bright', 'SYAI-noh'),
    w('Jutro', 'Јутро', 'Morning', 'YOO-troh'),
    w('Dan', 'Дан', 'Day', 'dahn'),
  ], [
    s('Sunce sija.', 'The sun is shining.'),
    s('Danas je lepo.', 'Today is nice.'),
    s('Sjajni dan.', 'A bright day.'),
  ], [
    q('"Sunce" means...', ['Moon', 'Sun', 'Star', 'Cloud'], 1),
    q('"Lepo" means...', ['Bad', 'Beautiful / Nice', 'Cold', 'Wet'], 1),
    q('"Sjajno" means...', ['Dim', 'Bright', 'Dark', 'Cloudy'], 1),
    q('Yellow in the sky:', ['Mesec', 'Zvezde', 'Sunce', 'Oblak'], 2),
  ]),
  L('Rain', 'Kiša', 'weather', [
    w('Kiša', 'Киша', 'Rain', 'KEE-shah'),
    w('Oblačno', 'Облачно', 'Cloudy', 'OH-blach-noh'),
    w('Kišobran', 'Кишобран', 'Umbrella', 'kee-shoh-BRAHN'),
    w('Mokro', 'Мокро', 'Wet', 'MOH-kroh'),
    w('Pada', 'Пада', 'Falling / Raining', 'PAH-dah'),
  ], [
    s('Pada kiša.', 'It is raining.'),
    s('Oblačno je danas.', 'It is cloudy today.'),
    s('Treba mi kišobran.', 'I need an umbrella.'),
  ], [
    q('"Kiša" means...', ['Snow', 'Rain', 'Wind', 'Sun'], 1),
    q('"Oblačno" means...', ['Sunny', 'Cloudy', 'Snowy', 'Windy'], 1),
    q('"Kišobran" means...', ['Raincoat', 'Umbrella', 'Boots', 'Hat'], 1),
    q('"Mokro" means...', ['Dry', 'Wet', 'Cold', 'Warm'], 1),
  ]),
  L('Snow', 'Sneg', 'weather', [
    w('Sneg', 'Снег', 'Snow', 'snehg'),
    w('Hladno', 'Хладно', 'Cold', 'HLAHD-noh'),
    w('Zima', 'Зима', 'Winter', 'ZEE-mah'),
    w('Pahulje', 'Пахуље', 'Snowflakes', 'pah-HOO-lyeh'),
    w('Led', 'Лед', 'Ice', 'lehd'),
  ], [
    s('Pada sneg.', 'It is snowing.'),
    s('Zimi je hladno.', 'In winter it is cold.'),
    s('Bele pahulje.', 'White snowflakes.'),
  ], [
    q('"Sneg" means...', ['Rain', 'Snow', 'Wind', 'Sun'], 1),
    q('"Hladno" means...', ['Warm', 'Cold', 'Hot', 'Sweet'], 1),
    q('"Zima" is the season:', ['Spring', 'Summer', 'Autumn', 'Winter'], 3),
    q('"Led" means...', ['Snow', 'Ice', 'Rain', 'Fog'], 1),
  ]),
  L('Wind', 'Vetar', 'weather', [
    w('Vetar', 'Ветар', 'Wind', 'VEH-tahr'),
    w('Toplo', 'Топло', 'Warm', 'TOH-ploh'),
    w('Leto', 'Лето', 'Summer', 'LEH-toh'),
    w('Jak', 'Јак', 'Strong (m)', 'yahk'),
    w('Prijatno', 'Пријатно', 'Pleasant', 'PREE-yaht-noh'),
  ], [
    s('Jak vetar.', 'A strong wind.'),
    s('Leti je toplo.', 'In summer it is warm.'),
    s('Prijatno vreme.', 'Pleasant weather.'),
  ], [
    q('"Vetar" means...', ['Rain', 'Wind', 'Snow', 'Sun'], 1),
    q('"Toplo" means...', ['Cold', 'Warm', 'Wet', 'Cloudy'], 1),
    q('"Leto" is the season:', ['Winter', 'Spring', 'Summer', 'Fall'], 2),
    q('"Jak" means...', ['Weak', 'Strong', 'Slow', 'Quiet'], 1),
  ]),

  // ════════════════════════════════════════════════════════════════════════
  // SECTION 4 · DAILY LIFE (Svaki dan)
  // ════════════════════════════════════════════════════════════════════════

  // ─── UNIT: At Home (Kod kuće) ───
  L('House', 'Kuća', 'home', [
    w('Kuća', 'Кућа', 'House', 'KOO-chah'),
    w('Soba', 'Соба', 'Room', 'SOH-bah'),
    w('Dom', 'Дом', 'Home', 'dohm'),
    w('Vrt', 'Врт', 'Garden', 'vurt'),
    w('Ulaz', 'Улаз', 'Entrance', 'OO-lahz'),
  ], [
    s('Velika kuća.', 'A big house.'),
    s('Moja soba.', 'My room.'),
    s('Naš dom.', 'Our home.'),
  ], [
    q('"Kuća" means...', ['Room', 'House', 'Door', 'Window'], 1),
    q('"Soba" means...', ['House', 'Room', 'Garden', 'Roof'], 1),
    q('"Dom" means...', ['Town', 'Home', 'Building', 'Yard'], 1),
    q('"Vrt" means...', ['Roof', 'Garden', 'Wall', 'Floor'], 1),
  ]),
  L('Door & Window', 'Vrata i Prozor', 'home', [
    w('Vrata', 'Врата', 'Door', 'VRAH-tah'),
    w('Prozor', 'Прозор', 'Window', 'PROH-zor'),
    w('Ključ', 'Кључ', 'Key', 'klyooch'),
    w('Otvoriti', 'Отворити', 'To open', 'oht-VOH-ree-tee'),
    w('Zatvoriti', 'Затворити', 'To close', 'zaht-VOH-ree-tee'),
  ], [
    s('Otvori vrata.', 'Open the door.'),
    s('Veliki prozor.', 'A big window.'),
    s('Imam ključ.', 'I have the key.'),
  ], [
    q('"Vrata" means...', ['Window', 'Door', 'Wall', 'Floor'], 1),
    q('"Prozor" means...', ['Door', 'Window', 'Roof', 'Stairs'], 1),
    q('"Ključ" means...', ['Lock', 'Key', 'Handle', 'Doorbell'], 1),
    q('"Otvoriti" means...', ['To close', 'To open', 'To break', 'To lock'], 1),
  ]),
  L('Table & Chair', 'Sto i Stolica', 'home', [
    w('Sto', 'Сто', 'Table', 'stoh'),
    w('Stolica', 'Столица', 'Chair', 'STOH-lee-tsah'),
    w('Sofa', 'Софа', 'Sofa', 'SOH-fah'),
    w('Lampa', 'Лампа', 'Lamp', 'LAHM-pah'),
    w('Sedi', 'Седи', 'Sit', 'SEH-dee'),
  ], [
    s('Sto je velik.', 'The table is big.'),
    s('Sedi na stolicu.', 'Sit on the chair.'),
    s('Mala lampa.', 'A small lamp.'),
  ], [
    q('"Sto" means...', ['Chair', 'Table', 'Bed', 'Door'], 1),
    q('"Stolica" means...', ['Table', 'Chair', 'Bed', 'Lamp'], 1),
    q('"Sofa" means...', ['Bed', 'Sofa', 'Chair', 'Stool'], 1),
    q('"Lampa" means...', ['Bulb', 'Lamp', 'Switch', 'Plug'], 1),
  ]),
  L('Bed', 'Krevet', 'home', [
    w('Krevet', 'Кревет', 'Bed', 'KREH-veht'),
    w('Jastuk', 'Јастук', 'Pillow', 'YAH-stook'),
    w('Ćebe', 'Ћебе', 'Blanket', 'CHEH-beh'),
    w('Pidžama', 'Пиџама', 'Pajamas', 'pee-JAH-mah'),
    w('Spavati', 'Спавати', 'To sleep', 'SPAH-vah-tee'),
  ], [
    s('Eren spava na krevetu.', 'Eren sleeps on the bed.'),
    s('Mekan jastuk.', 'A soft pillow.'),
    s('Toplo ćebe.', 'A warm blanket.'),
  ], [
    q('"Krevet" means...', ['Chair', 'Bed', 'Table', 'Door'], 1),
    q('"Jastuk" means...', ['Bed', 'Pillow', 'Blanket', 'Sheet'], 1),
    q('"Ćebe" means...', ['Pillow', 'Blanket', 'Sheet', 'Towel'], 1),
    q('"Spavati" means...', ['To eat', 'To sleep', 'To run', 'To play'], 1),
  ]),
  L('Kitchen & Bath', 'Kuhinja i Kupatilo', 'home', [
    w('Kuhinja', 'Кухиња', 'Kitchen', 'KOO-hee-nyah'),
    w('Kupatilo', 'Купатило', 'Bathroom', 'KOO-pah-tee-loh'),
    w('Šporet', 'Шпорет', 'Stove', 'SHPOH-reht'),
    w('Frižider', 'Фрижидер', 'Fridge', 'free-ZHEE-der'),
    w('Tuš', 'Туш', 'Shower', 'toosh'),
  ], [
    s('Kuhinja je čista.', 'The kitchen is clean.'),
    s('Idem u kupatilo.', 'I am going to the bathroom.'),
    s('Hrana je u frižideru.', 'The food is in the fridge.'),
  ], [
    q('"Kuhinja" means...', ['Bedroom', 'Kitchen', 'Bathroom', 'Garden'], 1),
    q('"Kupatilo" means...', ['Kitchen', 'Bedroom', 'Bathroom', 'Living room'], 2),
    q('"Šporet" means...', ['Sink', 'Stove', 'Oven', 'Fridge'], 1),
    q('"Frižider" means...', ['Stove', 'Sink', 'Fridge', 'Cabinet'], 2),
  ]),

  // ─── UNIT: Days (Dani) ───
  L('Mon-Wed', 'Pon, Uto, Sre', 'days', [
    w('Ponedeljak', 'Понедељак', 'Monday', 'POH-neh-deh-lyahk'),
    w('Utorak', 'Уторак', 'Tuesday', 'OO-toh-rahk'),
    w('Sreda', 'Среда', 'Wednesday', 'SREH-dah'),
    w('Dani', 'Дани', 'Days', 'DAH-nee'),
    w('Nedelja', 'Недеља', 'Week / Sunday', 'NEH-deh-lyah'),
  ], [
    s('Danas je ponedeljak.', 'Today is Monday.'),
    s('Sutra je utorak.', 'Tomorrow is Tuesday.'),
    s('Sedam dana u nedelji.', 'Seven days in a week.'),
  ], [
    q('"Ponedeljak" is...', ['Sunday', 'Monday', 'Tuesday', 'Friday'], 1),
    q('"Sreda" is...', ['Tuesday', 'Wednesday', 'Thursday', 'Saturday'], 1),
    q('After Monday comes...', ['Sreda', 'Utorak', 'Petak', 'Subota'], 1),
    q('"Dani" means...', ['Times', 'Days', 'Hours', 'Weeks'], 1),
  ]),
  L('Thu & Fri', 'Čet i Pet', 'days', [
    w('Četvrtak', 'Четвртак', 'Thursday', 'CHEHT-vur-tahk'),
    w('Petak', 'Петак', 'Friday', 'PEH-tahk'),
    w('Vikend', 'Викенд', 'Weekend', 'VEE-kehnd'),
    w('Slobodan', 'Слободан', 'Free / Off (m)', 'sloh-BOH-dahn'),
    w('Sutra', 'Сутра', 'Tomorrow', 'SOO-trah'),
  ], [
    s('Petak je lep dan.', 'Friday is a nice day.'),
    s('Vidimo se u četvrtak.', 'See you on Thursday.'),
    s('Sutra je vikend.', 'Tomorrow is the weekend.'),
  ], [
    q('"Četvrtak" is...', ['Wednesday', 'Thursday', 'Friday', 'Saturday'], 1),
    q('"Petak" is...', ['Friday', 'Saturday', 'Thursday', 'Sunday'], 0),
    q('"Vikend" means...', ['Workday', 'Weekend', 'Year', 'Hour'], 1),
    q('"Slobodan" means...', ['Busy', 'Free', 'Tired', 'Sick'], 1),
  ]),
  L('Weekend', 'Vikend', 'days', [
    w('Subota', 'Субота', 'Saturday', 'SOO-boh-tah'),
    w('Nedelja', 'Недеља', 'Sunday', 'NEH-deh-lyah'),
    w('Vikend', 'Викенд', 'Weekend', 'VEE-kehnd'),
    w('Odmor', 'Одмор', 'Rest', 'OHD-mor'),
    w('Slobodno', 'Слободно', 'Free time', 'sloh-BOHD-noh'),
  ], [
    s('Subota je moj dan.', 'Saturday is my day.'),
    s('Lep vikend!', 'Have a nice weekend!'),
    s('Treba mi odmor.', 'I need rest.'),
  ], [
    q('"Subota" is...', ['Friday', 'Saturday', 'Sunday', 'Monday'], 1),
    q('"Nedelja" can mean...', ['Saturday only', 'Sunday only', 'Sunday or Week', 'Friday'], 2),
    q('"Vikend" means...', ['Workday', 'Weekend', 'Year', 'Hour'], 1),
    q('"Odmor" means...', ['Work', 'Rest', 'Travel', 'Visit'], 1),
  ]),
  L('Today & Tomorrow', 'Danas i Sutra', 'days', [
    w('Danas', 'Данас', 'Today', 'DAH-nahs'),
    w('Sutra', 'Сутра', 'Tomorrow', 'SOO-trah'),
    w('Juče', 'Јуче', 'Yesterday', 'YOO-cheh'),
    w('Sada', 'Сада', 'Now', 'SAH-dah'),
    w('Nedelja', 'Недеља', 'Week', 'NEH-deh-lyah'),
  ], [
    s('Danas je lep dan.', 'Today is a nice day.'),
    s('Vidimo se sutra.', 'See you tomorrow.'),
    s('Juče sam radio.', 'Yesterday I worked.'),
  ], [
    q('"Danas" means...', ['Yesterday', 'Today', 'Tomorrow', 'Always'], 1),
    q('"Sutra" means...', ['Today', 'Tomorrow', 'Yesterday', 'Now'], 1),
    q('"Juče" means...', ['Today', 'Tomorrow', 'Yesterday', 'Soon'], 2),
    q('"Sada" means...', ['Then', 'Soon', 'Now', 'Later'], 2),
  ]),

  // ─── UNIT: Verbs (Glagoli) ───
  L('To Be / Have', 'Biti / Imati', 'verbs', [
    w('Biti', 'Бити', 'To be', 'BEE-tee'),
    w('Imati', 'Имати', 'To have', 'EE-mah-tee'),
    w('Imam', 'Имам', 'I have', 'EE-mahm'),
    w('Postoji', 'Постоји', 'Exists', 'POH-stoh-yee'),
    w('Nemam', 'Немам', 'I don\'t have', 'NEH-mahm'),
  ], [
    s('Imam mačku.', 'I have a cat.'),
    s('Ja sam srećan.', 'I am happy.'),
    s('Nemam vode.', 'I don\'t have water.'),
  ], [
    q('"Biti" means...', ['To have', 'To be', 'To go', 'To eat'], 1),
    q('"Imati" means...', ['To want', 'To have', 'To love', 'To know'], 1),
    q('"Imam mačku" =', ['I want a cat', 'I have a cat', 'I see a cat', 'I am a cat'], 1),
    q('"Nemam" means...', ['I have', 'I don\'t have', 'I want', 'I love'], 1),
  ]),
  L('To Go / Come', 'Ići / Doći', 'verbs', [
    w('Ići', 'Ићи', 'To go', 'EE-chee'),
    w('Doći', 'Доћи', 'To come', 'DOH-chee'),
    w('Hodati', 'Ходати', 'To walk', 'HOH-dah-tee'),
    w('Idem', 'Идем', 'I go', 'EE-dem'),
    w('Brzo', 'Брзо', 'Quickly', 'BUR-zoh'),
  ], [
    s('Idem u park.', 'I am going to the park.'),
    s('Dođi ovamo!', 'Come here!'),
    s('Hodam brzo.', 'I walk quickly.'),
  ], [
    q('"Ići" means...', ['To come', 'To go', 'To stay', 'To run'], 1),
    q('"Doći" means...', ['To go', 'To come', 'To leave', 'To stop'], 1),
    q('"Hodati" means...', ['To run', 'To walk', 'To jump', 'To swim'], 1),
    q('"Brzo" means...', ['Slowly', 'Quickly', 'Loudly', 'Quietly'], 1),
  ]),
  L('To Eat / Drink', 'Jesti / Piti', 'verbs', [
    w('Jesti', 'Јести', 'To eat', 'YEH-stee'),
    w('Piti', 'Пити', 'To drink', 'PEE-tee'),
    w('Pijem', 'Пијем', 'I drink', 'PEE-yem'),
    w('Jedem', 'Једем', 'I eat', 'YEH-dem'),
    w('Sviđa mi se', 'Свиђа ми се', 'I like it', 'SVEE-jah mee seh'),
  ], [
    s('Volim da jedem.', 'I love to eat.'),
    s('Pijem vodu.', 'I drink water.'),
    s('Sviđa mi se kafa.', 'I like coffee.'),
  ], [
    q('"Jesti" means...', ['To drink', 'To eat', 'To sleep', 'To go'], 1),
    q('"Piti" means...', ['To eat', 'To drink', 'To love', 'To sleep'], 1),
    q('"Pijem" means...', ['I eat', 'I drink', 'I sleep', 'I work'], 1),
    q('"Sviđa mi se" means...', ['I love', 'I like it', 'I need', 'I see'], 1),
  ]),
  L('To Love / Want', 'Voleti / Želeti', 'verbs', [
    w('Voleti', 'Волети', 'To love', 'VOH-leh-tee'),
    w('Želeti', 'Желети', 'To want', 'ZHEH-leh-tee'),
    w('Volim', 'Волим', 'I love', 'VOH-leem'),
    w('Treba mi', 'Треба ми', 'I need', 'TREH-bah mee'),
    w('Najdraži', 'Најдражи', 'Favorite', 'NAI-drah-zhee'),
  ], [
    s('Volim Erena.', 'I love Eren.'),
    s('Želim vodu.', 'I want water.'),
    s('Treba mi pomoć.', 'I need help.'),
  ], [
    q('"Voleti" means...', ['To want', 'To love', 'To know', 'To eat'], 1),
    q('"Želeti" means...', ['To love', 'To want', 'To need', 'To have'], 1),
    q('"Volim te" =', ['I see you', 'I love you', 'I know you', 'I help you'], 1),
    q('"Najdraži" means...', ['Tallest', 'Favorite', 'Newest', 'Oldest'], 1),
  ]),
  L('To Sleep / Work', 'Spavati / Raditi', 'verbs', [
    w('Spavati', 'Спавати', 'To sleep', 'SPAH-vah-tee'),
    w('Raditi', 'Радити', 'To work', 'RAH-dee-tee'),
    w('Igrati', 'Играти', 'To play', 'EE-grah-tee'),
    w('Učiti', 'Учити', 'To learn / study', 'OO-chee-tee'),
    w('Odmarati', 'Одмарати', 'To rest', 'ohd-MAH-rah-tee'),
  ], [
    s('Eren voli da spava.', 'Eren loves to sleep.'),
    s('Tata radi.', 'Dad is working.'),
    s('Učim srpski.', 'I am learning Serbian.'),
  ], [
    q('"Spavati" means...', ['To work', 'To sleep', 'To eat', 'To play'], 1),
    q('"Raditi" means...', ['To play', 'To work', 'To rest', 'To learn'], 1),
    q('"Igrati" means...', ['To sleep', 'To eat', 'To play', 'To work'], 2),
    q('"Učiti" means...', ['To play', 'To rest', 'To learn', 'To work'], 2),
  ]),

  // ─── UNIT: Emotions (Emocije) ───
  L('Happy', 'Srećan', 'emotions', [
    w('Srećan', 'Срећан', 'Happy (m)', 'SREH-chan'),
    w('Srećna', 'Срећна', 'Happy (f)', 'SREH-chnah'),
    w('Srećni', 'Срећни', 'Happy (pl)', 'SREH-chnee'),
    w('Smeh', 'Смех', 'Laughter', 'smeh'),
    w('Osmeh', 'Осмех', 'Smile', 'OHS-meh'),
  ], [
    s('Eren je srećan.', 'Eren is happy.'),
    s('Mama je srećna.', 'Mom is happy.'),
    s('Lep osmeh.', 'A beautiful smile.'),
  ], [
    q('"Srećan" means...', ['Sad', 'Happy', 'Tired', 'Angry'], 1),
    q('Use "Srećna" for...', ['Boys', 'Girls', 'Animals', 'Numbers'], 1),
    q('"Smeh" means...', ['Cry', 'Laughter', 'Frown', 'Yell'], 1),
    q('"Osmeh" means...', ['Tear', 'Smile', 'Voice', 'Word'], 1),
  ]),
  L('Sad & Angry', 'Tužan i Ljut', 'emotions', [
    w('Tužan', 'Тужан', 'Sad', 'TOO-zhahn'),
    w('Ljut', 'Љут', 'Angry', 'lyoot'),
    w('Plač', 'Плач', 'Cry / Crying', 'plahch'),
    w('Suze', 'Сузе', 'Tears', 'SOO-zeh'),
    w('Smiriti se', 'Смирити се', 'To calm down', 'smee-REE-tee seh'),
  ], [
    s('Eren je tužan.', 'Eren is sad.'),
    s('Tata je ljut.', 'Dad is angry.'),
    s('Smiri se, prijatelju.', 'Calm down, friend.'),
  ], [
    q('"Tužan" means...', ['Happy', 'Sad', 'Tired', 'Angry'], 1),
    q('"Ljut" means...', ['Calm', 'Angry', 'Tired', 'Hungry'], 1),
    q('Opposite of "Srećan":', ['Lep', 'Tužan', 'Mali', 'Brz'], 1),
    q('"Suze" means...', ['Smiles', 'Tears', 'Words', 'Yells'], 1),
  ]),
  L('Tired & Hungry', 'Umoran i Gladan', 'emotions', [
    w('Umoran', 'Уморан', 'Tired (m)', 'OO-moh-rahn'),
    w('Gladan', 'Гладан', 'Hungry (m)', 'GLAH-dahn'),
    w('Slab', 'Слаб', 'Weak', 'slahb'),
    w('Energija', 'Енергија', 'Energy', 'eh-NEHR-gee-yah'),
    w('Jelo', 'Јело', 'Meal', 'YEH-loh'),
  ], [
    s('Ja sam umoran.', 'I am tired.'),
    s('Mačka je gladna.', 'The cat is hungry.'),
    s('Treba mi energija.', 'I need energy.'),
  ], [
    q('"Umoran" means...', ['Hungry', 'Tired', 'Awake', 'Bored'], 1),
    q('"Gladan" means...', ['Tired', 'Hungry', 'Thirsty', 'Cold'], 1),
    q('Eren wants food when...', ['Umoran', 'Gladan', 'Žedan', 'Srećan'], 1),
    q('"Jelo" means...', ['Drink', 'Meal', 'Snack', 'Plate'], 1),
  ]),
  L('Thirsty & Scared', 'Žedan i Uplašen', 'emotions', [
    w('Žedan', 'Жедан', 'Thirsty', 'ZHEH-dahn'),
    w('Uplašen', 'Уплашен', 'Scared', 'OO-plah-shehn'),
    w('Uzbuđen', 'Узбуђен', 'Excited', 'ooz-BOO-jehn'),
    w('Strah', 'Страх', 'Fear', 'strah'),
    w('Hrabar', 'Храбар', 'Brave', 'HRAH-bar'),
  ], [
    s('Žedan sam.', 'I am thirsty.'),
    s('Uplašen pas.', 'A scared dog.'),
    s('Hrabar prijatelj.', 'A brave friend.'),
  ], [
    q('"Žedan" means...', ['Hungry', 'Thirsty', 'Tired', 'Sad'], 1),
    q('"Uplašen" means...', ['Excited', 'Scared', 'Surprised', 'Angry'], 1),
    q('"Uzbuđen" means...', ['Tired', 'Excited', 'Hungry', 'Calm'], 1),
    q('"Hrabar" means...', ['Scared', 'Brave', 'Smart', 'Strong'], 1),
  ]),

  // ─── UNIT: Shopping (Kupovina) ───
  L('Store & Money', 'Prodavnica i Novac', 'shop', [
    w('Prodavnica', 'Продавница', 'Store', 'proh-DAHV-nee-tsah'),
    w('Novac', 'Новац', 'Money', 'NOH-vahts'),
    w('Dinar', 'Динар', 'Dinar', 'DEE-nahr'),
    w('Evri', 'Еври', 'Euros', 'EHV-ree'),
    w('Banka', 'Банка', 'Bank', 'BAHN-kah'),
  ], [
    s('Idem u prodavnicu.', 'I am going to the store.'),
    s('Treba mi novac.', 'I need money.'),
    s('Sto dinara.', 'A hundred dinars.'),
  ], [
    q('"Prodavnica" means...', ['Bank', 'Store', 'School', 'Park'], 1),
    q('"Novac" means...', ['Card', 'Money', 'Time', 'Help'], 1),
    q('"Dinar" is...', ['Serbian currency', 'A drink', 'A food', 'A day'], 0),
    q('"Banka" means...', ['Store', 'Bank', 'Bench', 'Side'], 1),
  ]),
  L('How Much?', 'Koliko?', 'shop', [
    w('Koliko', 'Колико', 'How much', 'KOH-lee-koh'),
    w('Cena', 'Цена', 'Price', 'TSEH-nah'),
    w('Skupo', 'Скупо', 'Expensive', 'SKOO-poh'),
    w('Košta', 'Кошта', 'Costs', 'KOHSH-tah'),
    w('Popust', 'Попуст', 'Discount', 'POH-poost'),
  ], [
    s('Koliko košta?', 'How much does it cost?'),
    s('To je skupo.', 'That is expensive.'),
    s('Imam popust.', 'I have a discount.'),
  ], [
    q('"Koliko" means...', ['Where', 'How much', 'Why', 'When'], 1),
    q('"Cena" means...', ['Money', 'Price', 'Sale', 'Tax'], 1),
    q('"Skupo" means...', ['Cheap', 'Expensive', 'Free', 'Used'], 1),
    q('"Popust" means...', ['Bill', 'Discount', 'Tax', 'Tip'], 1),
  ]),
  L('Cheap & Bill', 'Jeftino i Račun', 'shop', [
    w('Jeftino', 'Јефтино', 'Cheap', 'YEHF-tee-noh'),
    w('Račun', 'Рачун', 'Bill / Receipt', 'RAH-choon'),
    w('Kasa', 'Каса', 'Register', 'KAH-sah'),
    w('Pola cene', 'Пола цене', 'Half price', 'POH-lah TSEH-neh'),
    w('Povrat', 'Поврат', 'Return / Refund', 'POH-vraht'),
  ], [
    s('Ovo je jeftino.', 'This is cheap.'),
    s('Račun, molim.', 'The bill, please.'),
    s('Pola cene danas!', 'Half price today!'),
  ], [
    q('"Jeftino" means...', ['Expensive', 'Cheap', 'Big', 'Old'], 1),
    q('"Račun" means...', ['Money', 'Card', 'Bill / Receipt', 'List'], 2),
    q('Opposite of "skupo":', ['Lepo', 'Veliko', 'Jeftino', 'Toplo'], 2),
    q('"Kasa" means...', ['Mall', 'Register', 'Bag', 'Cart'], 1),
  ]),

  // ─── UNIT: Phrases (Fraze) ───
  L('Understand', 'Razumem', 'phrases', [
    w('Razumem', 'Разумем', 'I understand', 'RAH-zoo-mem'),
    w('Ne razumem', 'Не разумем', 'I don\'t understand', 'neh RAH-zoo-mem'),
    w('Znati', 'Знати', 'To know', 'ZNAH-tee'),
    w('Polako', 'Полако', 'Slowly', 'POH-lah-koh'),
    w('Jasno', 'Јасно', 'Clear', 'YAHS-noh'),
  ], [
    s('Razumem te.', 'I understand you.'),
    s('Izvini, ne razumem.', 'Sorry, I don\'t understand.'),
    s('Polako, molim te.', 'Slowly, please.'),
  ], [
    q('"Razumem" means...', ['I know', 'I understand', 'I see', 'I hear'], 1),
    q('"Ne razumem" means...', ['I know', 'I understand', 'I don\'t understand', 'I disagree'], 2),
    q('"Polako" means...', ['Quickly', 'Slowly', 'Loudly', 'Now'], 1),
    q('"Jasno" means...', ['Cloudy', 'Clear', 'Loud', 'Quiet'], 1),
  ]),
  L('Help', 'Pomoć', 'phrases', [
    w('Pomozite!', 'Помозите!', 'Help!', 'POH-moh-zee-teh'),
    w('Pomoć', 'Помоћ', 'Help', 'POH-mohch'),
    w('Hitno', 'Хитно', 'Urgent', 'HEET-noh'),
    w('Sigurno', 'Сигурно', 'Safely / For sure', 'see-GOOR-noh'),
    w('Dobro', 'Добро', 'Good / Okay', 'DOH-broh'),
  ], [
    s('Pomozite, molim!', 'Help, please!'),
    s('Treba mi pomoć.', 'I need help.'),
    s('Sve je dobro.', 'Everything is good.'),
  ], [
    q('"Pomozite" means...', ['Stop', 'Help', 'Wait', 'Go'], 1),
    q('"Pomoć" means...', ['Stop', 'Help', 'Time', 'End'], 1),
    q('"Hitno" means...', ['Urgent', 'Calm', 'Soon', 'Late'], 0),
    q('"Sigurno" means...', ['Maybe', 'Safely / For sure', 'Quickly', 'Slowly'], 1),
  ]),
  L('Speak English?', 'Govorite engleski?', 'phrases', [
    w('Govoriti', 'Говорити', 'To speak', 'goh-VOH-ree-tee'),
    w('Engleski', 'Енглески', 'English', 'ehn-GLEH-skee'),
    w('Srpski', 'Српски', 'Serbian', 'SUR-pskee'),
    w('Jezik', 'Језик', 'Language', 'YEH-zeek'),
    w('Učim', 'Учим', 'I am learning', 'OO-cheem'),
  ], [
    s('Govorite li engleski?', 'Do you speak English?'),
    s('Učim srpski.', 'I am learning Serbian.'),
    s('Volim ovaj jezik.', 'I love this language.'),
  ], [
    q('"Govoriti" means...', ['To hear', 'To speak', 'To read', 'To write'], 1),
    q('"Engleski" means...', ['Spanish', 'English', 'German', 'French'], 1),
    q('"Srpski" means...', ['Russian', 'Croatian', 'Serbian', 'Slovak'], 2),
    q('"Učim" means...', ['I teach', 'I am learning', 'I forget', 'I read'], 1),
  ]),
  L('No Problem', 'Nema problema', 'phrases', [
    w('Nema problema', 'Нема проблема', 'No problem', 'NEH-mah proh-BLEH-mah'),
    w('U redu', 'У реду', 'Okay', 'oo REH-doo'),
    w('Naravno', 'Наравно', 'Of course', 'NAH-rahv-noh'),
    w('Sjajno', 'Сјајно', 'Great', 'SYAI-noh'),
    w('Sve je dobro', 'Све је добро', 'Everything is good', 'sveh yeh DOH-broh'),
  ], [
    s('Nema problema!', 'No problem!'),
    s('U redu, hvala.', 'Okay, thanks.'),
    s('Sjajno, prijatelju!', 'Great, friend!'),
  ], [
    q('"Nema problema" means...', ['Big problem', 'No problem', 'Maybe', 'Yes'], 1),
    q('"U redu" means...', ['Stop', 'Okay', 'Sorry', 'Goodbye'], 1),
    q('Reply to "thanks":', ['Doviđenja', 'Nema problema / U redu', 'Da', 'Ne'], 1),
    q('"Sjajno" means...', ['Bad', 'Great', 'Sad', 'Slow'], 1),
  ]),

  // ════════════════════════════════════════════════════════════════════════
  // SECTION 5 · GOING OUT (Izlazak)
  // ════════════════════════════════════════════════════════════════════════

  // ─── UNIT: Telling Time (Vreme) ───
  L('What Time?', 'Koliko je sati?', 'time', [
    w('Sat', 'Сат', 'Hour / Clock', 'saht'),
    w('Koliko je sati?', 'Колико је сати?', 'What time is it?', 'KOH-lee-koh yeh SAH-tee'),
    w('Vreme', 'Време', 'Time / Weather', 'VREH-meh'),
    w('Sada', 'Сада', 'Now', 'SAH-dah'),
    w('Posle', 'После', 'After', 'POHS-leh'),
  ], [
    s('Koliko je sati?', 'What time is it?'),
    s('Šest sati.', 'Six o\'clock.'),
    s('Posle deset.', 'After ten.'),
  ], [
    q('"Sat" means...', ['Hour / Clock', 'Year', 'Week', 'Minute'], 0),
    q('Asking the time:', ['Kako se zoveš?', 'Koliko je sati?', 'Odakle si?', 'Kako si?'], 1),
    q('"Vreme" can mean...', ['Time only', 'Weather only', 'Both', 'Neither'], 2),
    q('"Posle" means...', ['Before', 'After', 'During', 'Now'], 1),
  ]),
  L('Minute & Second', 'Minut i Sekunda', 'time', [
    w('Minut', 'Минут', 'Minute', 'MEE-noot'),
    w('Sekunda', 'Секунда', 'Second', 'SEH-koon-dah'),
    w('Polovina', 'Половина', 'Half', 'poh-loh-VEE-nah'),
    w('Četvrt', 'Четврт', 'Quarter', 'CHEHT-vurt'),
    w('Brzo', 'Брзо', 'Quickly', 'BUR-zoh'),
  ], [
    s('Sačekaj minut.', 'Wait a minute.'),
    s('Pet sekundi.', 'Five seconds.'),
    s('Pola sata.', 'Half an hour.'),
  ], [
    q('"Minut" means...', ['Hour', 'Minute', 'Second', 'Day'], 1),
    q('"Sekunda" means...', ['Minute', 'Second', 'Hour', 'Year'], 1),
    q('"Polovina" means...', ['Quarter', 'Half', 'Whole', 'Third'], 1),
    q('"Četvrt" means...', ['Half', 'Third', 'Quarter', 'Whole'], 2),
  ]),
  L('Now & Later', 'Sada i Kasnije', 'time', [
    w('Sada', 'Сада', 'Now', 'SAH-dah'),
    w('Kasnije', 'Касније', 'Later', 'KAH-snee-yeh'),
    w('Odmah', 'Одмах', 'Right away', 'OHD-mah'),
    w('Čekati', 'Чекати', 'To wait', 'CHEH-kah-tee'),
    w('Već', 'Већ', 'Already', 'vehch'),
  ], [
    s('Idemo sada.', 'Let\'s go now.'),
    s('Vidimo se kasnije.', 'See you later.'),
    s('Odmah dolazim!', 'I\'m coming right away!'),
  ], [
    q('"Sada" means...', ['Later', 'Now', 'Soon', 'Then'], 1),
    q('"Kasnije" means...', ['Now', 'Later', 'Yesterday', 'Today'], 1),
    q('"Odmah" means...', ['Slowly', 'Right away', 'Maybe', 'Tomorrow'], 1),
    q('"Već" means...', ['Almost', 'Already', 'Never', 'Soon'], 1),
  ]),
  L('Early & Late', 'Rano i Kasno', 'time', [
    w('Rano', 'Рано', 'Early', 'RAH-noh'),
    w('Kasno', 'Касно', 'Late', 'KAHS-noh'),
    w('Na vreme', 'На време', 'On time', 'nah VREH-meh'),
    w('Žurim', 'Журим', 'I\'m hurrying', 'ZHOO-reem'),
    w('Zakasnio', 'Закаснио', 'Late (m)', 'zah-KAH-snee-oh'),
  ], [
    s('Ustajem rano.', 'I get up early.'),
    s('Kasno je.', 'It is late.'),
    s('Stigao na vreme.', 'Arrived on time.'),
  ], [
    q('"Rano" means...', ['Late', 'Early', 'Soon', 'Now'], 1),
    q('"Kasno" means...', ['Early', 'Late', 'Soon', 'Then'], 1),
    q('"Na vreme" means...', ['Late', 'Early', 'On time', 'Never'], 2),
    q('"Žurim" means...', ['I rest', 'I\'m hurrying', 'I sleep', 'I wait'], 1),
  ]),

  // ─── UNIT: Around Town (Po gradu) ───
  L('Directions', 'Pravac', 'town', [
    w('Levo', 'Лево', 'Left', 'LEH-voh'),
    w('Desno', 'Десно', 'Right', 'DEHS-noh'),
    w('Pravo', 'Право', 'Straight', 'PRAH-voh'),
    w('Gore', 'Горе', 'Up', 'GOH-reh'),
    w('Dole', 'Доле', 'Down', 'DOH-leh'),
  ], [
    s('Idi levo.', 'Go left.'),
    s('Pravo, pa desno.', 'Straight, then right.'),
    s('Gore i dole.', 'Up and down.'),
  ], [
    q('"Levo" means...', ['Right', 'Left', 'Up', 'Down'], 1),
    q('"Desno" means...', ['Left', 'Right', 'Front', 'Back'], 1),
    q('"Pravo" means...', ['Straight', 'Around', 'Up', 'Stop'], 0),
    q('"Gore" means...', ['Down', 'Up', 'Left', 'Behind'], 1),
  ]),
  L('Places', 'Mesta', 'town', [
    w('Park', 'Парк', 'Park', 'pahrk'),
    w('Škola', 'Школа', 'School', 'SHKOH-lah'),
    w('Bolnica', 'Болница', 'Hospital', 'BOHL-nee-tsah'),
    w('Restoran', 'Ресторан', 'Restaurant', 'reh-stoh-RAHN'),
    w('Pošta', 'Пошта', 'Post office', 'POHSH-tah'),
  ], [
    s('Idem u park.', 'I am going to the park.'),
    s('Škola je velika.', 'The school is big.'),
    s('Restoran je blizu.', 'The restaurant is near.'),
  ], [
    q('"Park" means...', ['Park', 'Office', 'Garden', 'Yard'], 0),
    q('"Škola" means...', ['House', 'School', 'Hospital', 'Church'], 1),
    q('"Bolnica" means...', ['Bank', 'School', 'Hospital', 'Library'], 2),
    q('"Restoran" means...', ['Cafe', 'Restaurant', 'Bar', 'Hotel'], 1),
  ]),
  L('Transport', 'Prevoz', 'town', [
    w('Auto', 'Ауто', 'Car', 'OW-toh'),
    w('Autobus', 'Аутобус', 'Bus', 'OW-toh-boos'),
    w('Voz', 'Воз', 'Train', 'voz'),
    w('Taksi', 'Такси', 'Taxi', 'TAHK-see'),
    w('Bicikl', 'Бицикл', 'Bicycle', 'bee-TSEE-kl'),
  ], [
    s('Crveni auto.', 'A red car.'),
    s('Voz dolazi.', 'The train is coming.'),
    s('Idem taksijem.', 'I am going by taxi.'),
  ], [
    q('"Auto" means...', ['Bike', 'Bus', 'Car', 'Truck'], 2),
    q('"Autobus" means...', ['Train', 'Bus', 'Plane', 'Boat'], 1),
    q('"Voz" means...', ['Car', 'Bus', 'Train', 'Bike'], 2),
    q('"Bicikl" means...', ['Bike', 'Scooter', 'Skateboard', 'Bus'], 0),
  ]),
  L('Where?', 'Gde?', 'town', [
    w('Gde', 'Где', 'Where', 'gdeh'),
    w('Ovde', 'Овде', 'Here', 'OHV-deh'),
    w('Tamo', 'Тамо', 'There', 'TAH-moh'),
    w('Blizu', 'Близу', 'Near', 'BLEE-zoo'),
    w('Daleko', 'Далеко', 'Far', 'DAH-leh-koh'),
  ], [
    s('Gde si?', 'Where are you?'),
    s('Tamo je park.', 'The park is there.'),
    s('Daleko je.', 'It is far.'),
  ], [
    q('"Gde" means...', ['When', 'Where', 'Why', 'How'], 1),
    q('"Ovde" means...', ['There', 'Here', 'Where', 'Inside'], 1),
    q('"Tamo" means...', ['Here', 'There', 'Now', 'Then'], 1),
    q('"Daleko" means...', ['Near', 'Far', 'Inside', 'Behind'], 1),
  ]),

  // ─── UNIT: At the Café (U kafiću) ───
  L('Order', 'Naručivanje', 'cafe', [
    w('Naručiti', 'Наручити', 'To order', 'nah-ROO-chee-tee'),
    w('Želim', 'Желим', 'I want', 'ZHEH-leem'),
    w('Hoćemo', 'Хоћемо', 'We want', 'HOH-cheh-moh'),
    w('Jelo', 'Јело', 'Meal', 'YEH-loh'),
    w('Piće', 'Пиће', 'Drink', 'PEE-cheh'),
  ], [
    s('Želim kafu, molim.', 'I want a coffee, please.'),
    s('Hoćemo jelo i piće.', 'We want food and drink.'),
    s('Šta želite?', 'What would you like?'),
  ], [
    q('"Naručiti" means...', ['To eat', 'To order', 'To pay', 'To leave'], 1),
    q('"Želim" means...', ['I have', 'I love', 'I want', 'I see'], 2),
    q('"Hoćemo" means...', ['I want', 'You want', 'We want', 'They want'], 2),
    q('"Piće" means...', ['Food', 'Drink', 'Glass', 'Bottle'], 1),
  ]),
  L('Menu', 'Jelovnik', 'cafe', [
    w('Jelovnik', 'Јеловник', 'Menu', 'YEH-lov-neek'),
    w('Konobar', 'Конобар', 'Waiter', 'KOH-noh-bahr'),
    w('Sto', 'Сто', 'Table', 'stoh'),
    w('Rezervacija', 'Резервација', 'Reservation', 'reh-zehr-vah-TSEE-yah'),
    w('Sveže', 'Свеже', 'Fresh', 'SVEH-zheh'),
  ], [
    s('Jelovnik, molim.', 'The menu, please.'),
    s('Konobar dolazi.', 'The waiter is coming.'),
    s('Sto za dvoje.', 'A table for two.'),
  ], [
    q('"Jelovnik" means...', ['Bill', 'Menu', 'Tip', 'Plate'], 1),
    q('"Konobar" means...', ['Cook', 'Waiter', 'Owner', 'Customer'], 1),
    q('"Rezervacija" means...', ['Tip', 'Reservation', 'Refund', 'Order'], 1),
    q('Ask for the menu:', ['Račun, molim', 'Jelovnik, molim', 'Voda, molim', 'Hvala'], 1),
  ]),
  L('Polite Forms', 'Učtivo obraćanje', 'cafe', [
    w('Molim vas', 'Молим вас', 'Please (formal)', 'MOH-leem vahs'),
    w('Hvala vam', 'Хвала вам', 'Thank you (formal)', 'HVAH-lah vahm'),
    w('Izvolite', 'Изволите', 'Here you go', 'eez-VOH-lee-teh'),
    w('Oprostite', 'Опростите', 'Excuse me', 'oh-PROH-stee-teh'),
    w('Gospodine', 'Господине', 'Sir', 'goh-SPOH-dee-neh'),
  ], [
    s('Molim vas, čaj.', 'Please, tea.'),
    s('Hvala vam puno!', 'Thank you very much!'),
    s('Oprostite, gospodine.', 'Excuse me, sir.'),
  ], [
    q('"Molim vas" is...', ['Casual please', 'Formal please', 'Sorry', 'Hello'], 1),
    q('"Hvala vam" is...', ['Casual thanks', 'Formal thanks', 'Greeting', 'Apology'], 1),
    q('Used with strangers / elders:', ['Molim te', 'Molim vas', 'Hej', 'Ćao'], 1),
    q('"Gospodine" means...', ['Mrs.', 'Sir', 'Friend', 'Boss'], 1),
  ]),
  L('Pay', 'Plaćanje', 'cafe', [
    w('Platiti', 'Платити', 'To pay', 'PLAH-tee-tee'),
    w('Kartica', 'Картица', 'Card', 'KAR-tee-tsah'),
    w('Gotovina', 'Готовина', 'Cash', 'goh-TOH-vee-nah'),
    w('Račun', 'Рачун', 'Bill', 'RAH-choon'),
    w('Napojnica', 'Напојница', 'Tip', 'NAH-poy-nee-tsah'),
  ], [
    s('Mogu li da platim?', 'Can I pay?'),
    s('Karticom ili gotovinom?', 'By card or cash?'),
    s('Mala napojnica.', 'A small tip.'),
  ], [
    q('"Platiti" means...', ['To pay', 'To eat', 'To leave', 'To order'], 0),
    q('"Kartica" means...', ['Cash', 'Card', 'Bill', 'Receipt'], 1),
    q('"Gotovina" means...', ['Card', 'Cash', 'Tip', 'Coin'], 1),
    q('"Napojnica" means...', ['Bill', 'Tip', 'Coin', 'Discount'], 1),
  ]),

  // ─── UNIT: Bigger Numbers (Veći brojevi) ───
  L('11-13', '11-13', 'numbers-big', [
    w('Jedanaest', 'Једанаест', '11', 'YEH-dah-nah-est'),
    w('Dvanaest', 'Дванаест', '12', 'DVAH-nah-est'),
    w('Trinaest', 'Тринаест', '13', 'TREE-nah-est'),
    w('Cifre', 'Цифре', 'Digits', 'TSEEF-reh'),
    w('Brojati', 'Бројати', 'To count', 'BROH-yah-tee'),
  ], [
    s('Imam dvanaest godina.', 'I am twelve years old.'),
    s('Trinaest mačaka!', 'Thirteen cats!'),
    s('Brojim do deset.', 'I count to ten.'),
  ], [
    q('"Jedanaest" is...', ['10', '11', '12', '13'], 1),
    q('"Dvanaest" is...', ['11', '12', '13', '14'], 1),
    q('"Trinaest" is...', ['12', '13', '14', '15'], 1),
    q('"Brojati" means...', ['To read', 'To count', 'To write', 'To say'], 1),
  ]),
  L('14-17', '14-17', 'numbers-big', [
    w('Četrnaest', 'Четрнаест', '14', 'CHEH-tur-nah-est'),
    w('Petnaest', 'Петнаест', '15', 'PET-nah-est'),
    w('Šesnaest', 'Шеснаест', '16', 'SHES-nah-est'),
    w('Sedamnaest', 'Седамнаест', '17', 'SEH-dahm-nah-est'),
    w('Brojanje', 'Бројање', 'Counting', 'BROH-yah-nyeh'),
  ], [
    s('Petnaest minuta.', 'Fifteen minutes.'),
    s('Sedamnaest godina.', 'Seventeen years.'),
    s('Brojanje do dvadeset.', 'Counting to twenty.'),
  ], [
    q('"Petnaest" is...', ['14', '15', '16', '17'], 1),
    q('"Šesnaest" is...', ['15', '16', '17', '18'], 1),
    q('"Sedamnaest" is...', ['16', '17', '18', '19'], 1),
    q('"Četrnaest" is...', ['13', '14', '15', '16'], 1),
  ]),
  L('20-50', '20-50', 'numbers-big', [
    w('Dvadeset', 'Двадесет', '20', 'DVAH-deh-seht'),
    w('Trideset', 'Тридесет', '30', 'TREE-deh-seht'),
    w('Četrdeset', 'Четрдесет', '40', 'CHEH-tur-deh-seht'),
    w('Pedeset', 'Педесет', '50', 'PEH-deh-seht'),
    w('Koliko godina?', 'Колико година?', 'How old?', 'KOH-lee-koh GOH-dee-nah'),
  ], [
    s('Dvadeset prijatelja.', 'Twenty friends.'),
    s('Pedeset eura.', 'Fifty euros.'),
    s('Koliko godina imaš?', 'How old are you?'),
  ], [
    q('"Dvadeset" is...', ['10', '15', '20', '25'], 2),
    q('"Trideset" is...', ['20', '30', '40', '50'], 1),
    q('"Pedeset" is...', ['40', '50', '60', '70'], 1),
    q('"Četrdeset" is...', ['30', '40', '50', '60'], 1),
  ]),
  L('100 & 1000', '100 i 1000', 'numbers-big', [
    w('Sto', 'Сто', '100', 'stoh'),
    w('Hiljada', 'Хиљада', '1000', 'HEE-lyah-dah'),
    w('Milion', 'Милион', 'Million', 'MEE-lee-ohn'),
    w('Mnogo', 'Много', 'A lot', 'MNOH-goh'),
    w('Novac', 'Новац', 'Money', 'NOH-vahts'),
  ], [
    s('Sto eura.', 'A hundred euros.'),
    s('Hiljada zvezda.', 'A thousand stars.'),
    s('Mnogo novca.', 'A lot of money.'),
  ], [
    q('"Sto" as a number is...', ['10', '50', '100', '1000'], 2),
    q('"Hiljada" is...', ['100', '500', '1000', '10000'], 2),
    q('"Milion" is...', ['1,000', '10,000', '100,000', '1,000,000'], 3),
    q('A hundred is...', ['Pet', 'Sto', 'Hiljada', 'Deset'], 1),
  ]),

  // ─── UNIT: Conjugations (Konjugacije) ───
  L('To Be · Singular', 'Biti — jednina', 'conjug', [
    w('Ja sam', 'Ја сам', 'I am', 'yah sahm'),
    w('Ti si', 'Ти си', 'You are', 'tee see'),
    w('On je', 'Он је', 'He is', 'ohn yeh'),
    w('Ona je', 'Она је', 'She is', 'OH-nah yeh'),
    w('Ono je', 'Оно је', 'It is', 'OH-noh yeh'),
  ], [
    s('Ja sam Eren.', 'I am Eren.'),
    s('Ti si lep.', 'You are nice.'),
    s('Ona je dobra.', 'She is good.'),
  ], [
    q('"Ja sam" means...', ['I have', 'I am', 'I go', 'I want'], 1),
    q('"Ti si" means...', ['I am', 'You are', 'He is', 'We are'], 1),
    q('"On je" means...', ['She is', 'He is', 'It is', 'They are'], 1),
    q('"Ono je" refers to...', ['He', 'She', 'It', 'They'], 2),
  ]),
  L('To Be · Plural', 'Biti — množina', 'conjug', [
    w('Mi smo', 'Ми смо', 'We are', 'mee smoh'),
    w('Vi ste', 'Ви сте', 'You all are', 'vee steh'),
    w('Oni su', 'Они су', 'They are (m)', 'OH-nee soo'),
    w('One su', 'Оне су', 'They are (f)', 'OH-neh soo'),
    w('Ona su', 'Она су', 'They are (n)', 'OH-nah soo'),
  ], [
    s('Mi smo prijatelji.', 'We are friends.'),
    s('Oni su mačke.', 'They are cats.'),
    s('Vi ste lepi.', 'You all are nice.'),
  ], [
    q('"Mi smo" means...', ['I am', 'You are', 'We are', 'They are'], 2),
    q('"Vi ste" means...', ['I am', 'You all are', 'They are', 'We are'], 1),
    q('"Oni su" refers to...', ['Mixed/male group', 'Female group', 'One person', 'Object'], 0),
    q('"One su" refers to...', ['Male group', 'Female group', 'Mixed group', 'Object'], 1),
  ]),
  L('To Have', 'Imati', 'conjug', [
    w('Imam', 'Имам', 'I have', 'EE-mahm'),
    w('Imaš', 'Имаш', 'You have', 'EE-mash'),
    w('Ima', 'Има', 'He / She has', 'EE-mah'),
    w('Imamo', 'Имамо', 'We have', 'EE-mah-moh'),
    w('Imate', 'Имате', 'You all have', 'EE-mah-teh'),
  ], [
    s('Imam mačku.', 'I have a cat.'),
    s('Imaš li vode?', 'Do you have water?'),
    s('Imamo dom.', 'We have a home.'),
  ], [
    q('"Imam" means...', ['I am', 'I have', 'I want', 'I go'], 1),
    q('"Imaš" goes with...', ['Ja', 'Ti', 'On', 'Mi'], 1),
    q('"Imamo" means...', ['I have', 'You have', 'We have', 'They have'], 2),
    q('"Imate" means...', ['I have', 'They have', 'You all have', 'We have'], 2),
  ]),
  L('To Want', 'Hteti', 'conjug', [
    w('Hoću', 'Хоћу', 'I want', 'HOH-choo'),
    w('Hoćeš', 'Хоћеш', 'You want', 'HOH-chesh'),
    w('Hoće', 'Хоће', 'He / She wants', 'HOH-cheh'),
    w('Hoćemo', 'Хоћемо', 'We want', 'HOH-cheh-moh'),
    w('Hoćete', 'Хоћете', 'You all want', 'HOH-cheh-teh'),
  ], [
    s('Hoću mleko.', 'I want milk.'),
    s('Hoćeš li čaj?', 'Do you want tea?'),
    s('Hoćemo da idemo.', 'We want to go.'),
  ], [
    q('"Hoću" means...', ['I have', 'I want', 'I love', 'I am'], 1),
    q('"Hoćeš" goes with...', ['Ja', 'Ti', 'On', 'Mi'], 1),
    q('"Hoće" means...', ['I want', 'You want', 'He/She wants', 'They want'], 2),
    q('"Hoćemo" means...', ['I want', 'We want', 'They want', 'You want'], 1),
  ]),
  L('To Go', 'Ići', 'conjug', [
    w('Idem', 'Идем', 'I go', 'EE-dem'),
    w('Ideš', 'Идеш', 'You go', 'EE-desh'),
    w('Ide', 'Иде', 'He / She goes', 'EE-deh'),
    w('Idemo', 'Идемо', 'We go', 'EE-deh-moh'),
    w('Idete', 'Идете', 'You all go', 'EE-deh-teh'),
  ], [
    s('Idem u park.', 'I am going to the park.'),
    s('Kuda ideš?', 'Where are you going?'),
    s('Idemo zajedno.', 'We are going together.'),
  ], [
    q('"Idem" means...', ['I have', 'I go', 'I want', 'I see'], 1),
    q('"Ideš" goes with...', ['Ja', 'Ti', 'On', 'Mi'], 1),
    q('"Ide" means...', ['I go', 'You go', 'He/She goes', 'They go'], 2),
    q('"Idemo" means...', ['I go', 'We go', 'They go', 'You go'], 1),
  ]),
]

// ═══════════════════════════════════════════════════════════════════════════
// SECTIONS & UNITS — visual hierarchy on the course map
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

export const ORDERED_LESSON_IDS: number[] =
  SERBIAN_SECTIONS.flatMap(sec =>
    sec.unitIds.flatMap(uid => SERBIAN_UNITS.find(u => u.id === uid)!.lessonIds)
  )

// ─── Helpers ───────────────────────────────────────────────────────────────
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
// EXERCISE TYPES & GENERATION
// ═══════════════════════════════════════════════════════════════════════════

export type Exercise =
  | { kind: 'mc'; promptLang: 'sr' | 'en'; prompt: string; answer: string; options: string[]; pronunciation?: string; srKey?: string }
  | { kind: 'pairs'; pairs: { sr: string; en: string }[] }
  | { kind: 'order'; english: string; sr: string; tiles: string[] }
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
    .flatMap(l => l.words.map(wd => wd.serbian))
  const allOtherEn = SERBIAN_COURSE
    .filter(l => l.id !== lesson.id)
    .flatMap(l => l.words.map(wd => wd.english))

  if (words.length >= 3) {
    const subset = shuffle(words).slice(0, Math.min(5, words.length))
    list.push({ kind: 'pairs', pairs: subset.map(wd => ({ sr: wd.serbian, en: wd.english })) })
  }

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

  for (const wd of shuffle(words)) {
    const sameLessonDistractors = shuffle(words.filter(x => x.serbian !== wd.serbian).map(x => x.serbian))
    const externalDistractors = shuffle(allOtherSr.filter(s2 => s2 !== wd.serbian))
    const distractors = shuffle([...sameLessonDistractors, ...externalDistractors]).slice(0, 3)
    list.push({
      kind: 'mc', promptLang: 'en', prompt: wd.english, answer: wd.serbian,
      options: shuffle([wd.serbian, ...distractors]),
      srKey: wd.serbian,
    })
  }

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
    .filter(s2 => {
      if (s2.attempts === 0) return false
      const rate = s2.correct / s2.attempts
      const recentWrong = s2.lastWrongAt && (now - s2.lastWrongAt) < RECENT_WRONG_MS
      return (rate < 0.8 && s2.attempts >= 2) || recentWrong
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
