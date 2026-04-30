export type BeginnerTooltipPlacement = 'top' | 'right' | 'bottom' | 'left';

export type BeginnerTooltipConfig = {
  id: string;
  title: string;
  body: string;
  placement?: BeginnerTooltipPlacement;
  shortcut?: string;
};

export type BeginnerTooltipPresetId = keyof typeof BEGINNER_TOOLTIP_PRESETS;

export const BEGINNER_TOOLTIP_STORAGE_KEY = 'panda:beginner-tooltips-dismissed:v1';
export const BEGINNER_TOOLTIP_DISABLED_KEY = 'panda:beginner-tooltips-disabled:v1';

const DATA_ID = 'beginnerTooltipId';
const DATA_TITLE = 'beginnerTooltipTitle';
const DATA_BODY = 'beginnerTooltipBody';
const DATA_PLACEMENT = 'beginnerTooltipPlacement';
const DATA_SHORTCUT = 'beginnerTooltipShortcut';

export const BEGINNER_TOOLTIP_PRESETS = {
  'toolbar-open': {
    id: 'toolbar-open',
    title: 'Open Project',
    body: 'Load a saved .panda/.json project, or route compatible PANDA XML into import flow.',
    placement: 'bottom',
  },
  'toolbar-import': {
    id: 'toolbar-import',
    title: 'Import XML',
    body: 'Bring existing game XML into editable story cards. Use this when starting from files already made by hand.',
    placement: 'bottom',
  },
  'toolbar-save': {
    id: 'toolbar-save',
    title: 'Save Project',
    body: 'Save editor project format. It preserves layout, labels, and data needed for later editing.',
    placement: 'bottom',
  },
  'toolbar-export-xml': {
    id: 'toolbar-export-xml',
    title: 'Export XML',
    body: 'Generate game-ready XML after validation looks clean. This is final output for mod files.',
    placement: 'bottom',
  },
  'toolbar-community': {
    id: 'toolbar-community',
    title: 'Community Library',
    body: 'Browse shared stories, import examples, or publish finished work for other authors.',
    placement: 'bottom',
  },
  'toolbar-help': {
    id: 'toolbar-help',
    title: 'Quick Start Guide',
    body: 'Open full beginner guide for mental model, preconditions, dynamic references, outcomes, and story recipes.',
    placement: 'bottom',
  },
  'toolbar-search': {
    id: 'toolbar-search',
    title: 'Quick Search',
    body: 'Jump to stories, turns, choices, commands, or system strings without hunting through panels.',
    placement: 'bottom',
    shortcut: 'Ctrl/Cmd+P',
  },
  'toolbar-density': {
    id: 'toolbar-density',
    title: 'Flow Density',
    body: 'Change how much text and metadata each turn card shows. Compact helps large stories; detailed helps debugging.',
    placement: 'bottom',
  },
  'toolbar-undo': {
    id: 'toolbar-undo',
    title: 'Undo',
    body: 'Undo last editor change. Useful while experimenting with branches and outcomes.',
    placement: 'bottom',
    shortcut: 'Ctrl/Cmd+Z',
  },
  'toolbar-redo': {
    id: 'toolbar-redo',
    title: 'Redo',
    body: 'Restore last undone editor change.',
    placement: 'bottom',
    shortcut: 'Ctrl/Cmd+Y',
  },
  'toolbar-toggle-xml': {
    id: 'toolbar-toggle-xml',
    title: 'Live XML Preview',
    body: 'Open bottom workspace showing generated XML. Use it to verify export shape while editing.',
    placement: 'bottom',
  },
  'toolbar-toggle-strings': {
    id: 'toolbar-toggle-strings',
    title: 'System Strings',
    body: 'Open shared string-table workspace for imported and exported localization entries.',
    placement: 'bottom',
  },
  'toolbar-more': {
    id: 'toolbar-more',
    title: 'More Actions',
    body: 'Contains extra project tools like help and intro reset when toolbar space is tight.',
    placement: 'bottom',
  },
  'toolbar-reset-intro': {
    id: 'toolbar-reset-intro',
    title: 'Reset Intro',
    body: 'Clear local workspace and return to first-run intro. Save first if current project matters.',
    placement: 'bottom',
  },
  'story-new': {
    id: 'story-new',
    title: 'New Story',
    body: 'Create another conversation/story in current project. Each story gets own trigger rules and flow.',
    placement: 'right',
  },
  'story-select': {
    id: 'story-select',
    title: 'Story List',
    body: 'Select story to edit its flow. Faction badge and issue markers help spot scope and validation state.',
    placement: 'right',
  },
  'story-center': {
    id: 'story-center',
    title: 'Center Story',
    body: 'Bring selected story into view in flow editor. Useful after panning or working with large projects.',
    placement: 'right',
  },
  'story-duplicate': {
    id: 'story-duplicate',
    title: 'Duplicate Story',
    body: 'Clone selected story as starting point for variants or faction-specific copies.',
    placement: 'right',
  },
  'story-delete': {
    id: 'story-delete',
    title: 'Delete Story',
    body: 'Remove selected story from project. Save backup first if unsure.',
    placement: 'right',
  },
  'story-issues': {
    id: 'story-issues',
    title: 'Issue List',
    body: 'Validation problems appear here. Click issue to jump to matching story, turn, choice, or field.',
    placement: 'right',
  },
  'panel-toggle': {
    id: 'panel-toggle',
    title: 'Panel Toggle',
    body: 'Collapse side panels for more flow space, or reopen inspector/story list when needed.',
    placement: 'bottom',
  },
  'panel-resize': {
    id: 'panel-resize',
    title: 'Resize Panel',
    body: 'Drag divider to give story list, flow canvas, or inspector more room.',
    placement: 'bottom',
  },
  'flow-auto-layout': {
    id: 'flow-auto-layout',
    title: 'Auto Layout',
    body: 'Rearrange turns into readable branch structure. Good after imports or heavy editing.',
    placement: 'bottom',
  },
  'flow-add-turn': {
    id: 'flow-add-turn',
    title: 'Add Turn',
    body: 'Create new branch node. Turns hold NPC opener text plus player choices that can continue elsewhere.',
    placement: 'bottom',
    shortcut: 'Shift+T',
  },
  'flow-canvas': {
    id: 'flow-canvas',
    title: 'Flow Canvas',
    body: 'Pan around story graph, zoom for big structures, and click empty space to clear selection.',
    placement: 'bottom',
  },
  'flow-zoom': {
    id: 'flow-zoom',
    title: 'Zoom Controls',
    body: 'Zoom in/out or fit story to viewport when graph gets large.',
    placement: 'left',
  },
  'flow-fit': {
    id: 'flow-fit',
    title: 'Fit View',
    body: 'Scale and pan canvas so whole conversation fits on screen.',
    placement: 'left',
  },
  'flow-reset': {
    id: 'flow-reset',
    title: 'Reset View',
    body: 'Return pan and zoom to default framing.',
    placement: 'left',
  },
  'flow-turn-node': {
    id: 'flow-turn-node',
    title: 'Turn Node',
    body: 'Click to edit turn in inspector. Drag node to organize graph manually.',
    placement: 'right',
  },
  'flow-turn-label': {
    id: 'flow-turn-label',
    title: 'Turn Label',
    body: 'Click label to rename branch in editor. Labels do not change exported dialogue text.',
    placement: 'top',
  },
  'flow-turn-color': {
    id: 'flow-turn-color',
    title: 'Branch Color',
    body: 'Change node/edge color to make parallel branches easier to read.',
    placement: 'top',
  },
  'flow-input-port': {
    id: 'flow-input-port',
    title: 'Incoming Port',
    body: 'Drop choice connector here to make another choice continue into this turn.',
    placement: 'left',
  },
  'flow-choice-row': {
    id: 'flow-choice-row',
    title: 'Choice Row',
    body: 'Click player choice to edit text, reply, conditions, outcomes, and continuation in inspector.',
    placement: 'right',
  },
  'flow-output-port': {
    id: 'flow-output-port',
    title: 'Choice Connector',
    body: 'Drag to another turn to link branch. Double-click to create and link a new turn.',
    placement: 'right',
    shortcut: 'Shift+L',
  },
  'flow-branch-add': {
    id: 'flow-branch-add',
    title: 'Create Branch',
    body: 'Create a new connected turn from this choice. Faster than adding a turn then linking manually.',
    placement: 'right',
  },
  'flow-unlink': {
    id: 'flow-unlink',
    title: 'Unlink Choice',
    body: 'Disconnect this choice from its continuation turn without deleting either node.',
    placement: 'top',
    shortcut: 'Shift+D',
  },
  'flow-turn-actions': {
    id: 'flow-turn-actions',
    title: 'Turn Actions',
    body: 'Duplicate, copy, paste, or delete turn while preserving branch structure where possible.',
    placement: 'top',
  },
  'flow-edge': {
    id: 'flow-edge',
    title: 'Flow Edge',
    body: 'Click line to inspect connection. Right-click supported edges to disconnect branch quickly.',
    placement: 'top',
  },
  'inspector-story-tab': {
    id: 'inspector-story-tab',
    title: 'Story Tab',
    body: 'Edit story-wide setup: label, trigger channel, global preconditions, and timeout.',
    placement: 'bottom',
  },
  'inspector-selection-tab': {
    id: 'inspector-selection-tab',
    title: 'Turn / Choice Tab',
    body: 'Edit selected turn or selected choice. Select a node or choice in flow graph first.',
    placement: 'bottom',
  },
  'field-label': {
    id: 'field-label',
    title: 'Label Field',
    body: 'Short editor-only name. Use it to recognize story quickly in lists and search.',
    placement: 'left',
  },
  'field-start-mode': {
    id: 'field-start-mode',
    title: 'Start Mode',
    body: 'Choose whether story starts as PDA message or face-to-face dialogue option.',
    placement: 'left',
  },
  'field-initial-channel': {
    id: 'field-initial-channel',
    title: 'Initial Channel',
    body: 'Sets how first branch begins. PDA is message flow; F2F is in-person opener flow.',
    placement: 'left',
  },
  'field-opening-message': {
    id: 'field-opening-message',
    title: 'Opening Message',
    body: 'NPC text that starts selected turn. For F2F continuation turns, opener may be ignored unless turn starts a segment.',
    placement: 'left',
  },
  'field-choice-text': {
    id: 'field-choice-text',
    title: 'Player Choice Text',
    body: 'Text player clicks/selects. This creates branch personality, tone, and direction.',
    placement: 'left',
  },
  'field-npc-reply': {
    id: 'field-npc-reply',
    title: 'NPC Reply',
    body: 'NPC response after player choice. Pair with continuation if conversation should keep going.',
    placement: 'left',
  },
  'section-preconditions': {
    id: 'section-preconditions',
    title: 'Preconditions',
    body: 'Rules that decide whether story, branch, or choice is available. Add only conditions that protect intended situation.',
    placement: 'left',
  },
  'section-branch-preconditions': {
    id: 'section-branch-preconditions',
    title: 'Branch Preconditions',
    body: 'Rules checked before this turn can be used. Good for gating follow-up branches by state.',
    placement: 'left',
  },
  'section-choice-preconditions': {
    id: 'section-choice-preconditions',
    title: 'Choice Preconditions',
    body: 'Rules controlling whether this player option appears once branch is active.',
    placement: 'left',
  },
  'section-outcomes': {
    id: 'section-outcomes',
    title: 'Outcomes',
    body: 'Effects fired after player chooses this option: rewards, spawns, relations, task-like pauses, and more.',
    placement: 'left',
  },
  'section-continuation': {
    id: 'section-continuation',
    title: 'Continuation / Branching',
    body: 'Choose next turn or end story. Continue As can auto-create correct PDA/F2F follow-up.',
    placement: 'left',
  },
  'field-continue-as': {
    id: 'field-continue-as',
    title: 'Continue As',
    body: 'Pick PDA or F2F for next segment. If no next turn exists, editor can create and link one.',
    placement: 'left',
  },
  'section-placeholders': {
    id: 'section-placeholders',
    title: 'Dynamic Placeholders',
    body: 'Click to copy or insert runtime placeholders. Use text placeholder in dialogue and _key placeholder in command params.',
    placement: 'left',
  },
  'section-reply-variants': {
    id: 'section-reply-variants',
    title: 'Relationship Replies',
    body: 'Optional alternate NPC replies when relationship score is high or low.',
    placement: 'left',
  },
  'section-f2f-targeting': {
    id: 'section-f2f-targeting',
    title: 'F2F Targeting',
    body: 'Control which NPC can offer this in-person choice or fallback to generic sim stalkers.',
    placement: 'left',
  },
  'section-advanced-channel': {
    id: 'section-advanced-channel',
    title: 'Advanced Channel Controls',
    body: 'Compatibility controls for explicit PDA/F2F entries and handoffs. Most beginners can leave collapsed.',
    placement: 'left',
  },
  'section-timeout': {
    id: 'section-timeout',
    title: 'Timeout',
    body: 'Optional auto-close timing and message. Leave empty unless story should expire.',
    placement: 'left',
  },
  'command-picker-search': {
    id: 'command-picker-search',
    title: 'Command Search',
    body: 'Search preconditions or outcomes by label, category, command name, or description.',
    placement: 'bottom',
  },
  'command-picker-category': {
    id: 'command-picker-category',
    title: 'Command Categories',
    body: 'Categories group similar commands so new authors can browse without knowing exact names.',
    placement: 'right',
  },
  'command-picker-card': {
    id: 'command-picker-card',
    title: 'Command Card',
    body: 'Click to add command. Description explains what game state it checks or changes.',
    placement: 'left',
  },
  'command-row': {
    id: 'command-row',
    title: 'Command Row',
    body: 'Drag handle reorders commands. Expand row to edit params; delete removes command.',
    placement: 'left',
  },
  'command-param': {
    id: 'command-param',
    title: 'Command Parameter',
    body: 'Parameter value exported into command syntax. Use placeholders or picker buttons where available.',
    placement: 'left',
  },
  'workspace-tab': {
    id: 'workspace-tab',
    title: 'Bottom Workspace Tab',
    body: 'Switch between XML preview, system strings, and other utility panes opened from toolbar.',
    placement: 'top',
  },
  'workspace-add-string': {
    id: 'workspace-add-string',
    title: 'Add System String',
    body: 'Create shared string-table entry for text reused by imports or exports.',
    placement: 'top',
  },
  'workspace-close': {
    id: 'workspace-close',
    title: 'Close Workspace',
    body: 'Close current bottom utility pane. Toolbar toggles can reopen it.',
    placement: 'top',
  },
  'workspace-resize': {
    id: 'workspace-resize',
    title: 'Resize Workspace',
    body: 'Drag handle to give XML preview or string table more vertical room.',
    placement: 'top',
  },
  'validation-message': {
    id: 'validation-message',
    title: 'Validation Message',
    body: 'Click issue to select matching story location and scroll inspector field into view.',
    placement: 'top',
  },
} as const satisfies Record<string, BeginnerTooltipConfig>;

const BEGINNER_TOOLTIP_RU_OVERRIDES: Partial<Record<BeginnerTooltipPresetId, Pick<BeginnerTooltipConfig, 'title' | 'body'>>> = {
  'toolbar-open': {
    title: 'Открыть проект',
    body: 'Загрузи сохранённый .panda/.json проект, или импортируй совместимый PANDA XML.',
  },
  'toolbar-import': {
    title: 'Импорт XML',
    body: 'Импортируй XML игры в редактируемые карточки истории. Полезно, когда файл уже сделан вручную.',
  },
  'toolbar-save': {
    title: 'Сохранить проект',
    body: 'Сохраняет формат проекта редактора. Сохраняет раскладку, метки, и данные для дальнейшего редактирования.',
  },
  'toolbar-export-xml': {
    title: 'Экспорт XML',
    body: 'Генерирует XML для игры после чистой валидации. Это финальный вывод для файлов мода.',
  },
  'toolbar-community': {
    title: 'Библиотека сообщества',
    body: 'Смотри общие истории, импортируй примеры, или публикуй готовую работу для других авторов.',
  },
  'toolbar-help': {
    title: 'Быстрый старт',
    body: 'Открывает полный гид: модель мышления, предусловия, динамические ссылки, outcomes, и story recipes.',
  },
  'toolbar-search': {
    title: 'Быстрый поиск',
    body: 'Прыгай к историям, ходам, вариантам, командам, или системным строкам без охоты по панелям.',
  },
  'toolbar-density': {
    title: 'Плотность потока',
    body: 'Меняет сколько текста и метаданных показывать на карточке хода. Compact для больших историй; detailed для отладки.',
  },
  'toolbar-undo': {
    title: 'Отменить',
    body: 'Отмени последнее изменение. Полезно при экспериментах с ветками и outcomes.',
  },
  'toolbar-redo': {
    title: 'Повторить',
    body: 'Верни последнее отменённое изменение.',
  },
  'toolbar-toggle-xml': {
    title: 'Живой XML предпросмотр',
    body: 'Открывает нижнюю панель с генерируемым XML. Используй для проверки формы экспорта во время редактирования.',
  },
  'toolbar-toggle-strings': {
    title: 'Системные строки',
    body: 'Открывает общую панель string-table для локализации, импорта, и экспорта.',
  },
  'toolbar-more': {
    title: 'Ещё действия',
    body: 'Дополнительные инструменты проекта, когда места на тулбаре мало.',
  },
  'toolbar-reset-intro': {
    title: 'Сбросить интро',
    body: 'Очищает локальное рабочее пространство и возвращает к первому запуску. Сохранись заранее, если проект важен.',
  },
  'story-new': {
    title: 'Новая история',
    body: 'Создай ещё один разговор/историю в текущем проекте. У каждой истории свои правила триггера и flow.',
  },
  'story-select': {
    title: 'Список историй',
    body: 'Выбери историю для редактирования. Значок фракции и маркеры проблем помогают видеть валидацию и контекст.',
  },
  'story-center': {
    title: 'Центрировать историю',
    body: 'Верни выбранную историю в видимую область редактора потока. Полезно после панорамирования.',
  },
  'story-duplicate': {
    title: 'Дублировать историю',
    body: 'Клонируй выбранную историю как базу для варианта или копии для другой фракции.',
  },
  'story-delete': {
    title: 'Удалить историю',
    body: 'Удаляет выбранную историю из проекта. Сделай бэкап, если не уверен.',
  },
  'story-issues': {
    title: 'Список проблем',
    body: 'Проблемы валидации появляются тут. Клик по проблеме прыгает к истории/ходу/варианту/полю.',
  },
  'panel-toggle': {
    title: 'Панели',
    body: 'Показывает или скрывает левую/правую панель. На планшете/мобиле панели открываются как drawer/sheet.',
  },
  'workspace-tab': {
    title: 'Вкладка нижней панели',
    body: 'Переключайся между XML предпросмотром, системными строками, и другими утилитами, открытыми с тулбара.',
  },
  'workspace-add-string': {
    title: 'Добавить системную строку',
    body: 'Создай общую запись string-table для текста, который переиспользуется импортом или экспортом.',
  },
  'workspace-close': {
    title: 'Закрыть панель',
    body: 'Закрывает текущую нижнюю панель. Переключатели на тулбаре могут открыть снова.',
  },
  'workspace-resize': {
    title: 'Изменить размер панели',
    body: 'Тяни ручку, чтобы дать XML предпросмотру или таблице строк больше вертикального места.',
  },
  'validation-message': {
    title: 'Сообщение валидации',
    body: 'Клик по проблеме выделяет место в истории и прокручивает соответствующее поле в инспекторе.',
  },
};

export function setBeginnerTooltip(
  element: HTMLElement,
  config: BeginnerTooltipConfig | BeginnerTooltipPresetId,
): HTMLElement {
  if (areBeginnerTooltipsDisabled()) {
    clearBeginnerTooltip(element);
    return element;
  }
  const resolved: BeginnerTooltipConfig = (() => {
    if (typeof config !== 'string') return config;
    const base = BEGINNER_TOOLTIP_PRESETS[config];
    if (typeof window !== 'undefined' && window.localStorage.getItem('panda:ui-language:v1') === 'ru') {
      const override = BEGINNER_TOOLTIP_RU_OVERRIDES[config];
      if (override) {
        return { ...base, ...override };
      }
    }
    return base;
  })();
  element.dataset[DATA_ID] = resolved.id;
  element.dataset[DATA_TITLE] = resolved.title;
  element.dataset[DATA_BODY] = resolved.body;
  if (resolved.placement) {
    element.dataset[DATA_PLACEMENT] = resolved.placement;
  } else {
    delete element.dataset[DATA_PLACEMENT];
  }
  if (resolved.shortcut) {
    element.dataset[DATA_SHORTCUT] = resolved.shortcut;
  } else {
    delete element.dataset[DATA_SHORTCUT];
  }
  return element;
}

export function getBeginnerTooltipConfig(element: HTMLElement): BeginnerTooltipConfig | null {
  if (areBeginnerTooltipsDisabled()) return null;
  const id = element.dataset[DATA_ID];
  const title = element.dataset[DATA_TITLE];
  const body = element.dataset[DATA_BODY];
  if (!id || !title || !body) return null;

  const placementValue = element.dataset[DATA_PLACEMENT];
  const placement = isPlacement(placementValue) ? placementValue : undefined;
  const shortcut = element.dataset[DATA_SHORTCUT];
  return { id, title, body, placement, shortcut };
}

export function areBeginnerTooltipsDisabled(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(BEGINNER_TOOLTIP_DISABLED_KEY) === 'true';
}

export function setBeginnerTooltipsDisabled(disabled: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(BEGINNER_TOOLTIP_DISABLED_KEY, String(disabled));
  document.body.classList.toggle('beginner-tooltips-disabled', disabled);
}

function clearBeginnerTooltip(element: HTMLElement): void {
  delete element.dataset[DATA_ID];
  delete element.dataset[DATA_TITLE];
  delete element.dataset[DATA_BODY];
  delete element.dataset[DATA_PLACEMENT];
  delete element.dataset[DATA_SHORTCUT];
}

export function isBeginnerTooltipDismissed(id: string): boolean {
  return readDismissedTooltipIds().has(id);
}

export function dismissBeginnerTooltip(id: string): void {
  const dismissed = readDismissedTooltipIds();
  dismissed.add(id);
  writeDismissedTooltipIds(dismissed);
}

export function resetBeginnerTooltipDismissals(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(BEGINNER_TOOLTIP_STORAGE_KEY);
}

export function mountBeginnerTooltipController(root: HTMLElement = document.body): () => void {
  const event = new CustomEvent('panda:beginner-tooltips:mount', { detail: { root } });
  window.dispatchEvent(event);
  return () => {
    window.dispatchEvent(new CustomEvent('panda:beginner-tooltips:unmount'));
  };
}

function readDismissedTooltipIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(BEGINNER_TOOLTIP_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? new Set(parsed.filter((value): value is string => typeof value === 'string'))
      : new Set();
  } catch {
    return new Set();
  }
}

function writeDismissedTooltipIds(ids: Set<string>): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(BEGINNER_TOOLTIP_STORAGE_KEY, JSON.stringify([...ids].sort()));
}

function isPlacement(value: string | undefined): value is BeginnerTooltipPlacement {
  return value === 'top' || value === 'right' || value === 'bottom' || value === 'left';
}
