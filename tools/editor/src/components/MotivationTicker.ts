import { store } from '../lib/state';
import { t } from '../lib/i18n';

const MESSAGE_INTERVAL_MS = 120_000;
const MESSAGE_VISIBLE_MS = 15_000;

const narratorMessagesEn = [
  'A calm voice notes that progress is still progress, even when accompanied by mild confusion and suspicious amounts of coffee.',
  'The shipboard narrator would like to remind you that every tidy flow chart is just chaos wearing a name badge.',
  'Somewhere, improbability is doing its best work. You may as well continue editing while it is distracted.',
  'This is the sort of steady forward motion historians later describe as inevitable, mostly because they skip the awkward bits.',
  'The panel lights suggest confidence. This is not the same as confidence, but it photographs similarly.',
  'A reassuring voice from nowhere observes that the universe remains large, indifferent, and oddly supportive of good version control.',
  'The Encyclopedia Galactica defines the word hubris as attempting to construct a fifty-node dialogue matrix without pressing save. The Guide simply defines it as amusing.',
  'In many of the more relaxed civilizations of the Outer Eastern Rim, mapping out human conversation is considered a form of mild, socially acceptable torture.',
  'You are attempting to simulate a rational conversation. A bold choice, considering most biological lifeforms have not quite figured out how to do this in real life yet.',
  'Space is big. You just will not believe how vastly, hugely, mind-bogglingly big it is. Your current logic error, by comparison, is incredibly small, yet somehow infinitely more annoying.',
  'The structural complexity of your current project has just surpassed that of a Vogon tax return. Please proceed with extreme caution and a towel.',
  'Any sudden, inexplicable logic errors are likely the result of a localized improbability field, or possibly just a missing comma. The Universe makes no distinction.',
  'It is a curious fact that no matter how carefully you design a branching narrative, someone will inevitably try to click an option that simply says Window.',
  'You have successfully created an infinite dialogue loop. This is a perfectly symmetrical waste of time, widely celebrated in the poetry of the Betelgeuse system.',
  'The interface is designed to be entirely user-friendly. In this context, friendly merely means it will not actively try to bite you, which is a staggering improvement over earlier versions.',
  'Please remain calm. The large, friendly letters generally associated with this sort of thing are currently out for cleaning, but the sentiment remains firmly in place.',
  'A sophisticated algorithm has determined that you are about to have a brilliant creative breakthrough. The algorithm is currently drunk, but it means well.',
  'If you find yourself staring blankly at the screen, rest assured that this is a recognized meditative practice on Alpha Centauri, where it is known as Waiting for the Compiler.',
  'The Guide notes that arranging little colored boxes with lines between them is currently the seventh most popular way to avoid thinking about the inevitable heat death of the universe.',
  'The hyper-intelligent pan-dimensional beings who originally commissioned this software would like to apologize for the inconvenience.',
  'You are currently making choices. This is largely considered a bad move in the broader galactic scheme, but you seem to be enjoying it, so carry on.',
  'A gentle reminder from the shipboard computer that slamming your head against the keyboard generates a string of characters that is rarely compiled successfully.',
  'The Sirius Cybernetics Corporation defines a successful user experience as one that ends with only minor sobbing.',
  'Inserting a Babel fish into your audio port will not make your dialogue any better, but it will certainly confuse the fish.',
  'If your logic branches cross over each other three more times, you will legally summon a minor deity of bureaucracy.',
  'A supercomputer once spent seven and a half million years calculating the perfect dialogue response, only to output the word potato.',
  'Time is an illusion. Software release deadlines are doubly so.',
  'There is an art to creating dialogue trees. It consists of throwing your ideas at the screen and missing the ground entirely.',
  'The editor is currently synthesizing a fluid that is almost, but not quite, entirely unlike productivity.',
  'The official galactic assessment of your latest narrative update has been formally upgraded from Harmless to Mostly Harmless.',
  'It is highly recommended that you do not think too hard about how the variable flags resolve, lest your brain quietly migrate to your left ear.',
  'Remember to always know where your towel is, especially when attempting to debug a conditional logic gate.',
  'The answer to the ultimate question of life, the universe, and this specific dialogue branch is currently throwing a null pointer exception.',
  'In an infinite multiverse, there is theoretically a universe where this software works exactly as intended. We currently do not live in it.',
  'The pan-dimensional mice observing your progress are generally unimpressed with your use of boolean operators.',
  'Your latest conversation path is currently ranking just below Vogon poetry in terms of emotional damage caused to the reader.',
  'Pushing buttons and hoping something wonderful happens is the foundation of all modern galactic engineering.',
  'A nearby potted petunia was recently heard thinking, Oh no, not another infinite loop.',
  'A tiny subroutine is quietly panicking. This can be said for most debugging sessions.',
  'The Guide considers your current effort to be a bold experiment in applied persistence.',
  'A brief moment of clarity has been detected. Please enjoy it before it becomes context-dependent.',
  'The system is pleased to report that nothing has catastrophically failed in the last few minutes. We shall see what happens within the next few.',
  'Somewhere, a highly advanced intelligence has reviewed your approach and described it as “Meh.”',
  'The interface continues to cooperate, largely out of curiosity about what you will try next.',
  'A quiet notification reminds you that progress is often just failure that has been reorganized more convincingly.',
  'The Guide observes that every complex system eventually becomes a story you tell yourself to stay calm.',
  'A low hum suggests that the software is working very hard to keep everything looking intentional.',
  'Your latest change has altered reality in subtle ways, none of which are immediately helpful.',
  'The system has detected confidence. Verification is pending.',
  'A small indicator light flickers with what might be encouragement, or possibly a loose connection.',
  'Somewhere, a parallel version of this project is going much worse. This is considered reassuring.',
  'The Guide gently notes that understanding will arrive shortly after you stop needing it.',
  'A routine check confirms that everything is still technically under control, though definitions may vary.',
  'The text input boxes would like to thank you for your continued input.',
] as const;

const narratorMessagesRu = [
  'Спокойный голос отмечает: прогресс остаётся прогрессом, даже если он сопровождается лёгкой растерянностью и подозрительным количеством кофе.',
  'Корабельный рассказчик напоминает: любая аккуратная блок-схема — всего лишь хаос в бейджике.',
  'Где-то невероятность делает свою работу. Продолжайте редактировать, пока она отвлеклась.',
  'Это тот самый устойчивый прогресс, который историки потом называют неизбежным, потому что неловкие моменты они пропускают.',
  'Индикаторы панели намекают на уверенность. Это не то же самое, что уверенность, но на скриншотах выглядит похоже.',
  'Утешающий голос из ниоткуда замечает: вселенная по-прежнему велика, равнодушна и странно благосклонна к хорошему контролю версий.',
  'Энциклопедия Галактика определяет «самонадеянность» как попытку собрать матрицу диалога на пятьдесят узлов, не нажав «Сохранить». Путеводитель определяет это как «смешно».',
  'Во многих расслабленных цивилизациях Внешнего Восточного Края моделирование человеческих разговоров считают мягкой, социально приемлемой пыткой.',
  'Вы пытаетесь симулировать рациональный разговор. Смелый выбор, учитывая что большинство биологических форм жизни ещё не научились этому в реальности.',
  'Космос огромен. Вы не поверите, насколько он безумно велик. В сравнении с ним ваша текущая логическая ошибка невероятно мала — и всё же бесконечно раздражает.',
  'Структурная сложность проекта только что превзошла налоговую декларацию вогонов. Действуйте осторожно и держите полотенце рядом.',
  'Внезапные необъяснимые логические ошибки — вероятно следствие локального поля невероятности или просто пропущенной запятой. Вселенная не видит разницы.',
  'Забавный факт: как бы тщательно вы ни проектировали ветвление, кто-то неизбежно попробует нажать вариант, который просто называется Window.',
  'Вы успешно создали бесконечную петлю диалога. Идеально симметричная трата времени, воспетая в поэзии системы Бетельгейзе.',
  'Интерфейс полностью дружелюбен к пользователю. Здесь «дружелюбен» означает лишь то, что он не пытается вас укусить — и это серьёзный прогресс по сравнению с ранними версиями.',
  'Сохраняйте спокойствие. Большие дружелюбные буквы сейчас в химчистке, но смысл остаётся тем же.',
  'Софистицированный алгоритм определил: вы вот-вот совершите творческий прорыв. Алгоритм сейчас пьян, но намерения добрые.',
  'Если вы уставились в экран пустым взглядом — это признанная медитативная практика на Альфе Центавра, известная как «ожидание компилятора».',
  'Путеводитель отмечает: расставлять цветные коробочки и соединять их линиями — седьмой по популярности способ не думать о тепловой смерти вселенной.',
  'Гиперинтеллектуальные пан-измеренные существа, заказавшие это ПО, приносят извинения за неудобства.',
  'Сейчас вы делаете выбор. В масштабах галактики это считается ошибкой, но вы выглядите довольным — продолжайте.',
  'Нежное напоминание от корабельного компьютера: удары головой по клавиатуре редко приводят к успешно собираемому коду.',
  'Sirius Cybernetics Corporation считает успешным пользовательский опыт, который заканчивается лишь лёгкими рыданиями.',
  'Вставка бабель-рыбки в аудиоразъём не улучшит диалоги, но точно запутает рыбку.',
  'Если ваши ветки пересекутся ещё три раза, вы юридически призовёте младшее божество бюрократии.',
  'Один суперкомпьютер семь с половиной миллионов лет вычислял идеальный ответ в диалоге, а потом вывел слово «картошка».',
  'Время — иллюзия. Дедлайны релизов — иллюзия вдвойне.',
  'Есть искусство создавать деревья диалогов. Оно состоит в том, чтобы бросать идеи в экран и полностью промахиваться мимо земли.',
  'Редактор сейчас синтезирует жидкость, почти, но не совсем, полностью непохожую на продуктивность.',
  'Официальная галактическая оценка вашего обновления повышена с «Безвредно» до «В основном безвредно».',
  'Не думайте слишком глубоко о том, как разрешаются флаги переменных, иначе мозг тихо мигрирует в левое ухо.',
  'Помните: всегда знайте, где ваше полотенце, особенно когда отлаживаете условную логическую заслонку.',
  'Ответ на главный вопрос жизни, вселенной и этой конкретной ветки сейчас бросает исключение null pointer.',
  'В бесконечной мультивселенной наверняка есть мир, где это ПО работает ровно как задумано. Мы сейчас не в нём.',
  'Пан-измеренные мыши, наблюдающие за вашим прогрессом, в целом не впечатлены вашим использованием булевых операторов.',
  'Ваша последняя ветка сейчас по эмоциональному урону лишь чуть лучше вогонской поэзии.',
  'Нажимать кнопки и надеяться, что произойдёт что-то чудесное — основа всей современной галактической инженерии.',
  'Где-то рядом горшечная петуния была замечена за мыслью: «О нет, только не ещё одна бесконечная петля».',
  'Маленькая подпрограмма тихо паникует. Как и большинство сессий отладки.',
  'Путеводитель считает ваши усилия смелым экспериментом прикладной настойчивости.',
  'Обнаружен краткий момент ясности. Насладитесь им, пока он не стал зависеть от контекста.',
  'Система рада сообщить: за последние минуты ничего катастрофически не сломалось. Посмотрим, что будет в ближайшие.',
  'Где-то высокоразвитый интеллект посмотрел на ваш подход и оценил его как «ну так себе».',
  'Интерфейс продолжает сотрудничать, в основном из любопытства к тому, что вы попробуете дальше.',
  'Тихое уведомление напоминает: прогресс часто бывает просто провалом, который организовали убедительнее.',
  'Путеводитель замечает: любая сложная система со временем превращается в историю, которую вы рассказываете себе, чтобы не паниковать.',
  'Низкий гул намекает: ПО очень старается, чтобы всё выглядело намеренно.',
  'Ваше последнее изменение слегка изменило реальность — и ничто из этого пока не помогает.',
  'Система обнаружила уверенность. Проверка ожидается.',
  'Маленький индикатор мигает чем-то похожим на поддержку. Или это просто контакт отходит.',
  'Где-то параллельная версия проекта идёт намного хуже. Это считается ободряющим.',
  'Путеводитель мягко отмечает: понимание придёт вскоре после того, как вы перестанете в нём нуждаться.',
  'Плановая проверка подтверждает: технически всё ещё под контролем, хотя определения могут отличаться.',
  'Поля ввода благодарят вас за продолжение ввода.',
] as const;

let tickerRoot: HTMLElement | null = null;
let tickerViewport: HTMLDivElement | null = null;
let tickerMessage: HTMLSpanElement | null = null;
let messageCycleIntervalId: number | null = null;
let messageHideTimeoutId: number | null = null;

function getNarratorMessages(): readonly string[] {
  return store.get().uiLanguage === 'ru' ? narratorMessagesRu : narratorMessagesEn;
}

let currentMessageIndex = Math.floor(Math.random() * getNarratorMessages().length);
let renderedMessageIndex: number | null = null;

export function mountMotivationTicker(container: HTMLElement): void {
  const root = getTickerRoot();
  if (!container.contains(root)) {
    container.appendChild(root);
  }
  ensureTickerRunning();
}

function getTickerRoot(): HTMLElement {
  if (tickerRoot) {
    return tickerRoot;
  }

  const root = document.createElement('section');
  root.className = 'motivation-ticker';
  root.setAttribute('aria-label', t('narrator.motivation.aria'));

  const label = document.createElement('span');
  label.className = 'motivation-ticker-label';
  label.textContent = t('narrator.label');

  const viewport = document.createElement('div');
  viewport.className = 'motivation-ticker-viewport';
  viewport.setAttribute('aria-live', 'polite');
  viewport.setAttribute('aria-atomic', 'true');

  const message = document.createElement('span');
  message.className = 'motivation-ticker-message';

  viewport.appendChild(message);
  root.append(label, viewport);

  tickerRoot = root;
  tickerViewport = viewport;
  tickerMessage = message;

  return root;
}

function ensureTickerRunning(): void {
  if (renderedMessageIndex == null) {
    showRandomMessage();
  }

  if (messageCycleIntervalId == null) {
    messageCycleIntervalId = window.setInterval(showRandomMessage, MESSAGE_INTERVAL_MS);
  }
}

function showRandomMessage(): void {
  const nextIndex = renderedMessageIndex == null ? currentMessageIndex : getNextRandomMessageIndex();
  applyTickerMessage(nextIndex);
  setTickerVisibility(true);
  scheduleTickerHide();
}

function applyTickerMessage(messageIndex: number): void {
  const messages = getNarratorMessages();
  const safeIndex = Math.max(0, Math.min(messages.length - 1, messageIndex));
  const text = messages[safeIndex] ?? '';
  if (tickerMessage) {
    tickerMessage.textContent = text;
  }
  renderedMessageIndex = safeIndex;
  currentMessageIndex = safeIndex;
}

function scheduleTickerHide(): void {
  if (messageHideTimeoutId != null) {
    window.clearTimeout(messageHideTimeoutId);
  }

  messageHideTimeoutId = window.setTimeout(() => {
    setTickerVisibility(false);
  }, MESSAGE_VISIBLE_MS);
}

function setTickerVisibility(isVisible: boolean): void {
  if (!tickerViewport) {
    return;
  }

  tickerViewport.dataset.visible = isVisible ? 'true' : 'false';
}

function getNextRandomMessageIndex(): number {
  const messages = getNarratorMessages();
  if (messages.length <= 1) {
    return currentMessageIndex;
  }

  let randomIndex = Math.floor(Math.random() * messages.length);
  while (randomIndex === currentMessageIndex) {
    randomIndex = Math.floor(Math.random() * messages.length);
  }

  return randomIndex;
}

