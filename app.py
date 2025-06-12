import os
import json
import requests
from flask import Flask, redirect, request, session, jsonify, send_from_directory
from flask_cors import CORS
from datetime import datetime, timedelta
import threading

# =========================
# Flask App Setup
# =========================

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

app.secret_key = os.urandom(24)

# OAuth2 credentials and API endpoints
CLIENT_ID = "0oa13xn4aj5jvYcz62p8"
CLIENT_SECRET = "m9RtrL7ji4JNjtQdq1NbOg0YAUKMwREcv_PShu6WJFcBD4BXg2MKZ6UONPnzbuKQ"
REDIRECT_URI = "http://127.0.0.1:5000/oauth/callback"
AUTH_URL = "https://sandbox-api.va.gov/oauth2/health/v1/authorization"
TOKEN_URL = "https://sandbox-api.va.gov/oauth2/health/v1/token"
FHIR_API_BASE = "https://sandbox-api.va.gov/services/fhir/v0/r4"

TOKEN_DB = "tokens.json"
CASE_NOTES_DB = "case_notes.json"
case_notes_lock = threading.Lock()

# =========================
# Utility Functions
# =========================

def load_tokens():
    """Load tokens from the tokens.json file."""
    if not os.path.exists(TOKEN_DB):
        return {}
    with open(TOKEN_DB, "r") as f:
        return json.load(f)

def save_tokens(tokens):
    """Save tokens to the tokens.json file."""
    print("Saving tokens to tokens.json")
    with open(TOKEN_DB, "w") as f:
        json.dump(tokens, f)

def load_case_notes():
    """Load case notes from the case_notes.json file."""
    if not os.path.exists(CASE_NOTES_DB):
        return {}
    with open(CASE_NOTES_DB, "r") as f:
        content = f.read().strip()
        if not content:
            return {}
        return json.loads(content)

def save_case_notes(notes):
    """Save case notes to the case_notes.json file."""
    with case_notes_lock:
        with open(CASE_NOTES_DB, "w") as f:
            json.dump(notes, f)

def load_data():
    """Load agency/case manager/veteran assignments from assignments.json."""
    with open("./assignments.json", "r") as file:
        return json.load(file)

def authorize_agency(agency_id):
    """Check if the logged-in user is authorized for the given agency."""
    user = session.get("user")
    if not user or user["agency_id"] != agency_id:
        return False
    return True

def refresh_access_token(refresh_token):
    """Refresh an expired OAuth access token using the refresh token."""
    data = {
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
    }
    resp = requests.post(TOKEN_URL, data=data)
    if resp.status_code == 200:
        return resp.json()
    return None

# =========================
# Static & Frontend Routes
# =========================

@app.route("/")
def index():
    """Serve the main index.html page."""
    return send_from_directory('frontend', 'index.html')

@app.route('/<path:filename>')
def serve_static(filename):
    """Serve any other frontend file (HTML, JS, etc.)."""
    return send_from_directory('frontend', filename)

# =========================
# Authentication & Session
# =========================

@app.route("/case_manager_login", methods=["POST"])
def case_manager_login():
    """
    Handle case manager login.
    Expects JSON with agency_id, username, and password.
    """
    data = request.json
    agency_id = data.get("agency_id")
    if not agency_id or not agency_id.isdigit():
        return jsonify({"error": "Invalid agency ID"}), 400
    agency_id = int(agency_id)
    username = data.get("username")
    password = data.get("password")

    if not agency_id or not username or not password:
        return jsonify({"error": "Missing required fields"}), 400

    agencies = load_data()
    agency = next((a for a in agencies if a["id"] == agency_id), None)
    if not agency:
        return jsonify({"error": "Invalid agency"}), 400

    case_manager = next(
        (cm for cm in agency["case_managers"]
         if cm["username"].lower() == username.lower() and cm["password"] == password),
        None
    )

    if case_manager:
        # Store user info in session
        session["user"] = {
            "id": case_manager["id"],
            "agency_id": agency["id"],
            "username": case_manager["username"]
        }
        return jsonify({"success": True, "message": "Login successful"})
    else:
        return jsonify({"error": "Invalid credentials"}), 401

@app.route("/api/case_manager_session", methods=["GET"])
def get_case_manager_session():
    """Return the current logged-in case manager's session info."""
    user = session.get("user")
    if not user:
        return jsonify({"error": "Not logged in"}), 401
    return jsonify({
        "id": user["id"],
        "agency_id": user["agency_id"],
        "username": user["username"]
    })

# =========================
# OAuth2 Login & Callback
# =========================

@app.route("/login")
def login():
    """
    Start OAuth2 login flow for Veterans.
    Stores 'next' URL in session if provided.
    """
    next_url = request.args.get("next")
    if next_url:
        session["next"] = next_url
    auth_params = {
        "client_id": CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "response_type": "code",
        "scope": "launch/patient patient/Patient.read patient/Appointment.read patient/PractitionerRole.read patient/Location.read openid profile",
        "state": "random_state_string",
        "aud": "https://sandbox-api.va.gov/oauth2/authorization"
    }
    url = AUTH_URL + "?" + "&".join([f"{k}={v}" for k, v in auth_params.items()])
    return redirect(url)

@app.route("/oauth/callback")
def oauth_callback():
    """
    OAuth2 callback endpoint.
    Exchanges code for tokens and stores them by ICN (patient id).
    """
    print("Callback query parameters:", dict(request.args))
    code = request.args.get("code")
    if not code:
        return "No code provided", 400

    # Exchange code for token
    data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": REDIRECT_URI,
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET
    }
    resp = requests.post(TOKEN_URL, data=data)
    token_data = resp.json()
    access_token = token_data.get("access_token")
    refresh_token = token_data.get("refresh_token")
    icn = token_data.get("patient")  # Patient identifier

    print(f"OAuth callback ICN: {icn}")
    print(f"Token data: {token_data}")

    if not icn:
        return "No patient context provided", 400

    # Store tokens by ICN
    tokens = load_tokens()
    tokens[icn] = {
        "access_token": access_token,
        "refresh_token": refresh_token
    }
    try:
        save_tokens(tokens)
        print(f"Saved tokens for ICN: {icn}")
    except Exception as e:
        print(f"Error saving tokens: {e}")
    session["icn"] = icn
    session["access_token"] = access_token
    next_url = session.pop("next", None) or "/approval_success.html"
    return redirect(next_url)

@app.route("/approval-success")
def approval_success():
    """Serve the approval success page after OAuth."""
    return send_from_directory('frontend', 'approval_success.html')

# =========================
# Dashboard & Patient Data
# =========================

@app.route("/dashboard")
def dashboard():
    """Serve the Case Manager Dashboard if logged in."""
    if "user" not in session:
        return redirect("/login")
    return send_from_directory('frontend', 'SSVF_Dashboard.html')

@app.route("/api/patient")
def get_patient():
    """
    Return summary patient info for the given patient id (ICN).
    Uses session ICN if not provided.
    """
    patient_id = request.args.get("id")
    if not patient_id or patient_id == "session":
        patient_id = session.get("icn")
    if not patient_id:
        return jsonify({"error": "Missing patient id"}), 401

    tokens = load_tokens()
    token_info = tokens.get(patient_id)
    if not token_info:
        return jsonify({"error": "Not authorized for this patient"}), 403

    access_token = token_info["access_token"]
    summary = get_patient_summary(patient_id, access_token)
    return jsonify(summary)

def get_patient_summary(icn, access_token):
    """
    Build a summary of patient info, appointments, and care teams from FHIR API.
    """
    headers = {"Authorization": f"Bearer {access_token}"}
    summary = {"id": icn}

    # 1. Patient Info
    url = f"{FHIR_API_BASE}/Patient/{icn}"
    print(f"[INFO] Requesting: {url}")
    resp = requests.get(url, headers=headers)
    print(f"[INFO] Status: {resp.status_code}")
    try:
        print(f"[INFO] Response: {resp.json()}")
    except Exception as e:
        print(f"[ERROR] Could not parse JSON: {e}")

    if resp.status_code == 200:
        patient = resp.json()
        # Name
        if "name" in patient and len(patient["name"]) > 0:
            n = patient["name"][0]
            summary["name"] = f"{n.get('given', [''])[0]} {n.get('family', '')}".strip()
        # Age and DOB
        if "birthDate" in patient:
            try:
                birth = datetime.strptime(patient["birthDate"], "%Y-%m-%d")
                summary["age"] = int((datetime.now() - birth).days / 365.25)
            except Exception:
                pass
            summary["dob"] = patient["birthDate"]
        # Contact info
        phones = [tele["value"] for tele in patient.get("telecom", []) if tele.get("system") == "phone"]
        emails = [tele["value"] for tele in patient.get("telecom", []) if tele.get("system") == "email"]
        address = ""
        if "address" in patient and len(patient["address"]) > 0:
            addr = patient["address"][0]
            address = ", ".join(addr.get("line", [])) + f", {addr.get('city','')}, {addr.get('state','')}, {addr.get('postalCode','')}"
        if phones:
            summary["phones"] = phones
        if emails:
            summary["emails"] = emails
        if address:
            summary["address"] = address
        # SSN
        ssn = None
        for identifier in patient.get("identifier", []):
            type_field = identifier.get("type", {})
            codings = type_field.get("coding", [])
            for coding in codings:
                if (
                    coding.get("system") == "http://terminology.hl7.org/CodeSystem/v2-0203"
                    and coding.get("code") == "SS"
                ):
                    ssn = identifier.get("value")
                    break
            if ssn:
                break
        if ssn:
            summary["ssn"] = ssn
    else:
        print(f"[ERROR] Failed to fetch Patient resource: {resp.text}")

    # 2. Appointments (Past and Upcoming)
    now = datetime.utcnow().isoformat() + "Z"
    for appt_type, date_filter in [("past", f"lt{now}"), ("upcoming", f"ge{now}")]:
        url = f"{FHIR_API_BASE}/Appointment?patient={icn}&date={date_filter}"
        print(f"[INFO] Requesting: {url}")
        resp = requests.get(url, headers=headers)
        print(f"[INFO] Status: {resp.status_code}")
        try:
            print(f"[INFO] Response: {resp.json()}")
        except Exception as e:
            print(f"[ERROR] Could not parse JSON: {e}")

        if resp.status_code == 200:
            bundle = resp.json()
            appts = []
            for entry in bundle.get("entry", []):
                appt = entry["resource"]
                appt_date = appt.get("start")
                if appt_date:
                    appt_info = {
                        "date": appt_date,
                        "description": appt.get("description", ""),
                        "status": appt.get("status", ""),
                        "service_type": ", ".join([st.get("text", "") for st in appt.get("serviceType", [])]) if "serviceType" in appt else "",
                        "reason": ", ".join([rc.get("text", "") for rc in appt.get("reasonCode", [])]) if "reasonCode" in appt else ""
                    }
                    appts.append(appt_info)
            if appt_type == "past":
                summary["past_appointments"] = appts
            else:
                summary["upcoming_appointments"] = appts
        elif resp.status_code == 403:
            print(f"[ERROR] Access denied for Appointment resource: {resp.text}")
        else:
            print(f"[ERROR] Failed to fetch Appointment resource: {resp.text}")

    # 3. PractitionerRole (Care Teams)
    url = f"{FHIR_API_BASE}/PractitionerRole?patient={icn}"
    print(f"[INFO] Requesting: {url}")
    resp = requests.get(url, headers=headers)
    print(f"[INFO] Status: {resp.status_code}")
    try:
        print(f"[INFO] Response: {resp.json()}")
    except Exception as e:
        print(f"[ERROR] Could not parse JSON: {e}")

    if resp.status_code == 200:
        bundle = resp.json()
        care_teams = []
        for entry in bundle.get("entry", []):
            role = entry["resource"]
            team_info = {
                "practitioner": role.get("practitioner", {}).get("display", ""),
                "organization": role.get("organization", {}).get("display", ""),
                "role": [code.get("text", "") for code in role.get("code", [])],
                "locations": [loc.get("display", "") for loc in role.get("location", [])],
            }
            care_teams.append(team_info)
        if care_teams:
            summary["care_teams"] = care_teams
    else:
        print(f"[ERROR] Failed to fetch PractitionerRole resource: {resp.text}")

    print(f"[SUMMARY] Final summary for {icn}: {json.dumps(summary, indent=2)}")
    return summary

# =========================
# Veteran Assignment & Management
# =========================

@app.route("/api/veterans", methods=["GET"])
def get_veterans():
    """
    Return all veterans for the agency, or for a specific case manager.
    Used for dashboard population and filtering.
    """
    user = session.get("user")
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    agencies = load_data()
    agency = next((a for a in agencies if a["id"] == user["agency_id"]), None)
    if not agency:
        return jsonify({"error": "Invalid agency"}), 400

    # Return all veterans for the agency
    if request.args.get("all") == "true":
        all_veterans = []
        for cm in agency["case_managers"]:
            for v in cm["veterans"]:
                v_copy = v.copy()
                v_copy["case_manager_id"] = cm["id"]
                all_veterans.append(v_copy)
        return jsonify(all_veterans)

    # Return veterans for a specific case manager
    case_manager_id = request.args.get("case_manager_id")
    if case_manager_id:
        case_manager = next((cm for cm in agency["case_managers"] if str(cm["id"]) == str(case_manager_id)), None)
        if not case_manager:
            return jsonify({"error": "Invalid case manager"}), 400
        veterans = []
        for v in case_manager["veterans"]:
            v_copy = v.copy()
            v_copy["case_manager_id"] = case_manager["id"]
            veterans.append(v_copy)
        return jsonify(veterans)

    # Default: return logged-in case manager's Veterans
    case_manager = next((cm for cm in agency["case_managers"] if cm["id"] == user["id"]), None)
    if not case_manager:
        return jsonify({"error": "Invalid case manager"}), 400
    veterans = []
    for v in case_manager["veterans"]:
        v_copy = v.copy()
        v_copy["case_manager_id"] = case_manager["id"]
        veterans.append(v_copy)
    return jsonify(veterans)

@app.route("/api/reassign_veteran", methods=["POST"])
def reassign_veteran():
    """
    Reassign a veteran to a new case manager within the same agency.
    """
    user = session.get("user")
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json
    veteran_id = data.get("veteran_id")
    new_case_manager_id = data.get("new_case_manager_id")

    if not veteran_id or not new_case_manager_id:
        return jsonify({"error": "Missing required fields"}), 400

    agencies = load_data()
    agency = next((a for a in agencies if a["id"] == user["agency_id"]), None)
    if not agency:
        return jsonify({"error": "Invalid agency"}), 400

    new_case_manager = next(
        (cm for cm in agency["case_managers"] if cm["id"] == new_case_manager_id),
        None
    )
    if not new_case_manager:
        return jsonify({"error": "Invalid case manager"}), 400

    # Find and update the Veteran
    for cm in agency["case_managers"]:
        veteran = next((v for v in cm["veterans"] if v["id"] == veteran_id), None)
        if veteran:
            cm["veterans"].remove(veteran)
            new_case_manager["veterans"].append(veteran)
            break
    else:
        return jsonify({"error": "Veteran not found"}), 404

    # Save updated data back to JSON
    with open("./assignments.json", "w") as file:
        json.dump(agencies, file)

    return jsonify({"success": True, "message": "Veteran reassigned successfully"})

@app.route("/api/assign_veteran", methods=["POST"])
def assign_veteran():
    """
    Assign a veteran to a case manager.
    Used when a veteran approves access via the portal.
    """
    data = request.json
    agency_id = data.get("agency_id")
    case_manager_id = data.get("case_manager_id")

    if not agency_id or not case_manager_id:
        return jsonify({"error": "Missing required fields"}), 400

    agencies = load_data()
    agency = next((a for a in agencies if a["id"] == agency_id), None)
    if not agency:
        return jsonify({"error": "Invalid agency"}), 400

    case_manager = next((cm for cm in agency["case_managers"] if cm["id"] == case_manager_id), None)
    if not case_manager:
        return jsonify({"error": "Invalid case manager"}), 400

    veteran_id = session.get("icn")
    access_token = session.get("access_token")
    refresh_token = None
    tokens = load_tokens()
    if veteran_id in tokens:
        refresh_token = tokens[veteran_id].get("refresh_token")
    if not veteran_id or not access_token:
        return jsonify({"error": "Veteran not logged in"}), 401

    # Fetch name and dob from FHIR Patient API
    headers = {"Authorization": f"Bearer {access_token}"}
    url = f"{FHIR_API_BASE}/Patient/{veteran_id}"
    resp = requests.get(url, headers=headers)
    name = "New Veteran"
    dob = ""
    if resp.status_code == 200:
        patient = resp.json()
        if "name" in patient and len(patient["name"]) > 0:
            n = patient["name"][0]
            name = f"{n.get('given', [''])[0]} {n.get('family', '')}".strip()
        dob = patient.get("birthDate", "")

    # Check if the veteran is already assigned in this agency
    already_assigned = None
    for cm in agency["case_managers"]:
        for v in cm["veterans"]:
            if v["id"] == veteran_id:
                already_assigned = cm
                break
        if already_assigned:
            break

    if already_assigned:
        if already_assigned["id"] == case_manager_id:
            # Same case manager: just renew tokens
            tokens[veteran_id] = {
                "access_token": access_token,
                "refresh_token": refresh_token or session.get("refresh_token")
            }
            save_tokens(tokens)
            return jsonify({"success": True, "message": "Access renewed for existing case manager."})
        else:
            # Remove from old case manager and add to new one
            already_assigned["veterans"] = [v for v in already_assigned["veterans"] if v["id"] != veteran_id]
            # Add to new case manager below

    # Add the Veteran to the case manager's list with name and dob
    if not any(v["id"] == veteran_id for v in case_manager["veterans"]):
        case_manager["veterans"].append({
            "id": veteran_id,
            "name": name,
            "dob": dob
        })

    # Save updated data back to JSON
    with open("./assignments.json", "w") as file:
        json.dump(agencies, file)

    # Always update tokens
    tokens[veteran_id] = {
        "access_token": access_token,
        "refresh_token": refresh_token or session.get("refresh_token")
    }
    save_tokens(tokens)

    return jsonify({"success": True, "message": "Veteran assigned successfully"})

# =========================
# Case Notes API
# =========================

@app.route("/api/case_notes", methods=["POST"])
def save_case_notes_api():
    """
    Save or update case notes for a veteran.
    """
    data = request.json
    icn = data.get("icn")
    if not icn:
        return jsonify({"error": "Missing ICN"}), 400
    notes = load_case_notes()
    notes[icn] = {
        "living_situation": data.get("living_situation"),
        "last_contact": data.get("last_contact"),
        "case_notes": data.get("case_notes")
    }
    save_case_notes(notes)
    return jsonify({"success": True})

@app.route("/api/case_notes/<icn>")
def get_case_notes_api(icn):
    """
    Get case notes for a specific veteran (ICN).
    """
    notes = load_case_notes()
    return jsonify(notes.get(icn, {}))

# =========================
# Consent/Token Revocation
# =========================

@app.route("/api/revoke", methods=["POST"])
def revoke_access():
    """
    Revoke a veteran's consent/token (removes from tokens.json and session).
    """
    icn = session.get("icn")
    if icn:
        tokens = load_tokens()
        tokens.pop(icn, None)
        save_tokens(tokens)
    session.pop("access_token", None)
    session.pop("icn", None)
    return jsonify({"message": "Access revoked."})

# =========================
# Agency & Case Manager Info
# =========================

@app.route("/api/agencies", methods=["GET"])
def get_agencies():
    """Return a list of all agencies (id and name only)."""
    agencies = load_data()
    return jsonify([{"id": a["id"], "name": a["name"]} for a in agencies])

@app.route("/api/case_managers", methods=["GET"])
def get_case_managers():
    """Return all case managers for a given agency."""
    agency_id = request.args.get("agency_id")
    if not agency_id:
        return jsonify({"error": "Missing agency ID"}), 400

    agencies = load_data()
    agency = next((a for a in agencies if str(a["id"]) == agency_id), None)
    if not agency:
        return jsonify({"error": "Invalid agency ID"}), 400

    return jsonify([{"id": cm["id"], "username": cm["username"]} for cm in agency["case_managers"]])

# =========================
# App Entry Point
# =========================

if __name__ == "__main__":
    app.run(debug=True)