/* ═══════════════════════════════════════════════════════
   AB RENOV — app.js
   Logique principale : auth, API, rendu, formulaires
═══════════════════════════════════════════════════════ */

// ── CONFIGURATION ──────────────────────────────────────
// ⚠️  Remplacez cette URL par celle de votre Google Apps Script déployé
const API_URL = 'https://script.google.com/macros/s/VOTRE_ID_SCRIPT_ICI/exec';

// Mot de passe du site (simple protection)
// ⚠️  Changez ce mot de passe avant de publier
const APP_PASSWORD = 'abrenov2026';

// ── ÉTAT GLOBAL ────────────────────────────────────────
let allData     = [];   // Tous les chantiers récupérés
let currentTab  = 'previsionnel';

// ═══════════════════════════════════════════════════════
//  AUTHENTIFICATION
// ═══════════════════════════════════════════════════════

/** Vérifie le mot de passe et affiche l'app */
function checkPassword() {
  const input = document.getElementById('password-input').value;
  if (input === APP_PASSWORD) {
    sessionStorage.setItem('abr_auth', '1');
    showApp();
  } else {
    document.getElementById('login-error').textContent = '❌ Mot de passe incorrect.';
    document.getElementById('password-input').value = '';
    document.getElementById('password-input').focus();
  }
}

/** Affiche l'application principale */
function showApp() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  loadData();
}

/** Déconnexion */
function logout() {
  sessionStorage.removeItem('abr_auth');
  document.getElementById('app').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('password-input').value = '';
}

// Appui sur Entrée dans le champ mot de passe
document.getElementById('password-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') checkPassword();
});

// Vérification au chargement (si déjà connecté dans la session)
window.addEventListener('DOMContentLoaded', () => {
  if (sessionStorage.getItem('abr_auth') === '1') {
    showApp();
  }
});

// ═══════════════════════════════════════════════════════
//  API — CHARGEMENT DES DONNÉES
// ═══════════════════════════════════════════════════════

/** Charge tous les chantiers depuis Google Sheets */
async function loadData() {
  showStatus('Chargement…', 'info');

  try {
    const res  = await fetch(`${API_URL}?action=getAll`);
    const json = await res.json();

    if (json.status !== 'ok') throw new Error(json.message || 'Erreur API');

    allData = json.data || [];
    renderAll();
    hideStatus();

  } catch (err) {
    console.error('Erreur loadData:', err);
    showStatus('❌ Impossible de charger les données. Vérifiez la connexion.', 'error', 5000);
    renderAll(); // Affiche quand même (liste vide)
  }
}

// ═══════════════════════════════════════════════════════
//  RENDU PRINCIPAL
// ═══════════════════════════════════════════════════════

/** Déclenche tous les rendus */
function renderAll() {
  renderPrevisionnels();
  renderFactures();
  renderStats();
  renderStatsBand();
  updateYearFilters();
}

/** Rendu de la liste prévisionnelle */
function renderPrevisionnels() {
  const list = allData.filter(c => c.statut === 'previsionnel');
  document.getElementById('count-prev').textContent = list.length;

  const el = document.getElementById('list-previsionnel');

  if (!list.length) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <p>Aucun chantier prévisionnel</p>
      </div>`;
    return;
  }

  el.innerHTML = list.map(c => `
    <div class="chantier-card previsionnel" data-id="${c.id}">
      <div class="card-top">
        <div class="card-client">${escHtml(c.client)}</div>
        <div class="card-montant">${formatMontant(c.montant)}</div>
      </div>
      <div class="card-details">
        ${c.information ? `<span class="card-tag info-tag">📌 ${escHtml(c.information)}</span>` : ''}
        <span class="card-tag">${formatDate(c.date_creation)}</span>
      </div>
      <div class="card-actions">
        <button class="btn-edit" onclick="openModal('edit', '${c.id}')">✏️ Modifier</button>
        <button class="btn-delete" onclick="deleteChantier('${c.id}')">🗑</button>
      </div>
    </div>
  `).join('');
}

/** Rendu de la liste des chantiers facturés */
function renderFactures() {
  let list = allData.filter(c => c.statut === 'facture');

  // Filtres
  const annee = document.getElementById('filter-annee').value;
  const mois  = document.getElementById('filter-mois').value;

  if (annee) list = list.filter(c => String(c.annee) === annee);
  if (mois)  list = list.filter(c => String(c.mois)  === mois);

  // Tri par date décroissante
  list.sort((a, b) => new Date(b.date_creation) - new Date(a.date_creation));

  document.getElementById('count-fact').textContent = allData.filter(c => c.statut === 'facture').length;

  const el = document.getElementById('list-facture');

  if (!list.length) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🧾</div>
        <p>Aucun chantier facturé pour cette période</p>
      </div>`;
    return;
  }

  el.innerHTML = list.map(c => `
    <div class="chantier-card facture" data-id="${c.id}">
      <div class="card-top">
        <div class="card-client">${escHtml(c.client)}</div>
        <div class="card-montant">${formatMontant(c.montant)}</div>
      </div>
      <div class="card-details">
        <span class="card-tag facture-tag">🧾 ${escHtml(c.facture)}</span>
        <span class="card-tag date-tag">📅 ${formatDate(c.date_creation)}</span>
        ${c.information ? `<span class="card-tag info-tag">📌 ${escHtml(c.information)}</span>` : ''}
        <span class="card-tag">${nomMois(c.mois)} ${c.annee}</span>
      </div>
      <div class="card-actions">
        <button class="btn-edit" onclick="openModal('edit', '${c.id}')">✏️ Modifier</button>
        <button class="btn-delete" onclick="deleteChantier('${c.id}')">🗑</button>
      </div>
    </div>
  `).join('');
}

/** Rendu des statistiques */
function renderStats() {
  const anneeEl = document.getElementById('stats-annee');
  const annee   = anneeEl.value ? Number(anneeEl.value) : null;

  let factures = allData.filter(c => c.statut === 'facture');
  if (annee) factures = factures.filter(c => Number(c.annee) === annee);

  const totalFacture = factures.reduce((s, c) => s + Number(c.montant || 0), 0);
  const previsionnel = allData.filter(c => c.statut === 'previsionnel');
  const totalPrev    = previsionnel.reduce((s, c) => s + Number(c.montant || 0), 0);

  // ── Calcul par mois ──
  const parMois = {};
  for (let m = 1; m <= 12; m++) parMois[m] = { total: 0, count: 0 };

  factures.forEach(c => {
    const m = Number(c.mois);
    if (m >= 1 && m <= 12) {
      parMois[m].total += Number(c.montant || 0);
      parMois[m].count++;
    }
  });

  const maxMois = Math.max(...Object.values(parMois).map(v => v.total), 1);

  // ── Calcul par année ──
  const annees = {};
  allData.filter(c => c.statut === 'facture').forEach(c => {
    const a = c.annee || '—';
    if (!annees[a]) annees[a] = { total: 0, count: 0 };
    annees[a].total += Number(c.montant || 0);
    annees[a].count++;
  });

  const el = document.getElementById('stats-content');

  el.innerHTML = `
    <!-- Résumé global -->
    <div class="stats-grid">
      <div class="stat-big">
        <div class="stat-big-label">Total prévisionnel en cours</div>
        <div class="stat-big-value orange">${formatMontant(totalPrev)}</div>
      </div>
      <div class="stat-big">
        <div class="stat-big-label">Total facturé ${annee || 'global'}</div>
        <div class="stat-big-value green">${formatMontant(totalFacture)}</div>
      </div>
      <div class="stat-big">
        <div class="stat-big-label">Nombre de chantiers facturés</div>
        <div class="stat-big-value">${factures.length}</div>
      </div>
    </div>

    <!-- Par mois -->
    <div class="stats-section-title">Par mois ${annee ? annee : ''}</div>
    ${Object.entries(parMois).map(([m, d]) => {
      const pct = maxMois > 0 ? Math.round((d.total / maxMois) * 100) : 0;
      return `
        <div class="month-row">
          <div class="month-name">${nomMois(m)}</div>
          <div class="month-bar-wrap">
            <div class="month-bar" style="width:${pct}%"></div>
          </div>
          <div class="month-count">${d.count} chantier${d.count > 1 ? 's' : ''}</div>
          <div class="month-amount">${d.total > 0 ? formatMontant(d.total) : '—'}</div>
        </div>`;
    }).join('')}

    <!-- Par année -->
    <div class="stats-section-title" style="margin-top:32px">Par année</div>
    ${Object.entries(annees).sort((a, b) => b[0] - a[0]).map(([a, d]) => `
      <div class="year-row">
        <div class="year-label">${a}</div>
        <div class="year-count">${d.count} chantier${d.count > 1 ? 's' : ''}</div>
        <div class="year-amount">${formatMontant(d.total)}</div>
      </div>
    `).join('') || '<div class="empty-state"><p>Aucune donnée</p></div>'}
  `;
}

/** Met à jour la bande de stats en haut */
function renderStatsBand() {
  const now    = new Date();
  const annee  = now.getFullYear();
  const mois   = now.getMonth() + 1;

  const prev    = allData.filter(c => c.statut === 'previsionnel');
  const totPrev = prev.reduce((s, c) => s + Number(c.montant || 0), 0);

  const factAnnee  = allData.filter(c => c.statut === 'facture' && Number(c.annee) === annee);
  const totAnnee   = factAnnee.reduce((s, c) => s + Number(c.montant || 0), 0);

  const factMois  = allData.filter(c => c.statut === 'facture' && Number(c.annee) === annee && Number(c.mois) === mois);
  const totMois   = factMois.reduce((s, c) => s + Number(c.montant || 0), 0);

  document.getElementById('stat-previsionnel').textContent = formatMontant(totPrev);
  document.getElementById('stat-facture-annee').textContent = formatMontant(totAnnee);
  document.getElementById('stat-annee-label').textContent  = annee;
  document.getElementById('stat-facture-mois').textContent  = formatMontant(totMois);
}

/** Met à jour les listes déroulantes d'années */
function updateYearFilters() {
  const annees = [...new Set(
    allData.filter(c => c.annee).map(c => String(c.annee))
  )].sort((a, b) => b - a);

  ['filter-annee', 'stats-annee'].forEach(id => {
    const sel = document.getElementById(id);
    const val = sel.value;
    const placeholder = id === 'filter-annee' ? 'Toutes années' : 'Toutes années';
    sel.innerHTML = `<option value="">${placeholder}</option>` +
      annees.map(a => `<option value="${a}">${a}</option>`).join('');
    sel.value = val;
  });
}

// ═══════════════════════════════════════════════════════
//  NAVIGATION PAR ONGLETS
// ═══════════════════════════════════════════════════════

function switchTab(tab) {
  currentTab = tab;

  document.querySelectorAll('.tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.querySelectorAll('.tab-content').forEach(el => {
    el.classList.toggle('active', el.id === `tab-${tab}`);
  });
}

// ═══════════════════════════════════════════════════════
//  MODAL — AJOUTER / MODIFIER
// ═══════════════════════════════════════════════════════

function openModal(mode, id) {
  const modal = document.getElementById('modal-overlay');
  modal.classList.remove('hidden');

  if (mode === 'add') {
    document.getElementById('modal-title').textContent  = 'Nouveau chantier';
    document.getElementById('field-id').value           = '';
    document.getElementById('field-client').value       = '';
    document.getElementById('field-montant').value      = '';
    document.getElementById('field-info').value         = '';
    document.getElementById('field-facture').value      = '';
    document.getElementById('field-date').value         = '';

  } else {
    // Mode modification
    const c = allData.find(x => x.id === id);
    if (!c) return;
    document.getElementById('modal-title').textContent  = 'Modifier le chantier';
    document.getElementById('field-id').value           = c.id;
    document.getElementById('field-client').value       = c.client || '';
    document.getElementById('field-montant').value      = c.montant || '';
    document.getElementById('field-info').value         = c.information || '';
    document.getElementById('field-facture').value      = c.facture || '';
    document.getElementById('field-date').value         = c.date_creation ? c.date_creation.split('T')[0] : '';
  }
}

function closeModal(evt) {
  if (evt && evt.target !== document.getElementById('modal-overlay')) return;
  document.getElementById('modal-overlay').classList.add('hidden');
}

/** Enregistre un chantier (création ou modification) */
async function saveChantier() {
  const id      = document.getElementById('field-id').value.trim();
  const client  = document.getElementById('field-client').value.trim();
  const montant = document.getElementById('field-montant').value.trim();
  const info    = document.getElementById('field-info').value.trim();
  const facture = document.getElementById('field-facture').value.trim();
  const date    = document.getElementById('field-date').value;

  // Validation minimale
  if (!client) {
    alert('❌ Le nom du client est obligatoire.');
    return;
  }
  if (!montant || isNaN(Number(montant))) {
    alert('❌ Le montant doit être un nombre valide.');
    return;
  }

  const payload = {
    client,
    montant: Number(montant),
    information: info,
    facture,
    date_creation: date || new Date().toISOString().split('T')[0],
  };

  try {
    let res;
    if (id) {
      // Modification
      payload.action = 'update';
      payload.id     = id;
      res = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } else {
      // Création
      payload.action = 'add';
      res = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }

    const json = await res.json();
    if (json.status !== 'ok') throw new Error(json.message);

    closeModal();
    showStatus('✅ Chantier enregistré !', 'success', 3000);
    await loadData();

  } catch (err) {
    console.error('Erreur saveChantier:', err);
    showStatus('❌ Erreur lors de l\'enregistrement.', 'error', 4000);
  }
}

/** Supprime un chantier après confirmation */
async function deleteChantier(id) {
  const c = allData.find(x => x.id === id);
  if (!c) return;

  const ok = confirm(`Supprimer "${c.client}" ?\nCette action est irréversible.`);
  if (!ok) return;

  try {
    const res  = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'delete', id }),
    });
    const json = await res.json();
    if (json.status !== 'ok') throw new Error(json.message);

    showStatus('🗑 Chantier supprimé.', 'success', 3000);
    await loadData();

  } catch (err) {
    console.error('Erreur deleteChantier:', err);
    showStatus('❌ Erreur lors de la suppression.', 'error', 4000);
  }
}

// ═══════════════════════════════════════════════════════
//  UTILITAIRES
// ═══════════════════════════════════════════════════════

/** Formate un montant en euros */
function formatMontant(val) {
  const n = Number(val);
  if (isNaN(n) || val === '' || val === null || val === undefined) return '—';
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

/** Formate une date ISO en JJ/MM/AAAA */
function formatDate(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d)) return val;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Nom du mois français */
function nomMois(n) {
  const mois = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
                 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  return mois[Number(n)] || '—';
}

/** Échappe le HTML pour éviter les injections */
function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Affiche une notification en bas de l'écran */
let statusTimer = null;
function showStatus(msg, type = 'info', duration = 0) {
  const bar = document.getElementById('status-bar');
  bar.textContent = msg;
  bar.className   = `status-bar ${type}`;
  bar.classList.remove('hidden');

  if (statusTimer) clearTimeout(statusTimer);
  if (duration > 0) {
    statusTimer = setTimeout(hideStatus, duration);
  }
}

function hideStatus() {
  document.getElementById('status-bar').classList.add('hidden');
}
