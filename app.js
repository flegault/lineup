(() => {
  const STORAGE_KEY = 'lineup-v1';
  const LEGACY_KEYS = ['lineup-hockey-v1', 'lineup-hockey-v2'];
  const POSITIONS = { goalie: 'Gardien', defense: 'Défense', attack: 'Attaque' };
  const POSITION_LETTERS = { goalie: 'G', defense: 'D', attack: 'A' };
  const POSITION_FILTERS = [['goalie', 'Gardien'], ['defense', 'Défense'], ['attack', 'Attaque'], ['all', 'Tous']];
  const PLAYER_PAGE_SIZE = 10;
  const $ = (selector, parent = document) => parent.querySelector(selector);
  const clone = value => JSON.parse(JSON.stringify(value));
  const uid = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const normalizeText = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr').trim().replace(/\s+/g, ' ');
  const compareNames = (a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' });
  const clampRating = value => Math.max(0, Math.min(10, Math.round(Number(value ?? 5))));

  const defaults = {
    schemaVersion: 1,
    players: [],
    history: [],
    settings: { white: 'Blancs', black: 'Noirs', balancePositions: true, similarityMode: 'mixed' },
    match: {
      date: '',
      present: [],
      goalies: { white: null, black: null },
      teams: { white: [], black: [] },
      prepared: false
    }
  };

  let state;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    LEGACY_KEYS.forEach(key => localStorage.removeItem(key));
    state = clone(defaults);
  } else {
    try {
      state = { ...clone(defaults), ...JSON.parse(stored) };
    } catch {
      state = clone(defaults);
    }
  }

  state.schemaVersion = 1;
  state.settings = { ...defaults.settings, ...(state.settings || {}) };
  if (!['similar', 'mixed', 'different'].includes(state.settings.similarityMode)) state.settings.similarityMode = 'mixed';
  state.match = { ...clone(defaults.match), ...(state.match || {}) };
  state.match.goalies = { ...defaults.match.goalies, ...(state.match.goalies || {}) };
  state.match.teams = { ...clone(defaults.match.teams), ...(state.match.teams || {}) };
  state.players = (state.players || []).map(player => ({
    ...player,
    status: player.status === 'remplacant' ? 'remplacant' : 'regulier',
    active: player.active !== false,
    positions: Array.isArray(player.positions) ? player.positions.filter(position => POSITIONS[position]) : [],
    ratings: {
      goalie: clampRating(player.ratings?.goalie),
      offense: clampRating(player.ratings?.offense),
      defense: clampRating(player.ratings?.defense)
    },
    cardio: clampRating(player.cardio),
    incomplete: Boolean(player.incomplete)
  }));
  state.history = (state.history || []).map(match => ({
    date: match.date || '',
    teams: {
      white: {
        name: match.teams?.white?.name || state.settings.white,
        players: (match.teams?.white?.players || []).map(player => ({ id: player.id || null, name: player.name || '' })).filter(player => player.name)
      },
      black: {
        name: match.teams?.black?.name || state.settings.black,
        players: (match.teams?.black?.players || []).map(player => ({ id: player.id || null, name: player.name || '' })).filter(player => player.name)
      }
    }
  }));

  let view = 'match';
  let modal = null;
  let modalReturnFocusSelector = null;
  let editingPlayerId = null;
  let configTab = 'import';
  let playerStatusTab = 'regulier';
  let playerActivity = 'active';
  let playerPosition = 'all';
  let playerQuery = '';
  let playerPage = 1;
  let attendanceTab = 'regulier';
  let attendanceQuery = '';
  let attendancePosition = 'all';
  let notice = '';
  let noticeTimer;

  const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  const playerById = id => state.players.find(player => player.id === id) || null;
  const positionsOf = player => player?.positions || [];
  const rating = (player, skill) => Number(player?.ratings?.[skill] ?? 0);
  const activePlayers = () => state.players.filter(player => player.active);
  const presentPlayers = () => activePlayers().filter(player => state.match.present.includes(player.id));
  const defaultPresentIds = () => activePlayers().filter(player => player.status === 'regulier').map(player => player.id);
  const teamEntries = teamKey => state.match.teams[teamKey].map(entry => ({ ...entry, player: playerById(entry.playerId) })).filter(entry => entry.player);
  const hasTeamPlayers = () => state.match.teams.white.length + state.match.teams.black.length > 0;
  const hasComparableTeams = () => ['white', 'black'].every(team =>
    state.match.teams[team].some(entry => entry.position !== 'goalie')
  );
  const editingPlayer = () => playerById(editingPlayerId);
  const isExclusiveGoalie = player => positionsOf(player).length === 1 && positionsOf(player)[0] === 'goalie';
  const availableGoalies = () => presentPlayers().filter(player => positionsOf(player).includes('goalie'));
  const exclusiveGoalies = () => availableGoalies().filter(isExclusiveGoalie);

  function setNotice(message) {
    notice = message;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => {
      notice = '';
      $('#page-notice')?.remove();
    }, 3500);
  }

  function focusSelectorFor(element) {
    if (!element) return null;
    for (const attribute of ['data-select', 'data-action', 'data-assign-player', 'data-goalie-player', 'data-view']) {
      if (element.hasAttribute?.(attribute)) return `[${attribute}="${CSS.escape(element.getAttribute(attribute))}"]`;
    }
    return null;
  }

  function showModal(title, body = '', actions = [], extra = {}) {
    if (!modal) modalReturnFocusSelector = focusSelectorFor(document.activeElement);
    modal = { title, body, actions, ...extra };
    renderModal(true);
  }

  function closeModal() {
    const returnFocusSelector = modalReturnFocusSelector;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    modal = null;
    modalReturnFocusSelector = null;
    renderModal();
    requestAnimationFrame(() => {
      window.scrollTo({ left: scrollX, top: scrollY, behavior: 'instant' });
      if (returnFocusSelector) $(returnFocusSelector)?.focus({ preventScroll: true });
    });
  }

  function renderPreservingScroll(focusSelector = null) {
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const modalScrollTop = $('.modal-body')?.scrollTop || 0;
    const previousBehavior = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = 'auto';
    render();
    window.scrollTo(scrollX, scrollY);
    requestAnimationFrame(() => {
      window.scrollTo(scrollX, scrollY);
      const body = $('.modal-body');
      if (body) body.scrollTop = modalScrollTop;
      if (focusSelector) $(focusSelector)?.focus({ preventScroll: true });
      document.documentElement.style.scrollBehavior = previousBehavior;
    });
  }

  function gearIcon() {
    return '<svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm8.2 4.8v-2.6l-2.1-.7a7 7 0 0 0-.7-1.7l1-2-1.8-1.8-2 1a7 7 0 0 0-1.7-.7L12.2 2H9.8l-.7 2.1a7 7 0 0 0-1.7.7l-2-1-1.8 1.8 1 2a7 7 0 0 0-.7 1.7L2 10v2.6l2.1.7c.2.6.4 1.2.7 1.7l-1 2 1.8 1.8 2-1c.5.3 1.1.5 1.7.7l.7 2.1h2.6l.7-2.1c.6-.2 1.2-.4 1.7-.7l2 1 1.8-1.8-1-2c.3-.5.5-1.1.7-1.7l1.7-.7Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>';
  }

  function trashIcon() {
    return '<svg aria-hidden="true" viewBox="0 0 24 24" width="17" height="17"><path d="M4 7h16M9 7V4h6v3m-9 0 1 14h10l1-14M10 11v6m4-6v6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  }

  function pauseIcon() {
    return '<svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9.5 8.5v7m5-7v7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  }

  function statusIcon(kind) {
    const path = kind === 'green'
      ? '<path d="m7 12 3 3 7-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
      : kind === 'yellow'
        ? '<path d="M12 7v6m0 4h.01" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
        : '<path d="m9 9 6 6m0-6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';
    return `<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/>${path}</svg>`;
  }

  function playerPositions(player, assignedPosition = null) {
    const positions = positionsOf(player);
    if (!positions.length) return '<span class="no-position">—</span>';
    const pills = [];
    if (positions.includes('goalie')) {
      pills.push(`<span class="position-rating position-goalie ${assignedPosition === 'goalie' ? 'assigned' : ''}" title="Gardien : ${rating(player, 'goalie')}"><b><span>G</span><strong>${rating(player, 'goalie')}</strong></b></span>`);
    }
    if (positions.includes('defense') || positions.includes('attack')) {
      pills.push(`<span class="position-rating position-defense ${positions.includes('defense') ? '' : 'unavailable'} ${assignedPosition === 'defense' ? 'assigned' : ''}" title="Cote défensive : ${rating(player, 'defense')}${positions.includes('defense') ? '' : ' · position non jouable'}"><b><span>D</span><strong>${rating(player, 'defense')}</strong></b></span>`);
      pills.push(`<span class="position-rating position-attack ${positions.includes('attack') ? '' : 'unavailable'} ${assignedPosition === 'attack' ? 'assigned' : ''}" title="Cote offensive : ${rating(player, 'offense')}${positions.includes('attack') ? '' : ' · position non jouable'}"><b><span>A</span><strong>${rating(player, 'offense')}</strong></b></span>`);
    }
    return `<span class="position-ratings" aria-label="Positions et cotes">${pills.join('')}</span>`;
  }

  function playerIdentity(player, options = {}) {
    const lastPlayedText = options.lastPlayed === undefined ? '' : options.lastPlayed ? `Dernier match : ${options.lastPlayed}` : 'Jamais joué';
    return `<span class="player-identity"><span class="player-main"><strong>${escapeHtml(player.name)}</strong>${player.active === false ? `<span class="inactive-icon" title="Inactif" aria-label="Inactif">${pauseIcon()}</span>` : ''}${player.incomplete ? '<em class="incomplete">À compléter</em>' : ''}</span><span class="player-details">${playerPositions(player, options.assignedPosition)}<span class="cardio-value"><small>Cardio</small><b>${player.cardio}</b></span></span>${lastPlayedText ? `<small class="last-played">${escapeHtml(lastPlayedText)}</small>` : ''}</span>`;
  }

  function findAssignment(playerId) {
    for (const teamKey of ['white', 'black']) {
      const index = state.match.teams[teamKey].findIndex(entry => entry.playerId === playerId);
      if (index >= 0) return { teamKey, index, entry: state.match.teams[teamKey][index] };
    }
    return null;
  }

  function removeFromTeams(playerId) {
    ['white', 'black'].forEach(teamKey => {
      state.match.teams[teamKey] = state.match.teams[teamKey].filter(entry => entry.playerId !== playerId);
    });
  }

  function removePlayerFromMatch(playerId) {
    removeFromTeams(playerId);
    if (state.match.goalies.white === playerId) state.match.goalies.white = null;
    if (state.match.goalies.black === playerId) state.match.goalies.black = null;
  }

  function applyGoalieSelections() {
    ['white', 'black'].forEach(teamKey => {
      state.match.teams[teamKey] = state.match.teams[teamKey].filter(entry => entry.position !== 'goalie');
    });
    for (const teamKey of ['white', 'black']) {
      const playerId = state.match.goalies[teamKey];
      if (!playerId) continue;
      removeFromTeams(playerId);
      state.match.teams[teamKey].push({ playerId, position: 'goalie' });
    }
  }

  function reconcileGoalies() {
    const availableIds = new Set(availableGoalies().map(player => player.id));
    for (const teamKey of ['white', 'black']) {
      if (!availableIds.has(state.match.goalies[teamKey])) state.match.goalies[teamKey] = null;
    }
    if (state.match.goalies.white && state.match.goalies.white === state.match.goalies.black) state.match.goalies.black = null;
    const pure = exclusiveGoalies().sort(compareNames);
    if (pure.length > 2) {
      state.match.goalies = { white: null, black: null };
      applyGoalieSelections();
      return;
    }
    if (pure.length === 2) {
      const pureIds = pure.map(player => player.id);
      let white = pureIds.includes(state.match.goalies.white) ? state.match.goalies.white : null;
      let black = pureIds.includes(state.match.goalies.black) ? state.match.goalies.black : null;
      if (white && black && white === black) black = null;
      if (white && !black) black = pureIds.find(id => id !== white);
      else if (black && !white) white = pureIds.find(id => id !== black);
      else if (!white && !black) [white, black] = pureIds;
      state.match.goalies = { white, black };
    }
    applyGoalieSelections();
  }

  function goalieValidation() {
    const available = availableGoalies();
    const pure = exclusiveGoalies();
    if (pure.length > 2) return { ok: false, reason: 'Trop de gardiens. Il faut un maximum de deux gardiens ou leur donner une autre position.' };
    if (available.length < 2) return { ok: false, reason: 'Il faut au moins deux joueurs capables d’être gardiens.' };
    const selected = [state.match.goalies.white, state.match.goalies.black].filter(Boolean);
    if (selected.length !== 2 || new Set(selected).size !== 2) return { ok: false, reason: 'Choisissez un gardien pour chaque équipe.' };
    if (selected.some(id => !available.some(player => player.id === id))) return { ok: false, reason: 'Un gardien sélectionné n’est plus disponible.' };
    if (pure.some(player => !selected.includes(player.id))) return { ok: false, reason: 'Chaque gardien exclusif présent doit être sélectionné.' };
    return { ok: true, reason: '' };
  }

  function goalieAvailabilityStatus() {
    const pure = exclusiveGoalies().length;
    const available = availableGoalies().length;
    if (pure > 2) return { kind: 'red', label: 'Erreur', text: 'Trop de gardiens. Il faut un maximum de deux gardiens ou leur donner une autre position.' };
    if (available < 2) return { kind: 'red', label: 'Erreur', text: 'Moins de deux gardiens' };
    if (pure === 2) return { kind: 'green', label: 'Prêt', text: 'Deux gardiens exclusifs' };
    return { kind: 'yellow', label: 'À choisir', text: 'Sélection manuelle requise' };
  }

  function attendanceStatus(count) {
    if (count >= 14) return { kind: 'green', label: 'Idéal', text: 'Effectif idéal' };
    if (count >= 12) return { kind: 'yellow', label: 'Limité', text: 'Effectif limité' };
    return { kind: 'red', label: count < 8 ? 'Insuffisant' : 'Réduit', text: count < 8 ? 'Minimum de huit joueurs' : 'Effectif réduit' };
  }

  function cleanMatch() {
    const activeIds = new Set(activePlayers().map(player => player.id));
    state.match.present = [...new Set(state.match.present || [])].filter(id => activeIds.has(id));
    for (const teamKey of ['white', 'black']) {
      state.match.teams[teamKey] = (state.match.teams[teamKey] || []).filter(entry => {
        const player = playerById(entry.playerId);
        return player && state.match.present.includes(player.id) && positionsOf(player).includes(entry.position);
      });
    }
    reconcileGoalies();
  }

  function resetMatch() {
    state.match = {
      date: '',
      present: defaultPresentIds(),
      goalies: { white: null, black: null },
      teams: { white: [], black: [] },
      prepared: false
    };
    reconcileGoalies();
  }

  function restartAssignments() {
    const date = state.match.date;
    const present = [...state.match.present];
    state.match = {
      date,
      present,
      goalies: { white: null, black: null },
      teams: { white: [], black: [] },
      prepared: false
    };
    reconcileGoalies();
  }

  function teamStats(teamKey) {
    const entries = teamEntries(teamKey);
    const goalie = entries.find(entry => entry.position === 'goalie');
    const field = entries.filter(entry => entry.position !== 'goalie');
    const counts = {
      goalie: goalie ? 1 : 0,
      defense: field.filter(entry => entry.position === 'defense').length,
      attack: field.filter(entry => entry.position === 'attack').length
    };
    const offense = field.reduce((sum, entry) => sum + rating(entry.player, 'offense'), 0);
    const defense = field.reduce((sum, entry) => sum + rating(entry.player, 'defense'), 0);
    const cardio = field.length ? field.reduce((sum, entry) => sum + entry.player.cardio, 0) / field.length : 0;
    const additionalPlayers = Math.max(0, field.length - 4);
    const cardioWeight = 1 - Math.min(additionalPlayers, 4) / 4;
    return {
      players: entries.length,
      fieldPlayers: field.length,
      goalie: goalie ? rating(goalie.player, 'goalie') : 0,
      offense,
      defense,
      cardio,
      effectiveCardio: cardio * cardioWeight,
      counts
    };
  }

  function evaluateTeamKeys() {
    const white = teamStats('white');
    const black = teamStats('black');
    const maxField = Math.max(white.fieldPlayers, black.fieldPlayers, 1);
    const components = [
      Math.abs(white.goalie - black.goalie) / 10,
      Math.abs(white.offense - black.offense) / (10 * maxField),
      Math.abs(white.defense - black.defense) / (10 * maxField),
      Math.abs(white.effectiveCardio - black.effectiveCardio) / 10
    ];
    if (state.settings.balancePositions) {
      components.push((Math.abs(white.counts.defense - black.counts.defense) + Math.abs(white.counts.attack - black.counts.attack)) / (2 * maxField));
    }
    const score = components.reduce((sum, value) => sum + value, 0) / components.length;
    return { white, black, score, quality: Math.max(0, Math.round((1 - Math.min(score, 1)) * 100)) };
  }

  function statsForEntries(entries) {
    const goalie = entries.find(entry => entry.position === 'goalie');
    const field = entries.filter(entry => entry.position !== 'goalie');
    const cardio = field.length ? field.reduce((sum, entry) => sum + entry.player.cardio, 0) / field.length : 0;
    const additionalPlayers = Math.max(0, field.length - 4);
    return {
      players: entries.length,
      fieldPlayers: field.length,
      goalie: goalie ? rating(goalie.player, 'goalie') : 0,
      offense: field.reduce((sum, entry) => sum + rating(entry.player, 'offense'), 0),
      defense: field.reduce((sum, entry) => sum + rating(entry.player, 'defense'), 0),
      cardio,
      effectiveCardio: cardio * (1 - Math.min(additionalPlayers, 4) / 4),
      counts: {
        goalie: goalie ? 1 : 0,
        defense: field.filter(entry => entry.position === 'defense').length,
        attack: field.filter(entry => entry.position === 'attack').length
      }
    };
  }

  function evaluateEntries(whiteEntries, blackEntries) {
    const white = statsForEntries(whiteEntries);
    const black = statsForEntries(blackEntries);
    const maxField = Math.max(white.fieldPlayers, black.fieldPlayers, 1);
    const components = [
      Math.abs(white.goalie - black.goalie) / 10,
      Math.abs(white.offense - black.offense) / (10 * maxField),
      Math.abs(white.defense - black.defense) / (10 * maxField),
      Math.abs(white.effectiveCardio - black.effectiveCardio) / 10
    ];
    if (state.settings.balancePositions) {
      components.push((Math.abs(white.counts.defense - black.counts.defense) + Math.abs(white.counts.attack - black.counts.attack)) / (2 * maxField));
    }
    return components.reduce((sum, value) => sum + value, 0) / components.length;
  }

  function latestHistoryMatch() {
    return [...state.history]
      .filter(match => match.date)
      .sort((a, b) => b.date.localeCompare(a.date))[0] || null;
  }

  function teammatePairs(playerIds) {
    const ids = [...new Set(playerIds.filter(Boolean))].sort();
    const pairs = [];
    for (let first = 0; first < ids.length; first += 1) {
      for (let second = first + 1; second < ids.length; second += 1) pairs.push(`${ids[first]}|${ids[second]}`);
    }
    return pairs;
  }

  function historicalReference() {
    const match = latestHistoryMatch();
    if (!match) return { match: null, pairs: new Set(), comparable: false };
    const presentIds = new Set(presentPlayers().map(player => player.id));
    const pairs = new Set(['white', 'black'].flatMap(teamKey => teammatePairs(
      match.teams[teamKey].players.map(player => player.id).filter(id => presentIds.has(id))
    )));
    return { match, pairs, comparable: pairs.size > 0 };
  }

  function candidateSimilarity(whiteEntries, blackEntries, referencePairs) {
    if (!referencePairs.size) return 0;
    const candidatePairs = new Set([
      ...teammatePairs(whiteEntries.map(entry => entry.player.id)),
      ...teammatePairs(blackEntries.map(entry => entry.player.id))
    ]);
    let repeated = 0;
    referencePairs.forEach(pair => {
      if (candidatePairs.has(pair)) repeated += 1;
    });
    return repeated / referencePairs.size;
  }

  function assignRoles(players) {
    const slots = state.settings.balancePositions
      ? players.length <= 3 ? ['defense', 'attack'] : ['defense', 'defense', 'attack', 'attack']
      : [];
    return players.map(player => {
      const eligible = positionsOf(player).filter(position => position === 'defense' || position === 'attack');
      let position = slots.find(slot => eligible.includes(slot));
      if (!position) {
        position = [...eligible].sort((a, b) => {
          const aRating = a === 'attack' ? rating(player, 'offense') : rating(player, 'defense');
          const bRating = b === 'attack' ? rating(player, 'offense') : rating(player, 'defense');
          return bRating - aRating;
        })[0];
      }
      const slotIndex = slots.indexOf(position);
      if (slotIndex >= 0) slots.splice(slotIndex, 1);
      return { player, position };
    });
  }

  function optimizeTeams() {
    reconcileGoalies();
    const goalieCheck = goalieValidation();
    if (!goalieCheck.ok) {
      showModal('Gardiens requis', `<p>${escapeHtml(goalieCheck.reason)}</p>`, [['Choisir les gardiens', 'open-goalies', 'primary'], ['Fermer', 'close']]);
      return;
    }
    const incomplete = presentPlayers().filter(player => player.incomplete || !positionsOf(player).length);
    if (incomplete.length) {
      showModal('Fiches à compléter', `<p>Ajoutez les positions et les cotes avant d’optimiser :</p><ul>${incomplete.map(player => `<li>${escapeHtml(player.name)}</li>`).join('')}</ul>`, [['OK', 'close', 'primary']]);
      return;
    }
    const goalieIds = new Set([state.match.goalies.white, state.match.goalies.black]);
    const fieldPlayers = presentPlayers().filter(player => !goalieIds.has(player.id));
    const invalid = fieldPlayers.filter(player => !positionsOf(player).some(position => position === 'defense' || position === 'attack'));
    if (invalid.length) {
      showModal('Positions insuffisantes', `<p>Ces joueurs ne peuvent pas être assignés en défense ou en attaque :</p><ul>${invalid.map(player => `<li>${escapeHtml(player.name)}</li>`).join('')}</ul>`, [['OK', 'close', 'primary']]);
      return;
    }
    if (fieldPlayers.length < 6) {
      showModal('Effectif insuffisant', '<p>Il faut au moins deux gardiens et six autres joueurs, soit un gardien et trois joueurs supplémentaires par équipe.</p>', [['OK', 'close', 'primary']]);
      return;
    }
    const whiteGoalie = playerById(state.match.goalies.white);
    const blackGoalie = playerById(state.match.goalies.black);
    const reference = historicalReference();
    const mode = reference.comparable ? state.settings.similarityMode : 'mixed';
    const candidates = [];
    for (let iteration = 0; iteration < 2500; iteration += 1) {
      const shuffled = [...fieldPlayers].sort(() => Math.random() - 0.5);
      const half = Math.ceil(shuffled.length / 2);
      const white = [{ player: whiteGoalie, position: 'goalie' }, ...assignRoles(shuffled.slice(0, half))];
      const black = [{ player: blackGoalie, position: 'goalie' }, ...assignRoles(shuffled.slice(half))];
      const score = evaluateEntries(white, black);
      candidates.push({ white, black, score, similarity: candidateSimilarity(white, black, reference.pairs) });
    }
    const bestBalance = Math.min(...candidates.map(candidate => candidate.score));
    const eligible = candidates.filter(candidate => candidate.score <= bestBalance + 0.03 + Number.EPSILON);
    eligible.sort((a, b) => {
      if (mode === 'similar' && a.similarity !== b.similarity) return b.similarity - a.similarity;
      if (mode === 'different' && a.similarity !== b.similarity) return a.similarity - b.similarity;
      return a.score - b.score;
    });
    const best = eligible[0];
    state.match.teams = {
      white: best.white.map(entry => ({ playerId: entry.player.id, position: entry.position })),
      black: best.black.map(entry => ({ playerId: entry.player.id, position: entry.position }))
    };
    state.match.prepared = true;
    const modeLabel = mode === 'similar' ? 'similaires au dernier match' : mode === 'different' ? 'différentes du dernier match' : 'mélangées';
    closeModal();
    setNotice(`Les équipes ont été optimisées et ${modeLabel}.`);
    save();
    render();
  }

  function archiveValidation() {
    if (!state.match.date) return { ok: false, reason: 'Choisissez une date.' };
    const goalieCheck = goalieValidation();
    if (!goalieCheck.ok) return goalieCheck;
    for (const teamKey of ['white', 'black']) {
      const fieldCount = teamEntries(teamKey).filter(entry => entry.position !== 'goalie').length;
      if (fieldCount < 3) return { ok: false, reason: `Il manque des joueurs chez les ${state.settings[teamKey]}.` };
    }
    return { ok: true, reason: '' };
  }

  function archiveCurrent() {
    state.history.unshift({
      date: state.match.date,
      teams: {
        white: {
          name: state.settings.white,
          players: teamEntries('white').map(entry => ({ id: entry.player.id, name: entry.player.name }))
        },
        black: {
          name: state.settings.black,
          players: teamEntries('black').map(entry => ({ id: entry.player.id, name: entry.player.name }))
        }
      }
    });
    resetMatch();
    closeModal();
    setNotice('Le match a été archivé. Un nouveau match est prêt.');
    save();
    render();
  }

  function teamPlayer(entry) {
    const attribute = entry.position === 'goalie' ? `data-goalie-player="${entry.player.id}"` : `data-assign-player="${entry.player.id}"`;
    const label = entry.position === 'goalie' ? `Modifier les gardiens` : `Modifier l’assignation de ${escapeHtml(entry.player.name)}`;
    return `<button class="team-player player-surface" ${attribute} aria-label="${label}">${playerIdentity(entry.player, { assignedPosition: entry.position })}<span class="row-chevron" aria-hidden="true">›</span></button>`;
  }

  function positionGroup(team, position) {
    const entries = team.filter(entry => entry.position === position);
    return `<section class="position-group position-group-${position}"><header><span class="role-chip role-${position}">${POSITION_LETTERS[position]}</span><strong>${POSITIONS[position]}</strong><small>${entries.length}</small></header><div class="position-group-list">${entries.map(teamPlayer).join('') || '<small class="empty-position">Aucun joueur</small>'}</div></section>`;
  }

  function teamView(teamKey, stats) {
    const team = teamEntries(teamKey);
    return `<section class="team-card" style="--team:${teamKey === 'white' ? '#d9a72e' : '#33415c'}"><div class="team-head"><div><span class="eyebrow">ÉQUIPE</span><input class="team-name" data-name="${teamKey}" value="${escapeHtml(state.settings[teamKey])}" aria-label="Nom de l’équipe"></div><span class="team-meta">${team.length} joueurs · A ${stats.offense} · D ${stats.defense}</span></div>${positionGroup(team, 'goalie')}${positionGroup(team, 'defense')}${positionGroup(team, 'attack')}</section>`;
  }

  function unassignedPlayers() {
    const assigned = new Set([...state.match.teams.white, ...state.match.teams.black].map(entry => entry.playerId));
    return presentPlayers().filter(player => !assigned.has(player.id)).sort(compareNames);
  }

  function unassignedView() {
    const players = unassignedPlayers();
    if (!players.length) return '';
    return `<section class="card unassigned-card"><div class="section-heading"><div><span class="eyebrow">À ASSIGNER</span><h2>Joueurs présents non assignés</h2></div><span class="count-badge">${players.length}</span></div><div class="unassigned-list">${players.map(player => `<button class="unassigned-player player-surface" data-assign-player="${player.id}" aria-label="Modifier l’assignation de ${escapeHtml(player.name)}">${playerIdentity(player)}<span class="row-chevron" aria-hidden="true">›</span></button>`).join('')}</div></section>`;
  }

  function radarView(result) {
    const maxField = Math.max(result.white.fieldPlayers, result.black.fieldPlayers, 1);
    const values = stats => [
      stats.goalie / 10,
      stats.offense / (10 * maxField),
      stats.cardio / 10,
      stats.defense / (10 * maxField)
    ].map(value => Math.max(0, Math.min(1, value)));
    const point = (index, value) => {
      const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]];
      return `${100 + directions[index][0] * 68 * value},${100 + directions[index][1] * 68 * value}`;
    };
    const polygon = stats => values(stats).map((value, index) => point(index, value)).join(' ');
    const grids = [.25, .5, .75, 1].map(level => `<polygon points="${[0, 1, 2, 3].map(index => point(index, level)).join(' ')}"/>`).join('');
    const aria = `${state.settings.white}: gardien ${result.white.goalie}, attaque ${result.white.offense}, défense ${result.white.defense}, cardio ${result.white.cardio.toFixed(1)}. ${state.settings.black}: gardien ${result.black.goalie}, attaque ${result.black.offense}, défense ${result.black.defense}, cardio ${result.black.cardio.toFixed(1)}.`;
    return `<div class="radar-wrap"><svg class="radar-chart" viewBox="0 0 200 200" role="img" aria-label="${escapeHtml(aria)}"><g class="radar-grid">${grids}<line x1="100" y1="25" x2="100" y2="175"/><line x1="25" y1="100" x2="175" y2="100"/></g><polygon class="radar-team radar-white" points="${polygon(result.white)}"/><polygon class="radar-team radar-black" points="${polygon(result.black)}"/><g class="radar-labels"><text x="100" y="14" text-anchor="middle">Gardien</text><text x="190" y="103" text-anchor="end">Attaque</text><text x="100" y="195" text-anchor="middle">Cardio</text><text x="10" y="103">Défense</text></g></svg></div>`;
  }

  function statsTable(result) {
    const row = (label, white, black, digits = 0) => {
      const difference = Math.abs(Number(white) - Number(black));
      return `<tr><th>${label}</th><td>${Number(white).toFixed(digits)}</td><td>${Number(black).toFixed(digits)}</td><td>${difference.toFixed(digits)}</td></tr>`;
    };
    return `<div class="stats-table-wrap"><table class="stats-table"><thead><tr><th>Mesure</th><th>${escapeHtml(state.settings.white)}</th><th>${escapeHtml(state.settings.black)}</th><th>Écart</th></tr></thead><tbody>${row('Joueurs', result.white.players, result.black.players)}${row('Gardien', result.white.goalie, result.black.goalie)}${row('Attaque', result.white.offense, result.black.offense)}${row('Défense', result.white.defense, result.black.defense)}${row('Cardio moyen', result.white.cardio, result.black.cardio, 1)}${row('Défenseurs assignés', result.white.counts.defense, result.black.counts.defense)}${row('Attaquants assignés', result.white.counts.attack, result.black.counts.attack)}</tbody></table></div>`;
  }

  function positionsChart(result) {
    const composition = (teamKey, stats) => {
      const count = stats.counts.goalie + stats.counts.defense + stats.counts.attack;
      const segments = ['goalie', 'defense', 'attack'].flatMap(position => Array(stats.counts[position]).fill(`<i class="segment segment-${position}"></i>`)).join('');
      return `<div class="position-row"><span>${escapeHtml(state.settings[teamKey])}</span><div style="--count:${Math.max(count, 1)}">${segments}</div><small>${stats.counts.goalie} G · ${stats.counts.defense} D · ${stats.counts.attack} A</small></div>`;
    };
    return `<div class="positions-chart"><strong>Positions assignées</strong>${composition('white', result.white)}${composition('black', result.black)}</div>`;
  }

  function shareText() {
    const dateLine = state.match.date ? `Match du ${state.match.date}\n\n` : '';
    const teamText = teamKey => `${state.settings[teamKey]}\n${teamEntries(teamKey).map(entry => `${POSITIONS[entry.position]} — ${entry.player.name}`).join('\n')}`;
    return `${dateLine}${teamText('white')}\n\n${teamText('black')}`;
  }

  function analyticsView(result) {
    return `<section class="analytics"><div class="analytics-head"><div><span class="eyebrow">COMPARAISON</span><strong>Équilibre des équipes</strong></div><div class="legend"><span><i class="swatch swatch-white"></i>${escapeHtml(state.settings.white)}</span><span><i class="swatch swatch-black"></i>${escapeHtml(state.settings.black)}</span></div></div><div class="analytics-grid">${radarView(result)}${statsTable(result)}</div>${positionsChart(result)}</section><section class="card share-card"><h3>Message aux joueurs</h3><textarea class="share" id="share" readonly>${escapeHtml(shareText())}</textarea><p><button class="button primary" data-action="copy">Copier</button></p></section>`;
  }

  function teamsBoard() {
    const result = evaluateTeamKeys();
    const comparable = hasComparableTeams();
    return `${unassignedView()}<div class="teams-grid">${teamView('white', result.white)}<div class="balance-spine"><span>ÉQUILIBRE</span><strong>${comparable ? `${result.quality}%` : '—'}</strong><div class="balance-meter"><i style="width:${comparable ? result.quality : 0}%"></i></div><small>${!comparable ? 'Composez les équipes' : result.quality >= 90 ? 'Très proche' : result.quality >= 75 ? 'Bon' : 'À ajuster'}</small></div>${teamView('black', result.black)}</div>${comparable ? analyticsView(result) : ''}`;
  }

  function statusBadge(status) {
    return `<span class="status-indicator status-${status.kind}" aria-label="${escapeHtml(status.label)}">${statusIcon(status.kind)}<span>${escapeHtml(status.label)}</span></span>`;
  }

  function matchView() {
    const present = presentPlayers();
    const regularCount = present.filter(player => player.status === 'regulier').length;
    const replacementCount = present.length - regularCount;
    const attendance = attendanceStatus(present.length);
    const goalies = goalieAvailabilityStatus();
    const result = evaluateTeamKeys();
    const archiveCheck = archiveValidation();
    const comparable = hasComparableTeams();
    return `<div class="page-stack">${notice ? `<div id="page-notice" class="notice success" role="status">${escapeHtml(notice)}</div>` : ''}<section class="match-toolbar"><div class="match-title"><span>SESSION</span><strong>Match</strong></div><div class="match-actions"><label class="date-field">Date du match<input data-date type="date" value="${state.match.date}"></label><button data-action="new-match" class="button">Nouveau</button><button data-action="archive" class="button" ${archiveCheck.ok ? '' : `disabled title="${escapeHtml(archiveCheck.reason)}"`}>Archiver</button></div>${archiveCheck.ok ? '' : `<small class="match-validation">${escapeHtml(archiveCheck.reason)}</small>`}</section><section class="summary-grid"><button class="summary-card interactive status-card status-${attendance.kind}" data-action="attendance"><span>Joueurs présents</span><strong>${present.length}</strong><small>${regularCount} réguliers · ${replacementCount} remplaçants</small>${statusBadge(attendance)}<span class="summary-chevron" aria-hidden="true">›</span></button><button class="summary-card interactive status-card status-${goalies.kind}" data-action="goalies"><span>Gardiens disponibles</span><strong>${availableGoalies().length}</strong><small>${escapeHtml(goalies.text)}</small>${statusBadge(goalies)}<span class="summary-chevron" aria-hidden="true">›</span></button><div class="summary-card"><span>Équilibre global</span><strong>${comparable ? `${result.quality}%` : '—'}</strong><small>${comparable ? 'Gardien · attaque · défense · cardio' : 'Composez ou optimisez les équipes'}</small></div></section><section class="card teams-controls"><div><span class="eyebrow">COMPOSITION</span><h2>Équipes</h2></div><div class="team-control-actions"><button data-action="optimize" class="button primary">Optimiser</button><button data-action="restart" class="button">Recommencer</button></div></section>${teamsBoard()}</div>`;
  }

  function ratingField(player, skill, label, enabled) {
    return `<label class="rating ${enabled ? '' : 'off'}" data-rating="${skill}">${label} <output>${player.ratings[skill] ?? 5}</output><input type="range" name="${skill}" min="0" max="10" step="1" value="${player.ratings[skill] ?? 5}" ${enabled ? '' : 'disabled'}></label>`;
  }

  function playerForm() {
    const selected = editingPlayer();
    const player = selected || { name: '', positions: [], ratings: { goalie: 5, offense: 5, defense: 5 }, cardio: 5, status: 'regulier', active: true };
    const hasGoalie = positionsOf(player).includes('goalie');
    const hasField = positionsOf(player).some(position => position === 'defense' || position === 'attack');
    return `<form id="player-form" class="form"><div id="player-form-error" class="notice error player-form-error" role="alert"></div><label class="name-field"><span>Nom du joueur</span><input name="name" required autocomplete="off" placeholder="Ex. John Lajoie" value="${escapeHtml(player.name)}"></label><div class="position-options" aria-label="Positions">${Object.keys(POSITIONS).map(position => `<label><input type="checkbox" name="pos" value="${position}" ${positionsOf(player).includes(position) ? 'checked' : ''}><span>${POSITIONS[position]}</span></label>`).join('')}</div><div class="ratings-grid">${ratingField(player, 'goalie', 'Niveau gardien', hasGoalie)}${ratingField(player, 'offense', 'Cote offensive', hasField)}${ratingField(player, 'defense', 'Cote défensive', hasField)}</div><label class="rating">Niveau cardio <output>${player.cardio}</output><input type="range" name="cardio" min="0" max="10" step="1" value="${player.cardio}"></label><div class="segmented-group" aria-label="Statut du joueur"><label><input type="radio" name="status" value="regulier" ${player.status === 'regulier' ? 'checked' : ''}><span>Régulier</span></label><label><input type="radio" name="status" value="remplacant" ${player.status === 'remplacant' ? 'checked' : ''}><span>Remplaçant</span></label></div><div class="segmented-group" aria-label="État du joueur"><label><input type="radio" name="activity" value="active" ${player.active ? 'checked' : ''}><span>Actif</span></label><label><input type="radio" name="activity" value="inactive" ${player.active ? '' : 'checked'}><span>Inactif</span></label></div><div class="form-actions"><button class="button primary">${selected ? 'Enregistrer' : 'Ajouter le joueur'}</button><button type="button" class="button" data-action="cancel">Annuler</button></div></form>`;
  }

  function filteredPlayers() {
    const query = normalizeText(playerQuery);
    return state.players.filter(player => player.status === playerStatusTab)
      .filter(player => playerActivity === 'all' || (playerActivity === 'active' ? player.active : !player.active))
      .filter(player => playerPosition === 'all' || positionsOf(player).includes(playerPosition))
      .filter(player => !query || normalizeText(player.name).includes(query))
      .sort(compareNames);
  }

  function playerListRow(player) {
    return `<div class="player-row ${editingPlayerId === player.id ? 'selected' : ''}" role="option" aria-selected="${editingPlayerId === player.id}"><button class="player-select player-surface" data-select="${player.id}">${playerIdentity(player)}</button><button class="trash-button" data-delete="${player.id}" aria-label="Supprimer ${escapeHtml(player.name)}">${trashIcon()}</button></div>`;
  }

  function playersView() {
    const regulars = state.players.filter(player => player.status === 'regulier');
    const replacements = state.players.filter(player => player.status === 'remplacant');
    const current = playerStatusTab === 'regulier' ? regulars : replacements;
    const activeCount = current.filter(player => player.active).length;
    const inactiveCount = current.length - activeCount;
    const filtered = filteredPlayers();
    let visible = filtered;
    let pagination = '';
    if (playerStatusTab === 'remplacant') {
      const pages = Math.max(1, Math.ceil(filtered.length / PLAYER_PAGE_SIZE));
      playerPage = Math.min(playerPage, pages);
      visible = filtered.slice((playerPage - 1) * PLAYER_PAGE_SIZE, playerPage * PLAYER_PAGE_SIZE);
      pagination = `<nav class="pagination" aria-label="Pagination des remplaçants"><button class="button" data-player-page="${playerPage - 1}" ${playerPage <= 1 ? 'disabled' : ''}>Précédent</button><span>Page ${playerPage} sur ${pages}</span><button class="button" data-player-page="${playerPage + 1}" ${playerPage >= pages ? 'disabled' : ''}>Suivant</button></nav>`;
    }
    return `<div class="page-stack"><header class="page-heading"><div><h2>Joueurs</h2></div><div class="page-actions"><button class="button primary" data-action="add-player">Ajouter un joueur</button></div></header><article class="card player-directory"><div class="directory-tabs modal-tabs" aria-label="Statut des joueurs"><button class="${playerStatusTab === 'regulier' ? 'active' : ''}" data-player-tab="regulier">Réguliers <b>${regulars.length}</b></button><button class="${playerStatusTab === 'remplacant' ? 'active' : ''}" data-player-tab="remplacant">Remplaçants <b>${replacements.length}</b></button></div><div class="section-heading"><div><h2>${playerStatusTab === 'regulier' ? 'Réguliers' : 'Remplaçants'}</h2><small>${activeCount} actif${activeCount === 1 ? '' : 's'} · ${inactiveCount} inactif${inactiveCount === 1 ? '' : 's'}</small></div><span class="count-badge">${current.length}</span></div><div class="player-filters"><label class="search-field"><span class="search-icon" aria-hidden="true">⌕</span><input id="player-search" type="search" placeholder="Filtrer par nom" value="${escapeHtml(playerQuery)}" aria-label="Filtrer les joueurs par nom"></label><div class="filter-segments" aria-label="Filtrer par état">${[['active', 'Actifs'], ['inactive', 'Inactifs'], ['all', 'Tous']].map(([value, label]) => `<button class="${playerActivity === value ? 'active' : ''}" data-player-activity="${value}">${label}</button>`).join('')}</div><div class="filter-segments position-filters" aria-label="Filtrer par position">${POSITION_FILTERS.map(([value, label]) => `<button class="${playerPosition === value ? 'active' : ''}" data-player-position="${value}">${label}</button>`).join('')}</div><small>${filtered.length} résultat${filtered.length === 1 ? '' : 's'}</small></div>${visible.length ? `<div class="player-list" role="listbox">${visible.map(playerListRow).join('')}</div>` : '<p class="muted empty-results">Aucun joueur ne correspond aux filtres.</p>'}${pagination}</article></div>`;
  }

  function historyTeam(team) {
    return `<div class="history-team">${team.players.map(player => `<span class="history-player">${escapeHtml(player.name)}</span>`).join('') || '<span class="muted">Aucun joueur</span>'}</div>`;
  }

  function historyView() {
    return `<section class="card"><div class="section-heading history-title"><h2>Historique</h2>${state.history.length ? '<button class="button danger" data-action="clear-history">Effacer l’historique</button>' : ''}</div>${state.history.length ? state.history.map((match, index) => `<details class="history-item"><summary><strong>${escapeHtml(match.date)}</strong><button class="trash-button" data-delete-history="${index}" aria-label="Supprimer ce match">${trashIcon()}</button></summary><div class="history-content"><h3>${escapeHtml(match.teams.white.name)}</h3>${historyTeam(match.teams.white)}<h3>${escapeHtml(match.teams.black.name)}</h3>${historyTeam(match.teams.black)}</div></details>`).join('') : '<p class="muted">Aucun match archivé.</p>'}</section>`;
  }

  function lastPlayed(playerId) {
    return state.history
      .filter(match => [...match.teams.white.players, ...match.teams.black.players].some(player => player.id === playerId))
      .map(match => match.date)
      .filter(Boolean)
      .sort()
      .reverse()[0] || null;
  }

  function attendanceModalBody() {
    const query = normalizeText(attendanceQuery);
    const players = activePlayers().filter(player => player.status === attendanceTab)
      .filter(player => attendancePosition === 'all' || positionsOf(player).includes(attendancePosition))
      .filter(player => !query || normalizeText(player.name).includes(query));
    if (attendanceTab === 'regulier') players.sort(compareNames);
    else {
      players.sort((a, b) => {
        const aDate = lastPlayed(a.id);
        const bDate = lastPlayed(b.id);
        if (aDate && bDate && aDate !== bDate) return bDate.localeCompare(aDate);
        if (aDate && !bDate) return -1;
        if (!aDate && bDate) return 1;
        return compareNames(a, b);
      });
    }
    return `<div class="attendance-controls"><div class="modal-tabs"><button class="${attendanceTab === 'regulier' ? 'active' : ''}" data-attendance-tab="regulier">Réguliers</button><button class="${attendanceTab === 'remplacant' ? 'active' : ''}" data-attendance-tab="remplacant">Remplaçants</button></div><label class="search-field"><span class="search-icon" aria-hidden="true">⌕</span><input id="attendance-search" type="search" placeholder="Filtrer par nom" value="${escapeHtml(attendanceQuery)}" aria-label="Filtrer les présences par nom"></label><div class="filter-segments" aria-label="Filtrer les présences par position">${POSITION_FILTERS.map(([value, label]) => `<button class="${attendancePosition === value ? 'active' : ''}" data-attendance-position="${value}">${label}</button>`).join('')}</div><small>${presentPlayers().length} joueurs présents</small></div><div class="attendance-list">${players.map(player => `<label class="attendance-player player-surface"><input data-attendance-player="${player.id}" type="checkbox" ${state.match.present.includes(player.id) ? 'checked' : ''}><span class="attendance-check" aria-hidden="true">✓</span>${playerIdentity(player, { lastPlayed: attendanceTab === 'remplacant' ? lastPlayed(player.id) : undefined })}</label>`).join('') || '<p class="muted">Aucun joueur ne correspond aux filtres.</p>'}</div>`;
  }

  function exportText() {
    return ['regulier', 'remplacant'].flatMap(status => state.players.filter(player => player.status === status).sort(compareNames).map(player => {
      const prefix = status === 'regulier' ? 'REG' : 'REM';
      const activity = player.active ? 'ACTIF' : 'INACTIF';
      if (!positionsOf(player).length) return `${prefix} | ${player.name} | ${activity}`;
      const positionCode = ['goalie', 'defense', 'attack'].filter(position => positionsOf(player).includes(position)).map(position => POSITION_LETTERS[position]).join('');
      const hasField = positionsOf(player).some(position => position === 'defense' || position === 'attack');
      const values = [
        positionsOf(player).includes('goalie') ? rating(player, 'goalie') : 'x',
        hasField ? rating(player, 'offense') : 'x',
        hasField ? rating(player, 'defense') : 'x',
        player.cardio
      ];
      return `${prefix} | ${player.name} | ${positionCode} | ${values.join(',')} | ${activity}`;
    })).join('\n');
  }

  function configModalBody() {
    const tabs = `<div class="modal-tabs"><button class="${configTab === 'import' ? 'active' : ''}" data-config-tab="import">Importer</button><button class="${configTab === 'export' ? 'active' : ''}" data-config-tab="export">Exporter</button><button class="${configTab === 'generate' ? 'active' : ''}" data-config-tab="generate">Générer</button><button class="${configTab === 'reset' ? 'active danger-tab' : ''}" data-config-tab="reset">Effacer</button></div>`;
    if (configTab === 'generate') {
      const blocked = state.players.length > 0;
      return `${tabs}${blocked ? '<div class="notice error"><strong>La liste des joueurs doit être vide.</strong> Utilisez d’abord « Effacer les joueurs ».</div>' : '<p class="muted">Crée des joueurs actifs avec des cotes et un cardio entiers de 0 à 10.</p>'}<div class="generator-grid"><label>Réguliers<input id="generate-regulars" type="number" min="0" max="100" step="1" value="14"></label><label>Gardiens exclusifs réguliers<input id="generate-regular-goalies" type="number" min="0" max="100" step="1" value="2"></label><label>Remplaçants<input id="generate-substitutes" type="number" min="0" max="100" step="1" value="5"></label><label>Gardiens exclusifs remplaçants<input id="generate-substitute-goalies" type="number" min="0" max="100" step="1" value="0"></label></div><div class="inline-actions"><button class="button primary" data-modal="generate-pool" ${blocked ? 'disabled' : ''}>Générer les joueurs</button></div>`;
    }
    if (configTab === 'import') return `${tabs}<p class="muted">Format : statut, nom, positions, cotes G/OFF/DEF/CARDIO, état. Une ligne par joueur.</p><pre>REG | John Lajoie | DA | x,7,5,6 | ACTIF\nREG | Bobby | G | 8,x,x,1 | ACTIF\nREM | Alex | GDA | 8,7,5,6 | INACTIF\nREG | Paul Tremblay | ACTIF</pre><textarea id="import-text" class="import-text" rows="10" placeholder="Collez votre liste ici"></textarea><div class="inline-actions"><button class="button primary" data-modal="import-players">Importer</button></div>`;
    if (configTab === 'export') return `${tabs}<p class="muted">Ce texte peut être réimporté sans perdre les positions, cotes, statuts ou états.</p><textarea id="export-text" class="import-text" rows="12" readonly>${escapeHtml(exportText())}</textarea><div class="inline-actions"><button class="button primary" data-modal="copy-export">Copier</button><button class="button" data-modal="download-export">Télécharger .txt</button></div>`;
    return `${tabs}<div class="danger-zone"><h3>Effacer les joueurs</h3><p>Supprime tous les joueurs et vide le match courant. L’historique et les noms d’équipe seront conservés.</p><button class="button danger" data-modal="confirm-pool-reset">Effacer les joueurs</button></div>`;
  }

  function randomRating() {
    return Math.floor(Math.random() * 11);
  }

  function generatePool() {
    if (state.players.length) return;
    const values = {
      regulars: Number($('#generate-regulars')?.value),
      regularGoalies: Number($('#generate-regular-goalies')?.value),
      substitutes: Number($('#generate-substitutes')?.value),
      substituteGoalies: Number($('#generate-substitute-goalies')?.value)
    };
    if (Object.values(values).some(value => !Number.isInteger(value) || value < 0 || value > 100)) {
      showModal('Valeurs invalides', '<p>Utilisez uniquement des nombres entiers de 0 à 100.</p>', [['OK', 'close', 'primary']]);
      return;
    }
    if (values.regularGoalies > values.regulars || values.substituteGoalies > values.substitutes) {
      showModal('Nombre de gardiens invalide', '<p>Le nombre de gardiens exclusifs ne peut pas dépasser le total du groupe.</p>', [['OK', 'close', 'primary']]);
      return;
    }
    const createGroup = (total, goalieCount, status, label) => Array.from({ length: total }, (_, index) => {
      const goalie = index < goalieCount;
      const positions = goalie ? ['goalie'] : [['defense'], ['attack'], ['defense', 'attack']][Math.floor(Math.random() * 3)];
      return {
        id: uid(),
        name: `${label} ${String(index + 1).padStart(2, '0')}`,
        positions,
        ratings: { goalie: randomRating(), offense: randomRating(), defense: randomRating() },
        cardio: randomRating(),
        status,
        active: true,
        incomplete: false
      };
    });
    const regulars = createGroup(values.regulars, values.regularGoalies, 'regulier', 'Régulier');
    const replacements = createGroup(values.substitutes, values.substituteGoalies, 'remplacant', 'Remplaçant');
    state.players = [...regulars, ...replacements];
    resetMatch();
    save();
    showModal('Joueurs générés', `<div class="import-summary"><p><strong>${regulars.length}</strong> réguliers créés, dont ${values.regularGoalies} gardiens exclusifs</p><p><strong>${replacements.length}</strong> remplaçants créés, dont ${values.substituteGoalies} gardiens exclusifs</p></div>`, [['OK', 'close', 'primary']]);
    render();
  }

  function parseImport(text) {
    const result = { players: [], regulars: 0, replacements: 0, incomplete: 0, duplicates: [], errors: [] };
    const knownNames = new Set(state.players.map(player => normalizeText(player.name)));
    text.replace(/^\uFEFF/, '').split(/\r?\n/).forEach((rawLine, index) => {
      const line = rawLine.trim();
      if (!line) return;
      const parts = line.split('|').map(part => part.trim());
      const fail = message => result.errors.push(`Ligne ${index + 1} : ${message}`);
      if (parts.length !== 3 && parts.length !== 5) {
        fail('format invalide');
        return;
      }
      const status = parts[0].toUpperCase() === 'REG' ? 'regulier' : parts[0].toUpperCase() === 'REM' ? 'remplacant' : null;
      const name = parts[1]?.replace(/\s+/g, ' ');
      const activityCode = parts[parts.length - 1].toUpperCase();
      const active = activityCode === 'ACTIF' ? true : activityCode === 'INACTIF' ? false : null;
      if (!status) return fail('statut REG ou REM requis');
      if (!name) return fail('nom requis');
      if (active === null) return fail('état ACTIF ou INACTIF requis');
      const normalizedName = normalizeText(name);
      if (knownNames.has(normalizedName)) {
        result.duplicates.push(name);
        return;
      }
      let positions = [];
      let ratings = { goalie: 5, offense: 5, defense: 5 };
      let cardio = 5;
      let incomplete = parts.length === 3;
      if (parts.length === 5) {
        const codes = parts[2].toUpperCase().replace(/[,\s]/g, '');
        if (!codes || /[^GDA]/.test(codes) || new Set(codes).size !== codes.length) return fail('positions G, D ou A invalides');
        positions = ['G', 'D', 'A'].filter(code => codes.includes(code)).map(code => ({ G: 'goalie', D: 'defense', A: 'attack' }[code]));
        const values = parts[3].split(',').map(value => value.trim().toLowerCase());
        if (values.length !== 4) return fail('quatre valeurs G,OFF,DEF,CARDIO requises');
        const number = value => value === 'x' ? null : Number(value);
        const parsed = values.map(number);
        if (parsed.some(value => value !== null && (!Number.isInteger(value) || value < 0 || value > 10))) return fail('les cotes doivent être des entiers de 0 à 10 ou x');
        const hasGoalie = positions.includes('goalie');
        const hasField = positions.some(position => position === 'defense' || position === 'attack');
        if ((hasGoalie && parsed[0] === null) || (!hasGoalie && parsed[0] !== null)) return fail('la cote G doit correspondre à la position G');
        if (hasField && (parsed[1] === null || parsed[2] === null)) return fail('les cotes OFF et DEF sont requises pour D ou A');
        if (!hasField && (parsed[1] !== null || parsed[2] !== null)) return fail('un gardien exclusif utilise x pour OFF et DEF');
        if (parsed[3] === null) return fail('le cardio est requis');
        ratings = { goalie: parsed[0] ?? 5, offense: parsed[1] ?? 5, defense: parsed[2] ?? 5 };
        cardio = parsed[3];
        incomplete = false;
      }
      const player = { id: uid(), name, positions, ratings, cardio, status, active, incomplete };
      result.players.push(player);
      result[status === 'regulier' ? 'regulars' : 'replacements'] += 1;
      if (incomplete) result.incomplete += 1;
      knownNames.add(normalizedName);
    });
    return result;
  }

  function importPlayers() {
    const result = parseImport($('#import-text')?.value || '');
    state.players.push(...result.players);
    save();
    const issues = [
      ...result.errors,
      ...result.duplicates.map(name => `Doublon ignoré : ${escapeHtml(name)}`)
    ];
    showModal('Import terminé', `<div class="import-summary"><p><strong>${result.regulars}</strong> réguliers ajoutés</p><p><strong>${result.replacements}</strong> remplaçants ajoutés</p><p><strong>${result.incomplete}</strong> fiches à compléter</p><p><strong>${result.duplicates.length}</strong> doublons ignorés</p></div>${issues.length ? `<details><summary>Détails</summary><ul>${issues.map(issue => `<li>${issue}</li>`).join('')}</ul></details>` : ''}`, [['OK', 'close', 'primary']]);
    render();
  }

  function assignmentModalBody(playerId) {
    const player = playerById(playerId);
    if (!player) return '<p>Joueur introuvable.</p>';
    const current = findAssignment(player.id);
    const choices = ['white', 'black'].flatMap(teamKey => positionsOf(player)
      .filter(position => position === 'defense' || position === 'attack')
      .map(position => ({
        teamKey,
        position,
        selected: current?.teamKey === teamKey && current?.entry.position === position
      })));
    return `<div class="assignment-player">${playerIdentity(player, { assignedPosition: current?.entry.position })}</div><div class="assignment-grid">${choices.map(choice => `<button class="assignment-choice role-border-${choice.position} ${choice.selected ? 'selected' : ''}" data-modal="assign:${choice.teamKey}:${choice.position}" aria-pressed="${choice.selected}"><span>${escapeHtml(state.settings[choice.teamKey])}</span><strong>${POSITIONS[choice.position]}</strong>${choice.selected ? '<small>Sélection actuelle · cliquer pour enlever</small>' : ''}</button>`).join('') || '<p class="muted">Aucune assignation en attaque ou en défense n’est disponible.</p>'}</div><div class="assignment-secondary"><button class="button danger" data-modal="make-absent">Rendre absent</button></div>`;
  }

  function goalieModalBody() {
    const status = goalieAvailabilityStatus();
    const available = availableGoalies().sort(compareNames);
    const pure = exclusiveGoalies();
    const blocking = pure.length > 2 || available.length < 2;
    const validation = goalieValidation();
    const teamColumn = teamKey => `<section class="goalie-team"><h3>${escapeHtml(state.settings[teamKey])}</h3>${available.map(player => {
      const selected = state.match.goalies[teamKey] === player.id;
      const selectedOther = state.match.goalies[teamKey === 'white' ? 'black' : 'white'] === player.id;
      return `<button class="goalie-choice ${selected ? 'selected' : ''}" data-modal="goalie:${teamKey}:${player.id}" aria-pressed="${selected}" ${blocking ? 'disabled' : ''}>${playerIdentity(player, { assignedPosition: selected || selectedOther ? 'goalie' : null })}${isExclusiveGoalie(player) ? '<small class="exclusive-label">Exclusif</small>' : ''}</button>`;
    }).join('') || '<p class="muted">Aucun gardien disponible.</p>'}</section>`;
    const noticeClass = status.kind === 'green' ? 'success' : status.kind === 'red' ? 'error' : '';
    return `<div class="notice ${noticeClass}"><strong>${escapeHtml(status.label)}</strong> · ${escapeHtml(status.text)}</div>${!validation.ok && !blocking ? `<p class="muted">${escapeHtml(validation.reason)}</p>` : ''}<div class="goalie-grid">${teamColumn('white')}${teamColumn('black')}</div>`;
  }

  function optimizationModalBody() {
    const reference = historicalReference();
    const selectedMode = reference.comparable ? modal.similarityMode : 'mixed';
    const choices = [
      ['similar', 'Similaires', 'Conserver autant que possible les mêmes coéquipiers.'],
      ['mixed', 'Mélangées', 'Optimiser sans tenir compte du dernier match.'],
      ['different', 'Différentes', 'Réduire les associations de coéquipiers répétées.']
    ];
    const referenceText = reference.comparable
      ? `<p class="optimization-reference">Comparaison avec le match du <strong>${escapeHtml(reference.match.date)}</strong>.</p>`
      : '<div class="notice"><strong>Aucun historique comparable.</strong> Le mode Mélangées sera utilisé.</div>';
    return `<label class="optimization-balance"><input id="optimization-balance" type="checkbox" ${modal.balancePositions ? 'checked' : ''}> <span><strong>Équilibrer les positions</strong><small>Viser un nombre similaire d’attaquants et de défenseurs.</small></span></label><fieldset class="optimization-similarity"><legend>Par rapport au dernier match</legend>${choices.map(([value, label, description]) => `<label class="optimization-choice ${selectedMode === value ? 'selected' : ''}"><input type="radio" name="similarity" value="${value}" ${selectedMode === value ? 'checked' : ''} ${!reference.comparable && value !== 'mixed' ? 'disabled' : ''}><span><strong>${label}</strong><small>${description}</small></span></label>`).join('')}</fieldset>${referenceText}`;
  }

  function renderModal(focusInitial = false) {
    const root = $('#modal-root');
    if (!modal) {
      root.innerHTML = '';
      return;
    }
    let body = modal.body;
    if (modal.kind === 'attendance') body = attendanceModalBody();
    else if (modal.kind === 'player-settings') body = configModalBody();
    else if (modal.kind === 'assignment') body = assignmentModalBody(modal.playerId);
    else if (modal.kind === 'player-editor') body = playerForm();
    else if (modal.kind === 'goalies') body = goalieModalBody();
    else if (modal.kind === 'optimization') body = optimizationModalBody();
    const actions = modal.actions?.map(([label, action, className, disabled]) => `<button class="button ${className || ''}" data-modal="${action || 'close'}" ${disabled ? 'disabled' : ''}>${escapeHtml(label)}</button>`).join('') || '';
    root.innerHTML = `<div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-title"><section class="modal ${modal.kind ? `modal-${modal.kind}` : ''}"><div class="modal-titlebar"><h2 id="modal-title">${escapeHtml(modal.title)}</h2><button class="modal-close" data-modal="close" aria-label="Fermer">×</button></div><div class="modal-body">${body}</div>${actions ? `<div class="modal-actions">${actions}</div>` : ''}</section></div>`;
    if (focusInitial) requestAnimationFrame(() => {
      if (modal?.kind === 'player-editor' && !editingPlayer()) $('#player-form [name="name"]')?.focus({ preventScroll: true });
      else {
        const title = $('#modal-title');
        title?.setAttribute('tabindex', '-1');
        title?.focus({ preventScroll: true });
      }
    });
  }

  function render() {
    document.querySelectorAll('.app-nav [data-view]').forEach(button => button.className = button.dataset.view === view ? 'tab' : '');
    $('#app').innerHTML = view === 'match' ? matchView() : view === 'players' ? playersView() : historyView();
    renderModal();
  }

  function updatePlayerFormRatings() {
    const form = $('#player-form');
    if (!form) return;
    const positions = [...form.querySelectorAll('input[name="pos"]:checked')].map(input => input.value);
    const goalieEnabled = positions.includes('goalie');
    const fieldEnabled = positions.some(position => position === 'defense' || position === 'attack');
    for (const [skill, enabled] of [['goalie', goalieEnabled], ['offense', fieldEnabled], ['defense', fieldEnabled]]) {
      const label = form.querySelector(`[data-rating="${skill}"]`);
      const input = label?.querySelector('input');
      label?.classList.toggle('off', !enabled);
      if (input) input.disabled = !enabled;
    }
  }

  cleanMatch();
  save();

  document.addEventListener('click', event => {
    const viewButton = event.target.closest('[data-view]');
    if (viewButton) {
      view = viewButton.dataset.view;
      render();
      return;
    }
    const navConfig = event.target.closest('[data-nav-config]');
    if (navConfig) {
      configTab = 'import';
      showModal('Configuration', '', [], { kind: 'player-settings' });
      return;
    }
    const playerTab = event.target.closest('[data-player-tab]');
    if (playerTab) {
      playerStatusTab = playerTab.dataset.playerTab;
      playerPage = 1;
      render();
      return;
    }
    const activityButton = event.target.closest('[data-player-activity]');
    if (activityButton) {
      playerActivity = activityButton.dataset.playerActivity;
      playerPage = 1;
      render();
      return;
    }
    const positionButton = event.target.closest('[data-player-position]');
    if (positionButton) {
      playerPosition = positionButton.dataset.playerPosition;
      playerPage = 1;
      render();
      return;
    }
    const pageButton = event.target.closest('[data-player-page]');
    if (pageButton) {
      playerPage = Number(pageButton.dataset.playerPage);
      render();
      $('.player-directory')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const attendanceTabButton = event.target.closest('[data-attendance-tab]');
    if (attendanceTabButton) {
      attendanceTab = attendanceTabButton.dataset.attendanceTab;
      renderModal();
      return;
    }
    const attendancePositionButton = event.target.closest('[data-attendance-position]');
    if (attendancePositionButton) {
      attendancePosition = attendancePositionButton.dataset.attendancePosition;
      renderModal();
      return;
    }
    const configButton = event.target.closest('[data-config-tab]');
    if (configButton) {
      configTab = configButton.dataset.configTab;
      renderModal();
      return;
    }
    const selectButton = event.target.closest('[data-select]');
    if (selectButton) {
      editingPlayerId = selectButton.dataset.select;
      showModal(`Modifier ${editingPlayer().name}`, '', [], { kind: 'player-editor' });
      return;
    }
    const assignButton = event.target.closest('[data-assign-player]');
    if (assignButton) {
      const player = playerById(assignButton.dataset.assignPlayer);
      showModal(`Modifier ${player.name}`, '', [['OK', 'close', 'primary']], { kind: 'assignment', playerId: player.id });
      return;
    }
    if (event.target.closest('[data-goalie-player]')) {
      showModal('Choisir les gardiens', '', [['OK', 'close', 'primary']], { kind: 'goalies' });
      return;
    }
    const deletePlayerButton = event.target.closest('[data-delete]');
    if (deletePlayerButton) {
      const player = playerById(deletePlayerButton.dataset.delete);
      showModal('Supprimer le joueur', `<p>Supprimer définitivement <strong>${escapeHtml(player.name)}</strong>?</p>`, [['Annuler', 'close'], ['Supprimer', 'delete-player', 'danger']], { playerId: player.id });
      return;
    }
    const deleteHistoryButton = event.target.closest('[data-delete-history]');
    if (deleteHistoryButton) {
      event.preventDefault();
      event.stopPropagation();
      const index = Number(deleteHistoryButton.dataset.deleteHistory);
      showModal('Supprimer le match', `<p>Supprimer le match du <strong>${escapeHtml(state.history[index].date)}</strong>?</p>`, [['Annuler', 'close'], ['Supprimer', 'delete-history', 'danger']], { historyIndex: index });
      return;
    }
    const button = event.target.closest('button');
    if (!button) return;

    if (button.dataset.modal) {
      const action = button.dataset.modal;
      if (action === 'close') {
        if (modal?.kind === 'player-editor') editingPlayerId = null;
        closeModal();
      } else if (action === 'open-goalies') {
        showModal('Choisir les gardiens', '', [['OK', 'close', 'primary']], { kind: 'goalies' });
      } else if (action === 'delete-player') {
        const playerId = modal.playerId;
        state.players = state.players.filter(player => player.id !== playerId);
        state.match.present = state.match.present.filter(id => id !== playerId);
        removePlayerFromMatch(playerId);
        editingPlayerId = null;
        reconcileGoalies();
        closeModal();
        save();
        render();
      } else if (action === 'delete-history') {
        state.history.splice(modal.historyIndex, 1);
        closeModal();
        save();
        render();
      } else if (action === 'archive-confirm' || action === 'new-archive') {
        const check = archiveValidation();
        if (check.ok) archiveCurrent();
      } else if (action === 'new-discard') {
        resetMatch();
        closeModal();
        setNotice('Un nouveau match est prêt.');
        save();
        render();
      } else if (action === 'restart-confirm') {
        restartAssignments();
        closeModal();
        setNotice('Les assignations ont été effacées; la date et les présences sont conservées.');
        save();
        render();
      } else if (action === 'generate-pool') {
        generatePool();
      } else if (action === 'import-players') {
        importPlayers();
      } else if (action === 'copy-export') {
        navigator.clipboard?.writeText(exportText());
        button.textContent = 'Copié';
      } else if (action === 'download-export') {
        const blob = new Blob(['\uFEFF', exportText()], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `lineup-joueurs-${new Date().toISOString().slice(0, 10)}.txt`;
        link.click();
        URL.revokeObjectURL(url);
      } else if (action === 'confirm-pool-reset') {
        showModal('Confirmer l’effacement', '<p><strong>Tous les joueurs seront supprimés.</strong></p><p>Le match courant sera vidé. L’historique et les noms d’équipe seront conservés.</p>', [['Annuler', 'close'], ['Effacer les joueurs', 'pool-reset', 'danger']]);
      } else if (action === 'pool-reset') {
        state.players = [];
        resetMatch();
        editingPlayerId = null;
        closeModal();
        setNotice('Les joueurs ont été effacés.');
        save();
        render();
      } else if (action === 'wipe-history') {
        state.history = [];
        closeModal();
        setNotice('L’historique a été effacé.');
        save();
        render();
      } else if (action === 'optimize-confirm') {
        state.settings.balancePositions = Boolean($('#optimization-balance')?.checked);
        state.settings.similarityMode = $('[name="similarity"]:checked')?.value || 'mixed';
        save();
        optimizeTeams();
      } else if (action.startsWith('assign:')) {
        const [, teamKey, position] = action.split(':');
        const player = playerById(modal.playerId);
        const current = findAssignment(player.id);
        const selectedAgain = current?.teamKey === teamKey && current?.entry.position === position;
        removeFromTeams(player.id);
        if (selectedAgain) setNotice(`${player.name} reste présent, mais n’est plus assigné.`);
        else {
          state.match.teams[teamKey].push({ playerId: player.id, position });
          setNotice(`${player.name} est assigné à ${state.settings[teamKey]} — ${POSITIONS[position]}.`);
        }
        state.match.prepared = true;
        save();
        renderPreservingScroll(`[data-modal="${CSS.escape(action)}"]`);
      } else if (action === 'make-absent') {
        const player = playerById(modal.playerId);
        state.match.present = state.match.present.filter(id => id !== player.id);
        removePlayerFromMatch(player.id);
        reconcileGoalies();
        closeModal();
        setNotice(`${player.name} est maintenant absent.`);
        save();
        render();
      } else if (action.startsWith('goalie:')) {
        const [, teamKey, playerId] = action.split(':');
        const otherTeam = teamKey === 'white' ? 'black' : 'white';
        if (state.match.goalies[teamKey] === playerId) {
          state.match.goalies[teamKey] = null;
          removeFromTeams(playerId);
        } else {
          if (state.match.goalies[otherTeam] === playerId) state.match.goalies[otherTeam] = null;
          state.match.goalies[teamKey] = playerId;
          applyGoalieSelections();
        }
        state.match.prepared = true;
        save();
        renderPreservingScroll(`[data-modal="${CSS.escape(action)}"]`);
      }
      return;
    }

    const action = button.dataset.action;
    if (action === 'optimize') {
      const reference = historicalReference();
      const similarityMode = reference.comparable ? state.settings.similarityMode : 'mixed';
      showModal('Optimiser les équipes', '', [['Annuler', 'close'], ['Optimiser', 'optimize-confirm', 'primary']], { kind: 'optimization', balancePositions: state.settings.balancePositions, similarityMode });
    }
    else if (action === 'new-match') {
      if (!state.match.prepared) {
        resetMatch();
        setNotice('Un nouveau match est prêt.');
        save();
        render();
      } else {
        const check = archiveValidation();
        showModal('Créer un nouveau match', '<p>Un match est déjà préparé. Que voulez-vous faire?</p>', [['Annuler', 'close'], ['Effacer et créer', 'new-discard', 'danger'], ['Archiver et créer', 'new-archive', 'primary', !check.ok]]);
      }
    } else if (action === 'archive') {
      const check = archiveValidation();
      if (check.ok) showModal('Archiver le match', '<p>Archiver les équipes actuelles et créer un nouveau match?</p>', [['Annuler', 'close'], ['Archiver', 'archive-confirm', 'primary']]);
    } else if (action === 'restart') {
      showModal('Recommencer', '<p>Effacer toutes les assignations? La date et les présences seront conservées.</p>', [['Annuler', 'close'], ['Recommencer', 'restart-confirm', 'danger']]);
    } else if (action === 'attendance') {
      attendanceTab = 'regulier';
      showModal('Gérer les présences', '', [], { kind: 'attendance' });
    } else if (action === 'goalies') {
      showModal('Choisir les gardiens', '', [['OK', 'close', 'primary']], { kind: 'goalies' });
    } else if (action === 'add-player') {
      editingPlayerId = null;
      showModal('Ajouter un joueur', '', [], { kind: 'player-editor' });
    } else if (action === 'cancel') {
      editingPlayerId = null;
      closeModal();
    } else if (action === 'clear-history') {
      showModal('Effacer l’historique', '<p>Supprimer définitivement tous les matchs archivés? Les joueurs et le match courant seront conservés.</p>', [['Annuler', 'close'], ['Effacer l’historique', 'wipe-history', 'danger']]);
    } else if (action === 'copy') {
      navigator.clipboard?.writeText($('#share').value);
      button.textContent = 'Copié';
    }
  });

  document.addEventListener('change', event => {
    const data = event.target.dataset;
    if (data.attendancePlayer) {
      const playerId = data.attendancePlayer;
      const listScrollTop = $('.attendance-list')?.scrollTop || 0;
      if (event.target.checked) {
        if (!state.match.present.includes(playerId)) state.match.present.push(playerId);
      } else {
        state.match.present = state.match.present.filter(id => id !== playerId);
        removePlayerFromMatch(playerId);
      }
      reconcileGoalies();
      save();
      render();
      requestAnimationFrame(() => {
        const list = $('.attendance-list');
        if (list) list.scrollTop = listScrollTop;
        $(`[data-attendance-player="${CSS.escape(playerId)}"]`)?.focus({ preventScroll: true });
      });
    } else if (data.balance !== undefined) {
      state.settings.balancePositions = event.target.checked;
      save();
      render();
    } else if (data.date !== undefined) {
      state.match.date = event.target.value;
      save();
      render();
    } else if (data.name) {
      state.settings[data.name] = event.target.value.trim() || defaults.settings[data.name];
      save();
      render();
    } else if (event.target.matches('#player-form input[name="pos"]')) {
      updatePlayerFormRatings();
    }
  });

  document.addEventListener('input', event => {
    if (event.target.id === 'player-search') {
      playerQuery = event.target.value;
      playerPage = 1;
      const cursor = event.target.value.length;
      render();
      requestAnimationFrame(() => {
        const input = $('#player-search');
        input?.focus();
        input?.setSelectionRange(cursor, cursor);
      });
      return;
    }
    if (event.target.id === 'attendance-search') {
      attendanceQuery = event.target.value;
      const cursor = event.target.value.length;
      renderModal();
      requestAnimationFrame(() => {
        const input = $('#attendance-search');
        input?.focus();
        input?.setSelectionRange(cursor, cursor);
      });
      return;
    }
    if (!event.target.closest('#player-form')) return;
    const output = event.target.closest('label')?.querySelector('output');
    if (output) output.value = event.target.value;
  });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !modal) return;
    event.preventDefault();
    if (modal.kind === 'player-editor') editingPlayerId = null;
    closeModal();
  });

  document.addEventListener('submit', event => {
    if (event.target.id !== 'player-form') return;
    event.preventDefault();
    const form = event.target;
    const data = new FormData(form);
    const selected = editingPlayer();
    const name = String(data.get('name') || '').trim().replace(/\s+/g, ' ');
    const formError = $('#player-form-error');
    const showFormError = message => {
      formError.textContent = message;
      formError.setAttribute('tabindex', '-1');
      formError.focus();
    };
    const positions = [...form.querySelectorAll('input[name="pos"]:checked')].map(input => input.value);
    if (!positions.length) return showFormError('Choisissez au moins une position.');
    const duplicate = state.players.find(player => player.id !== selected?.id && normalizeText(player.name) === normalizeText(name));
    if (duplicate) return showFormError(`Un joueur nommé « ${duplicate.name} » existe déjà.`);
    const ratings = { ...(selected?.ratings || { goalie: 5, offense: 5, defense: 5 }) };
    if (positions.includes('goalie')) ratings.goalie = Number(data.get('goalie'));
    if (positions.some(position => position === 'defense' || position === 'attack')) {
      ratings.offense = Number(data.get('offense'));
      ratings.defense = Number(data.get('defense'));
    }
    const player = {
      id: selected?.id || uid(),
      name,
      positions,
      ratings,
      cardio: Number(data.get('cardio')),
      status: data.get('status'),
      active: data.get('activity') === 'active',
      incomplete: false
    };
    state.players = selected ? state.players.map(item => item.id === player.id ? player : item) : [...state.players, player];
    if (!player.active) {
      state.match.present = state.match.present.filter(id => id !== player.id);
      removePlayerFromMatch(player.id);
    } else {
      const assignment = findAssignment(player.id);
      if (assignment && !positions.includes(assignment.entry.position)) removePlayerFromMatch(player.id);
    }
    reconcileGoalies();
    editingPlayerId = null;
    save();
    closeModal();
    render();
  });

  render();
})();
