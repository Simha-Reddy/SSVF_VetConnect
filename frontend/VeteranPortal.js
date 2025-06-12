// =========================
// Veteran Portal JavaScript
// =========================

// --- API Base URL ---
const apiUrl = 'http://127.0.0.1:5000/api'; // URL for the Flask backend

// =========================
// Data Fetching & UI Update
// =========================

/**
 * Fetch patient data from the backend and update the UI.
 */
async function fetchPatientData() {
    try {
        const response = await fetch(`${apiUrl}/patient`);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const data = await response.json();
        updateUI(data);
    } catch (error) {
        console.error('There was a problem with the fetch operation:', error);
    }
}

/**
 * Update the UI with patient data.
 * @param {Object} data - Patient data object from backend.
 */
function updateUI(data) {
    const patientInfoDiv = document.getElementById('patient-info');
    if (data.error) {
        patientInfoDiv.innerHTML = `<div style="color:red;">${data.error}</div>`;
        return;
    }

    // Helper: Format a single appointment as HTML
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

    // Helper: Group care teams by location and render as expandable sections
    function renderCareTeamsExpandable(careTeams) {
        if (!careTeams || careTeams.length === 0) {
            return '<div style="color:#888;">None found.</div>';
        }
        // Group by location
        const grouped = {};
        careTeams.forEach(team => {
            const location = (team.locations && team.locations.length > 0) ? team.locations[0] : "Unknown Location";
            if (!grouped[location]) grouped[location] = [];
            grouped[location].push({
                practitioner: team.practitioner || "—",
                role: (team.role && team.role.length > 0) ? team.role.join(", ") : "Unknown Role"
            });
        });
        // Render expandable sections
        return Object.keys(grouped).map((location, idx) => `
            <div style="margin-bottom:10px; margin-left:10px;">
                <button type="button" class="careteam-toggle" onclick="toggleCareTeamSection('careTeam-${idx}')"
                    style="background:#205493; color:#fff; border:none; border-radius:4px; padding:2px 10px; font-size:0.98em; cursor:pointer; margin-bottom:4px;">
                    ${location}
                </button>
                <div id="careTeam-${idx}" style="display:none; margin-left:18px; margin-top:6px;">
                    ${grouped[location].map(prac => `
                        <div style="margin-bottom:8px;">
                            <strong>Practitioner:</strong> ${prac.practitioner}<br>
                            <strong>Role:</strong> ${prac.role}
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
    }

    // Main patient info HTML
    patientInfoDiv.innerHTML = `
        <div style="background:#f6f8fa; border-radius:8px; padding:20px; max-width:600px;">
            <h2 style="color:#205493; margin-top:0;">Your VA Profile</h2>
            <p><strong>Name:</strong> ${data.name || '—'}</p>
            <p><strong>Date of Birth:</strong> ${data.dob || '—'}</p>
            <p><strong>Age:</strong> ${data.age || '—'}</p>
            <p><strong>Address:</strong> ${data.address || '—'}</p>
            <p><strong>Phone(s):</strong> ${(data.phones && data.phones.length) ? data.phones.join(', ') : '—'}</p>
            <p><strong>Email(s):</strong> ${(data.emails && data.emails.length) ? data.emails.join(', ') : '—'}</p>
            <p><strong>SSN:</strong> ${data.ssn ? 'Ending in ' + data.ssn.slice(-4) : '—'}</p>
            <hr>
            <h3 style="margin-bottom:6px;">Upcoming Appointments</h3>
            ${data.upcoming_appointments && data.upcoming_appointments.length
                ? data.upcoming_appointments.map(formatAppt).join('')
                : '<div style="color:#888;">None found.</div>'}
            <h3 style="margin-bottom:6px; margin-top:18px;">Past Appointments</h3>
            ${data.past_appointments && data.past_appointments.length
                ? data.past_appointments.map(formatAppt).join('')
                : '<div style="color:#888;">None found.</div>'}
            <hr>
            <h3 style="margin-bottom:6px;">Care Team</h3>
            ${renderCareTeamsExpandable(data.care_teams)}
        </div>
    `;
}

// =========================
// OAuth and Access Controls
// =========================

/**
 * Redirects to OAuth login for access approval.
 */
document.getElementById('approve-button').addEventListener('click', () => {
    window.location.href = '/login';
});

/**
 * Revokes access by calling the backend and alerts the user.
 */
document.getElementById('revoke-button').addEventListener('click', async () => {
    try {
        const response = await fetch(`${apiUrl}/revoke`, { method: 'POST' });
        const data = await response.json();
        alert(data.message || 'Access revoked.');
    } catch (error) {
        alert('Failed to revoke access.');
    }
});

// =========================
// Patient Data Fetch Button
// =========================

/**
 * Fetches patient data when the fetch button is clicked.
 * Handles redirect if not authorized.
 */
document.getElementById('fetch-button').addEventListener('click', async () => {
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = "Loading your info...";
    try {
        const resp = await fetch(`${apiUrl}/patient`);
        if (resp.status === 401 || resp.status === 403) {
            window.location.href = '/login?next=/VeteranPortal.html?fetch=1';
            return;
        }
        const data = await resp.json();
        statusDiv.textContent = "";
        // Build the patient info HTML using your updateUI logic, but return the HTML string instead of setting innerHTML
        const patientInfoHTML = buildPatientInfoHTML(data);
        renderMainContent(patientInfoHTML);
    } catch (e) {
        statusDiv.textContent = "Failed to fetch info.";
    }
});

// =========================
// Auto-fetch on Page Load
// =========================

/**
 * If the URL contains ?fetch=1, auto-click the fetch button on load.
 */
window.addEventListener('DOMContentLoaded', function() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('fetch') === '1') {
        document.getElementById('fetch-button').click();
    }
});

// =========================
// Care Team Section Toggle
// =========================

/**
 * Expands or collapses a care team section by ID.
 * @param {string} id - The DOM id of the care team section.
 */
function toggleCareTeamSection(id) {
    const el = document.getElementById(id);
    if (el) {
        el.style.display = (el.style.display === 'none' || el.style.display === '') ? 'block' : 'none';
    }
}

// =========================
// Patient Info HTML Builder
// =========================

/**
 * Builds the patient info HTML (used by fetch and updateUI).
 * @param {Object} data - Patient data object.
 * @returns {string} - HTML string for patient info.
 */
function buildPatientInfoHTML(data) {
    if (data.error) {
        return `<div style="color:red;">${data.error}</div>`;
    }
    // Helper: Format a single appointment as HTML
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
    // Helper: Group care teams by location and render as expandable sections
    function renderCareTeamsExpandable(careTeams) {
        if (!careTeams || careTeams.length === 0) {
            return '<div style="color:#888;">None found.</div>';
        }
        // Group by location
        const grouped = {};
        careTeams.forEach(team => {
            const location = (team.locations && team.locations.length > 0) ? team.locations[0] : "Unknown Location";
            if (!grouped[location]) grouped[location] = [];
            grouped[location].push({
                practitioner: team.practitioner || "—",
                role: (team.role && team.role.length > 0) ? team.role.join(", ") : "Unknown Role"
            });
        });
        // Render expandable sections
        return Object.keys(grouped).map((location, idx) => `
            <div style="margin-bottom:10px; margin-left:10px;">
                <button type="button" class="careteam-toggle" onclick="toggleCareTeamSection('careTeam-${idx}')"
                    style="background:#205493; color:#fff; border:none; border-radius:4px; padding:2px 10px; font-size:0.98em; cursor:pointer; margin-bottom:4px;">
                    ${location}
                </button>
                <div id="careTeam-${idx}" style="display:none; margin-left:18px; margin-top:6px;">
                    ${grouped[location].map(prac => `
                        <div style="margin-bottom:8px;">
                            <strong>Practitioner:</strong> ${prac.practitioner}<br>
                            <strong>Role:</strong> ${prac.role}
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
    }

    return `
        <div style="background:#f6f8fa; border-radius:8px; padding:20px; max-width:600px;">
            <h2 style="color:#205493; margin-top:0;">Your VA Profile</h2>
            <p><strong>Name:</strong> ${data.name || '—'}</p>
            <p><strong>Date of Birth:</strong> ${data.dob || '—'}</p>
            <p><strong>Age:</strong> ${data.age || '—'}</p>
            <p><strong>Address:</strong> ${data.address || '—'}</p>
            <p><strong>Phone(s):</strong> ${(data.phones && data.phones.length) ? data.phones.join(', ') : '—'}</p>
            <p><strong>Email(s):</strong> ${(data.emails && data.emails.length) ? data.emails.join(', ') : '—'}</p>
            <p><strong>SSN:</strong> ${data.ssn ? 'Ending in ' + data.ssn.slice(-4) : '—'}</p>
            <hr>
            <h3 style="margin-bottom:6px;">Upcoming Appointments</h3>
            ${data.upcoming_appointments && data.upcoming_appointments.length
                ? data.upcoming_appointments.map(formatAppt).join('')
                : '<div style="color:#888;">None found.</div>'}
            <h3 style="margin-bottom:6px; margin-top:18px;">Past Appointments</h3>
            ${data.past_appointments && data.past_appointments.length
                ? data.past_appointments.map(formatAppt).join('')
                : '<div style="color:#888;">None found.</div>'}
            <hr>
            <h3 style="margin-bottom:6px;">Care Team</h3>
            ${renderCareTeamsExpandable(data.care_teams)}
        </div>
    `;
}

// =========================
// Demo Table Copy-to-Clipboard
// =========================

/**
 * Copies text to clipboard and gives visual feedback.
 * @param {string} text - The text to copy.
 * @param {HTMLElement} el - The element to update for feedback.
 */
function copyToClipboard(text, el) {
    navigator.clipboard.writeText(text).then(() => {
        el.style.color = "#43a047";
        el.title = "Copied!";
        setTimeout(() => {
            el.style.color = "#205493";
            el.title = "Copy";
        }, 1200);
    });
}

// =========================
// Veteran Checklist Rendering
// =========================

/**
 * Returns the HTML for the Veteran Health Care Connection Checklist.
 * Used in both flex and centered modes.
 */
function getChecklistHTML() {
    return `
    <div class="veteran-checklist">
        <h2 style="color:#205493; margin-top:0; margin-bottom:18px;">Veteran Health Care Connection Checklist</h2>
        <p style="font-size:1.08em; margin-bottom:18px;">
            <strong>Ask your SSVF Case Manager for assistance. They're here to help!</strong>
        </p>
        <div style="margin-bottom: 10px;">
            <details>
                <summary style="font-weight:bold; font-size:1.08em; color:#205493;">Step 1: Get a VA Appointment</summary>
                <ul style="margin-top:8px;">
                    <li>Contact your Primary Care Clinic or local VA.</li>
                    <li>Ask about VA Telehealth options:
                        <ul>
                            <li><b>VA Video Connect (VVC)</b> or <b>Clinical Video Telehealth (CVT)</b> lets you see your doctor by phone, tablet, or computer.</li>
                            <li>Telehealth can help you avoid travel, save time, and get care quickly.</li>
                            <li>
                                See the 
                                <a href="telehealth_quick_card.html" target="_blank" style="color:#205493; text-decoration:underline;">
                                    Telehealth Quick Card
                                </a> 
                                for tips on using VA Telehealth and getting connected.
                            </li>
                        </ul>
                    </li>
                </ul>
            </details>
        </div>
        <div style="margin-bottom: 10px;">
            <details>
                <summary style="font-weight:bold; font-size:1.08em; color:#205493;">Step 2: Access Physical and Mental Healthcare</summary>
                <ul style="margin-top:8px;">
                    <li>Secure a Primary Care Provider (PCP) through your Patient Aligned Care Team (PACT).</li>
                    <li>Work with your case manager or healthcare navigator if you have difficulty accessing care.</li>
                    <li>Schedule needed care:
                        <ul>
                            <li>Primary Care</li>
                            <li>Mental Health</li>
                            <li>Substance Use Treatment</li>
                            <li>Prescriptions</li>
                            <li>Follow-up Appointments</li>
                        </ul>
                    </li>
                </ul>
            </details>
        </div>
        <div style="margin-bottom: 10px;">
            <details>
                <summary style="font-weight:bold; font-size:1.08em; color:#205493;">Step 3: Include Your Healthcare Navigator in your VA Care Team</summary>
                <ul style="margin-top:8px;">
                    <li>Let your VA team know if you have a healthcare navigator or case manager helping you.</li>
                </ul>
            </details>
        </div>
        <div style="margin-bottom: 10px;">
            <details>
                <summary style="font-weight:bold; font-size:1.08em; color:#205493;">Step 4: Transportation Help</summary>
                <ul style="margin-top:8px;">
                    <li>Ask the VA or navigator about:
                        <ul>
                            <li>Travel pay</li>
                            <li>VA shuttles</li>
                            <li>Veteran service organization rides</li>
                        </ul>
                    </li>
                </ul>
            </details>
        </div>
        <div style="margin-bottom: 10px;">
            <details>
                <summary style="font-weight:bold; font-size:1.08em; color:#205493;">Step 5: Access Additional Support</summary>
                <ul style="margin-top:8px;">
                    <li>Ask the healthcare navigator or VA social worker to connect you to:
                        <ul>
                            <li>Dental and vision care</li>
                            <li>Vocational rehabilitation</li>
                            <li>Benefits and claims assistance</li>
                            <li>Legal and advocacy support</li>
                        </ul>
                    </li>
                </ul>
            </details>
        </div>
        <div style="margin-top:18px;">
            <h3 style="margin-bottom:8px; color:#205493;">Key Phone Numbers</h3>
            <ul style="list-style:none; padding-left:0; font-size:1.08em;">
                <li><b>VA Benefits / Enrollment:</b> 1-877-222-VETS (8387)</li>
                <li><b>Veterans Crisis Line:</b> 988, then press 1</li>
                <li><b>SSVF Health Care Navigator (local contact):</b> <span style="color:#888;">_____________</span></li>
                <li><b>Transportation Help (local contact):</b> <span style="color:#888;">______________</span></li>
            </ul>
        </div>
    </div>
    `;
}

// =========================
// Main Content Rendering
// =========================

/**
 * Renders the main content area with patient info and checklist.
 * @param {string} patientInfoHTML - HTML string for patient info.
 */
function renderMainContent(patientInfoHTML) {
    const mainContent = document.getElementById('main-content');
    if (patientInfoHTML && patientInfoHTML.trim() !== '') {
        // Show patient info and checklist side by side
        mainContent.innerHTML = `
            <div class="main-flex">
                <div>${patientInfoHTML}</div>
                <div>${getChecklistHTML()}</div>
            </div>
        `;
    } else {
        // Show checklist centered and full width
        mainContent.innerHTML = `
            <div class="centered-checklist">
                ${getChecklistHTML()}
            </div>
        `;
    }
}

// On page load, show only the checklist (no patient info yet)
renderMainContent('');

// Expose renderMainContent globally if needed elsewhere
window.renderMainContent = renderMainContent;