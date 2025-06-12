// =========================
// SSVF Dashboard JavaScript
// =========================

// --- Constants and Globals ---

// Living situation options for dropdowns
const livingOptions = [
    "Unsheltered", "Shelter", "GPD/CRS", "Housed", "Institution", "Other"
];

// Cached list of veterans for filtering and rendering
let cachedVeterans = [];

// State for notes modal
let currentNotesVetId = null;
let currentNotesLiving = null;
let currentNotesContact = null;

// State for reassign modal
let reassignVetId = null;
let agencyCaseManagers = [];

// =========================
// Data Fetching Functions
// =========================

/**
 * Fetches all veterans for the agency or just the logged-in case manager's veterans.
 * @param {boolean} fetchAll - If true, fetch all agency veterans; otherwise, fetch only assigned veterans.
 */
async function fetchVeterans(fetchAll = false) {
    const url = fetchAll ? '/api/veterans?all=true' : '/api/veterans';
    const resp = await fetch(url);
    const data = await resp.json();
    if (data.error) {
        alert(data.error);
        return;
    }
    // Fetch additional details for each veteran (e.g., demographics, appointments)
    const detailedVeterans = await Promise.all(
        data.map(async vet => {
            try {
                const detailResp = await fetch(`/api/patient?id=${vet.id}`);
                const detail = await detailResp.json();
                // If SSN is missing, mark as missing consent/token
                if (!detail.ssn) {
                    return { ...vet, ...detail, token_status: "missing" };
                }
                return { ...vet, ...detail, token_status: "active" };
            } catch {
                // If fetch fails, mark as missing
                return { ...vet, token_status: "missing" };
            }
        })
    );
    cachedVeterans = detailedVeterans;
    renderTable(cachedVeterans);
}

/**
 * Fetches veterans for a specific case manager by ID.
 * @param {string|number} caseManagerId
 */
async function fetchVeteransByCaseManager(caseManagerId) {
    let url = '/api/veterans';
    if (caseManagerId) {
        url += `?case_manager_id=${caseManagerId}`;
    }
    const resp = await fetch(url);
    const data = await resp.json();
    if (data.error) {
        alert(data.error);
        return;
    }
    // Fetch additional details for each veteran
    cachedVeterans = await Promise.all(
        data.map(async vet => {
            try {
                const detailResp = await fetch(`/api/patient?id=${vet.id}`);
                const detail = await detailResp.json();
                // If SSN is missing, mark as missing consent/token
                if (!detail.ssn) {
                    return { ...vet, ...detail, token_status: "missing" };
                }
                return { ...vet, ...detail, token_status: "active" };
            } catch {
                // If fetch fails, mark as missing
                return { ...vet, token_status: "missing" };
            }
        })
    );
    renderTable(cachedVeterans);
}

/**
 * Fetches the list of case managers for the agency (used for reassignment modal).
 * Caches the result for future use.
 */
async function loadCaseManagersForReassign() {
    if (agencyCaseManagers.length === 0) {
        const sessionResp = await fetch('/api/case_manager_session');
        const sessionData = await sessionResp.json();
        const agencyId = sessionData.agency_id;
        const resp = await fetch(`/api/case_managers?agency_id=${agencyId}`);
        agencyCaseManagers = await resp.json();
    }
    return agencyCaseManagers;
}

// =========================
// Table Rendering Functions
// =========================

/**
 * Renders the main veterans table and details rows.
 * @param {Array} veterans - List of veteran objects to display.
 */
function renderTable(veterans) {
    const tbody = document.getElementById('veteranTable').querySelector('tbody');
    tbody.innerHTML = '';
    veterans.forEach((vet, idx) => {
        // Fetch case notes for each veteran
        fetch(`/api/case_notes/${vet.id}`)
            .then(r => r.json())
            .then(notes => {
                const tr = document.createElement('tr');
                let ssnLast4 = '';
                if (vet.ssn && vet.ssn.length >= 4) {
                    ssnLast4 = vet.ssn.slice(-4);
                }
                tr.innerHTML = `
                    <td class="name-cell">
                        ${
                            vet.token_status === "missing"
                            ? '<span class="token-expired-indicator" title="Consent expired or revoked"></span>'
                            : ''
                        }
                        ${vet.name || ''}
                    </td>
                    <td>${ssnLast4}</td>
                    <td>${vet.age || ''}</td>
                    <td>
                        ${
                            (vet.care_teams && vet.care_teams.length > 0)
                            ? "Yes"
                            : `None found. <a href="https://eauth.va.gov/accessva/?cspSelectFor=https%3A%2F%2Fwww.my.vaemcc.va.gov%2FSQUARES&ForceAuthn=false" target="_blank">Check Eligibility</a>`
                        }
                    </td>
                    <td>
                        <select>
                            ${livingOptions.map(opt => `<option value="${opt}"${notes.living_situation === opt ? ' selected' : ''}>${opt}</option>`).join('')}
                        </select>
                    </td>
                    <td>
                        <input type="date" value="${notes.last_contact || ''}">
                    </td>
                    <td>
                        <span class="notes-preview clickable" title="${notes.case_notes || ''}" onclick="openNotesModal('${vet.id}', '${notes.case_notes || ''}', this.parentElement.parentElement.querySelector('select').value, this.parentElement.parentElement.querySelector('input').value)">
                            ${notes.case_notes && notes.case_notes.length > 0 ? (notes.case_notes.length > 60 ? notes.case_notes.slice(0, 60) + '…' : notes.case_notes) : '—'}
                        </span>
                    </td>
                    <td>${(vet.upcoming_appointments && vet.upcoming_appointments.length > 0) ? new Date(vet.upcoming_appointments[0].date).toLocaleString() : ''}</td>
                    <td>
                        <button class="save-btn button-green" onclick="saveNotes('${vet.id}', this)">Save</button>
                        <span class="save-success" style="display:none;"></span>
                    </td>
                    <td><button class="button-green" onclick="toggleDetails(${idx}, cachedVeterans[${idx}])">Details</button></td>
                    <td><button class="button-green" onclick="reassignVeteran('${vet.id}')">Reassign</button></td>
                `;
                tbody.appendChild(tr);

                // Details row (initially hidden)
                const detailsTr = document.createElement('tr');
                detailsTr.className = 'expand-row';
                detailsTr.id = `details-row-${idx}`;
                detailsTr.style.display = 'none';
                const detailsTd = document.createElement('td');
                detailsTd.colSpan = 10;
                detailsTd.innerHTML = renderDetails(vet);
                detailsTr.appendChild(detailsTd);
                tbody.appendChild(detailsTr);
            });
    });
}

/**
 * Renders the expanded details for a veteran, including demographics, care teams, appointments, consults, and radiology orders.
 * @param {Object} vet - Veteran object
 * @returns {string} - HTML string for details
 */
function renderDetails(vet) {
    let html = '<div style="padding:10px;">';
    if (vet.token_status && vet.token_status !== "active") {
        html += `<div style="color:#e74c3c; font-weight:bold; margin-bottom:8px;">
            ⚠ Consent is ${vet.token_status === "revoked" ? "revoked" : "expired"}. Case manager access is restricted.
        </div>`;
    }
    if (vet.name) html += `<strong>Name:</strong> ${vet.name}<br>`;
    if (vet.ssn) html += `<strong>SSN:</strong> ${vet.ssn}<br>`; // Show full SSN in details
    if (vet.dob) {
        // Format DOB as "Month Day, Year"
        const dobDate = new Date(vet.dob);
        const dobFormatted = dobDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        html += `<strong>Date of Birth:</strong> ${dobFormatted}<br>`;
    }
    if (vet.age) html += `<strong>Age:</strong> ${vet.age}<br>`;
    if (vet.address) html += `<strong>Address:</strong> ${vet.address}<br>`;
    if (vet.phones && vet.phones.length)
        html += `<strong>Phone(s):</strong> ${vet.phones.join(', ')}<br>`;
    if (vet.emails && vet.emails.length) {
        html += `<strong>Email(s):</strong> ${vet.emails.join(', ')}<br>`;
    }
    if (vet.eligibility) html += `<strong>Eligibility:</strong> ${vet.eligibility}<br>`;
    // Care team details, grouped by location
    if (vet.care_teams && vet.care_teams.length > 0) {
        html += `<strong>Care Team:</strong><br>`;
        const groupedByLocation = {};
        vet.care_teams.forEach(team => {
            const location = team.locations && team.locations.length > 0 ? team.locations[0] : "Unknown Location";
            if (!groupedByLocation[location]) {
                groupedByLocation[location] = [];
            }
            groupedByLocation[location].push({
                practitioner: team.practitioner,
                role: team.role && team.role.length > 0 ? team.role.join(", ") : "Unknown Role",
            });
        });
        Object.keys(groupedByLocation).forEach(location => {
            html += `<div style="margin-left: 20px;">
                        <strong>Location:</strong> ${location}
                        <button onclick="toggleCareTeam('${location}')">Expand</button>
                        <div id="careTeam-${location}" style="display: none; margin-left: 20px;">
                            ${groupedByLocation[location].map(practitioner => `
                                <div>
                                    <strong>Practitioner:</strong> ${practitioner.practitioner}<br>
                                    <strong>Role:</strong> ${practitioner.role}
                                </div>
                            `).join('')}
                        </div>
                    </div>`;
        });
    }
    // Past appointments (last 6 months)
    if (vet.past_appointments && vet.past_appointments.length) {
        html += `<strong>Past Appointments (6mo):</strong>`;
        vet.past_appointments.forEach(appt => {
            html += formatAppt(appt);
        });
    }
    // Upcoming appointments
    if (vet.upcoming_appointments && vet.upcoming_appointments.length) {
        html += `<strong>Upcoming Appointments:</strong>`;
        vet.upcoming_appointments.forEach(appt => {
            html += formatAppt(appt);
        });
    }
    // Active consults/referrals
    if (vet.consults && vet.consults.length) {
        html += `<strong>Active Consults/Referrals:</strong><ul>`;
        vet.consults.forEach(c => {
            html += `<li>${c.description || ''} (${c.status || ''})</li>`;
        });
        html += `</ul>`;
    }
    // Pending radiology orders
    if (vet.radiology_orders && vet.radiology_orders.length) {
        html += `<strong>Pending Radiology Orders:</strong><ul>`;
        vet.radiology_orders.forEach(r => {
            html += `<li>${r.description || ''} (${r.status || ''})</li>`;
        });
        html += `</ul>`;
    }
    html += '</div>';
    return html;
}

/**
 * Formats an appointment object into a readable HTML string.
 * @param {Object} appt - Appointment object
 * @returns {string} - HTML string
 */
function formatAppt(appt) {
    return `
        <div style="margin-bottom:6px;">
            <strong>${appt.date ? new Date(appt.date).toLocaleString() : ''}</strong>
            ${appt.description ? ' - ' + appt.description : ''}
            ${appt.service_type ? ' (' + appt.service_type + ')' : ''}
            ${appt.reason ? ' [' + appt.reason + ']' : ''}
            ${appt.status ? ' <span style="color:#888;">[' + appt.status + ']</span>' : ''}
        </div>
    `;
}

// =========================
// Modal Logic (Notes & Reassign)
// =========================

/**
 * Opens the notes modal for editing case notes.
 */
function openNotesModal(vetId, notes, living, contact) {
    currentNotesVetId = vetId;
    currentNotesLiving = living;
    currentNotesContact = contact;
    document.getElementById('modalNotes').value = notes;
    document.getElementById('notesModal').classList.add('active');
}

/**
 * Closes the notes modal.
 */
function closeNotesModal() {
    document.getElementById('notesModal').classList.remove('active');
    currentNotesVetId = null;
}

/**
 * Saves notes for a veteran from the modal.
 */
document.getElementById('saveNotesBtn').onclick = function() {
    const newNotes = document.getElementById('modalNotes').value;
    fetch('/api/case_notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            icn: currentNotesVetId,
            living_situation: currentNotesLiving,
            last_contact: currentNotesContact,
            case_notes: newNotes
        })
    }).then(r => r.json()).then(resp => {
        closeNotesModal();
        fetchVeterans();
    });
};

/**
 * Saves notes for a veteran directly from the table row.
 */
function saveNotes(vetId, btn) {
    const tr = btn.closest('tr');
    const livingSel = tr.querySelector('select');
    const contactInput = tr.querySelector('input[type="date"]');
    const notesPreview = tr.querySelector('.notes-preview');
    fetch('/api/case_notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            icn: vetId,
            living_situation: livingSel.value,
            last_contact: contactInput.value,
            case_notes: notesPreview.title || ''
        })
    }).then(r => r.json()).then(resp => {
        const saveMsg = tr.querySelector('.save-success');
        if (resp.success) {
            saveMsg.textContent = "Saved!";
            saveMsg.style.display = "";
            setTimeout(() => saveMsg.style.display = "none", 1500);
        }
    });
}

/**
 * Opens the reassign modal for a veteran.
 */
function reassignVeteran(vetId) {
    reassignVetId = vetId;
    loadCaseManagersForReassign().then(caseManagers => {
        const select = document.getElementById('caseManagerSelect');
        select.innerHTML = '';
        caseManagers.forEach(cm => {
            const option = document.createElement('option');
            option.value = cm.id;
            option.textContent = cm.username;
            select.appendChild(option);
        });
        document.getElementById('reassignModal').style.display = 'block';
    });
}

/**
 * Closes the reassign modal.
 */
function closeReassignModal() {
    document.getElementById('reassignModal').style.display = 'none';
    reassignVetId = null;
}

/**
 * Confirms reassignment of a veteran to a new case manager.
 */
document.getElementById('confirmReassignBtn').onclick = function() {
    const newCaseManagerId = document.getElementById('caseManagerSelect').value;
    if (!newCaseManagerId) return;
    fetch('/api/reassign_veteran', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            veteran_id: reassignVetId,
            new_case_manager_id: parseInt(newCaseManagerId)
        })
    })
    .then(r => r.json())
    .then(resp => {
        if (resp.success) {
            alert("Veteran reassigned successfully!");
            closeReassignModal();
            fetchVeterans();
        } else {
            alert(resp.error || "Failed to reassign veteran.");
        }
    });
};

// =========================
// Table Filtering & Details
// =========================

/**
 * Expands or collapses the details row for a veteran.
 */
function toggleDetails(idx, vet) {
    const row = document.getElementById(`details-row-${idx}`);
    if (row.style.display === 'none') {
        row.style.display = '';
    } else {
        row.style.display = 'none';
    }
}

/**
 * Expands all details rows in the table.
 */
function expandAllDetails() {
    const tbody = document.getElementById('veteranTable').querySelector('tbody');
    Array.from(tbody.querySelectorAll('tr.expand-row')).forEach(row => {
        row.style.display = '';
    });
}

/**
 * Collapses all details rows in the table.
 */
function collapseAllDetails() {
    const tbody = document.getElementById('veteranTable').querySelector('tbody');
    Array.from(tbody.querySelectorAll('tr.expand-row')).forEach(row => {
        row.style.display = 'none';
    });
}

/**
 * Expands/collapses care team details by location.
 */
function toggleCareTeam(location) {
    const careTeamDiv = document.getElementById(`careTeam-${location}`);
    if (careTeamDiv.style.display === "none") {
        careTeamDiv.style.display = "block";
    } else {
        careTeamDiv.style.display = "none";
    }
}

/**
 * Filters the table by name, care team, or living situation.
 */
function applyFilter() {
    const filter = document.getElementById('filterInput').value.toLowerCase();
    const tbody = document.getElementById('veteranTable').querySelector('tbody');
    Array.from(tbody.querySelectorAll('tr')).forEach((tr, idx) => {
        if (tr.className === 'expand-row') return;
        const name = tr.children[0].textContent.toLowerCase();
        const care = tr.children[2].textContent.toLowerCase();
        const living = tr.children[3].querySelector('select').value.toLowerCase();
        if (name.includes(filter) || care.includes(filter) || living.includes(filter)) {
            tr.style.display = '';
            const detailsRow = tbody.querySelector(`#details-row-${idx}`);
            if (detailsRow) detailsRow.style.display = 'none';
        } else {
            tr.style.display = 'none';
            const detailsRow = tbody.querySelector(`#details-row-${idx}`);
            if (detailsRow) detailsRow.style.display = 'none';
        }
    });
}

// =========================
// Page Initialization
// =========================

/**
 * On page load, populate the case manager filter dropdown and fetch veterans.
 * Adds a default blank option to the dropdown for clarity.
 */
document.addEventListener('DOMContentLoaded', async () => {
    const caseManagerFilter = document.getElementById('caseManagerFilter');
    const sessionResp = await fetch('/api/case_manager_session');
    const sessionData = await sessionResp.json();
    const agencyId = sessionData.agency_id;
    const loggedInCaseManagerId = sessionData.id; // assuming 'id' is the case manager's id

    if (!agencyId) return;

    // Add both a blank and an "All Case Managers" option
    caseManagerFilter.innerHTML = `
        <option value="">— Filter by Case Manager —</option>
        <option value="ALL">All Case Managers</option>
    `;

    const response = await fetch(`/api/case_managers?agency_id=${agencyId}`);
    const caseManagers = await response.json();

    caseManagers.forEach(cm => {
        const option = document.createElement('option');
        option.value = cm.id;
        option.textContent = cm.username;
        caseManagerFilter.appendChild(option);
    });

    // Set dropdown to logged-in case manager by default
    caseManagerFilter.value = loggedInCaseManagerId;

    // Fetch and display only the logged-in case manager's veterans by default
    await fetchVeteransByCaseManager(loggedInCaseManagerId);

    // Filter logic: blank or "All" both show all, otherwise filter by case manager
    caseManagerFilter.addEventListener('change', async () => {
        const selectedCaseManagerId = caseManagerFilter.value;
        if (selectedCaseManagerId === "" || selectedCaseManagerId === "ALL") {
            await fetchVeterans(true);
        } else {
            await fetchVeteransByCaseManager(selectedCaseManagerId);
        }
    });
});