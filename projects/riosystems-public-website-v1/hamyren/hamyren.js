(() => {
  'use strict';

  const QUESTION_LIMIT = 5;
  const state = {
    intake: null,
    questionsUsed: 0,
    questions: [],
    completed: false
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  function toast(message) {
    const node = $('[data-toast]');
    if (!node) return;
    node.textContent = message;
    node.classList.add('show');
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => node.classList.remove('show'), 3400);
  }

  function gateMessage() {
    toast('Payment provider not activated. Checkout remains closed in this private preview.');
  }

  $$('[data-gated-upgrade]').forEach((button) => button.addEventListener('click', gateMessage));

  const synthetic = {
    name: 'Mara',
    business: 'Studio Nord',
    industry: 'Creative Services',
    region: 'Deutschland',
    objective: 'Mehr qualifizierte Anfragen gewinnen, ohne den Vertrieb unnötig kompliziert zu machen.'
  };

  function viewLabel(view) {
    return ({ home: 'Overview', ask: 'Business AI', memory: 'Memory', goals: 'Goals', decisions: 'Decisions', usage: 'Usage & Plan', privacy: 'Privacy & Trust' })[view] || view;
  }

  function showView(view) {
    $$('[data-view]').forEach((section) => section.classList.toggle('active', section.dataset.view === view));
    $$('[data-view-target]').forEach((button) => button.classList.toggle('active', button.dataset.viewTarget === view));
    const current = $('[data-current-view]');
    if (current) current.textContent = viewLabel(view);
    const mobile = $('[data-mobile-nav]');
    if (mobile) mobile.classList.remove('open');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  $$('[data-view-target]').forEach((button) => button.addEventListener('click', () => showView(button.dataset.viewTarget)));
  $$('[data-view-shortcut]').forEach((button) => button.addEventListener('click', () => showView(button.dataset.viewShortcut)));
  $$('[data-go-ask]').forEach((button) => button.addEventListener('click', () => showView('ask')));

  const mobileMenu = $('[data-mobile-product-menu]');
  if (mobileMenu) mobileMenu.addEventListener('click', () => $('[data-mobile-nav]')?.classList.toggle('open'));

  function setText(selector, value) {
    $$(selector).forEach((node) => { node.textContent = value; });
  }

  function clearChildren(node) {
    if (!node) return;
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function makeMemoryItem(meta, title, copy) {
    const item = document.createElement('div');
    item.className = 'memory-item';
    const metaNode = document.createElement('span');
    metaNode.className = 'meta';
    metaNode.textContent = meta;
    const titleNode = document.createElement('h3');
    titleNode.textContent = title;
    const copyNode = document.createElement('p');
    copyNode.textContent = copy;
    item.append(metaNode, titleNode, copyNode);
    return item;
  }

  function populateContext() {
    if (!state.intake) return;
    const { name, business, industry, region, objective } = state.intake;
    setText('[data-snapshot-business]', business);
    setText('[data-context-business]', business);
    setText('[data-context-industry]', industry);
    setText('[data-context-objective]', objective);
    const welcome = $('[data-welcome-copy]');
    if (welcome) welcome.textContent = `Hi ${name}. I have the synthetic preview context for ${business}. Your current objective is “${objective}”. What would you like to work on first?`;

    const memory = $('[data-memory-list]');
    if (memory) {
      clearChildren(memory);
      memory.append(
        makeMemoryItem('Confirmed preview context · Business', business, `Industry: ${industry}${region ? ` · Region: ${region}` : ''}`),
        makeMemoryItem('Confirmed preview context · Current objective', 'Current business objective', objective),
        makeMemoryItem('Preview memory policy', 'Visible and correctable by design', 'Production memory is designed to require explicit user control. This preview does not persist anything after the page closes.')
      );
    }

    const goals = $('[data-goal-list]');
    if (goals) {
      clearChildren(goals);
      goals.append(makeMemoryItem('Active preview goal', objective, `Context owner: ${business} · Source: minimal business intake`));
    }
  }

  function updateUsage() {
    const remaining = Math.max(0, QUESTION_LIMIT - state.questionsUsed);
    setText('[data-snapshot-remaining]', remaining);
    setText('[data-context-remaining]', remaining);
    setText('[data-question-used]', state.questionsUsed);
    setText('[data-usage-spent]', state.questionsUsed);
    setText('[data-usage-questions]', state.questionsUsed);
    const meter = $('[data-question-meter]');
    if (meter) meter.style.width = `${(state.questionsUsed / QUESTION_LIMIT) * 100}%`;
    const usage = $('[data-usage-bar]');
    if (usage) usage.style.width = `${Math.min(100, (state.questionsUsed / 20) * 100)}%`;
  }

  function activateJourney(intake) {
    state.intake = { ...intake };
    state.questionsUsed = 0;
    state.questions = [];
    state.completed = false;
    populateContext();
    updateUsage();
    const intakePanel = $('[data-intake-panel]');
    const questionPanel = $('[data-question-panel]');
    const handoff = $('[data-handoff]');
    if (intakePanel) intakePanel.hidden = true;
    if (questionPanel) questionPanel.hidden = false;
    if (handoff) handoff.hidden = true;
    const conversation = $('[data-conversation]');
    if (conversation) {
      clearChildren(conversation);
      const bubble = document.createElement('div');
      bubble.className = 'bubble ai';
      const meta = document.createElement('span');
      meta.className = 'meta';
      meta.textContent = 'HAMYREN · Preview Simulation';
      const copy = document.createElement('span');
      copy.dataset.welcomeCopy = '';
      copy.textContent = `Hi ${intake.name}. I have the synthetic preview context for ${intake.business}. Your current objective is “${intake.objective}”. What would you like to work on first?`;
      bubble.append(meta, copy);
      conversation.append(bubble);
    }
    toast('Synthetic business context loaded locally. No data was sent.');
  }

  function fillForm() {
    const form = $('[data-intake-form]');
    if (!form) return;
    Object.entries(synthetic).forEach(([key, value]) => {
      const field = form.elements.namedItem(key);
      if (field) field.value = value;
    });
  }

  $$('[data-fill-synthetic]').forEach((button) => button.addEventListener('click', fillForm));
  $$('[data-load-synthetic]').forEach((button) => button.addEventListener('click', () => {
    activateJourney(synthetic);
    showView('ask');
  }));

  const intakeForm = $('[data-intake-form]');
  if (intakeForm) intakeForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(intakeForm);
    const intake = {
      name: String(data.get('name') || '').trim().slice(0, 120),
      business: String(data.get('business') || '').trim().slice(0, 240),
      industry: String(data.get('industry') || '').trim().slice(0, 160),
      region: String(data.get('region') || '').trim().slice(0, 160),
      objective: String(data.get('objective') || '').trim().slice(0, 600)
    };
    if (!intake.name || !intake.business || !intake.industry || !intake.objective) {
      toast('Please complete the four required preview fields.');
      return;
    }
    activateJourney(intake);
  });

  function addConversationBubble(role, text, metaText) {
    const root = $('[data-conversation]');
    if (!root) return;
    const bubble = document.createElement('div');
    bubble.className = `bubble ${role}`;
    if (metaText) {
      const meta = document.createElement('span');
      meta.className = 'meta';
      meta.textContent = metaText;
      bubble.append(meta);
    }
    const copy = document.createElement('span');
    copy.textContent = text;
    bubble.append(copy);
    root.append(bubble);
    bubble.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function simulatedAnswer(question, index) {
    const { business, industry, objective } = state.intake;
    const answers = [
      `Für ${business} würde ich zuerst einen einzigen Engpass wählen, der direkt auf dein Ziel „${objective}“ einzahlt. In einer ${industry}-Situation wäre mein erster Preview-Schritt: den aktuellen Weg vom Interesse bis zur qualifizierten Anfrage sichtbar machen und genau eine unnötige Hürde entfernen.`,
      `Bevor du neue Tools oder Kanäle ergänzt, würde ich prüfen, wo heute Kontext verloren geht. Notiere für ${business}: Wo kommt eine Anfrage her, welche Information fehlt beim nächsten Schritt und woran erkennst du eine wirklich passende Anfrage? Das schafft eine messbare Ausgangslage.`,
      `Die dritte Frage würde ich in ein kleines System übersetzen: Eingang → Qualifikation → nächster Schritt → Rückmeldung. Für dein Ziel „${objective}“ ist die wichtigste Designregel, dass jeder Schritt einen klaren Besitzer und ein sichtbares Ergebnis hat.`,
      `Jetzt würde ich nicht einfach mehr Aktivität erzeugen, sondern eine Entscheidung vorbereiten. Vergleiche zwei mögliche Hebel danach, welcher schneller qualifizierte Evidenz liefert. Für ${business} sollte die nächste Woche eher ein Lernzyklus als ein großer Umbau sein.`,
      `Nach diesen fünf Preview-Fragen wäre mein Handoff: Halte den gewählten Fokus als Goal fest, speichere nur bestätigte Business-Fakten im Memory und dokumentiere die nächste bewusste Entscheidung. Genau hier beginnt der dauerhafte HAMYREN-Workspace, statt dass der Kontext wieder im Chat verschwindet.`
    ];
    const prefix = question.length > 0 ? '' : 'Based on your preview context: ';
    return `${prefix}${answers[Math.min(index, answers.length - 1)]}`;
  }

  function completeJourney() {
    state.completed = true;
    const form = $('[data-question-form]');
    if (form) form.hidden = true;
    const prompts = $('.prompt-row');
    if (prompts) prompts.hidden = true;
    const handoff = $('[data-handoff]');
    if (handoff) handoff.hidden = false;
    const decisions = $('[data-decision-list]');
    if (decisions && state.intake) {
      clearChildren(decisions);
      decisions.append(
        makeMemoryItem('Preview decision candidate · Requires user confirmation', 'Create a focused next-step loop', `Use “${state.intake.objective}” as the active goal and validate one measurable bottleneck before expanding the system.`),
        makeMemoryItem('Why this matters', 'Context should survive the conversation', 'The account/persistent-context handoff is explicit. No account or subscription was created by this preview.')
      );
    }
    toast('5 of 5 complete. Account and persistent context now require an explicit handoff.');
  }

  const questionForm = $('[data-question-form]');
  if (questionForm) questionForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!state.intake || state.questionsUsed >= QUESTION_LIMIT) return;
    const field = questionForm.elements.namedItem('question');
    const question = String(field?.value || '').trim().slice(0, 700);
    if (!question) return;
    addConversationBubble('user', question);
    const answer = simulatedAnswer(question, state.questionsUsed);
    state.questions.push({ question, answer });
    state.questionsUsed += 1;
    updateUsage();
    addConversationBubble('ai', answer, `Preview simulation · Question ${state.questionsUsed} of ${QUESTION_LIMIT} · No provider call`);
    if (field) field.value = '';
    if (state.questionsUsed >= QUESTION_LIMIT) completeJourney();
  });

  $$('[data-prompt]').forEach((button) => button.addEventListener('click', () => {
    const field = $('[data-question-form] textarea');
    if (!field || state.questionsUsed >= QUESTION_LIMIT) return;
    field.value = button.dataset.prompt || '';
    field.focus();
  }));

  const eligibility = $$('[data-eligibility]');
  const accountGate = $('[data-account-gate]');
  function syncEligibility() {
    if (!accountGate) return;
    accountGate.disabled = !eligibility.length || !eligibility.every((box) => box.checked);
  }
  eligibility.forEach((box) => box.addEventListener('change', syncEligibility));
  if (accountGate) accountGate.addEventListener('click', () => {
    toast('Account creation is not activated. This is the end of the private product preview handoff.');
  });

  updateUsage();
})();
