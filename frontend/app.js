// frontend/app.js

const apiUrl = 'http://127.0.0.1:5000/api'; // URL for the Flask backend

// Function to fetch patient data from the backend
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

// Function to update the UI with patient data
function updateUI(data) {
    const patientInfoDiv = document.getElementById('patient-info');
    if (data.error) {
        patientInfoDiv.innerHTML = `<div style="color:red;">${data.error}</div>`;
        return;
    }
    // Format appointments
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
    // Format care teams
    function formatCareTeam(team) {
        return `
            <div style="margin-bottom:8px;">
                <strong>Practitioner:</strong> ${team.practitioner || '—'}<br>
                <strong>Organization:</strong> ${team.organization || '—'}<br>
                <strong>Role:</strong> ${(team.role && team.role.length) ? team.role.join(', ') : '—'}<br>
                <strong>Location(s):</strong> ${(team.locations && team.locations.length) ? team.locations.join(', ') : '—'}
            </div>
        `;
    }
    // Group care teams by location and make expandable
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

// Approve/Grant Access (redirect to OAuth login)
document.getElementById('approve-button').addEventListener('click', () => {
    window.location.href = '/login';
});

// Revoke Access
document.getElementById('revoke-button').addEventListener('click', async () => {
    try {
        const response = await fetch(`${apiUrl}/revoke`, { method: 'POST' });
        const data = await response.json();
        alert(data.message || 'Access revoked.');
    } catch (error) {
        alert('Failed to revoke access.');
    }
});

// Event listener for the fetch button
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
        const patientInfoHTML = buildPatientInfoHTML(data); // You need to create this function
        renderMainContent(patientInfoHTML);
    } catch (e) {
        statusDiv.textContent = "Failed to fetch info.";
    }
});

// Auto-fetch on load if ?fetch=1 in URL
window.addEventListener('DOMContentLoaded', function() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('fetch') === '1') {
        document.getElementById('fetch-button').click();
    }
});

// Toggle Care Team section visibility
function toggleCareTeamSection(id) {
    const el = document.getElementById(id);
    if (el) {
        el.style.display = (el.style.display === 'none' || el.style.display === '') ? 'block' : 'none';
    }
}

// Build patient info HTML (for internal use, e.g., after fetch)
function buildPatientInfoHTML(data) {
    if (data.error) {
        return `<div style="color:red;">${data.error}</div>`;
    }
    // Format appointments
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
    // Format care teams
    function formatCareTeam(team) {
        return `
            <div style="margin-bottom:8px;">
                <strong>Practitioner:</strong> ${team.practitioner || '—'}<br>
                <strong>Organization:</strong> ${team.organization || '—'}<br>
                <strong>Role:</strong> ${(team.role && team.role.length) ? team.role.join(', ') : '—'}<br>
                <strong>Location(s):</strong> ${(team.locations && team.locations.length) ? team.locations.join(', ') : '—'}
            </div>
        `;
    }
    // Group care teams by location and make expandable
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