(() => {
  const STORAGE_KEY = 'lineup-hockey-v2';
  const LEGACY_KEY = 'lineup-hockey-v1';
  const POSITIONS = { goalie: 'Gardien', defense: 'Défense', attack: 'Attaque' };
  const POSITION_LETTERS = { goalie: 'G', defense: 'D', attack: 'A' };
  const PLAYER_PAGE_SIZE = 10;
  const $ = (selector, parent = document) => parent.querySelector(selector);
  const today = () => new Date().toISOString().slice(0, 10);
  const uid = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const normalizeText = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr').trim().replace(/\s+/g, ' ');
  const compareNames = (a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' });

  const defaults = {
    players: [],
    history: [],
    settings: { white: 'Blancs', black: 'Noirs', balancePositions: true, historyDepth: 3 },
    match: { date: today(), present: [], goalies: [], teams: { white: [], black: [] }, presenceInitialized: false }
  };

  let state;
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_KEY));
    state = { ...defaults, ...(stored || {}) };
    state.settings = { ...defaults.settings, ...(state.settings || {}) };
    state.match = { ...defaults.match, ...(state.match || {}) };
  } catch {
    state = structuredClone(defaults);
  }

  state.players = (state.players || []).map(source => {
    const { injured, ...player } = source;
    const positions = player.positions || [];
    const ratings = { goalie: 5, defense: 5, attack: 5, ...(player.ratings || {}) };
    Object.keys(ratings).forEach(position => { ratings[position] = Math.round(Number(ratings[position] ?? 5)); });
    return {
      ...player,
      status: player.status || 'regulier',
      active: typeof player.active === 'boolean' ? player.active : !injured,
      positions,
      ratings,
      cardio: Math.round(Number(player.cardio ?? 5)),
      incomplete: player.incomplete ?? !positions.length
    };
  });

  const migrateTeam = (team, refreshPlayer = true) => (team || []).map(entry => {
    const sourcePlayer = entry.player || entry;
    const currentPlayer = (refreshPlayer && state.players.find(player => player.id === sourcePlayer?.id)) || sourcePlayer;
    const position = entry.position || entry.assignedPosition;
    return currentPlayer && position ? { player: currentPlayer, position } : null;
  }).filter(Boolean);

  if (!state.match.teams) state.match.teams = { white: [], black: [] };
  state.match.teams = {
    white: migrateTeam(state.match.teams.white),
    black: migrateTeam(state.match.teams.black)
  };
  const migrateArchiveTeam = (match, teamKey) => {
    const team = match.teams?.[teamKey];
    const entries = Array.isArray(team) ? team : team?.players || [];
    const players = entries.map(entry => {
      if (typeof entry === 'string') return { id: null, name: entry };
      const source = entry.player || entry;
      return source?.name ? { id: source.id || null, name: source.name } : null;
    }).filter(Boolean);
    return {
      name: team?.name || match[`${teamKey}Name`] || defaults.settings[teamKey],
      players
    };
  };
  state.history = (state.history || []).map(match => ({
    date: match.date,
    teams: {
      white: migrateArchiveTeam(match, 'white'),
      black: migrateArchiveTeam(match, 'black')
    }
  }));

  let view = 'match';
  let editingPlayerId = null;
  let modal = null;
  let configTab = 'import';
  let attendanceTab = 'regulier';
  let attendanceQuery = '';
  let notice = '';
  let noticeTimer;
  const playerFilters = {
    regulier: { query: '', activity: 'all', page: 1 },
    remplacant: { query: '', activity: 'all', page: 1 }
  };

  const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  const positionsOf = player => player.positions || [];
  const rating = (player, position) => Number(player.ratings?.[position] ?? 0);
  const activePlayers = () => state.players.filter(player => player.active);
  const presentPlayers = () => activePlayers().filter(player => state.match.present.includes(player.id));
  const teams = () => state.match.teams;
  const hasTeamPlayers = () => teams().white.length + teams().black.length > 0;
  const editingPlayer = () => state.players.find(player => player.id === editingPlayerId) || null;

  if (!state.match.presenceInitialized) {
    state.match.present = activePlayers().filter(player => player.status === 'regulier').map(player => player.id);
    state.match.presenceInitialized = true;
  }
  state.match.present = state.match.present.filter(id => state.players.some(player => player.id === id && player.active));
  ['white', 'black'].forEach(key => {
    state.match.teams[key] = state.match.teams[key].filter(entry => state.match.present.includes(entry.player.id) && entry.player.active !== false);
  });
  save();

  function setNotice(message) {
    notice = message;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => {
      notice = '';
      $('#page-notice')?.remove();
    }, 3500);
  }

  function showModal(title, body = '', actions = [], extra = {}) {
    modal = { title, body, actions, ...extra };
    renderModal();
  }

  function closeModal() {
    modal = null;
    renderModal();
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

  function playerPositions(player, assignedPosition = null) {
    return `<span class="position-ratings" aria-label="Positions et niveaux">${positionsOf(player).map(position => `<span class="position-rating position-${position} ${assignedPosition === position ? 'assigned' : ''}" title="${POSITIONS[position]} : ${rating(player, position)}"><b>${POSITION_LETTERS[position]}</b><small>${rating(player, position)}</small></span>`).join('') || '<span class="no-position">—</span>'}</span>`;
  }

  function playerIdentity(player, options = {}) {
    const lastPlayedText = options.lastPlayed === undefined ? '' : options.lastPlayed ? `Dernier match : ${options.lastPlayed}` : 'Jamais joué';
    return `<span class="player-identity"><span class="player-main"><strong>${escapeHtml(player.name)}</strong>${player.active === false ? `<span class="inactive-icon" title="Inactif" aria-label="Inactif">${pauseIcon()}</span>` : ''}${player.incomplete ? '<em class="incomplete">À compléter</em>' : ''}</span><span class="player-details">${playerPositions(player, options.assignedPosition)}<span class="cardio-value"><small>Cardio</small><b>${player.cardio}</b></span></span>${lastPlayedText ? `<small class="last-played">${escapeHtml(lastPlayedText)}</small>` : ''}</span>`;
  }

  function removeFromTeams(playerId) {
    ['white', 'black'].forEach(key => {
      state.match.teams[key] = state.match.teams[key].filter(entry => entry.player.id !== playerId);
    });
  }

  function findAssignment(playerId) {
    for (const teamKey of ['white', 'black']) {
      const index = state.match.teams[teamKey].findIndex(entry => entry.player.id === playerId);
      if (index >= 0) return { teamKey, index, entry: state.match.teams[teamKey][index] };
    }
    return null;
  }

  function assignedGoalies() {
    return {
      white: teams().white.filter(entry => entry.position === 'goalie'),
      black: teams().black.filter(entry => entry.position === 'goalie')
    };
  }

  function teamStats(team) {
    const totals = { goalie: 0, defense: 0, attack: 0 };
    const counts = { goalie: 0, defense: 0, attack: 0 };
    team.forEach(entry => {
      totals[entry.position] += rating(entry.player, entry.position);
      counts[entry.position] += 1;
    });
    const skaters = team.filter(entry => entry.position !== 'goalie');
    const substitutes = Math.max(0, skaters.length - 4);
    const cardio = skaters.length ? skaters.reduce((sum, entry) => sum + Number(entry.player.cardio), 0) / skaters.length : 0;
    const total = Object.values(totals).reduce((sum, value) => sum + value, 0) + cardio * (1 - Math.min(substitutes, 4) / 4);
    return { totals, counts, cardio, substitutes, total };
  }

  function evaluate(white, black) {
    const a = teamStats(white);
    const b = teamStats(black);
    let value = Math.abs(a.total - b.total) + Math.abs(a.totals.defense - b.totals.defense) + Math.abs(a.totals.attack - b.totals.attack);
    if (state.settings.balancePositions) value += Math.abs(a.counts.defense - b.counts.defense) * 5 + Math.abs(a.counts.attack - b.counts.attack) * 5;
    return { a, b, value };
  }

  function assignRoles(players) {
    const slots = state.settings.balancePositions ? ['defense', 'defense', 'attack', 'attack'] : [];
    return players.map(player => {
      const eligible = positionsOf(player).filter(position => position !== 'goalie');
      const position = slots.find(slot => eligible.includes(slot)) || [...eligible].sort((a, b) => rating(player, b) - rating(player, a))[0];
      const slotIndex = slots.indexOf(position);
      if (slotIndex >= 0) slots.splice(slotIndex, 1);
      return { player, position };
    });
  }

  function ensureGoaliesForOptimization() {
    const pureGoalies = presentPlayers().filter(player => positionsOf(player).length === 1 && positionsOf(player)[0] === 'goalie');
    if (pureGoalies.length > 2) {
      showModal('Trop de gardiens exclusifs', '<p>Plus de deux joueurs présents jouent uniquement gardien. Ajoutez une position à certains joueurs ou retirez des gardiens des présences avant d’optimiser.</p>');
      return null;
    }
    if (pureGoalies.length === 2) {
      const pureIds = new Set(pureGoalies.map(player => player.id));
      const current = assignedGoalies();
      const alreadyPlaced = current.white.length === 1 && current.black.length === 1 && pureIds.has(current.white[0].player.id) && pureIds.has(current.black[0].player.id);
      if (!alreadyPlaced) {
        pureGoalies.forEach(player => removeFromTeams(player.id));
        state.match.teams.white = state.match.teams.white.filter(entry => entry.position !== 'goalie');
        state.match.teams.black = state.match.teams.black.filter(entry => entry.position !== 'goalie');
        state.match.teams.white.push({ player: pureGoalies[0], position: 'goalie' });
        state.match.teams.black.push({ player: pureGoalies[1], position: 'goalie' });
      }
    }
    const goalies = assignedGoalies();
    if (goalies.white.length !== 1 || goalies.black.length !== 1) {
      showModal('Placez les gardiens', '<p>Affectez exactement un joueur capable d’être gardien à chaque équipe avant d’optimiser.</p>');
      return null;
    }
    return [goalies.white[0].player, goalies.black[0].player];
  }

  function optimizeTeams() {
    const incomplete = presentPlayers().filter(player => player.incomplete || !positionsOf(player).length);
    if (incomplete.length) {
      showModal('Fiches à compléter', `<p>Ajoutez une position et des niveaux avant d’optimiser :</p><ul>${incomplete.map(player => `<li>${escapeHtml(player.name)}</li>`).join('')}</ul>`);
      return;
    }
    const goalies = ensureGoaliesForOptimization();
    if (!goalies) return;
    const goalieIds = new Set(goalies.map(player => player.id));
    const skaters = presentPlayers().filter(player => !goalieIds.has(player.id));
    const invalidSkaters = skaters.filter(player => !positionsOf(player).some(position => position === 'defense' || position === 'attack'));
    if (invalidSkaters.length) {
      showModal('Positions insuffisantes', `<p>Ces joueurs ne peuvent pas être répartis en défense ou en attaque :</p><ul>${invalidSkaters.map(player => `<li>${escapeHtml(player.name)}</li>`).join('')}</ul>`);
      return;
    }
    if (skaters.length < 8) {
      showModal('Effectif insuffisant', '<p>Il faut au moins huit joueurs en plus des deux gardiens pour viser deux défenseurs et deux attaquants par équipe.</p>');
      return;
    }
    let best;
    for (let iteration = 0; iteration < 2500; iteration += 1) {
      const shuffled = [...skaters].sort(() => Math.random() - 0.5);
      const half = Math.ceil(shuffled.length / 2);
      const white = [{ player: goalies[0], position: 'goalie' }, ...assignRoles(shuffled.slice(0, half))];
      const black = [{ player: goalies[1], position: 'goalie' }, ...assignRoles(shuffled.slice(half))];
      const result = evaluate(white, black);
      if (!best || result.value < best.value) best = { white, black, value: result.value };
    }
    state.match.teams = { white: best.white, black: best.black };
    setNotice('Les équipes ont été optimisées.');
    save();
    render();
  }

  function teamPlayer(entry) {
    return `<button class="team-player player-surface" data-assign-player="${entry.player.id}" aria-label="Modifier l’affectation de ${escapeHtml(entry.player.name)}">${playerIdentity(entry.player, { assignedPosition: entry.position })}<span class="row-chevron" aria-hidden="true">›</span></button>`;
  }

  function positionGroup(teamKey, team, position) {
    const entries = team.filter(entry => entry.position === position);
    return `<section class="position-group position-group-${position}"><header><span class="role-chip role-${position}">${POSITION_LETTERS[position]}</span><strong>${POSITIONS[position]}</strong><small>${entries.length}</small></header><div class="position-group-list">${entries.map(teamPlayer).join('') || '<small class="empty-position">Aucun joueur</small>'}</div></section>`;
  }

  function teamView(key, team, stats) {
    return `<section class="team-card" style="--team:${key === 'white' ? '#d9a72e' : '#33415c'}"><div class="team-head"><div><span class="eyebrow">ÉQUIPE</span><input class="team-name" data-name="${key}" value="${escapeHtml(state.settings[key])}" aria-label="Nom de l’équipe"></div><span class="team-meta">${team.length} joueurs · Force ${stats.total.toFixed(1)}</span></div>${positionGroup(key, team, 'goalie')}${positionGroup(key, team, 'defense')}${positionGroup(key, team, 'attack')}</section>`;
  }

  function analyticsView(teamState, result) {
    const metric = (label, a, b, max) => `<div class="metric-row"><strong>${label}</strong><div class="metric-pair"><i class="metric-bar bar-white" style="--value:${Math.max(8, a / max * 100)}%">${a.toFixed(1)}</i><i class="metric-bar bar-black" style="--value:${Math.max(8, b / max * 100)}%">${b.toFixed(1)}</i></div><small>${Math.abs(a - b) < 0.05 ? 'Égal' : `${escapeHtml(a > b ? state.settings.white : state.settings.black)} +${Math.abs(a - b).toFixed(1)}`}</small></div>`;
    const composition = (key, stats) => {
      const count = stats.counts.goalie + stats.counts.defense + stats.counts.attack;
      const segments = ['goalie', 'defense', 'attack'].flatMap(position => Array(stats.counts[position]).fill(`<i class="segment segment-${position}"></i>`)).join('');
      return `<div class="position-row"><span>${escapeHtml(state.settings[key])}</span><div style="--count:${Math.max(count, 1)}">${segments}</div><small>${stats.counts.goalie} G · ${stats.counts.defense} D · ${stats.counts.attack} A</small></div>`;
    };
    const shareText = `Match du ${state.match.date}\n\n${state.settings.white}\n${teamState.white.map(entry => `${POSITIONS[entry.position]} — ${entry.player.name}`).join('\n')}\n\n${state.settings.black}\n${teamState.black.map(entry => `${POSITIONS[entry.position]} — ${entry.player.name}`).join('\n')}`;
    return `<section class="analytics"><div class="analytics-head"><div><span class="eyebrow">COMPARAISON</span><strong>Pourquoi les équipes sont équilibrées</strong></div><div class="legend"><span><i class="swatch swatch-white"></i>${escapeHtml(state.settings.white)}</span><span><i class="swatch swatch-black"></i>${escapeHtml(state.settings.black)}</span></div></div><div class="metric-chart" role="img" aria-label="Comparaison des équipes par gardien, défense, attaque et cardio">${metric('Gardien', result.a.totals.goalie, result.b.totals.goalie, Math.max(10, result.a.totals.goalie, result.b.totals.goalie))}${metric('Défense', result.a.totals.defense, result.b.totals.defense, Math.max(20, result.a.totals.defense, result.b.totals.defense))}${metric('Attaque', result.a.totals.attack, result.b.totals.attack, Math.max(20, result.a.totals.attack, result.b.totals.attack))}${metric('Cardio', result.a.cardio, result.b.cardio, 10)}</div><div class="positions-chart"><strong>Positions attribuées</strong>${composition('white', result.a)}${composition('black', result.b)}</div></section><section class="card share-card"><h3>Message aux joueurs</h3><textarea class="share" id="share" readonly>${escapeHtml(shareText)}</textarea><p><button class="button primary" data-action="copy">Copier</button></p></section>`;
  }

  function unassignedPlayers() {
    const assignedIds = new Set([...teams().white, ...teams().black].map(entry => entry.player.id));
    return presentPlayers().filter(player => !assignedIds.has(player.id)).sort(compareNames);
  }

  function unassignedView() {
    const players = unassignedPlayers();
    if (!players.length) return '';
    return `<section class="card unassigned-card"><div class="section-heading"><div><span class="eyebrow">À AFFECTER</span><h2>Joueurs présents non assignés</h2></div><span class="count-badge">${players.length}</span></div><div class="unassigned-list">${players.map(player => `<button class="unassigned-player player-surface" data-assign-player="${player.id}" aria-label="Modifier ${escapeHtml(player.name)}">${playerIdentity(player)}<span class="row-chevron" aria-hidden="true">›</span></button>`).join('')}</div></section>`;
  }

  function teamsBoard() {
    const result = evaluate(teams().white, teams().black);
    const quality = Math.max(0, 100 - Math.round(result.value * 2));
    return `${unassignedView()}<div class="teams-grid">${teamView('white', teams().white, result.a)}<div class="balance-spine"><span>ÉQUILIBRE</span><strong>${hasTeamPlayers() ? `${quality}%` : '—'}</strong><div class="balance-meter"><i style="width:${hasTeamPlayers() ? quality : 0}%"></i></div><small>${!hasTeamPlayers() ? 'Composez les équipes' : quality >= 90 ? 'Très proche' : quality >= 75 ? 'Bon' : 'À ajuster'}</small></div>${teamView('black', teams().black, result.b)}</div>${hasTeamPlayers() ? analyticsView(teams(), result) : ''}`;
  }

  function matchView() {
    const present = presentPlayers();
    const keepers = present.filter(player => positionsOf(player).includes('goalie')).length;
    const regularCount = present.filter(player => player.status === 'regulier').length;
    const replacementCount = present.filter(player => player.status === 'remplacant').length;
    const result = evaluate(teams().white, teams().black);
    const quality = hasTeamPlayers() ? Math.max(0, 100 - Math.round(result.value * 2)) : null;
    return `<div class="page-stack">${notice ? `<div id="page-notice" class="notice success" role="status">${escapeHtml(notice)}</div>` : ''}<section class="match-toolbar"><div class="match-title"><span>MATCH AMICAL</span><strong>Préparer les équipes</strong></div><div class="match-actions"><label class="date-field">Date du match<input data-date type="date" value="${state.match.date}"></label><button data-action="optimize" class="button primary">Optimiser les équipes</button><button data-action="reset" class="button">Réinitialiser</button>${hasTeamPlayers() ? '<button data-action="archive" class="button">Archiver</button>' : ''}</div></section><details class="optimization-options"><summary>Options d’optimisation</summary><div><label><span>Variété : tenir compte des <b data-depth-value>${state.settings.historyDepth}</b> derniers matchs</span><input data-depth type="range" min="0" max="5" value="${state.settings.historyDepth}"></label><label class="check-option"><input data-balance type="checkbox" ${state.settings.balancePositions ? 'checked' : ''}> Équilibrer les positions</label></div></details><section class="summary-grid"><button class="summary-card interactive" data-action="attendance"><span>Joueurs présents</span><strong>${present.length}</strong><small>${regularCount} réguliers · ${replacementCount} remplaçants</small><span class="summary-chevron" aria-hidden="true">›</span></button><div class="summary-card"><span>Gardiens disponibles</span><strong>${keepers}</strong><small>${assignedGoalies().white.length === 1 && assignedGoalies().black.length === 1 ? 'Un dans chaque équipe' : 'Placez un gardien par équipe'}</small></div><div class="summary-card"><span>Équilibre global</span><strong>${quality === null ? '—' : `${quality}%`}</strong><small>${quality === null ? 'Composez ou optimisez les équipes' : `Écart de force : ${Math.abs(result.a.total - result.b.total).toFixed(1)}`}</small></div></section>${teamsBoard()}</div>`;
  }

  function ratingField(player, position) {
    const enabled = positionsOf(player).includes(position);
    return `<label class="rating ${enabled ? '' : 'off'}" data-rating="${position}">Niveau ${POSITIONS[position].toLowerCase()} <output>${player.ratings[position] ?? 5}</output><input type="range" name="${position}" min="0" max="10" step="1" value="${player.ratings[position] ?? 5}" ${enabled ? '' : 'disabled'}></label>`;
  }

  function playerForm() {
    const selected = editingPlayer();
    const player = selected || { name: '', positions: [], ratings: { goalie: 5, defense: 5, attack: 5 }, cardio: 5, status: 'regulier', active: true };
    return `<article class="card player-editor" id="player-editor"><h2 tabindex="-1">${selected ? 'Modifier le joueur' : 'Ajouter un joueur'}</h2><form id="player-form" class="form"><label class="name-field"><span>Nom du joueur</span><input name="name" required autocomplete="off" placeholder="Ex. John Lajoie" value="${escapeHtml(player.name)}"></label><div class="position-options" aria-label="Positions">${Object.keys(POSITIONS).map(position => `<label><input type="checkbox" name="pos" value="${position}" ${positionsOf(player).includes(position) ? 'checked' : ''}><span>${POSITIONS[position]}</span></label>`).join('')}</div><div class="ratings-grid">${Object.keys(POSITIONS).map(position => ratingField(player, position)).join('')}</div><label class="rating">Niveau cardio <output>${player.cardio}</output><input type="range" name="cardio" min="0" max="10" step="1" value="${player.cardio}"></label><div class="segmented-group" aria-label="Statut du joueur"><label><input type="radio" name="status" value="regulier" ${player.status === 'regulier' ? 'checked' : ''}><span>Régulier</span></label><label><input type="radio" name="status" value="remplacant" ${player.status === 'remplacant' ? 'checked' : ''}><span>Remplaçant</span></label></div><div class="segmented-group" aria-label="État du joueur"><label><input type="radio" name="activity" value="active" ${player.active ? 'checked' : ''}><span>Actif</span></label><label><input type="radio" name="activity" value="inactive" ${player.active ? '' : 'checked'}><span>Inactif</span></label></div><div class="form-actions"><button class="button primary">${selected ? 'Enregistrer' : 'Ajouter le joueur'}</button><button type="button" class="button" data-action="cancel">Annuler</button></div></form></article>`;
  }

  function filteredPlayers(status) {
    const filter = playerFilters[status];
    const query = normalizeText(filter.query);
    return state.players.filter(player => player.status === status)
      .filter(player => filter.activity === 'all' || (filter.activity === 'active' ? player.active : !player.active))
      .filter(player => !query || normalizeText(player.name).includes(query))
      .sort(compareNames);
  }

  function playerListRow(player) {
    return `<div class="player-row ${editingPlayerId === player.id ? 'selected' : ''}" role="option" aria-selected="${editingPlayerId === player.id}"><button class="player-select player-surface" data-select="${player.id}">${playerIdentity(player)}</button><button class="trash-button" data-delete="${player.id}" aria-label="Supprimer ${escapeHtml(player.name)}">${trashIcon()}</button></div>`;
  }

  function filterToolbar(status, resultCount) {
    const filter = playerFilters[status];
    return `<div class="player-filters"><label class="search-field"><span class="search-icon" aria-hidden="true">⌕</span><input data-player-search="${status}" type="search" placeholder="Filtrer par nom" value="${escapeHtml(filter.query)}" aria-label="Filtrer les ${status === 'regulier' ? 'réguliers' : 'remplaçants'} par nom"></label><div class="filter-segments" aria-label="Filtrer par état">${[['all', 'Tous'], ['active', 'Actifs'], ['inactive', 'Inactifs']].map(([value, label]) => `<button class="${filter.activity === value ? 'active' : ''}" data-filter-status="${status}" data-filter-activity="${value}">${label}</button>`).join('')}</div><small>${resultCount} résultat${resultCount === 1 ? '' : 's'}</small></div>`;
  }

  function playerSection(status) {
    const all = state.players.filter(player => player.status === status);
    const activeCount = all.filter(player => player.active).length;
    const inactiveCount = all.length - activeCount;
    const filtered = filteredPlayers(status);
    const filter = playerFilters[status];
    let visible = filtered;
    let pagination = '';
    if (status === 'remplacant') {
      const pages = Math.max(1, Math.ceil(filtered.length / PLAYER_PAGE_SIZE));
      filter.page = Math.min(filter.page, pages);
      const start = (filter.page - 1) * PLAYER_PAGE_SIZE;
      visible = filtered.slice(start, start + PLAYER_PAGE_SIZE);
      pagination = `<nav class="pagination" aria-label="Pagination des remplaçants"><button class="button" data-player-page="${filter.page - 1}" ${filter.page <= 1 ? 'disabled' : ''}>Précédent</button><span>Page ${filter.page} sur ${pages}</span><button class="button" data-player-page="${filter.page + 1}" ${filter.page >= pages ? 'disabled' : ''}>Suivant</button></nav>`;
    }
    return `<section class="player-section" id="players-${status}"><div class="section-heading"><div><h2>${status === 'regulier' ? 'Réguliers' : 'Remplaçants'}</h2><small>${activeCount} actif${activeCount === 1 ? '' : 's'} · ${inactiveCount} inactif${inactiveCount === 1 ? '' : 's'}</small></div><span class="count-badge">${all.length}</span></div>${filterToolbar(status, filtered.length)}${visible.length ? `<div class="player-list" role="listbox" aria-label="${status === 'regulier' ? 'Réguliers' : 'Remplaçants'}">${visible.map(playerListRow).join('')}</div>` : '<p class="muted empty-results">Aucun joueur ne correspond aux filtres.</p>'}${pagination}</section>`;
  }

  function playersView() {
    return `<div class="page-stack"><header class="page-heading"><div><span class="eyebrow">BASSIN</span><h2>Joueurs</h2></div><button class="icon-button" data-action="player-settings" title="Gérer les joueurs" aria-label="Gérer les joueurs">${gearIcon()}</button></header><section class="grid split players-layout">${playerForm()}<article class="card player-directory">${playerSection('regulier')}${playerSection('remplacant')}</article></section></div>`;
  }

  function historyTeam(team) {
    return `<div class="history-team">${team.players.map(player => `<span class="history-player">${escapeHtml(player.name)}</span>`).join('') || '<span class="muted">Aucun joueur</span>'}</div>`;
  }

  function historyView() {
    return `<section class="card"><h2>Historique</h2>${state.history.length ? state.history.map((match, index) => `<article class="history-item"><div class="history-head"><strong>${escapeHtml(match.date)}</strong><button class="trash-button" data-delete-history="${index}" aria-label="Supprimer ce match">${trashIcon()}</button></div><h3>${escapeHtml(match.teams.white.name)}</h3>${historyTeam(match.teams.white)}<h3>${escapeHtml(match.teams.black.name)}</h3>${historyTeam(match.teams.black)}</article>`).join('') : '<p class="muted">Aucun match archivé.</p>'}</section>`;
  }

  function lastPlayed(playerId) {
    const dates = state.history.filter(match => [...(match.teams?.white?.players || []), ...(match.teams?.black?.players || [])].some(player => player.id === playerId)).map(match => match.date).filter(Boolean).sort().reverse();
    return dates[0] || null;
  }

  function attendanceModalBody() {
    const players = activePlayers().filter(player => player.status === attendanceTab);
    const query = normalizeText(attendanceQuery);
    const filtered = players.filter(player => !query || normalizeText(player.name).includes(query));
    if (attendanceTab === 'regulier') filtered.sort(compareNames);
    else filtered.sort((a, b) => {
      const aDate = lastPlayed(a.id);
      const bDate = lastPlayed(b.id);
      if (aDate && bDate && aDate !== bDate) return bDate.localeCompare(aDate);
      if (aDate && !bDate) return -1;
      if (!aDate && bDate) return 1;
      return compareNames(a, b);
    });
    return `<div class="attendance-controls"><div class="modal-tabs"><button class="${attendanceTab === 'regulier' ? 'active' : ''}" data-attendance-tab="regulier">Réguliers</button><button class="${attendanceTab === 'remplacant' ? 'active' : ''}" data-attendance-tab="remplacant">Remplaçants</button></div><label class="search-field"><span class="search-icon" aria-hidden="true">⌕</span><input id="attendance-search" type="search" placeholder="Filtrer par nom" value="${escapeHtml(attendanceQuery)}" aria-label="Filtrer les présences par nom"></label><small>${presentPlayers().length} joueurs présents</small></div><div class="attendance-list">${filtered.map(player => `<label class="attendance-player player-surface"><input data-attendance-player="${player.id}" type="checkbox" ${state.match.present.includes(player.id) ? 'checked' : ''}><span class="attendance-check" aria-hidden="true">✓</span>${playerIdentity(player, { lastPlayed: attendanceTab === 'remplacant' ? lastPlayed(player.id) : undefined })}</label>`).join('') || '<p class="muted">Aucun joueur ne correspond à la recherche.</p>'}</div>`;
  }

  function exportText() {
    return ['regulier', 'remplacant'].flatMap(status => state.players.filter(player => player.status === status).sort(compareNames).map(player => {
      const prefix = status === 'regulier' ? 'REG' : 'REM';
      const activity = player.active ? 'ACTIF' : 'INACTIF';
      if (!positionsOf(player).length) return `${prefix} | ${player.name} | ${activity}`;
      const values = ['goalie', 'defense', 'attack'].map(position => positionsOf(player).includes(position) ? rating(player, position) : 'x');
      return `${prefix} | ${player.name} | ${values.join(',')},${player.cardio} | ${activity}`;
    })).join('\n');
  }

  function configModalBody() {
    const tabs = `<div class="modal-tabs"><button class="${configTab === 'import' ? 'active' : ''}" data-config-tab="import">Importer</button><button class="${configTab === 'export' ? 'active' : ''}" data-config-tab="export">Exporter</button><button class="${configTab === 'reset' ? 'active danger-tab' : ''}" data-config-tab="reset">Réinitialiser</button></div>`;
    if (configTab === 'import') return `${tabs}<p class="muted">Une ligne par joueur. Les anciens formats sans état restent acceptés.</p><pre>REG | John Lajoie | x,5,7,2 | ACTIF\nREM | Bobby | 8,x,x,1 | INACTIF\nREG | Paul Tremblay | ACTIF</pre><textarea id="import-text" class="import-text" rows="10" placeholder="Collez votre liste ici"></textarea><div class="inline-actions"><button class="button primary" data-modal="import-players">Importer</button></div>`;
    if (configTab === 'export') return `${tabs}<p class="muted">Ce texte peut être réimporté sans perdre les positions, niveaux, statuts ou états.</p><textarea id="export-text" class="import-text" rows="12" readonly>${escapeHtml(exportText())}</textarea><div class="inline-actions"><button class="button primary" data-modal="copy-export">Copier</button><button class="button" data-modal="download-export">Télécharger .txt</button></div>`;
    return `${tabs}<div class="danger-zone"><h3>Réinitialiser le bassin</h3><p>Supprime tous les joueurs et vide les présences et équipes courantes. L’historique, les noms d’équipe et les préférences seront conservés.</p><button class="button danger" data-modal="confirm-pool-reset">Réinitialiser le bassin</button></div>`;
  }

  function assignmentModalBody(playerId) {
    const player = state.players.find(item => item.id === playerId);
    if (!player) return '<p>Joueur introuvable.</p>';
    const current = findAssignment(playerId);
    const allowedPositions = current?.entry.position === 'goalie' ? ['goalie'] : positionsOf(player);
    const choices = [];
    ['white', 'black'].forEach(teamKey => allowedPositions.forEach(position => {
      const otherGoalie = position === 'goalie' && state.match.teams[teamKey].find(entry => entry.position === 'goalie' && entry.player.id !== playerId);
      const canSwapGoalies = otherGoalie && current?.entry.position === 'goalie' && current.teamKey !== teamKey;
      if (!otherGoalie || canSwapGoalies) choices.push({
        teamKey,
        position,
        swapsGoalies: !!canSwapGoalies,
        selected: current?.teamKey === teamKey && current?.entry.position === position
      });
    }));
    return `<div class="assignment-player">${playerIdentity(player, { assignedPosition: current?.entry.position })}</div><div class="assignment-grid">${choices.map(choice => `<button class="assignment-choice role-border-${choice.position} ${choice.selected ? 'selected' : ''}" data-modal="assign:${choice.teamKey}:${choice.position}" aria-pressed="${choice.selected}"><span>${escapeHtml(state.settings[choice.teamKey])}</span><strong>${POSITIONS[choice.position]}</strong>${choice.selected ? '<small>Sélection actuelle · cliquer pour retirer</small>' : choice.swapsGoalies ? '<small>Échanger les gardiens</small>' : ''}</button>`).join('') || '<p class="muted">Aucune affectation disponible.</p>'}</div><div class="assignment-secondary"><button class="button danger" data-modal="make-absent">Rendre absent</button></div>`;
  }

  function renderModal() {
    const root = $('#modal-root');
    if (!modal) {
      root.innerHTML = '';
      return;
    }
    let body = modal.body;
    if (modal.kind === 'attendance') body = attendanceModalBody();
    else if (modal.kind === 'player-settings') body = configModalBody();
    else if (modal.kind === 'assignment') body = assignmentModalBody(modal.playerId);
    root.innerHTML = `<div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-title"><section class="modal ${modal.kind ? `modal-${modal.kind}` : ''}"><div class="modal-titlebar"><h2 id="modal-title">${escapeHtml(modal.title)}</h2><button class="modal-close" data-modal="close" aria-label="Fermer">×</button></div><div class="modal-body">${body}</div>${modal.actions?.length ? `<div class="modal-actions">${modal.actions.map(([label, action, className]) => `<button class="button ${className || ''}" data-modal="${action || 'close'}">${escapeHtml(label)}</button>`).join('')}</div>` : ''}</section></div>`;
  }

  function render() {
    document.querySelectorAll('body > nav button').forEach(button => button.className = button.dataset.view === view ? 'tab' : '');
    $('#app').innerHTML = view === 'match' ? matchView() : view === 'players' ? playersView() : historyView();
    renderModal();
  }

  function parseImport(text) {
    const existing = new Set(state.players.map(player => normalizeText(player.name)));
    const result = { players: [], regulars: 0, substitutes: 0, incomplete: 0, duplicates: [], errors: [] };
    text.split(/\r?\n/).forEach((rawLine, index) => {
      const line = rawLine.trim();
      if (!line) return;
      const parts = line.split('|').map(part => part.trim());
      let status = 'regulier';
      let name;
      let code;
      let activity = 'ACTIF';
      if (parts.length === 1) name = parts[0];
      else {
        const prefix = parts[0].toUpperCase();
        if (!['REG', 'REM'].includes(prefix)) {
          result.errors.push(`Ligne ${index + 1} : préfixe REG ou REM attendu`);
          return;
        }
        status = prefix === 'REM' ? 'remplacant' : 'regulier';
        name = parts[1];
        if (parts.length === 3 && ['ACTIF', 'INACTIF'].includes(parts[2].toUpperCase())) activity = parts[2].toUpperCase();
        else if (parts.length === 3) code = parts[2];
        else if (parts.length === 4) {
          code = parts[2];
          activity = parts[3].toUpperCase();
        } else if (parts.length > 4 || parts.length < 2) {
          result.errors.push(`Ligne ${index + 1} : format invalide`);
          return;
        }
      }
      name = name?.trim().replace(/\s+/g, ' ');
      if (!name) {
        result.errors.push(`Ligne ${index + 1} : nom manquant`);
        return;
      }
      if (!['ACTIF', 'INACTIF'].includes(activity)) {
        result.errors.push(`Ligne ${index + 1} : état ACTIF ou INACTIF attendu`);
        return;
      }
      const normalized = normalizeText(name);
      if (existing.has(normalized)) {
        result.duplicates.push(name);
        return;
      }
      const player = { id: uid(), name, positions: [], ratings: { goalie: 5, defense: 5, attack: 5 }, cardio: 5, status, active: activity === 'ACTIF', incomplete: true };
      if (code !== undefined && code !== '') {
        const values = code.split(',').map(value => value.trim());
        if (values.length !== 4) {
          result.errors.push(`Ligne ${index + 1} : quatre cotes sont requises`);
          return;
        }
        const positionKeys = ['goalie', 'defense', 'attack'];
        for (let valueIndex = 0; valueIndex < 3; valueIndex += 1) {
          const value = values[valueIndex];
          if (/^x$/i.test(value)) continue;
          if (!/^\d+$/.test(value) || Number(value) > 10) {
            result.errors.push(`Ligne ${index + 1} : cote de position invalide`);
            return;
          }
          player.positions.push(positionKeys[valueIndex]);
          player.ratings[positionKeys[valueIndex]] = Number(value);
        }
        if (!/^\d+$/.test(values[3]) || Number(values[3]) > 10) {
          result.errors.push(`Ligne ${index + 1} : cardio invalide`);
          return;
        }
        player.cardio = Number(values[3]);
        player.incomplete = !player.positions.length;
      }
      existing.add(normalized);
      result.players.push(player);
      if (status === 'regulier') result.regulars += 1;
      else result.substitutes += 1;
      if (player.incomplete) result.incomplete += 1;
    });
    return result;
  }

  function importPlayers() {
    const result = parseImport($('#import-text')?.value || '');
    state.players.push(...result.players);
    save();
    const issues = [...result.duplicates.map(name => `Doublon ignoré : ${escapeHtml(name)}`), ...result.errors.map(error => escapeHtml(error))];
    showModal('Import terminé', `<div class="import-summary"><p><strong>${result.regulars}</strong> réguliers ajoutés</p><p><strong>${result.substitutes}</strong> remplaçants ajoutés</p><p><strong>${result.incomplete}</strong> fiches à compléter</p><p><strong>${result.duplicates.length}</strong> doublons ignorés</p></div>${issues.length ? `<details><summary>Détails</summary><ul>${issues.map(issue => `<li>${issue}</li>`).join('')}</ul></details>` : ''}`);
    render();
  }

  document.addEventListener('click', event => {
    const viewButton = event.target.closest('[data-view]');
    if (viewButton) {
      view = viewButton.dataset.view;
      render();
      return;
    }

    const selectButton = event.target.closest('[data-select]');
    if (selectButton) {
      editingPlayerId = selectButton.dataset.select;
      render();
      if (matchMedia('(max-width: 700px)').matches) requestAnimationFrame(() => {
        const heading = $('#player-editor h2');
        heading?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        heading?.focus({ preventScroll: true });
      });
      return;
    }

    const filterButton = event.target.closest('[data-filter-activity]');
    if (filterButton) {
      const status = filterButton.dataset.filterStatus;
      playerFilters[status].activity = filterButton.dataset.filterActivity;
      playerFilters[status].page = 1;
      render();
      return;
    }

    const pageButton = event.target.closest('[data-player-page]');
    if (pageButton) {
      playerFilters.remplacant.page = Number(pageButton.dataset.playerPage);
      render();
      $('#players-remplacant')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    const configButton = event.target.closest('[data-config-tab]');
    if (configButton) {
      configTab = configButton.dataset.configTab;
      renderModal();
      return;
    }

    const attendanceButton = event.target.closest('[data-attendance-tab]');
    if (attendanceButton) {
      attendanceTab = attendanceButton.dataset.attendanceTab;
      attendanceQuery = '';
      renderModal();
      return;
    }

    const assignPlayerButton = event.target.closest('[data-assign-player]');
    if (assignPlayerButton) {
      const player = state.players.find(item => item.id === assignPlayerButton.dataset.assignPlayer);
      showModal(`Modifier ${player.name}`, '', [['OK', 'close', 'primary']], { kind: 'assignment', playerId: player.id });
      return;
    }

    const button = event.target.closest('button');
    if (!button) return;

    if (button.dataset.modal) {
      const action = button.dataset.modal;
      if (action === 'close') closeModal();
      else if (action === 'delete-player') {
        const playerId = modal.playerId;
        state.players = state.players.filter(player => player.id !== playerId);
        state.match.present = state.match.present.filter(id => id !== playerId);
        removeFromTeams(playerId);
        if (editingPlayerId === playerId) editingPlayerId = null;
        closeModal();
        save();
        render();
      } else if (action === 'archive') {
        state.history.unshift({
          date: state.match.date,
          teams: {
            white: {
              name: state.settings.white,
              players: state.match.teams.white.map(entry => ({ id: entry.player.id, name: entry.player.name }))
            },
            black: {
              name: state.settings.black,
              players: state.match.teams.black.map(entry => ({ id: entry.player.id, name: entry.player.name }))
            }
          }
        });
        state.match.teams = { white: [], black: [] };
        setNotice('Le match a été archivé et les équipes ont été vidées.');
        closeModal();
        save();
        render();
      } else if (action === 'reset-match') {
        state.match.date = today();
        state.match.present = activePlayers().filter(player => player.status === 'regulier').map(player => player.id);
        state.match.goalies = [];
        state.match.teams = { white: [], black: [] };
        setNotice('Le match courant a été réinitialisé.');
        closeModal();
        save();
        render();
      } else if (action === 'import-players') importPlayers();
      else if (action === 'copy-export') {
        navigator.clipboard?.writeText(exportText());
        button.textContent = 'Copié';
      } else if (action === 'download-export') {
        const blob = new Blob([exportText()], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `lineup-joueurs-${today()}.txt`;
        link.click();
        URL.revokeObjectURL(url);
      } else if (action === 'confirm-pool-reset') {
        showModal('Confirmer la réinitialisation', '<p><strong>Tous les joueurs seront supprimés.</strong></p><p>Les présences et équipes courantes seront vidées. L’historique, les noms d’équipe et les préférences seront conservés.</p>', [['Annuler', 'close'], ['Supprimer le bassin', 'pool-reset', 'danger']]);
      } else if (action === 'pool-reset') {
        state.players = [];
        state.match.present = [];
        state.match.goalies = [];
        state.match.teams = { white: [], black: [] };
        editingPlayerId = null;
        setNotice('Le bassin de joueurs a été réinitialisé.');
        closeModal();
        save();
        render();
      } else if (action.startsWith('assign:')) {
        const [, teamKey, position] = action.split(':');
        const player = state.players.find(item => item.id === modal.playerId);
        const current = findAssignment(player.id);
        const selectedAgain = current?.teamKey === teamKey && current?.entry.position === position;
        if (selectedAgain) {
          removeFromTeams(player.id);
          setNotice(`${player.name} reste présent, mais n’est plus affecté.`);
          save();
          render();
          return;
        }
        const targetGoalie = position === 'goalie' ? state.match.teams[teamKey].find(entry => entry.position === 'goalie' && entry.player.id !== player.id) : null;
        if (targetGoalie && current?.entry.position === 'goalie' && current.teamKey !== teamKey) {
          removeFromTeams(targetGoalie.player.id);
          removeFromTeams(player.id);
          state.match.teams[current.teamKey].push({ player: targetGoalie.player, position: 'goalie' });
        } else removeFromTeams(player.id);
        state.match.teams[teamKey].push({ player, position });
        setNotice(`${player.name} a été affecté à ${state.settings[teamKey]} — ${POSITIONS[position]}.`);
        save();
        render();
      } else if (action === 'make-absent') {
        const player = state.players.find(item => item.id === modal.playerId);
        state.match.present = state.match.present.filter(id => id !== player.id);
        removeFromTeams(player.id);
        setNotice(`${player.name} est maintenant absent.`);
        closeModal();
        save();
        render();
      }
      return;
    }

    const action = button.dataset.action;
    if (action === 'optimize') optimizeTeams();
    else if (action === 'archive') showModal('Archiver le match', '<p>Archiver cette composition? Les équipes courantes seront ensuite vidées.</p>', [['Annuler', 'close'], ['Archiver', 'archive', 'primary']]);
    else if (action === 'reset') showModal('Réinitialiser le match', '<p>La date, les présences et les équipes courantes seront réinitialisées. Le bassin et l’historique seront conservés.</p>', [['Annuler', 'close'], ['Réinitialiser', 'reset-match', 'danger']]);
    else if (action === 'copy') {
      navigator.clipboard?.writeText($('#share').value);
      button.textContent = 'Copié';
    } else if (action === 'attendance') {
      attendanceTab = 'regulier';
      attendanceQuery = '';
      showModal('Gérer les présences', '', [], { kind: 'attendance' });
    } else if (action === 'player-settings') {
      configTab = 'import';
      showModal('Gérer les joueurs', '', [], { kind: 'player-settings' });
    } else if (action === 'cancel') {
      editingPlayerId = null;
      render();
    }

    if (button.dataset.delete) {
      const player = state.players.find(item => item.id === button.dataset.delete);
      showModal('Supprimer le joueur', `<p>Supprimer ${escapeHtml(player.name)}?</p>`, [['Annuler', 'close'], ['Supprimer', 'delete-player', 'danger']], { playerId: player.id });
    }
    if (button.dataset.deleteHistory !== undefined) {
      state.history.splice(Number(button.dataset.deleteHistory), 1);
      save();
      render();
    }
  });

  document.addEventListener('change', event => {
    const data = event.target.dataset;
    if (data.attendancePlayer) {
      const playerId = data.attendancePlayer;
      if (event.target.checked) {
        if (!state.match.present.includes(playerId)) state.match.present.push(playerId);
      } else {
        state.match.present = state.match.present.filter(id => id !== playerId);
        removeFromTeams(playerId);
      }
      save();
      render();
    } else if (data.depth !== undefined) {
      state.settings.historyDepth = Number(event.target.value);
      save();
    } else if (data.balance !== undefined) {
      state.settings.balancePositions = event.target.checked;
      save();
      render();
    } else if (data.date !== undefined) {
      state.match.date = event.target.value;
      save();
    } else if (data.name) {
      state.settings[data.name] = event.target.value.trim() || defaults.settings[data.name];
      save();
      render();
    } else if (event.target.name === 'pos') {
      const slider = event.target.form.elements[event.target.value];
      slider.disabled = !event.target.checked;
      slider.closest('[data-rating]').classList.toggle('off', !event.target.checked);
    }
  });

  document.addEventListener('input', event => {
    if (event.target.dataset.depth !== undefined) {
      state.settings.historyDepth = Number(event.target.value);
      $('[data-depth-value]').textContent = event.target.value;
      save();
      return;
    }
    if (event.target.dataset.date !== undefined) {
      state.match.date = event.target.value;
      save();
      return;
    }
    if (event.target.dataset.playerSearch) {
      const status = event.target.dataset.playerSearch;
      playerFilters[status].query = event.target.value;
      playerFilters[status].page = 1;
      const cursor = event.target.value.length;
      render();
      requestAnimationFrame(() => {
        const input = $(`[data-player-search="${status}"]`);
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

  document.addEventListener('submit', event => {
    if (event.target.id !== 'player-form') return;
    event.preventDefault();
    const form = event.target;
    const data = new FormData(form);
    const selected = editingPlayer();
    const selectedPositions = [...form.querySelectorAll('input[name=pos]:checked')].map(input => input.value);
    if (!selectedPositions.length) {
      showModal('Position requise', '<p>Choisissez au moins une position.</p>');
      return;
    }
    const ratings = { ...(selected?.ratings || { goalie: 5, defense: 5, attack: 5 }) };
    selectedPositions.forEach(position => { ratings[position] = Number(data.get(position)); });
    const player = {
      id: selected?.id || uid(),
      name: data.get('name').trim().replace(/\s+/g, ' '),
      positions: selectedPositions,
      ratings,
      cardio: Number(data.get('cardio')),
      status: data.get('status'),
      active: data.get('activity') === 'active',
      incomplete: false
    };
    state.players = selected ? state.players.map(item => item.id === player.id ? player : item) : [...state.players, player];
    if (!player.active) {
      state.match.present = state.match.present.filter(id => id !== player.id);
      removeFromTeams(player.id);
    } else {
      ['white', 'black'].forEach(key => state.match.teams[key].forEach(entry => {
        if (entry.player.id === player.id) entry.player = player;
      }));
      const assignment = findAssignment(player.id);
      if (assignment && !selectedPositions.includes(assignment.entry.position)) removeFromTeams(player.id);
    }
    editingPlayerId = null;
    save();
    render();
  });

  render();
})();
